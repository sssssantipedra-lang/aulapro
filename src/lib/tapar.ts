/**
 * Tapar el nombre en una foto antes de enviarla a la IA (31-10-2026, revisión de privacidad). El docente dibuja
 * rectángulos sobre la foto (`components/TaparNombre.tsx`) y se pintan de negro en la propia imagen, en el
 * dispositivo: lo que sale hacia la IA ya no lleva lo tapado. Las zonas van en proporción de la foto (de 0 a 1),
 * así se pueden repetir en la misma página del examen del siguiente alumno.
 */
import type { InlineFile } from '../services/gemini';

export interface Zona { x: number; y: number; w: number; h: number }
export interface Punto { x: number; y: number }

const entre01 = (n: number) => Math.min(1, Math.max(0, n));

/** El rectángulo entre dos esquinas, dentro de la foto. */
export function zonaEntre(a: Punto, b: Punto): Zona {
  const x1 = entre01(Math.min(a.x, b.x)), x2 = entre01(Math.max(a.x, b.x));
  const y1 = entre01(Math.min(a.y, b.y)), y2 = entre01(Math.max(a.y, b.y));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Un toque sin arrastrar no tapa nada: la zona tiene que tener un tamaño mínimo. */
export const zonaValida = (z: Zona) => z.w >= 0.02 && z.h >= 0.01;

/** La franja de arriba de la hoja, donde suele ir el nombre: un toque y está tapada. */
export const FRANJA_SUPERIOR: Zona = { x: 0, y: 0, w: 1, h: 0.12 };

/** El rectángulo en píxeles de una zona, en una imagen de `ancho` por `alto`, redondeado hacia fuera. */
export function enPixeles(z: Zona, ancho: number, alto: number) {
  const x = Math.floor(z.x * ancho), y = Math.floor(z.y * alto);
  return { x, y, w: Math.ceil((z.x + z.w) * ancho) - x, h: Math.ceil((z.y + z.h) * alto) - y };
}

const pct = (n: number) => `${(n * 100).toFixed(3)}%`;
/** La posición de una zona sobre la foto en pantalla (en %), para dibujarla encima. */
export const estiloZona = (z: Zona) => ({ left: pct(z.x), top: pct(z.y), width: pct(z.w), height: pct(z.h) });

/** La foto con las zonas pintadas de negro dentro de la imagen. Sin zonas, la foto tal cual. */
export async function taparFoto(foto: InlineFile, zonas: readonly Zona[]): Promise<InlineFile> {
  if (!zonas.length) return foto;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('No es una imagen'));
    i.src = `data:${foto.mimeType};base64,${foto.base64}`;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Sin lienzo');
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = '#000';
  for (const z of zonas) {
    const r = enPixeles(z, canvas.width, canvas.height);
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  return { name: foto.name, mimeType: 'image/jpeg', base64: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}
