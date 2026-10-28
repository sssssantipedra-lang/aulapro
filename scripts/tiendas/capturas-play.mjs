/**
 * Capturas de la ficha de Google Play (y de Microsoft Store en escritorio con `ESCRITORIO=1`),
 * hechas sobre la app de verdad con los datos de ejemplo de `scripts/web/ejemplos.mjs`.
 *
 *   npm run dev            (en otra terminal)
 *   CHROMIUM=/ruta/chromium node scripts/tiendas/capturas-play.mjs [carpeta de salida]
 *
 * Móvil: 1080x1920 (9:16, lo que pide Play). Escritorio: 1920x1080 PNG.
 * Nombres de personas: ninguno (regla 7 de CLAUDE.md): «Profesor» y «Alumno N».
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ejemplosAula, fichasAula, reunionYFormacion, nuevasAula } from '../web/ejemplos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SALIDA = path.resolve(process.argv[2] || path.join(RAIZ, 'tiendas-capturas'));
const ESCRITORIO = !!process.env.ESCRITORIO;
const BASE = process.env.BASE || 'http://127.0.0.1:5173/';
fs.mkdirSync(SALIDA, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await browser.newContext(ESCRITORIO
  ? { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: 'es-ES' }
  : { viewport: { width: 412, height: 732 }, deviceScaleFactor: 1080 / 412, isMobile: true, hasTouch: true, locale: 'es-ES' });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('Error en la app:', e.message));
await ctx.clock.install({ time: new Date('2026-10-14T09:45:00') });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(2500);
await page.getByText('Explorar con datos de ejemplo').click();
await page.waitForTimeout(4500);

const { id, data } = await page.evaluate(() => {
  const id = localStorage.getItem('aulapro_active_profile');
  return { id, data: JSON.parse(localStorage.getItem('aulapro_web_data_' + id) || '{}') };
});
const clase = n => data.classes.find(c => c.name.startsWith(n)) ?? data.classes[0];
const patch = { ...ejemplosAula({ clases: data.classes, alumnos: data.students }) };
const fa = fichasAula({ clases: data.classes });
patch.fichas = await page.evaluate(async ({ fa }) => {
  const rs = await import('/src/services/resources.ts');
  const prep = f => { f.content.actividades.forEach(a => { a.ejercicios = a.ejercicios.map(x => rs.prepareExercise(x)); }); return f; };
  return [prep(fa.lectura), prep(fa.escape), prep(fa.tarjetas)];
}, { fa });
const nuevas = nuevasAula({ clases: data.classes, sdaId: patch.learningSituations[0].id, imagenes: [] });
patch.fichas.unshift(nuevas.interactivas);
patch.ef = { ...(data.ef ?? {}), sesiones: nuevas.sesiones };
patch.workSessions = reunionYFormacion();
await page.evaluate(({ id, patch }) => {
  const k = 'aulapro_web_data_' + id;
  localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k)), ...patch }));
  localStorage.setItem('aulapro_gemini_key', 'clave-de-ejemplo-no-valida');
}, { id, patch });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);
await page.addStyleTag({ content: '*{caret-color:transparent!important} .toast,.toast-wrap,[aria-label="Ayuda de AulaPro"]{display:none!important}' });

async function menu(nombre) {
  if (!ESCRITORIO) { await page.getByRole('button', { name: 'Abrir el menú' }).click(); await page.waitForTimeout(700); }
  await page.locator('.sidebar .nav-item', { hasText: new RegExp(`^${nombre}$`) }).click();
  await page.waitForTimeout(1500);
}
const pestana = async n => { await page.locator('.hub-tab', { hasText: new RegExp(`^${n}$`) }).click(); await page.waitForTimeout(1300); };
async function foto(nombre, y = 0) {
  await page.evaluate(v => { window.scrollTo(0, v); document.querySelectorAll('main,.main,.content').forEach(e => { e.scrollTop = v; }); }, y);
  await page.waitForTimeout(500);
  const buf = await page.screenshot();
  const f = path.join(SALIDA, `${nombre}.png`);
  fs.writeFileSync(f, await (ESCRITORIO ? sharp(buf) : sharp(buf).resize(1080, 1920, { fit: 'fill' })).png().toBuffer());
  console.log('→', f);
}

await foto('01-inicio');
await menu('Mis Clases'); await foto('02-mis-clases');
await menu('Cuaderno de Notas'); await foto('03-cuaderno');
await menu('Evaluar'); await foto('04-evaluar');
await menu('Documentos'); await pestana('Situaciones de aprendizaje'); await foto('05-situaciones');
await menu('Documentos'); await pestana('Recursos'); await foto('06-recursos');
await menu('En clase'); await pestana('Anotar actitud'); await foto('07-actitud');
await menu('Agenda'); await foto('08-agenda');
await browser.close();
