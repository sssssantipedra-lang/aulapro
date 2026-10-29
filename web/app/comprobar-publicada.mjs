// Abre la versión web recién publicada en Cloudflare con un navegador de verdad y comprueba que
// abre la primera vez, que vuelve a abrir cuando ya la tiene guardada (el fallo del 29-10-2026:
// ERR_FAILED desde la segunda visita) y que abre sin conexión. Lo lanza web.yml tras publicar.
//
//   node web/app/comprobar-publicada.mjs https://xxxx.aulapro-app.pages.dev/app/
import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) { console.error('Falta la dirección'); process.exit(2); }
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
let mal = 0;

async function abrir(paso) {
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForFunction(() => document.body.innerText.includes('AulaPro'), null, { timeout: 30_000 });
    console.log(`✔ ${paso}`);
  } catch (e) {
    mal++;
    console.log(`✘ ${paso}: ${e.message.split('\n')[0]}`);
  }
}

await abrir('Primera visita');
// La app no se recarga sola al quedar guardada: la página sigue siendo la misma
await page.evaluate(() => { window.__sinRecargar = true; });
const guardados = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  for (let i = 0; i < 120 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 500));
  await new Promise(r => setTimeout(r, 2000));
  if (!window.__sinRecargar) return { error: 'la página se recargó sola' };
  const k = await caches.keys();
  return { activo: !!reg.active, archivos: k.length ? (await (await caches.open(k[0])).keys()).length : 0 };
}).catch(e => ({ error: e.message }));
console.log('  Guardado para usar sin conexión:', JSON.stringify(guardados));
if (!guardados.archivos) mal++;
await abrir('Segunda visita, ya guardada');
await abrir('Tercera visita');
await ctx.setOffline(true);
await abrir('Sin conexión');
await browser.close();
if (mal) { console.log(`::error::La versión web publicada falla en ${mal} comprobaciones`); process.exit(1); }
