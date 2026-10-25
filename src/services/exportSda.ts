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
  Table, TableRow, TableCell, WidthType, VerticalAlign, BorderStyle, PageOrientation, AlignmentType, ImageRun,
} from 'docx';
import type { LearningSituation } from '../types';
import { DEFAULT_LEVELS } from '../types';
import type { SdaRubricRow, SdaDianaItem } from './learningSituations';
import { dianaSvg } from './exportInstrumento';
import { dianaDeFilas } from './instrumentoEmbebido';
import { translate, type Lang } from '../i18n';
import { downloadFile } from '../lib/download';
import { modeloEF } from '../lib/modelosEF';
import { MODALIDADES_EF } from '../lib/ef';
import { CARPETAS } from '../lib/carpetas';
import { sesionEnTexto } from '../lib/sesionSda';
import { bytesDeImagen, imagenesDeSesionSda } from '../lib/imagenesSesion';

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

/** Los modelos pedagógicos de una SdA de EF, por su nombre; vacío en las demás. */
function modelosDeSda(c: LearningSituation['content'], t: (k: string) => string): string {
  return (c.ef?.modelos ?? []).map(id => modeloEF(id)).filter(Boolean).map(m => t(m!.nombre)).join(' + ');
}

export function buildSdaHtml(sda: LearningSituation, lang: Lang, anexo?: string): string {
  const t = (k: string, vars?: Record<string, string | number>) => translate(lang, k, vars);
  const c = sda.content;
  const req = sda.request;
  const { titulo, temporal, bandTitle, pageTitle } = buildHeadings(sda, t);

  const bandTop = (text: string) => `<tr class="band-top"><td colspan="6">${esc(text)}</td></tr>`;
  const band = (text: string) => `<tr class="band"><td colspan="6">${esc(text)}</td></tr>`;
  const rowFull = (label: string, value: string) => value
    ? `<tr><th class="lbl">${esc(label)}</th><td colspan="5">${nl2br(value)}</td></tr>` : '';
  /** Las imágenes que el docente puso en una sesión, bajo su texto, con su pie de foto (solo `data:` de imagen). */
  const rowImagenes = (imagenes: { src: string; pie?: string }[]) => imagenes.length
    ? `<tr class="imgs"><th class="lbl">${esc(t('Imágenes'))}</th><td colspan="5"><div class="sda-imgs">${imagenes.map(i =>
        `<figure><img src="${i.src}" alt="${esc(i.pie ?? '')}">${i.pie ? `<figcaption>${esc(i.pie)}</figcaption>` : ''}</figure>`).join('')}</div></td></tr>`
    : '';
  const rowTriple = (l1: string, v1: string, l2: string, v2: string, l3: string, v3: string) =>
    (v1 || v2 || v3)
      ? `<tr><th class="lbl">${esc(l1)}</th><td>${nl2br(v1 || DASH)}</td><th class="lbl">${esc(l2)}</th><td>${nl2br(v2 || DASH)}</td><th class="lbl">${esc(l3)}</th><td>${nl2br(v3 || DASH)}</td></tr>`
      : '';
  const rowDouble = (l1: string, v1: string, l2: string, v2: string) =>
    (v1 || v2)
      ? `<tr><th class="lbl">${esc(l1)}</th><td>${nl2br(v1 || DASH)}</td><th class="lbl">${esc(l2)}</th><td colspan="3">${nl2br(v2 || DASH)}</td></tr>`
      : '';

  const areaVal = [req.areas.join(', '), req.nivel].filter(Boolean).join(' · ');
  const modelos = modelosDeSda(c, t);
  const modalidad = c.ef?.modalidad ? t(MODALIDADES_EF.find(m => m.id === c.ef!.modalidad)?.label ?? '') : '';
  const ordenDeportes = (c.ef?.secuencia?.length ?? 0) > 1 ? c.ef!.secuencia!.join(' → ') : '';

  const objetivosPair = rowDouble(t('Objetivos de etapa'), c.objetivosEtapa, t('Competencias clave'), c.competenciasClave);

  const gridRows =
    rowTriple(t('Temporalización'), temporal, t('Área'), areaVal, t('ODS'), c.ods) +
    // Solo la cita del decreto usado: nada de avisos sobre la aplicación en un documento oficial
    rowFull(t('Normativa curricular'), c.normativa?.cita ?? '') +
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
        rowFull(t('Modelo pedagógico'), modelos) +
        rowFull(t('Modalidad del juego o deporte'), modalidad) +
        rowFull(t('Orden de los deportes'), ordenDeportes) +
        rowFull(t('Metodología'), c.metodologia) +
        rowFull(t('Agrupamiento'), c.agrupamiento) +
        rowFull(t('Recursos'), c.recursos)
      : '') +
    (c.sesiones.length
      ? band(t('Sesiones')) +
        c.sesiones.map((s, i) => rowFull(
          `${s.fase ? `${s.fase} — ` : ''}${t('Sesión')} ${i + 1}${s.titulo ? `: ${s.titulo}` : ''}`,
          sesionEnTexto(s, t),
        ) + rowImagenes(imagenesDeSesionSda(s))).join('')
      : '') +
    (c.evaluacionTecnicas || c.evaluacionInstrumentos
      ? band(t('Evaluación')) +
        rowFull(t('Técnicas de evaluación'), c.evaluacionTecnicas) +
        rowFull(t('Instrumentos de evaluación'), c.evaluacionInstrumentos)
      : '') +
    (c.ef?.referencias.length ? band(t('Referencias')) + rowFull(t('Referencias'), c.ef.referencias.join('\n')) : '');

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
    (anexo ?? '') +
    `</article></body></html>`;
}

