/**
 * Icono (512x512) y gráfico de funciones (1024x500) de la ficha de Google Play.
 *
 *   CHROMIUM=/ruta/chromium node scripts/tiendas/grafico-play.mjs <carpeta con las capturas> [carpeta de salida]
 *
 * El icono sale de `public/favicon-mini.svg` sin esquinas redondeadas (Play aplica su máscara).
 * El gráfico lleva el icono, el nombre, una frase y dos capturas del móvil de `capturas-play.mjs`.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CAPS = path.resolve(process.argv[2] || path.join(RAIZ, 'tiendas-capturas'));
const SALIDA = path.resolve(process.argv[3] || CAPS);
fs.mkdirSync(SALIDA, { recursive: true });

const svg = fs.readFileSync(path.join(RAIZ, 'public/favicon-mini.svg'), 'utf8').replace(/ rx="112"/, ' rx="0"');
const iconoPng = await sharp(Buffer.from(svg), { density: 384 }).resize(512, 512).png().toBuffer();
fs.writeFileSync(path.join(SALIDA, 'icono-512.png'), iconoPng);

const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const fuente = f => 'data:font/woff2;base64,' + fs.readFileSync(path.join(RAIZ, 'src/assets/fonts', f)).toString('base64');
const redondo = 'data:image/svg+xml;base64,' + Buffer.from(svg.replace(' rx="0"', ' rx="112"')).toString('base64');
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Outfit;font-weight:100 900;src:url(${fuente('outfit-latin-wght-normal.woff2')}) format('woff2')}
*{box-sizing:border-box;margin:0}
body{width:1024px;height:500px;overflow:hidden;font-family:Outfit,sans-serif;color:#fff;position:relative;
 background:linear-gradient(115deg,#863bff 0%,#5f6df5 55%,#47bfff 100%)}
.txt{position:absolute;left:64px;top:96px;width:480px}
.ic{width:108px;height:108px;border-radius:26px;box-shadow:0 10px 30px rgba(20,10,60,.3)}
h1{font-size:76px;font-weight:700;letter-spacing:1px;margin-top:22px;line-height:1}
p{font-size:30px;font-weight:500;line-height:1.25;margin-top:16px;opacity:.96}
.tel{position:absolute;width:236px;height:420px;border-radius:26px;border:7px solid #1b1530;overflow:hidden;background:#fff;
 box-shadow:0 18px 40px rgba(20,10,60,.4)}
.tel img{width:100%;height:100%;object-fit:cover;object-position:top}
</style>
<div class="txt"><img class="ic" src="${redondo}"><h1>AulaPro</h1><p>Evaluación LOMLOE preparada con IA. Tus datos, en tu dispositivo.</p></div>
<div class="tel" style="left:588px;top:96px;transform:rotate(-4deg)"><img src="${b64(path.join(CAPS, '03-cuaderno.png'))}"></div>
<div class="tel" style="left:790px;top:56px;transform:rotate(3deg)"><img src="${b64(path.join(CAPS, '05-situaciones.png'))}"></div>`;
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
await page.setContent(html);
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(SALIDA, 'grafico-funciones-1024x500.png') });
await browser.close();
console.log('→', SALIDA);
