"""
Con qué competencias clave se conecta cada competencia específica, según el
decreto del que sale, para llevar las notas de las competencias específicas a
los sectores de la Diana competencial (decisión del dueño, 11-10-2026; ver
docs/COMUNIDADES.md, «Competencias específicas y competencias clave»).

Cada decreto lo dice a su manera:

- Reales Decretos 157/2022 (Primaria) y 217/2022 (ESO), del BOE: al final de
  cada competencia específica, «Esta competencia específica se conecta con los
  siguientes descriptores del Perfil de salida: CCL1, CCL2, STEM4…».
- Madrid, ESO (65/2022): igual, ya leído por `madrid_eso.py` en
  `comunidad-de-madrid/eso-65-2022.json`.
- Madrid, Primaria (61/2022): solo en sus dos áreas propias (Segunda Lengua
  Extranjera y Tecnología y Robótica), con frases distintas («se relaciona»,
  «se vincula», «correlaciona»…). En las demás áreas no lo dice; donde la
  competencia es la misma del Real Decreto 157/2022 (mismo texto), valen los
  descriptores de este, que es el que fija el perfil de salida.
- Comunitat Valenciana (106/2022, 107/2022 y 66/2024): no da descriptores sino
  una tabla por área o materia, «3.3. Relaciones o conexiones con las
  competencias clave», con una X donde la competencia específica se conecta
  con la competencia clave. La columna «CMCT» es la competencia STEM.
  El 96/2026 solo cambió los criterios de evaluación de Primaria (el apartado 6
  de cada área), así que las tablas del 106/2022 siguen vigentes.
- Cataluña (175/2022): no conecta las competencias específicas con las
  competencias clave. Sus materias se quedan sin conexión.

Escribe en cada competencia de los JSON de la app `descriptores`: los
descriptores tal cual («CCL1») o, en la Comunitat Valenciana, la competencia
clave («CCL»). Y, para revisar, `descriptores.json` con de dónde sale cada uno.

    python3 scripts/curriculo/descriptores.py
"""
from __future__ import annotations

import html
import json
import re
import sys
import unicodedata
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DATOS = RAIZ / 'src' / 'lib' / 'curriculum' / 'data'
SCRIPTS = Path(__file__).parent
CACHE = SCRIPTS / '.cache'
REVISION = SCRIPTS / 'descriptores.json'

CLAVE = ('CCL', 'CP', 'STEM', 'CD', 'CPSAA', 'CC', 'CE', 'CCEC')
DESCRIPTOR = re.compile(r'\b(CCL|CP|STEM|CD|CPSAA|CC|CE|CCEC)([1-9])\b')


def normal(s: str) -> str:
    """Para comparar textos de dos fuentes: sin mayúsculas, espacios de más ni puntuación final."""
    s = unicodedata.normalize('NFC', s).replace('­', '').replace('’', "'")
    s = re.sub(r'\s+', ' ', s).strip().lower()
    return re.sub(r'[.;:,\s]+$', '', s)


def parecido(a: str, b: str, prefijo=False) -> float:
    """Lo que se parecen dos enunciados. Con `prefijo`, si uno de los dos es
    solo el principio (la primera línea, como sale de una lectura por líneas),
    se compara con el principio del otro."""
    a, b = normal(a), normal(b)
    if not prefijo:
        return SequenceMatcher(None, a, b).ratio()
    if len(b) < len(a) * 0.8:
        a = a[:len(b)]
    elif len(a) < len(b) * 0.8:
        b = b[:len(a)]
    return SequenceMatcher(None, a, b).ratio()


def descriptores_de(linea: str) -> list[str]:
    """«CCL1, CCL2, STEM4 y CD2.» → ['CCL1', 'CCL2', 'STEM4', 'CD2'], sin repetir y en el orden del texto."""
    vistos: list[str] = []
    for m in DESCRIPTOR.finditer(linea):
        d = m.group(1) + m.group(2)
        if d not in vistos:
            vistos.append(d)
    return vistos


# ── Reales Decretos, del BOE ─────────────────────────────────────────────────