export async function saveSdaPdf(sda: LearningSituation, lang: Lang, anexo?: string) {
  const docs = window.electronAPI?.docs;
  if (!docs) return { error: 'not-desktop' as const };
  const html = buildSdaHtml(sda, lang, anexo);
  const res = await docs.savePdf(html, fileBase(sda) + '.pdf', { carpeta: CARPETAS.situaciones });
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
/* Una franja de sección no se queda sola al pie de una página: va con su primera fila */
.sda-grid tr.band, .sda-grid tr.band-top { break-after: avoid; page-break-after: avoid; }

/* Imágenes que el docente puso en las sesiones */
.sda-grid tr.imgs { break-inside: auto; }
.sda-imgs { display: flex; flex-wrap: wrap; gap: 10px; }
.sda-imgs figure { margin: 0; break-inside: avoid; max-width: 78mm; }
.sda-imgs img { display: block; max-width: 100%; max-height: 62mm; object-fit: contain; border: 1px solid #cbd5e1; border-radius: 3px; background: #fff; }
.sda-imgs figcaption { font-size: 10.5px; color: #475569; margin-top: 3px; line-height: 1.35; }

/* Materiales generados desde la SdA (rúbrica y diana), como anexo */
.sda-anexo { margin-top: 14px; }
.ficha-anexo { break-before: page; page-break-before: always; }
.sda-anexo h2 { font-size: 12.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #1f4e79; border-bottom: 1.5px solid #bdd7ee; padding-bottom: 4px; margin: 0 0 10px; }
.sda-anexo h3 { font-size: 12px; color: #1e3a5f; margin: 0 0 6px; }
.anexo-instr { margin: 0 0 12px; break-inside: avoid; }
.mat-instr { width: 100%; border-collapse: collapse; font-size: 11px; }
.mat-instr th, .mat-instr td { border: 0.75px solid #8faadc; padding: 5px 8px; text-align: left; vertical-align: top; }
.mat-instr thead th { background: #dce6f1; color: #1e3a5f; }
.mat-diana { display: flex; gap: 16px; align-items: flex-start; }
.mat-diana-svg { flex: none; }
.mat-diana-svg svg { width: 220px; height: 220px; }
.mat-diana-leyenda { flex: 1; min-width: 0; }

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
    // Una línea del texto, un párrafo: en Word un salto de línea dentro de un TextRun no se ve
    children: (text || DASH).split('\n').map(linea => new Paragraph({
      children: [new TextRun({
        text: linea,
        bold: style !== 'value',
        size: style === 'bandTop' ? 20 : style === 'band' ? 19 : style === 'label' ? 19 : 20,
        color,
        allCaps: style === 'band',
      })],
    })),
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

/** Lo más ancho que sale una imagen de una sesión en el Word, en píxeles (unos 8 cm). */
const IMAGEN_WORD_ANCHO = 300;
const IMAGEN_WORD_ALTO = 230;

/** Una fila con las imágenes de una sesión (y su pie de foto) bajo el texto de la sesión. WebP no lo admite Word: se deja fuera. */
function gRowImagenes(etiqueta: string, imagenes: { src: string; ancho: number; alto: number; pie?: string }[]): TableRow[] {
  const parrafos: Paragraph[] = [];
  for (const im of imagenes) {
    const b = bytesDeImagen(im.src);
    if (!b) continue;
    const escala = Math.min(1, IMAGEN_WORD_ANCHO / Math.max(1, im.ancho || IMAGEN_WORD_ANCHO), IMAGEN_WORD_ALTO / Math.max(1, im.alto || IMAGEN_WORD_ALTO));
    const ancho = Math.max(24, Math.round((im.ancho || IMAGEN_WORD_ANCHO) * escala));
    const alto = Math.max(24, Math.round((im.alto || IMAGEN_WORD_ALTO) * escala));
    parrafos.push(new Paragraph({
      spacing: { before: 60, after: im.pie ? 20 : 80 },
      children: [new ImageRun({ type: b.tipo, data: b.datos, transformation: { width: ancho, height: alto } })],
    }));
    if (im.pie) {
      parrafos.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: im.pie, italics: true, size: 18, color: '475569' })] }));
    }
  }
  if (parrafos.length === 0) return [];
  return [new TableRow({
    children: [
      gcell(etiqueta, { style: 'label' }),
      new TableCell({
        columnSpan: 5, width: { size: 5 * COL_W, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER,
        margins: { top: 90, bottom: 90, left: 110, right: 110 }, children: parrafos,
      }),
    ],
  })];
}

/** La rúbrica y la diana generadas desde la SdA, para ir de anexo al final del Word. */
export interface MaterialesSda { rubricRows?: SdaRubricRow[] | null; dianaRows?: SdaDianaItem[] | null }

const DIANA_PX = 340;

/** La diana dibujada como PNG (`docx` no admite SVG); `null` sin navegador o si algo falla, y entonces solo va la tabla. */
async function dianaImagen(rows: SdaDianaItem[]): Promise<ImageRun | null> {
  if (typeof document === 'undefined') return null;
  try {
    const svg = dianaSvg(dianaDeFilas(rows)).replace('<svg ', `<svg width="${DIANA_PX}" height="${DIANA_PX}" `);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('svg'));
        el.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = DIANA_PX * 2; canvas.height = DIANA_PX * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, DIANA_PX, DIANA_PX);
      const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!png) return null;
      return new ImageRun({ type: 'png', data: new Uint8Array(await png.arrayBuffer()), transformation: { width: 260, height: 260 } });
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

const hcell = (text: string, opts: { head?: boolean; width?: number } = {}) => new TableCell({
  width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
  shading: opts.head ? { fill: 'DCE6F1' } : undefined,
  margins: { top: 60, bottom: 60, left: 90, right: 90 },
  children: (text || DASH).split('\n').map(l => new Paragraph({ children: [new TextRun({ text: l, bold: opts.head, size: 19 })] })),
});

/** Tabla de niveles: una fila por criterio o ítem, con un descriptor por nivel. */
function tablaNiveles(primera: string, filas: { nombre: string; n: string[] }[], t: (k: string) => string): Table {
  const w = 82 / DEFAULT_LEVELS.length;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS,
    rows: [
      new TableRow({ tableHeader: true, children: [hcell(primera, { head: true, width: 18 }), ...DEFAULT_LEVELS.map(l => hcell(t(l.label), { head: true, width: w }))] }),
      ...filas.map(f => new TableRow({ cantSplit: true, children: [hcell(f.nombre, { head: true, width: 18 }), ...f.n.map(x => hcell(x, { width: w }))] })),
    ],
  });
}

