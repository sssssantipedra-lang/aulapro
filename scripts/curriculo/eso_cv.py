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
              dict(crit='lista', inicio='vineta', curso=4, es=(242, 245), va=(51, 53))],   # adenda de 4º
      saberes_4=dict(es=(240, 242), va=(49, 51), bloques='letra')),     # la adenda trae los suyos: «A. Proyecto científico»
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
              dict(crit='lista', inicio='vineta', curso=4, es=(834, 837), va=(247, 251))],   # adenda de 4º
      saberes_4=dict(es=(828, 834), va=(243, 247))),
    m('formacion-y-orientacion', 'Formación y Orientación Personal y Profesional', 'Formació i Orientació Personal i Professional', '107', (838, 852), (252, 266), 'lista', inicio='codigo', curso=4),
    m('geografia-e-historia', 'Geografía e Historia', 'Geografia i Història', '107', (853, 882), (267, 294), 'tabla', por_ciclo=True),
    m('latin', 'Latín', 'Llatí', '107', (883, 894), (295, 305), 'lista', inicio='vineta', curso=4),
    m('matematicas', 'Matemáticas', 'Matemàtiques', '66', (247, 286), (55, 90), 'tabla',
      grupos={2: CICLO[2], 3: CURSO[3], 4: CURSO[4]}),
    # Sin 4º: el 66/2024 sustituye la materia entera y su texto no lo trae
    m('musica', 'Música', 'Música', '66', (288, 313), (92, 116), 'tabla', grupos={12: CICLO[2], 3: CURSO[3]}),
    m('lengua-extranjera', 'Lengua Extranjera', 'Llengua Estrangera', '107', (953, 972), (363, 382), 'tabla', por_ciclo=True),
    m('tecnologia', 'Tecnología', 'Tecnologia', '107', (973, 991), (383, 401), 'tabla', curso=4),
    m('tecnologia-y-digitalizacion', 'Tecnología y Digitalización', 'Tecnologia i Digitalització', '107', (992, 1021), (402, 430), 'tabla',
      bloques='apartado', saberes='plano'),   # «4.3. Digitalización…», sin «Bloque»; cada celda, un saber
    m('lenguas', None, None, '107', (1022, 1055), (431, 462), 'tabla', por_ciclo=True),
    m('artes-escenicas', 'Artes Escénicas', 'Arts Escèniques', '107', (1056, 1072), (464, 479), 'lista', inicio='codigo', curso=4),
    m('creatividad-musical', 'Creatividad Musical', 'Creativitat Musical', '107', (1073, 1085), (480, 493), 'lista', inicio='codigo', curso=3,
      saberes='parrafos',
      titulo_ce={'va': r'^\s*6\.(\d{1,2})\.\s+(?!\d)'}),    # en valenciano, «6.1. Identificar…» y «6.1.1.»
    m('cultura-clasica', 'Cultura Clásica', 'Cultura Clàssica', '107', (1086, 1099), (494, 508), 'lista', inicio='vineta', curso=3),
    m('emprendimiento-social-y-sostenible', 'Emprendimiento Social y Sostenible', 'Emprenedoria Social i Sostenible', '107', (1100, 1111), (509, 520), 'tabla', curso=2),
    m('filosofia', 'Filosofía', 'Filosofia', '107', (1112, 1124), (521, 532), 'tabla', curso=4, saberes='parrafos'),
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


# Las páginas de cada lengua en los anexos de cada decreto
PAGINAS_IDIOMA = {('107', 'va'): (42, 620), ('107', 'es'): (621, 1298), ('66', 'va'): (16, 192), ('66', 'es'): (193, 392)}


@lru_cache(maxsize=4)
def vocabulario(fuente: str, idioma: str) -> Counter:
    """Las palabras de los anexos del decreto en una lengua, tal y como están
    en el PDF, sin las partidas por un guion al final de la línea. Sale de
    `pdftotext -layout`, que deja ese guion donde está (sin `-layout` lo
    quita y junta las dos partes)."""
    a, b = PAGINAS_IDIOMA[(fuente, idioma)]
    texto = subprocess.run(['pdftotext', '-layout', '-f', str(a), '-l', str(b), str(PDF[fuente]), '-'],
                           check=True, capture_output=True, text=True).stdout
    vocab: Counter = Counter()
    partida = False
    for linea in texto.splitlines():
        palabras = linea.split()
        if partida and palabras:
            palabras = palabras[1:]          # el final de una palabra partida («mientos»)
        partida = bool(palabras) and palabras[-1].endswith('-')
        if partida:
            palabras = palabras[:-1]
        for w in palabras:
            for t in re.findall(r"[\w·-]+", w):
                vocab[t.lower().strip('-')] += 1
    return vocab


@lru_cache(maxsize=4)
def palabras_enteras(fuente: str, idioma: str) -> Counter:
    """Las palabras de los anexos en una lengua según `pdftotext` sin
    opciones, que junta las partidas por un guion: así no cuentan como
    palabra los trozos («miento» de «procedi-miento»)."""
    a, b = PAGINAS_IDIOMA[(fuente, idioma)]
    texto = subprocess.run(['pdftotext', '-f', str(a), '-l', str(b), str(PDF[fuente]), '-'],
                           check=True, capture_output=True, text=True).stdout
    return Counter(w.lower() for w in re.findall(r'[\w·]+', texto))


COMPUESTAS = {'ácido-base'}     # sale una sola vez en el decreto, partida al final de la línea


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
        elif (len(na) >= 4 and len(nb) >= 4 and min(palabras_enteras(fuente, idioma)[na], palabras_enteras(fuente, idioma)[nb]) >= 2) \
                or f'{na}-{nb}' in COMPUESTAS:
            r, por = con, 'dos palabras del decreto'      # «temperatura-escales», «ácido-base»
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
    'vineta': re.compile(r'^\s*(?:[•●▪-]\s*)+'),     # a veces, dos superpuestas («• •»)
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

# ── Lo que se lee una vez de cada página ─────────────────────────────────────
#
# Leer con pdfplumber las 1.100 páginas de las materias tarda: lo leído se
# guarda en `CACHE` (fuera del repositorio) y las siguientes ejecuciones lo
# reutilizan. Si cambia la lectura, se borra la carpeta.

CACHE = Path(__file__).parent / '.cache-eso-cv'


