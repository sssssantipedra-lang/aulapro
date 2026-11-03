"""
Lee el anexo II de la Orden de 30 de mayo de 2023 (Primaria, Andalucía; BOJA
núm. 104, de 2 de junio de 2023) y escribe el currículo que lleva la app:
`src/lib/curriculum/data/andalucia/primaria.es.json`.

Cada área del anexo trae, por este orden:

1. Su título, centrado («Matemáticas»).
2. «Competencias Específicas.»: cada competencia con su enunciado en negrita
   («1. Interpretar…»), su explicación y la frase «Esta competencia específica
   se conecta con los siguientes descriptores del Perfil de salida: …».
3. «Saberes básicos.»: tres columnas (primer, segundo y tercer ciclo), cada
   una con sus bloques («A. Sentido numérico.») y sus saberes con código
   («MAT.1.A.1. Conteo.», «MAT.1.A.1.1. Significado…»). Una columna sigue en la
   misma columna de la página siguiente.
4. Una tabla por ciclo («Matemáticas (Primer Ciclo)») con las competencias, los
   criterios de evaluación de cada curso del ciclo («1.1.a.» para el primero y
   «1.1.b.» para el segundo) y los saberes con que se relaciona cada fila.

Lo que tiene de propio frente a las otras comunidades: los criterios son de
cada curso, no del ciclo. En la app van por curso («1º Primaria»…, ver
`porCursoDePrimaria` en `src/lib/curriculum/propios.ts`) y los saberes, por
ciclo, como en el decreto.

Todo se lee por la posición de las palabras (pdfplumber), columna a columna.
Competencias, criterios y saberes van numerados, así que se cortan por su
número y no por filas. Las palabras partidas por un guion a final de línea se
juntan con el vocabulario del propio anexo (`resolver_guiones`).

Segunda Lengua Extranjera (tercer ciclo) no tiene tabla propia: según el anexo,
«partirá de los mismos elementos curriculares que se desarrollan en el Primer
ciclo del área de Primera Lengua Extranjera». En la app lleva los del primer
ciclo de Primera Lengua Extranjera en quinto y en sexto, los dos cursos del
ciclo (criterios «a» y «b»). Los centros plurilingües, que según el mismo
párrafo parten de cada ciclo de Primera Lengua Extranjera, no se distinguen.

Uso:
    python3 scripts/curriculo/andalucia_primaria.py            # escribe el JSON
    python3 scripts/curriculo/andalucia_primaria.py --revisar  # además, imprime la estructura
"""
import json
import logging
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import pdfplumber

logging.disable(logging.WARNING)  # avisos de fuentes de pdfminer

RAIZ = Path(__file__).resolve().parents[2]
PDF = RAIZ / 'docs' / 'Normativa Andalucía' / 'Orden 30-5-2023 currículo Primaria (BOJA 104).pdf'
SALIDA_SCRIPTS = Path(__file__).parent / 'andalucia'
SALIDA_APP = RAIZ / 'src' / 'lib' / 'curriculum' / 'data' / 'andalucia'

# Título del área en el anexo → identificador y nombre en la app (artículo 6 de la orden)
AREAS = {
    'Conocimiento del Medio Natural, Social y Cultural': ('conocimiento-del-medio', 'Conocimiento del Medio Natural, Social y Cultural'),
    'Educación Artística': ('educacion-artistica', 'Educación Artística'),
    'Educación Física': ('educacion-fisica', 'Educación Física'),
    'Educación en Valores Cívicos y Éticos': ('educacion-en-valores', 'Educación en Valores Cívicos y Éticos'),
    'Lengua Castellana y Literatura': ('lengua-castellana', 'Lengua Castellana y Literatura'),
    'Primera y Segunda Lengua Extranjera': ('lengua-extranjera', 'Primera Lengua Extranjera'),
    'Matemáticas': ('matematicas', 'Matemáticas'),
}
# El título de cada tabla de criterios lleva el nombre corto del área
TITULO_TABLA = re.compile(r'^(.+?) \((Primer|Segundo|Tercer) Ciclo\)$')
CICLOS = {'Primer': 1, 'Segundo': 2, 'Tercer': 3}
COLUMNAS_SABERES = {'PRIMER CICLO': 1, 'SEGUNDO CICLO': 2, 'TERCER CICLO': 3}
# Prefijo de los códigos de saberes de cada área
PREFIJOS = {'conocimiento-del-medio': 'CMN', 'educacion-artistica': 'EAR', 'educacion-fisica': 'EFI',
            'educacion-en-valores': 'VCE', 'lengua-castellana': 'LCL', 'lengua-extranjera': 'LEX', 'matematicas': 'MAT'}

