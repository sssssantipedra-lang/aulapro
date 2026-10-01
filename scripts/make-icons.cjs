/**
 * Genera los iconos de la aplicación a partir de public/favicon.svg.
 *
 * electron-builder necesita un .ico para Windows y la ventana de Electron
 * también, pero en el proyecto solo había SVG: por eso el ejecutable salía con
 * el icono genérico de Electron.
 *
 * También deja preparado el `.iconset` de macOS (carpeta con un PNG por
 * tamaño, con el nombre exacto que espera `iconutil`). `iconutil` solo existe
 * en macOS, así que el `.icns` final se junta en el workflow de GitHub
 * Actions que compila la build de Mac, no aquí: este script solo prepara los
 * PNG, que sharp genera igual en Windows, Mac o Linux.
 *
 * Se ejecuta con `npm run icons`. Solo hace falta repetirlo si cambia el logo.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
// v3 se publica como ESM transpilado: la función viene en `.default`
const pngToIco = require('png-to-ico').default;

const ROOT = path.join(__dirname, '..');
const SVG = path.join(ROOT, 'public', 'favicon.svg');
// A partir de 64px el "AULAPRO" bajo la lista se lee bien; por debajo queda
// como una mancha, así que ahí usamos una variante sin texto (checklist más
// grande, centrada) para que el icono siga siendo reconocible.
const SVG_MINI = path.join(ROOT, 'public', 'favicon-mini.svg');
const MINI_THRESHOLD = 64;
const OUT = path.join(ROOT, 'build');

function svgFor(size) {
  return fs.readFileSync(size < MINI_THRESHOLD ? SVG_MINI : SVG);
}

/** Tamaños que Windows espera dentro de un .ico. */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/**
 * Tamaño en píxeles → nombres de archivo que espera `iconutil` dentro del
 * .iconset. Varios tamaños hacen doble papel (p. ej. 32px es a la vez el
 * "32x32" base y el "@2x" de "16x16"), por eso cada tamaño puede generar más
 * de un archivo.
 */
const ICONSET_FILES = {
  16:   ['icon_16x16.png'],
  32:   ['icon_16x16@2x.png', 'icon_32x32.png'],
  64:   ['icon_32x32@2x.png'],
  128:  ['icon_128x128.png'],
  256:  ['icon_128x128@2x.png', 'icon_256x256.png'],
  512:  ['icon_256x256@2x.png', 'icon_512x512.png'],
  1024: ['icon_512x512@2x.png'],
};

async function main() {
  if (!fs.existsSync(SVG) || !fs.existsSync(SVG_MINI)) {
    console.error('No se encontró ' + SVG + ' o ' + SVG_MINI);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  // PNG grande: es el que usa electron-builder para Linux y como respaldo.
  const png512 = path.join(OUT, 'icon.png');
  await sharp(svgFor(512), { density: 384 }).resize(512, 512, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).png().toFile(png512);
  console.log('icon.png  512x512');

  // Un PNG por tamaño, que es lo que png-to-ico junta en el .ico
  const buffers = [];
  for (const size of ICO_SIZES) {
    buffers.push(await sharp(svgFor(size), { density: 384 }).resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).png().toBuffer());
  }
  const ico = await pngToIco(buffers);
  fs.writeFileSync(path.join(OUT, 'icon.ico'), ico);
  console.log('icon.ico  ' + ICO_SIZES.join(', ') + '  (' + ico.length + ' bytes)');

  // Junto a main.cjs: así entra en el paquete con `electron/**` y la ventana
  // lo encuentra siempre, esté empaquetado o no.
  fs.copyFileSync(path.join(OUT, 'icon.ico'), path.join(ROOT, 'electron', 'icon.ico'));
  fs.copyFileSync(path.join(OUT, 'icon.ico'), path.join(ROOT, 'public', 'favicon.ico'));
  console.log('electron/icon.ico y public/favicon.ico  copiados');

  // .iconset de macOS: un PNG por tamaño con el nombre exacto que espera
  // `iconutil`. Aquí solo se generan los PNG (sharp funciona en cualquier
  // SO); convertirlo a .icns con `iconutil -c icns` solo se puede hacer en
  // macOS, así que esa conversión ocurre en el workflow de GitHub Actions.
  const iconsetDir = path.join(OUT, 'icon.iconset');
  fs.rmSync(iconsetDir, { recursive: true, force: true });
  fs.mkdirSync(iconsetDir, { recursive: true });
  for (const [size, names] of Object.entries(ICONSET_FILES)) {
    const buf = await sharp(svgFor(Number(size)), { density: 384 }).resize(Number(size), Number(size), {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).png().toBuffer();
    for (const name of names) {
      fs.writeFileSync(path.join(iconsetDir, name), buf);
    }
  }
  console.log('icon.iconset  ' + Object.values(ICONSET_FILES).flat().length + ' archivos (para `iconutil -c icns` en macOS)');

  // Mosaicos del paquete de Microsoft Store (objetivo `appx`): electron-builder
  // los busca en build/appx/ y, si faltan, pone unos genéricos. Fondo
  // transparente: Windows pone detrás el `backgroundColor` del bloque appx.
  const appxDir = path.join(OUT, 'appx');
  fs.rmSync(appxDir, { recursive: true, force: true });
  fs.mkdirSync(appxDir, { recursive: true });
  const tile = async (name, w, h, logo) => {
    const icon = await sharp(svgFor(logo), { density: 384 }).resize(logo, logo).png().toBuffer();
    await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: icon, left: Math.round((w - logo) / 2), top: Math.round((h - logo) / 2) }])
      .png().toFile(path.join(appxDir, name));
  };
  await tile('StoreLogo.png', 50, 50, 50);
  await tile('Square44x44Logo.png', 44, 44, 44);
  await tile('Square150x150Logo.png', 150, 150, 104);
  await tile('Wide310x150Logo.png', 310, 150, 104);
  console.log('appx/  mosaicos de Microsoft Store (50, 44, 150, 310x150)');
}

main().catch(err => { console.error(err); process.exit(1); });