def _pagina(args):
    """Una página: sus líneas fuera de las tablas (con la negrita) y sus
    tablas, fila a fila y, en cada celda, sus líneas con su posición."""
    ruta, n = args
    with pdfplumber.open(ruta) as pdf:
        p = pdf.pages[n - 1]
        ts = [t for t in p.find_tables() if not es_marco(t.bbox, p)]
        cajas = [t.bbox for t in ts]
        def dentro(o):
            cx, cy = (o['x0'] + o['x1']) / 2, (o['top'] + o['bottom']) / 2
            return any(b[0] - 1 <= cx <= b[2] + 1 and b[1] - 1 <= cy <= b[3] + 1 for b in cajas)
        fuera = p.filter(lambda o: o.get('object_type') != 'char' or not dentro(o))
        lineas_ = []
        for l in fuera.extract_text_lines(keep_blank_chars=False):
            chars = [c for c in l['chars'] if c['text'].strip()]
            negrita = sum('Bold' in c['fontname'] for c in chars) > len(chars) / 2 if chars else False
            lineas_.append({'top': round(l['top'], 1), 'x0': round(l['x0'], 1), 'x1': round(l['x1'], 1), 'text': l['text'], 'bold': negrita})
        tablas_ = [{'bbox': [round(x, 1) for x in t.bbox], 'rows': t.extract()} for t in ts]
        celdas_ = []
        for t in ts:
            filas = []
            for fila in t.rows:
                cs = []
                for c in fila.cells:
                    if not c:
                        continue
                    x0, top, x1, bottom = c
                    sub = p.filter(lambda o: o.get('object_type') != 'char'
                                   or (x0 <= (o['x0'] + o['x1']) / 2 <= x1 and top <= (o['top'] + o['bottom']) / 2 <= bottom))
                    ls = [dict(x0=round(l['x0'], 1), x1=round(l['x1'], 1), top=round(l['top'], 1), text=l['text'])
                          for l in sub.extract_text_lines() if x0 - 1 <= l['x0'] <= x1 + 1 and top - 1 <= l['top'] <= bottom + 1]
                    cs.append(dict(bbox=[round(v, 1) for v in c], lineas=ls))
                filas.append(cs)
            celdas_.append(dict(bbox=[round(v, 1) for v in t.bbox], filas=filas))
        return n, {'lineas': lineas_, 'tablas': tablas_, 'w': p.width}, celdas_


@lru_cache(maxsize=8)
def paginas_leidas(fuente: str, idioma: str) -> tuple[dict, dict]:
    """Lo leído de todas las páginas de las materias de un decreto en una lengua."""
    lin, cel = CACHE / f'{fuente}{idioma}.json', CACHE / f'sab_{fuente}{idioma}.json'
    if not (lin.exists() and cel.exists()):
        from concurrent.futures import ProcessPoolExecutor
        paginas = sorted({n for m in MATERIAS if m['fuente'] == fuente
                          for n in range(m['paginas'][idioma][0], m['paginas'][idioma][1] + 1)})
        print(f'Leyendo {len(paginas)} páginas del {fuente} ({idioma}); tarda unos minutos la primera vez…', file=sys.stderr)
        res_l, res_c = {}, {}
        with ProcessPoolExecutor(4) as ex:
            for n, d, c in ex.map(_pagina, [(str(PDF[fuente]), n) for n in paginas], chunksize=8):
                res_l[n], res_c[n] = d, c
        CACHE.mkdir(exist_ok=True)
        lin.write_text(json.dumps(res_l, ensure_ascii=False))
        cel.write_text(json.dumps(res_c, ensure_ascii=False))
    return ({int(k): v for k, v in json.loads(lin.read_text()).items()},
            {int(k): v for k, v in json.loads(cel.read_text()).items()})


@lru_cache(maxsize=8)
def lineas_cache(fuente: str, idioma: str) -> dict:
    """Las líneas fuera de tablas de cada página."""
    return {n: v['lineas'] for n, v in paginas_leidas(fuente, idioma)[0].items()}


# ── Competencias específicas ─────────────────────────────────────────────────


TITULO_CE = re.compile(
    r'^\s*(?:2\s?\.\s?(\d{1,2})\s?\.?\s*)?(?:Compet[eè]ncia(?: espec[ií]fica)?|CE)\s*0?(\d{1,2})\b\s*[.:]?\s*(.*)$', re.I)
FIN_ENUNCIADO = re.compile(r'^\s*(?:2\s?\.\s?\d{1,2}\s?\.\s?\d|Descripci[óo]|\d\.\s+(?:Conexi|Connexi))', re.I)