DESCRIPTORES = re.compile(r'Esta competencia específica se conecta con los siguientes descriptores del Perfil de salida:\s*(.+?)\.(?:\s|$)')
DESCRIPTOR = re.compile(r'^(?:CCL|CP|STEM|CD|CPSAA|CC|CE|CCEC)\d$')
# «1.1.a.» (con la letra del curso dentro del ciclo) o, en Educación en Valores (un solo curso), «1.1.»
CODIGO_CRITERIO = re.compile(r'(?<!\S)(\d{1,2})\.(\d{1,2})\.(?:([ab])\.?)?(?=\s|$)')
# «MAT.1.A.1.» y «MAT.1.A.1.1.»; el BOJA escribe alguno sin el punto tras la letra («CMN.1.C4.»), y se copia así
CODIGO_SABER = re.compile(r'(?<![\w.])([A-Z]{3})\.([1-3])\.([A-Z])\.?(\d{1,2})\.(?:(\d{1,2})\.)?(?=\s|$)')
BLOQUE = re.compile(r'^([A-H])\. (.+?)\.?$')

ARRIBA, ABAJO = 108, 788  # la cabecera y el pie del BOJA quedan fuera


def palabras_de(p):
    """Las palabras del cuerpo de la página, sin cabecera, pie ni el sello vertical."""
    return [w for w in p.extract_words(extra_attrs=['fontname', 'size'], x_tolerance=1.5, y_tolerance=2, keep_blank_chars=False)
            if ARRIBA < w['top'] < ABAJO and w['size'] > 6 and w['upright']]


def lineas(ws, tolerancia=2.5):
    """Agrupa palabras en líneas (de arriba abajo; cada línea, de izquierda a derecha)."""
    out = []
    for w in sorted(ws, key=lambda w: (w['top'], w['x0'])):
        if out and abs(w['top'] - out[-1][0]['top']) <= tolerancia:
            out[-1].append(w)
        else:
            out.append([w])
    return [sorted(l, key=lambda w: w['x0']) for l in out]


def arranques(ws, k):
    """Los `k` bordes izquierdos de columna: las posiciones donde empiezan más
    palabras (las de principio de línea, en texto justificado), separadas al
    menos 40 puntos."""
    cuenta = Counter(round(w['x0']) for w in ws)
    # Se suman los vecinos (±2): una columna no empieza siempre en el mismo punto exacto
    suavizada = {x: sum(cuenta.get(x + d, 0) for d in range(-2, 3)) for x in cuenta}
    elegidos = []
    for x, _ in sorted(suavizada.items(), key=lambda kv: -kv[1]):
        if all(abs(x - e) >= 40 for e in elegidos):
            elegidos.append(x)
        if len(elegidos) == k:
            break
    return sorted(elegidos)


def separadores(p):
    """Las líneas verticales de las tablas de la página (solo las del cuerpo, no las del logotipo)."""
    xs = sorted(e['x0'] for e in p.edges if e['orientation'] == 'v' and e['object_type'] == 'line'
                and e['top'] > ARRIBA - 5 and e['bottom'] < ABAJO + 5 and e['bottom'] - e['top'] > 15)
    out = []
    for x in xs:
        if not out or x - out[-1] > 6:   # una línea doble (dos trazos a 3 puntos) es un solo borde
            out.append(x)
    return out