/** El anexo «Instrumentos de evaluación» del Word: la rúbrica en tabla y la diana dibujada con sus descriptores. */
async function anexoDocx(m: MaterialesSda | undefined, t: (k: string) => string): Promise<(Paragraph | Table)[]> {
  const out: (Paragraph | Table)[] = [];
  const titulo = (txt: string, nivel: 'h2' | 'h3') => new Paragraph({
    children: [new TextRun({ text: nivel === 'h2' ? txt.toUpperCase() : txt, bold: true, color: '1F4E79', size: nivel === 'h2' ? 24 : 22 })],
    spacing: { before: nivel === 'h2' ? 360 : 200, after: 100 }, pageBreakBefore: nivel === 'h2',
  });
  if (m?.rubricRows?.length || m?.dianaRows?.length) out.push(titulo(t('Instrumentos de evaluación'), 'h2'));
  if (m?.rubricRows?.length) {
    out.push(titulo(t('Rúbrica'), 'h3'));
    out.push(tablaNiveles(t('Criterio'), m.rubricRows.map(r => ({ nombre: r.criterio, n: [r.nivel1, r.nivel2, r.nivel3, r.nivel4] })), t));
  }
  if (m?.dianaRows?.length) {
    out.push(titulo(t('Diana'), 'h3'));
    const img = await dianaImagen(m.dianaRows);
    if (img) out.push(new Paragraph({ children: [img], alignment: AlignmentType.CENTER, spacing: { after: 120 } }));
    out.push(tablaNiveles(t('Ítem'), m.dianaRows.map((r, i) => ({ nombre: `${i + 1}. ${r.item}`, n: [r.nivel1, r.nivel2, r.nivel3, r.nivel4] })), t));
  }
  return out;
}

