/**
 * Genera los iconos de la aplicación a partir de public/favicon.svg.
 *
 * electron-builder necesita un .ico para Windows y la ventana de Electron
 * también, pero en el proyecto solo había SVG: por eso el ejecutable salía con
 * el icono genérico de Electron.
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
}

main().catch(err => { console.error(err); process.exit(1); });