def repartir(ws, starts, claves, seps=()):
    """Reparte las palabras en columnas. Con las líneas de la tabla, cada palabra va al hueco entre
    líneas en que cae su centro, y cada hueco a la columna cuyo texto empieza en él: así una palabra
    corta pegada al borde derecho («la», «el») no salta a la columna siguiente. Sin líneas, por el
    borde izquierdo de cada columna."""
    por_col = defaultdict(list)
    huecos = list(zip(seps, seps[1:])) if len(seps) >= 2 else []
    hueco_de = {}
    for a, b in huecos:
        dentro = [j for j, x in enumerate(starts) if a - 3 <= x <= b]
        if len(dentro) == 1:
            hueco_de[(a, b)] = dentro[0]
    # Tantos huecos como columnas: cada hueco es su columna, en orden. Es lo normal: los bordes
    # izquierdos medidos pueden engañar, porque las palabras cortas de final de línea justificada
    # también se alinean (a la derecha) y forman un pico falso
    if len(huecos) == len(claves):
        hueco_de = {h: j for j, h in enumerate(huecos)}
    for w in ws:
        c = (w['x0'] + w['x1']) / 2
        h = next(((a, b) for a, b in huecos if a <= c <= b), None)
        if h in hueco_de:
            i = hueco_de[h]
        else:
            i = max([j for j, x in enumerate(starts) if w['x0'] >= x - 2], default=0)
        por_col[claves[i]].append(w)
    return por_col


def texto(linea):
    # Un punto en cursiva sale como palabra aparte («Competencias Específicas .»): se pega a la anterior
    return re.sub(r' ([.,;:])(?= |$)', r'\1', ' '.join(w['text'] for w in linea))


def negrita(linea):
    return all('Bold' in w['fontname'] for w in linea)


def vocabulario(pdf):
    vocab = Counter()
    for p in pdf.pages:
        for w in p.extract_words(x_tolerance=1.5, y_tolerance=2):
            if not w['text'].endswith('-'):
                for t in re.findall(r'[\wáéíóúüñÁÉÍÓÚÜÑ-]+', w['text']):
                    vocab[t.lower()] += 1
    return vocab


def juntar(lineas_texto, vocab, decisiones):
    """Une las líneas de un texto. Una palabra con guion al final de la línea se
    junta con la siguiente sin guion, salvo que la palabra compuesta con guion
    aparezca entera en el anexo («físico-deportivas») y la junta no."""
    out = ''
    for l in lineas_texto:
        l = l.strip()
        if not l:
            continue
        if out.endswith('-') and l[:1].isalpha():
            ant = re.findall(r'[\wáéíóúüñÁÉÍÓÚÜÑ]+-$', out)
            sig = re.match(r'[\wáéíóúüñÁÉÍÓÚÜÑ]+', l)
            if ant and sig:
                a, s = ant[0][:-1], sig.group(0)
                junta, compuesta = (a + s).lower(), f'{a}-{s}'.lower()
                if vocab[compuesta] and not vocab[junta]:
                    decisiones.append(f'{a}-{s} (compuesta)')
                    out += l
                else:
                    out = out[:-1] + l
                continue
        out = f'{out} {l}' if out else l
    return re.sub(r'\s+', ' ', out).strip()


