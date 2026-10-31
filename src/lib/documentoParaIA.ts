/**
 * Documentos del alumnado que van a la IA (31-10-2026, revisión de privacidad): nunca se envía el archivo, solo su
 * texto, leído aquí, en el navegador. Así pasa por el mismo enmascarado de nombres que todo lo demás (`callGemini`,
 * `services/privacy.ts`) y, antes, por `quitarIdentificadores`, que tapa lo que la lista del alumnado no cubre
 * (correos, teléfonos, DNI, números de expediente, fechas de nacimiento, familiares, domicilio y centro).
 *
 * Antes, un PDF (el informe del orientador, la programación del tutor, un trabajo de un alumno) se enviaba tal cual,
 * con el nombre que llevara. Un PDF escaneado no tiene texto: entonces no se envía y se pide pegar el texto.
 * Ver `docs/PTAL.md` y `web/sitio/privacidad.html`.
 */
import { textoDeDocx } from './leerMaterial';

/** Como mucho se leen estas páginas: un informe o una programación no pasan de aquí, y la IA tampoco lee más. */
export const MAX_PAGINAS_PDF = 80;

/** Por debajo de esta cantidad de letras por página, el PDF es una imagen escaneada. */
const LETRAS_POR_PAGINA = 40;

export const EXTENSIONES_DOCUMENTO = '.pdf,.docx,.txt';
const ES_TEXTO = /\.(txt|md|csv|tsv)$/i;

/** El texto de un PDF, página a página. Error «escaneado» si casi no tiene texto (es una foto de las hojas). */
export async function textoDePdf(datos: ArrayBuffer | Uint8Array): Promise<string> {
  // La versión «legacy» funciona también en los iPad y los navegadores de hace unos años
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
  }
  const tarea = pdfjs.getDocument({
    data: datos instanceof Uint8Array ? datos : new Uint8Array(datos),
    // Sin cargar tipos de letra: solo se quiere el texto (la versión 6 ya no usa `eval`, que la app prohíbe)
    disableFontFace: true, useSystemFonts: false,
  });
  try {
    const doc = await tarea.promise;
    const paginas: string[] = [];
    const n = Math.min(doc.numPages, MAX_PAGINAS_PDF);
    for (let i = 1; i <= n; i++) {
      const pagina = await doc.getPage(i);
      const contenido = await pagina.getTextContent();
      let linea = '';
      const lineas: string[] = [];
      for (const item of contenido.items) {
        if (!('str' in item)) continue;
        linea += item.str;
        if (item.hasEOL) { lineas.push(linea); linea = ''; }
      }
      if (linea) lineas.push(linea);
      paginas.push(lineas.join('\n').replace(/[ \t]+\n/g, '\n').trim());
      pagina.cleanup();
    }
    const texto = paginas.join('\n\n').trim();
    if (texto.replace(/\s/g, '').length < LETRAS_POR_PAGINA * n) throw new Error('escaneado');
    return texto;
  } finally {
    await tarea.destroy();
  }
}

/**
 * El texto de un documento elegido por el docente: PDF, Word (.docx) o texto. Errores: «escaneado» (un PDF sin texto),
 * «doc» (un Word antiguo, .doc, que no se puede leer aquí) y «formato» (cualquier otra cosa).
 */
export async function leerDocumento(file: File): Promise<string> {
  const n = file.name.toLowerCase();
  if (n.endsWith('.pdf') || file.type === 'application/pdf') return textoDePdf(await file.arrayBuffer());
  if (n.endsWith('.docx')) return textoDeDocx(file);
  if (n.endsWith('.doc')) throw new Error('doc');
  if (ES_TEXTO.test(n) || file.type.startsWith('text/')) return file.text();
  throw new Error('formato');
}

/** ¿Es un documento que se lee como texto (y no una imagen)? */
export const esDocumento = (file: File) =>
  /\.(pdf|docx?|txt|md|csv|tsv)$/i.test(file.name) || file.type === 'application/pdf' || file.type.startsWith('text/');

/** El mensaje para el docente cuando `leerDocumento` no puede. */
export function avisoDeLectura(e: unknown): string {
  const m = e instanceof Error ? e.message : '';
  if (m === 'escaneado') return 'Este PDF es una imagen escaneada y no tiene texto que leer. Para no enviar el archivo con los datos que lleve, copia su texto y pégalo, o pide el documento en Word.';
  if (m === 'doc') return 'Los Word antiguos (.doc) no se pueden leer aquí. Ábrelo y guárdalo como .docx o como PDF.';
  if (m === 'grande') return 'El archivo pesa demasiado (19 MB como máximo).';
  return 'No se pudo leer el documento. Usa un PDF, un Word (.docx) o un texto.';
}

const R = (s: string) => `[${s}]`;

/**
 * Tapa lo que identifica a una persona y que la lista del alumnado no cubre. No es perfecto (un nombre suelto que no
 * esté en la lista no se puede reconocer), por eso el texto se enseña al docente antes de enviarlo cuando hay dónde.
 * Las etiquetas van en castellano, catalán e inglés.
 */
export function quitarIdentificadores(texto: string): string {
  return texto
    // Correos y teléfonos (España, con o sin +34)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, R('correo'))
    .replace(/(?<![\w+])(?:\+34[\s.-]?)?[6789]\d{2}(?:(?:[\s.-]?\d{3}){2}|(?:[\s.-]?\d{2}){3})(?!\d)/g, R('teléfono'))
    // DNI y NIE
    .replace(/(?<![\p{L}\d])[XYZ]?\d{7,8}[\s-]?[A-Z](?![\p{L}\d])/gu, R('DNI'))
    // Fechas de nacimiento, con su etiqueta
    .replace(/((?:fecha\s+de\s+)?nacimiento|data\s+de\s+naixement|naixement|date\s+of\s+birth|birth\s*date|nacid[oa]\s+el|nascu[dt]a?\s+el|born\s+on|f\.?\s?nac\.?|d\.?\s?o\.?\s?b\.?)(\s*[:.-]?\s*)(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}\s+de\s+\p{L}+\s+(?:de|del)\s+\d{4})/giu, `$1$2${R('fecha')}`)
    // Lo que sigue a una etiqueta de nombre, familiar, domicilio o centro, hasta el final de la línea
    .replace(/^([ \t]*(?:nombre(?:\s+y\s+apellidos)?|apellidos|nom(?:\s+i\s+cognoms)?|cognoms|(?:full\s+)?name|surnames?|alumn[oa](?:\/a)?|alumne|student|padre|madre|pare|mare|father|mother|progenitor(?:[ae]s?)?|tutor(?:[ae])?(?:\/a)?\s+legal(?:es)?|legal\s+guardian|domicilio|direcci[oó]n|adre[cç]a|address|centro(?:\s+educativo)?|centre(?:\s+educatiu)?|colegio|school)[ \t]*:)[^\n]*/gimu, `$1 ${R('dato quitado')}`)
    // Números largos: expediente, NIA, SIP, tarjeta sanitaria, seguridad social
    .replace(/(?<![\d.,/-])\d{7,}(?![\d.,/-])/g, R('número'));
}