def competencias(mat: dict, idioma: str) -> list[dict]:
    """Los enunciados de las competencias específicas, del apartado 2: tras
    «2.N. Competencia específica N» (con un título detrás en las lenguas y
    en Lengua Extranjera), la frase del enunciado, hasta su punto. Unas
    materias lo escriben en la misma línea del título, otras debajo, otras
    en un recuadro (Latín, en castellano) y alguna tras «Descripción de la
    competencia» (Plástica, en valenciano)."""
    ini, fin = mat['paginas'][idioma]
    lin, tab = lineas_cache(mat['fuente'], idioma), tablas_cache(mat['fuente'], idioma)
    ls = []
    for n in range(ini, fin + 1):
        ls += [dict(l, pag=n, caja=None) for l in lin.get(n, []) if l['top'] > CABECERA_PAGINA]
        ls += [dict(top=t['bbox'][1], x0=t['bbox'][0], x1=t['bbox'][2], text='', pag=n, caja=t['bbox'])
               for t in tab.get(n, []) if any(c for fila in t['rows'] for c in fila)]
    ls.sort(key=lambda l: (l['pag'], l['top']))
    i0 = next(i for i, l in enumerate(ls) if re.match(r'^\s*2\s?\.?\s*Compet', l['text']))
    i1 = next((i for i in range(i0 + 1, len(ls)) if re.match(r'^\s*3\s?\.?\s*(?:Conexi|Connexi)', ls[i]['text'])), len(ls))
    sec = ls[i0 + 1:i1]
    for l in sec:
        if l['caja']:
            # el texto del recuadro, leído del PDF: la tabla guardada pierde alguna palabra
            l['caja'] = [x for x in texto_celda(mat['fuente'], l['pag'], l['caja']).split('\n') if x.strip()]
            l['text'] = ' '.join(l['caja'])
        l['text'] = re.sub(r'\s*\(llevem negreta?\)', '', l['text'])     # nota de edición en el DOGV, no es del currículo
    derecha = max(l['x1'] for l in sec)
    salida, i = [], 0
    while i < len(sec):
        mm = TITULO_CE.match(sec[i]['text']) if sec[i]['caja'] is None else None
        if not mm or FIN_ENUNCIADO.match(sec[i]['text']):
            i += 1
            continue
        n, resto = int(mm.group(2)), mm.group(3).strip()
        j = i + 1
        partes = [resto] if resto and not (len(resto) < 70 and not resto.endswith('.') and sec[i]['x1'] < derecha - 40) else []
        while j < len(sec) and not partes:
            l = sec[j]
            if TITULO_CE.match(l['text']) and l['caja'] is None and int(TITULO_CE.match(l['text']).group(2)) != n:
                break
            if l['caja']:
                partes = list(l['caja'])            # el enunciado, en un recuadro
            elif TITULO_CE.match(l['text']) and TITULO_CE.match(l['text']).group(3).strip() and not FIN_ENUNCIADO.match(l['text']):
                partes = [TITULO_CE.match(l['text']).group(3).strip()]     # «CE1. Representar…», debajo del título
            elif FIN_ENUNCIADO.match(l['text']) or TITULO_CE.match(l['text']):
                pass                                 # «2.2.1. Descripción…» antes del enunciado
            elif len(l['text'].strip()) < 70 and not l['text'].rstrip().endswith('.') and l['x1'] < derecha - 40 \
                    and j + 1 < len(sec) and re.match(r'^\s*[A-ZÁÉÍÓÚÀÈÒ¿]', sec[j + 1]['text']):
                pass                                 # el título de la competencia («Comprensión oral»)
            else:
                partes = [l['text']]
            j += 1
        # hasta el punto final del enunciado
        while partes and not ' '.join(partes).rstrip().endswith('.') and j < len(sec) and sec[j]['caja'] is None \
                and not FIN_ENUNCIADO.match(sec[j]['text']) and not TITULO_CE.match(sec[j]['text']):
            partes.append(sec[j]['text'])
            j += 1
        texto = re.sub(r'^[-–•]\s*', '', unir(partes, mat['fuente'], idioma))     # «- Explicar…» (Geografía e Historia)
        salida.append(dict(n=n, texto=texto))
        i = j
    return salida


# ── Saberes básicos ──────────────────────────────────────────────────────────

@lru_cache(maxsize=8)
def tablas_cache(fuente: str, idioma: str) -> dict:
    """Las tablas de cada página, fila a fila."""
    return {n: v['tablas'] for n, v in paginas_leidas(fuente, idioma)[0].items()}


BLOQUE = re.compile(r'^\s*(?:\d(?:\s?\.\s?\d{1,2}){0,2}\s?\.?\s*)?(?:Bloque|Bloc|BLOQUE|BLOC)\s*(\d{1,2})\s*[:.\-–]?\s*(.*)$')
SUBBLOQUE_SIN_NUMERO = re.compile(r'(?i)^\s*(Sub-?\s?blo(?:que|c)\s+(?:de|del|d’|d\'|dels)\b.*?)(?:\s+cursos?(?:\s+cursos?)*)?\s*$')
APARTADO = re.compile(r'^\s*4\s?\.\s?(\d{1,2})\s?\.?\s+(?!Introducci)(\S.*)$')
SUBBLOQUE = re.compile(r'^\s*(?:\d(?:\.\d{1,2}){1,3}\.?\s*)?(?:Sub-?\s?blo(?:que|c)|Sibbloc|Grupo|Grup(?=\s\d)|SUB-?\s?BLO(?:QUE|C)|SB|GRUPO DE SABERES|GRUP DE SABERS|Grupo de saberes|Grup de sabers|G(?=\s?\d)|B(?=\.?\d\.\d))'
                       r'\.?\s*(\d{1,2}(?:\s?\.\s?\d{1,2})?)\s*[:.\-–]?\s*(.*)$')
VINETA = re.compile(r'^\s*(?:(?:[•●▪◦⚫□−\-–]|\(cid:486\))\s*)+')      # a veces, dos superpuestas («••»)
CABECERA_SABERES = re.compile(r'^(?:Saberes b[áa]sicos|Sabers b[àa]sics|CURSO|CURS|CICLO|CICLE|Curso|Curs|Ciclo|Cicle|CONTENIDOS|CONTINGUTS|Contenidos|Continguts)\b\s*$|^(?:Saberes b[áa]sicos|Sabers b[àa]sics)\b', re.I)
MARCA = re.compile(r'^(?:[xX✓✔]|\d\s?\.?\s?[ºª]|\d(?:er|r|n|t|º|o)?|1\.?er|(?:\(?Cursos?.*\)?))$')


def es_marca(t: str) -> bool:
    """Las celdas de curso: «x», «1º», «2º curso», «(Cursos 1º y 2º)»…"""
    t = t.strip()
    if re.match(r'(?i)^(?:perfil\s*[12]\s*)+$', t) or re.match(
            r'(?i)^(?:(?:primer[oa]?|segundo|segon|tercer[oa]?|cuarto|quart|cursos?|curs|eso|[ab])\b\s*)+$', t):
        return True
    return (not t or bool(MARCA.match(t)) or len(t) <= 3 or bool(re.match(r'^[xX\s]+$', t))
            or bool(re.match(r'(?i)^(?:\(?\s*(?:cursos?|curs)?\s*\d\s*\.?\s*(?:º|ª|er|r|n|t|o)?\s*(?:y|i)?\s*'
                             r'(?:curso|curs|eso|ciclo|cicle)?\s*\)?\s*)+$', t)))


def celdas_cache(fuente: str, idioma: str) -> dict:
    """Las tablas de cada página con cada celda y sus líneas con su
    posición: hace falta para distinguir un título centrado de una línea que
    sigue a la anterior."""
    return paginas_leidas(fuente, idioma)[1]


# Dónde empiezan y acaban los saberes: el apartado 4 del currículo de cada
# materia, o el 1 de la adenda de cuarto (Física y Química; Biología, sin número)
SECCION_SABERES = (r'^\s*4\s?\.?\s*Sab', r'^\s*[56]\s?\.?\s*[-–]?\s*(?:Situaci|Criteri)')
SECCION_ADENDA = (r'(?i)^\s*(?:1\s?\.\s*)?(?:Saberes b[áa]sicos|Sabers b[àa]sics)', r'(?i)^\s*(?:2\s?\.\s*)?Criteri(?:os de evaluaci|s d.avaluaci)')


