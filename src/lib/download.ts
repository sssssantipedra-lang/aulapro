/**
 * Guardar un archivo que genera la aplicación (Word, CSV, copia de seguridad…).
 *
 * En el ordenador, la descarga de siempre. En Android el WebView no sabe
 * descargar: el archivo se guarda en Documentos › AulaPro › `carpeta` y la app
 * avisa de dónde ha quedado, con botones para abrirlo o compartirlo (ver
 * platform/android.ts y lib/carpetas.ts).
 */
export async function downloadFile(blob: Blob, filename: string, carpeta?: string): Promise<void> {
  const files = typeof window !== 'undefined' ? window.electronAPI?.files : undefined;
  if (files) { await files.save(blob, filename, carpeta); return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Un momento de margen: algunos navegadores leen la URL después del clic
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * El menú de compartir del sistema con un archivo (Android, iPhone e iPad, y
 * algunos navegadores de ordenador): desde él se guarda en Google Drive,
 * OneDrive o iCloud. Lo usa la versión web para «Guardar en mi nube».
 */
export function puedeCompartirArchivos(): boolean {
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [new File([''], 'x.json', { type: 'application/json' })] });
  } catch {
    return false;
  }
}

/** `false` si no se puede compartir o el docente cerró el menú. */
export async function compartirArchivo(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  if (!navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], title: filename });
    return true;
  } catch {
    return false;
  }
}