/** Construye el .docx. Separado de `saveSdaDocx` para poder probarlo sin DOM. */
export async function buildSdaDocxBlob(sda: LearningSituation, lang: Lang, materiales?: MaterialesSda): Promise<Blob> {
  const t = (k: string, vars?: Record<string, string | number>) => translate(lang, k, vars);
  const c = sda.content;
  const req = sda.request;
  const { temporal, bandTitle, pageTitle } = buildHeadings(sda, t);

  const areaVal = [req.areas.join(', '), req.nivel].filter(Boolean).join(' · ');
  const modelos = modelosDeSda(c, t);
  const modalidad = c.ef?.modalidad ? t(MODALIDADES_EF.find(m => m.id === c.ef!.modalidad)?.label ?? '') : '';
  const ordenDeportes = (c.ef?.secuencia?.length ?? 0) > 1 ? c.ef!.secuencia!.join(' → ') : '';
  const objetivosPair = () => gRowDouble(t('Objetivos de etapa'), c.objetivosEtapa, t('Competencias clave'), c.competenciasClave);

  // Las filas de las sesiones, con las imágenes que el docente puso en cada una (se preparan antes: meterlas en el Word es asíncrono)
  const filasSesiones: TableRow[] = [];
  for (let i = 0; i < c.sesiones.length; i++) {
    const s = c.sesiones[i];
    filasSesiones.push(
      ...gRowFull(
        `${s.fase ? `${s.fase} — ` : ''}${t('Sesión')} ${i + 1}${s.titulo ? `: ${s.titulo}` : ''}`,
        sesionEnTexto(s, t),
      ),
      ...gRowImagenes(t('Imágenes'), imagenesDeSesionSda(s)),
    );
  }

  const rows: TableRow[] = [
    gBandTop(bandTitle),
    ...gRowTriple(t('Temporalización'), temporal, t('Área'), areaVal, t('ODS'), c.ods),
    // Solo la cita del decreto usado: nada de avisos sobre la aplicación en un documento oficial
    ...gRowFull(t('Normativa curricular'), c.normativa?.cita ?? ''),
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
      ...gRowFull(t('Modelo pedagógico'), modelos),
      ...gRowFull(t('Modalidad del juego o deporte'), modalidad),
      ...gRowFull(t('Orden de los deportes'), ordenDeportes),
      ...gRowFull(t('Metodología'), c.metodologia),
      ...gRowFull(t('Agrupamiento'), c.agrupamiento),
      ...gRowFull(t('Recursos'), c.recursos),
    ] : []),
    ...(c.sesiones.length ? [
      gBand(t('Sesiones')),
      ...filasSesiones,
    ] : []),
    ...(c.evaluacionTecnicas || c.evaluacionInstrumentos ? [
      gBand(t('Evaluación')),
      ...gRowFull(t('Técnicas de evaluación'), c.evaluacionTecnicas),
      ...gRowFull(t('Instrumentos de evaluación'), c.evaluacionInstrumentos),
    ] : []),
    ...(c.ef?.referencias.length ? [gBand(t('Referencias')), ...gRowFull(t('Referencias'), c.ef.referencias.join('\n'))] : []),
  ];

  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: pageTitle, heading: HeadingLevel.TITLE, spacing: { after: sda.class_name ? 40 : 160 } }),
  ];
  if (sda.class_name) {
    children.push(new Paragraph({ children: [new TextRun({ text: sda.class_name, italics: true, color: '64748B' })], spacing: { after: 160 } }));
  }
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS, rows }));
  children.push(...await anexoDocx(materiales, t));

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

export async function saveSdaDocx(sda: LearningSituation, lang: Lang, materiales?: MaterialesSda) {
  const blob = await buildSdaDocxBlob(sda, lang, materiales);
  await downloadFile(blob, fileBase(sda) + '.docx', CARPETAS.situaciones);
}
