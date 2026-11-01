/**
 * Capturas de la portada de la web (web/sitio/assets/portada/): la app de verdad,
 * con los datos de ejemplo de docente de aula y un miércoles a las 9:45, en tres
 * tamaños (portátil, tableta y móvil) y a doble densidad, para que se vean nítidas
 * en cualquier pantalla. Sustituyen al vídeo de la portada (web/DISENO.md, sección 49).
 *
 * Uso, con la app arrancada en modo desarrollo (`npm run dev`):
 *
 *   node scripts/web/capturar-portada.mjs [http://localhost:5173/]
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:5173/';
const OUT = path.resolve('web/sitio/assets/portada');
fs.mkdirSync(OUT, { recursive: true });

// nombre, tamaño de la pantalla, densidad, ancho final y qué se abre
const VISTAS = [
  { nombre: 'portatil', w: 1440, h: 900, dpr: 2, ancho: 2000, abrir: [] },
  { nombre: 'tableta', w: 1180, h: 820, dpr: 2, ancho: 1400, abrir: ['Evaluar'] },
  { nombre: 'movil', w: 390, h: 844, dpr: 3, ancho: 780, abrir: ['En clase', 'Anotar actitud'], movil: true },
];

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const v of VISTAS) {
  const ctx = await browser.newContext({
    viewport: { width: v.w, height: v.h }, deviceScaleFactor: v.dpr, locale: 'es-ES',
    isMobile: !!v.movil, hasTouch: !!v.movil,
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('Error en la app:', e.message));
  await ctx.clock.install({ time: new Date('2026-10-14T09:45:00') });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.getByText('Explorar con datos de ejemplo').click();
  await page.waitForTimeout(4500);
  for (const nombre of v.abrir) {
    if (v.movil && nombre === v.abrir[0]) {
      const menu = page.getByRole('button', { name: /menú|menu/i }).first();
      if (await menu.isVisible().catch(() => false)) { await menu.click(); await page.waitForTimeout(600); }
    }
    const el = page.getByRole('button', { name: nombre, exact: false }).or(page.getByRole('link', { name: nombre })).or(page.getByRole('tab', { name: nombre })).or(page.getByText(nombre, { exact: true })).first();
    await el.click({ timeout: 8000 }).catch(e => console.log('No se pudo abrir', nombre, e.message.split('\n')[0]));
    await page.waitForTimeout(1500);
    // en el móvil el menú se queda abierto: se cierra tocando fuera
    if (v.movil && nombre === v.abrir[0]) { await page.mouse.click(v.w - 20, v.h / 2); await page.waitForTimeout(800); }
  }
  await page.mouse.move(0, 0);
  await page.waitForTimeout(800);
  const buf = await page.screenshot();
  const file = path.join(OUT, `${v.nombre}.webp`);
  await sharp(buf).resize({ width: v.ancho }).webp({ quality: 86, effort: 6 }).toFile(file);
  console.log(file, (fs.statSync(file).size / 1024).toFixed(0), 'KB');
  await ctx.close();
}
await browser.close();