def eventos_saberes(mat: dict, idioma: str, parte: dict | None = None):
    """Las líneas del apartado de saberes, fuera y dentro de las tablas, en
    orden de lectura. Cada línea de una celda lleva la caja de su celda."""
    ini, fin = (parte or mat['paginas'])[idioma]
    inicio, final = SECCION_ADENDA if parte else SECCION_SABERES
    lin = lineas_cache(mat['fuente'], idioma)
    tab = celdas_cache(mat['fuente'], idioma)
    ev = []
    for n in range(ini, fin + 1):
        for l in lin.get(n, []):
            if l['top'] > CABECERA_PAGINA:
                ev.append(dict(tipo='linea', pag=n, top=l['top'], x0=l['x0'], x1=l['x1'], texto=l['text'], celda=None))
        tablas_pag = tab.get(n, [])
        con_texto = [(i, tuple(c['bbox'])) for i, t in enumerate(tablas_pag) for fila in t['filas'] for c in fila if c['lineas']]
        repetidas = {(i, b) for i, b in con_texto if any(o != b and contenida(b, o) for _, o in con_texto)}
        for i_t, t in enumerate(tablas_pag):
            # una tabla «de viñetas» si al menos un tercio de sus celdas con texto empiezan por una
            llenas_t = [c for fila in t['filas'] for c in fila if c['lineas'] and not es_marca(' '.join(l['text'] for l in c['lineas']))]
            vinetas = bool(llenas_t) and sum(1 for c in llenas_t if VINETA.match(c['lineas'][0]['text'])) >= len(llenas_t) / 3
            # Física y Química marca con la X el curso de cada título, no el de sus saberes
            def con_x(fila):
                return any(c['lineas'] and re.match(r'^[xX✓✔](?:\s+[xX✓✔])*$', ' '.join(l['text'] for l in c['lineas']).strip()) for c in fila)
            def con_vin(fila):
                return any(VINETA.match(l['text']) for c in fila for l in c['lineas'])
            x_en_titulos = (any(con_vin(f) for f in t['filas']) and any(con_x(f) for f in t['filas'])
                            and not any(con_vin(f) and con_x(f) for f in t['filas']))
            for k, fila in enumerate(t['filas']):
                for c in fila:
                    textos = ' '.join(l['text'] for l in c['lineas'])
                    if es_marca(textos) or (i_t, tuple(c['bbox'])) in repetidas:
                        continue
                    con_vineta = any(VINETA.match(l['text']) for l in c['lineas'])
                    for m, l in enumerate(c['lineas']):
                        ev.append(dict(tipo='celda', pag=n, top=l['top'] + 0.001 * m, x0=l['x0'], x1=l['x1'], texto=l['text'],
                                       celda=c['bbox'], primera=(m == 0), lineas_celda=len(c['lineas']),
                                       celda_con_vineta=con_vineta, tabla_con_vinetas=vinetas,
                                       titulo_con_x=x_en_titulos and con_x(fila) and not con_vineta))
    ev.sort(key=lambda e: (e['pag'], round(e['top'], 3), e['x0']))
    i0 = next((i for i, e in enumerate(ev) if re.match(inicio, e['texto'])), None)
    if i0 is None:
        return []
    i1 = next((i for i in range(i0 + 1, len(ev)) if re.match(final, ev[i]['texto'])), len(ev))
    return ev[i0 + 1:i1]


MAYUSCULAS = re.compile(r'^[A-ZÁÉÍÓÚÀÈÒÇÏÜ]{3,}\b')    # «CIÈNCIA. CE 3…»: un título
REF_CE = re.compile(r'\s*[\(\[]?\s*(?:\bCE?\s?\d+(?:\s*(?:,|y|i|e|Y|I|-|–|\+)\s*(?:CE?\s?)?\d+)*)(?:\s*(?:,|y|i|e|Y|I))?\s*[\)\]]?\s*\.?\s*$')
TRANSVERSAL = re.compile(r'[.:]?\s*[Tt]\s?ransversal a (?:todas las|totes les) (?:CE|competencias|competències)\.?$')


@lru_cache(maxsize=2)
def mayusculas(fuente: str) -> Counter:
    """Las palabras del decreto tal y como se escriben, con sus mayúsculas."""
    return Counter(re.findall(r'[\w·’\']+', '\n'.join(paginas_texto(fuente))))


def a_frase(t: str, fuente: str) -> str:
    """«EL PROYECTO EMPRENDEDOR» → «El proyecto emprendedor». Los nombres
    propios («Grecia», «Roma») siguen en mayúscula: el decreto nunca los
    escribe en minúscula."""
    vocab = mayusculas(fuente)
    def palabra(mm):
        w = mm.group(0).lower()
        cap = w[:1].upper() + w[1:]
        return cap if vocab[cap] and not vocab[w] else w
    t = re.sub(r'[\w·]+', palabra, t)
    t = re.sub(r'([.?!]\s+)(\w)', lambda mm: mm.group(1) + mm.group(2).upper(), t)
    i = next((k for k, c in enumerate(t) if c.isalpha()), None)
    return t if i is None else t[:i] + t[i].upper() + t[i + 1:]


def limpiar_titulo(t: str, fuente: str = '107', idioma: str = 'es') -> str:
    """Los títulos van sin las competencias a las que sirven («(CE 1, CE 2)»)
    ni punto final, como en Primaria."""
    t = re.sub(r'\s+', ' ', t).strip()
    t = unir(re.split(r'(?<=\w-) (?=\w)', t), fuente, idioma)     # «CONSU- MIDORAS», de dos líneas
    t = TRANSVERSAL.sub('', t)
    t = re.sub(r'\s*\((?:CE|C\.E\.)[^)]*$', '', t)      # «(CE 5 y» con el resto en otra línea
    t = REF_CE.sub('', t).strip(' .:-–')
    if t and t == t.upper() and re.search(r'[A-ZÁÉÍÓÚÀÈÒÇ]{3}', t):
        t = a_frase(t, fuente)
    return t


