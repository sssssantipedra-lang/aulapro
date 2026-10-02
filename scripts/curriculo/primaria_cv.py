"""
Construye el currículo de Primaria de la Comunitat Valenciana que lleva la app:
`src/lib/curriculum/data/comunitat-valenciana/primaria.es.json`.

Fuentes, en `docs/Normativa Comunitat Valenciana/` (ver `docs/COMUNIDADES.md`):

- Decreto 96/2026: competencias específicas (el enunciado que encabeza cada
  tabla) y criterios de evaluación de los tres ciclos. Se extraen antes con
  `criterios_dogv_tablas.py` a `comunitat-valenciana/criterios-96-2026.es.json`.
- Decreto 106/2022, anexo III: los saberes básicos de todas las áreas y lo que
  el 96/2026 no toca, Educación en Valores Cívicos y Éticos entera. Ante
  cualquier diferencia entre los dos decretos, manda el 96/2026 (decisión del
  dueño, 2-10-2026).

Los saberes se leen con `saberes_dogv_tablas.py` en las dos lenguas. La versión
en valenciano sirve aquí para comprobar la castellana (mismos bloques, mismos
subbloques, mismo número de saberes) y queda guardada para cuando llegue el
96/2026 en valenciano. Las X de ciclo no se recogen: cada bloque lleva todos sus
saberes en los tres ciclos (decisión del dueño, 2-10-2026).

Uso:
    python3 scripts/curriculo/primaria_cv.py            # escribe los JSON
    python3 scripts/curriculo/primaria_cv.py --revisar  # además, imprime la estructura

Dependencias: las de `saberes_dogv_tablas.py` y `pdftotext` (poppler-utils).
"""
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

import pdfplumber

sys.path.insert(0, str(Path(__file__).parent))
from saberes_dogv_tablas import GUION_DE_LINEA, extraer, lineas_de  # noqa: E402

RAIZ = Path(__file__).resolve().parents[2]
NORMATIVA = RAIZ / 'docs' / 'Normativa Comunitat Valenciana'
PDF = {'es': NORMATIVA / 'ANEXO 1-3 106-2022.pdf', 'va': NORMATIVA / 'ANNEX 1-3 106-2022.pdf'}
SALIDA_SCRIPTS = Path(__file__).parent / 'comunitat-valenciana'
CRITERIOS_96 = SALIDA_SCRIPTS / 'criterios-96-2026.es.json'
SALIDA_APP = RAIZ / 'src' / 'lib' / 'curriculum' / 'data' / 'comunitat-valenciana'
PAGINAS_VALORES = ((214, 220), (205, 211))

# Páginas de los saberes básicos de cada área en cada PDF (es, va), y cómo se
# reparten en la app: `subbloques` (el epígrafe es el subbloque), `grupos` (el
# epígrafe es el grupo: el área tiene un solo subbloque por bloque) o `tablas`
# (Matemáticas: cada tabla del bloque es un epígrafe).
AREAS = {
    'conocimiento-del-medio': {'paginas': ((28, 38), (27, 37)), 'epigrafes': 'subbloques'},
    'musica-y-danza': {'paginas': ((56, 61), (53, 59)), 'epigrafes': 'subbloques'},
    'educacion-plastica-y-visual': {'paginas': ((78, 86), (74, 81)), 'epigrafes': 'subbloques'},
    'educacion-fisica': {'paginas': ((101, 114), (95, 107)), 'epigrafes': 'grupos'},
    'lenguas': {'paginas': ((133, 144), (128, 139)), 'epigrafes': 'subbloques'},
    'lengua-extranjera': {'paginas': ((162, 171), (156, 164)), 'epigrafes': 'grupos'},
    'matematicas': {'paginas': ((187, 197), (179, 189)), 'epigrafes': 'tablas'},
}

# Matemáticas no titula sus bloques («4.2. Bloque 1.»): el título sale de la
# enumeración de «sentidos» de su introducción (apartado 4.1), en ese orden.
TITULOS_MATEMATICAS = {
    'es': ['Sentido numérico y de las operaciones', 'Sentido de la medida', 'Sentido espacial y geométrico',
           'Sentido de incertidumbre y probabilidad', 'Sentido de análisis de datos y estadística',
           'Sentido de pensamiento computacional'],
    'va': ['Sentit numèric i de les operacions', 'Sentit de la mesura', 'Sentit espacial i geomètric',
           "Sentit d'incertesa i probabilitat", "Sentit d'anàlisi de dades i estadística",
           'Sentit de pensament computacional'],
}

