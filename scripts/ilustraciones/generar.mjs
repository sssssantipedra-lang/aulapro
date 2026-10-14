#!/usr/bin/env node
/**
 * Genera las ilustraciones de `lista.mjs` con fal.ai y las añade al catálogo
 * de la app (`src/lib/ilustraciones.catalogo.json`), cada una con su
 * descripción y sus temas. Pensado para pocas decenas de imágenes, de una vez.
 *
 *   FAL_KEY=… node scripts/ilustraciones/generar.mjs              # genera las que faltan
 *   node scripts/ilustraciones/generar.mjs --dry                  # solo valida y cuenta (sin red ni clave)
 *   FAL_KEY=… node scripts/ilustraciones/generar.mjs --solo ani-perro,mat-reloj   # unas pocas, para ver el estilo
 *   node scripts/ilustraciones/generar.mjs --importar ani-perro=perro.png,mat-reloj=reloj.png   # imágenes ya generadas
 *
 * Por cada imagen, una llamada al modelo barato de `MODELO` (fondo blanco liso)
 * y el fondo se quita aquí, en local (`fondo.mjs`): un quitafondos de IA dejó
 * el perro con el cuerpo medio transparente. Se recorta, se cuadra a 512 px y se
 * guarda en WebP en `public/ilustraciones/<id>.webp`: va dentro de la aplicación
 * y funciona sin conexión. Las que ya están no se vuelven a generar, así que se
 * puede repetir sin gastar de más. La clave va en la variable FAL_KEY, nunca en
 * un archivo del repositorio.
 *
 * `--importar` es para cuando las imágenes se generaron por otra vía (por
 * ejemplo, el conector MCP de fal en una sesión de Claude, que no necesita red
 * ni clave en el entorno): hace solo el quitado de fondo, el WebP y la entrada
 * del catálogo, con la descripción y los temas de `lista.mjs`.
 *
 * Licencia: el modelo tiene que permitir el uso comercial de lo que genera
 * (FLUX.1 schnell, Apache-2.0, lo permite; FLUX.1 dev, no). Por eso no se
 * cambia de modelo sin revisar su licencia: `MODELOS_PERMITIDOS`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESTILO, ETAPAS, LISTA } from './lista.mjs';
import { quitarFondoBlanco } from './fondo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SALIDA = path.join(RAIZ, 'public', 'ilustraciones');
const CATALOGO = path.join(RAIZ, 'src', 'lib', 'ilustraciones.catalogo.json');

const MODELO = 'fal-ai/flux/schnell';
const MODELOS_PERMITIDOS = new Set([MODELO]);
const LADO = 512;

const USOS = new Set(['cabecera', 'mascota', 'objeto', 'escena']);
const AREAS = new Set(['matematicas', 'lengua', 'ingles', 'cienciasNaturales', 'cienciasSociales', 'musica', 'educacionFisica', 'plastica', 'valores', 'general']);

/** La lista como entradas del catálogo, o los errores que impiden generarla. */
export function entradas(lista = LISTA) {
  const errores = [];
  const vistos = new Set();
  const out = lista.map(([id, uso, sujeto, es, ca, en, temas, areas]) => {
    const donde = `«${id}»`;
    if (!/^[a-z]{2,4}-[a-z0-9-]+$/.test(id ?? '')) errores.push(`${donde}: el id es «familia-nombre» en minúscula`);
    if (vistos.has(id)) errores.push(`${donde}: id repetido`);
    vistos.add(id);
    if (!USOS.has(uso)) errores.push(`${donde}: uso «${uso}» no válido`);
    if (!sujeto?.trim()) errores.push(`${donde}: falta el sujeto para el modelo`);
    for (const [k, v] of [['es', es], ['ca', ca], ['en', en]]) if (!v?.trim()) errores.push(`${donde}: falta la descripción en ${k}`);
    if (!temas?.length) errores.push(`${donde}: faltan los temas`);
    for (const t of temas ?? []) if (t !== t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()) errores.push(`${donde}: el tema «${t}» va en minúscula y sin tildes`);
    if (!areas?.length || areas.some(a => !AREAS.has(a))) errores.push(`${donde}: áreas no válidas`);
    return { sujeto, entrada: { id, uso, descripcion: { es, ca, en }, temas, areas, etapas: ETAPAS, fuente: 'img' } };
  });
  return { out, errores };
}

