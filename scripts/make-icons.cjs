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
const OUT = path.join(ROOT, 'build');

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
  if (!fs.existsSync(SVG)) {
    console.error('No se encontró ' + SVG);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const svg = fs.readFileSync(SVG);

  // PNG grande: es el que usa electron-builder para Linux y como respaldo.
  const png512 = path.join(OUT, 'icon.png');
  await sharp(svg, { density: 384 }).resize(512, 512, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).png().toFile(png512);
  console.log('icon.png  512x512');

  // Un PNG por tamaño, que es lo que png-to-ico junta en el .ico
  const buffers = [];
  for (const size of ICO_SIZES) {
    buffers.push(await sharp(svg, { density: 384 }).resize(size, size, {
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
    const buf = await sharp(svg, { density: 384 }).resize(Number(size), Number(size), {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).png().toBuffer();
    for (const name of names) {
      fs.writeFileSync(path.join(iconsetDir, name), buf);
    }
  }
  console.log('icon.iconset  ' + Object.values(ICONSET_FILES).flat().length + ' archivos (para `iconutil -c icns` en macOS)');
}

main().catch(err => { console.error(err); process.exit(1); });
