"""
Lee los anexos II (materias comunes obligatorias y optativas) y III (optativas
propias de la Comunidad Andaluza) de la Orden de 30 de mayo de 2023 (ESO,
Andalucía; BOJA núm. 104, de 2 de junio de 2023, publicada en dos PDF) y
escribe el currículo que lleva la app: `src/lib/curriculum/data/andalucia/eso.es.json`.

Cada materia trae, por este orden:

1. Su título, centrado y en negrita («Biología y Geología»).
2. «Competencias Específicas.»: enunciado en negrita, explicación y la frase de
   los descriptores del Perfil de salida.
3. «Saberes básicos de primer y tercer curso.» (o «Saberes básicos.» si la
   materia es de un solo curso): una columna por curso, con bloques
   («A. Proyecto científico.») y saberes con código («BYG.1.A.1.»).
4. Una tabla con las competencias y, por cada curso, sus criterios de
   evaluación («1.1.») y los saberes de cada fila. Se titula con la materia y
   los cursos («Biología y Geología 1º Biología y Geología 3º») o solo con la
   materia, si es de un curso. Una materia puede tener dos tandas de saberes y
   tablas (Educación Física: primero y segundo, y tercero y cuarto).

En la app cada curso es un grupo («1º ESO»…, como en Madrid) y Matemáticas de
cuarto se separa en «Matemáticas A» y «Matemáticas B», que el anexo trae como
materias aparte con su propia tabla.

El reparto en columnas usa las líneas de las tablas, como en Primaria
(`andalucia_primaria.py`, de donde se toman las piezas comunes). El anexo trae
una sola «Lengua Extranjera», sin distinguir primera y segunda.

Uso:
    python3 scripts/curriculo/andalucia_eso.py
"""
import json
import logging
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import pdfplumber

sys.path.insert(0, str(Path(__file__).parent))
from andalucia_primaria import (  # noqa: E402
    DESCRIPTOR, DESCRIPTORES, cambios, juntar, lineas, negrita, normal, palabras_de, separadores, texto,
)

logging.disable(logging.WARNING)

RAIZ = Path(__file__).resolve().parents[2]
CARPETA = RAIZ / 'docs' / 'Normativa Andalucía'
PDFS = [CARPETA / 'Orden 30-5-2023 currículo ESO, parte 1 (BOJA 104).pdf',
        CARPETA / 'Orden 30-5-2023 currículo ESO, parte 2 (BOJA 104).pdf']
SALIDA_SCRIPTS = Path(__file__).parent / 'andalucia'
SALIDA_APP = RAIZ / 'src' / 'lib' / 'curriculum' / 'data' / 'andalucia'

