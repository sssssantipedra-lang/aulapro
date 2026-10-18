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