def leer(revisar=False):
    pdf = pdfplumber.open(PDF)
    vocab = vocabulario(pdf)
    decisiones = []

    # Primera y última página del anexo II
    primera = ultima = None
    for i, p in enumerate(pdf.pages):
        t = p.extract_text() or ''
        if primera is None and 'Desarrollos curriculares de las diferentes áreas' in t:
            primera = i
        if primera is not None and i > primera and re.search(r'^\s*ANEXO III\s*$', t, re.M):
            ultima = i - 1 if not re.search(r'Matemáticas \(Tercer Ciclo\)', t) else i
            break
    assert primera is not None and ultima is not None, 'No se encuentra el anexo II'

    areas = {}
    area = None
    modo = None
    comp_actual = None
    saberes_cols = None   # [(x0, ciclo)]
    tabla = None          # {'ciclo', 'cols': [(x0, rol, curso)], 'texto': {rol: [lineas]}}

    def nueva_area(titulo):
        ident, nombre = AREAS[titulo]
        areas[ident] = {'id': ident, 'area': nombre, 'competencias': [], 'saberes_texto': defaultdict(list),
                        'tablas': {}, 'explicacion': {}}
        return areas[ident]

    for i in range(primera, ultima + 1):
        p = pdf.pages[i]
        ws = palabras_de(p)
        ls = lineas(ws)
        seps = separadores(p)
        # Dentro de la página: los títulos (de área o de tabla) cambian de modo; cada modo lee lo suyo
        bloque_actual = []   # palabras de la página para el modo en curso
        segmentos = []       # [(modo, contexto, palabras)]

        def cerrar():
            if bloque_actual:
                segmentos.append((modo, dict(area=area, tabla=tabla, saberes_cols=saberes_cols), list(bloque_actual)))
                bloque_actual.clear()

        for l in ls:
            t = texto(l)
            centro = (l[0]['x0'] + l[-1]['x1']) / 2
            if t in AREAS and abs(centro - p.width / 2) < 60:
                cerrar()
                area = nueva_area(t)
                modo, tabla, saberes_cols = 'intro', None, None
                continue
            m = TITULO_TABLA.match(t)
            if m and abs(centro - p.width / 2) < 80 and area is not None:
                cerrar()
                modo = 'tabla'
                tabla = {'ciclo': CICLOS[m.group(2)], 'cols': None}
                area['tablas'][tabla['ciclo']] = tabla
                tabla['texto'] = defaultdict(list)
                continue
            if area is None:
                continue
            if t == 'Competencias Específicas.':
                cerrar()
                modo = 'competencias'
                continue
            if t == 'Saberes básicos.':
                cerrar()
                modo = 'saberes'
                saberes_cols = None
                continue
            if modo == 'saberes' and all(k in t for k in ('CICLO',)) and re.fullmatch(r'((PRIMER|SEGUNDO|TERCER) CICLO\s*)+', t):
                # Cabecera de las columnas de saberes
                cols = []
                for k, c in COLUMNAS_SABERES.items():
                    pal = k.split()[0]
                    for w in l:
                        if w['text'] == pal:
                            cols.append((w['x0'], c))
                saberes_cols = sorted(cols)
                cerrar()
                continue
            if modo == 'tabla' and tabla['cols'] is None:
                # Cabecera de la tabla: «Competencias específicas | Criterios de evaluación 1º | … | Saberes básicos»
                if 'Criterios' in t or 'Competencias' in t or t in ('Saberes', 'básicos'):
                    if 'Criterios' in t:
                        cols = [(min(w['x0'] for w in l if w['text'] == 'Competencias'), 'competencias', None)]
                        criterios = [w for w in l if w['text'] == 'Criterios']
                        cursos = re.findall(r'evaluación (\d)º', t)
                        for w, c in zip(criterios, cursos):
                            cols.append((w['x0'], 'criterios', int(c)))
                        tabla['cols'] = cols
                    elif t == 'Saberes' and tabla.get('saberes_x') is None:
                        tabla['saberes_x'] = l[0]['x0']
                    continue
            bloque_actual.extend(l)
        cerrar()

        for modo_s, ctx, pal in segmentos:
            a = ctx['area']
            if modo_s == 'competencias':
                for l in lineas(pal):
                    t = texto(l)
                    m = re.match(r'^(\d{1,2})\. ', t)
                    if negrita(l) and m and (not a['competencias'] or int(m.group(1)) == a['competencias'][-1]['n'] + 1):
                        comp_actual = {'n': int(m.group(1)), 'enunciado': [t[m.end():]], 'resto': [], 'cerrado': False}
                        a['competencias'].append(comp_actual)
                    elif comp_actual is not None and negrita(l) and not comp_actual['resto']:
                        comp_actual['enunciado'].append(t)
                    elif comp_actual is not None:
                        comp_actual['resto'].append(t)
            elif modo_s == 'saberes':
                if ctx['saberes_cols']:
                    a.setdefault('saberes_paginas', []).append((ctx['saberes_cols'], pal, seps))
            elif modo_s == 'tabla':
                tb = ctx['tabla']
                if tb and tb['cols']:
                    tb.setdefault('paginas', []).append((pal, seps))

    # Cada columna empieza donde se alinean a la izquierda sus líneas: se mide con todas las páginas de la tabla
    for a in areas.values():
        paginas = a.pop('saberes_paginas', [])
        if paginas:
            ciclos = [c for _, c in paginas[0][0]]
            starts = arranques([w for _, pal, _ in paginas for w in pal], len(ciclos))
            for _, pal, seps in paginas:
                for c, wcol in repartir(pal, starts, ciclos, seps).items():
                    a['saberes_texto'][c].extend(texto(l) for l in lineas(wcol))
        for tb in a['tablas'].values():
            roles = [(rol, curso) for _, rol, curso in sorted(tb['cols'])] + [('saberes', None)]
            starts = arranques([w for pal, _ in tb.get('paginas', []) for w in pal], len(roles))
            tb['starts'] = starts
            for pal, seps in tb.get('paginas', []):
                for k, wcol in repartir(pal, starts, roles, seps).items():
                    tb['texto'][k].extend(texto(l) for l in lineas(wcol))

    return pdf, areas, vocab, decisiones


