"""
Lee el anexo II del Decreto 65/2022 (ESO, Comunidad de Madrid), le aplica el
Decreto 59/2024 y escribe el currículo que lleva la app:
`src/lib/curriculum/data/madrid/eso.es.json`.

A diferencia de la Primaria, el anexo II de la ESO es texto corrido, no
tablas. Cada materia empieza con su título en mayúsculas y negrita, centrado,
y sigue este orden:

- «Competencias específicas.»: cada una con su enunciado en negrita
  («1. Interpretar…») y, debajo, su explicación y sus descriptores, sin
  negrita. A la app va el enunciado.
- Por curso («1º ESO.»; en Matemáticas de cuarto, «MATEMÁTICAS A.» y
  «MATEMÁTICAS B.»): «Criterios de evaluación.», agrupados por «Competencia
  específica N.» y numerados («1.1», a veces sin punto detrás), y
  «Contenidos.», en bloques con letra en negrita («A. Proyecto científico.»),
  con apartados numerados («1. Conteo.», «3.1. Hablar y escuchar.») en
  algunas materias, y conocimientos con viñetas de dos niveles. En Lengua
  Extranjera, una parte de los contenidos va por idioma («ALEMÁN.»…).

Educación en Valores Cívicos y Éticos no está desarrollada: el anexo remite al
Real Decreto 217/2022 y le añade un contenido en el bloque B. El Decreto
59/2024 añade un último guion a los contenidos de Geografía e Historia (bloque
B de primero a tercero, D de cuarto).

Uso:
    python3 scripts/curriculo/madrid_eso.py            # escribe los JSON
    python3 scripts/curriculo/madrid_eso.py --revisar  # además, imprime la estructura
"""
import json
import logging
import re
import sys
from collections import Counter
from pathlib import Path

import pdfplumber

sys.path.insert(0, str(Path(__file__).parent))
from saberes_dogv_tablas import GUION_DE_LINEA  # noqa: E402
from primaria_cv import (  # noqa: E402
    normalizar_para_comparar, palabras as palabras_para_comparar, texto_plano, vocabulario,
)

logging.disable(logging.WARNING)  # avisos de fuentes de pdfminer

RAIZ = Path(__file__).resolve().parents[2]
NORMATIVA = RAIZ / 'docs' / 'Normativa Comunidad de Madrid'
PDF = NORMATIVA / 'DECRETO 65-2022.pdf'
PDF_59 = NORMATIVA / 'DECRETO 59-2024.pdf'
ESTATAL = RAIZ / 'src' / 'lib' / 'curriculum' / 'data' / 'eso.json'
SALIDA_SCRIPTS = Path(__file__).parent / 'comunidad-de-madrid'
SALIDA_APP = RAIZ / 'src' / 'lib' / 'curriculum' / 'data' / 'madrid'
PRIMERA, ULTIMA = 26, 285  # anexo II (el III es de otra cosa)