def saberes(mat: dict, idioma: str, parte: dict | None = None) -> list[dict]:
    """Los saberes básicos por bloques. Cada bloque empieza con su título
    («Bloque 2: …»); dentro, los epígrafes («Sub-bloque 2.1 …», «Grupo de
    saberes 1.1 …» o un título centrado) con sus saberes: viñetas, o celdas
    de una tabla cuya otra columna marca con una X el curso (orientativo: no
    se recoge). Una línea sangrada o en minúscula sigue al saber anterior."""
    fuente = mat['fuente']
    ev = eventos_saberes(mat, idioma, parte)
    if parte:
        mat = {**mat, **{k: v for k, v in parte.items() if k not in IDIOMAS}}
    libres = [e for e in ev if e['tipo'] == 'linea']
    margen = min((e['x0'] for e in libres), default=0)
    ancho = max((e['x1'] for e in libres), default=600)
    bloques, bloque, epigrafe, item = [], None, None, None
    sangria_item = None          # x del texto del saber abierto (tras su viñeta)
    item_vineta = False          # el saber abierto empezó con una viñeta
    x_texto_item = None          # x de la segunda línea del saber abierto
    vineta_pendiente = False     # Física y Química: un guion que el PDF saca fuera de su línea
    tras_cabecera = False        # la celda anterior era «Saberes básicos»
    ultima = actual = None       # la última línea de un saber y la que se lee
    celda_saltada = None
    titulo_e = None              # la línea del último título
    titulo_abierto = False       # la línea anterior era un título de epígrafe
    titulo_celda_de = {'caja': None}
    ultimo_bloque = {'x': None, 'justo': False}
    guiones = [e['x0'] for e in libres if re.match(r'^\s*[-–]\s+', e['texto'])]
    guion_x = min(guiones) if guiones else 0

    def nuevo_epigrafe(titulo):
        nonlocal epigrafe, item, titulo_abierto, titulo_e
        titulo_e = actual
        if epigrafe is not None and titulo and epigrafe['titulo'] and sin_tildes(epigrafe['titulo']) == sin_tildes(titulo):
            item, titulo_abierto = None, False      # la cabecera de la tabla, repetida en la página siguiente
            return
        epigrafe = dict(titulo=titulo or None, items=[])
        bloque['epigrafes'].append(epigrafe)
        item, titulo_abierto = None, True

    def nuevo_item(texto, x, vineta=False):
        nonlocal item, sangria_item, titulo_abierto, item_vineta, x_texto_item, vineta_pendiente, ultima
        ultima = actual
        if epigrafe is None:
            nuevo_epigrafe(None)
        item, sangria_item, titulo_abierto, item_vineta = [texto], x, False, vineta
        x_texto_item, vineta_pendiente = None, False
        epigrafe['items'].append(item)

    def seguir(texto, x):
        nonlocal x_texto_item, ultima
        ultima = actual
        if x_texto_item is None and len(item) == 1:
            x_texto_item = x
        item.append(texto)

    def sigue_con_vineta(i):
        """Si lo siguiente con texto (no una marca de curso) es una viñeta."""
        for o in ev[i + 1:]:
            u = o['texto'].strip()
            if u and not es_marca(u):
                mv = VINETA.match(u)
                return bool(mv) and not re.match(r'^[a-zà-ú]', u[mv.end():])
        return False

    for i_ev, e in enumerate(ev):
        t = e['texto'].strip()
        if not t:
            continue
        actual = e
        if e['celda'] is not None and e['celda'] == celda_saltada:
            continue             # el resto de la cabecera repetida («L’ART», «CE1, CE2…»)
        if re.search(r'\S\s*\(cid:486\)', t):
            # el guion de un saber de debajo, metido en medio de otra línea («Uso ra(cid:486)cional»)
            t = re.sub(r'(?<=\S)\s*\(cid:486\)\s*', lambda mm: ' ' if mm.group(0)[:1].isspace() or mm.group(0)[-1:].isspace() else '', t).strip()
            pendiente_aqui = True
        else:
            pendiente_aqui = False
        mb = BLOQUE.match(t)
        if not mb and mat.get('bloques') == 'letra':
            mb = re.match(r'^\s*([A-F])\.\s+(\S.*)$', t)       # «A. Proyecto científico»
        if not mb and mat.get('bloques') == 'apartado' and e['tipo'] == 'linea':
            ma = APARTADO.match(t)       # «4.2.» es el bloque 1: el 4.1 es la introducción
            mb = ma and type('M', (), {'group': lambda self, i, ma=ma: str(int(ma.group(1)) - 1) if i == 1 else ma.group(2)})()
        if mb:
            # la introducción nombra los bloques antes de que empiecen: el que
            # se repite sustituye al que aún no tenía nada
            bloques[:] = [b for b in bloques if b['bloque'] != mb.group(1) or b['epigrafes']]
            bloque = dict(bloque=mb.group(1), titulo=[mb.group(2)], epigrafes=[])
            bloques.append(bloque)
            epigrafe, item, titulo_abierto = None, None, False
            ultimo_bloque.update(x=e['x0'], justo=True)
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
            titulo_celda_de['caja'] = e['celda']
            continue
        if (titulo_abierto and epigrafe is not None and epigrafe['titulo'] and not epigrafe['items']
                and titulo_e is not None and titulo_e['x1'] >= (titulo_e['celda'] or (0, 0, ancho))[2] - 40
                and (e['x0'] <= (e['celda'] or (margen,))[0] + 10
                     or re.search(r'\b(?:Y|I|E|O|U|DE|DEL|LA|EL|LOS|LAS|LES|ELS|A|EN|PARA|PER|CON|AMB)$', titulo_e['texto'].strip()))
                and epigrafe['titulo'] == epigrafe['titulo'].upper() and t == t.upper() and re.search(r'[A-ZÀ-Ú]{3}', t)
                and not VINETA.match(t) and not es_marca(t) and not REF_CE.fullmatch(t)):
            epigrafe['titulo'] += ' ' + t        # el título en mayúsculas sigue en la línea de abajo («… EL PROJECTE / EMPRENEDOR»)
            continue
        if re.match(r'^\d{1,2}\.\s+[^a-zà-ú]{6,}$', t) and re.search(r'[A-ZÀ-Ú]{4}', t):
            nuevo_epigrafe(t)            # Matemáticas: «1. NÚMEROS NATURALES, ENTEROS, FRACCIONARIOS Y REALES»
            titulo_celda_de['caja'] = e['celda']
            continue
        msn = SUBBLOQUE_SIN_NUMERO.match(t)
        if msn and bloque is not None:
            titulo_nuevo = msn.group(1)
            vistos, nt = bloque.setdefault('vistos', []), sin_tildes(titulo_nuevo)
            if any(v.startswith(nt) or nt.startswith(v) for v in vistos):
                celda_saltada = e['celda']
                continue         # la cabecera del sub-bloque, repetida arriba de la página siguiente: el saber sigue
            vistos.append(nt)
            if not (epigrafe is not None and epigrafe['titulo'] and sin_tildes(epigrafe['titulo']) == sin_tildes(titulo_nuevo)):
                nuevo_epigrafe(titulo_nuevo)     # la cabecera repetida en otra página sigue el mismo
            titulo_celda_de['caja'] = e['celda']
            continue
        if (CABECERA_SABERES.match(t) and len(t) < 60) or (es_marca(t) and not VINETA.match(t)) or re.match(r'^\(?CE\s?\d+(?:\s*(?:,|y|i|e)\s*CE\s?\d+)*\)?\.?$', t):
            if CABECERA_SABERES.match(t) and e['tipo'] == 'celda':
                tras_cabecera = True
            continue
        if tras_cabecera:
            tras_cabecera = False
            if (mat.get('saberes') != 'plano' and e['tipo'] == 'celda' and e['primera'] and e['lineas_celda'] == 1 and not e['celda_con_vineta'] and len(t) < 70
                    and not t.endswith('.') and re.match(r'^[A-ZÁÉÍÓÚÀÈÒÇ]', t) and sigue_con_vineta(i_ev)):
                nuevo_epigrafe(t)        # el título del grupo, en la primera fila (Física y Química, en valenciano)
                titulo_celda_de['caja'] = e['celda']
                continue
        if (bloque['epigrafes'] == [] and ultimo_bloque.get('justo') and not bloque['titulo'][-1].rstrip().endswith(('.', ':'))
                and (re.match(r'^[a-zà-ú]', t) or (e['tipo'] == 'linea' and e['x0'] > ultimo_bloque['x'] + 5))):
            bloque['titulo'].append(t)           # el título del bloque sigue en la línea siguiente
            continue
        ultimo_bloque['justo'] = False
        if item == [''] and not VINETA.match(t):
            item[0] = t          # el texto de una viñeta que el PDF saca sola en su línea
            continue
        if (item is not None and item_vineta and ultima is not None and ultima['celda'] is not None and e['celda'] is not None
                and ultima['x1'] >= ultima['celda'][2] - 25 and not item[-1].rstrip().endswith(('.', ':', ';'))
                and not VINETA.match(t) and not MAYUSCULAS.match(t) and e['x0'] > sangria_item + 5):
            seguir(t, e['x0'])   # la línea de arriba llega al borde sin acabar la frase: sigue («La “Guerra / Fría”…»)
            continue
        caja = e['celda'] or (margen, 0, ancho, 0)
        izq, der = caja[0], caja[2]
        centrada = (e['x0'] > izq + 25 and abs((e['x0'] + e['x1']) / 2 - (izq + der) / 2) < 25
                    and (e['x1'] - e['x0']) < 0.7 * (der - izq) and e.get('lineas_celda', 1) <= 2)
        if mat.get('bloques') == 'apartado' and e['tipo'] == 'linea' and re.match(r'^\s*4\.\d{1,2}\.\d{1,2}\.?\s+\S', t):
            nuevo_epigrafe(re.sub(r'^\s*4\.\d{1,2}\.\d{1,2}\.?\s+', '', t))     # «4.6.2. Estructuras y esfuerzos mecánicos»
            continue
        if mat.get('saberes') == 'guion' and e['tipo'] == 'linea':
            if re.match(r'^\s*[-–]\s+', t):
                nuevo_epigrafe(re.sub(r'^\s*[-–]\s+', '', t))
            elif epigrafe is not None and (e['x0'] > guion_x + 8 or len(t) < 90):
                # sangrados; alguno sale sin sangría (Valores, «Los servicios públicos»)
                if item is not None and re.match(r'^[a-zà-ú(]', t):
                    seguir(t, e['x0'])
                else:
                    nuevo_item(t, e['x0'])
            continue
        if mat.get('saberes') == 'parrafos' and e['tipo'] == 'linea' and not VINETA.match(t):
            # cada saber empieza con sangría y sigue en el margen
            if e['x0'] > margen + 15:
                nuevo_item(t, e['x0'])
            elif item is not None:
                seguir(t, e['x0'])
            continue
        vineta = VINETA.match(t)
        if vineta and item is not None and re.match(r'^[a-zà-ú]', t[vineta.end():]):
            seguir(t[vineta.end():], e['x0'])     # el guion es del saber de debajo: esta línea sigue el de arriba
            vineta_pendiente = True
            continue
        if vineta:
            for trozo in re.split(r'(?<=\S)\s+(?=(?:[•●⚫□]|\(cid:486\))\s*)', t):
                nuevo_item(VINETA.sub('', trozo, count=1), e['x0'] + 8, vineta=True)
            vineta_pendiente = pendiente_aqui
            continue
        if vineta_pendiente and item is not None and re.match(r'^[A-ZÁÉÍÓÚÀÈÒÇ¿(]', t):
            nuevo_item(t, e['x0'], vineta=True)
            continue
        if (e['tipo'] == 'celda' and not e['primera'] and epigrafe is not None and not epigrafe['items']
                and e['celda'] == titulo_celda_de.get('caja') and titulo_abierto):
            epigrafe['titulo'] = f"{epigrafe['titulo'] or ''} {t}".strip()      # el título sigue en su celda
            continue
        # un título: centrado, o en una tabla de viñetas, una celda corta sin viñeta,
        # o una línea suelta corta, bien sangrada y sin puntuación final
        titulo_celda = ((e['tipo'] == 'celda' and (e['tabla_con_vinetas'] or e['titulo_con_x']) and not e['celda_con_vineta']
                         and e['lineas_celda'] <= 2 and len(t) < 110
                         and not (e['primera'] and item is not None and item_vineta and sangria_item is not None and e['x0'] > sangria_item + 5
                                  and not e['titulo_con_x'] and not centrada and not MAYUSCULAS.match(t)))   # sangrada: sigue el saber de la viñeta
                        or (e['tipo'] == 'linea' and len(t) < 70 and e['x0'] > margen + 40
                            and not re.search(r'[.;,:]$', t) and re.match(r'^[A-ZÁÉÍÓÚÀÈÒÇ]', t)))
        # Geografía e Historia: «Grecia», «Roma»… sin viñeta, dentro de un sub-bloque y antes de sus viñetas
        titulo_celda = titulo_celda or (
            e['tipo'] == 'celda' and e['primera'] and e['lineas_celda'] == 1 and not e['celda_con_vineta'] and len(t) < 70
            and not re.search(r'[.;,:]$', t) and '. ' not in t and re.match(r'^[A-ZÁÉÍÓÚÀÈÒÇ]', t) and not MAYUSCULAS.match(t)
            and (item is None or item[-1].rstrip().endswith(('.', ':'))) and sigue_con_vineta(i_ev))
        if re.match(r'^[a-zà-ú]', t) and titulo_abierto and epigrafe is not None and epigrafe['titulo'] and not epigrafe['items']:
            epigrafe['titulo'] = f"{epigrafe['titulo'] or ''} {t}".strip()      # el título sigue, centrado
            continue
        if mat.get('saberes') == 'plano':
            centrada = titulo_celda = False      # sin epígrafes: cada celda es un saber
        if (centrada or titulo_celda) and len(t) < 110 and not re.match(r'^[a-zà-ú]', t):
            if titulo_abierto and epigrafe is not None and not epigrafe['items']:
                if e['celda'] is not None and e['celda'] == titulo_celda_de.get('caja'):
                    epigrafe['titulo'] = f"{epigrafe['titulo'] or ''} {t}".strip()   # el título sigue en otra línea
                else:
                    epigrafe['titulo'] = t      # el de antes era el de la tabla («… CE2»)
            else:
                nuevo_epigrafe(t)
            titulo_celda_de['caja'] = e['celda']
            continue
        corta_final = (item is not None and len(t.split()) <= 2 and ',' not in t and t.endswith('.')
                       and not item[-1].rstrip().endswith(('.', ':', ';'))     # «Valenciana.» partida en otra fila
                       and ultima is not None and ultima['x1'] >= (ultima['celda'] or (0, 0, ancho))[2] - 40)
        sigue = item is not None and (corta_final or re.match(r'^[a-zà-ú(),;]', t)
                                      or (sangria_item is not None and e['x0'] >= sangria_item - 2 and not e.get('primera', False))
                                      # una fila por línea: la que va sangrada sigue el saber de la viñeta
                                      or (e.get('primera') and item_vineta and not e['celda_con_vineta'] and sangria_item is not None
                                          and e['x0'] > sangria_item + 5 and not MAYUSCULAS.match(t)))
        # un saber de segundo nivel cuyo guion no sale: más sangrado que el texto del de arriba
        subitem = item is not None and item_vineta and re.match(r'^[A-ZÁÉÍÓÚÀÈÒÇ]', t) and (
            (e.get('primera') and x_texto_item is not None and e['x0'] > x_texto_item + 10 and item[-1].rstrip().endswith('.'))
            # tras «Importancia de algunas sustancias compuesto:», la lista de debajo
            or (len(item) == 1 and item[-1].rstrip().endswith(':') and e['x0'] > sangria_item + 20))
        if e['tipo'] == 'celda':
            if subitem:
                nuevo_item(t, e['x0'], vineta=True)
            elif not e['primera'] and item is not None:
                seguir(t, e['x0'])               # dentro de la misma celda, sigue el saber
            elif e['primera'] and not sigue:
                nuevo_item(t, e['x0'])
            elif item is not None:
                seguir(t, e['x0'])
            else:
                nuevo_item(t, e['x0'])
            vineta_pendiente = vineta_pendiente or pendiente_aqui
            continue
        # línea fuera de tablas
        if (item is not None and ultima is not None and ultima['celda'] is not None
                and not re.match(r'^[a-zà-ú(),;]', t)):
            item = None          # el párrafo que sigue a la tabla (Biología, «Las herramientas digitales…»)
            continue
        if sigue or (item is not None and e['x0'] > margen + 12):
            seguir(t, e['x0'])
        else:
            item = None          # un párrafo de explicación: no es un saber
    salida = []
    for b in bloques:
        if not any(ep['items'] for ep in b['epigrafes']):
            continue
        titulo = limpiar_titulo(unir(b['titulo'], fuente, idioma), fuente, idioma)
        epigrafes = [dict(n=None, titulo=(limpiar_titulo(ep['titulo'], fuente, idioma) or None) if ep['titulo'] else None,
                          items=[x for x in (unir(it, fuente, idioma) for it in ep['items']) if x])
                     for ep in b['epigrafes'] if ep['items']]
        salida.append(dict(bloque=b['bloque'], tituloBloque=titulo, epigrafes=epigrafes))
    return salida