async function fal(endpoint, cuerpo, clave) {
  const r = await fetch(`https://fal.run/${endpoint}`, {
    method: 'POST', headers: { Authorization: `Key ${clave}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  });
  if (!r.ok) throw new Error(`${endpoint}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function descargar(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`descarga ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function generarUna(sujeto, clave) {
  const g = await fal(MODELO, {
    prompt: `${sujeto}. ${ESTILO}`, image_size: { width: 768, height: 768 }, num_inference_steps: 4, num_images: 1, output_format: 'png', enable_safety_checker: true,
  }, clave);
  const url = g.images?.[0]?.url;
  if (!url) throw new Error('el modelo no devolvió imagen');
  return quitarFondoBlanco(await descargar(url), { lado: LADO });
}

async function leerCatalogo() {
  try { return JSON.parse(await fs.readFile(CATALOGO, 'utf8')); } catch { return []; }
}

async function guardarCatalogo(catalogo) {
  await fs.writeFile(CATALOGO, JSON.stringify([...catalogo].sort((a, b) => a.id.localeCompare(b.id)), null, 2) + '\n');
}

/** `id=ruta,id=ruta`: imágenes ya generadas, con fondo blanco, que entran al catálogo. */
async function importarImagenes(lista, out, catalogo) {
  await fs.mkdir(SALIDA, { recursive: true });
  for (const par of lista.split(',').map(s => s.trim()).filter(Boolean)) {
    const [id, ruta] = par.split('=');
    const fila = out.find(o => o.entrada.id === id);
    if (!fila) { console.error(`✗ ${id}: no está en la lista`); continue; }
    if (!ruta) { console.error(`✗ ${id}: falta la ruta (id=ruta)`); continue; }
    await fs.writeFile(path.join(SALIDA, `${id}.webp`), await quitarFondoBlanco(await fs.readFile(ruta), { lado: LADO }));
    const i = catalogo.findIndex(e => e.id === id);
    if (i >= 0) catalogo[i] = fila.entrada; else catalogo.push(fila.entrada);
    await guardarCatalogo(catalogo);
    console.log(`✓ ${id}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const valorDe = nombre => args.find(a => a.startsWith(`${nombre}=`))?.slice(nombre.length + 1) ?? (args.includes(nombre) ? args[args.indexOf(nombre) + 1] : '');
  const solo = valorDe('--solo');
  const importar = valorDe('--importar');
  const clave = process.env.FAL_KEY;
  if (!MODELOS_PERMITIDOS.has(MODELO)) throw new Error('Modelo sin licencia comercial revisada');

  const { out, errores } = entradas();
  if (errores.length) { console.error(errores.join('\n')); process.exit(1); }

  const catalogo = await leerCatalogo();
  const hechas = new Set(catalogo.map(e => e.id));
  const filtro = solo ? new Set(solo.split(',').map(s => s.trim())) : null;
  const faltan = out.filter(({ entrada }) => !hechas.has(entrada.id) && (!filtro || filtro.has(entrada.id)));
  if (filtro) for (const id of filtro) if (!out.some(o => o.entrada.id === id)) console.warn(`«${id}» no está en la lista`);

  if (importar) { await importarImagenes(importar, out, catalogo); return; }

  console.log(`${out.length} en la lista, ${hechas.size} ya en el catálogo, ${faltan.length} por generar (${faltan.length} llamadas a fal.ai).`);
  if (dry || !faltan.length) return;
  if (!clave) { console.error('Falta la variable FAL_KEY (o usa --dry).'); process.exit(1); }

  await fs.mkdir(SALIDA, { recursive: true });
  let hechasAhora = 0;
  for (const { sujeto, entrada } of faltan) {
    try {
      await fs.writeFile(path.join(SALIDA, `${entrada.id}.webp`), await generarUna(sujeto, clave));
      catalogo.push(entrada);
      hechasAhora++;
      // Se guarda a cada paso: si se corta, no se pierde ni se vuelve a pagar lo hecho
      await guardarCatalogo(catalogo);
      console.log(`✓ ${entrada.id}`);
    } catch (e) {
      console.error(`✗ ${entrada.id}: ${e.message}`);
    }
  }
  console.log(`${hechasAhora} de ${faltan.length} generadas. Revisa public/ilustraciones/ antes de publicar.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exit(1); });