def saberes_de(lineas_texto, prefijo, ciclo, vocab, decisiones, avisos):
    """Bloques, epígrafes e ítems de una columna de saberes, por sus códigos."""
    bloques = []
    actual = None   # [tipo, codigo, lineas]
    piezas = []

    def cerrar():
        if actual:
            piezas.append((actual[0], actual[1], juntar(actual[2], vocab, decisiones)))

    for l in lineas_texto:
        m = BLOQUE.match(l)
        if m and not CODIGO_SABER.match(l):
            cerrar()
            actual = ['bloque', m.group(1), [l]]
            continue
        m = CODIGO_SABER.match(l)
        if m and m.group(1) == prefijo:
            cerrar()
            actual = ['saber', m, [l]]
            continue
        if actual is None:
            avisos.append(f'{prefijo} ciclo {ciclo}: texto antes del primer bloque: {l}')
            continue
        actual[2].append(l)
    cerrar()

    for tipo, cod, t in piezas:
        if tipo == 'bloque':
            m = BLOQUE.match(t)
            bloques.append({'bloque': m.group(1), 'tituloBloque': m.group(2).rstrip('.'), 'epigrafes': []})
            continue
        if int(cod.group(2)) != ciclo:
            avisos.append(f'{prefijo} ciclo {ciclo}: código de otro ciclo: {t[:60]}')
        if not bloques or bloques[-1]['bloque'] != cod.group(3):
            avisos.append(f'{prefijo} ciclo {ciclo}: saber fuera de su bloque: {t[:60]}')
            continue
        b = bloques[-1]
        if cod.group(5) is None:
            # «MAT.1.A.1. Conteo.»: epígrafe, o un saber suelto si el bloque no tiene subniveles
            # El título sin su código, como en los otros currículos; el código queda en `n` y en los saberes de debajo
            b['epigrafes'].append({'n': int(cod.group(4)), 'titulo': t[cod.end():].strip().rstrip('.'), 'items': [], 'literal': t})
        else:
            if not b['epigrafes'] or b['epigrafes'][-1]['n'] != int(cod.group(4)):
                avisos.append(f'{prefijo} ciclo {ciclo}: ítem sin su epígrafe: {t[:60]}')
                b['epigrafes'].append({'n': int(cod.group(4)), 'titulo': None, 'items': []})
            b['epigrafes'][-1]['items'].append(t)

    # Un bloque cuyos «epígrafes» no tienen ítems es una lista de saberes sueltos (Educación en Valores):
    # van como ítems de un epígrafe sin título, como en los otros currículos
    for b in bloques:
        if b['epigrafes'] and all(not e['items'] for e in b['epigrafes']):
            b['epigrafes'] = [{'n': None, 'titulo': None, 'items': [e['literal'] for e in b['epigrafes']]}]
        elif any(not e['items'] for e in b['epigrafes']):
            vacios = [e['titulo'] for e in b['epigrafes'] if not e['items']]
            avisos.append(f'{prefijo} ciclo {ciclo}: epígrafes sin saberes en el bloque {b["bloque"]}: {vacios}')
    return bloques


