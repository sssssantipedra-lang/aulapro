"""
Lee el anexo II del Decreto 61/2022 (Primaria, Comunidad de Madrid) y escribe
el currículo que lleva la app: `src/lib/curriculum/data/madrid/primaria.es.json`.

Cada área empieza con su título en cursiva, centrado, fuera de las tablas. Por
cada ciclo hay una tabla con una fila de cabecera («PRIMER CICLO»…), las
competencias específicas a la izquierda y sus criterios de evaluación a la
derecha, y después los contenidos: bloque («A. Cultura científica»), apartado
(«Iniciación en la actividad científica») y conocimientos, destrezas y
actitudes, con viñetas de tres niveles («-», «•» y «–»). Las tablas siguen de
una página a otra.

Excepciones: Educación Artística reparte sus contenidos en «BLOQUE I. Música y
danza» y «BLOQUE II. Educación plástica y visual», cada uno con sus bloques
con letra; Lengua Castellana tiene bloques sin apartados, en una celda que
ocupa las dos primeras columnas; y Educación en Valores Cívicos y Éticos (solo
en quinto), Segunda Lengua Extranjera y Tecnología y Robótica (todos los
cursos) tienen una sola tabla, sin ciclos.

Competencias y criterios van numerados («2.», «2.3.»), así que se reparten por
su número y no hace falta saber en qué fila cae cada uno. Los contenidos sí van
por filas: cada apartado es una fila de la segunda columna, y su bloque, la
fila de la primera columna que la contiene.

Uso:
    python3 scripts/curriculo/madrid_primaria.py            # escribe los JSON
    python3 scripts/curriculo/madrid_primaria.py --revisar  # además, imprime la estructura
"""
import json
import logging
import re
import sys
from collections import Counter
from pathlib import Path

import pdfplumber

sys.path.insert(0, str(Path(__file__).parent))
from saberes_dogv_tablas import GUION_DE_LINEA, bordes, lineas_de  # noqa: E402
from primaria_cv import normalizar_para_comparar, palabras as palabras_para_comparar, texto_plano, vocabulario  # noqa: E402

logging.disable(logging.WARNING)  # avisos de fuentes de pdfminer

RAIZ = Path(__file__).resolve().parents[2]
PDF = RAIZ / 'docs' / 'Normativa Comunidad de Madrid' / 'DECRETO 61-2022.pdf'
SALIDA_SCRIPTS = Path(__file__).parent / 'comunidad-de-madrid'
SALIDA_APP = RAIZ / 'src' / 'lib' / 'curriculum' / 'data' / 'madrid'
PRIMERA, ULTIMA = 18, 111  # anexo II

# Título del área en el PDF → identificador y nombre en la app (artículo 7)
AREAS = {
    'Ciencias de la Naturaleza': 'ciencias-de-la-naturaleza',
    'Ciencias Sociales': 'ciencias-sociales',
    'Educación Artística': 'educacion-artistica',
    'Educación Física': 'educacion-fisica',
    'Lengua Castellana y Literatura': 'lengua-castellana',
    'Lengua Extranjera: Inglés': 'lengua-extranjera',
    'Matemáticas': 'matematicas',
    'Educación en Valores Cívicos y Éticos': 'educacion-en-valores',
    'Segunda Lengua Extranjera': 'segunda-lengua-extranjera',
    'Tecnología y Robótica': 'tecnologia-y-robotica',
}
CICLOS = {'PRIMER CICLO': '1', 'SEGUNDO CICLO': '2', 'TERCER CICLO': '3'}
# Las áreas con una sola tabla para toda la etapa: sus ciclos y, si no se dan
# en todos los cursos de esos ciclos, sus cursos (artículo 7)
SIN_CICLOS = {
    'Educación en Valores Cívicos y Éticos': (['3'], [5]),
    'Segunda Lengua Extranjera': (['1', '2', '3'], None),
    'Tecnología y Robótica': (['1', '2', '3'], None),
}
TODA_LA_ETAPA = '*'
SUPERBLOQUE = re.compile(r'^BLOQUE (I{1,3})$')
CABECERA_CONOCIMIENTOS = 'CONOCIMIENTOS, DESTREZAS Y ACTITUDES'
# Viñetas de los contenidos, por nivel
VINETAS = {'-': 1, '(cid:2)': 2, '•': 2, '(cid:3)': 3, '–': 3}