BLOQUE = re.compile(r'^\d\s?\.\s?\d\s?\.?\s*(?:Bloque|Bloc)\s*(\d+)\s*[:.]?\s*(.*?)\.?$')
GRUPO_G = re.compile(r'^G\s?(\d+)\s*\.?\s*(.*)$')
CABECERA_TABLA_MATES = re.compile(r'^SABER(?:E)?S B[ÀÁ]SIC(?:O)?S$')

# Etiquetas de ciclo de las cabeceras: «1.º y 2.º», «3º. y 4.º», «5ª y 6ª»,
# «(cursos 1.º y 2.º)», «1r i 2n», «5é i 6é»…
ETIQUETA_CICLO = re.compile(
    r'\(?\s*(?:cursos\s*)?\d\.?\s?[ºª]\.?\s*(?:y|i)\s*\d\.?\s?[ºª]\.?\s*\)?'
    r'|\b\d(?:r|n|t|é)\s+i\s+\d(?:r|n|t|é)\b'
    r'|\(\s*cursos\b|\b\d\.?\s?[ºª]\s*\)'
    r'|\b\d\s?\.?\s?(?:er|º|r|n)?\s*(?:ciclo|cicle)\b'
)
# Competencias vinculadas: «CE1, CE2, CE3 y CE5», «C2, C6 y C7»
COMPETENCIAS = re.compile(r'[,:]?\s*\b(?:CE|C)\s?\d+\b(?:\s*(?:,|y|i)\s*\b(?:CE|C)\s?\d+\b)*\.?')
TRANSVERSAL = re.compile(r'[.:]?\s*[Tt]ransversal a (?:todas las|totes les) (?:CE|competencias|competències)\.?')
# Fin de los saberes: el apartado 5 (situaciones de aprendizaje) o el 6 (criterios)
FIN_SABERES = re.compile(r'^[56]\s?\.\s*(?:Situaciones de aprendizaje|Situacions d|Criterios de evaluación|Criteris d)')
# Código del subbloque: «1.1», «3. 3.», «SB1.1 -», «SB2-1-», «B.1.1.», «B1.2.»,
# «Subbloque 2.1.», o «B1.» en Educación Física (que es el bloque entero).
CODIGO_SUBBLOQUE = re.compile(
    r'^(?:Subbloque|Subbloc)?\s*(?:SB|B\.?)?\s*(\d)(?:\s?[.\-]\s?(\d))?\s?[.\-]?\s*[-–]?\s*'
)


def limpiar_cabecera(texto: str) -> str:
    texto = ETIQUETA_CICLO.sub(' ', texto)
    texto = TRANSVERSAL.sub('', texto)
    texto = COMPETENCIAS.sub('', texto)
    return re.sub(r'\s+', ' ', texto).strip().rstrip(',;: ')


# Trozos de etiquetas de ciclo que quedan sueltos cuando la cabecera mezcla
# las tres columnas en una línea: «(cursos 1r (cursos 3r (cursos i 2n) i 4t)…»
TROZO_DE_ETIQUETA = re.compile(r'^\(?(?:cursos|\d(?:r|n|t|é)|\d\.?\s?[ºª]\.?|y|i)?\)?[.,;:]?$')


def es_ruido_de_cabecera(texto: str) -> bool:
    return all(TROZO_DE_ETIQUETA.match(p) for p in limpiar_cabecera(texto).split())


# Fila que, sin estar marcada como cabecera, es el título de una: en las
# lenguas, la celda del título ocupa la fila del medio de una cabecera de tres.
PARECE_TITULO = re.compile(r'^(?:Subbloque|Subbloc|SB\s?\d|B\.?\d|\d\s?\.\s?\d)|\b(?:CE|C)\s?\d+\b')


