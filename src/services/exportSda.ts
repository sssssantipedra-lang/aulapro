/**
 * Exporta una situación de aprendizaje a PDF o a Word.
 *
 * El PDF se construye como un documento HTML independiente y se imprime con
 * `docs.savePdf` (el mismo camino que usan las actas en Records.tsx): pasa
 * por el proceso de Electron, así que solo funciona en el escritorio. El Word
 * no necesita nada de eso —la librería `docx` genera el archivo entero en el
 * propio navegador— y por eso funciona igual en la versión web.
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
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

  const section = (label: string, value: string) => value
    ? `<section class="sda-sec"><h2>${esc(label)}</h2><p>${nl2br(value)}</p></section>`
    : '';

  const areas = c.areas.map(a => `
    <div class="sda-area">
      <h3>${esc(a.area)}</h3>
      <p><b>${esc(t('Competencias específicas'))}:</b> ${nl2br(a.competenciasEspecificas)}</p>
      <p><b>${esc(t('Criterios de evaluación'))}:</b> ${nl2br(a.criteriosEvaluacion)}</p>
      <p><b>${esc(t('Saberes básicos'))}:</b> ${nl2br(a.saberesBasicos)}</p>
    </div>`).join('');

  const sesiones = c.sesiones.map((s, i) => `
    <div class="sda-session">
      <span class="sda-session-n">${i + 1}</span>
      <div>
        <div class="sda-session-hd"><b>${esc(s.titulo)}</b><span class="sda-session-fase">${esc(s.fase)}</span></div>
        <p>${nl2br(s.descripcion)}</p>
      </div>
    </div>`).join('');

  const meta = [sda.class_name, sda.request.nivel, sda.request.temporalizacion, sda.request.meses]
    .filter((s): s is string => !!s).map(esc).join(' · ');

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
    `<title>${esc(c.titulo || sda.title)}</title>` +
    `<style>${SDA_DOC_STANDALONE}${SDA_DOC_STYLE}</style>` +
    `</head><body><article class="sda-doc">` +
    `<header class="sda-hd"><h1>${esc(c.titulo || sda.title)}</h1>${meta ? `<p class="sda-meta">${meta}</p>` : ''}</header>` +
    section(t('Justificación'), c.justificacion) +
    section(t('Objetivos de etapa'), c.objetivosEtapa) +
    section(t('Competencias clave'), c.competenciasClave) +
    section(t('Explicación curricular (para ti)'), c.explicacionCurricular) +
    (c.areas.length ? `<section class="sda-sec"><h2>${esc(t('Por áreas'))}</h2>${areas}</section>` : '') +
    section(t('Metodología'), c.metodologia) +
    section(t('Agrupamiento'), c.agrupamiento) +
    section(t('Recursos'), c.recursos) +
    section(t('Producto final'), c.productoFinal) +
    `<section class="sda-sec"><h2>${esc(t('Medidas de inclusión'))}</h2>` +
    `<p><b>${esc(t('Para todo el grupo'))}:</b> ${nl2br(c.inclusionUniversal)}</p>` +
    `<p><b>${esc(t('Apoyo puntual'))}:</b> ${nl2br(c.inclusionAdicional)}</p>` +
    `<p><b>${esc(t('Necesidades específicas'))}:</b> ${nl2br(c.inclusionIndividualizada)}</p>` +
    `</section>` +
    section(t('Técnicas de evaluación'), c.evaluacionTecnicas) +
    section(t('Instrumentos de evaluación'), c.evaluacionInstrumentos) +
    section(t('ODS relacionados'), c.ods) +
    (c.sesiones.length ? `<section class="sda-sec sda-sessions"><h2>${esc(t('Sesiones'))}</h2>${sesiones}</section>` : '') +
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
.sda-hd { border-bottom: 2px solid #1e293b; padding-bottom: 14px; margin-bottom: 20px; }
.sda-hd h1 { font-size: 24px; margin: 0 0 4px; letter-spacing: -0.01em; }
.sda-meta { font-size: 12px; color: #64748b; margin: 0; }
.sda-sec { margin-bottom: 18px; break-inside: avoid; page-break-inside: avoid; }
.sda-sec h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #0369a1; margin: 0 0 6px; }
.sda-sec p { font-size: 13px; line-height: 1.6; margin: 0 0 6px; white-space: pre-line; }
.sda-area { padding: 10px 0; border-top: 1px solid #e2e8f0; break-inside: avoid; page-break-inside: avoid; }
.sda-area:first-of-type { border-top: none; }
.sda-area h3 { font-size: 13.5px; margin: 0 0 6px; }
.sda-area p { font-size: 12.5px; line-height: 1.55; margin: 0 0 4px; }
.sda-session { display: flex; gap: 10px; padding: 8px 0; break-inside: avoid; page-break-inside: avoid; }
.sda-session-n { flex-shrink: 0; width: 22px; height: 22px; border-radius: 6px; background: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.sda-session-hd { font-size: 13px; margin-bottom: 3px; }
.sda-session-fase { margin-left: 8px; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
.sda-session p { font-size: 12.5px; line-height: 1.5; margin: 0; color: #475569; }
@media print { @page { size: A4 portrait; margin: 16mm 18mm; } }
`;

const SDA_DOC_STANDALONE = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
`;

/* ── Word (generado en el propio navegador, sin pasar por Electron) ── */

