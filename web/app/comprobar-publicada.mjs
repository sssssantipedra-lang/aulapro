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
// «Sin pagar, no hay app» (1-11-2026): sin sesión, el código de las pantallas no sale (web/funciones/api/_puerta.js)
const puerta = await page.evaluate(async () => {
  const sw = await (await fetch('sw.js', { cache: 'no-store' })).text();
  const privado = JSON.parse(sw.match(/const PRIVADO = (\[.*?\]);/s)?.[1] ?? '[]');
  if (!privado.length) return { error: 'el service worker no trae la lista PRIVADO' };
  return { bloque: privado[0], estado: (await fetch(privado[0], { cache: 'no-store' })).status };
}).catch(e => ({ error: e.message }));
console.log('  Código de las pantallas sin sesión:', JSON.stringify(puerta));
if (puerta.estado !== 401) { mal++; console.log('✘ La puerta de /app/assets/ está abierta sin sesión'); } else console.log('✔ La puerta está cerrada sin sesión');
// El mismo bloque con otras formas de escribir la dirección, que el alojamiento sirve igual (las 7 que se
// saltaban la puerta en aulapro.app el 1-11-2026). Desde Node: el navegador las normaliza antes de pedirlas.
if (puerta.bloque) {
  const { origin } = new URL(url);
  const f = puerta.bloque.replace(/^assets\//, '');
  // Las terminadas en .css o .png (1-11-2026, auditoría): en Netlify la puerta no corre en esas extensiones; si el
  // alojamiento sirviera el bloque con una de ellas, saldría sin sesión. Cuenta cualquier respuesta que sea código,
  // salga con el tipo que salga (antes solo contaba si decía «javascript»).
  const variantes = [`//app/assets/${f}`, `/APP/assets/${f}`, `/app/ASSETS/${f}`, `/%61pp/assets/${f}`, `/app%2Fassets/${f}`,
    `/app/assets/${f.replace(/\.js$/, '.JS')}`, `/app/assets/${f}%20`, `/app/assets/${f}/`, `/app//assets/${f}`, `/app/%61ssets/${f}`, `/app/assets%2F${f}`,
    `/app/assets/${f}%2F.css`, `/app/assets/${f}/.css`, `/app/assets/${f};.css`, `/app/assets/${f}%3F.css`, `/app/assets/${f}%23.png`];
  for (const v of variantes) {
    const r = await fetch(origin + v, { cache: 'no-store' }).catch(() => null);
    const cuerpo = r ? await r.text() : '';
    if (r?.ok && cuerpo.length > 200 && !/^\s*</.test(cuerpo)) { mal++; console.log(`✘ La puerta se salta con ${v}`); }
  }
  console.log(`✔ Comprobadas ${variantes.length} formas de saltarse la puerta`);
}
await abrir('Segunda visita, ya guardada');
await abrir('Tercera visita');
await ctx.setOffline(true);
await abrir('Sin conexión');
await browser.close();
if (mal) { console.log(`::error::La versión web publicada falla en ${mal} comprobaciones`); process.exit(1); }