def palabras(p, con_fuente=False):
    # Con la fuente, una palabra se parte donde cambia (« ( p hrases» en el
    # francés de Segunda Lengua): solo se pide para buscar los títulos
    ws = p.extract_words(x_tolerance=1.5, y_tolerance=2, extra_attrs=['fontname', 'size'] if con_fuente else None)
    # Fuera la cabecera del BOCM, el pie y el código vertical del margen derecho
    return [w for w in ws if 95 < w['top'] < p.height - 30 and w['x1'] < 560]


def es_gris(color):
    v = color if isinstance(color, (tuple, list)) else (color,)
    return len(v) != 3 or max(v) - min(v) < 0.1


def agrupar(xs, tolerancia=12):
    """Agrupa posiciones cercanas (las líneas de las tablas van dobles)."""
    grupos = []
    for x in sorted(xs):
        if grupos and x - grupos[-1][-1] <= tolerancia:
            grupos[-1].append(x)
        else:
            grupos.append([x])
    return [(min(g), max(g)) for g in grupos]


def texto(lns):
    t = ''
    for l in lns:
        s = l['texto'].strip()
        if not s:
            continue
        if t.endswith('-') and not t.endswith(' -'):
            t = t[:-1] + GUION_DE_LINEA + s
        else:
            t = t + ' ' + s if t else s
    return re.sub(r'\s+', ' ', t).strip()