# Título en el anexo → identificador, nombre en la app y grupos de cursos, en
# el orden de los artículos 6, 8 y 9. Los grupos se comprueban con los que
# trae el anexo; Digitalización no pone «4º ESO.» porque solo se da en cuarto.
MATERIAS = {
    'BIOLOGÍA Y GEOLOGÍA': ('biologia-y-geologia', 'Biología y Geología', ['1º ESO', '3º ESO', '4º ESO']),
    'CIENCIAS DE LA COMPUTACIÓN': ('ciencias-de-la-computacion', 'Ciencias de la Computación', ['1º ESO', '2º ESO']),
    'CULTURA CLÁSICA': ('cultura-clasica', 'Cultura Clásica', ['3º ESO', '4º ESO']),
    'DIGITALIZACIÓN': ('digitalizacion', 'Digitalización', ['4º ESO']),
    'ECONOMÍA Y EMPRENDIMIENTO': ('economia-y-emprendimiento', 'Economía y Emprendimiento', ['4º ESO']),
    'EDUCACIÓN FÍSICA': ('educacion-fisica', 'Educación Física', ['1º ESO', '2º ESO', '3º ESO', '4º ESO']),
    'EDUCACIÓN PLÁSTICA, VISUAL Y AUDIOVISUAL': ('educacion-plastica-visual-y-audiovisual',
                                                 'Educación Plástica, Visual y Audiovisual', ['1º ESO', '2º ESO']),
    'EDUCACIÓN EN VALORES CÍVICOS Y ÉTICOS': ('educacion-en-valores', 'Educación en Valores Cívicos y Éticos', ['2º ESO']),
    'EXPRESIÓN ARTÍSTICA': ('expresion-artistica', 'Expresión Artística', ['4º ESO']),
    'FILOSOFÍA': ('filosofia', 'Filosofía', ['4º ESO']),
    'FÍSICA Y QUÍMICA': ('fisica-y-quimica', 'Física y Química', ['2º ESO', '3º ESO', '4º ESO']),
    'FORMACIÓN Y ORIENTACIÓN PERSONAL Y PROFESIONAL': ('formacion-y-orientacion',
                                                       'Formación y Orientación Personal y Profesional', ['4º ESO']),
    'GEOGRAFÍA E HISTORIA': ('geografia-e-historia', 'Geografía e Historia', ['1º ESO', '2º ESO', '3º ESO', '4º ESO']),
    'LATÍN': ('latin', 'Latín', ['4º ESO']),
    'LENGUA CASTELLANA Y LITERATURA': ('lengua-castellana', 'Lengua Castellana y Literatura',
                                       ['1º ESO', '2º ESO', '3º ESO', '4º ESO']),
    'LENGUA EXTRANJERA': ('lengua-extranjera', 'Lengua Extranjera', ['1º ESO', '2º ESO', '3º ESO', '4º ESO']),
    'MATEMÁTICAS': ('matematicas', 'Matemáticas', ['1º ESO', '2º ESO', '3º ESO', 'Matemáticas A', 'Matemáticas B']),
    'MÚSICA': ('musica', 'Música', ['1º ESO', '3º ESO', '4º ESO']),
    'SEGUNDA LENGUA EXTRANJERA': ('segunda-lengua-extranjera', 'Segunda Lengua Extranjera',
                                  ['1º ESO', '2º ESO', '3º ESO', '4º ESO']),
    'TECNOLOGÍA Y DIGITALIZACIÓN': ('tecnologia-y-digitalizacion', 'Tecnología y Digitalización', ['2º ESO', '3º ESO']),
    'TECNOLOGÍA': ('tecnologia', 'Tecnología', ['4º ESO']),
}
VALORES = 'EDUCACIÓN EN VALORES CÍVICOS Y ÉTICOS'
# Lo que el anexo II añade al bloque B de Educación en Valores del Real Decreto
ADICION_VALORES = ('La Constitución española de 1978 y sus valores como norma fundamental de todos los '
                   'españoles. Principios. Derechos y deberes fundamentales y sus implicaciones.')
IDIOMAS = {'ALEMÁN': 'Alemán', 'FRANCÉS': 'Francés', 'INGLÉS': 'Inglés', 'ITALIANO': 'Italiano', 'PORTUGUÉS': 'Portugués'}
VINETAS = {'–', '−', '‒', '-', '—', '•', '(cid:2)', '(cid:3)'}

CURSO = re.compile(r'^([1-4])º ESO\.?$')
OPCION_MATES = re.compile(r'^MATEMÁTICAS ([AB])\.?$')
BLOQUE = re.compile(r'^([A-Z]) ?\. ?(.+?) ?\.?$')
APARTADO = re.compile(r'^(\d+(?:\.\d+)*)\.\s+(.+?)\.?$')
COMPETENCIA = re.compile(r'^(\d+)\.\s+')
CRITERIO = re.compile(r'^(\d+)\.(\d+)\.?(?:\s+|$|(?=[A-ZÁÉÍÓÚ]))')  # «9.1.Interpretar», sin espacio
ETIQUETA_COMPETENCIA = re.compile(r'^Competencia (?:específica )?(\d+) ?\.?$')  # «Competencia 5.» en Cultura Clásica
DESCRIPTORES = re.compile(r'descriptores[^:]*:\s*((?:[A-Z]+\d?[,.]?\s*(?:y\s+)?)+)\.?\s*$')  # «CP3. STEM3»


