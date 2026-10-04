"""
Currículo de la ESO de la Comunitat Valenciana: Decreto 107/2022 con el
Decreto 66/2024 aplicado, en castellano y en valenciano.

Los dos son el DOGV entero en un PDF: el articulado en dos columnas
(valenciano y castellano) y los anexos, primero todos en valenciano y después
todos en castellano. El currículo de cada materia está en los anexos III
(comunes y de opción) y IV (optativas). El 66/2024 sustituye entero el de
Biología y Geología, Matemáticas y Música, y añade el de Finanzas y Consumo
Responsables (puntos 14 a 17 de su anexo I).

Cada materia maqueta sus criterios a su manera (tablas por curso con o sin
código, listas numeradas, viñetas…); `MATERIAS` dice cómo leer cada una. Ver
docs/COMUNIDADES.md, «Comunitat Valenciana», ESO.

    python3 scripts/curriculo/eso_cv.py            # todo
    python3 scripts/curriculo/eso_cv.py --solo id  # una materia, para revisar
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import unicodedata
from collections import Counter
from functools import lru_cache
from pathlib import Path

import pdfplumber

RAIZ = Path(__file__).resolve().parents[2]
NORMATIVA = RAIZ / 'docs' / 'Normativa Comunitat Valenciana'
PDF = {'107': NORMATIVA / 'DECRETO 107-2022.pdf', '66': NORMATIVA / 'DECRETO 66-2024.pdf'}
SALIDA_SCRIPTS = Path(__file__).parent / 'comunitat-valenciana'
SALIDA_APP = RAIZ / 'src' / 'lib' / 'curriculum' / 'data' / 'comunitat-valenciana'
IDIOMAS = ('es', 'va')
CODIGO_APP = {'es': 'es', 'va': 'ca'}

# Grupos de cursos con los que la app resuelve el curso de una clase
# (`cursosDelGrupoEso` en src/lib/curriculum/index.ts).
CURSO = {1: '1º ESO', 2: '2º ESO', 3: '3º ESO', 4: '4º ESO'}
CICLO = {2: 'Primero y segundo', 4: 'Tercero y cuarto'}
PERFIL = {'P1': 'Perfil 1 (dos cursos)', 'P2': 'Perfil 2 (de primero a cuarto)'}


def m(id, es, va, fuente, pag_es, pag_va, crit, **extra):
    """Una materia: su nombre oficial, de qué decreto sale su currículo, sus
    páginas en cada lengua y cómo están sus criterios."""
    return dict(id=id, nombre={'es': es, 'va': va}, fuente=fuente, paginas={'es': pag_es, 'va': pag_va}, crit=crit, **extra)


# crit: 'tabla' (columnas con la cabecera de curso; `curso` si no la tienen),
# 'lista' (una columna; `inicio`: 'codigo', 'numero' o 'vineta').
# `por_ciclo`: los criterios de 2º y 4º son los del final de cada ciclo y
# valen para sus dos cursos.
MATERIAS = [
    m('biologia-y-geologia', 'Biología y Geología', 'Biologia i Geologia', '66', (203, 245), (16, 53), 'tabla',
      partes=[dict(crit='tabla', es=(233, 239), va=(42, 48)),
              dict(crit='lista', inicio='vineta', curso=4, es=(242, 245), va=(51, 53))]),   # adenda de 4º
    m('digitalizacion', 'Digitalización', 'Digitalització', '107', (668, 683), (89, 104), 'tabla', curso=4),
    m('economia-y-emprendimiento', 'Economía y Emprendimiento', 'Economia i Emprenedoria', '107', (684, 698), (105, 118), 'lista',
      inicio={'es': 'numero', 'va': 'codigo'}, curso=4),
    m('educacion-en-valores', 'Educación en Valores Cívicos y Éticos', 'Educació en Valors Cívics i Ètics', '107', (699, 719), (119, 138), 'tabla',
      saberes='guion'),   # «- Epígrafe» y debajo, sangrados, sus saberes, uno por línea
    m('educacion-fisica', 'Educación Física', 'Educació Física', '107', (720, 745), (139, 162), 'tabla', por_ciclo=True),
    m('educacion-plastica-visual-y-audiovisual', 'Educación Plástica, Visual y Audiovisual', 'Educació Plàstica, Visual i Audiovisual', '107', (746, 764), (163, 181), 'tabla'),
    m('expresion-artistica', 'Expresión Artística', 'Expressió Artística', '107', (765, 775), (182, 191), 'lista', inicio='codigo', curso=4),
    m('fisica-y-quimica', 'Física y Química', 'Física i Química', '107', (776, 837), (192, 251), 'tabla', sin_codigo=True,
      partes=[dict(crit='tabla', es=(819, 827), va=(234, 242)),
              dict(crit='lista', inicio='vineta', curso=4, es=(834, 837), va=(247, 251))]),   # adenda de 4º
    m('formacion-y-orientacion', 'Formación y Orientación Personal y Profesional', 'Formació i Orientació Personal i Professional', '107', (838, 852), (252, 266), 'lista', inicio='codigo', curso=4),
    m('geografia-e-historia', 'Geografía e Historia', 'Geografia i Història', '107', (853, 882), (267, 294), 'tabla', por_ciclo=True),
    m('latin', 'Latín', 'Llatí', '107', (883, 894), (295, 305), 'lista', inicio='vineta', curso=4),
    m('matematicas', 'Matemáticas', 'Matemàtiques', '66', (247, 286), (55, 90), 'tabla',
      grupos={2: CICLO[2], 3: CURSO[3], 4: CURSO[4]}),
    # Sin 4º: el 66/2024 sustituye la materia entera y su texto no lo trae
    m('musica', 'Música', 'Música', '66', (288, 313), (92, 116), 'tabla', grupos={12: CICLO[2], 3: CURSO[3]}),
    m('lengua-extranjera', 'Lengua Extranjera', 'Llengua Estrangera', '107', (953, 972), (363, 382), 'tabla', por_ciclo=True),
    m('tecnologia', 'Tecnología', 'Tecnologia', '107', (973, 991), (383, 401), 'tabla', curso=4),
    m('tecnologia-y-digitalizacion', 'Tecnología y Digitalización', 'Tecnologia i Digitalització', '107', (992, 1021), (402, 430), 'tabla'),
    m('lenguas', None, None, '107', (1022, 1055), (431, 462), 'tabla', por_ciclo=True),
    m('artes-escenicas', 'Artes Escénicas', 'Arts Escèniques', '107', (1056, 1072), (464, 479), 'lista', inicio='codigo', curso=4),
    m('creatividad-musical', 'Creatividad Musical', 'Creativitat Musical', '107', (1073, 1085), (480, 493), 'lista', inicio='codigo', curso=3,
      titulo_ce={'va': r'^\s*6\.(\d{1,2})\.\s+(?!\d)'}),    # en valenciano, «6.1. Identificar…» y «6.1.1.»
    m('cultura-clasica', 'Cultura Clásica', 'Cultura Clàssica', '107', (1086, 1099), (494, 508), 'lista', inicio='vineta', curso=3),
    m('emprendimiento-social-y-sostenible', 'Emprendimiento Social y Sostenible', 'Emprenedoria Social i Sostenible', '107', (1100, 1111), (509, 520), 'tabla', curso=2),
    m('filosofia', 'Filosofía', 'Filosofia', '107', (1112, 1124), (521, 532), 'tabla', curso=4),
    m('programacion-ia-y-robotica', 'Inteligencia Artificial, Programación y Robótica', 'Intel·ligència Artificial, Programació i Robòtica', '107', (1125, 1138), (533, 546), 'tabla'),
    m('laboratorio-de-artes-escenicas', 'Laboratorio de Artes Escénicas', 'Laboratori d’Arts Escèniques', '107', (1139, 1153), (547, 562), 'lista',
      inicio={'es': 'numero', 'va': 'codigo'}, curso=1),
    m('laboratorio-de-creacion-audiovisual', 'Laboratorio de Creación Audiovisual', 'Laboratori de Creació Audiovisual', '107', (1154, 1165), (563, 571), 'lista', inicio='codigo', curso=1),
    m('segunda-lengua-extranjera', 'Segunda Lengua Extranjera', 'Segona Llengua Estrangera', '107', (1166, 1187), (572, 594), 'tabla',
      grupos=PERFIL),
    m('taller-de-economia', 'Taller de Economía', 'Taller d’Economia', '107', (1188, 1202), (595, 608), 'tabla', curso=3),
    m('taller-de-relaciones-digitales', 'Taller de Relaciones Digitales Responsables', 'Taller de Relacions Digitals Responsables', '107', (1203, 1215), (609, 620), 'tabla', curso=1),
    m('finanzas-y-consumo-responsables', 'Finanzas y Consumo Responsables', 'Finances i Consum Responsables', '66', (315, 331), (117, 131), 'tabla', curso=1),
]


# ── Lectura del PDF ──────────────────────────────────────────────────────────

@lru_cache(maxsize=2)
def documento(fuente: str):
    return pdfplumber.open(PDF[fuente])


def sin_tildes(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()


CABECERA_PAGINA = 75   # «Num. 9403 / 11.08.2022 … 42409»


def lineas(fuente: str, n: int, excluir=()) -> list[dict]:
    """Las líneas de texto de una página, fuera de las cajas `excluir`."""
    p = documento(fuente).pages[n - 1]
    def fuera(o):
        if o.get('object_type') != 'char':
            return True
        cx, cy = (o['x0'] + o['x1']) / 2, (o['top'] + o['bottom']) / 2
        return not any(b[0] - 1 <= cx <= b[2] + 1 and b[1] - 1 <= cy <= b[3] + 1 for b in excluir)
    return [dict(top=l['top'], x0=l['x0'], x1=l['x1'], texto=l['text'])
            for l in p.filter(fuera).extract_text_lines() if l['top'] > CABECERA_PAGINA]


def contenida(a, b) -> bool:
    return a != b and a[0] >= b[0] - 1 and a[1] >= b[1] - 1 and a[2] <= b[2] + 1 and a[3] <= b[3] + 1


def tablas(fuente: str, n: int):
    """Las tablas de la página, también las que quedan dentro de otra: algunas
    celdas llevan su texto en un recuadro propio, que a veces repite lo que ya
    está en la celda de fuera y a veces es lo único que hay (ver `celdas`)."""
    p = documento(fuente).pages[n - 1]
    return [t for t in p.find_tables() if not es_marco(t.bbox, p)]


def es_marco(bbox, p) -> bool:
    """Algunas páginas llevan un recuadro alrededor de todo el texto, que se
    lee como una tabla de una sola celda: no lo es."""
    return (bbox[2] - bbox[0]) > 0.75 * p.width and (bbox[3] - bbox[1]) > 0.75 * p.height


def celdas_repetidas(fuente: str, n: int, ts) -> set:
    """Las celdas cuyo texto ya está en una celda con texto de otra tabla que
    las contiene."""
    con_texto = [(i, c) for i, t in enumerate(ts) for fila in t.rows for c in fila.cells
                 if c and texto_celda(fuente, n, c)]
    return {(i, tuple(c)) for i, c in con_texto
            if any(j != i and contenida(tuple(c), tuple(o)) for j, o in con_texto)}


def texto_celda(fuente: str, n: int, bbox) -> str:
    """El texto de una celda: los caracteres cuyo centro cae dentro. Recortar
    sin más mete letras de la línea de al lado cuando un borde de la tabla
    corta una línea de texto."""
    x0, top, x1, bottom = bbox
    def dentro(o):
        if o.get('object_type') != 'char':
            return False
        cx, cy = (o['x0'] + o['x1']) / 2, (o['top'] + o['bottom']) / 2
        return x0 <= cx <= x1 and top <= cy <= bottom
    return (documento(fuente).pages[n - 1].filter(dentro).extract_text() or '').strip()


# ── Guiones de final de línea ────────────────────────────────────────────────

GUION = '⁣'   # marca interna: aquí había un guion al final de una línea


@lru_cache(maxsize=4)
def vocabulario(fuente: str, idioma: str) -> Counter:
    """Las palabras del decreto tal y como están en el PDF, sin las partidas
    por un guion al final de la línea. Sale de `pdftotext -layout`, que deja
    ese guion donde está (sin `-layout` lo quita y junta las dos partes)."""
    texto = subprocess.run(['pdftotext', '-layout', str(PDF[fuente]), '-'], check=True, capture_output=True, text=True).stdout
    vocab: Counter = Counter()
    for linea in texto.splitlines():
        palabras = linea.split()
        if palabras and palabras[-1].endswith('-'):
            palabras = palabras[:-1]
        for w in palabras:
            for t in re.findall(r"[\w·-]+", w):
                vocab[t.lower().strip('-')] += 1
    return vocab


ENCLITICO = re.compile(r"^(?:lo|la|los|les|li|hi|ho|ne|se|me|te|nos|vos|en|el|ho)\b", re.I)
DECISIONES: list = []


def unir(lineas_texto: list[str], fuente: str, idioma: str) -> str:
    """Junta las líneas de un texto. Un guion al final de línea parte una
    palabra («instru-» + «mentals») o es de una compuesta: lo decide el
    vocabulario del propio decreto."""
    t = ''
    for l in lineas_texto:
        l = l.strip()
        if not l:
            continue
        if t.endswith('-') and not t.endswith(' -') and re.match(r'\w', l):
            t = t[:-1] + GUION + l
        else:
            t = (t + ' ' + l) if t else l
    vocab = vocabulario(fuente, idioma)

    def cambiar(mm):
        a, b = mm.group(1), mm.group(2)
        con, unida = f'{a}-{b}', a + b
        na = (re.findall(r"[\w·]+", a) or [''])[-1].lower()
        nb = (re.findall(r"[\w·]+", b) or [''])[0].lower()
        if vocab[(re.findall(r"[\w·-]+", con) or [''])[-1].lower()] or vocab[f'{na}-{nb}']:
            r, por = con, 'compuesta en el decreto'
        elif vocab[na + nb]:
            r, por = unida, 'entera en el decreto'
        elif ENCLITICO.match(b) and idioma == 'va':
            r, por = con, 'pronombre enclítico'
        else:
            r, por = unida, 'sin pistas: se une'
        DECISIONES.append((idioma, f'{a}|{b}', r, por))
        return r
    t = re.sub(r'(\S*)' + GUION + r'(\S*)', cambiar, t)
    return re.sub(r'\s+', ' ', t).strip()


# ── Criterios ────────────────────────────────────────────────────────────────

def curso_de(etiqueta: str):
    """Curso (1 a 4), «1.º y 2.º» (12) o perfil de la cabecera de una columna
    de criterios; `None` si no es una cabecera."""
    s = sin_tildes(etiqueta).replace('\n', ' ').strip()
    if not re.search(r'eso\b|curs|cicl|perfil', s) or len(s) > 40:
        return None
    if re.search(r'perfil\s*1', s):
        return 'P1'
    if re.search(r'perfil\s*2', s):
        return 'P2'
    if re.match(r'^\d\s*\.?\s*[ºo]?\s*[nrt]?\s*cicl', s):        # «2º Ciclo (4º)», «2n cicle (4t)»
        mm = re.search(r'\(\s*([1-4])', s)
        return int(mm.group(1)) if mm else None
    if re.search(r'\b1\s*\.?\s*(?:º|r|er)?\s*(?:y|i)\s*2', s):     # «1.º y 2.º ESO», «1r i 2n ESO»
        return 12
    mm = re.search(r'\b([1-4])\s*\.?\s*(?:er|r|o|º|n|t)?(?![0-9])', s)
    if mm:
        return int(mm.group(1))
    for n, pal in [(1, r'\bprimer'), (2, r'\bsegundo|\bsegon'), (3, r'\btercer'), (4, r'\bcuarto|\bquart')]:
        if re.search(pal, s):
            return n
    return None


CODIGO = re.compile(
    r'^\s*(?:CE|Cr\.?|CrEv|C|Criteri d.avaluació|Criterio de evaluación)?\s?(?:\d\.)?(\d{1,2})\s?\.\s?(\d{1,2})(?=[\s.\-–—]|$)\s*\.?\s*[-–—]?\s*')
CE_LINEAS = [
    re.compile(r'Compet[eèé]ncia(?: espec[ií]fica)?\s+(\d{1,2})\b', re.I),     # «Competencia específica 1»
    re.compile(r'(?:^|[\s(.])(?:CE|C\.E\.)\s?0?(\d{1,2})\b(?![.,]\d)'),       # «CE1.», «CE 1», «6.1. CE1»
    re.compile(r'^\s*(\d{1,2})\.\s+Compet', re.I),                             # «1. Competencia…»
]


def ce_de_linea(texto: str):
    """El número de la competencia si la línea es el título de una."""
    cod = CODIGO.match(texto)
    if cod and not re.match(r'(?:\d+(?:\.\d+)*\.?\s*)?(?:Compet|CE\s?\d)', texto[cod.end():], re.I):
        return None     # un criterio que cita una competencia no es su título
    for r in CE_LINEAS:
        mm = r.search(texto)
        if mm:
            return int(mm.group(1))
    return None


def curso_por_x(x: float, cabecera, curso_fijo):
    """El curso de la columna en que empieza un texto suelto."""
    if curso_fijo:
        return curso_fijo
    cols = sorted(cabecera or [], key=lambda k: k[0])
    if not cols:
        return None
    fronteras = [(a[1] + b[0]) / 2 for a, b in zip(cols, cols[1:])]
    return cols[sum(1 for f in fronteras if x >= f)][2]


def repartir(fuente: str, n: int, llenas: list, cabecera, curso_fijo):
    """A qué curso va cada celda: el de la columna de la cabecera en que cae.
    Si una celda abarca dos columnas (pasa cuando los bordes de la tabla no
    cuadran y la lectura junta las dos celdas), se parte por la frontera entre
    columnas y cada trozo va a la suya."""
    if curso_fijo:
        return [(c, t, curso_fijo) for c, t in llenas]
    cols = sorted(cabecera or [], key=lambda k: k[0])
    if not cols:
        return [(c, t, None) for c, t in llenas]
    fronteras = [(a[1] + b[0]) / 2 for a, b in zip(cols, cols[1:])]
    lim = [-1e9] + fronteras + [1e9]
    salida = []
    for c, t in llenas:
        dentro = [i for i in range(len(cols)) if min(c[2], lim[i + 1]) - max(c[0], lim[i]) > 25]
        if len(dentro) <= 1:
            cx = (c[0] + c[2]) / 2
            i = next(i for i in range(len(cols)) if lim[i] <= cx < lim[i + 1])
            salida.append((c, t, cols[i][2]))
            continue
        for i in dentro:
            trozo = (max(c[0], lim[i]), c[1], min(c[2], lim[i + 1]), c[3])
            tt = texto_celda(fuente, n, trozo)
            if tt:
                salida.append((trozo, tt, cols[i][2]))
    return salida


def criterios_tabla(mat: dict, idioma: str, paginas: range) -> dict:
    """Criterios en tablas: cada columna es un curso (su cabecera lo dice) y
    cada celda, un criterio que empieza por su código. Una celda que no lo
    lleva sigue al criterio anterior de su columna (la tabla sigue en la
    página siguiente)."""
    fuente = mat['fuente']
    salida: dict = {}
    ce, cabecera, suelto = None, None, None
    for n in paginas:
        ts = tablas(fuente, n)
        repetidas = celdas_repetidas(fuente, n, ts)
        eventos = [('linea', l['top'], l) for l in lineas(fuente, n, [t.bbox for t in ts])]
        eventos += [('tabla', t.bbox[1], (i, t)) for i, t in enumerate(ts)]
        for tipo, _, obj in sorted(eventos, key=lambda e: e[1]):
            if tipo == 'linea':
                nuevo = ce_de_linea(obj['texto'])
                if nuevo:
                    ce, suelto = nuevo, None
                    continue
                mm = CODIGO.match(obj['texto'])
                if mm and ce:
                    # un criterio fuera de los recuadros (la tabla se corta entre páginas)
                    curso = curso_por_x(obj['x0'], cabecera, mat.get('curso'))
                    suelto = dict(ce=ce, codigo=f'{mm.group(1)}.{mm.group(2)}', lineas=[obj['texto'][mm.end():]], pag=n)
                    salida.setdefault(curso, []).append(suelto)
                elif suelto is not None:
                    suelto['lineas'].append(obj['texto'])
                continue
            suelto = None
            i_tabla, tabla = obj
            for fila in tabla.rows:
                celdas = [(c, texto_celda(fuente, n, c)) for c in fila.cells
                          if c and (i_tabla, tuple(c)) not in repetidas]
                llenas = [(c, t) for c, t in celdas if t]
                if not llenas:
                    continue
                if len(llenas) == 1 and ce_de_linea(llenas[0][1].split('\n')[0]):
                    ce = ce_de_linea(llenas[0][1].split('\n')[0])     # el título de la competencia, en un recuadro
                    continue
                cursos = [curso_de(t) for _, t in llenas]
                if all(k is not None for k in cursos) and not any(CODIGO.match(t) for _, t in llenas) \
                        and all(len(t) < 40 for _, t in llenas):
                    cabecera = [(c[0], c[2], k) for (c, _), k in zip(llenas, cursos)]
                    continue
                for c, t, curso in repartir(fuente, n, llenas, cabecera, mat.get('curso')):
                    lista = salida.setdefault(curso, [])
                    trozos = re.split(r'\n(?=\s*(?:CE|Cr\.?|CrEv|C)?\s?\d{1,2}\s?\.\s?\d{1,2}(?:[\s.\-–—]))', t)
                    for trozo in trozos:
                        mm = CODIGO.match(trozo)
                        if mm:
                            lista.append(dict(ce=ce, codigo=f'{mm.group(1)}.{mm.group(2)}', lineas=trozo[mm.end():].split('\n'), pag=n))
                        elif lista and not ''.join(lista[-1]['lineas']).strip():
                            lista[-1]['lineas'] += trozo.split('\n')     # el código quedó solo al final de la página
                        elif lista and (not mat.get('sin_codigo') or not re.match(r'^[A-ZÁÉÍÓÚÀÈÒ(¿•]', trozo.strip())):
                            # sigue el criterio anterior: en las tablas con código solo un
                            # código empieza criterio; en las que no lo llevan, una mayúscula
                            lista[-1]['lineas'] += trozo.split('\n')
                        else:
                            lista.append(dict(ce=ce, codigo=None, lineas=trozo.split('\n'), pag=n))
        soltar(fuente, n)
    return salida


def soltar(fuente: str, n: int) -> None:
    """Libera lo que pdfplumber guarda de una página (sin esto, recorrer
    cientos de páginas agota la memoria)."""
    documento(fuente).pages[n - 1].close()


INICIO = {
    'codigo': CODIGO,
    'numero': re.compile(r'^\s*(\d{1,2})\s*\.\s+(?=\S)'),
    'vineta': re.compile(r'^\s*[•●▪-]\s*'),
}


def criterios_lista(mat: dict, idioma: str, paginas: range) -> dict:
    """Criterios en una columna: cada competencia con su título y debajo sus
    criterios, que empiezan por su código, un número o una viñeta."""
    fuente = mat['fuente']
    modo = mat['inicio'][idioma] if isinstance(mat['inicio'], dict) else mat['inicio']
    inicio = INICIO[modo]
    lista, ce, actual = [], None, None
    titulo = mat.get('titulo_ce', {}).get(idioma)
    for n in paginas:
        for l in lineas(fuente, n):
            t = l['texto']
            mt = re.match(titulo, t) if titulo else None
            nuevo = int(mt.group(1)) if mt else ce_de_linea(t)
            if nuevo:
                ce, actual = nuevo, None
                continue
            mm = inicio.match(t)
            if mm and ce:
                actual = dict(ce=ce, codigo=f'{mm.group(1)}.{mm.group(2)}' if modo == 'codigo' else None,
                              lineas=[t[mm.end():]], pag=n)
                lista.append(actual)
            elif actual:
                actual['lineas'].append(t)
        soltar(fuente, n)
    return {mat['curso']: lista}


def grupos_de(mat: dict) -> dict:
    if 'grupos' in mat:
        return mat['grupos']
    if mat.get('por_ciclo'):
        return CICLO
    return CURSO


def criterios(mat: dict, idioma: str) -> dict:
    """Los criterios de una materia por grupo de cursos de la app, crudos
    (líneas sin unir)."""
    partes = mat.get('partes') or [dict(crit=mat['crit'], **{i: (pagina_criterios(mat, i), mat['paginas'][i][1]) for i in IDIOMAS})]
    grupos, salida = grupos_de(mat), {}
    for parte in partes:
        cfg = {**mat, **parte}
        a, b = parte[idioma]
        crudos = (criterios_tabla if cfg['crit'] == 'tabla' else criterios_lista)(cfg, idioma, range(a, b + 1))
        for curso, lista in crudos.items():
            if curso not in grupos:
                raise SystemExit(f'{mat["id"]} ({idioma}): curso {curso!r} sin grupo en la app')
            salida.setdefault(grupos[curso], []).extend(lista)
    return salida


@lru_cache(maxsize=2)
def paginas_texto(fuente: str) -> list[str]:
    """El texto simple de cada página (`pdftotext`, sin opciones)."""
    out = subprocess.run(['pdftotext', str(PDF[fuente]), '-'], check=True, capture_output=True, text=True).stdout
    return out.split('\f')


# Donde la búsqueda automática no encuentra el título del apartado de criterios
PAG_CRITERIOS = {
    ('economia-y-emprendimiento', 'va'): 115,
    ('tecnologia-y-digitalizacion', 'es'): 1016,
    ('segunda-lengua-extranjera', 'va'): 589,
    ('expresion-artistica', 'es'): 774, ('expresion-artistica', 'va'): 190,
    ('laboratorio-de-artes-escenicas', 'es'): 1152,
}
TITULO_CRITERIOS = re.compile(r'^\s*\d{1,2}(?:\.\d)?\s*\.?\s*(?:Compet\S+ espec\S+ \d+\.\s*)?Criteri(?:os de evaluaci|s d.avaluaci)', re.M)


def pagina_criterios(mat: dict, idioma: str) -> int:
    if (mat['id'], idioma) in PAG_CRITERIOS:
        return PAG_CRITERIOS[(mat['id'], idioma)]
    ini, fin = mat['paginas'][idioma]
    texto = paginas_texto(mat['fuente'])
    for n in range(ini, fin + 1):
        if TITULO_CRITERIOS.search(texto[n - 1]):
            return n
    raise SystemExit(f'Sin apartado de criterios: {mat["id"]} ({idioma})')


def ver_criterios(mat: dict) -> None:
    for idioma in IDIOMAS:
        r = criterios(mat, idioma)
        print(f'== {mat["id"]} ({idioma})')
        for curso, lista in r.items():
            print(f'   curso {curso}: {len(lista)} criterios')
            for c in lista:
                print(f'      CE{c["ce"]} {c["codigo"]} p{c["pag"]} | {unir(c["lineas"], mat["fuente"], idioma)[:120]}')


if __name__ == '__main__' and '--criterios' not in sys.argv:
    if '--solo' in sys.argv:
        ids = sys.argv[sys.argv.index('--solo') + 1].split(',')
        for mat in MATERIAS:
            if mat['id'] in ids:
                ver_criterios(mat)


def todos_los_criterios(volcado: Path) -> dict:
    """Criterios de todas las materias en las dos lenguas (crudos, para revisar)."""
    res = {}
    for mat in MATERIAS:
        if SOLO and mat['id'] not in SOLO:
            continue
        for idioma in IDIOMAS:
            r = criterios(mat, idioma)
            res[f'{mat["id"]}|{idioma}'] = {str(k): [dict(ce=c['ce'], codigo=c['codigo'], pag=c['pag'],
                                                       texto=unir(c['lineas'], mat['fuente'], idioma)) for c in v]
                                            for k, v in r.items()}
        es, va = res[f'{mat["id"]}|es'], res[f'{mat["id"]}|va']
        forma = lambda d: {g: Counter(c['ce'] for c in v) for g, v in d.items()}
        sin = sum(1 for d in (es, va) for v in d.values() for c in v if c['codigo'] is None)
        aviso = '' if forma(es) == forma(va) else '  << DISTINTOS'
        print(f"{mat['id']:40} {({g: len(v) for g, v in es.items()})} {({g: len(v) for g, v in va.items()})} sin código: {sin}{aviso}", flush=True)
        previo = json.loads(volcado.read_text()) if volcado.exists() else {}
        previo.update({k: v for k, v in res.items() if k.startswith(mat['id'] + '|')})
        volcado.write_text(json.dumps(previo, ensure_ascii=False, indent=1))
    return res


SOLO = sys.argv[sys.argv.index('--solo') + 1].split(',') if '--solo' in sys.argv else None

if __name__ == '__main__' and '--criterios' in sys.argv:
    todos_los_criterios(Path(sys.argv[sys.argv.index('--criterios') + 1]))


# ── Competencias específicas ─────────────────────────────────────────────────

@lru_cache(maxsize=8)
def lineas_cache(fuente: str, idioma: str) -> dict:
    """Las líneas fuera de tablas de cada página de los anexos, guardadas por
    `cache_paginas` (leer 1.000 páginas con pdfplumber tarda)."""
    return {int(k): v['lineas'] for k, v in json.loads((CACHE / f'{fuente}{idioma}.json').read_text()).items()}


CACHE = Path('/tmp/claude-0/-home-user/6e8a7609-873c-5029-8db6-fb25a70baa95/scratchpad/vc')
TITULO_CE = re.compile(
    r'^\s*(?:2\s?\.\s?(\d{1,2})\s?\.?\s*)?(?:Compet[eè]ncia(?: espec[ií]fica)?|CE)\s*0?(\d{1,2})\b\s*[.:]?\s*(.*)$', re.I)
FIN_ENUNCIADO = re.compile(r'^\s*(?:2\s?\.\s?\d{1,2}\s?\.\s?\d|Descripci[óo]|\d\.\s+(?:Conexi|Connexi))', re.I)


def competencias(mat: dict, idioma: str) -> list[dict]:
    """Los enunciados de las competencias específicas, del apartado 2: tras
    «2.N. Competencia específica N» (con un título detrás en las lenguas), el
    primer párrafo. Un párrafo nuevo empieza con sangría."""
    ini, fin = mat['paginas'][idioma]
    cache = lineas_cache(mat['fuente'], idioma)
    ls = [dict(l, pag=n) for n in range(ini, fin + 1) for l in cache.get(n, []) if l['top'] > CABECERA_PAGINA]
    i0 = next(i for i, l in enumerate(ls) if re.match(r'^\s*2\s?\.?\s*Compet', l['text']))
    i1 = next((i for i in range(i0 + 1, len(ls)) if re.match(r'^\s*3\s?\.?\s*(?:Conexi|Connexi)', ls[i]['text'])), len(ls))
    sec = ls[i0 + 1:i1]
    margen = min(l['x0'] for l in sec)
    salida, i = [], 0
    while i < len(sec):
        mm = TITULO_CE.match(sec[i]['text'])
        if not mm or FIN_ENUNCIADO.match(sec[i]['text']):
            i += 1
            continue
        n, resto = int(mm.group(2)), mm.group(3).strip()
        j = i + 1
        sangrada = lambda k: sec[k]['x0'] > margen + 8
        if resto and (resto.endswith('.') or len(resto) > 70 or (j < len(sec) and not sangrada(j))):
            partes = [resto]                       # el enunciado empieza en el título
        else:
            partes = []                            # en la línea siguiente (tras un título, si lo hay)
            if j < len(sec):
                sig = TITULO_CE.match(sec[j]['text'])
                partes = [sig.group(3)] if sig and int(sig.group(2)) == n else [sec[j]['text']]
                j += 1
        while j < len(sec) and not sangrada(j) and not FIN_ENUNCIADO.match(sec[j]['text']) and not TITULO_CE.match(sec[j]['text']):
            partes.append(sec[j]['text'])
            j += 1
        salida.append(dict(n=n, texto=unir(partes, mat['fuente'], idioma)))
        i = j
    return salida


if __name__ == '__main__' and '--competencias' in sys.argv:
    for mat in MATERIAS:
        if SOLO and mat['id'] not in SOLO:
            continue
        for idioma in IDIOMAS:
            cs = competencias(mat, idioma)
            print(f"{mat['id']} ({idioma}) {[c['n'] for c in cs]}")
            if '-v' in sys.argv:
                for c in cs:
                    print(f"    {c['n']}: {c['texto'][:150]}")


# ── Saberes básicos ──────────────────────────────────────────────────────────

@lru_cache(maxsize=8)
def tablas_cache(fuente: str, idioma: str) -> dict:
    return {int(k): v['tablas'] for k, v in json.loads((CACHE / f'{fuente}{idioma}.json').read_text()).items()}


BLOQUE = re.compile(r'^\s*(?:\d\s?\.\s?\d{1,2}\s?\.?\s*)?(?:Bloque|Bloc|BLOQUE|BLOC)\s*(\d{1,2})\s*[:.\-–]?\s*(.*)$')
SUBBLOQUE = re.compile(r'^\s*(?:Sub-?\s?blo(?:que|c)|SUB-?\s?BLO(?:QUE|C)|SB|GRUPO DE SABERES|GRUP DE SABERS|Grupo de saberes|Grup de sabers)'
                       r'\s*(\d{1,2}(?:\s?\.\s?\d{1,2})?)\s*[:.\-–]?\s*(.*)$')
VINETA = re.compile(r'^\s*[•●▪◦⚫□−\-–]\s*')
CABECERA_SABERES = re.compile(r'^(?:Saberes b[áa]sicos|Sabers b[àa]sics|CURSO|CURS|CICLO|CICLE|Curso|Curs|Ciclo|Cicle)\b', re.I)
MARCA = re.compile(r'^(?:[xX✓✔]|\d\s?\.?\s?[ºª]|\d(?:er|r|n|t|º|o)?|1\.?er|(?:\(?Cursos?.*\)?))$')


def es_marca(t: str) -> bool:
    """Las celdas de curso: «x», «1º», «(Cursos 1º y 2º)»…"""
    t = t.strip()
    return not t or bool(MARCA.match(t)) or len(t) <= 3 or bool(re.match(r'^[xX\s]+$', t))


@lru_cache(maxsize=8)
def celdas_cache(fuente: str, idioma: str) -> dict:
    """Las tablas de las páginas de saberes con cada celda y sus líneas con
    su posición (`cache_saberes`): hace falta para distinguir un título
    centrado de una línea que sigue a la anterior."""
    return {int(k): v for k, v in json.loads((CACHE / f'sab_{fuente}{idioma}.json').read_text()).items()}


def eventos_saberes(mat: dict, idioma: str):
    """Las líneas del apartado 4, fuera y dentro de las tablas, en orden de
    lectura. Cada línea de una celda lleva la caja de su celda."""
    ini, fin = mat['paginas'][idioma]
    lin = lineas_cache(mat['fuente'], idioma)
    try:
        tab = celdas_cache(mat['fuente'], idioma)
    except FileNotFoundError:
        tab = {}
    ev = []
    for n in range(ini, fin + 1):
        for l in lin.get(n, []):
            if l['top'] > CABECERA_PAGINA:
                ev.append(dict(tipo='linea', pag=n, top=l['top'], x0=l['x0'], x1=l['x1'], texto=l['text'], celda=None))
        for t in tab.get(n, []):
            for k, fila in enumerate(t['filas']):
                for c in fila:
                    textos = ' '.join(l['text'] for l in c['lineas'])
                    if es_marca(textos):
                        continue
                    for m, l in enumerate(c['lineas']):
                        ev.append(dict(tipo='celda', pag=n, top=l['top'] + 0.001 * m, x0=l['x0'], x1=l['x1'], texto=l['text'],
                                       celda=c['bbox'], primera=(m == 0)))
    ev.sort(key=lambda e: (e['pag'], round(e['top'], 3), e['x0']))
    i0 = next((i for i, e in enumerate(ev) if re.match(r'^\s*4\s?\.?\s*Sab', e['texto'])), None)
    if i0 is None:
        return []
    i1 = next((i for i in range(i0 + 1, len(ev)) if re.match(r'^\s*[56]\s?\.?\s*(?:Situaci|Criteri)', ev[i]['texto'])), len(ev))
    return ev[i0 + 1:i1]


REF_CE = re.compile(r'\s*[\(\[]?\s*(?:\bCE\s?\d+(?:\s*(?:,|y|i|e|-|–)\s*(?:CE\s?)?\d+)*)\s*[\)\]]?\s*\.?\s*$')
TRANSVERSAL = re.compile(r'[.:]?\s*[Tt]ransversal a (?:todas las|totes les) (?:CE|competencias|competències)\.?$')


def limpiar_titulo(t: str) -> str:
    """Los títulos van sin las competencias a las que sirven («(CE 1, CE 2)»)
    ni punto final, como en Primaria."""
    t = re.sub(r'\s+', ' ', t).strip()
    t = TRANSVERSAL.sub('', t)
    t = REF_CE.sub('', t).strip(' .:-–')
    if t and t == t.upper() and re.search(r'[A-ZÁÉÍÓÚÀÈÒÇ]{3}', t):
        t = t[0] + t[1:].lower()       # «EL PROYECTO EMPRENDEDOR» → «El proyecto emprendedor»
    return t


def saberes(mat: dict, idioma: str) -> list[dict]:
    """Los saberes básicos por bloques. Cada bloque empieza con su título
    («Bloque 2: …»); dentro, los epígrafes («Sub-bloque 2.1 …», «Grupo de
    saberes 1.1 …» o un título centrado) con sus saberes: viñetas, o celdas
    de una tabla cuya otra columna marca con una X el curso (orientativo: no
    se recoge). Una línea sangrada o en minúscula sigue al saber anterior."""
    fuente = mat['fuente']
    ev = eventos_saberes(mat, idioma)
    libres = [e for e in ev if e['tipo'] == 'linea']
    margen = min((e['x0'] for e in libres), default=0)
    ancho = max((e['x1'] for e in libres), default=600)
    bloques, bloque, epigrafe, item = [], None, None, None
    sangria_item = None          # x del texto del saber abierto (tras su viñeta)
    titulo_abierto = False       # la línea anterior era un título de epígrafe
    guiones = [e['x0'] for e in libres if re.match(r'^\s*[-–]\s+', e['texto'])]
    guion_x = min(guiones) if guiones else 0

    def nuevo_epigrafe(titulo):
        nonlocal epigrafe, item, titulo_abierto
        epigrafe = dict(titulo=titulo or None, items=[])
        bloque['epigrafes'].append(epigrafe)
        item, titulo_abierto = None, True

    def nuevo_item(texto, x):
        nonlocal item, sangria_item, titulo_abierto
        if epigrafe is None:
            nuevo_epigrafe(None)
        item, sangria_item, titulo_abierto = [texto], x, False
        epigrafe['items'].append(item)

    for e in ev:
        t = e['texto'].strip()
        if not t:
            continue
        mb = BLOQUE.match(t)
        if mb:
            # la introducción nombra los bloques antes de que empiecen: el que
            # se repite sustituye al que aún no tenía nada
            bloques[:] = [b for b in bloques if b['bloque'] != mb.group(1) or b['epigrafes']]
            bloque = dict(bloque=mb.group(1), titulo=[mb.group(2)], epigrafes=[])
            bloques.append(bloque)
            epigrafe, item, titulo_abierto = None, None, False
            continue
        if bloque is None:
            continue
        ms = SUBBLOQUE.match(t)
        if ms:
            num = re.match(r'(\d+)\s?\.', ms.group(1))
            if num and num.group(1) != bloque['bloque'] and not any(b['bloque'] == num.group(1) for b in bloques):
                # el grupo «2.1» es del bloque 2 aunque falte su título (Economía, en valenciano)
                bloque = dict(bloque=num.group(1), titulo=[], epigrafes=[])
                bloques.append(bloque)
            nuevo_epigrafe(ms.group(2))
            continue
        if CABECERA_SABERES.match(t) and len(t) < 60:
            continue
        caja = e['celda'] or (margen, 0, ancho, 0)
        izq, der = caja[0], caja[2]
        centrada = e['x0'] > izq + 25 and abs((e['x0'] + e['x1']) / 2 - (izq + der) / 2) < 25
        if mat.get('saberes') == 'guion' and e['tipo'] == 'linea':
            if re.match(r'^\s*[-–]\s+', t):
                nuevo_epigrafe(re.sub(r'^\s*[-–]\s+', '', t))
            elif epigrafe is not None and (e['x0'] > guion_x + 8 or len(t) < 90):
                # sangrados; alguno sale sin sangría (Valores, «Los servicios públicos»)
                if item is not None and re.match(r'^[a-zà-ú(]', t):
                    item.append(t)
                else:
                    nuevo_item(t, e['x0'])
            continue
        vineta = VINETA.match(t)
        if vineta:
            for trozo in re.split(r'(?<=\S)\s+(?=[•●⚫□]\s)', t):
                nuevo_item(VINETA.sub('', trozo, count=1), e['x0'] + 8)
            continue
        if centrada and len(t) < 110 and not re.match(r'^[a-zà-ú]', t):
            if titulo_abierto and epigrafe is not None and not epigrafe['items']:
                epigrafe['titulo'] = f"{epigrafe['titulo'] or ''} {t}".strip()
            else:
                nuevo_epigrafe(t)
            continue
        sigue = item is not None and (re.match(r'^[a-zà-ú(),;]', t) or (sangria_item is not None and e['x0'] >= sangria_item - 2
                                                                      and not e.get('primera', False)))
        if e['tipo'] == 'celda':
            if e['primera'] and not sigue:
                nuevo_item(t, e['x0'])
            elif item is not None:
                item.append(t)
            else:
                nuevo_item(t, e['x0'])
            continue
        # línea fuera de tablas
        if sigue or (item is not None and e['x0'] > margen + 12):
            item.append(t)
        else:
            item = None          # un párrafo de explicación: no es un saber
    salida = []
    for b in bloques:
        if not any(ep['items'] for ep in b['epigrafes']):
            continue
        titulo = limpiar_titulo(unir(b['titulo'], fuente, idioma))
        epigrafes = [dict(n=None, titulo=limpiar_titulo(ep['titulo']) if ep['titulo'] else None,
                          items=[unir(it, fuente, idioma) for it in ep['items']])
                     for ep in b['epigrafes'] if ep['items']]
        salida.append(dict(bloque=b['bloque'], tituloBloque=titulo, epigrafes=epigrafes))
    return salida


if __name__ == '__main__' and '--saberes' in sys.argv:
    for mat in MATERIAS:
        if SOLO and mat['id'] not in SOLO:
            continue
        for idioma in IDIOMAS:
            bs = saberes(mat, idioma)
            print(f"== {mat['id']} ({idioma}) " + ' '.join(f"B{b['bloque']}:{[len(e['items']) for e in b['epigrafes']]}" for b in bs))
            if '-v' in sys.argv:
                for b in bs:
                    print(f"  B{b['bloque']} {b['tituloBloque']}")
                    for ep in b['epigrafes']:
                        print(f"     [{ep['titulo']}]")
                        for it in ep['items']:
                            print(f"         - {it[:110]}")