def estructurar(eventos: list[dict]) -> list[dict]:
    """De los eventos de las páginas a bloques > subbloques > grupos > saberes."""
    bloques: list[dict] = []
    sub = grupo = None
    piezas: list[str] | None = None  # filas de la cabecera en curso
    eventos = [e for e in eventos if e['tipo'] in ('texto', 'cabecera', 'grupo', 'saber')]

    def abrir_subbloque(pagina):
        """Cierra la cabecera en curso. Si trae un título nuevo, empieza un
        subbloque; si no (una tabla que sigue en otra página y repite la
        cabecera, o solo los encabezados de ciclo), sigue el que había."""
        nonlocal piezas, sub, grupo
        titulo = limpiar_cabecera(' '.join(piezas))
        piezas = None
        if sub is None or (titulo and titulo != sub['cabecera']):
            sub = {'cabecera': titulo or None, 'grupos': [], 'pagina': pagina}
            bloques[-1]['subbloques'].append(sub)
            grupo = None

    def nuevo_grupo(titulo):
        nonlocal grupo
        grupo = {'titulo': titulo, 'saberes': []}
        sub['grupos'].append(grupo)

    for e in eventos:
        t = e['texto'].strip()
        if e['tipo'] == 'texto':
            if FIN_SABERES.match(t):
                break
            m = BLOQUE.match(t)
            if m:
                bloques.append({'n': int(m.group(1)), 'titulo': m.group(2).strip() or None, 'subbloques': []})
                sub = grupo = None
                piezas = None
            continue
        if not bloques:
            continue
        if e['tipo'] == 'cabecera':
            if piezas is None:
                piezas = []
            if t and t not in piezas:
                piezas.append(t)
            continue
        if piezas is not None:
            titulo = limpiar_cabecera(' '.join(piezas))
            if not titulo and e['tipo'] == 'saber' and PARECE_TITULO.search(t):
                piezas.append(t)
                continue
            if es_ruido_de_cabecera(t):
                continue
            if CABECERA_TABLA_MATES.match(titulo) or (not titulo and sub is None and e['tipo'] == 'grupo'):
                # Matemáticas: la cabecera de cada tabla es «SABERES BÁSICOS»
                # (o solo los encabezados de ciclo) y su título, la fila
                # siguiente («NÚMEROS NATURALES»).
                piezas = [t]
                abrir_subbloque(e['pagina'])
                continue
            abrir_subbloque(e['pagina'])
        if not t or es_ruido_de_cabecera(t):
            continue
        if sub is None:
            sub = {'cabecera': None, 'grupos': [], 'pagina': e['pagina']}
            bloques[-1]['subbloques'].append(sub)
        if e['tipo'] == 'grupo':
            nuevo_grupo(t)
            continue
        # Un saber que empieza en minúscula sigue al anterior: la celda se
        # partió entre dos páginas.
        if grupo and grupo['saberes'] and re.match(r'^[a-zà-ÿ]', t):
            grupo['saberes'][-1] += ' ' + t
            continue
        if grupo is None:
            nuevo_grupo(None)
        grupo['saberes'].append(t)
    return bloques


def texto_plano(pdf: Path, primera: int = 1, ultima: int | None = None) -> str:
    """El texto del PDF con `pdftotext` sin opciones: un camino independiente
    del de las tablas, con el que se comprueba lo extraído."""
    args = ['pdftotext', '-f', str(primera)] + (['-l', str(ultima)] if ultima else []) + [str(pdf), '-']
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def vocabulario(pdf: Path) -> Counter:
    """Las palabras del anexo tal y como están en el PDF, sin las partidas por
    un guion al final de la línea. No sale de `pdftotext`, que quita ese guion
    por su cuenta (deja «figurafondo» donde el decreto dice «figura-fondo»)."""
    vocab: Counter = Counter()
    with pdfplumber.open(pdf) as doc:
        for p in doc.pages:
            for w in p.extract_words(x_tolerance=1.5, y_tolerance=2):
                if not w['text'].endswith('-'):
                    for t in re.findall(r"[\w·-]+", w['text']):
                        vocab[t.lower()] += 1
    return vocab


ENCLITICO = re.compile(r"^(?:lo|la|los|les|li|hi|ho|ne|se|me|te|nos|vos|se)\b", re.I)