def criterios_de(lineas_texto, curso, sufijo, vocab, decisiones, avisos, donde):
    t = juntar(lineas_texto, vocab, decisiones)
    marcas = list(CODIGO_CRITERIO.finditer(t))
    out = []
    if marcas and marcas[0].start() > 0:
        avisos.append(f'{donde}: texto antes del primer criterio: {t[:marcas[0].start()][:80]}')
    for k, m in enumerate(marcas):
        fin = marcas[k + 1].start() if k + 1 < len(marcas) else len(t)
        cuerpo = t[m.end():fin].strip()
        if sufijo and m.group(3) != sufijo:
            avisos.append(f'{donde}: el criterio {m.group(0)} está en la columna de {curso}º')
        out.append({'codigo': f'{m.group(1)}.{m.group(2)}' + (f'.{m.group(3)}' if m.group(3) else ''), 'competencia': int(m.group(1)),
                    'texto': cuerpo, 'codigoLiteral': True})
    return out


def competencias_de_tabla(lineas_texto, vocab, decisiones):
    """Las competencias de la primera columna de una tabla: enunciado y descriptores."""
    t = juntar(lineas_texto, vocab, decisiones)
    out = {}
    # Tras el final de la competencia anterior: el punto de sus descriptores o, si falta (Educación Artística, CE1), el último descriptor
    marcas = list(re.finditer(r'(?:^|(?<=[.\d]\s))(\d{1,2})\.\s', t))
    # Solo las que siguen la numeración 1, 2, 3…
    buenas, siguiente = [], 1
    for m in marcas:
        if int(m.group(1)) == siguiente:
            buenas.append(m)
            siguiente += 1
    for k, m in enumerate(buenas):
        fin = buenas[k + 1].start() if k + 1 < len(buenas) else len(t)
        cuerpo = t[m.end():fin].strip()
        desc = re.search(r'((?:(?:CCL|CP|STEM|CD|CPSAA|CC|CE|CCEC)\d,?\s*)+)\.?$', cuerpo)
        out[int(m.group(1))] = {
            'enunciado': cuerpo[:desc.start()].strip() if desc else cuerpo,
            'descriptores': re.findall(r'(?:CCL|CP|STEM|CD|CPSAA|CC|CE|CCEC)\d', desc.group(1)) if desc else [],
        }
    return out


def normal(t):
    return re.sub(r'[\s\-]+', '', t).rstrip('.').lower()


