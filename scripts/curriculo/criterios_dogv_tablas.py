"""
Extrae los criterios de evaluación por ciclo de las tablas giradas del DOGV.

El Decreto 96/2026 (que modifica el 106/2022 de Primaria) publica los nuevos
criterios de cada área en tablas de tres columnas (1º, 2º y 3º ciclo) impresas
de lado. La extracción de texto normal las desordena, así que aquí:

1. Se enderezan las páginas indicadas (el giro pasa al contenido).
2. Se toman las palabras con sus coordenadas de `pdftotext -bbox-layout`, que
   separa bien las palabras en este texto justificado (pdfplumber no).
3. Se localizan las tablas por sus separadores de columna (con `pdfplumber`,
   incluidas las curvas: algunas filas tienen el separador dibujado así) y se
   asigna cada palabra a su ciclo por la columna en que cae.
4. Fuera de las tablas quedan los títulos: el área («apartado 6 del área …») y
   la competencia («Competencia específica N. …»).
5. Un criterio empieza en una línea que comienza por su código («1.3.», o
   «7.1» sin punto, que también aparece así en el texto oficial).

Uso:
    python3 scripts/curriculo/criterios_dogv_tablas.py PDF PRIMERA ULTIMA SALIDA.json

Dependencias: pypdf, pdfplumber y pdftotext (poppler-utils).
Las comprobaciones de que el resultado es fiel están en `docs/COMUNIDADES.md`.
"""
import html
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import pdfplumber
from pypdf import PdfReader, PdfWriter

# Columnas de la tabla en la página ya enderezada: 1º, 2º y 3º ciclo.
COLS = [(109, 304), (304, 500), (500, 696)]
SEPARADOR_X = 304  # separador entre 1º y 2º ciclo: marca dónde hay tabla


def enderezar(pdf: str, primera: int, ultima: int, salida: Path) -> None:
    r = PdfReader(pdf)
    w = PdfWriter()
    for i in range(primera - 1, ultima):
        p = r.pages[i]
        p.rotate(90)
        p.transfer_rotation_to_content()
        w.add_page(p)
    w.write(salida)


def palabras_por_pagina(pdf: Path) -> list[list[dict]]:
    bbox = pdf.with_suffix('.bbox.html')
    subprocess.run(['pdftotext', '-bbox-layout', str(pdf), str(bbox)], check=True)
    raw = bbox.read_text(encoding='utf-8')
    paginas = []
    for cuerpo in re.findall(r'<page [^>]*>(.*?)</page>', raw, re.S):
        ws = []
        for m in re.finditer(
            r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', cuerpo,
        ):
            x0, t, x1, b, txt = m.groups()
            ws.append({'x0': float(x0), 'top': float(t), 'x1': float(x1), 'bottom': float(b), 'text': html.unescape(txt)})
        paginas.append(ws)
    return paginas


def tramos_de_tabla(p) -> list[list[float]]:
    segs = sorted(
        (e['top'], e['bottom']) for e in p.edges
        if e['orientation'] == 'v' and abs(e['x0'] - SEPARADOR_X) < 3 and (e['bottom'] - e['top']) > 5
    )
    tramos: list[list[float]] = []
    for t, b in segs:
        if tramos and t <= tramos[-1][1] + 3:
            tramos[-1][1] = max(tramos[-1][1], b)
        else:
            tramos.append([t, b])
    return tramos


def lineas(words: list[dict]) -> list[tuple[float, str]]:
    words = sorted(words, key=lambda w: (round(w['top']), w['x0']))
    out: list[dict] = []
    for w in words:
        if out and abs(out[-1]['top'] - w['top']) < 3:
            out[-1]['words'].append(w)
        else:
            out.append({'top': w['top'], 'words': [w]})
    return [(l['top'], ' '.join(x['text'] for x in sorted(l['words'], key=lambda w: w['x0']))) for l in out]


INICIO = re.compile(r'^(\d+)\s?\.\s?(\d+)(\.?)\s+(.*)$')