def resolver_guiones(texto: str, vocab: Counter, decisiones: list) -> str:
    """Un guion al final de línea puede partir una palabra («instru-» +
    «mentals») o ser de una palabra compuesta («figura-» + «fondo»). Se
    decide con el vocabulario del propio anexo."""
    def nucleo(w):
        partes = re.findall(r"[\w·-]+", w)
        return partes[-1].lower() if partes else ''

    def cambiar(m):
        a, b = m.group(1), m.group(2)
        con, unida = f'{a}-{b}', a + b
        n_a = nucleo(a)
        n_b = re.findall(r"[\w·]+", b)[0].lower() if re.findall(r"[\w·]+", b) else ''
        if vocab[nucleo(con)]:
            r, por = con, 'compuesta en el anexo'
        elif vocab[nucleo(unida)]:
            r, por = unida, 'entera en el anexo'
        elif ENCLITICO.match(b):
            r, por = con, 'pronombre enclítico'
        elif len(n_a) > 2 and len(n_b) > 2 and vocab[n_a] and vocab[n_b]:
            r, por = con, 'dos palabras'
        else:
            r, por = unida, 'sin pistas: se une'
        decisiones.append((m.group(0).replace(GUION_DE_LINEA, '|'), r, por))
        return r
    return re.sub(r'(\S*)' + GUION_DE_LINEA + r'(\S*)', cambiar, texto)


def forma(bloques):
    """Lo que tiene que coincidir entre las dos lenguas: cuántos bloques,
    subbloques, grupos y saberes hay, y dónde."""
    return [[[len(g['saberes']) for g in s['grupos']] for s in b['subbloques']] for b in bloques]


def diferencias(es, va):
    fe, fv = forma(es), forma(va)
    if len(fe) != len(fv):
        return [f'{len(fe)} bloques en castellano y {len(fv)} en valenciano']
    out = []
    for i, (be, bv) in enumerate(zip(fe, fv)):
        if len(be) != len(bv):
            out.append(f'bloque {i + 1}: {len(be)} subbloques en castellano y {len(bv)} en valenciano')
            continue
        for j, (se, sv) in enumerate(zip(be, bv)):
            if se != sv:
                out.append(f'bloque {i + 1}, subbloque {j + 1}: saberes por grupo {se} y {sv}')
    return out


def resumen(bloques):
    for b in bloques:
        print(f"  Bloque {b['n']}: {b['titulo']}")
        for s in b['subbloques']:
            print(f"    [{s['cabecera']}]  (p. {s['pagina']})")
            for g in s['grupos']:
                print(f"      {g['titulo']!s:.70}: {len(g['saberes'])}")


# Las áreas de la app, en el orden del artículo 9 (redacción del 96/2026), con
# su nombre de ese artículo y de dónde salen. Las dos lenguas oficiales
# comparten currículo en el anexo III y tabla de criterios en el 96/2026.
# Religión no tiene currículo en el decreto y no está aquí.
APP = [
    ('conocimiento-del-medio', 'Conocimiento del Medio Natural, Social y Cultural',
     'conocimiento-del-medio', 'Conocimiento del medio natural, social y cultural'),
    ('educacion-plastica-y-visual', 'Educación Plástica y Visual',
     'educacion-plastica-y-visual', 'Educación Plástica y Visual'),
    ('musica-y-danza', 'Música y Danza', 'musica-y-danza', 'Música y Danza'),
    ('educacion-fisica', 'Educación Física', 'educacion-fisica', 'Educación Física'),
    ('valenciano', 'Valenciano: Lengua y Literatura',
     'lenguas', 'Valenciano: Lengua y Literatura y Lengua Castellana y Literatura'),
    ('lengua-castellana', 'Lengua Castellana y Literatura',
     'lenguas', 'Valenciano: Lengua y Literatura y Lengua Castellana y Literatura'),
    ('lengua-extranjera', 'Lengua Extranjera', 'lengua-extranjera', 'Lengua Extranjera'),
    ('matematicas', 'Matemáticas', 'matematicas', 'Matemáticas'),
    ('educacion-en-valores', 'Educación en Valores Cívicos y Éticos', 'valores', None),
]

# Saberes que el texto simple de `pdftotext` no reproduce ni siquiera con las
# palabras desordenadas (pierde palabras en líneas muy justificadas o separa
# el «G1» de su título). Se compararon uno a uno con la imagen de la página y
# están bien. Si aparece uno nuevo, el programa se para.
VISTOS_EN_IMAGEN = {
    'es': {
        'Procedimientos y métodos guiados para la experimentación',
        'G1 Sonido y silencio', 'G1 Interpretación y técnica vocal', 'G1 Representación',
        'Materiales y soportes. Material reciclado. Criterios de sostenibilidad.',
        'La frecuencia cardíaca y respiratoria como consecuencia del esfuerzo realizado.',
        'Funciones comunicativas básicas adecuadas al ámbito y al contexto comunicativo: saludos, despedidas y '
        'presentaciones; descripción de personas, objetos y lugares; situar acontecimientos en el tiempo; '
        'petición e intercambio de información sobre cuestiones cotidianas; rutinas; indicaciones e '
        'instrucciones; expresión de la pertenencia y la cantidad.',
        'Iniciación a convenciones ortográficas elementales.',
    },
    'va': {
        "Utilització de materials, eines i objectes d'ús escolar segur.",
        'Consciència de les possibilitats i limitacions personals.',
        'Contribució de la humanitat al desenvolupament numèric incorporant la perspectiva de gènere.',
    },
}


