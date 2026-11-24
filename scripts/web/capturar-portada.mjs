/**
 * Capturas de la portada de la web (web/sitio/assets/portada/): la app de verdad,
 * con los datos de ejemplo de docente de aula y un miércoles a las 9:45, a doble o
 * triple densidad, para que se vean nítidas en cualquier pantalla. La portada las
 * mueve con el scroll (web/DISENO.md, sección 49):
 *
 * - en el portátil: Inicio, una situación de aprendizaje, «Evaluar a la clase» con una rúbrica
 *   (el primero de la lista ya guardado y el segundo a medias) y un informe de seguimiento;
 * - en la tableta: Evaluar;
 * - en el móvil: Anotar actitud.
 *
 * Como la app de ejemplo no trae nada de lo que crea la IA, se le suma la situación de
 * aprendizaje de `ejemplos.mjs` (la misma que la demo). El informe es el de seguimiento, que
 * la app compone al instante y sin IA: se crean los de toda la clase, como en la demo.
 * Desde el 20-11-2026 la clase de cada pantalla la decide la app (la clase activa): con ese
 * reloj es la que está en marcha, 5º Primaria A.
 *
 * Uso, con la app arrancada en modo desarrollo (`npm run dev`):
 *
 *   node scripts/web/capturar-portada.mjs [http://localhost:5173/]
 *
 * Mientras se ejecuta no hay que guardar ningún archivo del repositorio: el servidor de desarrollo recarga la página.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ejemplosAula } from './ejemplos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = process.argv[2] || 'http://localhost:5173/';
const OUT = path.join(RAIZ, 'web/sitio/assets/portada');
fs.mkdirSync(OUT, { recursive: true });

// `LANG`: el formato de los campos de fecha nativos sale del idioma del navegador, no del de la página
const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), env: { ...process.env, LANG: 'es_ES.UTF-8', LANGUAGE: 'es' } });

/** Abre la app de ejemplo de docente de aula en una ventana de ese tamaño, con los ejemplos de la IA sumados. */
async function abrir({ w, h, dpr, movil = false }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, locale: 'es-ES', isMobile: movil, hasTouch: movil });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('Error en la app:', e.message));
  // Sin cursor parpadeando ni avisos pasajeros (el de «Deshacer» dura diez segundos), en cada carga de la página
  await ctx.addInitScript(() => {
    const poner = () => {
      const st = document.createElement('style');
      st.textContent = '*{caret-color:transparent!important} .toast,.toast-wrap,.deshacer{display:none!important}';
      document.head.append(st);
    };
    if (document.head) poner(); else document.addEventListener('DOMContentLoaded', poner);
  });
  await ctx.clock.install({ time: new Date('2026-10-14T09:45:00') });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.getByText('Explorar con datos de ejemplo').click();
  await page.waitForTimeout(4500);
  return { ctx, page };
}

/** Suma a los datos de la app la situación de aprendizaje de ejemplo, y recarga. */
async function sumarEjemplos(page) {
  const data = await page.evaluate(() => {
    const id = localStorage.getItem('aulapro_active_profile');
    return JSON.parse(localStorage.getItem('aulapro_web_data_' + id) || '{}');
  });
  const { learningSituations } = ejemplosAula({ clases: data.classes, alumnos: data.students });
  await page.evaluate(patch => {
    const id = localStorage.getItem('aulapro_active_profile');
    const k = 'aulapro_web_data_' + id;
    localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k)), ...patch }));
    localStorage.setItem('aulapro_gemini_key', 'clave-de-ejemplo-no-valida');   // para que la app no pida la clave: no se conecta a nada
  }, { learningSituations });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
}

async function guardar(page, nombre, ancho) {
  await page.addStyleTag({ content: '.help-fab{display:none!important}' });   // el botón de ayuda tapa parte de la pantalla
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(700);
  const file = path.join(OUT, `${nombre}.webp`);
  await sharp(await page.screenshot()).resize({ width: ancho }).webp({ quality: 86, effort: 6 }).toFile(file);
  console.log(`· ${nombre}.webp`, (fs.statSync(file).size / 1024).toFixed(0), 'KB');
}

const menu = (page, nombre) => page.locator('.sidebar .nav-item', { hasText: new RegExp(`^${nombre}$`) }).click().then(() => page.waitForTimeout(1300));
const pestana = (page, nombre) => page.locator('.hub-tab', { hasText: new RegExp(`^${nombre}$`) }).click().then(() => page.waitForTimeout(1300));

/* ── El portátil: 1440 x 900 a doble densidad ── */
{
  const { ctx, page } = await abrir({ w: 1440, h: 900, dpr: 2 });
  await sumarEjemplos(page);
  await menu(page, 'Inicio');
  await guardar(page, 'portatil', 2000);

  await menu(page, 'Documentos');
  await pestana(page, 'Situaciones de aprendizaje');
  await page.getByText('Un mercado sostenible en el patio').first().click();
  await page.waitForTimeout(1500);
  await guardar(page, 'sda', 2000);

  // Los informes de seguimiento de toda la clase, creados de una vez y sin IA; a la vista, el de un alumno que tiene de todo
  await menu(page, 'Documentos');
  await pestana(page, 'Informes');
  await page.locator('main').getByRole('button', { name: 'Informes de seguimiento de la clase' }).click();
  await page.waitForTimeout(1500);
  await page.locator('main').getByRole('button', { name: /Alumno 52$/ }).first().click();
  await page.waitForTimeout(900);
  await guardar(page, 'informes', 2000);

  // «Evaluar a la clase» con una rúbrica, a mitad de evaluar: el primero de la lista ya guardado y, en el segundo, dos niveles marcados
  await menu(page, 'Evaluar');
  await pestana(page, 'Rúbricas');
  await page.locator('main').getByRole('button', { name: 'Evaluar a la clase' }).first().click();
  await page.waitForTimeout(900);
  const dlg = page.locator('.modal-overlay.open').last();
  const filas = dlg.locator('table tbody tr');
  for (const [fila, nivel] of [[0, 3], [1, 4], [2, 3]]) await filas.nth(fila).locator('td').nth(nivel).click();
  await dlg.getByRole('button', { name: 'Guardar y siguiente' }).click();
  await page.waitForTimeout(500);
  for (const [fila, nivel] of [[0, 4], [1, 3]]) await filas.nth(fila).locator('td').nth(nivel).click();
  await page.waitForTimeout(500);
  await guardar(page, 'rubrica', 2000);
  await ctx.close();
}

/* ── La tableta: 1180 x 820 a doble densidad ── */
{
  const { ctx, page } = await abrir({ w: 1180, h: 820, dpr: 2 });
  await menu(page, 'Evaluar');
  await guardar(page, 'tableta', 1400);
  await ctx.close();
}

/* ── El móvil: 390 x 844 a triple densidad ── */
{
  const { ctx, page } = await abrir({ w: 390, h: 844, dpr: 3, movil: true });
  const boton = page.getByRole('button', { name: /menú|menu/i }).first();
  if (await boton.isVisible().catch(() => false)) { await boton.click(); await page.waitForTimeout(600); }
  await page.locator('.sidebar .nav-item', { hasText: /^En clase$/ }).click();
  await page.waitForTimeout(1500);
  await page.mouse.click(370, 422);   // el menú se queda abierto: se cierra tocando fuera
  await page.waitForTimeout(800);
  await page.getByText('Anotar actitud', { exact: true }).first().click();
  await page.waitForTimeout(1500);
  await guardar(page, 'movil', 780);
  await ctx.close();
}
await browser.close();
