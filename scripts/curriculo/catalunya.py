"""
Currículo de Primaria y ESO de Cataluña: Decret 175/2022, de 27 de setembre,
d'ordenació dels ensenyaments de l'educació bàsica (DOGC núm. 8762), solo en
catalán. Las áreas de Primaria están en el annex 2 y las materias de la ESO en
el annex 3, con el mismo esquema: presentación, competencias específicas
(«Competència específica N», con el enunciado en negrita), sus criterios de
evaluación (en una columna por ciclo o curso, o en una sola) con la
explicación de la competencia debajo, y los saberes («Sabers»), por ciclo o
curso, en bloques con su título en negrita, epígrafes («● …») y saberes
(«- …»).

La negrita del PDF no trae la correspondencia de algunas letras con su
carácter (sale «(cid:89)» por la «v», y `pdftotext` las pierde: «di ersitat»).
`GLIFOS` las pone: son los números de glifo de la Arial, comprobados con las
palabras en que salen.

    python3 scripts/curriculo/catalunya.py            # escribe los datos de la app
    python3 scripts/curriculo/catalunya.py --ver id    # una materia, para revisar
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from functools import lru_cache
from pathlib import Path

import pdfplumber

RAIZ = Path(__file__).resolve().parents[2]
PDF = RAIZ / 'docs' / 'Normativa Cataluña' / 'DECRET 175-2022.pdf'
SALIDA_APP = RAIZ / 'src' / 'lib' / 'curriculum' / 'data' / 'cataluna'
CACHE = Path(__file__).parent / '.cache-catalunya'

# Glifo de la Arial → carácter (los que la negrita no trae). Del 19 al 28, las
# cifras; del 36 al 61, las mayúsculas; del 68 al 93, las minúsculas.
GLIFOS = {16: '-', 17: '.', 18: '/', 29: ':', 30: ';', 34: '?', 101: 'É', 111: 'ç', 112: 'é', 119: 'ï', 122: 'ò',
          126: 'ú', 172: 'À', 178: '–', 181: '’', 202: 'È', 257: '·', 404: '●'}
GLIFOS.update({19 + i: str(i) for i in range(10)})
GLIFOS.update({36 + i: chr(ord('A') + i) for i in range(26)})
GLIFOS.update({68 + i: chr(ord('a') + i) for i in range(26)})


def glifos(t: str) -> str:
    t = t.replace('\uf0b7', '●')       # la viñeta de Symbol de Matemàtiques
    return re.sub(r'\(cid:(\d+)\)', lambda m: GLIFOS[int(m.group(1))], t)


# ── Lectura del PDF ──────────────────────────────────────────────────────────

def _pagina(n: int) -> tuple[int, list]:
    """Las palabras de una página, con su posición, si van en negrita y su
    tamaño. Fuera la cabecera y el pie del DOGC."""
    with pdfplumber.open(PDF) as pdf:
        p = pdf.pages[n - 1]
        # sin `extra_attrs`: partiría una palabra donde cambia una centésima el
        # tamaño de la letra («pro gramació»)
        palabras = p.dedupe_chars().extract_words(keep_blank_chars=False, use_text_flow=False, return_chars=True)
        def negrita(w):
            return sum('Bold' in c['fontname'] for c in w['chars']) > len(w['chars']) / 2
        return n, [dict(t=glifos(w['text']), x0=round(w['x0'], 1), x1=round(w['x1'], 1), top=round(w['top'], 1),
                        b=negrita(w), s=round(max(c['size'] for c in w['chars']), 1))
                   for w in palabras if 90 < w['top'] < 790]


@lru_cache(maxsize=1)
def paginas() -> dict:
    archivo = CACHE / 'paginas.json'
    if not archivo.exists():
        from concurrent.futures import ProcessPoolExecutor
        print('Leyendo el decreto; tarda unos minutos la primera vez…', file=sys.stderr)
        with ProcessPoolExecutor(4) as ex:
            res = dict(ex.map(_pagina, range(45, 453), chunksize=8))
        CACHE.mkdir(exist_ok=True)
        archivo.write_text(json.dumps(res, ensure_ascii=False))
    return {int(k): v for k, v in json.loads(archivo.read_text()).items()}


def filas(n: int) -> list[dict]:
    """Las palabras de la página agrupadas en filas (misma altura), de
    izquierda a derecha. Sin los números de página."""
    ws = sorted(paginas()[n], key=lambda w: (w['top'], w['x0']))
    out: list[dict] = []
    for w in ws:
        if out and abs(out[-1]['top'] - w['top']) < 2.5:
            out[-1]['w'].append(w)
        else:
            out.append(dict(top=w['top'], w=[w], pag=n))
    for f in out:
        f['w'].sort(key=lambda w: w['x0'])
        f['t'] = texto(f['w'])
        f['x0'], f['x1'] = f['w'][0]['x0'], f['w'][-1]['x1']
        f['b'] = sum(w['b'] for w in f['w']) > len(f['w']) / 2
        f['s'] = max(w['s'] for w in f['w'])
    return [f for f in out if not re.fullmatch(r'\d{1,3}', f['t'])]


def texto(ws: list[dict]) -> str:
    return re.sub(r'\s+', ' ', ' '.join(w['t'] for w in ws)).strip()


@lru_cache(maxsize=1)
def vocabulario() -> dict:
    """Las palabras del decreto según `pdftotext`, que no parte las que el PDF
    lleva con un espacio en medio."""
    import subprocess
    from collections import Counter
    texto = subprocess.run(['pdftotext', str(PDF), '-'], check=True, capture_output=True, text=True).stdout
    return Counter(w.lower() for w in re.findall(r'[\w·]+', texto))


UNIONES: list = []


def juntar_partidas(t: str) -> str:
    """«escola rs» → «escolars»: dos trozos que juntos son una palabra del
    decreto y uno de los cuales no lo es. «innovador a partir» se queda."""
    vocab = vocabulario()
    toks = t.split(' ')
    out: list[str] = []
    for tok in toks:
        if out:
            a = re.findall(r'[\w·]+$', out[-1])
            b = re.findall(r'^[\w·]+', tok)
            if a and b and vocab[(a[0] + b[0]).lower()] and (not vocab[a[0].lower()] or not vocab[b[0].lower()]):
                UNIONES.append((a[0], b[0]))
                out[-1] += tok
                continue
        out.append(tok)
    t = ' '.join(out)
    return re.sub(r'(?<=\w) ’(?=\w)', '’', t)      # «se ’n» → «se’n»


def unir(lineas: list[str]) -> str:
    """Junta líneas. En este decreto, un guion al final de línea nunca parte
    una palabra: es de un pronombre o de una compuesta («valorar-» «les»)."""
    t = ''
    for l in lineas:
        l = l.strip()
        if not l:
            continue
        t = t + l if t.endswith('-') and not t.endswith(' -') else (f'{t} {l}' if t else l)
    t = unicodedata.normalize('NFC', re.sub(r'\s+', ' ', t)).strip()
    return juntar_partidas(t)


# ── Materias ─────────────────────────────────────────────────────────────────

# Grupos de cursos de la app. Primaria: los ciclos «1», «2» y «3». ESO: los
# nombres que entiende `cursosDelGrupoEso` (src/lib/curriculum/index.ts).
GRUPOS = [
    (r'^(?:1r\s*(?:i|-)\s*2n|primer cicle|primer i segon(?: curs)?)$', {'primaria': '1', 'eso': 'Primero y segundo'}),
    (r'^(?:3r\s*(?:i|-)\s*4t|segon cicle|tercer i quart(?: curs)?)$', {'primaria': '2', 'eso': 'Tercero y cuarto'}),
    (r'^(?:5è\s*(?:i|-)\s*6è|tercer cicle|cinquè i sisè(?: curs)?|5è o 6è)$', {'primaria': '3'}),
    (r'^(?:1r, 2n i 3r|cursos de 1r a 3r|primer, segon i tercer curs|de primer a tercer curs|educació plàstica, visual i audiovisual)$',
     {'eso': 'Cursos de primero a tercero'}),
    (r'^(?:4t|quart curs|optativa de 4t|matèria optativa de (?:quart curs|4t)|expressió artística \(4t\))$', {'eso': 'Cuarto curso'}),
    (r'^1r o 2n o 3r o 4t$', {'eso': 'Curso no especificado'}),
]


def grupo_de(etiqueta: str, etapa: str):
    e = re.sub(r'\s+', ' ', etiqueta.strip().lower())
    for patron, g in GRUPOS:
        if re.match(patron, e):
            return g.get(etapa)
    return None


def m(id, nombre, etapa, pag, grupo=None, **extra):
    """Una materia: su identificador en la app, su nombre, sus páginas
    (desde su título hasta antes del siguiente) y, si sus criterios van en una
    sola columna sin cabecera, el grupo de cursos al que pertenecen."""
    return dict(id=id, nombre=nombre, etapa=etapa, pag=pag, grupo=grupo, **extra)


LENGUAS = [('aranes', 'Aranès i Literatura a l’Aran'), ('lengua-castellana', 'Llengua Castellana i Literatura'),
           ('catalan', 'Llengua Catalana i Literatura')]

MATERIAS = [
    # Annex 2, Primaria
    m('lenguas', None, 'primaria', (48, 67)),
    m('lengua-extranjera', 'Llengua Estrangera', 'primaria', (68, 89)),
    # Optativa del centro en cualquier curso: sus criterios, sin ciclo, valen para los tres
    m('segunda-lengua-extranjera', 'Segona Llengua Estrangera', 'primaria', (90, 101), ['1', '2', '3']),
    m('conocimiento-del-medio', 'Coneixement del Medi Natural, Social i Cultural', 'primaria', (102, 124)),
    m('educacion-artistica', 'Educació Artística', 'primaria', (125, 141)),
    m('educacion-en-valores', 'Educació en Valors Cívics i Ètics', 'primaria', (142, 150)),
    m('educacion-fisica', 'Educació Física', 'primaria', (151, 172)),
    m('matematicas', 'Matemàtiques', 'primaria', (173, 193)),
    # Annex 3, ESO
    m('lenguas', None, 'eso', (197, 214)),
    m('lengua-extranjera', 'Llengua Estrangera', 'eso', (215, 231)),
    m('segunda-lengua-extranjera', 'Segona Llengua Estrangera', 'eso', (232, 243), 'Curso no especificado'),   # de primero a cuarto
    m('artes-escenicas', 'Arts Escèniques i Dansa', 'eso', (244, 249), 'Cuarto curso'),
    m('biologia-y-geologia', 'Biologia i Geologia', 'eso', (250, 264)),
    m('geografia-e-historia', 'Ciències Socials: Geografia i Història', 'eso', (265, 286)),
    m('cultura-clasica', 'Cultura Clàssica', 'eso', (287, 293), 'Curso no especificado'),
    m('digitalizacion', 'Digitalització', 'eso', (294, 301), 'Cuarto curso'),
    m('economia-basica', 'Economia Bàsica', 'eso', (302, 309), 'Cuarto curso'),
    m('educacion-en-valores', 'Educació en Valors Cívics i Ètics', 'eso', (310, 318)),
    m('educacion-fisica', 'Educació Física', 'eso', (319, 331)),
    m('plastica', None, 'eso', (332, 342)),
    m('emprendimiento', 'Emprenedoria', 'eso', (343, 349), 'Cursos de primero a tercero'),
    m('emprendimiento', 'Emprenedoria', 'eso', (350, 360), 'Cuarto curso'),
    m('filosofia', 'Filosofia', 'eso', (361, 368), 'Cuarto curso'),
    m('fisica-y-quimica', 'Física i Química', 'eso', (369, 383)),
    m('formacion-y-orientacion', 'Formació i Orientació Personal i Professional', 'eso', (384, 391), 'Cuarto curso'),
    m('latin', 'Llatí: Llengua i Cultura', 'eso', (392, 403), 'Cuarto curso'),
    m('matematicas', 'Matemàtiques', 'eso', (404, 421)),
    m('musica', 'Música', 'eso', (422, 429)),
    m('robotica-y-programacion', 'Robòtica i Programació', 'eso', (430, 434), 'Cursos de primero a tercero'),
    m('tecnologia', 'Tecnologia', 'eso', (435, 443), 'Cuarto curso'),
    m('tecnologia-y-digitalizacion', 'Tecnologia i Digitalització', 'eso', (444, 452), 'Cursos de primero a tercero'),
]

# Educación Plástica, Visual y Audiovisual (de primero a tercero) y Expresión
# Artística (cuarto) comparten apartado: las mismas competencias, una columna
# de criterios cada una y sus saberes por separado.
PLASTICA = {'Cursos de primero a tercero': ('educacion-plastica-visual-y-audiovisual', 'Educació Plàstica, Visual i Audiovisual'),
            'Cuarto curso': ('expresion-artistica', 'Expressió Artística')}


# ── Lectura de una materia ───────────────────────────────────────────────────

COMPETENCIA = re.compile(r'^Competència(?: específica)?\s*(\d{1,2})$')     # Educació Artística: «Competència 1»
CRITERIOS = re.compile(r'^Criteris (?:d.)?avaluació$')     # Física i Química 6: «Criteris avaluació»
CODIGO = re.compile(r'^(\d{1,2})\.(\d{1,2})$')
EMPIEZA_CODIGO = re.compile(r'^(\d{1,2})\s?\.\s?(\d{1,2})\.?\s+(.*)$')     # «1.1 Identificar…», «10 .1 …», «9.3. …»


def leer(mat: dict) -> dict:
    """Competencias, criterios por grupo y saberes por grupo de una materia,
    leídos fila a fila."""
    a, b = mat['pag']
    fs = [f for n in range(a, b + 1) for f in filas(n)]
    competencias, criterios, saberes = [], {}, {}
    i = 0
    while i < len(fs):
        f = fs[i]
        mc = COMPETENCIA.match(f['t'])
        if mc and f['b']:
            n = int(mc.group(1))
            j, enunciado = i + 1, []
            while j < len(fs) and fs[j]['b'] and not CRITERIOS.match(fs[j]['t']):
                enunciado.append(fs[j]['t'])
                j += 1
            competencias.append(dict(n=n, texto=re.sub(r'\.$', '', unir(enunciado)) + '.'))
            if j < len(fs) and CRITERIOS.match(fs[j]['t']):
                j = leer_criterios(mat, fs, j + 1, n, criterios)
            i = j
            continue
        if f['t'] == 'Sabers' and f['b']:
            leer_saberes(mat, fs[i + 1:], saberes, set(criterios))
            break
        i += 1
    return dict(competencias=competencias, criterios=criterios, saberes=saberes)


def leer_criterios(mat: dict, fs: list, j: int, n_ce: int, salida: dict) -> int:
    """Los criterios de una competencia, desde la fila que sigue a «Criteris
    d'avaluació». La primera fila puede ser la cabecera de las columnas (un
    ciclo o curso cada una); si no la hay, es una sola columna, del grupo de
    la materia. Acaba en una fila de párrafo (la explicación de la
    competencia): más de un salto de línea por encima, o que pasa por encima
    de la frontera entre columnas."""
    etapa = mat['etapa']
    cab = fs[j]
    columnas = []
    if not EMPIEZA_CODIGO.match(cab['t']):
        # las etiquetas de la cabecera, separadas por huecos grandes
        grupos_txt, actual = [], [cab['w'][0]]
        for w in cab['w'][1:]:
            if w['x0'] - actual[-1]['x1'] > 15:
                grupos_txt.append(actual)
                actual = [w]
            else:
                actual.append(w)
        grupos_txt.append(actual)
        for ws in grupos_txt:
            g = grupo_de(texto(ws), etapa)
            if g is None:
                raise SystemExit(f'{mat["id"]}: cabecera de criterios desconocida «{texto(ws)}» (p. {cab["pag"]})')
            columnas.append(dict(g=g, centro=(ws[0]['x0'] + ws[-1]['x1']) / 2))
        j += 1
        while j < len(fs) and not EMPIEZA_CODIGO.match(fs[j]['t']) and fs[j]['top'] - cab['top'] < 20:
            j += 1                     # la cabecera en dos líneas («(1r a 3r)»)
    else:
        columnas.append(dict(g=mat['grupo'], centro=300))
    if any(not c['g'] for c in columnas):
        raise SystemExit(f'{mat["id"]}: criterios sin grupo de cursos (p. {cab["pag"]})')
    fronteras = [(x['centro'] + y['centro']) / 2 for x, y in zip(columnas, columnas[1:])]
    lineas = {k: [] for k in range(len(columnas))}      # por columna, sus líneas
    previa = None
    while j < len(fs):
        f = fs[j]
        if f['b'] and (COMPETENCIA.match(f['t']) or f['t'] == 'Sabers' or CRITERIOS.match(f['t'])):
            break
        nueva_pagina = previa is not None and f['pag'] != previa['pag']
        salto = (f['top'] - previa['top']) if previa is not None and not nueva_pagina else 0
        empieza_codigo = bool(EMPIEZA_CODIGO.match(f['t']))
        if len(columnas) > 1:
            cruza = any(w['x0'] < x < w['x1'] or (w['x1'] <= x <= w2['x0'] and w2['x0'] - w['x1'] < 8)
                        for x in fronteras for w, w2 in zip(f['w'], f['w'][1:] + [dict(x0=1e9)]))
            if cruza:
                break
            if salto > 24 and not empieza_codigo and not any(CODIGO.match(w['t']) for w in f['w']):
                break
        else:
            ultimo = lineas[0][-1][1] if lineas[0] else ''
            # entre las líneas de un criterio hay 11 puntos; más, sin código delante,
            # es el párrafo de la explicación (18 o más)
            if (salto > 13 or nueva_pagina) and not empieza_codigo and (ultimo.rstrip().endswith('.') or salto > 13):
                if not (nueva_pagina and re.match(r'^[a-zà-ú]', f['t'])):
                    break
        for k in range(len(columnas)):
            lim0 = fronteras[k - 1] if k else -1e9
            lim1 = fronteras[k] if k < len(fronteras) else 1e9
            ws = [w for w in f['w'] if lim0 <= (w['x0'] + w['x1']) / 2 < lim1]
            if ws:
                lineas[k].append((f['top'], texto(ws)))
        previa = f
        j += 1
    for k, col in enumerate(columnas):
        lista = salida.setdefault(col['g'] if isinstance(col['g'], str) else '+'.join(col['g']), [])
        actual = None
        for _, t in lineas[k]:
            mm = EMPIEZA_CODIGO.match(t)
            if mm and int(mm.group(1)) == n_ce:
                actual = dict(codigo=f'{mm.group(1)}.{mm.group(2)}', competencia=n_ce, lineas=[mm.group(3)])
                lista.append(actual)
            elif actual is not None:
                actual['lineas'].append(t)
            else:
                raise SystemExit(f'{mat["id"]} CE{n_ce}: texto suelto antes del primer criterio: «{t}»')
    return j


ETIQUETA_GRUPO = re.compile(r'(?i)^(?:primer|segon|tercer|quart|cinquè|de primer|cursos? de|matèria optativa|optativa)\b.*'
                            r'(?:curs|cicle|segon|quart|sisè|\dr|\dt)$|^(?:primer|segon|tercer) cicle$')


def leer_saberes(mat: dict, fs: list, salida: dict, grupos_criterios: set) -> None:
    """Los saberes: tras la introducción, el grupo de cursos (si la materia
    los separa), los bloques (título en negrita, a veces en dos líneas), los
    epígrafes («● …») y los saberes («- …»), con sus líneas de continuación
    más sangradas."""
    etapa = mat['etapa']
    grupo = None if len(grupos_criterios) != 1 else next(iter(grupos_criterios))
    bloques_de: dict = {}
    bloque = epigrafe = item = None
    empezado = False
    x_item = None
    for f in fs:
        t = f['t']
        if f['s'] >= 11.5:
            break                      # el título de la materia siguiente
        g = grupo_de(t, etapa) if f['b'] else None
        if f['b'] and g:
            grupo, bloque, epigrafe, item = g, None, None, None
            empezado = True
            continue
        if empezado and bloque is None and not f['b']:
            continue                   # una nota antes del primer bloque (Matemàtiques de quart)
        if f['b'] and mat['id'] == 'plastica' and t in ('Educació Plàstica, Visual i Audiovisual', 'Expressió Artística'):
            continue                   # el nombre de la materia, antes de su grupo
        if f['b'] and not t.startswith('●'):     # en Formació i Orientació, los epígrafes van en negrita
            if bloque is not None and not bloque['epigrafes'] and bloque['_abierto']:
                bloque['titulo'].append(t)     # el título sigue en la línea de abajo
                continue
            empezado = True
            lista = bloques_de.setdefault(grupo, [])
            bloque = dict(titulo=[t], epigrafes=[], _abierto=True)
            lista.append(bloque)
            epigrafe = item = None
            continue
        if not empezado:
            continue                   # la introducción del apartado
        if bloque is None:
            raise SystemExit(f'{mat["id"]}: saber sin bloque: «{t}» (p. {f["pag"]})')
        bloque['_abierto'] = False
        if t.startswith('●'):
            epigrafe = dict(titulo=[t.lstrip('● ').strip()], items=[])
            bloque['epigrafes'].append(epigrafe)
            item = None
            continue
        if t.startswith('- ') or t == '-':
            if epigrafe is None:
                epigrafe = dict(titulo=None, items=[])
                bloque['epigrafes'].append(epigrafe)
            item = [t[1:].strip()]
            epigrafe['items'].append(item)
            x_item = f['x0']
            continue
        if item is not None:
            item.append(t)             # la línea sigue el saber
        elif epigrafe is not None and epigrafe['titulo'] and not epigrafe['items']:
            epigrafe['titulo'].append(t)
        else:
            # un saber sin guion, al principio del bloque («Aplicació d'estratègies…
            # amb atenció conjunta als aspectes següents:»)
            epigrafe = dict(titulo=None, items=[])
            bloque['epigrafes'].append(epigrafe)
            item = [t]
            epigrafe['items'].append(item)
    for g, bs in bloques_de.items():
        destino = [g] if g is not None else sorted(grupos_criterios)
        for gg in destino:
            salida[gg] = [dict(
                bloque=bloque_id(b, k),
                tituloBloque=titulo_bloque(unir(b['titulo'])),
                epigrafes=[dict(n=None, titulo=unir(e['titulo']).rstrip('.') if e['titulo'] else None,
                                items=[unir(it) for it in e['items'] if unir(it)])
                           for e in b['epigrafes']],
            ) for k, b in enumerate(bs)]


def bloque_id(b: dict, k: int) -> str:
    mm = re.match(r'^([A-Z])\.\s', unir(b['titulo']))
    return mm.group(1) if mm else str(k + 1)


def titulo_bloque(t: str) -> str:
    t = re.sub(r'^[A-Z]\.\s+', '', t)
    return t.rstrip('.')


# ── Lo que lleva la app ──────────────────────────────────────────────────────

def entradas(etapa: str) -> list[dict]:
    salida: list[dict] = []
    por_id: dict = {}
    for mat in MATERIAS:
        if mat['etapa'] != etapa:
            continue
        r = leer(mat)
        criterios = {gg: [dict(codigo=c['codigo'], competencia=c['competencia'], texto=unir(c['lineas']), codigoLiteral=True)
                          for c in lista] for g, lista in r['criterios'].items() for gg in g.split('+')}
        r['saberes'] = {gg: v for g, v in r['saberes'].items() for gg in (g.split('+') if g else [g])}
        if mat['id'] == 'lenguas':
            for id_, nombre in LENGUAS:
                salida.append(dict(id=id_, materia=nombre, competencias=r['competencias'], criterios=criterios, saberes=r['saberes']))
            continue
        if mat['id'] == 'plastica':
            for g, (id_, nombre) in PLASTICA.items():
                salida.append(dict(id=id_, materia=nombre, competencias=r['competencias'],
                                   criterios={g: criterios[g]}, saberes={g: r['saberes'][g]}))
            continue
        if mat['id'] in por_id:        # Emprenedoria: primero a tercero y cuarto, dos apartados
            e = por_id[mat['id']]
            e['criterios'].update(criterios)
            e['saberes'].update(r['saberes'])
            if r['competencias'] != e['competencias']:
                e.setdefault('competenciasPorGrupo', {g: e['competencias'] for g in e['criterios'] if g not in criterios})
                e['competenciasPorGrupo'].update({g: r['competencias'] for g in criterios})
            continue
        e = dict(id=mat['id'], materia=mat['nombre'], competencias=r['competencias'], criterios=criterios, saberes=r['saberes'])
        por_id[mat['id']] = e
        salida.append(e)
    return salida


def resumen(e: dict) -> str:
    return (f"{e['id']:40} CE{len(e['competencias'])} "
            + ' '.join(f"{g}:{len(v)}" for g, v in e['criterios'].items()) + ' | '
            + ' '.join(f"{g}:{len(v)}b/{sum(len(ep['items']) for b in v for ep in b['epigrafes'])}s" for g, v in e['saberes'].items()))


def main() -> None:
    if '--ver' in sys.argv:
        ids = sys.argv[sys.argv.index('--ver') + 1].split(',')
        for etapa in ('primaria', 'eso'):
            for e in entradas(etapa):
                if e['id'] not in ids:
                    continue
                print(f'== {etapa} {resumen(e)}')
                for c in e['competencias']:
                    print(f"  CE{c['n']}: {c['texto']}")
                for g, lista in e['criterios'].items():
                    for c in lista:
                        print(f"  [{g}] {c['codigo']} {c['texto']}")
                for g, bs in e['saberes'].items():
                    for b in bs:
                        print(f"  [{g}] {b['bloque']}. {b['tituloBloque']}")
                        for ep in b['epigrafes']:
                            print(f"      ● {ep['titulo']}")
                            for it in ep['items']:
                                print(f"          - {it}")
        return
    SALIDA_APP.mkdir(parents=True, exist_ok=True)
    for etapa in ('primaria', 'eso'):
        es = entradas(etapa)
        for e in es:
            print(f'{etapa:8} {resumen(e)}')
        archivo = SALIDA_APP / f'{etapa}.ca.json'
        archivo.write_text(json.dumps(es, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(f'{archivo.relative_to(RAIZ)}: {len(es)} materias')


if __name__ == '__main__':
    main()