def normalizar_para_comparar(t: str) -> str:
    t = re.sub(r'(?<!\S)[xX•](?!\S)', ' ', t).replace(GUION_DE_LINEA, '')
    return re.sub(r'[\s\-‐]+', '', t)


def palabras(t: str) -> list[str]:
    t = t.replace(GUION_DE_LINEA, '').replace('-', ' ')
    return [w for w in (re.sub(r'[.,;:]', '', x) for x in re.findall(r"[\w·’'/()]+[.,;:]?", t)) if w]


def comprobar_texto(textos: list[str], pdf: Path, primera: int, ultima: int, idioma: str) -> Counter:
    """Cada texto tiene que estar en el texto simple de esas páginas: letra a
    letra, o con las mismas palabras en una ventana corta (el justificado
    desordena palabras en `pdftotext`), o en la lista de vistos en imagen."""
    crudo = texto_plano(pdf, primera, ultima)
    plano = normalizar_para_comparar(crudo)
    fichas = palabras(re.sub(r'(?<!\S)[xX•](?!\S)', ' ', crudo))
    cuenta: Counter = Counter()
    for t in textos:
        if normalizar_para_comparar(t) in plano:
            cuenta['letra a letra'] += 1
            continue
        w = palabras(t)
        hace_falta, largo = Counter(w), len(w) + 12
        if any(all(Counter(fichas[i:i + largo])[k] >= v for k, v in hace_falta.items())
               for i, f in enumerate(fichas) if f == w[0]):
            cuenta['palabras desordenadas'] += 1
        elif t in VISTOS_EN_IMAGEN[idioma]:
            cuenta['vistos en imagen'] += 1
        else:
            raise SystemExit(f'No está en el texto simple del PDF ({idioma}, págs. {primera}-{ultima}): {t}')
    return cuenta


def valores(idioma: str) -> tuple[list[dict], list[dict], dict]:
    """Educación en Valores: los saberes son una lista (bloque, «-» epígrafe,
    «o» saber) y los criterios, solo de tercer ciclo, van en texto corrido."""
    primera, ultima = PAGINAS_VALORES[0 if idioma == 'es' else 1]
    lineas = []
    with pdfplumber.open(PDF[idioma]) as doc:
        for n in range(primera, ultima + 1):
            p = doc.pages[n - 1]
            ws = [w for w in p.extract_words(x_tolerance=1.5, y_tolerance=2) if 120 < w['top'] < p.height - 60]
            lineas += [(n, l) for l in lineas_de(ws)]
    bloques: list[dict] = []
    competencias: list[dict] = []
    criterios: dict = {}
    zona = None
    # Las viñetas «o», que van un poco más bajas que la primera línea de su saber
    marcas = [(n, l['top']) for n, l in lineas if l['texto'].strip() == 'o']
    for n, l in lineas:
        t = l['texto'].strip()
        if re.match(r'^[45]\s?\.\s*(?:Saberes|Sabers|Situaciones|Situacions)', t):
            zona = 'saberes' if t.startswith('4') else None
            continue
        if re.match(r'^6\s?\.\s*(?:Criterios|Criteris)', t):
            zona = 'criterios'
            continue
        if zona == 'saberes':
            m = BLOQUE.match(t)
            if m:
                bloques.append({'n': int(m.group(1)), 'titulo': m.group(2).strip(), 'epigrafes': []})
                continue
            if not bloques:
                continue
            if t == 'o':
                continue
            if t.startswith('- '):
                bloques[-1]['epigrafes'].append({'titulo': t[2:].strip(), 'items': []})
                continue
            ep = bloques[-1]['epigrafes'][-1]
            if any(pn == n and -3 < mt - l['top'] < 8 for pn, mt in marcas):
                ep['items'].append(t)
            else:
                ep['items'][-1] += ' ' + t
        elif zona == 'criterios':
            m = re.match(r'^6\.\d+\.\s*(?:Competencia específica|Competència específica)\s*(\d+)\.?$', t)
            if m:
                competencias.append({'n': int(m.group(1)), 'texto': ''})
                continue
            if re.match(r'^3\s?[º.r]+\s*(?:ciclo|cicle)$', t):
                continue
            m = re.match(r'^(\d+)\.(\d+)\.\s+(.*)$', t)
            if m and competencias and int(m.group(1)) == competencias[-1]['n']:
                criterios.setdefault('3', []).append({
                    'codigo': f'{m.group(1)}.{m.group(2)}', 'competencia': int(m.group(1)),
                    'texto': m.group(3), 'codigoLiteral': True,
                })
            elif criterios.get('3') and criterios['3'][-1]['competencia'] == competencias[-1]['n']:
                criterios['3'][-1]['texto'] += ' ' + t
            else:
                competencias[-1]['texto'] = (competencias[-1]['texto'] + ' ' + t).strip()
    return bloques, competencias, criterios