/** Construye el .docx. Separado de `saveSdaDocx` para poder probarlo sin DOM. */
export async function buildSdaDocxBlob(sda: LearningSituation, lang: Lang): Promise<Blob> {
  const t = (k: string, vars?: Record<string, string | number>) => translate(lang, k, vars);
  const c = sda.content;

  const heading = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 100 } });
  const body = (text: string) => new Paragraph({ children: [new TextRun(text || '—')], spacing: { after: 160 } });
  const labeled = (label: string, text: string) => new Paragraph({
    children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(text || '—')],
    spacing: { after: 60 },
  });

  const children: Paragraph[] = [
    new Paragraph({ text: c.titulo || sda.title, heading: HeadingLevel.TITLE, spacing: { after: 80 } }),
  ];

  const meta = [sda.class_name, sda.request.nivel, sda.request.temporalizacion, sda.request.meses].filter(Boolean).join(' · ');
  if (meta) {
    children.push(new Paragraph({ children: [new TextRun({ text: meta, italics: true, color: '64748B' })], spacing: { after: 240 } }));
  }

  children.push(heading(t('Justificación')), body(c.justificacion));
  children.push(heading(t('Objetivos de etapa')), body(c.objetivosEtapa));
  children.push(heading(t('Competencias clave')), body(c.competenciasClave));
  children.push(heading(t('Explicación curricular (para ti)')), body(c.explicacionCurricular));

  if (c.areas.length) {
    children.push(heading(t('Por áreas')));
    for (const a of c.areas) {
      children.push(new Paragraph({ children: [new TextRun({ text: a.area, bold: true, size: 24 })], spacing: { before: 140, after: 60 } }));
      children.push(labeled(t('Competencias específicas'), a.competenciasEspecificas));
      children.push(labeled(t('Criterios de evaluación'), a.criteriosEvaluacion));
      children.push(labeled(t('Saberes básicos'), a.saberesBasicos));
    }
  }

  children.push(heading(t('Metodología')), body(c.metodologia));
  children.push(heading(t('Agrupamiento')), body(c.agrupamiento));
  children.push(heading(t('Recursos')), body(c.recursos));
  children.push(heading(t('Producto final')), body(c.productoFinal));

  children.push(heading(t('Medidas de inclusión')));
  children.push(labeled(t('Para todo el grupo'), c.inclusionUniversal));
  children.push(labeled(t('Apoyo puntual'), c.inclusionAdicional));
  children.push(new Paragraph({
    children: [new TextRun({ text: `${t('Necesidades específicas')}: `, bold: true }), new TextRun(c.inclusionIndividualizada || '—')],
    spacing: { after: 200 },
  }));

  children.push(heading(t('Técnicas de evaluación')), body(c.evaluacionTecnicas));
  children.push(heading(t('Instrumentos de evaluación')), body(c.evaluacionInstrumentos));
  children.push(heading(t('ODS relacionados')), body(c.ods));

  if (c.sesiones.length) {
    children.push(heading(t('Sesiones')));
    c.sesiones.forEach((s, i) => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}. ${s.titulo}  `, bold: true }),
          new TextRun({ text: s.fase, italics: true, color: '64748B' }),
        ],
        spacing: { before: 120, after: 40 },
      }));
      children.push(new Paragraph({ children: [new TextRun(s.descripcion)], spacing: { after: 100 } }));
    });
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