BOE = {'primaria': 'BOE-A-2022-3296', 'eso': 'BOE-A-2022-4975'}


def texto_boe(id_boe: str) -> str:
    CACHE.mkdir(exist_ok=True)
    f = CACHE / f'{id_boe}.html'
    if not f.exists():
        with urllib.request.urlopen(f'https://www.boe.es/buscar/act.php?id={id_boe}', timeout=120) as r:
            f.write_bytes(r.read())
    return f.read_text(encoding='utf-8')


def secciones_boe(id_boe: str) -> list[list[dict]]:
    """Por cada área o materia del anexo, sus competencias específicas en orden:
    número, enunciado y descriptores."""
    parrafos = [(cls, html.unescape(re.sub(r'<[^>]+>', '', t)).strip())
                for cls, t in re.findall(r'<p class="([^"]+)">(.*?)</p>', texto_boe(id_boe), re.S)]
    secciones: list[list[dict]] = []
    actual: list[dict] | None = None
    for cls, t in parrafos:
        if t == 'Competencias específicas.':
            actual = []
            secciones.append(actual)
            continue
        if actual is None:
            continue
        if t.startswith('Criterios de evaluación'):
            actual = None
            continue
        m = re.match(r'^(\d{1,2})\.\s+(\S.*)$', t)
        # El enunciado: «2. Plantear…». En Primaria va con la misma clase que el resto de párrafos
        if m and int(m.group(1)) == len(actual) + 1 and not re.search(r'descriptores del Perfil', t, re.I):
            actual.append({'n': int(m.group(1)), 'texto': m.group(2), 'descriptores': []})
        elif actual and re.search(r'descriptores del Perfil de salida', t, re.I):
            actual[-1]['descriptores'] = descriptores_de(t)
    return [s for s in secciones if s]


# ── Emparejar con la app ─────────────────────────────────────────────────────

def emparejar(app: list[dict], fuentes: list[list[dict]], nombre: str, minimo=0.9, prefijo=False):
    """Para cada materia de la app, la sección de la fuente cuyas competencias
    son las suyas: el mismo número de competencias y los mismos enunciados (o
    casi: el BOE y el decreto autonómico a veces cambian una coma). Devuelve
    {id: [descriptores por competencia]} y lo que no se pudo emparejar."""
    hechos, faltan = {}, []
    for mat in app:
        comps = mat['competencias']
        mejor, nota = None, 0.0
        for s in fuentes:
            if len(s) != len(comps):
                continue
            r = min(parecido(c['texto'], f['texto'], prefijo) for c, f in zip(comps, s))
            if r > nota:
                mejor, nota = s, r
        if mejor is None or nota < minimo or not all(f['descriptores'] for f in mejor):
            faltan.append((mat.get('id') or mat.get('materia') or mat.get('area'), round(nota, 3)))
            continue
        hechos[mat.get('id') or mat.get('materia') or mat.get('area')] = {
            'parecido': round(nota, 3), 'descriptores': [f['descriptores'] for f in mejor]}
    print(f'{nombre}: {len(hechos)} emparejadas, sin emparejar: {faltan}')
    return hechos, faltan


# ── Comunidad de Madrid ──────────────────────────────────────────────────────

MADRID = RAIZ / 'docs' / 'Normativa Comunidad de Madrid'


def secciones_madrid_eso() -> list[list[dict]]:
    """Lo que ya leyó `madrid_eso.py` del anexo II del 65/2022 (Educación en
    Valores no está: la app la toma del Real Decreto 217/2022)."""
    d = json.loads((SCRIPTS / 'comunidad-de-madrid' / 'eso-65-2022.json').read_text())
    # Música CE3 trae «CCE3», errata del Real Decreto 217/2022 que el 65/2022 copia: no es ningún
    # descriptor (¿CE3?, ¿CCEC3?) y no se adivina; se queda fuera, como en el estatal
    return [[{'n': c['n'], 'texto': c['texto'], 'descriptores': [x for x in c['descriptores'] if DESCRIPTOR.fullmatch(x)]}
             for c in m['competencias']] for m in d.values() if m['competencias']]


