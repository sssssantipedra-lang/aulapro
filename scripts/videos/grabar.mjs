/**
 * Graba un vídeo explicativo sobre la app de verdad, con los datos de ejemplo.
 *
 *   npm run dev                      # la app en http://localhost:5173/
 *   node scripts/videos/grabar.mjs clave-ia [http://localhost:5173/]
 *
 * Cada escena de `guiones/<id>.mjs` tiene una frase y lo que se hace mientras
 * suena. La voz (`audio/<id>/01.mp3`, 02…) se genera aparte con fal.ai
 * (ElevenLabs v4, voz «Rachel»); aquí se mide cada frase para que la pantalla
 * espere a que acabe de hablar. Sale `web/sitio/assets/videos/<id>.mp4`
 * (720p, 30 imágenes por segundo, lo más ligero posible) y su póster.
 * Nada de lo que se ve es real: ni datos, ni claves.
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../..');
const id = process.argv[2];
const BASE = process.argv[3] || 'http://localhost:5173/';
if (!id) { console.log('Uso: node scripts/videos/grabar.mjs <id> [url]'); process.exit(1); }
const guion = (await import(`./guiones/${id}.mjs`)).default;
const W = 1280, H = 720, HUECO = 600;
// HD=1: sale a 1920x1080 (la página se dibuja a 1,5x, sin cambiar la maquetación)
const HD = process.env.HD === '1', OW = HD ? 1920 : 1280, OH = HD ? 1080 : 720;   // ms de pausa entre escenas

const dur = f => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const audios = guion.escenas.map((_, i) => path.join(AQUI, 'audio', id, String(i + 1).padStart(2, '0') + '.mp3'));
audios.forEach(a => { if (!fs.existsSync(a)) throw new Error('Falta el audio ' + a); });
const duraciones = audios.map(dur);

const tmp = fs.mkdtempSync(path.join(AQUI, '.tmp-'));
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: HD ? 1.5 : 1, locale: 'es-ES',
  recordVideo: { dir: tmp, size: { width: OW, height: OH } },
  permissions: ['clipboard-read', 'clipboard-write'],
});
const t0Ctx = Date.now();
const page = await ctx.newPage();
page.on('pageerror', e => console.log('Error en la app:', e.message));
// La comprobación de la clave de Google: en el vídeo siempre sale bien
await page.route('https://generativelanguage.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"models":[]}' }));
await guion.antes?.(page, ctx);
await ctx.clock.install({ time: new Date('2026-10-14T09:45:00') });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(2500);
if (!guion.sinDemo) {
  await page.getByText('Explorar con datos de ejemplo').click();
  await page.waitForTimeout(4500);
}
await guion.despues?.(page, ctx);   // preparar lo que ese vídeo necesita (clave de ejemplo, respuesta de la IA…)
// Cursor visible y subtítulos
await page.addStyleTag({ content: `
  .help-fab,.toast,.toast-wrap{display:none!important} *{caret-color:transparent!important}
  #v-cursor{position:fixed;z-index:99999;width:22px;height:22px;margin:-4px 0 0 -4px;border-radius:50%;background:rgba(255,120,60,.55);border:2px solid #d9531e;pointer-events:none;transition:transform .08s}
  #v-sub{position:fixed;z-index:99998;left:50%;bottom:26px;transform:translateX(-50%);max-width:78%;padding:10px 18px;border-radius:12px;background:rgba(30,24,20,.86);color:#fff;font:600 21px/1.35 system-ui,sans-serif;text-align:center;pointer-events:none}
` });
await page.evaluate(() => {
  const c = document.createElement('div'); c.id = 'v-cursor'; document.documentElement.appendChild(c);
  const s = document.createElement('div'); s.id = 'v-sub'; s.style.display = 'none'; document.documentElement.appendChild(s);
  addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => { c.style.transform = 'scale(.7)'; }, true);
  addEventListener('mouseup', () => { c.style.transform = ''; }, true);
});
await page.mouse.move(W / 2, H / 2);

const inicios = [];
const t0 = Date.now();
for (const [i, e] of guion.escenas.entries()) {
  inicios.push((Date.now() - t0) / 1000);
  await page.evaluate(t => { const s = document.getElementById('v-sub'); s.textContent = t; s.style.display = 'block'; }, e.texto);
  const fin = Date.now() + duraciones[i] * 1000 + HUECO;
  await e.hacer(page);
  const resto = fin - Date.now();
  if (resto > 0) await page.waitForTimeout(resto); else console.log(`  escena ${i + 1}: la acción tarda ${(-resto / 1000).toFixed(1)} s más que la voz`);
}
const total = (Date.now() - t0) / 1000;
await page.evaluate(() => { document.getElementById('v-sub').style.display = 'none'; });
await page.waitForTimeout(500);
const recorte = (t0 - t0Ctx) / 1000 + 0.15;   // lo que dura la carga antes de la primera escena
await ctx.close();
await browser.close();

const webm = fs.readdirSync(tmp).find(f => f.endsWith('.webm'));
const OUT = path.join(RAIZ, 'web/sitio/assets/videos');
fs.mkdirSync(OUT, { recursive: true });
const mp4 = path.join(OUT, `${id}.mp4`);
const entradas = audios.flatMap(a => ['-i', a]);
const filtros = audios.map((_, i) => `[${i + 1}:a]adelay=${Math.round(inicios[i] * 1000)}|${Math.round(inicios[i] * 1000)},aresample=32000[a${i}]`);
// Escenas con una grabación real encima (p. ej. Google AI Studio): se estira o encoge al largo de la escena
const clips = guion.escenas.flatMap((e, i) => (e.clip ? [{ i, f: path.join(AQUI, 'clips', e.clip) }] : []));
const entradasClip = clips.flatMap(c => ['-i', c.f]);
let base = `[0:v]fps=30,scale=${OW}:${OH}[v0]`;
clips.forEach((c, k) => {
  const ini = inicios[c.i], fin = c.i + 1 < inicios.length ? inicios[c.i + 1] : total;
  const k2 = (fin - ini - 0.2) / dur(c.f);
  base += `;[${audios.length + 1 + k}:v]setpts=(PTS-STARTPTS)*${k2.toFixed(4)}+${ini.toFixed(3)}/TB,fps=30,scale=${OW}:${OH}[c${k}];[v${k}][c${k}]overlay=eof_action=pass:enable='between(t,${ini.toFixed(3)},${fin.toFixed(3)})'[v${k + 1}]`;
});
const salidaV = `[v${clips.length}]`;
const graf = [base, ...filtros, audios.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${audios.length}:normalize=0[a]`].join(';');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(recorte), '-t', String(total + 0.4), '-i', path.join(tmp, webm), ...entradas, ...entradasClip,
  '-filter_complex', graf, '-map', salidaV, '-map', '[a]',
  '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '33', '-pix_fmt', 'yuv420p', '-g', '300',
  '-c:a', 'aac', '-b:a', '40k', '-ac', '1', '-movflags', '+faststart', '-t', String(total + 0.4), mp4]);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(Math.min(total * 0.6, total - 1)), '-i', mp4, '-frames:v', '1', '-vf', 'scale=640:-1', '-q:v', '6', path.join(OUT, `${id}.jpg`)]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${id}.mp4: ${total.toFixed(1)} s, ${(fs.statSync(mp4).size / 1024).toFixed(0)} KB`);
