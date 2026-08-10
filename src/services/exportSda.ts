/**
 * Exporta una situación de aprendizaje a PDF o a Word, con el formato de
 * rejilla de las programaciones LOMLOE en papel: una franja azul oscura con
 * el título arriba, franjas azules más claras separando cada bloque
 * (inclusión, currículo por área, metodología, sesiones, evaluación), y
 * dentro de cada bloque filas de etiqueta + contenido —algunas comprimidas
 * de tres en tres (Temporalización / Área / ODS) cuando el dato es corto.
 *
 * El PDF se construye como un documento HTML independiente y se imprime con
 * `docs.savePdf` (el mismo camino que usan las actas en Records.tsx): pasa
 * por el proceso de Electron, así que solo funciona en el escritorio. El Word
 * no necesita nada de eso —la librería `docx` genera el archivo entero en el
 * propio navegador— y por eso funciona igual en la versión web.
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, VerticalAlign, BorderStyle, PageOrientation,
} from 'docx';
import type { LearningSituation } from '../types';
import { translate, type Lang } from '../i18n';

function fileBase(sda: LearningSituation): string {
  const slug = (s: string) => s.trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  return `sda-${slug(sda.title || 'situacion-de-aprendizaje')}`;
}

/**
 * Junta lo que hace falta para las dos cabeceras (la franja azul de la tabla
 * y el título de la página): número de SA, título entre comillas y, si hay,
 * la temporalización. Se calcula una sola vez y lo usan ambos formatos.
 */
function buildHeadings(sda: LearningSituation, t: (k: string, vars?: Record<string, string | number>) => string) {
  const req = sda.request;
  const c = sda.content;
  const titulo = c.titulo || sda.title;
  const temporal = [req.temporalizacion, req.meses].filter(Boolean).join(' · ');
  const sitAprendizaje = t('Situación de aprendizaje');
  const bandTitle = `${sitAprendizaje.toUpperCase()}${req.numero ? ' ' + req.numero : ''} — «${titulo}»${temporal ? ' · ' + temporal : ''}`;
  const pageTitle = `${req.numero ? `${sitAprendizaje} ${req.numero}. ` : ''}«${titulo}»`;
  return { titulo, temporal, bandTitle, pageTitle };
}

/* ── PDF (HTML independiente, impreso por Electron) ── */