def leer():
    """Recorre el anexo y devuelve, por área, competencias, criterios por ciclo
    y contenidos por ciclo, tal y como están en el PDF."""
    areas = {}
    en_tablas = Counter()  # para comprobar después que no se queda nada fuera
    estado = {'area': None}
    with pdfplumber.open(PDF) as doc:
        for n in range(PRIMERA, ULTIMA + 1):
            p = doc.pages[n - 1]
            ws = palabras(p)
            b = bordes(p)
            # Sin las rayitas sueltas (subrayados) que no son bordes de celda, ni
            # el subrayado amarillo que se coló en una página de Matemáticas
            vs = [e for e in b if e['orientation'] == 'v' and e['bottom'] - e['top'] > 3 and es_gris(e.get('non_stroking_color'))]
            hs = [e for e in b if e['orientation'] == 'h']
            tablas = [t.bbox for t in p.find_tables({
                'vertical_strategy': 'explicit', 'horizontal_strategy': 'explicit',
                'explicit_vertical_lines': vs, 'explicit_horizontal_lines': hs,
            })] if len(vs) > 1 and len(hs) > 1 else []
            tablas = [t for t in tablas if t[3] - t[1] > 20 and t[2] - t[0] > 300]

            def en_tabla(w):
                cx, cy = (w['x0'] + w['x1']) / 2, (w['top'] + w['bottom']) / 2
                return any(t[0] - 1 <= cx <= t[2] + 1 and t[1] - 1 <= cy <= t[3] + 1 for t in tablas)

            # Título de área: cursiva, centrado, fuera de las tablas
            for l in lineas_de([w for w in palabras(p, con_fuente=True) if not en_tabla(w) and 'Oblique' in w['fontname']]):
                if l['texto'] in AREAS and abs((l['x0'] + l['x1']) / 2 - p.width / 2) < 40:
                    estado = {'area': l['texto'], 'ciclo': None, 'modo': None, 'superbloque': None,
                              'bloque': None, 'apartado': None}
                    areas[l['texto']] = {'ce': {}, 'criterios': {}, 'contenidos': {}, 'pagina': n}
            if estado['area'] is None:
                continue
            area = areas[estado['area']]

            for t in tablas:
                dentro = [w for w in ws if en_tabla(w) and t[0] - 1 <= w['x0'] and w['x1'] <= t[2] + 1
                          and t[1] - 1 <= w['top'] <= t[3] + 1]
                lns = lineas_de(dentro)
                for w in dentro:
                    en_tablas.update(fichas(w['text']))
                for tr in tramos(lns, t, hs):
                    if tr[0] == 'ciclo':
                        estado.update(ciclo=tr[1], superbloque=None, bloque=None, apartado=None)
                        continue
                    if tr[0] == 'modo':
                        estado['modo'] = tr[1]
                        continue
                    if tr[0] == 'superbloque':
                        if estado['superbloque'] != tr[1]:
                            estado.update(superbloque=tr[1], bloque=None, apartado=None)
                        continue
                    y0, y1 = tr
                    if y1 - y0 < 4 or estado['modo'] is None:
                        continue
                    if estado['ciclo'] is None:
                        if estado['area'] not in SIN_CICLOS:
                            raise SystemExit(f"{estado['area']}, p. {n}: tabla sin ciclo")
                        estado['ciclo'] = TODA_LA_ETAPA
                    ws_tr = [w for w in dentro if y0 <= (w['top'] + w['bottom']) / 2 <= y1]
                    if not ws_tr:
                        continue
                    v_tr = [e for e in vs if e['top'] <= y1 and e['bottom'] >= y0 and t[0] + 5 < e['x0'] < t[2] - 5]
                    cols = agrupar([e['x0'] for e in v_tr])
                    if estado['modo'] == 'ce':
                        corte = next(((a + b) / 2 for a, b in cols if t[0] + 0.3 * (t[2] - t[0]) < (a + b) / 2 < t[0] + 0.7 * (t[2] - t[0])), None)
                        if corte is None:
                            corte = estado.get('corte_ce')
                        estado['corte_ce'] = corte
                        izq = lineas_de([w for w in ws_tr if (w['x0'] + w['x1']) / 2 < corte])
                        der = lineas_de([w for w in ws_tr if (w['x0'] + w['x1']) / 2 >= corte])
                        area['ce'].setdefault(estado['ciclo'], []).extend(izq)
                        area['criterios'].setdefault(estado['ciclo'], []).extend(der)
                    else:
                        leer_contenidos(area, estado, ws_tr, cols, vs, hs, t, y0, y1, n)
    return areas, en_tablas


def tramos(lns, t, hs):
    """Parte una tabla por sus cabeceras: cada una cambia de ciclo, de modo
    (competencias o contenidos) o, en Educación Artística, de bloque I o II.
    Devuelve las franjas de contenido (y0, y1) y los cambios, en orden."""
    def borde_de_encima(y):
        """Donde empieza de verdad la fila de la cabecera: su borde de arriba."""
        ys = [e['top'] for e in hs if y - 20 < e['top'] < y and e['x1'] - e['x0'] > 0.3 * (t[2] - t[0])]
        return min(ys) if ys else y

    cortes = []
    for i, l in enumerate(lns):
        s = l['texto']
        m = SUPERBLOQUE.match(s)
        if s in CICLOS:
            cortes.append((l['top'], l['bottom'], ('ciclo', CICLOS[s])))
        elif s.startswith('COMPETENCIAS ESPECÍFICAS'):
            cortes.append((l['top'], l['bottom'], ('modo', 'ce')))
        elif s == 'CONTENIDOS':
            cortes.append((l['top'], l['bottom'], ('modo', 'contenidos')))
        elif s.startswith('BLOQUES'):
            cortes.append((l['top'], l['bottom'], None))
        elif m:
            # «BLOQUE I», su título debajo (en una o dos líneas) y, a su
            # derecha, la cabecera de la columna de conocimientos. Acaba donde
            # empieza el primer conocimiento, con su viñeta.
            fin = next(x for x in lns[i + 1:] if x['words'][0]['text'] in VINETAS)
            cabecera = [x['texto'].replace(CABECERA_CONOCIMIENTOS, '').strip() for x in lns[i + 1:] if x['top'] < fin['top']]
            cortes.append((borde_de_encima(l['top']), fin['top'] - 2, ('superbloque', (m.group(1), ' '.join(c for c in cabecera if c)))))
    out = []
    y = t[1]
    for top, bottom, cambio in cortes:
        out.append((y, top - 1))
        if cambio:
            out.append(cambio)
        y = bottom + 1
    out.append((y, t[3]))
    return out