def lineas():
    """Las líneas del anexo, en orden, sin cabecera, pie ni el código del
    margen derecho, con lo que hace falta para reconocerlas: posición,
    negrita y texto. Una viñeta que el PDF pone un poco más alta que su texto
    sale como línea suelta: se une a la siguiente."""
    out = []
    with pdfplumber.open(PDF) as doc:
        for n in range(PRIMERA, ULTIMA + 1):
            p = doc.pages[n - 1]
            ws = [w for w in p.extract_words(x_tolerance=1.5, y_tolerance=2, return_chars=True)
                  if 95 < w['top'] < p.height - 40 and w['x1'] < 555]
            ws.sort(key=lambda w: (round(w['top']), w['x0']))
            grupos = []
            for w in ws:
                if grupos and abs(grupos[-1][0]['top'] - w['top']) < 3:
                    grupos[-1].append(w)
                else:
                    grupos.append([w])
            ls = []
            for g in grupos:
                g.sort(key=lambda w: w['x0'])
                chars = [c for w in g for c in w['chars']]
                ls.append({
                    'p': n, 'top': g[0]['top'], 'x0': g[0]['x0'],
                    'negrita': sum('Bold' in c['fontname'] for c in chars) / len(chars) > 0.5,
                    't': ' '.join(w['text'] for w in g),
                })
            i = 0
            while i < len(ls):
                l = ls[i]
                if l['t'] in VINETAS and i + 1 < len(ls) and ls[i + 1]['top'] - l['top'] < 8:
                    out.append({**ls[i + 1], 'x0': l['x0'], 't': f"{l['t']} {ls[i + 1]['t']}", 'negrita': ls[i + 1]['negrita']})
                    i += 2
                    continue
                out.append(l)
                i += 1
    return out


def unir(trozos):
    """Une las líneas de un texto. El guion de final de línea queda marcado y
    se decide después con el vocabulario del decreto."""
    t = ''
    for s in trozos:
        s = s.strip()
        if not s:
            continue
        if t.endswith('-') and not t.endswith(' -'):
            t = t[:-1] + GUION_DE_LINEA + s
        else:
            t = t + ' ' + s if t else s
    return re.sub(r'\s+', ' ', t).strip()


def leer():
    """Recorre el anexo y devuelve, por materia, sus competencias (enunciado y
    descriptores) y, por grupo de cursos, criterios y contenidos."""
    materias = {}
    en_zonas = Counter()  # las palabras de lo que pasa a la app, para comprobar que no falta nada
    m = None
    modo = None
    ultima = None  # qué fue la línea anterior: para saber si la siguiente la continúa
    for l in lineas():
        t, x0, negrita = l['t'], l['x0'], l['negrita']
        if negrita and t in MATERIAS and x0 > 100:
            m = materias[t] = {'pagina': l['p'], 'competencias': [], 'grupos': {}}
            modo, grupo, ultima = 'intro', None, None
            continue
        if m is None:
            continue
        if negrita and re.match(r'^Competencias [Ee]specíficas\.?$', t):
            modo, ultima = 'competencias', None
            continue
        c = CURSO.match(t) if negrita else None
        o = OPCION_MATES.match(t) if negrita and x0 < 100 else None
        if c or o:
            grupo = f'{c.group(1)}º ESO' if c else f'Matemáticas {o.group(1)}'
            if c and m is materias.get('MATEMÁTICAS') and c.group(1) == '4':
                continue  # le sigue «MATEMÁTICAS A.» o «B.»
            m['grupos'][grupo] = {'criterios': [], 'contenidos': [], 'etiquetas': [], 'pagina': l['p']}
            modo, ultima = 'curso', None
            continue
        if negrita and re.match(r'^Criterios de evaluación\.?$', t):
            if not m['grupos']:
                # Una materia de un solo curso que no lo pone (Digitalización)
                (unico,) = MATERIAS[next(k for k, v in materias.items() if v is m)][2]
                m['grupos'][unico] = {'criterios': [], 'contenidos': [], 'etiquetas': [], 'pagina': l['p']}
            g = m['grupos'][list(m['grupos'])[-1]]
            modo, ultima = 'criterios', None
            continue
        if negrita and re.match(r'^Contenidos\.?$', t):
            modo, ultima = 'contenidos', None
            continue

        if modo in ('criterios', 'contenidos') or (modo == 'competencias' and negrita):
            if not ETIQUETA_COMPETENCIA.match(t):
                en_zonas.update(fichas(t))
        if modo == 'competencias':
            if negrita and x0 < 65 and COMPETENCIA.match(t):
                m['competencias'].append({'lineas': [t], 'explicacion': []})
                ultima = 'enunciado'
            elif negrita and ultima == 'enunciado':
                m['competencias'][-1]['lineas'].append(t)
            elif m['competencias']:
                m['competencias'][-1]['explicacion'].append(t)
                ultima = 'explicacion'
        elif modo == 'criterios':
            e = ETIQUETA_COMPETENCIA.match(t)
            if e:
                g['etiquetas'].append(int(e.group(1)))
                ultima = None
            elif x0 < 65 and CRITERIO.match(t):
                g['criterios'].append({'lineas': [t], 'etiqueta': g['etiquetas'][-1] if g['etiquetas'] else None})
                ultima = 'criterio'
            elif ultima == 'criterio' and x0 >= 65:
                g['criterios'][-1]['lineas'].append(t)
            else:
                raise SystemExit(f'p. {l["p"]}: línea suelta entre los criterios: {t}')
        elif modo == 'contenidos':
            leer_contenido(g, l, ultima)
            ultima = g.get('ultima')
    return materias, en_zonas