# Título de la materia en el anexo → identificador (los de Madrid donde coinciden)
MATERIAS = {
    'Biología y Geología': 'biologia-y-geologia',
    'Digitalización': 'digitalizacion',
    'Economía y Emprendimiento': 'economia-y-emprendimiento',
    'Educación Física': 'educacion-fisica',
    'Educación Plástica, Visual y Audiovisual': 'educacion-plastica-visual-y-audiovisual',
    'Educación en Valores Cívicos y Éticos': 'educacion-en-valores',
    'Expresión Artística': 'expresion-artistica',
    'Física y Química': 'fisica-y-quimica',
    'Formación y Orientación Personal y Profesional': 'formacion-y-orientacion',
    'Geografía e Historia': 'geografia-e-historia',
    'Latín': 'latin',
    'Lengua Castellana y Literatura': 'lengua-castellana',
    'Lengua Extranjera': 'lengua-extranjera',
    'Matemáticas': 'matematicas',
    'Matemáticas A': 'matematicas-a',
    'Matemáticas B': 'matematicas-b',
    'Música': 'musica',
    'Tecnología': 'tecnologia',
    'Tecnología y Digitalización': 'tecnologia-y-digitalizacion',
    # Anexo III
    'Ampliación de Cultura Clásica': 'ampliacion-de-cultura-clasica',
    'Aprendizaje Social y Emocional': 'aprendizaje-social-y-emocional',
    'Artes Escénicas y Danza': 'artes-escenicas-y-danza',
    'Computación y Robótica': 'computacion-y-robotica',
    'Cultura Científica': 'cultura-cientifica',
    'Cultura Clásica': 'cultura-clasica',
    'Cultura del Flamenco': 'cultura-del-flamenco',
    'Dibujo Técnico': 'dibujo-tecnico',
    'Filosofía': 'filosofia',
    'Filosofía y Argumentación': 'filosofia-y-argumentacion',
    'Iniciación a la Actividad Emprendedora y Empresarial': 'iniciacion-actividad-emprendedora',
    'Oratoria y Debate': 'oratoria-y-debate',
    'Proyecto de Educación Plástica y Audiovisual': 'proyecto-educacion-plastica',
}
POR_MINUSCULAS = {k.lower(): k for k in MATERIAS}
CURSOS = {'PRIMER': 1, 'SEGUNDO': 2, 'TERCER': 3, 'CUARTO': 4}
CABECERA_SABERES = re.compile(r'^((PRIMER|SEGUNDO|TERCER|CUARTO) CURSO\s*)+$')
# Oratoria y Debate: «Saberes básicos 1ºESO Saberes básicos 2ºESO»
CABECERA_SABERES_2 = re.compile(r'^(Saberes básicos [1-4]º ?ESO\s*)+$')
TITULO_SABERES = re.compile(r'^Saberes básicos( de .+)?\.$')
# «1.1.»; el BOJA escribe alguno con dos puntos («1..1.», Lengua Castellana, primero) y se lee igual
CODIGO_CRITERIO = re.compile(r'(?<!\S)(\d{1,2})\.{1,2}(\d{1,2})\.?(?=\s|$)')
# «BYG.1.A.1.», «LCL.4.B.4.2.»; alguno sin el punto tras la letra
# A veces pegado a la palabra siguiente («EFI.4.A.3.Salud mental»)
# A veces sin el punto final («DIG.4.A.4 Dispositivos conectados»): vale si sigue una mayúscula
CODIGO_SABER = re.compile(r'(?<![\w.])([A-Z]{2,4})\.([1-4])\.([A-Z])\.?(\d{1,2})(?:\.((?:\d{1,2}\.)*)(?=\s|$|[A-ZÁÉÍÓÚ])|(?= [A-ZÁÉÍÓÚ]))')
# Computación y Robótica llega a la «I»
BLOQUE = re.compile(r'^([A-L])\. (.+?)\.?$')
# Las palabras de la cabecera de una tabla (se saltan hasta la primera fila)
CABECERA_TABLA = {'competencias', 'específicas', 'competen-', 'cias', 'criterios', 'criterio', 'de', 'evaluación',
                  'saberes', 'básicos', 'curso', 'primer', 'segundo', 'tercer', 'cuarto', '1º', '2º', '3º', '4º', 'a', 'b', 'eso'}


def solo_cabecera(l, materia):
    palabras_l = {w['text'].lower().rstrip('.,') for w in l}
    nombre_l = set(materia.lower().replace(',', '').split())
    return palabras_l <= (CABECERA_TABLA | nombre_l)


def es_cabecera_de_tabla(l, materia, centrada):
    """Una línea de la cabecera de la tabla de criterios: solo palabras de cabecera y del nombre
    de la materia, y con «Criterios», «Competencias», «Saberes», un curso («1º») o centrada."""
    if not solo_cabecera(l, materia):
        return False
    t = texto(l)
    return bool(re.search(r'Criterio|Competen|Saberes|[1-4]º', t)) or centrada


def verticales(p):
    """Las líneas verticales de las tablas de la página, con su altura: (x, arriba, abajo)."""
    from andalucia_primaria import ARRIBA, ABAJO
    return [(e['x0'], e['top'], e['bottom']) for e in p.edges if e['orientation'] == 'v' and e['object_type'] == 'line'
            and e['top'] > ARRIBA - 10 and e['bottom'] < ABAJO + 10 and e['bottom'] - e['top'] > 8]


def es_titulo_de(t, materia):
    """¿La línea es el título de una tabla de esa materia? («Biología y Geología 1º …», «Música cuarto curso»)."""
    return t.lower().startswith(materia.lower())