# ── Lo que lleva la app ──────────────────────────────────────────────────────

# Física y Química: el valenciano no trae los mismos criterios que el
# castellano (uno de más, dos de menos, dos juntos en uno). Para que un código
# sea el mismo criterio en las dos lenguas, cada criterio valenciano lleva el
# número del castellano que le corresponde; el que solo está en valenciano,
# uno nuevo detrás. Ver docs/COMUNIDADES.md.
ALINEAR = {
    ('fisica-y-quimica', '3º ESO', 11): [1, 2, 5, 3, 4],     # «Reconéixer les diferents forces…», solo en valenciano
    ('fisica-y-quimica', '4º ESO', 1): [1, 3, 4, 5, 6, 7, 8],  # sin «Investigar experimentalmente el comportamiento de sustancias orgánicas»
    ('fisica-y-quimica', '4º ESO', 3): [1, 2, 4],              # «Aportar razones…» y «Explicitar los criterios…», en uno
    ('fisica-y-quimica', '4º ESO', 8): [1, 3, 4, 5, 6],        # sin «Identificar la potencia…»
}

# Palabras partidas por un espacio en el PDF
ESPACIOS = {'Metodo logia': 'Metodologia'}

NOMBRE_LENGUAS = {
    'valenciano': {'es': 'Valenciano: Lengua y Literatura', 'va': 'Valencià: Llengua i Literatura'},
    'lengua-castellana': {'es': 'Lengua Castellana y Literatura', 'va': 'Llengua Castellana i Literatura'},
}