def leer_contenidos(area, estado, ws_tr, cols, vs, hs, t, y0, y1, pagina):
    """Una franja de la tabla de contenidos: bloque | apartado | conocimientos
    (o bloque | conocimientos, si el área no tiene apartados)."""
    limites = [t[0]] + [(a + b) / 2 for a, b in cols] + [t[2]]
    if len(limites) == 3:
        limites = [limites[0], limites[1], limites[1], limites[2]]  # sin columna de apartado
    if len(limites) == 2 and estado.get('limites'):
        limites = estado['limites']  # franja sin líneas verticales: las de antes
    elif len(limites) != 4:
        raise SystemExit(f"{estado['area']}, p. {pagina}: {len(limites) - 1} columnas de contenidos")
    estado['limites'] = limites
    c1, c2, c3 = (limites[0], limites[1]), (limites[1], limites[2]), (limites[2], limites[3])
    con_apartados = c2[1] > c2[0]

    def en(col, w):
        cx = (w['x0'] + w['x1']) / 2
        return col[0] <= cx < col[1]

    def filas(col):
        ys = sorted({round(e['top']) for e in hs if e['x0'] <= col[0] + 6 and e['x1'] >= col[1] - 6 and y0 - 3 <= e['top'] <= y1 + 3})
        ys = [y for y, _ in agrupar(ys, 5)]
        ys = [y0] + [y for y in ys if y0 + 3 < y < y1 - 3] + [y1]
        return list(zip(ys, ys[1:]))

    def separadas(x, a, b):
        """¿Hay línea vertical en x a media altura de la fila? Si no, la
        celda ocupa las dos columnas (bloque sin apartados en Lengua)."""
        medio = (a + b) / 2
        return any(abs(e['x0'] - x) < 8 and e['top'] - 1 <= medio <= e['bottom'] + 1 for e in vs)

    def etiqueta(cols_, a, b):
        return texto(lineas_de([w for w in ws_tr if any(en(c, w) for c in cols_) and a <= (w['top'] + w['bottom']) / 2 <= b]))

    filas_bloque = filas(c1)
    for fa0, fa1 in (filas(c2) if con_apartados else filas_bloque):
        if con_apartados and not separadas(limites[1], fa0, fa1):
            etiqueta_bloque, etiqueta_apartado, unida = etiqueta([c1, c2], fa0, fa1), '', True
        else:
            medio = (fa0 + fa1) / 2
            fb = next(((a, b) for a, b in filas_bloque if a - 1 <= medio <= b + 1), (fa0, fa1))
            etiqueta_bloque = etiqueta([c1], *fb)
            etiqueta_apartado = etiqueta([c2], fa0, fa1) if con_apartados else ''
            unida = not con_apartados
        destino = area['contenidos'].setdefault(estado['ciclo'], [])

        if etiqueta_bloque and etiqueta_bloque != estado['bloque']:
            if not re.match(r'^[A-Z]\. ', etiqueta_bloque):
                raise SystemExit(f"{estado['area']}, p. {pagina}: bloque sin letra: {etiqueta_bloque}")
            estado['bloque'] = etiqueta_bloque
            estado['apartado'] = None
        if unida:
            estado['apartado'] = None
        if etiqueta_apartado:
            if re.match(r'^[a-záéíóúñ]', etiqueta_apartado):
                # El nombre del apartado partido entre dos páginas
                anterior = estado['apartado']
                estado['apartado'] = f'{anterior} {etiqueta_apartado}'
                for parte in destino:
                    if parte['bloque'] == estado['bloque'] and parte['apartado'] == anterior:
                        parte['apartado'] = estado['apartado']
            else:
                estado['apartado'] = etiqueta_apartado
        lns = lineas_de([w for w in ws_tr if en(c3, w) and fa0 <= (w['top'] + w['bottom']) / 2 <= fa1])
        clave = (estado['superbloque'], estado['bloque'], estado['apartado'])
        if not destino or (destino[-1]['superbloque'], destino[-1]['bloque'], destino[-1]['apartado']) != clave:
            destino.append({'superbloque': estado['superbloque'], 'bloque': estado['bloque'], 'apartado': estado['apartado'], 'lineas': []})
        destino[-1]['lineas'].extend(lns)