def leer():
    vocab = Counter()
    paginas = []
    for ruta in PDFS:
        pdf = pdfplumber.open(ruta)
        for p in pdf.pages:
            paginas.append(p)
            for w in p.extract_words(x_tolerance=1.5, y_tolerance=2):
                if not w['text'].endswith('-'):
                    for tk in re.findall(r'[\wáéíóúüñÁÉÍÓÚÜÑ-]+', w['text']):
                        vocab[tk.lower()] += 1
    decisiones = []

    primera = ultima = None
    for i, p in enumerate(paginas):
        t = p.extract_text() or ''
        if primera is None and 'Materias comunes obligatorias y optativas' in t and i > 40:
            primera = i
        if primera is not None and 'Ámbitos del Programa de Diversificación Curricular' in t:
            ultima = i - 1
            break
    assert primera is not None and ultima is not None

    materias = {}
    actual = None
    modo = None
    tabla = None
    saberes_cols = None
    comp_actual = None

    for i in range(primera, ultima + 1):
        p = paginas[i]
        ls = lineas(palabras_de(p))
        seps = verticales(p)
        bloque, segmentos = [], []

        def cerrar():
            if bloque:
                segmentos.append((modo, actual, tabla, saberes_cols, list(bloque)))
                bloque.clear()

        for l in ls:
            t = texto(l)
            centro = (l[0]['x0'] + l[-1]['x1']) / 2
            centrada = abs(centro - p.width / 2) < 80
            if centrada and re.match(r'^(ANEXO [IVX]+|Materias (comunes|optativas)|Ámbitos)', t):
                # Empieza un anexo o un apartado nuevo: se cierra la materia anterior
                cerrar()
                modo, tabla, saberes_cols = 'fin', None, None
                continue
            if centrada and negrita(l):
                nombre = POR_MINUSCULAS.get(t.rstrip('.').lower())
                if nombre and not (actual and nombre == actual['titulo'] and actual['visto_saberes']):
                    cerrar()
                    actual = materias.setdefault(MATERIAS[nombre], {
                        'id': MATERIAS[nombre], 'titulo': nombre, 'competencias': [], 'tandas': [], 'visto_saberes': False,
                    })
                    modo, tabla, saberes_cols = 'intro', None, None
                    continue
                otra_tabla = modo == 'tabla' and t != tabla['titulo'] and re.search(r'[1-4]º|cuarto', t)
                if actual and actual['visto_saberes'] and es_titulo_de(t, actual['titulo']) and (modo != 'tabla' or otra_tabla):
                    cerrar()
                    modo = 'tabla'
                    tabla = {'titulo': t, 'paginas': []}
                    actual['tandas'][-1]['tablas'].append(tabla)
                    continue
            if actual is None:
                continue
            # Con punto; sin él solo en la introducción (Computación y Robótica), porque la cabecera de las tablas también lo dice
            if t.lower() == 'competencias específicas.' or (t.lower() == 'competencias específicas' and modo == 'intro'):
                cerrar()
                modo = 'competencias'
                continue
            if TITULO_SABERES.match(t):
                cerrar()
                modo = 'saberes'
                saberes_cols = None
                actual['visto_saberes'] = True
                actual['tandas'].append({'titulo': t, 'saberes': [], 'tablas': []})
                continue
            if modo == 'saberes' and CABECERA_SABERES.match(t):
                cerrar()
                saberes_cols = [CURSOS[w['text']] for w in l if w['text'] in CURSOS]
                continue
            if modo == 'saberes' and CABECERA_SABERES_2.match(t):
                cerrar()
                saberes_cols = [int(x) for x in re.findall(r'([1-4])º', t)]
                continue
            if modo == 'saberes' and es_cabecera_de_tabla(l, actual['titulo'], centrada):
                # La tabla empieza aunque su título no esté centrado o falte (Educación Plástica)
                cerrar()
                modo = 'tabla'
                tabla = {'titulo': t, 'paginas': [], 'empezada': False}
                actual['tandas'][-1]['tablas'].append(tabla)
                continue
            if modo == 'tabla' and not tabla.get('empezada'):
                if solo_cabecera(l, actual['titulo']):
                    continue
                tabla['empezada'] = True
            bloque.extend(l)
        cerrar()

        for modo_s, mat, tb, cols, pal in segmentos:
            if modo_s == 'competencias':
                for l in lineas(pal):
                    t = texto(l)
                    m = re.match(r'^(\d{1,2})\. ', t)
                    if negrita(l) and m and (not mat['competencias'] or int(m.group(1)) == mat['competencias'][-1]['n'] + 1):
                        comp_actual = {'n': int(m.group(1)), 'enunciado': [t[m.end():]], 'resto': []}
                        mat['competencias'].append(comp_actual)
                    elif comp_actual is not None and negrita(l) and not comp_actual['resto']:
                        comp_actual['enunciado'].append(t)
                    elif comp_actual is not None:
                        comp_actual['resto'].append(t)
            elif modo_s == 'saberes':
                mat['tandas'][-1]['saberes'].append((cols, pal, seps))
            elif modo_s == 'tabla':
                tb['paginas'].append((pal, seps))

    return materias, vocab, decisiones


