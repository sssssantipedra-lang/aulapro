#!/usr/bin/env node
/**
 * Mete en la app los pictogramas hechos con IA: quita el fondo blanco, recorta,
 * cuadra a 512 px y guarda `public/pictos/aulapro/ia-<id>.webp`. Después, el
 * pictograma se añade a `scripts/pictos/lista.py` (con «!») y se ejecuta
 * `scripts/pictos/generar.py -` para que entre en el catálogo.
 *
 *   node scripts/pictos/ia/importar.mjs --dry                                   # valida la lista, sin tocar nada
 *   node scripts/pictos/ia/importar.mjs plastilina=plastilina.png,puzle=puzle.png
 *   node scripts/pictos/ia/importar.mjs --carpeta imagenes/                     # imagenes/<id>.png|webp|jpg
 *
 * Las imágenes salen de `fal-ai/nano-banana-2` (1:1, 1K) con el prompt de
 * `lista.mjs`: `ESTILO` + el concepto de la fila. Con el conector MCP de fal en
 * una sesión de Claude se generan con `submit_jobs` y se leen con
 * `inspect_images`, que las deja como archivos locales (este entorno no deja
 * descargar de `fal.media`). Ver `docs/PTAL.md`, «Pictogramas hechos con IA».
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LISTA } from './lista.mjs';
import { quitarFondoBlanco } from '../../ilustraciones/fondo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SALIDA = path.join(RAIZ, 'public', 'pictos', 'aulapro');
const LADO = 512;
const CATEGORIAS = new Set(['estructura', 'manipulativo', 'lenguaje', 'calma']);

/** Los errores que impiden usar la lista (ids únicos, textos en los tres idiomas, categoría conocida). */
export function errores(lista = LISTA) {
  const out = [];
  const vistos = new Set();
  for (const [id, categoria, es, ca, en, concepto] of lista) {
    if (!/^[a-z]+(-[a-z0-9]+)*$/.test(id ?? '')) out.push(`«${id}»: el id va en minúscula y con guiones`);
    if (vistos.has(id)) out.push(`«${id}»: id repetido`);
    vistos.add(id);
    if (!CATEGORIAS.has(categoria)) out.push(`«${id}»: categoría «${categoria}» desconocida`);
    for (const [k, v] of [['es', es], ['ca', ca], ['en', en], ['concepto', concepto]]) if (!v?.trim()) out.push(`«${id}»: falta ${k}`);
    if (/letters|text|number/i.test(concepto ?? '') && !/no text|no letters|no numbers/i.test(concepto ?? '')) out.push(`«${id}»: el concepto no debe pedir texto ni números`);
  }
  return out;
}

async function importar(pares) {
  await fs.mkdir(SALIDA, { recursive: true });
  for (const [id, ruta] of pares) {
    if (!LISTA.some(f => f[0] === id)) { console.error(`✗ ${id}: no está en lista.mjs`); continue; }
    const webp = await quitarFondoBlanco(await fs.readFile(ruta), { lado: LADO, calidad: 88 });
    await fs.writeFile(path.join(SALIDA, `ia-${id}.webp`), webp);
    console.log(`✓ ia-${id}.webp (${Math.round(webp.length / 1024)} KB)`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const fallos = errores();
  if (fallos.length) { console.error(fallos.join('\n')); process.exit(1); }
  if (args.includes('--dry')) { console.log(`${LISTA.length} pictogramas en la lista, sin errores.`); return; }
  const i = args.indexOf('--carpeta');
  if (i >= 0) {
    const dir = args[i + 1];
    const pares = [];
    for (const n of await fs.readdir(dir)) {
      const m = /^(.+)\.(png|webp|jpe?g)$/i.exec(n);
      if (m) pares.push([m[1], path.join(dir, n)]);
    }
    await importar(pares);
    return;
  }
  const lista = args.find(a => a.includes('='));
  if (!lista) { console.error('Uso: importar.mjs id=archivo,id=archivo | --carpeta dir | --dry'); process.exit(1); }
  await importar(lista.split(',').map(p => p.trim().split('=')));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