def numerados(lns, patron):
    """Parte las líneas de una columna por los números del principio."""
    out = []
    for l in lns:
        m = re.match(patron, l['texto'])
        if m:
            out.append({'m': m, 'lineas': [{**l, 'texto': l['texto'][m.end():]}]})
        elif out:
            out[-1]['lineas'].append(l)
        elif l['texto'].strip():
            raise SystemExit(f'Texto antes del primer número: {l["texto"]}')
    return [(o['m'], texto(o['lineas'])) for o in out]


def items(lns):
    """Los conocimientos de un apartado, con su nivel de viñeta."""
    out = []
    for l in lns:
        primera = l['words'][0]['text']
        nivel = VINETAS.get(primera)
        if nivel:
            out.append({'nivel': nivel, 'lineas': [{**l, 'texto': ' '.join(w['text'] for w in l['words'][1:])}]})
        elif out:
            out[-1]['lineas'].append(l)
        else:
            out.append({'nivel': 0, 'lineas': [l]})
    return [{'nivel': o['nivel'], 'texto': texto(o['lineas'])} for o in out]


def estructurar(areas, vocab, guiones):
    """Competencias, criterios y contenidos de cada área, por ciclo.

    Las tablas de este decreto no parten palabras al final de la línea: el
    guion que queda ahí es siempre de una palabra compuesta
    («físico-deportivas», «sintáctico-discursivos», «co-presentaciones»). Si
    una de esas palabras apareciera entera en otra parte del decreto, sí
    podría ser una partición, y se para para mirarlo."""
    def limpio(t):
        if not t:
            return t
        for a, b in re.findall(r'(\w+)' + GUION_DE_LINEA + r'(\w+)', t):
            if vocab[(a + b).lower()]:
                raise SystemExit(f'¿«{a}-{b}» o «{a}{b}»? La segunda está en el decreto')
            guiones.append(f'{a}-{b}')
        return t.replace(GUION_DE_LINEA, '-')

    resultado = {}
    for nombre, a in areas.items():
        ces = {}
        for ciclo, lns in a['ce'].items():
            for m, t in numerados(lns, r'^(\d+)\.\s+'):
                ces.setdefault(int(m.group(1)), {})[ciclo] = limpio(t)
        criterios = {}
        for ciclo, lns in a['criterios'].items():
            criterios[ciclo] = [{'codigo': f'{m.group(1)}.{m.group(2)}', 'competencia': int(m.group(1)), 'texto': limpio(t)}
                                for m, t in numerados(lns, r'^(\d+)\.(\d+)\.?(?:\s+|$)')]
        contenidos = {}
        for ciclo, partes in a['contenidos'].items():
            contenidos[ciclo] = [{
                'superbloque': p['superbloque'] and (p['superbloque'][0], limpio(p['superbloque'][1])),
                'bloque': limpio(p['bloque']),
                'apartado': limpio(p['apartado']),
                'items': [{**i, 'texto': limpio(i['texto'])} for i in items(p['lineas'])],
            } for p in partes]
        resultado[nombre] = {'pagina': a['pagina'], 'competencias': ces, 'criterios': criterios, 'contenidos': contenidos}
    return resultado