def candidatos(ws, k):
    """Posiciones donde empiezan muchas palabras (bordes izquierdos de columna y, a veces,
    picos falsos de las palabras cortas que cierran una línea justificada)."""
    cuenta = Counter(round(w['x0']) for w in ws)
    suave = {x: sum(cuenta.get(x + d, 0) for d in range(-2, 3)) for x in cuenta}
    out = []
    for x, _ in sorted(suave.items(), key=lambda kv: -kv[1]):
        if all(abs(x - e) >= 25 for e in out):
            out.append(x)
        if len(out) == k:
            break
    return sorted(out)


def columnas(pal, seps, n, previos=None):
    """Reparte las palabras de un trozo de página en `n` columnas, con las líneas verticales
    que cubren la altura de ese trozo (en una misma página pueden acabar los saberes, a dos
    columnas, y empezar la tabla de criterios, a cinco). Cada palabra va a la columna en que
    cae su centro. Sin `n` huecos, `None`."""
    if not pal:
        return {}
    y0, y1 = min(w['top'] for w in pal), max(w['bottom'] for w in pal)
    alto = max(y1 - y0, 1)
    cubre = defaultdict(float)
    for x, a, b in seps:
        cubre[x] += max(0.0, min(b, y1) - max(a, y0))
    xs = []
    for x in sorted(cubre):
        if cubre[x] < 0.5 * alto:
            continue
        if xs and x - xs[-1] <= 6:   # línea doble
            continue
        xs.append(x)
    huecos = list(zip(xs, xs[1:]))
    if len(huecos) != n and not seps and previos and len(previos) == n + 1:
        xs = previos   # una página sin las líneas de la tabla: los bordes de la página anterior
        huecos = list(zip(xs, xs[1:]))
    if len(huecos) != n:
        return None
    if previos is not None:
        previos[:] = xs
    out = defaultdict(list)
    for w in pal:
        c = (w['x0'] + w['x1']) / 2
        j = next((j for j, (a, b) in enumerate(huecos) if a <= c <= b), None)
        if j is None:
            j = 0 if c < huecos[0][0] else n - 1
        out[j].append(w)
    return out


def una_columna(pal):
    return {0: pal}