def fichas(t):
    return re.findall(r'[^\W\d_]+', t.lower())


def comprobar_que_no_falta_nada(r, en_zonas):
    """Todas las palabras de los enunciados, los criterios y los contenidos
    del PDF tienen que estar en lo extraído, y al revés: el otro sentido de
    `comprobar_texto`. (Las explicaciones de las competencias no pasan a la
    app, y no cuentan.)"""
    extraido = Counter()
    for titulo, m in r.items():
        for c in m['competencias']:
            extraido.update(fichas(c['texto']))
        for g in m['grupos'].values():
            for c in g['criterios']:
                extraido.update(fichas(c['texto']))
            for b in g['contenidos']:
                extraido.update(fichas(f"{b['letra']} {b['titulo']}"))
                for a in b['apartados']:
                    if a['titulo']:
                        extraido.update(fichas(a['titulo']))
                    for i in a['items']:
                        if not i.get('del_59_2024'):
                            extraido.update(fichas(i['texto']))
    # «(cid:2)» son viñetas
    sobran, faltan = en_zonas - extraido - Counter({'cid': 10 ** 6}), extraido - en_zonas
    if sobran or faltan:
        raise SystemExit(f'Palabras del PDF que no están en lo extraído: {dict(sobran)}; al revés: {dict(faltan)}')


def leer_contenido(g, l, ultima):
    """Una línea de los contenidos de un curso: bloque, idioma, apartado o
    conocimiento (con viñeta, o párrafo sin ella), o la continuación del
    anterior."""
    t, x0, negrita = l['t'], l['x0'], l['negrita']
    bloques = g['contenidos']
    b = BLOQUE.match(t) if negrita and x0 < 65 else None
    if b:
        bloques.append({'letra': b.group(1), 'titulo': [b.group(2)], 'apartados': [], 'pagina': l['p']})
        g['ultima'] = 'bloque'
        return
    if negrita and ultima == 'bloque' and x0 < 80 and not t.startswith(tuple(VINETAS)):
        bloques[-1]['titulo'].append(t)  # título de bloque en dos líneas
        return
    if not bloques:
        raise SystemExit(f'p. {l["p"]}: contenido antes del primer bloque: {t}')
    apartados = bloques[-1]['apartados']
    idioma = re.match(r'^([A-ZÁÉÍÓÚ]+)\.?$', t) if negrita else None
    if idioma and idioma.group(1) in IDIOMAS:
        apartados.append({'numero': None, 'titulo': [IDIOMAS[idioma.group(1)]], 'items': []})
        g['ultima'] = 'apartado'
        return
    a = APARTADO.match(t) if not negrita and x0 < 70 else None
    if a:
        apartados.append({'numero': a.group(1), 'titulo': [a.group(2)], 'items': [], 'abierto': not t.endswith('.')})
        g['ultima'] = 'apartado'
        return
    if ultima == 'apartado' and apartados[-1].get('abierto') and x0 > 60 and t.split()[0] not in VINETAS:
        # Título de apartado en dos líneas («4. Planificación… de» / «fenómenos de azar.»)
        apartados[-1]['titulo'].append(t.rstrip('.'))
        apartados[-1]['abierto'] = not t.endswith('.')
        return
    if not apartados:
        apartados.append({'numero': None, 'titulo': None, 'items': []})
    items = apartados[-1]['items']
    primera = t.split()[0]
    if primera in VINETAS:
        nivel = 1 if x0 < 70 else 2
        items.append({'nivel': nivel, 'lineas': [t[len(primera):].strip()]})
        g['ultima'] = 'item'
    elif x0 < 60 and ultima != 'parrafo':
        # Un párrafo sin viñeta al margen («Implicación en la lectura libre…»)
        items.append({'nivel': 0, 'lineas': [t]})
        g['ultima'] = 'parrafo'
    elif items:
        items[-1]['lineas'].append(t)
    else:
        raise SystemExit(f'p. {l["p"]}: continuación sin conocimiento: {t}')


