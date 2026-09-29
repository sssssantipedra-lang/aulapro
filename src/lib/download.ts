/**
 * Guardar un archivo que genera la aplicación (Word, CSV, copia de seguridad…).
 *
 * En el ordenador, la descarga de siempre. En Android el WebView no sabe
 * descargar: el archivo se pasa al menú de compartir del sistema, desde el que
 * se guarda en Archivos o Drive o se envía por correo (ver platform/android.ts).
 */
export async function downloadFile(blob: Blob, filename: string): Promise<void> {
  const files = typeof window !== 'undefined' ? window.electronAPI?.files : undefined;
  if (files) { await files.save(blob, filename); return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Un momento de margen: algunos navegadores leen la URL después del clic
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
