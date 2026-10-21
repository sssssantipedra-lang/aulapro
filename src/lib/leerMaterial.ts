/**
 * Abrir un documento del centro con el inventario de material y sacar lo que
 * se pueda sin IA: tablas (Excel, LibreOffice, CSV) y textos por líneas. Lo que
 * no se entiende así (un PDF, un texto sin forma) se devuelve para que lo lea
 * la IA, si el docente tiene su clave. Ver `lib/importarMaterial.ts`.
 */
import { fileToBase64 } from './utils';
import type { InlineFile } from '../services/gemini';
import { filasDeCsv, materialDeFilas, materialDeTexto, type MaterialLeido } from './importarMaterial';

export const MAX_BYTES_MATERIAL = 19 * 1024 * 1024;
export const EXTENSIONES_MATERIAL = '.xlsx,.xlsm,.xls,.ods,.csv,.tsv,.txt,.docx,.pdf';

export interface DocumentoLeido {
  /** Lo que se ha entendido sin IA. */
  leidos: MaterialLeido[];
  /** Para la IA, si no se ha entendido nada: el texto del documento o el propio archivo (PDF). */
  paraIA?: { texto?: string; archivo?: InlineFile };
}

/** El texto de un .docx: lo que hay dentro de sus párrafos, uno por línea. */
async function textoDeDocx(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('docx');
  return xml
    .replace(/<w:tab\/>/g, '\t').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

export async function leerDocumentoMaterial(file: File): Promise<DocumentoLeido> {
  const nombre = file.name.toLowerCase();

  if (/\.(xlsx|xlsm|xls|ods)$/.test(nombre)) {
    const XLSX = await import('xlsx');
    const libro = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const leidos = libro.SheetNames.flatMap(n =>
      materialDeFilas(XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[n], { header: 1, blankrows: false, raw: false })));
    if (leidos.length) return { leidos };
    const texto = libro.SheetNames.map(n => `--- ${n} ---\n${XLSX.utils.sheet_to_csv(libro.Sheets[n], { blankrows: false })}`).join('\n\n');
    return { leidos: [], paraIA: { texto } };
  }

  if (/\.(csv|tsv)$/.test(nombre)) {
    const texto = await file.text();
    const leidos = materialDeFilas(filasDeCsv(texto));
    return leidos.length ? { leidos } : { leidos: [], paraIA: { texto } };
  }

  if (/\.(txt|docx)$/.test(nombre)) {
    const texto = nombre.endsWith('.docx') ? await textoDeDocx(file) : await file.text();
    const leidos = materialDeTexto(texto);
    return leidos.length ? { leidos } : { leidos: [], paraIA: { texto } };
  }

  if (/\.pdf$/.test(nombre)) return { leidos: [], paraIA: { archivo: await fileToBase64(file) } };

  throw new Error('formato');
}
