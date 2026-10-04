"""
Lee las tablas de saberes básicos del anexo III del Decreto 106/2022
(Primaria, Comunitat Valenciana) y devuelve, en orden de lectura, lo que hay
en cada página: líneas de texto fuera de las tablas (títulos de bloque) y,
dentro de cada tabla, sus filas ya clasificadas.

Cada tabla tiene una columna de texto y tres de ciclo (1º, 2º y 3º), donde una
X marca, «a modo orientativo», el ciclo en que se trabaja cada saber. Las X no
se recogen: en AulaPro cada bloque lleva todos sus saberes en los tres ciclos
(decisión del dueño, 2-10-2026). Las filas pueden ser:

- `grupo`: una fila que ocupa todo el ancho (G1, G2… o un título de grupo):
  no tiene separador vertical entre la columna de texto y la de 1º ciclo.
- `cabecera`: una fila de la cabecera, con el título del subbloque a la
  izquierda y los encabezados de ciclo a la derecha. Puede ocupar varias.
- `saber`: un saber. Algunas celdas tienen varios, cada uno con su viñeta.

Las columnas se deducen de dónde están los encabezados «ciclo» («cicle») de
cada tabla; las filas, de las líneas horizontales que se ven. Lo que es de
cada área (cómo titula sus bloques y subbloques) se interpreta después, en
`primaria_cv.py`.

Uso: python3 scripts/curriculo/saberes_dogv_tablas.py PDF PRIMERA ULTIMA SALIDA.json
"""
import json
import re
import sys

import pdfplumber

MARCA = re.compile(r'^[xX]$')
VINETA = '•'
# Encabezado de columna de ciclo: «ciclo» en castellano, «cicle» en valenciano
CICLO = re.compile(r'^cicl[oe]', re.I)


def lineas_de(words):
    """Agrupa palabras en líneas por su altura."""
    words = sorted(words, key=lambda w: (round(w['top']), w['x0']))
    out = []
    for w in words:
        if out and abs(out[-1]['top'] - w['top']) < 3:
            out[-1]['words'].append(w)
        else:
            out.append({'top': w['top'], 'bottom': w['bottom'], 'words': [w]})
    for l in out:
        l['words'].sort(key=lambda w: w['x0'])
        l['x0'] = l['words'][0]['x0']
        l['x1'] = l['words'][-1]['x1']
        l['texto'] = ' '.join(w['text'] for w in l['words'])
        l['bottom'] = max(w['bottom'] for w in l['words'])
    return out


# Marca dónde se unieron dos líneas por un guion final («instru-» + «mentals»).
# Ese guion puede ser de partición de palabra o de una palabra compuesta: lo
# decide después `primaria_cv.py`, que conoce el vocabulario del anexo.
GUION_DE_LINEA = '\u00ad'


def unir(lineas):
    texto = ''
    for l in lineas:
        l = l.strip()
        if not l:
            continue
        if texto.endswith('-'):
            texto = texto[:-1] + GUION_DE_LINEA + l
        else:
            texto += ' ' + l if texto else l
    return re.sub(r'\s+', ' ', texto).strip()


def columnas_de_ciclo(words, bbox):
    """Centros de las tres columnas de ciclo, a partir de los encabezados «ciclo».
    Se toma la primera fila que tenga al menos tres, y de ella las tres de más
    a la derecha: en las lenguas hay además un «CICLO» que abarca las tres
    columnas, y en el bloque 6 de Matemáticas en valenciano la cabecera repite
    «1.er ciclo» encima de la columna de texto."""
    x0, top, x1, bottom = bbox
    cab = sorted((w for w in words if CICLO.match(w['text']) and top <= w['top'] <= bottom), key=lambda w: w['top'])
    filas_cab: list[list[dict]] = []
    for w in cab:
        if filas_cab and abs(filas_cab[-1][0]['top'] - w['top']) < 12:
            filas_cab[-1].append(w)
        else:
            filas_cab.append([w])
    for f in filas_cab:
        if len(f) >= 3:
            return [(w['x0'] + w['x1']) / 2 for w in sorted(f, key=lambda w: w['x0'])[-3:]]
    return None


