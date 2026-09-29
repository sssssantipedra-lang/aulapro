/**
 * Iconos y pantalla de arranque de la app de Android, a partir del mismo
 * public/favicon.svg que usan Windows y Mac (ver make-icons.cjs).
 *
 * Android 8+ usa iconos «adaptativos»: un fondo y un primer plano que el
 * sistema recorta con la forma que toque (círculo, cuadrado redondeado…). Por
 * eso se separa el degradado del logo: el fondo va entero y el logo, más
 * pequeño, dentro de la zona segura central (72 de 108 dp).
 *
 * Se ejecuta con `npm run icons:android` y los PNG se guardan en el
 * repositorio (android/app/src/main/res). Solo hace falta repetirlo si cambia
 * el logo.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const svg = fs.readFileSync(path.join(ROOT, 'public', 'favicon.svg'), 'utf8');
const NAVY = '#0c2340';

/** El logo sin el cuadrado de fondo: el primer plano del icono adaptativo. */
const logoOnly = Buffer.from(svg.replace(/<rect width="512" height="512"[^>]*\/>/, ''));
/** Solo el degradado, a sangre (el sistema le pone la forma). */
const gradient = Buffer.from(svg.replace(/<rect width="512" height="512" rx="112"/, '<rect width="512" height="512" rx="0"')
  .replace(/<!-- tarjeta[\s\S]*<\/text>/, ''));

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const png = (buf, size) => sharp(buf, { density: 384 }).resize(size, size).png().toBuffer();

async function foreground(size) {
  const inner = Math.round(size * 72 / 108);
  const logo = await png(logoOnly, inner);
  const pad = Math.round((size - inner) / 2);
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, left: pad, top: pad }]).png().toBuffer();
}

async function main() {
  for (const [d, k] of Object.entries(DENSITIES)) {
    const dir = path.join(RES, `mipmap-${d}`);
    fs.mkdirSync(dir, { recursive: true });
    const legacy = Math.round(48 * k);
    const adaptive = Math.round(108 * k);

    // Icono clásico (Android 7 y lanzadores antiguos): el mismo del escritorio
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), await png(Buffer.from(svg), legacy));

    // Redondo: degradado + logo, recortado en círculo
    const bg = await png(gradient, legacy);
    const fg = await foreground(legacy);
    const circle = Buffer.from(`<svg width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`);
    const round = await sharp(bg).composite([{ input: fg }, { input: circle, blend: 'dest-in' }]).png().toBuffer();
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), round);

    // Adaptativo: fondo y primer plano por separado
    fs.writeFileSync(path.join(dir, 'ic_launcher_background.png'), await png(gradient, adaptive));
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), await foreground(adaptive));
  }

  // Pantalla de arranque: el icono sobre el azul de la barra lateral. Se
  // respetan los tamaños de las imágenes que trae la plantilla de Capacitor.
  const splashes = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name === 'splash.png') splashes.push(f);
  });
  walk(RES);
  for (const f of splashes) {
    const { width, height } = await sharp(f).metadata();
    const size = Math.round(Math.min(width, height) * 0.28);
    const icon = await png(Buffer.from(svg), size);
    const out = await sharp({ create: { width, height, channels: 3, background: NAVY } })
      .composite([{ input: icon, left: Math.round((width - size) / 2), top: Math.round((height - size) / 2) }])
      .png().toBuffer();
    fs.writeFileSync(f, out);
  }
  console.log(`Iconos de Android generados (${Object.keys(DENSITIES).length} densidades, ${splashes.length} pantallas de arranque).`);
}

main().catch(err => { console.error(err); process.exit(1); });
