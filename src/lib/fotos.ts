/**
 * Fotos del propio docente. Las de la agenda visual se reducen antes de
 * guardarlas, para que el perfil y sus copias no crezcan de golpe, y se quedan
 * en el equipo. La de «Desde una foto» (EF, Actividades) va a la IA y no se
 * guarda: ver `fotoParaIA`.
 */
import type { InlineFile } from '../services/gemini';

/** El lado mayor de la foto guardada, en píxeles: de sobra para una tarjeta impresa. */
export const LADO_FOTO = 480;

/** Lee una imagen elegida por el docente y la devuelve reducida, en JPEG. */
export async function reducirFoto(file: Blob, lado = LADO_FOTO): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No es una imagen'));
      i.src = url;
    });
    const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * escala));
    const h = Math.max(1, Math.round(img.naturalHeight * escala));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Sin lienzo');
    // Fondo blanco: un PNG con transparencia no se queda negro en JPEG
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** El lado mayor de la foto que se envía a la IA: de sobra para reconocer una actividad. */
export const LADO_FOTO_IA = 1280;

/**
 * La foto para la IA: reducida y vuelta a hacer en JPEG, así que no lleva los
 * metadatos del original (la ubicación, el móvil con que se hizo, la fecha).
 */
export async function fotoParaIA(file: Blob): Promise<InlineFile> {
  const dataUrl = await reducirFoto(file, LADO_FOTO_IA);
  return { name: 'foto.jpg', mimeType: 'image/jpeg', base64: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}

/** El nombre del archivo sin la extensión, como nombre de partida de la foto. */
export function nombreDeArchivo(nombre: string): string {
  return nombre.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}