def secciones_madrid_primaria() -> list[list[dict]]:
    """Las dos áreas propias de Madrid en el 61/2022, Segunda Lengua Extranjera
    (página 99) y Tecnología y Robótica (107), que sí dicen sus descriptores.
    Se lee página a página con pdfplumber: `pdftotext` coloca la línea de
    descriptores de Tecnología y Robótica CE1 detrás del enunciado de la CE2."""
    import pdfplumber
    areas = {'Segunda Lengua Extranjera': (99, 107), 'Tecnología y Robótica': (107, 112)}
    secciones = []
    with pdfplumber.open(MADRID / 'DECRETO 61-2022.pdf') as pdf:
        for nombre, (ini, fin) in areas.items():
            lineas = [l for n in range(ini, fin) for l in (pdf.pages[n - 1].extract_text() or '').split('\n')]
            empieza = next(i for i, l in enumerate(lineas) if 'Descripción de las competencias específicas' in l)
            ces: list[dict] = []
            i = empieza
            while i < len(lineas):
                t = lineas[i]
                if t.startswith('Criterios de evaluación') and ces:
                    break
                m = re.match(r'^(\d{1,2})\.\s+(\S.*)$', t)
                if m and int(m.group(1)) == len(ces) + 1:
                    ces.append({'n': len(ces) + 1, 'texto': m.group(2), 'descriptores': []})
                elif ces and re.search(r'descriptores del perfil de salida', t, re.I):
                    junto = t
                    while not junto.rstrip().endswith('.') and i + 1 < len(lineas):
                        i += 1
                        junto += ' ' + lineas[i]
                    ces[-1]['descriptores'] = descriptores_de(junto)
                i += 1
            print(f'Madrid Primaria, {nombre}: {[len(c["descriptores"]) for c in ces]}')
            secciones.append(ces)
    return secciones


def por_competencia(app: list[dict], fuentes: list[list[dict]], ya: dict, nombre: str, minimo=0.97):
    """Para las materias que no emparejan enteras: cada competencia que es la
    misma que una de la fuente (el mismo texto, salvo una coma o una palabra)
    toma sus descriptores; las demás se quedan sin conexión."""
    todas = [c for s in fuentes for c in s if c['descriptores']]
    hechos = {}
    for mat in app:
        k = clave_de_app(mat)
        if k in ya:
            continue
        lista, cuantas = [], 0
        for c in mat['competencias']:
            mejor = max(todas, key=lambda f: parecido(c['texto'], f['texto']))
            if parecido(c['texto'], mejor['texto']) >= minimo:
                lista.append(mejor['descriptores'])
                cuantas += 1
            else:
                lista.append([])
        if cuantas:
            hechos[k] = {'parecido': None, 'por_competencia': True, 'descriptores': lista}
        print(f'{nombre}, {k}: {cuantas} de {len(lista)} competencias iguales a las del Real Decreto')
    return hechos


# ── Comunitat Valenciana: tablas «3.3. Relaciones o conexiones con las competencias clave» ──

CV = RAIZ / 'docs' / 'Normativa Comunitat Valenciana'
TITULO_33 = re.compile(r'3\.\s?3\.?\s+Rela(?:ciones|cions) o conn?exi(?:ones|ons) (?:con|amb) (?:las|les) competencias? clau?e?|'
                       r'3\.\s?3\.?\s+Rela(?:ciones|cions) o conn?exi(?:ones|ons) (?:con|amb) (?:las|les) compet[eè]nci(?:as|es) clau?e?', re.I)
COLUMNAS = {'CCL': 'CCL', 'CP': 'CP', 'CMCT': 'STEM', 'CTEM': 'STEM', 'STEM': 'STEM', 'CD': 'CD', 'CPSAA': 'CPSAA', 'CC': 'CC', 'CE': 'CE', 'CCEC': 'CCEC'}
FILA = re.compile(r'^CE\s?(\d{1,2})$')


