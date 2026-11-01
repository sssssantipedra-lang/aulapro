/**
 * Capturas de la portada de la web (web/sitio/assets/portada/): la app de verdad,
 * con los datos de ejemplo de docente de aula y un miércoles a las 9:45, a doble o
 * triple densidad, para que se vean nítidas en cualquier pantalla. La portada las
 * mueve con el scroll (web/DISENO.md, sección 49):
 *
 * - en el portátil: Inicio, una situación de aprendizaje, una rúbrica e informes;
 * - en la tableta: Evaluar;
 * - en el móvil: Anotar actitud.
 *
 * Como la app de ejemplo no trae nada de lo que crea la IA, se le suman la situación
 * de aprendizaje y el informe de `ejemplos.mjs` (los mismos que la demo).
 *
 * Uso, con la app arrancada en modo desarrollo (`npm run dev`):
 *
 *   node scripts/web/capturar-portada.mjs [http://localhost:5173/]
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

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

/** Abre la app de ejemplo de docente de aula en una ventana de ese tamaño, con los ejemplos de la IA sumados. */
async function abrir({ w, h, dpr, movil = false }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, locale: 'es-ES', isMobile: movil, hasTouch: movil });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('Error en la app:', e.message));
  await ctx.clock.install({ time: new Date('2026-10-14T09:45:00') });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.getByText('Explorar con datos de ejemplo').click();
  await page.waitForTimeout(4500);
  return { ctx, page };
}

/** Suma a los datos de la app la situación de aprendizaje y el informe de ejemplo, y recarga. */
async function sumarEjemplos(page) {
  const data = await page.evaluate(() => {
    const id = localStorage.getItem('aulapro_active_profile');
    return JSON.parse(localStorage.getItem('aulapro_web_data_' + id) || '{}');
  });
  const { reports, learningSituations } = ejemplosAula({ clases: data.classes, alumnos: data.students });
  await page.evaluate(patch => {
    const id = localStorage.getItem('aulapro_active_profile');
    const k = 'aulapro_web_data_' + id;
    localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k)), ...patch }));
    localStorage.setItem('aulapro_gemini_key', 'clave-de-ejemplo-no-valida');   // para que la app no pida la clave: no se conecta a nada
  }, { reports, learningSituations });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  await page.addStyleTag({ content: '*{caret-color:transparent!important} .toast,.toast-wrap{display:none!important}' });
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
async function elegir(page, select, texto) {
  const v = await select.locator('option').evaluateAll((os, t) => (os.find(o => o.textContent.trim().startsWith(t)) ?? os.find(o => o.value))?.value, texto);
  await select.selectOption(v);
  await page.waitForTimeout(400);
}

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

  await menu(page, 'Documentos');
  await pestana(page, 'Informes');
  await page.locator('main').getByText('Alumno 1', { exact: true }).first().click();
  await page.waitForTimeout(900);
  await guardar(page, 'informes', 2000);

  // La rúbrica, al evaluar a un alumno: los niveles y sus descriptores
  await menu(page, 'Evaluar');
  await pestana(page, 'Rúbricas');
  await page.locator('main').getByRole('button', { name: 'Evaluar alumno' }).first().click();
  await page.waitForTimeout(900);
  const dlg = page.locator('.modal-overlay').filter({ has: page.locator('table') }).last();
  const selects = dlg.locator('select');
  await elegir(page, selects.nth(0), '4º Primaria A');
  const alumnos = await selects.nth(1).locator('option').evaluateAll(os => os.map(o => o.value).filter(Boolean));
  await selects.nth(1).selectOption(alumnos[2]);
  await page.waitForTimeout(400);
  // Unos niveles ya marcados, como a mitad de evaluar
  const filas = dlg.locator('tbody tr');
  for (const [fila, nivel] of [[0, 3], [1, 2]]) await filas.nth(fila).locator('td').nth(nivel + 1).click().catch(() => {});
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