def adiciones_59_2024(partidas):
    """El último guion que el Decreto 59/2024 añade a Geografía e Historia, por
    curso: el bloque, el guion y sus viñetas. En este decreto el texto va en
    columna estrecha y sí parte palabras al final de la línea («Misiones
    inter-» «nacionales»): se unen, y quedan en `partidas` para revisarlas."""
    with pdfplumber.open(PDF_59) as doc:
        texto = ' '.join(w['text'] for p in doc.pages for w in p.extract_words(x_tolerance=1.5, y_tolerance=2)
                         if 60 < w['top'] < p.height - 40 and w['x1'] < 555)
    out = {}
    for m in re.finditer(r'epígrafe “([1-4])\.o ESO”, “Con-? ?te-? ?nidos”, letra ([A-Z]), se añade un último guión '
                         r'en los siguientes términos: “— (.+?)”', texto):
        curso, letra, cuerpo = m.group(1), m.group(2), m.group(3)
        # La cabecera o el pie de página que cae en medio de un guion
        cuerpo = re.sub(r'\s*(?:BOCM-20240613-2|BOCM|BOLETÍN OFICIAL DE LA COMUNIDAD DE MADRID|B\.O\.C\.M\. Núm\. 140'
                        r'|JUEVES 13 DE JUNIO DE 2024|Pág\.(?: \d+)?)(?=\s)', '', cuerpo)

        def unida(mt):
            partidas.append(f'{mt.group(1)}-|{mt.group(2)}')
            return mt.group(1) + mt.group(2)
        cuerpo = re.sub(r'(\w+)- (\w+)', unida, cuerpo)
        partes = [re.sub(r'\s+', ' ', p).strip() for p in cuerpo.split('(cid:2)')]
        out[f'{curso}º ESO'] = (letra, [{'nivel': 1, 'texto': partes[0]}] + [{'nivel': 2, 'texto': p} for p in partes[1:]])
    if sorted(out) != ['1º ESO', '2º ESO', '3º ESO', '4º ESO']:
        raise SystemExit(f'Adiciones del 59/2024: {sorted(out)}')
    return out