def _palabras(pagina) -> list[dict]:
    return pagina.extract_words(keep_blank_chars=False, use_text_flow=False)


def _cabecera(palabras: list[dict], pagina):
    """La línea con CCL… CCEC y, por columna, de dónde a dónde va: entre las
    líneas verticales de la tabla, porque cada tabla alinea la cabecera y las X
    a su manera (centradas, a la izquierda o pegadas a la derecha). Sin líneas,
    cada columna empieza donde empieza su cabecera."""
    for w in palabras:
        if w['text'] != 'CCL':
            continue
        # En alguna tabla una cabecera va un poco más alta que las demás («CPSAA» en dos líneas)
        linea = [v for v in palabras if abs(v['top'] - w['top']) < 10 and (v['text'] in COLUMNAS or abs(v['top'] - w['top']) < 3)]
        textos = {v['text'] for v in linea}
        if 'CCEC' not in textos or len(textos & set(COLUMNAS)) < 7:
            continue
        cab = sorted([v for v in linea if v['text'] in COLUMNAS], key=lambda v: v['x0'])
        verticales = sorted({round(e['x0']) for e in pagina.edges
                             if e['orientation'] == 'v' and e['top'] <= w['top'] + 2 and e['bottom'] >= w['bottom'] - 2})
        columnas = []
        if len(verticales) >= len(cab):
            for v in cab:
                cx = (v['x0'] + v['x1']) / 2
                izq = max((x for x in verticales if x <= cx), default=None)
                der = min((x for x in verticales if x > cx), default=None)
                if izq is None or der is None:
                    break
                columnas.append((izq, der, COLUMNAS[v['text']]))
        if len(columnas) != len(cab):
            columnas = [(v['x0'] - 2, (cab[k + 1]['x0'] - 2) if k + 1 < len(cab) else v['x0'] + 60, COLUMNAS[v['text']])
                        for k, v in enumerate(cab)]
        return columnas, w['bottom']
    return None, None


def _etiquetas(palabras: list[dict], x_max: float, desde: float) -> list[tuple[int, float]]:
    """Las etiquetas de fila («CE1», «CE 6») a la izquierda de la primera columna, de arriba abajo."""
    out = []
    ws = sorted([w for w in palabras if w['x0'] < x_max and w['top'] > desde], key=lambda w: (w['top'], w['x0']))
    for k, w in enumerate(ws):
        # «CE1», «CE 6» y, en Filosofía (castellano), la errata «C·4» del propio DOGV
        m = re.match(r'^C(?:E|·)\s?(\d{1,2})$', w['text'])
        if not m and w['text'] == 'CE' and k + 1 < len(ws) and ws[k + 1]['text'].isdigit() and abs(ws[k + 1]['top'] - w['top']) < 3:
            m = re.match(r'(\d+)', ws[k + 1]['text'])
        if m:
            out.append((int(m.group(1)), w['top']))
    return out