def separar_criterios(lns: list[str]) -> tuple[list[dict], str]:
    out: list[dict] = []
    suelto: list[str] = []
    for l in lns:
        m = INICIO.match(l)
        if m:
            out.append({'codigo': f'{m.group(1)}.{m.group(2)}', 'puntoTrasCodigo': bool(m.group(3)), 'lineas': [m.group(4)]})
        elif out:
            out[-1]['lineas'].append(l)
        else:
            suelto.append(l)
    for c in out:
        # Una palabra compuesta partida al final de línea («colaboración-» +
        # «oposición») conserva el guion, pero sin el espacio del salto.
        texto = ''
        for l in c.pop('lineas'):
            texto += l if (texto.endswith('-') or not texto) else ' ' + l
        c['texto'] = re.sub(r'\s+', ' ', texto).strip()
    return out, ' '.join(suelto)


def extraer(pdf: str, primera: int, ultima: int) -> list[dict]:
    with tempfile.TemporaryDirectory() as tmp:
        derecho = Path(tmp) / 'derecho.pdf'
        enderezar(pdf, primera, ultima, derecho)
        palabras = palabras_por_pagina(derecho)
        eventos = []
        with pdfplumber.open(derecho) as doc:
            for pi, p in enumerate(doc.pages):
                tramos = tramos_de_tabla(p)
                ws = [w for w in palabras[pi] if 40 < w['top'] < 560 and 100 < w['x0'] < 700]

                def en_tabla(w):
                    cy = (w['top'] + w['bottom']) / 2
                    return any(t - 1 <= cy <= b + 1 for t, b in tramos)

                for top, texto in lineas([w for w in ws if not en_tabla(w)]):
                    eventos.append(('libre', pi + primera, top, None, texto))
                for ci, (x0, x1) in enumerate(COLS):
                    cw = [w for w in ws if en_tabla(w) and x0 <= (w['x0'] + w['x1']) / 2 < x1]
                    for top, texto in lineas(cw):
                        eventos.append(('celda', pi + primera, top, ci, texto))
    eventos.sort(key=lambda e: (e[1], e[2]))

    areas: list[dict] = []
    area = comp = None
    celdas: dict[int, list[str]] = {0: [], 1: [], 2: []}
    libres: list[str] = []

    def volcar():
        nonlocal celdas
        if comp is not None:
            for ci in range(3):
                comp.setdefault('_celdas', {}).setdefault(str(ci + 1), []).extend(celdas[ci])
        celdas = {0: [], 1: [], 2: []}

    for tipo, pagina, _top, col, texto in eventos:
        if tipo == 'libre':
            libres.append(texto)
            continue
        if libres:
            volcar()
            junto = ' '.join(libres)
            libres = []
            m_area = re.search(r'apartado 6 de(?:l área| las áreas) (.+?), sobre criterios', junto)
            if m_area:
                area = {'area': m_area.group(1), 'competencias': []}
                areas.append(area)
            m_comp = re.search(r'Competencia específica (\d+)\.\s*(.+)$', junto)
            if m_comp:
                comp = {'n': int(m_comp.group(1)), 'texto': m_comp.group(2).strip(), 'pagina': pagina}
                area['competencias'].append(comp)
        if texto.strip() in ('1º ciclo', '2º ciclo', '3º ciclo'):
            continue
        celdas[col].append(texto)
    volcar()

    for a in areas:
        for c in a['competencias']:
            c['criterios'] = {}
            for ciclo, lns in c.pop('_celdas', {}).items():
                crits, suelto = separar_criterios(lns)
                if suelto:
                    raise SystemExit(f"{a['area']} CE{c['n']} ciclo {ciclo}: texto antes del primer criterio: {suelto[:80]}")
                c['criterios'][ciclo] = crits
    return areas


if __name__ == '__main__':
    pdf, primera, ultima, salida = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
    areas = extraer(pdf, primera, ultima)
    Path(salida).write_text(json.dumps(areas, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    total = sum(len(v) for a in areas for c in a['competencias'] for v in c['criterios'].values())
    print(f'{len(areas)} áreas, {total} criterios → {salida}')