def estructurar(materias, vocab, guiones, partidas_59, renumerados):
    """Las piezas de cada materia, con los textos unidos y el guion de final de
    línea decidido: en este decreto se parten palabras («ali-mentación»), y
    también hay compuestas («físico-química»). Se decide con el vocabulario
    del propio decreto."""
    def limpio(trozos):
        t = unir(trozos)

        def decidir(mt):
            a, b = mt.group(1), mt.group(2)
            if vocab[f'{a}-{b}'.lower()]:
                r = f'{a}-{b}'
            elif vocab[(a + b).lower()] or not (vocab[a.lower()] and vocab[b.lower()]):
                r = a + b
            else:
                r = f'{a}-{b}'
            guiones.append((f'{a}|{b}', r))
            return r
        return re.sub(r'(\w+)' + GUION_DE_LINEA + r'(\w+)', decidir, t).replace(GUION_DE_LINEA, '-')

    resultado = {}
    adiciones = adiciones_59_2024(partidas_59)
    for titulo, m in materias.items():
        competencias = []
        for i, c in enumerate(m['competencias'], 1):
            enunciado = limpio(c['lineas'])
            n = int(COMPETENCIA.match(enunciado).group(1))
            if n != i:
                raise SystemExit(f'{titulo}: competencia {n} en el lugar {i}')
            explicacion = unir(c['explicacion'])
            d = DESCRIPTORES.search(explicacion)
            competencias.append({
                'n': n, 'texto': COMPETENCIA.sub('', enunciado, count=1),
                'descriptores': re.findall(r'[A-Z]+\d?', d.group(1)) if d else [],
            })
        grupos = {}
        for nombre, g in m['grupos'].items():
            criterios = []
            for c in g['criterios']:
                t = limpio(c['lineas'])
                mc = CRITERIO.match(t)
                criterio = {'codigo': f'{mc.group(1)}.{mc.group(2)}', 'competencia': int(mc.group(1)),
                            'texto': t[mc.end():].strip(), 'codigoLiteral': True}
                if c['etiqueta'] and c['etiqueta'] != criterio['competencia']:
                    # Errata del decreto: un criterio numerado con otra competencia
                    # debajo de «Competencia específica N.». Manda la etiqueta, y el
                    # código del decreto queda anotado.
                    renumerados.append((titulo, nombre, criterio['codigo'], c['etiqueta']))
                    criterio.update(codigo=f"{c['etiqueta']}.{mc.group(2)}", competencia=c['etiqueta'],
                                    codigoLiteral=False, codigoEnElDecreto=criterio['codigo'])
                criterios.append(criterio)
            bloques = [{
                'letra': b['letra'],
                'titulo': re.sub(r'\s*\.$', '', limpio(b['titulo'])),  # el punto de un título en dos líneas
                'apartados': [{
                    'numero': a['numero'],
                    'titulo': limpio(a['titulo']) if a['titulo'] else None,
                    'items': [{'nivel': i['nivel'], 'texto': limpio(i['lineas'])} for i in a['items']],
                } for a in b['apartados']],
            } for b in g['contenidos']]
            if titulo == 'GEOGRAFÍA E HISTORIA':
                letra, nuevos = adiciones[nombre]
                bloque = next(b for b in bloques if b['letra'] == letra)
                bloque['apartados'][-1]['items'].extend({**i, 'del_59_2024': True} for i in nuevos)
            grupos[nombre] = {'criterios': criterios, 'contenidos': bloques, 'etiquetas': g['etiquetas']}
        resultado[titulo] = {'pagina': m['pagina'], 'competencias': competencias, 'grupos': grupos}
    return resultado


def comprobar_estructura(r):
    """Lo que tiene que cumplir cualquier materia. Si algo falla, es que el
    lector se ha equivocado."""
    for titulo, m in r.items():
        if titulo == VALORES:
            assert not m['competencias'] and not m['grupos'], titulo
            continue
        _, _, grupos = MATERIAS[titulo]
        assert list(m['grupos']) == grupos, (titulo, list(m['grupos']))
        ns = [c['n'] for c in m['competencias']]
        assert ns == list(range(1, len(ns) + 1)) and ns, (titulo, ns)
        for nombre, g in m['grupos'].items():
            codigos = [c['codigo'] for c in g['criterios']]
            assert codigos and len(set(codigos)) == len(codigos), (titulo, nombre, codigos)
            assert codigos == sorted(codigos, key=lambda c: tuple(map(int, c.split('.')))), (titulo, nombre, codigos)
            assert all(c['competencia'] in ns and c['texto'] for c in g['criterios']), (titulo, nombre)
            # Las etiquetas «Competencia específica N.» que hay, en orden y de competencias con criterios
            con_criterios = sorted({c['competencia'] for c in g['criterios']})
            assert g['etiquetas'] == sorted(g['etiquetas']) and set(g['etiquetas']) <= set(con_criterios), (
                titulo, nombre, g['etiquetas'], con_criterios)
            letras = ''.join(b['letra'] for b in g['contenidos'])
            assert letras == 'ABCDEFGHIJ'[:len(letras)] and letras, (titulo, nombre, letras)
            for b in g['contenidos']:
                assert b['apartados'], (titulo, nombre, b['letra'])
                for a in b['apartados']:
                    assert a['items'] or a['numero'], (titulo, nombre, b['letra'], a['titulo'])
                    assert all(i['texto'] for i in a['items']), (titulo, nombre, b['letra'])