def tablas_cv(pdf_path: Path, paginas: range | None = None) -> list[dict]:
    """Todas las tablas de conexiones del PDF, en orden: la página donde
    empiezan y, por competencia específica, sus competencias clave.

    Se leen por posición, no con el extractor de tablas: hay celdas de varias
    líneas («CE1 / Multilingüisme i / interculturalitat») con la X centrada, y
    tablas que siguen en la página siguiente sin cabecera ni borde arriba. Cada
    fila va desde su etiqueta hasta la etiqueta siguiente, y cada X es de la
    columna que tiene encima."""
    import pdfplumber
    tablas = []
    with pdfplumber.open(pdf_path) as pdf:
        rango = paginas or range(1, len(pdf.pages) + 1)
        abierta = None
        for n in rango:
            pg = pdf.pages[n - 1]
            texto = pg.extract_text() or ''
            if abierta is None and not ('CCL' in texto and 'CCEC' in texto):
                pg.close()
                continue
            palabras = _palabras(pg)
            columnas, fondo = _cabecera(palabras, pg)
            if columnas:
                if abierta is not None:
                    tablas.append(abierta)
                abierta = {'pagina': n, 'columnas': columnas, 'filas': {}}
                desde = fondo
            elif abierta is not None:
                columnas, desde = abierta['columnas'], 0
            else:
                pg.close()
                continue
            x_min = min(c[0] for c in columnas)
            etiquetas = _etiquetas(palabras, x_min - 12, desde)
            # Solo las que siguen la numeración: en el texto de debajo también salen «CE 1», «CE 2»…
            esperada = (max(abierta['filas']) + 1) if abierta['filas'] else 1
            filas = []
            for num, top in etiquetas:
                if num == esperada and (not filas or top - filas[-1][1] < 90):
                    filas.append((num, top))
                    esperada += 1
                elif filas:
                    break
            if not filas:
                if abierta['filas']:
                    tablas.append(abierta)
                abierta = None
                pg.close()
                continue
            marcas = [w for w in palabras if w['text'] in ('X', 'x') and w['top'] > desde]
            # Cada fila va de una línea horizontal de la tabla a la siguiente: hay tablas con la
            # etiqueta abajo de la celda y las X arriba. Sin líneas, de una etiqueta a la siguiente.
            x_izq, x_der = min(c[0] for c in columnas), max(c[1] for c in columnas)
            lineas_h = sorted({round(e['top']) for e in pg.edges
                               if e['orientation'] == 'h' and e['top'] > desde - 3 and e['x0'] < x_der and e['x1'] > x_izq})
            def franja(top):
                arriba = max((y for y in lineas_h if y <= top + 2), default=None)
                abajo = min((y for y in lineas_h if y > top + 2), default=None)
                return (arriba, abajo) if arriba is not None and abajo is not None and abajo - arriba > 8 else None
            for k, (num, top) in enumerate(filas):
                f = franja(top)
                desde_y, hasta = f if f else (top - 6, filas[k + 1][1] - 4 if k + 1 < len(filas) else top + 45)
                clave = set()
                for w in marcas:
                    cy = (w['top'] + w['bottom']) / 2
                    if not (desde_y <= cy < hasta):
                        continue
                    # Por su borde izquierdo: en algunas tablas la X va pegada a la derecha de su
                    # celda y llega a pisar la línea de la siguiente
                    cx = w['x0'] + 1
                    col = next((nombre for izq, der, nombre in columnas if izq <= cx < der), None)
                    if col:
                        clave.add(col)
                abierta['filas'][num] = [c for c in CLAVE if c in clave]
            pg.close()
        if abierta is not None and abierta['filas']:
            tablas.append(abierta)
    return tablas


def tablas_de_materia(pdf_path: Path, paginas: tuple[int, int], n: int) -> list[dict]:
    """Las tablas de conexiones dentro de las páginas de una materia que tienen
    exactamente sus `n` competencias específicas."""
    ini, fin = paginas
    return [t for t in tablas_cv(pdf_path, range(max(1, ini - 2), fin + 1)) if sorted(t['filas']) == list(range(1, n + 1))]


def cv_eso(app_es: list[dict]) -> dict:
    """Por materia de la ESO valenciana: la tabla en castellano y en valenciano
    (las dos son oficiales), y si dicen lo mismo."""
    sys.path.insert(0, str(SCRIPTS))
    import eso_cv
    n_ce = {m['id']: len(m['competencias']) for m in app_es}
    out = {}
    for mat in eso_cv.MATERIAS:
        ids = ['valenciano', 'lengua-castellana'] if mat['id'] == 'lenguas' else [mat['id']]
        n = n_ce[ids[0]]
        pdf = eso_cv.PDF[mat['fuente']]
        por_idioma = {}
        for idioma in ('es', 'va'):
            ts = tablas_de_materia(pdf, mat['paginas'][idioma], n)
            if ts:
                por_idioma[idioma] = {'pagina': ts[0]['pagina'], 'filas': [ts[0]['filas'][k] for k in range(1, n + 1)]}
        for i in ids:
            out[i] = {'fuente': mat['fuente'], **por_idioma}
        print(f"CV ESO {mat['id']:38s} es: {por_idioma.get('es', {}).get('pagina', '—')!s:5} va: {por_idioma.get('va', {}).get('pagina', '—')!s:5}"
              + ('' if len(por_idioma) < 2 else ('  iguales' if por_idioma['es']['filas'] == por_idioma['va']['filas'] else '  DISTINTAS')), flush=True)
    return out