def limpiar(t: str) -> str:
    t = unicodedata.normalize('NFC', t)
    for mal, bien in ESPACIOS.items():
        t = t.replace(mal, bien)
    t = re.sub(r'(?<=[a-zà-ú,]) (?:[xX] )+(?=[a-zà-ú])', ' ', t)     # la X de curso metida en la línea (Lengua Extranjera)
    return re.sub(r'\s+', ' ', t).strip()


def codigos(mat: dict, grupo: str, crudos: dict) -> dict:
    """El código de cada criterio en cada lengua, el mismo para el mismo
    criterio. Va el del decreto si lo escribe y es coherente (empieza por el
    número de su competencia y no se repite); si no, el número de orden
    dentro de su competencia, con `codigoLiteral` en falso. Una lengua sin
    códigos toma los de la otra cuando los criterios coinciden uno a uno."""
    def literal(c, lista):
        cod = c['codigo']
        ok = cod and cod.split('.')[0] == str(c['ce']) and sum(
            1 for o in lista if o['codigo'] == cod and cod.split('.')[0] == str(o['ce'])) == 1
        return cod if ok else None
    salida = {}
    for idioma in IDIOMAS:
        lista, cuenta, res = crudos[idioma], Counter(), []
        for c in lista:
            cuenta[c['ce']] += 1
            k = cuenta[c['ce']]
            orden = ALINEAR.get((mat['id'], grupo, c['ce']))
            if idioma == 'va' and orden:
                k = orden[k - 1]
            lit = literal(c, lista)
            res.append((lit, True) if lit else (f"{c['ce']}.{k}", False))
        salida[idioma] = res
    # una lengua sin códigos, la otra con ellos y los mismos criterios: los de la otra
    for a, b in (('es', 'va'), ('va', 'es')):
        if (all(not lit for lit in (x[1] for x in salida[a])) and all(x[1] for x in salida[b])
                and [c['ce'] for c in crudos[a]] == [c['ce'] for c in crudos[b]]):
            salida[a] = [(cod, False) for cod, _ in salida[b]]
    return salida


