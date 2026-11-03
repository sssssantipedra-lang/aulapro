"""Comprobación de los currículos de Andalucía (`andalucia_primaria.py`, `andalucia_eso.py`) de que no falta
ni sobra nada: cada texto tiene que estar, letra a letra (sin
espacios ni guiones), en la columna de su tabla leída celda a celda con `extract_tables` de
pdfplumber (otro camino: usa las líneas de la tabla, no el reparto por palabras). La columna j
de todas las tablas con el mismo número de columnas, en orden de página, forma un solo texto:
así un criterio que sigue en la página siguiente queda junto. Detrás de cada texto tiene que venir el
código del siguiente (o una cabecera, o el final): así tampoco puede faltar el final.

Uso:
    python3 scripts/curriculo/comprobar_celdas.py DATOS.json PDF [PDF…]
"""
import json, re, sys
from collections import defaultdict
import pdfplumber
datos, *pdfs = sys.argv[1:]
norm = lambda t: re.sub(r'[\s\-­]+', '', t or '')
corrientes = defaultdict(list)
for ruta in pdfs:
    with pdfplumber.open(ruta) as pdf:
        for p in pdf.pages:
            for t in p.extract_tables():
                n = max(len(f) for f in t)
                for j in range(n):
                    corrientes[(n, j)].append(''.join(norm(f[j]) for f in t if j < len(f)))
todo = {k: ''.join(v) for k, v in corrientes.items()}
d = json.load(open(datos))
textos = []
for e in d:
    if e.get('id') == 'segunda-lengua-extranjera': continue
    for g, cs in e['criterios'].items():
        for c in cs: textos.append(('crit', f"{e['id']} {g} {c['codigo']}", c['texto'], c['codigo']))
    for g, bs in (e['saberes'].items() if isinstance(e['saberes'], dict) else [('*', e['saberes'])]):
        for b in bs:
            for ep in b['epigrafes']:
                for it in ep['items']: textos.append(('saber', f"{e['id']} {g}", it, ''))
SIGUE = re.compile(r'(\d{1,2}\.\d{1,2}\.(?:[ab]\.?)?\D|[A-Z]{3}\.\d\.[A-Z]\.?\d|[A-H]\.[A-ZÁÉÍÓÚ]|Criterios|Saberes|Competencias|PRIMER|SEGUNDO|TERCER|$)')
bien = 0; malos = []; cortos = []
for clase, donde, t, cod in textos:
    x = norm((cod + '.' if cod else '') + t)
    y = norm(t)
    hallado = entero = False
    for s in todo.values():
        for pat in (x, y):
            i = s.find(pat)
            while i >= 0:
                hallado = True
                if SIGUE.match(s[i + len(pat):i + len(pat) + 14]): entero = True; break
                i = s.find(pat, i + 1)
            if entero: break
        if entero: break
    if entero: bien += 1
    elif hallado:
        s0 = next(s for s in todo.values() if y in s); i = s0.find(y)
        cortos.append((clase, donde, t + '   ⟶ ' + s0[i + len(y):i + len(y) + 30]))
    else: malos.append((clase, donde, t))
print('detrás de', len(cortos), 'no viene el código siguiente:')
for m in cortos[:20]: print(' ~', m[0], m[1], '|', m[2][-120:])
print(len(textos), 'textos;', bien, 'están enteros en su columna;', len(malos), 'no')
for m in malos[:40]: print(' ·', m[0], m[1], '|', m[2][:200])
