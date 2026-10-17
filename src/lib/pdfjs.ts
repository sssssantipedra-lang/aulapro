/**
 * Apertura de PDF con pdf.js, cargado solo cuando hace falta (pesa unos 400 KB
 * y casi nadie abre un PDF en cada sesión). Se usa la versión «legacy» porque
 * el WebView de Android de algunas tabletas es anterior a lo que pide la
 * actual.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface PdfAbierto {
  pdf: PDFDocumentProxy;
  /** Libera el documento y su hilo de trabajo. */
  cerrar: () => void;
}

function bytesDeBase64(base64: string): Uint8Array {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function abrirPdf(base64: string): Promise<PdfAbierto> {
  const [pdfjs, { default: PdfWorker }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    // `?worker` lo empaqueta Vite como un .js normal: un .mjs suelto no lo
    // sirven bien todos los WebView, que exigen el tipo MIME de JavaScript.
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker'),
  ]);
  // (El tipo de pdf.js declara `port` como null por un error suyo.) Un hilo por documento: al cerrar el documento se cierra también su hilo.
  const worker = new pdfjs.PDFWorker({ port: new PdfWorker() as unknown as null });
  try {
    const pdf = await pdfjs.getDocument({ data: bytesDeBase64(base64), worker }).promise;
    return { pdf, cerrar: () => { void pdf.destroy(); worker.destroy(); } };
  } catch (e) {
    worker.destroy();
    throw e;
  }
}