# Textos que `pdftotext` no da igual que pdfplumber y se han comprobado
# mirando la página
VISTOS_EN_IMAGEN: set[str] = set()
CABECERA_Y_PIE = re.compile(
    r'^ *(?:BOCM|BOLETÍN OFICIAL DE LA COMUNIDAD DE MADRID|B\.O\.C\.M\. Núm\. 176|MARTES 26 DE JULIO DE 2022'
    r'|Pág\. \d+|BOCM-20220726-2) *$', re.M)


def en_trozos(t, plano, maximo=4):
    """Un texto que `pdftotext` saca en trozos con otras cosas en medio (la
    cabecera de la página…): se va quitando el principio más largo que está en
    el texto simple, y así hasta cuatro trozos de 15 letras o más."""
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


def comprobar_texto(textos, crudo):
    """Cada texto tiene que estar en el texto simple: letra a letra, con las
    mismas palabras en una ventana corta, en trozos, o visto en imagen."""
    crudo = re.sub(CABECERA_Y_PIE, '', crudo.replace('\f', '\n'))  # el salto de página va pegado a «BOCM»
    plano = normalizar_para_comparar(crudo)
    fichas = palabras_para_comparar(crudo)
    cuenta = Counter()
    for t in textos:
        n = normalizar_para_comparar(t)
        if n in plano:
            cuenta['letra a letra'] += 1
            continue
        w = palabras_para_comparar(t)
        hace_falta, largo = Counter(w), len(w) + 12
        if w and any(all(Counter(fichas[i:i + largo])[k] >= v for k, v in hace_falta.items())
                     for i, f in enumerate(fichas) if f == w[0]):
            cuenta['palabras desordenadas'] += 1
        elif en_trozos(n, plano):
            cuenta['en trozos'] += 1
        elif t in VISTOS_EN_IMAGEN:
            cuenta['vistos en imagen'] += 1
        else:
            raise SystemExit(f'No está en el texto simple del PDF: {t}')
    return cuenta


def textos_de(r):
    for titulo, m in r.items():
        yield from (c['texto'] for c in m['competencias'])
        for g in m['grupos'].values():
            yield from (c['texto'] for c in g['criterios'])
            for b in g['contenidos']:
                yield b['titulo']
                for a in b['apartados']:
                    if a['numero']:
                        yield a['titulo']
                    yield from (i['texto'] for i in a['items'] if not i.get('del_59_2024'))


def para_la_app(r):
    """Las materias con la forma de la app. Los grupos de cursos se llaman
    como en el decreto («1º ESO»; en Matemáticas de cuarto, «Matemáticas A» y
    «Matemáticas B»). Los apartados numerados son los epígrafes: «1. Conteo»
    lleva `n: 1`; los de dos niveles («3.1. Hablar y escuchar») van sin `n` y
    con su número en el título, y los de cada idioma, con el nombre del
    idioma. Las viñetas de segundo nivel van en la lista, detrás de la de
    primer nivel que las introduce."""
    entradas = []
    for titulo, m in r.items():
        id_, nombre, grupos = MATERIAS[titulo]
        if titulo == VALORES:
            entradas.append(valores_del_real_decreto(id_, nombre, grupos))
            continue
        saberes = {}
        for g, datos in m['grupos'].items():
            saberes[g] = []
            for b in datos['contenidos']:
                epigrafes = []
                for a in b['apartados']:
                    numero = a['numero']
                    simple = numero and '.' not in numero
                    epigrafes.append({
                        'n': int(numero) if simple else None,
                        'titulo': (a['titulo'] if simple or not numero else f"{numero}. {a['titulo']}") if a['titulo'] else None,
                        'items': [i['texto'] for i in a['items']],
                    })
                saberes[g].append({'bloque': b['letra'], 'tituloBloque': b['titulo'], 'epigrafes': epigrafes})
        entradas.append({
            'id': id_,
            'materia': nombre,
            'competencias': [{'n': c['n'], 'texto': c['texto']} for c in m['competencias']],
            'criterios': {g: [{k: c[k] for k in ('codigo', 'competencia', 'texto', 'codigoLiteral')} for c in d['criterios']]
                          for g, d in m['grupos'].items()},
            'saberes': saberes,
        })
    return entradas