def construir(revisar=False):
    pdf, areas, vocab, decisiones = leer(revisar)
    diferencias = []
    if os.environ.get('VOLCAR'):
        Path(os.environ['VOLCAR']).write_text(json.dumps({i: {'saberes': a['saberes_texto'], 'comp': a['competencias'],
            'tablas': {c: {'starts': tb.get('starts'), 'cols': tb['cols'], 'texto': {f'{k[0]}|{k[1]}': v for k, v in tb['texto'].items()}}
                       for c, tb in a['tablas'].items()}} for i, a in areas.items()}, ensure_ascii=False, indent=1))
    avisos = []
    salida = []
    resumen = {}
    for ident, a in areas.items():
        prefijo = PREFIJOS[ident]
        # Competencias del apartado «Competencias Específicas.»
        comps = []
        for c in a['competencias']:
            enunciado = juntar(c['enunciado'], vocab, decisiones)
            resto = juntar(c['resto'], vocab, decisiones)
            d = DESCRIPTORES.search(resto)
            descriptores = [x.strip() for x in d.group(1).split(',')] if d else []
            if not d:
                avisos.append(f'{ident} CE{c["n"]}: sin la frase de los descriptores')
            for x in descriptores:
                if not DESCRIPTOR.match(x):
                    avisos.append(f'{ident} CE{c["n"]}: descriptor raro {x!r}')
            comps.append({'n': c['n'], 'texto': enunciado, 'descriptores': descriptores})

        # Criterios: una tabla por ciclo, una columna por curso
        criterios = {}
        competencias_por_ciclo = {}
        for ciclo, tb in sorted(a['tablas'].items()):
            cursos = [(rol, curso) for _, rol, curso in tb['cols'] if rol == 'criterios']
            for k, (_, curso) in enumerate(cursos):
                sufijo = None if len(cursos) == 1 else 'a' if curso % 2 == 1 else 'b'
                lista = criterios_de(tb['texto'][('criterios', curso)], curso, sufijo, vocab, decisiones, avisos,
                                     f'{ident} {curso}º')
                criterios[f'{curso}º Primaria'] = lista
            competencias_por_ciclo[ciclo] = competencias_de_tabla(tb['texto'][('competencias', None)], vocab, decisiones)

        # Las competencias de cada tabla tienen que decir lo mismo que el apartado de competencias
        for ciclo, cs in competencias_por_ciclo.items():
            for c in comps:
                t = cs.get(c['n'])
                if not t:
                    avisos.append(f'{ident} ciclo {ciclo}: la tabla no trae la CE{c["n"]}')
                    continue
                if normal(t['enunciado']) != normal(c['texto']):
                    diferencias.append(f'{ident} ciclo {ciclo} CE{c["n"]}: {cambios(c["texto"], t["enunciado"])}')
                if t['descriptores'] != c['descriptores']:
                    avisos.append(f'{ident} ciclo {ciclo} CE{c["n"]}: descriptores de la tabla {t["descriptores"]} y del apartado {c["descriptores"]}')

        saberes = {}
        for ciclo, ls in sorted(a['saberes_texto'].items()):
            saberes[str(ciclo)] = saberes_de(ls, prefijo, ciclo, vocab, decisiones, avisos)
            for bl in saberes[str(ciclo)]:
                for e in bl['epigrafes']:
                    e.pop('literal', None)

        entrada = {'id': ident, 'area': a['area'], 'competencias': comps, 'criterios': criterios, 'saberes': saberes}
        if ident == 'educacion-en-valores':
            entrada['cursos'] = [6]
        salida.append(entrada)
        resumen[ident] = {
            'competencias': len(comps),
            'criterios': {k: len(v) for k, v in criterios.items()},
            'saberes': {k: sum(len(e['items']) or 1 for b in v for e in b['epigrafes']) for k, v in saberes.items()},
        }

    # Segunda Lengua Extranjera: la de Primera Lengua Extranjera del primer ciclo, en quinto y sexto
    lex = next(e for e in salida if e['id'] == 'lengua-extranjera')
    primer_ciclo = lex['criterios']['1º Primaria'] + lex['criterios']['2º Primaria']
    primer_ciclo.sort(key=lambda c: [int(x) if x.isdigit() else x for x in c['codigo'].split('.')])
    salida.append({
        'id': 'segunda-lengua-extranjera', 'area': 'Segunda Lengua Extranjera',
        'competencias': lex['competencias'],
        'criterios': {'5º Primaria': primer_ciclo, '6º Primaria': primer_ciclo},
        'saberes': {'3': lex['saberes']['1']},
        'cursos': [5, 6],
    })
    resumen['segunda-lengua-extranjera'] = 'los del primer ciclo de Primera Lengua Extranjera, en quinto y sexto'
    return salida, resumen, avisos, decisiones, diferencias