def comprobar_estructura(r):
    """Lo que tiene que cumplir cualquier área. Si algo falla, es que el lector
    se ha equivocado en alguna tabla."""
    for nombre, a in r.items():
        ciclos = sorted(a['criterios'])
        numeros = sorted(a['competencias'])
        assert numeros == list(range(1, len(numeros) + 1)), (nombre, numeros)
        for n, por_ciclo in a['competencias'].items():
            assert sorted(por_ciclo) == ciclos, (nombre, n, sorted(por_ciclo))
        assert sorted(a['contenidos']) == ciclos, (nombre, sorted(a['contenidos']))
        for ciclo in ciclos:
            cs = a['criterios'][ciclo]
            codigos = [c['codigo'] for c in cs]
            assert len(set(codigos)) == len(codigos), (nombre, ciclo, codigos)
            assert codigos == sorted(codigos, key=lambda c: tuple(map(int, c.split('.')))), (nombre, ciclo, codigos)
            for n in numeros:
                assert any(c['competencia'] == n for c in cs), (nombre, ciclo, f'CE{n} sin criterios')
            assert all(c['competencia'] in numeros and c['texto'] for c in cs), (nombre, ciclo)
            # Bloques con letra seguidos (A, B, C…), dentro de cada bloque I o II
            letras = {}
            for parte in a['contenidos'][ciclo]:
                ls = letras.setdefault(parte['superbloque'], [])
                letra = parte['bloque'][0]
                if not ls or ls[-1] != letra:
                    ls.append(letra)
                assert parte['items'] and parte['items'][0]['nivel'] == 1, (nombre, ciclo, parte['bloque'], parte['apartado'])
                assert all(i['texto'] for i in parte['items']), (nombre, ciclo, parte['bloque'])
                assert not parte['apartado'] or re.match(r'^[A-ZÁÉÍÓÚ]', parte['apartado']), (nombre, parte['apartado'])
            for sb, ls in letras.items():
                assert ''.join(ls) == 'ABCDEFGHIJ'[:len(ls)], (nombre, ciclo, sb, ls)


# Textos que `pdftotext` no da igual que las tablas y se han comprobado
# mirando la página
VISTOS_EN_IMAGEN: set[str] = set()
CABECERA_Y_PIE = re.compile(
    r'^(?:BOCM|BOLETÍN OFICIAL DE LA COMUNIDAD DE MADRID|B\.O\.C\.M\. Núm\. 169|LUNES 18 DE JULIO DE 2022'
    r'|Pág\. \d+|BOCM-20220718-1)$', re.M)


def en_trozos(t, plano, maximo=4):
    """Un texto que sigue en la página siguiente y que `pdftotext` saca en
    trozos con otras cosas en medio (la etiqueta de la fila, la cabecera de la
    página…): se va quitando el principio más largo que está en el texto
    simple, y así hasta cuatro trozos de 15 letras o más."""
    trozos = 0
    while t:
        a, b = 0, len(t)
        while a < b:
            m = (a + b + 1) // 2
            if t[:m] in plano:
                a = m
            else:
                b = m - 1
        if a < 15 and a < len(t):
            return False
        t, trozos = t[a:], trozos + 1
    return 1 < trozos <= maximo