def clave_de_app(mat: dict) -> str:
    return mat.get('id') or mat.get('materia') or mat.get('area')


# ── Escribir en la app ───────────────────────────────────────────────────────

def guardar_como_estaba(archivo: Path, datos) -> None:
    """Con el mismo formato que tenía el archivo: en una línea, o con la sangría que usaba."""
    texto = archivo.read_text(encoding='utf-8')
    if texto.count('\n') <= 1:
        nuevo = json.dumps(datos, ensure_ascii=False, separators=(',', ':'))
    else:
        sangria = len(texto.split('\n')[1]) - len(texto.split('\n')[1].lstrip(' '))
        nuevo = json.dumps(datos, ensure_ascii=False, indent=sangria)
    archivo.write_text(nuevo + ('\n' if texto.endswith('\n') else ''), encoding='utf-8')


def poner(archivo: Path, por_materia: dict[str, list[list[str]]], revision: dict, origen: dict[str, str]) -> None:
    """Escribe `descriptores` en cada competencia de las materias que los tienen;
    las demás se quedan sin el campo."""
    datos = json.loads(archivo.read_text(encoding='utf-8'))
    for mat in datos:
        k = clave_de_app(mat)
        lista = por_materia.get(k)
        for c in mat['competencias']:
            c.pop('descriptores', None)
            if lista and c['n'] - 1 < len(lista) and lista[c['n'] - 1]:
                c['descriptores'] = lista[c['n'] - 1]
        con = sum(1 for c in mat['competencias'] if c.get('descriptores'))
        revision.setdefault(str(archivo.relative_to(RAIZ)), {})[k] = {
            'origen': origen.get(k, 'sin conexión en el decreto'),
            'competencias': len(mat['competencias']), 'con_descriptores': con,
            'descriptores': [c.get('descriptores', []) for c in mat['competencias']]}
    guardar_como_estaba(archivo, datos)


# Materias de la ESO valenciana en las que la tabla de una de las dos lenguas no se puede leer tal cual
CV_ESO_USAR = {
    # En valenciano las X de la columna CC se salen de su celda y la página las recorta: no se ven.
    # La tabla castellana las tiene y su texto lo confirma («todas las competencias de la materia están
    # directamente vinculadas con la CC»)
    'filosofia': 'es',
}
# Sin tabla en ninguna de las dos lenguas: lo cuentan para la materia entera o por competencia clave en
# párrafos, sin decir competencia por competencia. No se interpreta
CV_ESO_SIN = {'expresion-artistica', 'laboratorio-de-creacion-audiovisual'}
CV_PRIMARIA = ['conocimiento-del-medio', 'musica-y-danza', 'educacion-plastica-y-visual', 'educacion-fisica',
               'lenguas', 'lengua-extranjera', 'matematicas', 'educacion-en-valores']


def lista_de(filas: dict, n: int) -> list[list[str]]:
    return [filas[str(k)] if str(k) in filas else filas[k] for k in range(1, n + 1)]