const esc = (s: string) => (s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
const nl2br = (s: string) => esc(s).replace(/\n/g, '<br>');
const DASH = '—';

export function buildSdaHtml(sda: LearningSituation, lang: Lang): string {
  const t = (k: string, vars?: Record<string, string | number>) => translate(lang, k, vars);
  const c = sda.content;
  const req = sda.request;
  const { titulo, temporal, bandTitle, pageTitle } = buildHeadings(sda, t);

  const bandTop = (text: string) => `<tr class="band-top"><td colspan="6">${esc(text)}</td></tr>`;
  const band = (text: string) => `<tr class="band"><td colspan="6">${esc(text)}</td></tr>`;
  const rowFull = (label: string, value: string) => value
    ? `<tr><th class="lbl">${esc(label)}</th><td colspan="5">${nl2br(value)}</td></tr>` : '';
  const rowTriple = (l1: string, v1: string, l2: string, v2: string, l3: string, v3: string) =>
    (v1 || v2 || v3)
      ? `<tr><th class="lbl">${esc(l1)}</th><td>${nl2br(v1 || DASH)}</td><th class="lbl">${esc(l2)}</th><td>${nl2br(v2 || DASH)}</td><th class="lbl">${esc(l3)}</th><td>${nl2br(v3 || DASH)}</td></tr>`
      : '';
  const rowDouble = (l1: string, v1: string, l2: string, v2: string) =>
    (v1 || v2)
      ? `<tr><th class="lbl">${esc(l1)}</th><td>${nl2br(v1 || DASH)}</td><th class="lbl">${esc(l2)}</th><td colspan="3">${nl2br(v2 || DASH)}</td></tr>`
      : '';

  const areaVal = [req.areas.join(', '), req.nivel].filter(Boolean).join(' · ');

  const objetivosPair = rowDouble(t('Objetivos de etapa'), c.objetivosEtapa, t('Competencias clave'), c.competenciasClave);

  const gridRows =
    rowTriple(t('Temporalización'), temporal, t('Área'), areaVal, t('ODS'), c.ods) +
    rowFull(t('Justificación'), c.justificacion) +
    rowFull(t('Producto final'), c.productoFinal) +
    rowFull(t('Explicación curricular (para ti)'), c.explicacionCurricular) +
    (c.areas.length === 0 ? objetivosPair : '') +
    (c.inclusionUniversal || c.inclusionAdicional || c.inclusionIndividualizada
      ? band(t('Medidas de respuesta a la inclusión')) +
        rowFull(t('Medidas universales'), c.inclusionUniversal) +
        rowFull(t('Apoyo puntual'), c.inclusionAdicional) +
        rowFull(t('Necesidades específicas'), c.inclusionIndividualizada)
      : '') +
    c.areas.map((a, idx) =>
      band(t('Concreción curricular ({area})', { area: a.area })) +
      (idx === 0 ? objetivosPair : '') +
      rowFull(t('Competencias específicas'), a.competenciasEspecificas) +
      rowFull(t('Criterios de evaluación'), a.criteriosEvaluacion) +
      rowFull(t('Saberes básicos'), a.saberesBasicos),
    ).join('') +
    (c.metodologia || c.agrupamiento || c.recursos
      ? band(t('Metodología y desarrollo')) +
        rowFull(t('Metodología'), c.metodologia) +
        rowFull(t('Agrupamiento'), c.agrupamiento) +
        rowFull(t('Recursos'), c.recursos)
      : '') +
    (c.sesiones.length
      ? band(t('Sesiones')) +
        c.sesiones.map((s, i) => rowFull(
          `${s.fase ? `${s.fase} — ` : ''}${t('Sesión')} ${i + 1}${s.titulo ? `: ${s.titulo}` : ''}`,
          s.descripcion,
        )).join('')
      : '') +
    (c.evaluacionTecnicas || c.evaluacionInstrumentos
      ? band(t('Evaluación')) +
        rowFull(t('Técnicas de evaluación'), c.evaluacionTecnicas) +
        rowFull(t('Instrumentos de evaluación'), c.evaluacionInstrumentos)
      : '');

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
    `<title>${esc(titulo)}</title>` +
    `<style>${SDA_DOC_STANDALONE}${SDA_DOC_STYLE}</style>` +
    `</head><body><article class="sda-doc">` +
    `<h1>${esc(pageTitle)}</h1>` +
    (sda.class_name ? `<p class="sda-sub">${esc(sda.class_name)}</p>` : '') +
    `<table class="sda-grid"><colgroup>${'<col/>'.repeat(6)}</colgroup><tbody>` +
    bandTop(bandTitle) +
    gridRows +
    `</tbody></table>` +
    `</article></body></html>`;
}

export async function saveSdaPdf(sda: LearningSituation, lang: Lang) {
  const docs = window.electronAPI?.docs;
  if (!docs) return { error: 'not-desktop' as const };
  const html = buildSdaHtml(sda, lang);
  const res = await docs.savePdf(html, fileBase(sda) + '.pdf');
  if (!res.canceled && !res.error && res.path) docs.reveal(res.path);
  return res;
}

const SDA_DOC_STYLE = `
/* Documento horizontal: docs.savePdf ya imprime en landscape (ver electron/main.cjs),
   así que aquí hace falta usar el ancho de página que eso da, no el de un A4 vertical
   —si no, la rejilla se queda encogida en el centro con media página en blanco. */
.sda-doc { max-width: 100%; margin: 0 auto; padding: 4mm 6mm; background: #fff; color: #1e293b; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.sda-doc h1 { font-size: 15px; font-weight: 700; margin: 0 0 2px; letter-spacing: -0.01em; }
.sda-sub { font-size: 12px; color: #64748b; margin: 0 0 12px; }

.sda-grid { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 11.5px; }
.sda-grid th, .sda-grid td { border: 0.75px solid #8faadc; padding: 6px 9px; text-align: left; vertical-align: top; }
.sda-grid td { line-height: 1.5; white-space: pre-line; font-weight: 400; }
.sda-grid th.lbl { background: #dce6f1; color: #1e3a5f; font-weight: 700; font-size: 11px; }

.sda-grid .band-top td { background: #1f4e79; color: #fff; font-weight: 700; font-size: 12.5px; letter-spacing: 0.01em; }
.sda-grid .band td { background: #bdd7ee; color: #1f4e79; font-weight: 700; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.03em; }

/* Reparto entre páginas: vale tanto en el PDF como en la impresora */
.sda-grid tr { break-inside: avoid; page-break-inside: avoid; }
@media print { @page { size: A4 landscape; margin: 12mm 14mm; } }
`;

const SDA_DOC_STANDALONE = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
`;

/* ── Word (generado en el propio navegador, sin pasar por Electron) ── */

const BORDER = { style: BorderStyle.SINGLE, size: 2, color: '8FAADC' };
const TABLE_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, insideHorizontal: BORDER, insideVertical: BORDER };

/** Ancho, en % de la tabla, de una columna de la rejilla de 6. */
const COL_W = 100 / 6;

/** Una celda de la rejilla: banda de título, banda de sección, etiqueta o valor normal. */
function gcell(text: string, opts: { colSpan?: number; style?: 'bandTop' | 'band' | 'label' | 'value' } = {}) {
  const colSpan = opts.colSpan ?? 1;
  const style = opts.style ?? 'value';
  const fill = style === 'bandTop' ? '1F4E79' : style === 'band' ? 'BDD7EE' : style === 'label' ? 'DCE6F1' : undefined;
  const color = style === 'bandTop' ? 'FFFFFF' : style === 'band' ? '1F4E79' : undefined;
  return new TableCell({
    columnSpan: colSpan > 1 ? colSpan : undefined,
    width: { size: colSpan * COL_W, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    shading: fill ? { fill } : undefined,
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    children: [new Paragraph({
      children: [new TextRun({
        text: text || DASH,
        bold: style !== 'value',
        size: style === 'bandTop' ? 20 : style === 'band' ? 19 : style === 'label' ? 19 : 20,
        color,
        allCaps: style === 'band',
      })],
    })],
  });
}

const gBandTop = (text: string) => new TableRow({ children: [gcell(text, { colSpan: 6, style: 'bandTop' })] });
const gBand = (text: string) => new TableRow({ children: [gcell(text, { colSpan: 6, style: 'band' })] });
const gRowFull = (label: string, value: string): TableRow[] => value
  ? [new TableRow({ children: [gcell(label, { style: 'label' }), gcell(value, { colSpan: 5 })] })]
  : [];
const gRowTriple = (l1: string, v1: string, l2: string, v2: string, l3: string, v3: string): TableRow[] =>
  (v1 || v2 || v3)
    ? [new TableRow({ children: [gcell(l1, { style: 'label' }), gcell(v1), gcell(l2, { style: 'label' }), gcell(v2), gcell(l3, { style: 'label' }), gcell(v3)] })]
    : [];
const gRowDouble = (l1: string, v1: string, l2: string, v2: string): TableRow[] =>
  (v1 || v2)
    ? [new TableRow({ children: [gcell(l1, { style: 'label' }), gcell(v1), gcell(l2, { style: 'label' }), gcell(v2, { colSpan: 3 })] })]
    : [];

/** Construye el .docx. Separado de `saveSdaDocx` para poder probarlo sin DOM. */
export async function buildSdaDocxBlob(sda: LearningSituation, lang: Lang): Promise<Blob> {
  const t = (k: string, vars?: Record<string, string | number>) => translate(lang, k, vars);
  const c = sda.content;
  const req = sda.request;
  const { temporal, bandTitle, pageTitle } = buildHeadings(sda, t);

  const areaVal = [req.areas.join(', '), req.nivel].filter(Boolean).join(' · ');
  const objetivosPair = () => gRowDouble(t('Objetivos de etapa'), c.objetivosEtapa, t('Competencias clave'), c.competenciasClave);

  const rows: TableRow[] = [
    gBandTop(bandTitle),
    ...gRowTriple(t('Temporalización'), temporal, t('Área'), areaVal, t('ODS'), c.ods),
    ...gRowFull(t('Justificación'), c.justificacion),
    ...gRowFull(t('Producto final'), c.productoFinal),
    ...gRowFull(t('Explicación curricular (para ti)'), c.explicacionCurricular),
    ...(c.areas.length === 0 ? objetivosPair() : []),
    ...(c.inclusionUniversal || c.inclusionAdicional || c.inclusionIndividualizada ? [
      gBand(t('Medidas de respuesta a la inclusión')),
      ...gRowFull(t('Medidas universales'), c.inclusionUniversal),
      ...gRowFull(t('Apoyo puntual'), c.inclusionAdicional),
      ...gRowFull(t('Necesidades específicas'), c.inclusionIndividualizada),
    ] : []),
    ...c.areas.flatMap((a, idx) => [
      gBand(t('Concreción curricular ({area})', { area: a.area })),
      ...(idx === 0 ? objetivosPair() : []),
      ...gRowFull(t('Competencias específicas'), a.competenciasEspecificas),
      ...gRowFull(t('Criterios de evaluación'), a.criteriosEvaluacion),
      ...gRowFull(t('Saberes básicos'), a.saberesBasicos),
    ]),
    ...(c.metodologia || c.agrupamiento || c.recursos ? [
      gBand(t('Metodología y desarrollo')),
      ...gRowFull(t('Metodología'), c.metodologia),
      ...gRowFull(t('Agrupamiento'), c.agrupamiento),
      ...gRowFull(t('Recursos'), c.recursos),
    ] : []),
    ...(c.sesiones.length ? [
      gBand(t('Sesiones')),
      ...c.sesiones.flatMap((s, i) => gRowFull(
        `${s.fase ? `${s.fase} — ` : ''}${t('Sesión')} ${i + 1}${s.titulo ? `: ${s.titulo}` : ''}`,
        s.descripcion,
      )),
    ] : []),
    ...(c.evaluacionTecnicas || c.evaluacionInstrumentos ? [
      gBand(t('Evaluación')),
      ...gRowFull(t('Técnicas de evaluación'), c.evaluacionTecnicas),
      ...gRowFull(t('Instrumentos de evaluación'), c.evaluacionInstrumentos),
    ] : []),
  ];

  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: pageTitle, heading: HeadingLevel.TITLE, spacing: { after: sda.class_name ? 40 : 160 } }),
  ];
  if (sda.class_name) {
    children.push(new Paragraph({ children: [new TextRun({ text: sda.class_name, italics: true, color: '64748B' })], spacing: { after: 160 } }));
  }
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS, rows }));

  const doc = new Document({
    sections: [{
      children,
      properties: {
        // Horizontal, a juego con el PDF: la rejilla tiene 6 columnas y en
        // vertical se queda apretada mucho antes de llenar la página.
        page: {
          // docx espera las medidas en su orden "vertical" (ancho corto,
          // alto largo) y las intercambia él solo al ver orientation:
          // LANDSCAPE — pasarlas ya intercambiadas produce el efecto
          // contrario y el documento sale vertical con la etiqueta cambiada.
          size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 700, bottom: 700, left: 700, right: 700 },
        },
      },
    }],
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
  });

  return Packer.toBlob(doc);
}

export async function saveSdaDocx(sda: LearningSituation, lang: Lang) {
  const blob = await buildSdaDocxBlob(sda, lang);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileBase(sda) + '.docx';
  a.click();
  URL.revokeObjectURL(url);
}