def saberes_de(lineas_texto, ciclo_o_curso, vocab, decisiones, avisos, donde):
    bloques, actual, piezas = [], None, []

    def cerrar():
        if actual:
            piezas.append((actual[0], actual[1], juntar(actual[2], vocab, decisiones)))

    letra_siguiente = 'A'
    for k, l in enumerate(lineas_texto):
        m = BLOQUE.match(l)
        if not m and len(l) < 90:
            m2 = re.match(r'^([A-L]) (.+?)\.?$', l)
            sig = CODIGO_SABER.match(lineas_texto[k + 1]) if k + 1 < len(lineas_texto) else None
            if m2 and m2.group(1) == letra_siguiente and sig and sig.group(3) == m2.group(1):
                m = m2
                decisiones.append(f'{donde}: bloque sin punto tras la letra: «{l}»')
        if m and not CODIGO_SABER.match(l):
            cerrar()
            actual = ['bloque', m.group(1), [f'{m.group(1)}. {m.group(2)}']]
            letra_siguiente = chr(ord(m.group(1)) + 1)
            continue
        m = CODIGO_SABER.match(l)
        if m:
            cerrar()
            actual = ['saber', m, [l]]
            continue
        if actual is None:
            avisos.append(f'{donde}: texto antes del primer bloque: {l}')
            continue
        actual[2].append(l)
    cerrar()

    prefijos = Counter(c.group(1) for tipo, c, _ in piezas if tipo == 'saber')
    prefijo = prefijos.most_common(1)[0][0] if prefijos else None
    for tipo, cod, t in piezas:
        if tipo == 'bloque':
            m = BLOQUE.match(t)
            bloques.append({'bloque': m.group(1), 'tituloBloque': m.group(2).rstrip('.'), 'epigrafes': []})
            continue
        if cod.group(1) != prefijo or int(cod.group(2)) != ciclo_o_curso:
            avisos.append(f'{donde}: código de otra materia o curso: {t[:60]}')
        if not bloques or bloques[-1]['bloque'] != cod.group(3):
            avisos.append(f'{donde}: saber fuera de su bloque: {t[:60]}')
            continue
        b = bloques[-1]
        if not cod.group(5):
            b['epigrafes'].append({'n': int(cod.group(4)), 'titulo': t[cod.end():].strip().rstrip('.'), 'items': [], 'literal': t})
        else:
            if not b['epigrafes'] or b['epigrafes'][-1]['n'] != int(cod.group(4)):
                if b['epigrafes'] and not b['epigrafes'][-1]['items']:
                    # El epígrafe anterior, aún sin saberes, lleva otro número en el BOJA («MAA.4.E.2. Inferencia.»
                    # y debajo «MAA.4.E.3.1.»): es el suyo
                    avisos.append(f'{donde}: epígrafe con el número cambiado: {b["epigrafes"][-1]["literal"][:40]} y debajo {t[:16]}')
                    b['epigrafes'][-1]['n'] = int(cod.group(4))
                else:
                    avisos.append(f'{donde}: ítem sin su epígrafe: {t[:60]}')
                    b['epigrafes'].append({'n': int(cod.group(4)), 'titulo': None, 'items': [], 'literal': ''})
            b['epigrafes'][-1]['items'].append(t)
    for b in bloques:
        if b['epigrafes'] and all(not e['items'] for e in b['epigrafes']):
            b['epigrafes'] = [{'n': None, 'titulo': None, 'items': [e['literal'] for e in b['epigrafes']]}]
        else:
            # Junto a epígrafes con saberes debajo, uno sin ellos es un saber suelto: va entero, sin título
            for e in b['epigrafes']:
                if not e['items']:
                    e['titulo'], e['items'] = None, [e['literal']]
        for e in b['epigrafes']:
            e.pop('literal', None)
    return bloques, prefijo


def criterios_de(lineas_texto, vocab, decisiones, avisos, donde):
    t = juntar(lineas_texto, vocab, decisiones)
    marcas = list(CODIGO_CRITERIO.finditer(t))
    out = []
    if marcas and marcas[0].start() > 0:
        avisos.append(f'{donde}: texto antes del primer criterio: {t[:marcas[0].start()][:80]}')
    for k, m in enumerate(marcas):
        fin = marcas[k + 1].start() if k + 1 < len(marcas) else len(t)
        out.append({'codigo': f'{m.group(1)}.{m.group(2)}', 'competencia': int(m.group(1)),
                    'texto': t[m.end():fin].strip(), 'codigoLiteral': True})
    return out


def competencias_de_tabla(lineas_texto, vocab, decisiones):
    t = juntar(lineas_texto, vocab, decisiones)
    marcas = list(re.finditer(r'(?:^|(?<=[.\d]\s))(\d{1,2})\.\s', t))
    buenas, siguiente = [], 1
    for m in marcas:
        if int(m.group(1)) == siguiente:
            buenas.append(m)
            siguiente += 1
    out = {}
    for k, m in enumerate(buenas):
        fin = buenas[k + 1].start() if k + 1 < len(buenas) else len(t)
        cuerpo = t[m.end():fin].strip()
        desc = re.search(r'((?:(?:CCL|CP|STEM|CD|CPSAA|CC|CE|CCEC)\d,?\s*)+)\.?$', cuerpo)
        out[int(m.group(1))] = {'enunciado': cuerpo[:desc.start()].strip() if desc else cuerpo,
                                'descriptores': re.findall(r'(?:CCL|CP|STEM|CD|CPSAA|CC|CE|CCEC)\d', desc.group(1)) if desc else []}
    return out