if __name__ == '__main__':
    revision: dict = {}
    boe = {etapa: secciones_boe(BOE[etapa]) for etapa in BOE}

    # Estatal
    for etapa, archivo in (('primaria', DATOS / 'primaria.json'), ('eso', DATOS / 'eso.json')):
        app = json.loads(archivo.read_text())
        hechos, _ = emparejar(app, boe[etapa], f'estatal {etapa}')
        poner(archivo, {k: v['descriptores'] for k, v in hechos.items()}, revision,
              {k: f"Real Decreto {'157' if etapa == 'primaria' else '217'}/2022" for k in hechos})

    # Madrid
    archivo = DATOS / 'madrid' / 'eso.es.json'
    app = json.loads(archivo.read_text())
    propias = secciones_madrid_eso()
    hechos, _ = emparejar(app, propias + boe['eso'], 'Madrid ESO')
    origen = {k: ('Decreto 65/2022' if any(s[0]['texto'] == f['texto'] for s in propias for f in v_s[:1]) else 'Real Decreto 217/2022')
              for k, v_s in ((k, [{'texto': app_m['competencias'][0]['texto']}]) for k in hechos for app_m in app if clave_de_app(app_m) == k)}
    poner(archivo, {k: v['descriptores'] for k, v in hechos.items()}, revision, origen)

    archivo = DATOS / 'madrid' / 'primaria.es.json'
    app = json.loads(archivo.read_text())
    hechos, _ = emparejar(app, secciones_madrid_primaria(), 'Madrid Primaria, áreas propias', prefijo=True)
    origen = {k: 'Decreto 61/2022' for k in hechos}
    for k, v in por_competencia(app, boe['primaria'], hechos, 'Madrid Primaria').items():
        hechos[k] = v
        origen[k] = 'Real Decreto 157/2022, solo las competencias con el mismo texto'
    poner(archivo, {k: v['descriptores'] for k, v in hechos.items()}, revision, origen)

    # Comunitat Valenciana, ESO: la tabla de cada lengua en su archivo; si una lengua no la tiene, la de la otra
    cv_cache = CACHE / 'cv-eso.json'
    cv = json.loads(cv_cache.read_text()) if cv_cache.exists() and '--releer' not in sys.argv \
        else cv_eso(json.loads((DATOS / 'comunitat-valenciana' / 'eso.es.json').read_text()))
    cv_cache.write_text(json.dumps(cv, ensure_ascii=False, indent=1))
    for idioma, codigo in (('es', 'es'), ('va', 'ca')):
        archivo = DATOS / 'comunitat-valenciana' / f'eso.{codigo}.json'
        por_materia, origen = {}, {}
        for k, t in cv.items():
            if k in CV_ESO_SIN:
                continue
            usar = CV_ESO_USAR.get(k) or (idioma if idioma in t else ('va' if idioma == 'es' else 'es'))
            if usar not in t:
                continue
            por_materia[k] = t[usar]['filas']
            norma = 'Decreto 66/2024' if t['fuente'] == '66' else 'Decreto 107/2022'
            origen[k] = f"{norma}, tabla 3.3 en {'castellano' if usar == 'es' else 'valenciano'} (p. {t[usar]['pagina']})"
        poner(archivo, por_materia, revision, origen)

    # Comunitat Valenciana, Primaria: una tabla por área del 106/2022, en el orden del anexo III
    tablas = json.loads((CACHE / 'cv-primaria-tablas.json').read_text())
    for idioma, codigo in (('es', 'es'), ('va', 'ca')):
        archivo = DATOS / 'comunitat-valenciana' / f'primaria.{codigo}.json'
        app = {clave_de_app(m): len(m['competencias']) for m in json.loads(archivo.read_text())}
        por_materia, origen = {}, {}
        for area, t in zip(CV_PRIMARIA, tablas[idioma]):
            for k in (['valenciano', 'lengua-castellana'] if area == 'lenguas' else [area]):
                # Música y Danza: el 106/2022 tenía 5 competencias y la app lleva las 4 del 96/2026, que son
                # sus CE1 a CE4 con el mismo texto
                por_materia[k] = lista_de(t['filas'], app[k])
                origen[k] = f"Decreto 106/2022, tabla 3.3 (p. {t['pagina']})"
        poner(archivo, por_materia, revision, origen)

    # Cataluña: el Decret 175/2022 no conecta las competencias específicas con las competencias clave
    for codigo in ('primaria', 'eso'):
        poner(DATOS / 'cataluna' / f'{codigo}.ca.json', {}, revision, {})

    REVISION.write_text(json.dumps(revision, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    for archivo, mats in revision.items():
        total = sum(m['competencias'] for m in mats.values())
        con = sum(m['con_descriptores'] for m in mats.values())
        print(f'{archivo}: {con} de {total} competencias con su conexión')
