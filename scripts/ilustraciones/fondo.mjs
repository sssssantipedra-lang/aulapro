/**
 * Quita el fondo blanco de una ilustración y la deja con fondo transparente,
 * recortada a su contorno, cuadrada y lista para guardar en WebP.
 *
 * Por qué no un quitafondos de IA (fal-ai/imageutils/rembg): en la prueba del
 * 14-10-2026 recortó el perro de la lista dejando solo la cabeza, con el cuerpo
 * blanco medio transparente, porque el sujeto es del color del fondo. Las
 * ilustraciones se piden «sobre fondo blanco liso» y con contorno grueso, así
 * que basta rellenar desde los bordes: es gratis, determinista y no toca nada
 * que el contorno encierre (el blanco de un ojo o de un reloj se queda).
 *
 * Un píxel es «fondo» si es casi blanco o un gris muy claro sin color (la
 * sombra que el modelo pone a veces bajo el sujeto); solo se borra el fondo
 * conectado con los bordes de la imagen.
 */
import sharp from 'sharp';

/** Un píxel cuenta como fondo si todos sus canales pasan de `claro` y casi no tiene color. */
const esFondo = (r, g, b, claro, color) => Math.min(r, g, b) >= claro && Math.max(r, g, b) - Math.min(r, g, b) <= color;

/**
 * @param {Buffer} entrada imagen con fondo blanco (cualquier formato que lea sharp)
 * @param {{ lado?: number, claro?: number, color?: number, margen?: number }} [opts]
 * @returns {Promise<Buffer>} WebP con transparencia, `lado` × `lado`
 */
export async function quitarFondoBlanco(entrada, { lado = 512, claro = 196, color = 22, margen = 0.04 } = {}) {
  const { data, info } = await sharp(entrada).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const fondo = new Uint8Array(w * h);
  const pila = [];
  const ver = (x, y) => {
    const i = y * w + x;
    if (fondo[i]) return;
    const p = i * 4;
    if (!esFondo(data[p], data[p + 1], data[p + 2], claro, color)) return;
    fondo[i] = 1;
    pila.push(i);
  };
  for (let x = 0; x < w; x++) { ver(x, 0); ver(x, h - 1); }
  for (let y = 0; y < h; y++) { ver(0, y); ver(w - 1, y); }
  while (pila.length) {
    const i = pila.pop();
    const x = i % w, y = (i - x) / w;
    if (x > 0) ver(x - 1, y);
    if (x < w - 1) ver(x + 1, y);
    if (y > 0) ver(x, y - 1);
    if (y < h - 1) ver(x, y + 1);
  }
  // El borde del sujeto: un píxel que toca el fondo y es claro se queda a medias, para no dejar un halo blanco
  const alfa = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (fondo[i]) continue;
      const toca = (x > 0 && fondo[i - 1]) || (x < w - 1 && fondo[i + 1]) || (y > 0 && fondo[i - w]) || (y < h - 1 && fondo[i + w]);
      const p = i * 4;
      const luz = Math.min(data[p], data[p + 1], data[p + 2]);
      alfa[i] = toca && luz > 150 ? Math.round(255 * Math.max(0, Math.min(1, (255 - luz) / 105))) : 255;
    }
  }
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    out[i * 4] = data[i * 4]; out[i * 4 + 1] = data[i * 4 + 1]; out[i * 4 + 2] = data[i * 4 + 2];
    out[i * 4 + 3] = alfa[i];
  }
  const recortada = await sharp(out, { raw: { width: w, height: h, channels: 4 } }).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).png().toBuffer();
  const dentro = Math.round(lado * (1 - 2 * margen));
  return sharp(recortada)
    .resize(dentro, dentro, { fit: 'inside' })
    .extend({ top: 0, bottom: 0, left: 0, right: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()
    .then(b => sharp(b).resize(lado, lado, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 88, alphaQuality: 100 }).toBuffer());
}