def cursos_de_tabla(titulo, materia, saberes_cursos):
    """Los cursos (o «Matemáticas A»/«B») de una tabla, por su título."""
    resto = titulo[len(materia):] if titulo.lower().startswith(materia.lower()) else ''
    nums = [int(x) for x in re.findall(r'([1-4])º', resto)]
    if nums:
        return nums
    if re.search(r'cuarto curso', resto, re.I):
        return [4]
    # Solo el nombre: los cursos de sus saberes
    return saberes_cursos


def construir():
    materias, vocab, decisiones = leer()
    avisos, diferencias = [], []
    salida = {}
    resumen = {}
    for ident, mat in materias.items():
        comps = []
        for c in mat['competencias']:
            enunciado = juntar(c['enunciado'], vocab, decisiones)
            resto = juntar(c['resto'], vocab, decisiones)
            d = DESCRIPTORES_ESO.search(resto)
            descriptores = []
            if not d:
                avisos.append(f'{ident} CE{c["n"]}: sin la frase de los descriptores')
            else:
                for x in re.split(r',\s*|\s+y\s+|\s+', d.group(1).strip()):
                    if not x:
                        continue
                    if x == f'CPSSAA{x[-1:]}':
                        # Errata clara del BOJA (Filosofía, Filosofía y Argumentación): no hay ningún descriptor CPSSAA
                        decisiones.append(f'{ident} CE{c["n"]}: {x} → CPSAA{x[-1]}')
                        x = f'CPSAA{x[-1]}'
                    if not DESCRIPTOR.match(x):
                        avisos.append(f'{ident} CE{c["n"]}: descriptor raro {x!r}')
                        continue
                    descriptores.append(x)
            comps.append({'n': c['n'], 'texto': enunciado, 'descriptores': descriptores})

        criterios, saberes = {}, {}
        prefijo_materia = None
        for k, tanda in enumerate(mat['tandas']):
            # Saberes: una columna por curso
            por_curso = defaultdict(list)
            cursos_tanda = None
            n_tanda = max((len(cols) for cols, _, _ in tanda['saberes'] if cols), default=1)
            previos = []
            for cols, pal, seps in tanda['saberes']:
                n = len(cols) if cols else n_tanda
                rep = columnas(pal, seps, n, previos) if n > 1 else una_columna(pal)
                if rep is None:
                    avisos.append(f'{ident}: página de saberes sin las {n} columnas (líneas {sorted(set(round(x) for x, _, _ in seps))})')
                    continue
                cursos_tanda = cols or cursos_tanda
                for j, wcol in rep.items():
                    por_curso[j].extend(texto(l) for l in lineas(wcol))
            # Un solo curso, sin cabecera: el curso lo dice el código de sus saberes
            if cursos_tanda is None:
                cod = next((CODIGO_SABER.match(l) for l in por_curso[0] if CODIGO_SABER.match(l)), None)
                cursos_tanda = [int(cod.group(2))] if cod else []
            for j, curso in enumerate(cursos_tanda):
                bloques, prefijo = saberes_de(por_curso[j], curso, vocab, decisiones, avisos, f'{ident} {curso}º')
                prefijo_materia = prefijo_materia or prefijo
                saberes[f'{curso}º ESO'] = bloques

            for tb in tanda['tablas']:
                # Los cursos de la tanda de saberes, o los del título si son parte de ellos (Computación y
                # Robótica: saberes de primero a tercero y una tabla por curso)
                del_titulo = cursos_de_tabla(tb['titulo'], mat['titulo'], cursos_tanda)
                cursos = del_titulo if set(del_titulo) <= set(cursos_tanda) else cursos_tanda
                if not set(del_titulo) <= set(cursos_tanda):
                    avisos.append(f'{ident}: la tabla «{tb["titulo"]}» dice cursos {del_titulo} y sus saberes, {cursos_tanda}')
                n = 1 + 2 * len(cursos)
                texto_cols = defaultdict(list)
                previos = []
                for pal, seps in tb['paginas']:
                    rep = columnas(pal, seps, n, previos)
                    if rep is None:
                        avisos.append(f'{ident} ({tb["titulo"]}): una página de la tabla no tiene {n} columnas (líneas {sorted(set(round(x) for x, _, _ in seps))})')
                        continue
                    for j, wcol in rep.items():
                        texto_cols[j].extend(texto(l) for l in lineas(wcol))
                for j, curso in enumerate(cursos):
                    criterios[f'{curso}º ESO'] = criterios_de(texto_cols[1 + 2 * j], vocab, decisiones, avisos, f'{ident} {curso}º')
                cs = competencias_de_tabla(texto_cols[0], vocab, decisiones)
                for c in comps:
                    t = cs.get(c['n'])
                    if not t:
                        avisos.append(f'{ident} ({tb["titulo"]}): la tabla no trae la CE{c["n"]}')
                        continue
                    if normal(t['enunciado']) != normal(c['texto']):
                        diferencias.append(f'{ident} ({tb["titulo"]}) CE{c["n"]}: {cambios(c["texto"], t["enunciado"])}')
                    if t['descriptores'] != c['descriptores']:
                        diferencias.append(f'{ident} ({tb["titulo"]}) CE{c["n"]}: descriptores de la tabla {t["descriptores"]}, del apartado {c["descriptores"]}')

        salida[ident] = {'id': ident, 'materia': mat['titulo'], 'competencias': comps, 'criterios': criterios, 'saberes': saberes}
        resumen[ident] = {'competencias': len(comps), 'criterios': {k: len(v) for k, v in criterios.items()},
                          'saberes': {k: sum(len(e['items']) for b in v for e in b['epigrafes']) for k, v in saberes.items()},
                          'prefijo': prefijo_materia}

    # Matemáticas A y B (cuarto): en la app, grupos de Matemáticas, como en Madrid
    mates = salida['matematicas']
    for letra in 'AB':
        m = salida.pop(f'matematicas-{letra.lower()}')
        # Sin apartado de competencias propio, las de Matemáticas
        if m['competencias'] and [c['texto'] for c in m['competencias']] != [c['texto'] for c in mates['competencias']]:
            mates.setdefault('competenciasPorGrupo', {})[f'Matemáticas {letra}'] = m['competencias']
        mates['criterios'][f'Matemáticas {letra}'] = m['criterios'].pop('4º ESO')
        mates['saberes'][f'Matemáticas {letra}'] = m['saberes'].pop('4º ESO')
        if m['criterios'] or m['saberes']:
            avisos.append(f'Matemáticas {letra}: trae cursos que no son cuarto: {list(m["criterios"])} {list(m["saberes"])}')
    if mates.get('competenciasPorGrupo'):
        for g in mates['criterios']:
            if g not in mates['competenciasPorGrupo']:
                mates['competenciasPorGrupo'][g] = mates['competencias']
    resumen['matematicas']['criterios'] = {k: len(v) for k, v in mates['criterios'].items()}
    resumen.pop('matematicas-a', None)
    resumen.pop('matematicas-b', None)
    return list(salida.values()), resumen, avisos, decisiones, diferencias


