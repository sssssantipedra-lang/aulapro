"""
Genera los pictogramas de la agenda visual de PT y AL a partir de Mulberry
Symbols (CC BY-SA 4.0). Uso, desde la raíz del repositorio:

    git clone --depth 1 https://github.com/mulberrysymbols/mulberry-symbols.git /tmp/mulberry
    python3 scripts/pictos/generar.py /tmp/mulberry

Copia los elegidos en `lista.py` a `public/pictos/mulberry/` con un nombre
corto, los optimiza con svgo (sin cambiar el dibujo) y escribe
`src/lib/pictos.ts`. Para añadir uno: se añade a `lista.py` y se vuelve a
ejecutar.
"""
import json, os, re, shutil, subprocess, sys, tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
repo = sys.argv[1]
exec(open(os.path.join(AQUI, 'lista.py'), encoding='utf-8').read())

NOMBRES = {
    'rutinas': ('Rutinas', 'Rutines', 'Routines'), 'clase': ('En clase', 'A classe', 'In class'),
    'material': ('Material', 'Material', 'Materials'), 'acciones': ('Acciones', 'Accions', 'Actions'),
    'emociones': ('Cómo me siento', 'Com em sento', 'Feelings'), 'personas': ('Personas', 'Persones', 'People'),
    'comida': ('Comida', 'Menjar', 'Food'), 'lugares': ('Lugares', 'Llocs', 'Places'),
    'juego': ('Juego', 'Joc', 'Play'), 'tiempo': ('Cuándo', 'Quan', 'When'),
}

def ident(n):
    i = n.lower().replace('_,_to', '').replace(',_go_to_the', '-go').replace(',', '')
    return re.sub(r'[^a-z0-9]+', '-', i).strip('-')

def q(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"

cat, vistos = [], set()
tmp = tempfile.mkdtemp()
for c, xs in L.items():
    for f, es, ca, en in xs:
        i = ident(f)
        assert i not in vistos, i
        vistos.add(i)
        shutil.copy(os.path.join(repo, 'EN', f + '.svg'), os.path.join(tmp, i + '.svg'))
        cat.append(dict(id=i, c=c, es=es, ca=ca, en=en))

dst = os.path.join(RAIZ, 'public', 'pictos', 'mulberry')
shutil.rmtree(dst, ignore_errors=True)
os.makedirs(dst)
subprocess.run(['npx', '--yes', 'svgo@3', '-q', '--config', os.path.join(AQUI, 'svgo.config.cjs'), '-f', tmp, '-o', dst], check=True)
shutil.copy(os.path.join(repo, 'LICENSE.txt'), os.path.join(dst, 'LICENSE.txt'))

out = open(os.path.join(AQUI, 'plantilla.ts.txt'), encoding='utf-8').read()
out = out.replace('/*CATEGORIAS_TIPO*/', '\n  | '.join(q(c) for c in NOMBRES))
out = out.replace('/*CATEGORIAS*/', '\n'.join(
    f'  {{ id: {q(c)}, es: {q(es)}, ca: {q(ca)}, en: {q(en)} }},' for c, (es, ca, en) in NOMBRES.items()))
out = out.replace('/*PICTOS*/', '\n'.join(
    f"  {{ id: {q(p['id'])}, categoria: {q(p['c'])}, es: {q(p['es'])}, ca: {q(p['ca'])}, en: {q(p['en'])} }}," for p in cat))
open(os.path.join(RAIZ, 'src', 'lib', 'pictos.ts'), 'w', encoding='utf-8').write(out)
print(len(cat), 'pictogramas')