def sin_codigo(titulo: str) -> tuple[int | None, str]:
    """«1.1 Iniciación a la actividad científica.» → (1, «Iniciación a la actividad científica»)"""
    m = CODIGO_SUBBLOQUE.match(titulo)
    n = None
    if m:
        n = int(m.group(2) or m.group(1))
        titulo = titulo[m.end():]
    m = GRUPO_G.match(titulo)
    if m:
        n, titulo = int(m.group(1)), m.group(2)
    return n, titulo.strip().rstrip('.').strip()


def frase(titulo: str) -> str:
    """«ESTIMACIÓN Y MEDICIÓN. MAGNITUDES Y UNIDADES.» → «Estimación y medición. Magnitudes y unidades»"""
    t = titulo.strip().rstrip('.').lower()
    return re.sub(r'(^|\.\s+)(\w)', lambda m: m.group(1) + m.group(2).upper(), t)


def saberes_para_la_app(area: str, bloques: list[dict], idioma: str) -> list[dict]:
    modo = AREAS[area]['epigrafes']
    out = []
    for i, b in enumerate(bloques):
        titulo = b['titulo']
        epigrafes = []
        if modo == 'grupos':
            if not titulo:  # Educación Física: el título va en la cabecera de la tabla
                titulo = sin_codigo(b['subbloques'][0]['cabecera'])[1]
            for s in b['subbloques']:
                for k, g in enumerate(s['grupos']):
                    n, t = sin_codigo(g['titulo'])
                    epigrafes.append({'n': n or k + 1, 'titulo': t, 'items': g['saberes']})
        else:
            if modo == 'tablas':
                titulo = TITULOS_MATEMATICAS[idioma][i]
            for k, s in enumerate(b['subbloques']):
                n, t = sin_codigo(s['cabecera'])
                epigrafes.append({
                    'n': n if modo == 'subbloques' and n else k + 1,
                    'titulo': frase(t) if modo == 'tablas' else t,
                    'items': [x for g in s['grupos'] for x in g['saberes']],
                })
        out.append({'bloque': str(b['n']), 'tituloBloque': titulo, 'epigrafes': epigrafes})
    return out


def limpiar_enunciado(t: str) -> str:
    # La extracción por coordenadas deja un espacio antes de algún signo
    # («vivencial .»); el texto del decreto no lo tiene.
    return re.sub(r'\s+([.,;:])', r'\1', re.sub(r'\s+', ' ', t)).strip()