def comprobar_texto(textos):
    """Cada texto tiene que estar en el texto simple del anexo: letra a letra,
    o con las mismas palabras en una ventana corta (el justificado desordena
    palabras en `pdftotext`), o en la lista de vistos en imagen."""
    # Sin la cabecera y el pie de cada página, que cortan los textos que
    # siguen en la página siguiente
    crudo = re.sub(CABECERA_Y_PIE, '', texto_plano(PDF, PRIMERA, ULTIMA))
    plano = normalizar_para_comparar(crudo)
    fichas = palabras_para_comparar(crudo)
    cuenta = Counter()
    for t in textos:
        if normalizar_para_comparar(t) in plano:
            cuenta['letra a letra'] += 1
            continue
        w = palabras_para_comparar(t)
        hace_falta, largo = Counter(w), len(w) + 12
        if any(all(Counter(fichas[i:i + largo])[k] >= v for k, v in hace_falta.items())
               for i, f in enumerate(fichas) if f == w[0]):
            cuenta['palabras desordenadas'] += 1
        elif en_trozos(normalizar_para_comparar(t), plano):
            cuenta['en trozos'] += 1
        elif t in VISTOS_EN_IMAGEN:
            cuenta['vistos en imagen'] += 1
        else:
            raise SystemExit(f'No está en el texto simple del PDF: {t}')
    return cuenta


def fichas(t):
    return re.findall(r'[^\W\d_]+', t.lower())


# Lo único de las tablas que no pasa a la app: las cabeceras, las viñetas
# («(cid:2)») y el título del bloque I o II de Educación Artística, que se
# repite arriba de cada página
CABECERAS = Counter(fichas('COMPETENCIAS ESPECÍFICAS CRITERIOS DE EVALUACIÓN CONTENIDOS BLOQUES '
                           'CONOCIMIENTOS DESTREZAS Y ACTITUDES PRIMER SEGUNDO TERCER CICLO BLOQUE I II cid'))


def comprobar_que_no_falta_nada(r, en_tablas):
    """Todas las palabras de las tablas tienen que estar en lo extraído (salvo
    las cabeceras): el otro sentido de `comprobar_texto`."""
    extraido = Counter()
    for nombre, a in r.items():
        for por_ciclo in a['competencias'].values():
            for t in por_ciclo.values():
                extraido.update(fichas(t))
        for cs in a['criterios'].values():
            for c in cs:
                extraido.update(fichas(c['texto']))
        for partes in a['contenidos'].values():
            antes = (None, None, None)
            for p in partes:
                if p['superbloque'] != antes[0]:
                    extraido.update(fichas(p['superbloque'][1]) if p['superbloque'] else [])
                if p['bloque'] != antes[1]:
                    extraido.update(fichas(p['bloque']))
                if p['apartado'] and (p['bloque'], p['apartado']) != antes[1:]:
                    extraido.update(fichas(p['apartado']))
                antes = (p['superbloque'], p['bloque'], p['apartado'])
                for i in p['items']:
                    extraido.update(fichas(i['texto']))
    sobran = en_tablas - extraido
    repetidas = Counter(fichas(' '.join(t for _, t in {p['superbloque'] for a in r.values() for ps in a['contenidos'].values() for p in ps if p['superbloque']})))
    fuera = {k: v for k, v in sobran.items() if k not in CABECERAS and k not in repetidas}
    if fuera or extraido - en_tablas:
        raise SystemExit(f'Palabras de las tablas que no están en lo extraído: {fuera}; al revés: {dict(extraido - en_tablas)}')


def textos_de(r):
    for a in r.values():
        for por_ciclo in a['competencias'].values():
            yield from set(por_ciclo.values())
        for cs in a['criterios'].values():
            yield from (c['texto'] for c in cs)
        for partes in a['contenidos'].values():
            for p in partes:
                if p['superbloque']:
                    yield p['superbloque'][1]
                yield p['bloque']
                if p['apartado']:
                    yield p['apartado']
                yield from (i['texto'] for i in p['items'])


def ciclos_de(nombre, ciclo):
    return SIN_CICLOS[nombre][0] if ciclo == TODA_LA_ETAPA else [ciclo]