def es_blanco(color):
    if color is None:
        return False
    v = color if isinstance(color, (tuple, list)) else (color,)
    # Gris o RGB: todo a 1. CMYK: todo a 0.
    return all(c >= 0.99 for c in v) or (len(v) == 4 and all(c <= 0.01 for c in v))


def bordes(p):
    """Los bordes que se ven. Las tablas en valenciano llevan detrás de cada
    línea de texto un rectángulo blanco relleno: sus lados no son bordes."""
    return [e for e in p.edges if not (e.get('fill') and not e.get('stroke') and es_blanco(e.get('non_stroking_color')))]


def filas(p, bbox):
    x0, top, x1, bottom = bbox
    ancho = x1 - x0
    ys = sorted(
        e['top'] for e in bordes(p)
        if e['orientation'] == 'h' and x0 - 2 <= e['x0'] <= x0 + ancho * 0.6
        and (e['x1'] - e['x0']) > ancho * 0.3 and top - 2 <= e['top'] <= bottom + 2
    )
    limpias = []
    for y in ys:
        if not limpias or y - limpias[-1] > 2:
            limpias.append(y)
    if not limpias or limpias[0] > top + 2:
        limpias.insert(0, top)
    if limpias[-1] < bottom - 2:
        limpias.append(bottom)
    return list(zip(limpias, limpias[1:]))


