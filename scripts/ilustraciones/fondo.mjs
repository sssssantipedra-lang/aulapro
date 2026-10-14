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
 * Tres pasos:
 * 1. Relleno desde los bordes: es fondo todo píxel casi blanco (o gris muy
 *    claro sin color) conectado con el borde de la imagen.
 * 2. Pelado: el modelo dibuja a veces una sombra o una mancha suave bajo el
 *    sujeto, aunque se le pida que no (la del gato era lila). Se pelan, capa a
 *    capa desde fuera, los píxeles claros y pálidos que tocan el fondo; el
 *    contorno oscuro del sujeto los detiene. Un color vivo (naranja, rojo) no se
 *    pela, así que un sol sin contorno no desaparece.
 * 3. Motas: lo suelto y diminuto (una marca «TM» que dibujó el modelo en una
 *    vaca, burbujas) se borra; las piezas de verdad (una sombrilla y su cubo) se
 *    quedan.
 */
import sharp from 'sharp';

const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Casi blanco, o gris muy claro sin color. */
const esFondo = (r, g, b, claro, color) => Math.min(r, g, b) >= claro && Math.max(r, g, b) - Math.min(r, g, b) <= color;

/** Claro y pálido (poco saturado): lo que se pela de un borde sin contorno. */
function esPalido(r, g, b, luz) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return luma(r, g, b) > luz && (max === 0 ? 0 : (max - min) / max) < 0.45;
}

/**
 * @param {Buffer} entrada imagen con fondo blanco (cualquier formato que lea sharp)
 * @param {{ lado?: number, claro?: number, color?: number, margen?: number, luz?: number, motas?: number, calidad?: number }} [opts]
 *   `lado` px del cuadrado final; `claro` y `color` definen «fondo»; `luz`, hasta qué claridad se pela;
 *   `motas`, fracción del sujeto por debajo de la cual una pieza suelta se borra.
 * @returns {Promise<Buffer>} WebP con transparencia, `lado` × `lado`
 */
export async function quitarFondoBlanco(entrada, { lado = 384, claro = 196, color = 22, margen = 0.04, luz = 150, motas = 0.004, calidad = 84 } = {}) {
  const { data, info } = await sharp(entrada).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const n = w * h;
  const px = i => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];

  /* 1. Relleno desde los bordes */
  const fondo = new Uint8Array(n);
  const pila = [];
  const ver = (x, y) => {
    const i = y * w + x;
    if (fondo[i]) return;
    const [r, g, b] = px(i);
    if (!esFondo(r, g, b, claro, color)) return;
    fondo[i] = 1;
    pila.push(i);
  };
  for (let x = 0; x < w; x++) { ver(x, 0); ver(x, h - 1); }
  for (let y = 0; y < h; y++) { ver(0, y); ver(w - 1, y); }
  const vecinos = i => {
    const x = i % w, y = (i - x) / w, v = [];
    if (x > 0) v.push(i - 1);
    if (x < w - 1) v.push(i + 1);
    if (y > 0) v.push(i - w);
    if (y < h - 1) v.push(i + w);
    return v;
  };
  while (pila.length) for (const j of vecinos(pila.pop())) ver(j % w, (j - (j % w)) / w);

  /* 2. Pelado: capa a capa, desde el borde del fondo hacia dentro, mientras el píxel sea claro y pálido */
  let ola = [];
  const enOla = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (fondo[i]) continue;
    if (vecinos(i).some(j => fondo[j])) { ola.push(i); enOla[i] = 1; }
  }
  for (let vuelta = 0; vuelta < 120 && ola.length; vuelta++) {
    const siguiente = [];
    for (const i of ola) {
      const [r, g, b] = px(i);
      if (!esPalido(r, g, b, luz)) continue;
      fondo[i] = 1;
      for (const j of vecinos(i)) if (!fondo[j] && !enOla[j]) { enOla[j] = 1; siguiente.push(j); }
    }
    ola = siguiente;
  }

  /* 3. Motas: piezas sueltas diminutas */
  const pieza = new Int32Array(n).fill(-1);
  const areas = [];
  for (let i = 0; i < n; i++) {
    if (fondo[i] || pieza[i] >= 0) continue;
    const id = areas.length;
    let area = 0;
    const cola = [i];
    pieza[i] = id;
    while (cola.length) {
      const k = cola.pop();
      area++;
      for (const j of vecinos(k)) if (!fondo[j] && pieza[j] < 0) { pieza[j] = id; cola.push(j); }
    }
    areas.push(area);
  }
  const total = areas.reduce((a, b) => a + b, 0);
  const sobra = new Set(areas.map((a, id) => (a < total * motas ? id : -1)).filter(id => id >= 0));

  const out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const vive = !fondo[i] && !sobra.has(pieza[i]);
    out[i * 4] = data[i * 4]; out[i * 4 + 1] = data[i * 4 + 1]; out[i * 4 + 2] = data[i * 4 + 2];
    out[i * 4 + 3] = vive ? 255 : 0;
  }
  const recortada = await sharp(out, { raw: { width: w, height: h, channels: 4 } }).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).png().toBuffer();
  const dentro = Math.round(lado * (1 - 2 * margen));
  const ajustada = await sharp(recortada).resize(dentro, dentro, { fit: 'inside' }).png().toBuffer();
  return sharp(ajustada)
    .resize(lado, lado, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: calidad, alphaQuality: 90, effort: 6 })
    .toBuffer();
}