def saberes(partes):
    """Los contenidos de un ciclo con la forma de la app: bloque con letra y sus
    apartados como epígrafes (sin número: el decreto no los numera). En
    Educación Artística, el bloque es el I o el II y sus epígrafes, los bloques
    con letra que contiene, con la letra delante tal y como está escrito."""
    out = []
    for p in partes:
        if p['superbloque']:
            bloque, titulo = p['superbloque']
            epigrafe = p['bloque']
        else:
            m = re.match(r'^([A-Z])\. (.+)$', p['bloque'])
            bloque, titulo = m.group(1), m.group(2)
            epigrafe = p['apartado']
        if not out or out[-1]['bloque'] != bloque:
            out.append({'bloque': bloque, 'tituloBloque': titulo, 'epigrafes': []})
        eps = out[-1]['epigrafes']
        if not eps or eps[-1]['titulo'] != epigrafe:
            eps.append({'n': None, 'titulo': epigrafe, 'items': []})
        eps[-1]['items'].extend(i['texto'] for i in p['items'])
    return out


def para_la_app(r):
    entradas = []
    for nombre, a in r.items():
        grupos = {}
        for ciclo in a['criterios']:
            for g in ciclos_de(nombre, ciclo):
                grupos[g] = ciclo
        competencias = {g: [{'n': n, 'texto': a['competencias'][n][c]} for n in sorted(a['competencias'])]
                        for g, c in grupos.items()}
        primera = competencias[min(grupos)]
        entrada = {
            'id': AREAS[nombre],
            'area': nombre,
            'competencias': primera,
        }
        # El decreto repite las competencias en cada ciclo y a veces cambia
        # alguna palabra o una coma: entonces van también las de cada ciclo
        if any(cs != primera for cs in competencias.values()):
            entrada['competenciasPorGrupo'] = competencias
        entrada['criterios'] = {g: [{**c, 'codigoLiteral': True} for c in a['criterios'][c]] for g, c in grupos.items()}
        entrada['saberes'] = {g: saberes(a['contenidos'][c]) for g, c in grupos.items()}
        cursos = SIN_CICLOS.get(nombre, (None, None))[1]
        if cursos:
            entrada['cursos'] = cursos
        entradas.append(entrada)
    return entradas


def resumen(r):
    for nombre, a in r.items():
        print(f"== {nombre} (p. {a['pagina']})")
        for n, por_ciclo in sorted(a['competencias'].items()):
            distintos = len(set(por_ciclo.values()))
            print(f"   CE{n}: ciclos {sorted(por_ciclo)}{' (textos distintos)' if distintos > 1 else ''}  {list(por_ciclo.values())[0][:70]}")
        for ciclo, cs in sorted(a['criterios'].items()):
            print(f"   criterios {ciclo}: {len(cs)}  {[c['codigo'] for c in cs]}")
        for ciclo, partes in sorted(a['contenidos'].items()):
            print(f"   contenidos {ciclo}:")
            for p in partes:
                print(f"      {p['superbloque'] or ''}[{p['bloque']}] / [{p['apartado']}]: {len(p['items'])} ({sum(1 for i in p['items'] if i['nivel'] == 1)} de primer nivel)")


if __name__ == '__main__':
    guiones = []
    areas, en_tablas = leer()
    r = estructurar(areas, vocabulario(PDF), guiones)
    comprobar_estructura(r)
    comprobar_que_no_falta_nada(r, en_tablas)
    if '--revisar' in sys.argv:
        resumen(r)
        print('Guiones de final de línea:', ', '.join(sorted(Counter(guiones))))
    cuenta = comprobar_texto(list(textos_de(r)))
    print('Comprobación con el texto simple:', dict(cuenta))
    SALIDA_SCRIPTS.mkdir(exist_ok=True)
    with open(SALIDA_SCRIPTS / 'primaria-61-2022.json', 'w', encoding='utf-8') as f:
        json.dump(r, f, ensure_ascii=False, indent=1)
        f.write('\n')
    SALIDA_APP.mkdir(exist_ok=True)
    with open(SALIDA_APP / 'primaria.es.json', 'w', encoding='utf-8') as f:
        json.dump(para_la_app(r), f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