DESCRIPTORES_ESO = re.compile(r'se conecta con los siguientes descriptores(?: del Perfil de salida)?:\s*(.+?)\.(?:\s|$)')
ORDEN_GRUPOS = ['1º ESO', '2º ESO', '3º ESO', '4º ESO', 'Matemáticas A', 'Matemáticas B']


def comprobar(salida, avisos):
    for e in salida:
        ns = [c['n'] for c in e['competencias']]
        if not ns or ns != list(range(1, len(ns) + 1)):
            avisos.append(f'{e["id"]}: competencias {ns}')
        if set(e['criterios']) != set(e['saberes']):
            avisos.append(f'{e["id"]}: cursos con criterios {sorted(e["criterios"])} y con saberes {sorted(e["saberes"])}')
        for grupo, cs in e['criterios'].items():
            if not cs:
                avisos.append(f'{e["id"]} {grupo}: sin criterios')
            for c in cs:
                if c['competencia'] not in ns:
                    avisos.append(f'{e["id"]} {grupo}: el criterio {c["codigo"]} no tiene competencia')
                if len(c['texto']) < 15:
                    avisos.append(f'{e["id"]} {grupo}: criterio {c["codigo"]} muy corto: {c["texto"]!r}')
            codigos = [c['codigo'] for c in cs]
            if len(set(codigos)) != len(codigos):
                avisos.append(f'{e["id"]} {grupo}: criterios repetidos')
            sin = [n for n in ns if not any(c['competencia'] == n for c in cs)]
            if sin:
                avisos.append(f'{e["id"]} {grupo}: competencias sin criterios {sin}')
        for grupo, bs in e['saberes'].items():
            if not bs:
                avisos.append(f'{e["id"]} {grupo}: sin saberes')
            for b in bs:
                for ep in b['epigrafes']:
                    for it in ep['items']:
                        dentro = re.search(r'\s[A-Z]{2,4}\.[1-4]\.[A-Z]\.?\d{1,2}\.?(?:\d{1,2}\.)*\s', it[6:])
                        if dentro:
                            avisos.append(f'{e["id"]} {grupo}: un saber lleva dentro otro código ({dentro.group(0).strip()}): {it[:50]}')
        e['criterios'] = {g: e['criterios'][g] for g in ORDEN_GRUPOS if g in e['criterios']}
        e['saberes'] = {g: e['saberes'][g] for g in ORDEN_GRUPOS if g in e['saberes']}