def valores_del_real_decreto(id_, nombre, grupos):
    """Educación en Valores: la del Real Decreto 217/2022 (los datos estatales
    de la app), en su curso de Madrid, con lo que el anexo II añade al
    bloque B."""
    estatal = next(e for e in json.load(open(ESTATAL, encoding='utf-8')) if e['materia'] == nombre)
    (grupo_estatal,) = estatal['criterios']
    (grupo,) = grupos
    saberes = json.loads(json.dumps(estatal['saberes'][grupo_estatal]))
    bloque_b = next(b for b in saberes if b['bloque'] == 'B')
    bloque_b['epigrafes'][-1]['items'].append(ADICION_VALORES)
    return {
        'id': id_, 'materia': nombre, 'competencias': estatal['competencias'],
        'criterios': {grupo: estatal['criterios'][grupo_estatal]}, 'saberes': {grupo: saberes},
    }


def resumen(r):
    for titulo, m in r.items():
        print(f"== {titulo} (p. {m['pagina']}): {len(m['competencias'])} competencias")
        for c in m['competencias']:
            print(f"   CE{c['n']} {c['descriptores']}  {c['texto'][:80]}")
        for nombre, g in m['grupos'].items():
            print(f"   {nombre}: {len(g['criterios'])} criterios {[c['codigo'] for c in g['criterios']]}")
            for b in g['contenidos']:
                print(f"      {b['letra']}. {b['titulo']}")
                for a in b['apartados']:
                    niveles = Counter(i['nivel'] for i in a['items'])
                    print(f"         [{a['numero'] or ''}] {a['titulo'] or ''}: {dict(sorted(niveles.items()))}")


if __name__ == '__main__':
    guiones, partidas_59, renumerados = [], [], []
    materias, en_zonas = leer()
    r = estructurar(materias, vocabulario(PDF), guiones, partidas_59, renumerados)
    comprobar_estructura(r)
    comprobar_que_no_falta_nada(r, en_zonas)
    if '--revisar' in sys.argv:
        resumen(r)
        print('Palabras partidas en el 59/2024, unidas:', ', '.join(partidas_59))
        print('Criterios con el número de otra competencia (manda la etiqueta):')
        for titulo, nombre, codigo, etiqueta in renumerados:
            print(f'   {titulo}, {nombre}: {codigo} bajo «Competencia específica {etiqueta}.»')
        print('Guiones de final de línea:')
        for (antes, despues), n in sorted(Counter(guiones).items()):
            print(f'   {antes} → {despues}' + (f' ({n})' if n > 1 else ''))
    cuenta = comprobar_texto(list(textos_de(r)), texto_plano(PDF, PRIMERA, ULTIMA))
    print('Comprobación con el texto simple:', dict(cuenta))
    # La adición de Valores, en el texto simple del anexo; la del 59/2024, en el suyo
    assert normalizar_para_comparar(ADICION_VALORES) in normalizar_para_comparar(texto_plano(PDF, 92, 92))
    plano_59 = normalizar_para_comparar(texto_plano(PDF_59))
    for titulo, m in r.items():
        for g in m['grupos'].values():
            for b in g['contenidos']:
                for a in b['apartados']:
                    for i in a['items']:
                        if i.get('del_59_2024') and normalizar_para_comparar(i['texto']) not in plano_59 \
                                and not en_trozos(normalizar_para_comparar(i['texto']), plano_59):
                            raise SystemExit(f'No está en el 59/2024: {i["texto"]}')
    SALIDA_SCRIPTS.mkdir(exist_ok=True)
    with open(SALIDA_SCRIPTS / 'eso-65-2022.json', 'w', encoding='utf-8') as f:
        json.dump(r, f, ensure_ascii=False, indent=1)
        f.write('\n')
    SALIDA_APP.mkdir(exist_ok=True)
    with open(SALIDA_APP / 'eso.es.json', 'w', encoding='utf-8') as f:
        json.dump(para_la_app(r), f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