def leer_pagina(p, num, estado):
    words = p.extract_words(x_tolerance=1.5, y_tolerance=2, keep_blank_chars=False)
    # Cabecera y pie del DOGV fuera
    words = [w for w in words if 120 < w['top'] < p.height - 60]
    eventos = []
    vs = [e for e in bordes(p) if e['orientation'] == 'v']
    hs = [e for e in bordes(p) if e['orientation'] == 'h']
    tablas = [t.bbox for t in p.find_tables({
        'vertical_strategy': 'explicit', 'horizontal_strategy': 'explicit',
        'explicit_vertical_lines': vs, 'explicit_horizontal_lines': hs,
    })] if len(vs) > 1 and len(hs) > 1 else []
    # Algunas cabeceras llevan dentro sus propios recuadros, que salen como
    # tablas aparte: se quedan solo las que no están dentro de otra.
    def dentro_de(a, b):
        return a is not b and b[0] - 2 <= a[0] and b[1] - 2 <= a[1] and a[2] <= b[2] + 2 and a[3] <= b[3] + 2
    tablas = [t for t in tablas if not any(dentro_de(t, o) for o in tablas)]

    # Una fila que sigue en la página siguiente no tiene borde inferior y la
    # tabla detectada se queda corta (igual arriba, con la que viene de la
    # anterior): la tabla llega hasta donde llegan sus líneas verticales.
    def estirar(b):
        x0, top, x1, bottom = b
        vert = [e for e in vs if x0 - 2 <= e['x0'] <= x1 + 2 and e['bottom'] >= top - 2 and e['top'] <= bottom + 2]
        if not vert:
            return b
        return (x0, min(top, min(e['top'] for e in vert)), x1, max(bottom, max(e['bottom'] for e in vert)))
    tablas = [estirar(t) for t in tablas]
    usadas = set()
    for bbox in tablas:
        x0, top, x1, bottom = bbox
        dentro = [w for w in words if x0 - 1 <= (w['x0'] + w['x1']) / 2 <= x1 + 1 and top - 1 <= (w['top'] + w['bottom']) / 2 <= bottom + 1]
        for w in dentro:
            usadas.add(id(w))
        # Una tabla que sigue de la página anterior no repite la cabecera:
        # conserva las columnas que traía.
        cols = columnas_de_ciclo(dentro, bbox) or estado.get('cols')
        if cols is None:
            eventos.append({'tipo': 'tabla-sin-ciclos', 'pagina': num, 'top': top,
                            'texto': unir(l['texto'] for l in lineas_de(dentro))})
            continue
        estado['cols'] = cols
        # Límite entre la columna de texto y la primera de ciclo
        sep = cols[0] - (cols[1] - cols[0]) / 2
        # El separador vertical dibujado más cercano a ese límite
        verticales = [e for e in bordes(p) if e['orientation'] == 'v' and top - 2 <= e['top'] and e['bottom'] <= bottom + 2]
        xs_sep = [e['x0'] for e in verticales if abs(e['x0'] - sep) < (cols[1] - cols[0])]
        sep_x = min(xs_sep, key=lambda x: abs(x - sep)) if xs_sep else None

        def ocupa_todo_el_ancho(ft, fb):
            if sep_x is None:
                return False
            medio = (ft + fb) / 2
            return not any(abs(e['x0'] - sep_x) < 3 and e['top'] - 1 <= medio <= e['bottom'] + 1 for e in verticales)

        for ft, fb in filas(p, bbox):
            ws = [w for w in dentro if ft - 0.5 <= (w['top'] + w['bottom']) / 2 <= fb + 0.5]
            if not ws:
                continue
            # El texto, a la izquierda del separador dibujado si lo hay
            limite = sep_x if sep_x is not None else sep
            izq = [w for w in ws if (w['x0'] + w['x1']) / 2 < limite]
            der = [w for w in ws if (w['x0'] + w['x1']) / 2 >= limite]
            marcas = [w for w in der if MARCA.match(w['text'])]
            otros = [w for w in der if not MARCA.match(w['text'])]
            if not marcas and ocupa_todo_el_ancho(ft, fb):
                # Fila de todo el ancho: título de grupo
                eventos.append({'tipo': 'grupo', 'pagina': num, 'top': ft,
                                'texto': unir(l['texto'] for l in lineas_de(ws))})
                continue
            if otros:
                # Texto en las columnas de ciclo que no es una X: los
                # encabezados «1.º ciclo», «1.º y 2.º»… Es una fila de la
                # cabecera, que puede ocupar varias.
                eventos.append({'tipo': 'cabecera', 'pagina': num, 'top': ft,
                                'texto': unir(l['texto'] for l in lineas_de(izq))})
                continue
            lns = lineas_de(izq)
            if not lns:
                continue
            # Varios saberes en una celda, cada uno con su viñeta
            inicios = [i for i, l in enumerate(lns) if l['texto'].startswith(VINETA)]
            if len(inicios) > 1 or (inicios and inicios[0] != 0):
                trozos = []
                if inicios[0] != 0:
                    trozos.append(lns[:inicios[0]])
                for k, i in enumerate(inicios):
                    trozos.append(lns[i:inicios[k + 1] if k + 1 < len(inicios) else len(lns)])
            else:
                trozos = [lns]
            for tr in trozos:
                texto = unir(l['texto'] for l in tr)
                texto = re.sub(r'^' + VINETA + r'\s*', '', texto)
                eventos.append({'tipo': 'saber', 'pagina': num, 'top': tr[0]['top'], 'texto': texto,
                                'enCelda': len(trozos)})
    fuera = [w for w in words if id(w) not in usadas]
    for l in lineas_de(fuera):
        eventos.append({'tipo': 'texto', 'pagina': num, 'top': l['top'], 'x0': round(l['x0']), 'texto': l['texto']})
    eventos.sort(key=lambda e: e['top'])
    return eventos


def extraer(pdf, primera, ultima):
    out = []
    estado: dict = {}
    with pdfplumber.open(pdf) as doc:
        for n in range(primera, ultima + 1):
            out.extend(leer_pagina(doc.pages[n - 1], n, estado))
    return out


if __name__ == '__main__':
    pdf, primera, ultima, salida = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
    ev = extraer(pdf, primera, ultima)
    json.dump(ev, open(salida, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(len(ev), 'eventos →', salida)
