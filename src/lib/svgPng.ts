/**
 * De un SVG a un PNG con el lienzo del navegador: para descargar la pizarra de
 * circuitos y para enviar su croquis a la IA. Aparte de la pantalla para poder
 * sustituirlo en las pruebas, donde jsdom no tiene lienzo.
 */

/** Pasa un SVG a PNG, de `ancho` píxeles de ancho y con fondo blanco. */
export async function svgAPng(svg: string, ancho: number, alto: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No se pudo dibujar la imagen'));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Sin lienzo');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(img, 0, 0, ancho, alto);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Sin imagen'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** El contenido de un blob en base64, sin el prefijo `data:`. */
export const blobABase64 = (b: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve((r.result as string).split(',')[1]);
  r.onerror = reject;
  r.readAsDataURL(b);
});
