"""
Lee las tablas de saberes básicos del anexo III del Decreto 106/2022
(Primaria, Comunitat Valenciana) y devuelve, en orden de lectura, lo que hay
en cada página: líneas de texto fuera de las tablas (títulos de bloque) y,
dentro de cada tabla, sus filas ya clasificadas.

Cada tabla tiene una columna de texto y tres de ciclo (1º, 2º y 3º), donde una
X marca, «a modo orientativo», el ciclo en que se trabaja cada saber. Las
filas pueden ser:

- `cabecera`: la del título del subbloque y los encabezados de ciclo.
- `grupo`: una fila que ocupa todo el ancho (G1, G2… o un título de grupo):
  no tiene separador vertical entre la columna de texto y la de 1º ciclo.
- `saber`: un saber con sus marcas. Algunas celdas (Conocimiento del Medio)
  tienen varios saberes con viñeta y las X apiladas en la celda de al lado,
  no siempre a la altura exacta de su saber: la columna de X se va
  desplazando. Por eso, en cada columna, las X se reparten entre los saberes
  en el mismo orden (de arriba abajo, una por saber como mucho) buscando la
  menor distancia total, en vez de mirar solo qué saber tienen al lado.

Las columnas se deducen de dónde están los encabezados «ciclo» de cada tabla;
las filas, de las líneas horizontales. Lo que es de cada área (cómo titula sus
bloques y subbloques) se interpreta después, en `primaria_cv.py`.

Uso: python3 scripts/curriculo/saberes_dogv_tablas.py PDF PRIMERA ULTIMA SALIDA.json
"""
import json
import re
import sys

import pdfplumber

MARCA = re.compile(r'^[xX]$')
VINETA = '•'


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


def unir(lineas):
    texto = ''
    for l in lineas:
        l = l.strip()
        if not l:
            continue
        texto += l if (texto.endswith('-') or not texto) else ' ' + l
    return re.sub(r'\s+', ' ', texto).strip()


def columnas_de_ciclo(words, bbox):
    """Centros de las tres columnas de ciclo, a partir de los encabezados «ciclo»."""
    x0, top, x1, bottom = bbox
    cab = [w for w in words if w['text'].lower().startswith('ciclo') and top <= w['top'] <= bottom]
    if len(cab) < 3:
        return None
    # Los tres más altos de la tabla (la primera cabecera)
    primera = min(w['top'] for w in cab)
    cab = sorted([w for w in cab if w['top'] - primera < 12], key=lambda w: w['x0'])
    if len(cab) != 3:
        return None
    return [(w['x0'] + w['x1']) / 2 for w in cab]


def filas(p, bbox):
    x0, top, x1, bottom = bbox
    ancho = x1 - x0
    ys = sorted(
        e['top'] for e in p.edges
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


def asignar_en_orden(ys_marcas, ys_saberes):
    """Reparte las marcas de una columna entre los saberes, respetando el orden
    y como mucho una por saber, con la menor suma de distancias verticales.
    Devuelve, para cada marca, el índice del saber."""
    m, n = len(ys_marcas), len(ys_saberes)
    if m > n:
        raise ValueError(f'{m} marcas para {n} saberes')
    INF = float('inf')
    # coste[i][j]: mejor coste colocando las i primeras marcas en los j primeros saberes
    coste = [[INF] * (n + 1) for _ in range(m + 1)]
    for j in range(n + 1):
        coste[0][j] = 0
    for i in range(1, m + 1):
        for j in range(i, n + 1):
            coste[i][j] = min(coste[i][j - 1], coste[i - 1][j - 1] + abs(ys_marcas[i - 1] - ys_saberes[j - 1]))
    out, j = [], n
    for i in range(m, 0, -1):
        while coste[i][j] == coste[i][j - 1] and j > i:
            j -= 1
        out.append(j - 1)
        j -= 1
    return out[::-1]


def leer_pagina(p, num, estado):
    words = p.extract_words(x_tolerance=1.5, y_tolerance=2, keep_blank_chars=False)
    # Cabecera y pie del DOGV fuera
    words = [w for w in words if 120 < w['top'] < p.height - 60]
    eventos = []
    tablas = [t.bbox for t in p.find_tables()]
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
        verticales = [e for e in p.edges if e['orientation'] == 'v' and top - 2 <= e['top'] and e['bottom'] <= bottom + 2]
        xs_sep = [e['x0'] for e in verticales if abs(e['x0'] - sep) < (cols[1] - cols[0])]
        sep_x = min(xs_sep, key=lambda x: abs(x - sep)) if xs_sep else None

        def ocupa_todo_el_ancho(ft, fb):
            if sep_x is None:
                return False
            medio = (ft + fb) / 2
            return not any(abs(e['x0'] - sep_x) < 3 and e['top'] - 1 <= medio <= e['bottom'] + 1 for e in verticales)

        def ciclo_de(w):
            cx = (w['x0'] + w['x1']) / 2
            return min(range(3), key=lambda i: abs(cols[i] - cx)) + 1

        for ft, fb in filas(p, bbox):
            ws = [w for w in dentro if ft - 0.5 <= (w['top'] + w['bottom']) / 2 <= fb + 0.5]
            if not ws:
                continue
            izq = [w for w in ws if (w['x0'] + w['x1']) / 2 < sep]
            der = [w for w in ws if (w['x0'] + w['x1']) / 2 >= sep]
            marcas = [w for w in der if MARCA.match(w['text'])]
            otros = [w for w in der if not MARCA.match(w['text'])]
            if any(w['text'].lower().startswith('ciclo') for w in otros):
                eventos.append({'tipo': 'cabecera', 'pagina': num, 'top': ft,
                                'texto': unir(l['texto'] for l in lineas_de(izq))})
                continue
            if not marcas and (otros or ocupa_todo_el_ancho(ft, fb)):
                # Fila de todo el ancho: título de grupo
                eventos.append({'tipo': 'grupo', 'pagina': num, 'top': ft,
                                'texto': unir(l['texto'] for l in lineas_de(ws))})
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
            # Altura de referencia de cada saber: el centro de su primera línea
            ref = [(tr[0]['top'] + tr[0]['bottom']) / 2 for tr in trozos]
            ciclos = [set() for _ in trozos]
            for c in (1, 2, 3):
                col = sorted((m for m in marcas if ciclo_de(m) == c), key=lambda m: m['top'])
                if not col:
                    continue
                if len(trozos) == 1:
                    ciclos[0].add(c)
                    continue
                for idx in asignar_en_orden([(m['top'] + m['bottom']) / 2 for m in col], ref):
                    ciclos[idx].add(c)
            for k, tr in enumerate(trozos):
                texto = unir(l['texto'] for l in tr)
                texto = re.sub(r'^' + VINETA + r'\s*', '', texto)
                eventos.append({'tipo': 'saber', 'pagina': num, 'top': tr[0]['top'], 'texto': texto,
                                'ciclos': sorted(ciclos[k]), 'enCelda': len(trozos)})
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