def construir(revisar: bool = False) -> None:
    estructuras: dict = {}
    informe: dict = {}
    for idioma in ('es', 'va'):
        vocab = vocabulario(PDF[idioma])
        decisiones: list = []
        cuenta: Counter = Counter()
        for area, conf in AREAS.items():
            primera, ultima = conf['paginas'][0 if idioma == 'es' else 1]
            bloques = estructurar(extraer(str(PDF[idioma]), primera, ultima))
            for b in bloques:
                for s in b['subbloques']:
                    s['cabecera'] = resolver_guiones(s['cabecera'] or '', vocab, decisiones) or None
                    for g in s['grupos']:
                        g['titulo'] = g['titulo'] and resolver_guiones(g['titulo'], vocab, decisiones)
                        g['saberes'] = [resolver_guiones(x, vocab, decisiones) for x in g['saberes']]
            textos = [t for b in bloques for s in b['subbloques'] for g in s['grupos']
                      for t in ([g['titulo']] if g['titulo'] else []) + g['saberes']]
            cuenta += comprobar_texto(textos, PDF[idioma], primera, ultima, idioma)
            estructuras[(area, idioma)] = bloques
            if revisar:
                print(f'== {area} ({idioma})')
                resumen(bloques)
        informe[idioma] = {'comprobacion': dict(cuenta), 'guiones': sorted(set(decisiones))}
    for area in AREAS:
        for d in diferencias(estructuras[(area, 'es')], estructuras[(area, 'va')]):
            raise SystemExit(f'{area}: {d}')

    valores_es, ce_valores, crit_valores = valores('es')
    valores_va = valores('va')[0]
    for idioma, bloques in (('es', valores_es), ('va', valores_va)):
        primera, ultima = PAGINAS_VALORES[0 if idioma == 'es' else 1]
        textos = [t for b in bloques for e in b['epigrafes'] for t in [e['titulo']] + e['items']]
        if idioma == 'es':
            textos += [c['texto'] for c in ce_valores] + [c['texto'] for c in crit_valores['3']]
        informe[idioma]['comprobacion'] = dict(
            Counter(informe[idioma]['comprobacion']) + comprobar_texto(textos, PDF[idioma], primera, ultima, idioma))
    if [[len(e['items']) for e in b['epigrafes']] for b in valores_es] != \
       [[len(e['items']) for e in b['epigrafes']] for b in valores_va]:
        raise SystemExit('Educación en Valores: distinta forma en castellano y en valenciano')

    # Lo intermedio, con grupos y en las dos lenguas, para poder revisarlo
    for idioma in ('es', 'va'):
        intermedio = {area: estructuras[(area, idioma)] for area in AREAS}
        intermedio['valores'] = valores_es if idioma == 'es' else valores_va
        (SALIDA_SCRIPTS / f'saberes-106-2022.{idioma}.json').write_text(
            json.dumps(intermedio, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

    criterios_96 = {a['area']: a for a in json.loads(CRITERIOS_96.read_text(encoding='utf-8'))}
    entradas = []
    for id_, nombre, origen, area_96 in APP:
        if origen == 'valores':
            competencias = [{'n': c['n'], 'texto': limpiar_enunciado(c['texto'])} for c in ce_valores]
            criterios = {'1': [], '2': [], '3': crit_valores['3']}
            for c in criterios['3']:
                c['texto'] = limpiar_enunciado(c['texto'])
            saberes = [{'bloque': str(b['n']), 'tituloBloque': b['titulo'],
                        'epigrafes': [{'n': k + 1, 'titulo': e['titulo'], 'items': e['items']}
                                      for k, e in enumerate(b['epigrafes'])]} for b in valores_es]
        else:
            a96 = criterios_96[area_96]
            competencias = [{'n': c['n'], 'texto': limpiar_enunciado(c['texto'])} for c in a96['competencias']]
            criterios = {g: [{'codigo': x['codigo'], 'competencia': c['n'], 'texto': x['texto'], 'codigoLiteral': True}
                             for c in a96['competencias'] for x in c['criterios'][g]] for g in ('1', '2', '3')}
            saberes = saberes_para_la_app(origen, estructuras[(origen, 'es')], 'es')
        entradas.append({'id': id_, 'area': nombre, 'competencias': competencias,
                         'criterios': criterios, 'saberes': saberes})

    SALIDA_APP.mkdir(parents=True, exist_ok=True)
    (SALIDA_APP / 'primaria.es.json').write_text(json.dumps(entradas, ensure_ascii=False, indent=1) + '\n',
                                                 encoding='utf-8')
    for idioma, inf in informe.items():
        print(f"{idioma}: {inf['comprobacion']}; {len(inf['guiones'])} guiones de fin de línea resueltos")
        if revisar:
            for g in inf['guiones']:
                print('   ', g)
    for e in entradas:
        n_sab = sum(len(ep['items']) for b in e['saberes'] for ep in b['epigrafes'])
        n_crit = sum(len(v) for v in e['criterios'].values())
        print(f"{e['area']}: {len(e['competencias'])} competencias, {n_crit} criterios, "
              f"{len(e['saberes'])} bloques, {n_sab} saberes")


if __name__ == '__main__':
    construir(revisar='--revisar' in sys.argv)
