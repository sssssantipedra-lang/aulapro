/**
 * Fotos del propio docente para la agenda visual: se reducen antes de
 * guardarlas, para que el perfil y sus copias no crezcan de golpe. Se quedan
 * en el equipo; no se envían a ninguna parte.
 */

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

/** El nombre del archivo sin la extensión, como nombre de partida de la foto. */
export function nombreDeArchivo(nombre: string): string {
  return nombre.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}