# Lo que el BOJA trae así y se copia tal cual (docs/COMUNIDADES.md, «Andalucía»)
ESPERADOS: set[str] = {
    # Computación y Robótica, segundo: en la columna de competencias de su tabla el PDF trae texto superpuesto
    # (se lee «S5.TE MU5t,i ClizDa1r…») y no se ven la CE5 ni la CE6; sus criterios y el apartado de competencias están bien
    'computacion-y-robotica (Computación y Robótica 2º): la tabla no trae la CE5',
    'computacion-y-robotica (Computación y Robótica 2º): la tabla no trae la CE6',
    # Matemáticas A: el epígrafe «Inferencia» lleva el código E.2 (repetido) y sus saberes, E.3.1 a E.3.3
    'matematicas-a 4º: epígrafe con el número cambiado: MAA.4.E.2. Inferencia. y debajo MAA.4.E.3.1. Dif',
    # Geografía e Historia, tercero: dos saberes con el código de cuarto
    'geografia-e-historia 3º: código de otra materia o curso: GEH.4.B.2. Tiempo histórico: construcción e interpretación d',
    'geografia-e-historia 3º: código de otra materia o curso: GEH.4.B.3. Conciencia histórica. Elaboración de juicios prop',
    # Lengua Castellana, cuarto: «CL.4.B.1.» por «LCL.4.B.1.»
    'lengua-castellana 4º: código de otra materia o curso: CL.4.B.1.Contexto: componentes del hecho comunicativo. Compo',
    # Computación y Robótica, primero: el bloque E con los códigos de tercero
    'computacion-y-robotica 1º: código de otra materia o curso: CYR.3.E.1. Introducción a las páginas web.',
    'computacion-y-robotica 1º: código de otra materia o curso: CYR.3.E.2. Introducción a los servidores web.',
    'computacion-y-robotica 1º: código de otra materia o curso: CYR.3.E.3. Tipos de lenguajes para la edición de páginas web',
    'computacion-y-robotica 1º: código de otra materia o curso: CYR.3.E.4. Introducción a la animación web.',
}


def main():
    salida, resumen, avisos, decisiones, diferencias = construir()
    comprobar(salida, avisos)
    inesperados = [a for a in avisos if a not in ESPERADOS]
    SALIDA_APP.mkdir(parents=True, exist_ok=True)
    (SALIDA_APP / 'eso.es.json').write_text(json.dumps(salida, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    (SALIDA_SCRIPTS / 'eso-orden-30-5-2023.json').write_text(
        json.dumps({'resumen': resumen, 'guiones_compuestos': sorted(set(decisiones)), 'avisos': avisos,
                    'competencias_distintas_en_las_tablas': diferencias}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    for k, v in resumen.items():
        print(k, v['competencias'], v['criterios'], v['saberes'], v['prefijo'])
    print(f'{len(avisos)} avisos ({len(inesperados)} inesperados); {len(diferencias)} diferencias entre competencias y tablas')
    for a in inesperados[:80]:
        print(' ·', a)
    if inesperados:
        sys.exit(1)


if __name__ == '__main__':
    main()