def cambios(a, b):
    """Lo que cambia de `a` a `b`, palabra a palabra."""
    import difflib
    a, b = a.split(), b.split()
    sm = difflib.SequenceMatcher(a=a, b=b)
    return '; '.join(f"«{' '.join(a[i1:i2])}» → «{' '.join(b[j1:j2])}»" for op, i1, i2, j1, j2 in sm.get_opcodes() if op != 'equal')


# Lo que el BOJA trae así y se copia tal cual (docs/COMUNIDADES.md, «Andalucía»)
ESPERADOS = {
    # Matemáticas, segundo ciclo: cuarto tiene el criterio 2.3.b y tercero no tiene el 2.3.a
    "matematicas: 3º y 4º no tienen los mismos criterios: ['2.3']",
}


def comprobar(salida, avisos):
    """Comprobaciones de forma: numeración seguida, cada criterio con su competencia, sin texto vacío."""
    for e in salida:
        ns = [c['n'] for c in e['competencias']]
        if ns != list(range(1, len(ns) + 1)):
            avisos.append(f'{e["id"]}: competencias {ns}')
        for grupo, cs in e['criterios'].items():
            for c in cs:
                if c['competencia'] not in ns:
                    avisos.append(f'{e["id"]} {grupo}: el criterio {c["codigo"]} no tiene competencia')
                if len(c['texto']) < 15:
                    avisos.append(f'{e["id"]} {grupo}: criterio {c["codigo"]} muy corto: {c["texto"]!r}')
            codigos = [c['codigo'] for c in cs]
            if len(set(codigos)) != len(codigos):
                avisos.append(f'{e["id"]} {grupo}: criterios repetidos {[k for k, v in Counter(codigos).items() if v > 1]}')
            # Cada competencia tiene al menos un criterio en cada curso
            sin = [n for n in ns if not any(c['competencia'] == n for c in cs)]
            if sin:
                avisos.append(f'{e["id"]} {grupo}: competencias sin criterios {sin}')
        # Los dos cursos de un ciclo tienen los mismos números de criterio
        cursos = sorted(int(g.split('º')[0]) for g in e['criterios'])
        for c1 in cursos:
            c2 = c1 + 1
            if c1 % 2 == 1 and c2 in cursos and e['id'] != 'segunda-lengua-extranjera':
                n1 = [x['codigo'][:-2] for x in e['criterios'][f'{c1}º Primaria']]
                n2 = [x['codigo'][:-2] for x in e['criterios'][f'{c2}º Primaria']]
                if n1 != n2:
                    avisos.append(f'{e["id"]}: {c1}º y {c2}º no tienen los mismos criterios: {sorted(set(n1) ^ set(n2))}')


def main():
    revisar = '--revisar' in sys.argv
    salida, resumen, avisos, decisiones, diferencias = construir(revisar)
    comprobar(salida, avisos)
    inesperados = [a for a in avisos if a not in ESPERADOS]
    SALIDA_SCRIPTS.mkdir(parents=True, exist_ok=True)
    SALIDA_APP.mkdir(parents=True, exist_ok=True)
    (SALIDA_APP / 'primaria.es.json').write_text(json.dumps(salida, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    (SALIDA_SCRIPTS / 'primaria-orden-30-5-2023.json').write_text(
        json.dumps({'resumen': resumen, 'guiones_compuestos': sorted(set(decisiones)), 'avisos': avisos,
                    'competencias_distintas_en_las_tablas': diferencias}, ensure_ascii=False, indent=1) + '\n',
        encoding='utf-8')
    print(json.dumps(resumen, ensure_ascii=False, indent=1))
    print(f'{len(avisos)} avisos ({len(inesperados)} inesperados); {len(diferencias)} competencias con otra redacción en su tabla')
    for a in inesperados[:80]:
        print(' ·', a)
    if inesperados:
        sys.exit(1)


if __name__ == '__main__':
    main()