def entradas(idioma_salida: str | None = None) -> dict:
    """Las materias de las dos lenguas, listas para la app."""
    salida = {i: [] for i in IDIOMAS}
    for mat in MATERIAS:
        if SOLO and mat['id'] not in SOLO:
            continue
        crit = {i: criterios(mat, i) for i in IDIOMAS}
        comp = {i: competencias(mat, i) for i in IDIOMAS}
        sab = {i: saberes(mat, i) for i in IDIOMAS}
        sab4 = {i: saberes(mat, i, mat['saberes_4']) for i in IDIOMAS} if 'saberes_4' in mat else None
        grupos = list(grupos_de(mat).values())
        por_grupo = {}
        for g in grupos:
            if g not in crit['es'] and g not in crit['va']:
                continue
            crudos = {i: crit[i].get(g, []) for i in IDIOMAS}
            cods = codigos(mat, g, crudos)
            por_grupo[g] = {i: [dict(codigo=cod, competencia=c['ce'], texto=limpiar(unir(c['lineas'], mat['fuente'], i)),
                                     codigoLiteral=lit)
                                for c, (cod, lit) in zip(crudos[i], cods[i])] for i in IDIOMAS}
        def bloques(bs):
            return [dict(bloque=b['bloque'], tituloBloque=limpiar(b['tituloBloque']),
                         epigrafes=[dict(n=e['n'], titulo=limpiar(e['titulo']) if e['titulo'] else None,
                                         items=[limpiar(x) for x in e['items']]) for e in b['epigrafes']])
                    for b in bs]
        for i in IDIOMAS:
            entrada = dict(
                competencias=[dict(n=c['n'], texto=limpiar(c['texto'])) for c in comp[i]],
                criterios={g: v[i] for g, v in por_grupo.items()},
                saberes=bloques(sab[i]),
            )
            if sab4:
                entrada['saberesPorGrupo'] = {CURSO[4]: bloques(sab4[i])}     # la adenda de cuarto
            if mat['id'] == 'lenguas':      # un mismo currículo para las dos materias de lengua
                for id_, nombre in NOMBRE_LENGUAS.items():
                    salida[i].append(dict(id=id_, materia=nombre[i], **entrada))
            else:
                salida[i].append(dict(id=mat['id'], materia=mat['nombre'][i], **entrada))
        print(f"{mat['id']:42} " + ' '.join(f"{g}:{len(v['es'])}/{len(v['va'])}" for g, v in por_grupo.items()), file=sys.stderr)
    return salida


def construir() -> None:
    res = entradas()
    SALIDA_APP.mkdir(parents=True, exist_ok=True)
    for idioma in IDIOMAS:
        archivo = SALIDA_APP / f'eso.{CODIGO_APP[idioma]}.json'
        archivo.write_text(json.dumps(res[idioma], ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(f'{archivo.relative_to(RAIZ)}: {len(res[idioma])} materias')
    # los guiones de final de línea, para revisarlos
    decisiones = sorted({(i, partes.replace('|', '-|'), r, por) for i, partes, r, por in DECISIONES if por != 'entera en el decreto'})
    SALIDA_SCRIPTS.mkdir(parents=True, exist_ok=True)
    (SALIDA_SCRIPTS / 'eso-guiones.json').write_text(
        json.dumps([dict(idioma=i, partes=p_, queda=r, por=por) for i, p_, r, por in decisiones], ensure_ascii=False, indent=1) + '\n',
        encoding='utf-8')


def main() -> None:
    if len(sys.argv) == 1:
        construir()
    elif '--criterios' in sys.argv:
        todos_los_criterios(Path(sys.argv[sys.argv.index('--criterios') + 1]))
    elif '--competencias' in sys.argv:
        for mat in MATERIAS:
            if SOLO and mat['id'] not in SOLO:
                continue
            for idioma in IDIOMAS:
                cs = competencias(mat, idioma)
                print(f"{mat['id']} ({idioma}) {[c['n'] for c in cs]}")
                if '-v' in sys.argv:
                    for c in cs:
                        print(f"    {c['n']}: {c['texto']}")
    elif '--saberes' in sys.argv:
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
    elif SOLO:
        for mat in MATERIAS:
            if mat['id'] in SOLO:
                ver_criterios(mat)


if __name__ == '__main__':
    main()
