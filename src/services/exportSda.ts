/**
 * Exporta una situación de aprendizaje a PDF o a Word, en formato tabla —el
 * mismo que usan las programaciones LOMLOE en papel: una tabla de dos
 * columnas (campo / contenido) para el cuerpo, y una tabla propia para las
 * áreas y otra para las sesiones, con su cabecera.
 *
 * El PDF se construye como un documento HTML independiente y se imprime con
 * `docs.savePdf` (el mismo camino que usan las actas en Records.tsx): pasa
 * por el proceso de Electron, así que solo funciona en el escritorio. El Word
 * no necesita nada de eso —la librería `docx` genera el archivo entero en el
 * propio navegador— y por eso funciona igual en la versión web.
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, VerticalAlign, BorderStyle,
} from 'docx';
import type { LearningSituation } from '../types';
import { translate, type Lang } from '../i18n';

function fileBase(sda: LearningSituation): string {
  const slug = (s: string) => s.trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  return `sda-${slug(sda.title || 'situacion-de-aprendizaje')}`;
}

/* ── PDF (HTML independiente, impreso por Electron) ── */

const esc = (s: string) => (s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
const nl2br = (s: string) => esc(s).replace(/\n/g, '<br>');

export function buildSdaHtml(sda: LearningSituation, lang: Lang): string {
  const t = (k: string, vars?: Record<string, string | number>) => translate(lang, k, vars);
  const c = sda.content;

  /** Una fila de la tabla principal: etiqueta a la izquierda, texto a la derecha. */
  const row = (label: string, value: string) => value
    ? `<tr><th>${esc(label)}</th><td>${nl2br(value)}</td></tr>`
    : '';

  const mainRows =
    row(t('Justificación'), c.justificacion) +
    row(t('Objetivos de etapa'), c.objetivosEtapa) +
    row(t('Competencias clave'), c.competenciasClave) +
    row(t('Explicación curricular (para ti)'), c.explicacionCurricular) +
    row(t('Metodología'), c.metodologia) +
    row(t('Agrupamiento'), c.agrupamiento) +
    row(t('Recursos'), c.recursos) +
    row(t('Producto final'), c.productoFinal) +
    row(t('Inclusión — para todo el grupo'), c.inclusionUniversal) +
    row(t('Inclusión — apoyo puntual'), c.inclusionAdicional) +
    row(t('Inclusión — necesidades específicas'), c.inclusionIndividualizada) +
    row(t('Técnicas de evaluación'), c.evaluacionTecnicas) +
    row(t('Instrumentos de evaluación'), c.evaluacionInstrumentos) +
    row(t('ODS relacionados'), c.ods);

  const areasTable = c.areas.length ? `
    <h2>${esc(t('Por áreas'))}</h2>
    <table class="sda-table sda-areas">
      <thead><tr>
        <th>${esc(t('Área'))}</th>
        <th>${esc(t('Competencias específicas'))}</th>
        <th>${esc(t('Criterios de evaluación'))}</th>
        <th>${esc(t('Saberes básicos'))}</th>
      </tr></thead>
      <tbody>${c.areas.map(a => `
        <tr>
          <td class="sda-strong">${esc(a.area)}</td>
          <td>${nl2br(a.competenciasEspecificas)}</td>
          <td>${nl2br(a.criteriosEvaluacion)}</td>
          <td>${nl2br(a.saberesBasicos)}</td>
        </tr>`).join('')}</tbody>
    </table>` : '';

  const sesionesTable = c.sesiones.length ? `
    <h2>${esc(t('Sesiones'))}</h2>
    <table class="sda-table sda-sessions">
      <thead><tr>
        <th class="sda-col-n">${esc(t('Nº'))}</th>
        <th>${esc(t('Fase'))}</th>
        <th>${esc(t('Título'))}</th>
        <th>${esc(t('Descripción'))}</th>
      </tr></thead>
      <tbody>${c.sesiones.map((s, i) => `
        <tr>
          <td class="sda-col-n">${i + 1}</td>
          <td>${esc(s.fase)}</td>
          <td class="sda-strong">${esc(s.titulo)}</td>
          <td>${nl2br(s.descripcion)}</td>
        </tr>`).join('')}</tbody>
    </table>` : '';

  const meta = [sda.class_name, sda.request.nivel, sda.request.temporalizacion, sda.request.meses]
    .filter((s): s is string => !!s).map(esc).join(' · ');

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
    `<title>${esc(c.titulo || sda.title)}</title>` +
    `<style>${SDA_DOC_STANDALONE}${SDA_DOC_STYLE}</style>` +
    `</head><body><article class="sda-doc">` +
    `<header class="sda-hd"><h1>${esc(c.titulo || sda.title)}</h1>${meta ? `<p class="sda-meta">${meta}</p>` : ''}</header>` +
    `<table class="sda-table sda-main"><tbody>${mainRows}</tbody></table>` +
    areasTable +
    sesionesTable +
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
.sda-doc { max-width: 210mm; margin: 0 auto; padding: 18mm 20mm; background: #fff; color: #1e293b; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.sda-hd { border-bottom: 2px solid #1e293b; padding-bottom: 14px; margin-bottom: 18px; }
.sda-hd h1 { font-size: 24px; margin: 0 0 4px; letter-spacing: -0.01em; }
.sda-meta { font-size: 12px; color: #64748b; margin: 0; }
.sda-doc h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #0369a1; margin: 22px 0 8px; }

.sda-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 4px; }
.sda-table th, .sda-table td { border: 0.75px solid #cbd5e1; padding: 7px 10px; text-align: left; vertical-align: top; }
.sda-table td { line-height: 1.5; white-space: pre-line; }
.sda-strong { font-weight: 700; }

/* Tabla principal: etiqueta a la izquierda, angosta, en gris */
.sda-main th { width: 26%; background: #f1f5f9; font-weight: 700; color: #334155; font-size: 11px; }

/* Áreas y sesiones: cabecera azulada, columnas repartidas */
.sda-areas thead th, .sda-sessions thead th {
  background: #e0f2fe; color: #0369a1; font-size: 10.5px; text-transform: uppercase;
  letter-spacing: 0.03em; font-weight: 800;
}
.sda-col-n { width: 32px; text-align: center; color: #64748b; font-weight: 700; }

/* Reparto entre páginas: vale tanto en el PDF como en la impresora */
.sda-table tr { break-inside: avoid; page-break-inside: avoid; }
.sda-areas thead, .sda-sessions thead { display: table-header-group; }
@media print { @page { size: A4 portrait; margin: 16mm 18mm; } }
`;

const SDA_DOC_STANDALONE = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
`;

/* ── Word (generado en el propio navegador, sin pasar por Electron) ── */

const BORDER = { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' };
const TABLE_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, insideHorizontal: BORDER, insideVertical: BORDER };

/** Una celda de texto normal, o de cabecera si `header`/`label` está marcado. */
function cell(text: string, opts: { width?: number; header?: boolean; label?: boolean } = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.header ? { fill: 'E0F2FE' } : opts.label ? { fill: 'F1F5F9' } : undefined,
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    children: [new Paragraph({
      children: [new TextRun({
        text: text || '—',
        bold: opts.header || opts.label,
        size: opts.header ? 18 : 20,
        color: opts.header ? '0369A1' : undefined,
      })],
    })],
  });
}

/** Construye el .docx. Separado de `saveSdaDocx` para poder probarlo sin DOM. */
export async function buildSdaDocxBlob(sda: LearningSituation, lang: Lang): Promise<Blob> {
  const t = (k: string, vars?: Record<string, string | number>) => translate(lang, k, vars);
  const c = sda.content;

  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: c.titulo || sda.title, heading: HeadingLevel.TITLE, spacing: { after: 80 } }),
  ];

  const meta = [sda.class_name, sda.request.nivel, sda.request.temporalizacion, sda.request.meses].filter(Boolean).join(' · ');
  if (meta) {
    children.push(new Paragraph({ children: [new TextRun({ text: meta, italics: true, color: '64748B' })], spacing: { after: 200 } }));
  }

  /* Tabla principal: campo | contenido */
  const mainFields: [string, string][] = [
    [t('Justificación'), c.justificacion],
    [t('Objetivos de etapa'), c.objetivosEtapa],
    [t('Competencias clave'), c.competenciasClave],
    [t('Explicación curricular (para ti)'), c.explicacionCurricular],
    [t('Metodología'), c.metodologia],
    [t('Agrupamiento'), c.agrupamiento],
    [t('Recursos'), c.recursos],
    [t('Producto final'), c.productoFinal],
    [t('Inclusión — para todo el grupo'), c.inclusionUniversal],
    [t('Inclusión — apoyo puntual'), c.inclusionAdicional],
    [t('Inclusión — necesidades específicas'), c.inclusionIndividualizada],
    [t('Técnicas de evaluación'), c.evaluacionTecnicas],
    [t('Instrumentos de evaluación'), c.evaluacionInstrumentos],
    [t('ODS relacionados'), c.ods],
  ];
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: mainFields
      .filter(([, value]) => value)
      .map(([label, value]) => new TableRow({
        children: [cell(label, { width: 26, label: true }), cell(value, { width: 74 })],
      })),
  }));

  /* Tabla de áreas */
  if (c.areas.length) {
    children.push(new Paragraph({ text: t('Por áreas'), heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 100 } }));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            cell(t('Área'), { width: 16, header: true }),
            cell(t('Competencias específicas'), { width: 28, header: true }),
            cell(t('Criterios de evaluación'), { width: 28, header: true }),
            cell(t('Saberes básicos'), { width: 28, header: true }),
          ],
        }),
        ...c.areas.map(a => new TableRow({
          children: [
            cell(a.area, { width: 16, label: true }),
            cell(a.competenciasEspecificas, { width: 28 }),
            cell(a.criteriosEvaluacion, { width: 28 }),
            cell(a.saberesBasicos, { width: 28 }),
          ],
        })),
      ],
    }));
  }

  /* Tabla de sesiones */
  if (c.sesiones.length) {
    children.push(new Paragraph({ text: t('Sesiones'), heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 100 } }));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            cell(t('Nº'), { width: 6, header: true }),
            cell(t('Fase'), { width: 16, header: true }),
            cell(t('Título'), { width: 24, header: true }),
            cell(t('Descripción'), { width: 54, header: true }),
          ],
        }),
        ...c.sesiones.map((s, i) => new TableRow({
          children: [
            cell(String(i + 1), { width: 6 }),
            cell(s.fase, { width: 16 }),
            cell(s.titulo, { width: 24, label: true }),
            cell(s.descripcion, { width: 54 }),
          ],
        })),
      ],
    }));
  }

  const doc = new Document({
    sections: [{ children, properties: { page: { margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 } } } }],
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
