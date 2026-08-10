/**
 * Exporta una ficha de trabajo a PDF o a Word — pensada para imprimir y
 * repartir en clase, así que sale en VERTICAL (a diferencia de la SdA o las
 * actas, que van horizontales) y sin las soluciones: el campo `solucion` de
 * cada ejercicio es solo para el profesorado y nunca se incluye aquí.
 *
 * Mismo patrón que `exportSda.ts`: el PDF es un documento HTML impreso por
 * Electron (`docs.savePdf`, ahora con `landscape: false`); el Word lo genera
 * la librería `docx` en el propio navegador, sin pasar por Electron.
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
} from 'docx';
import type { Ficha } from '../types';
import type { FichaExerciseType } from './resources';
import { translate, type Lang } from '../i18n';

function fileBase(f: Ficha): string {
  const slug = (s: string) => s.trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  return `ficha-${slug(f.title || 'de-trabajo')}`;
}

/** Cuánto espacio en blanco necesita cada tipo de ejercicio para responder. */
type EspacioTipo = 'box' | 'lines' | 'line' | 'none';
function espacioTipo(tipo: FichaExerciseType): EspacioTipo {
  if (tipo === 'problema') return 'box';
  if (tipo === 'abierta') return 'lines';
  if (tipo === 'completar') return 'line';
  return 'none'; // opcion_multiple: el hueco es elegir una opción, no escribir
}

/* ── PDF (HTML independiente, impreso por Electron en vertical) ── */

const esc = (s: string) => (s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

export function buildFichaHtml(f: Ficha, lang: Lang): string {
  const t = (k: string, vars?: Record<string, string | number>) => translate(lang, k, vars);
  const c = f.content;
  const letra = (i: number) => String.fromCharCode(97 + i); // a, b, c…

  const ejerciciosHtml = c.ejercicios.map(ex => {
    const opciones = ex.tipo === 'opcion_multiple' && ex.opciones?.length
      ? `<ol class="ficha-opciones">${ex.opciones.map((o, j) => `<li><span class="op-letra">${letra(j)})</span> ${esc(o)}</li>`).join('')}</ol>`
      : '';
    const espacio = espacioTipo(ex.tipo);
    const espacioHtml = espacio === 'box' ? '<div class="ficha-espacio box"></div>'
      : espacio === 'lines' ? '<div class="ficha-espacio lines"><div class="ln"></div><div class="ln"></div><div class="ln"></div></div>'
      : espacio === 'line' ? '<div class="ficha-espacio line"></div>'
      : '';
    return `<li><div class="ficha-enunciado">${esc(ex.enunciado)}</div>${opciones}${espacioHtml}</li>`;
  }).join('');

  const datos = `${t('Nombre')}: ______________________________&nbsp;&nbsp;&nbsp; ${t('Fecha')}: ____________&nbsp;&nbsp;&nbsp; ${t('Clase')}: __________`;

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
    `<title>${esc(c.titulo || f.title)}</title>` +
    `<style>${FICHA_DOC_STANDALONE}${FICHA_DOC_STYLE}</style>` +
    `</head><body><article class="ficha-doc">` +
    `<h1>${esc(c.titulo || f.title)}</h1>` +
    `<div class="ficha-datos">${datos}</div>` +
    (c.instrucciones ? `<p class="ficha-instr">${esc(c.instrucciones)}</p>` : '') +
    `<ol class="ficha-ejercicios">${ejerciciosHtml}</ol>` +
    `</article></body></html>`;
}

export async function saveFichaPdf(f: Ficha, lang: Lang) {
  const docs = window.electronAPI?.docs;
  if (!docs) return { error: 'not-desktop' as const };
  const html = buildFichaHtml(f, lang);
  const res = await docs.savePdf(html, fileBase(f) + '.pdf', { landscape: false });
  if (!res.canceled && !res.error && res.path) docs.reveal(res.path);
  return res;
}

const FICHA_DOC_STYLE = `
.ficha-doc { max-width: 100%; margin: 0 auto; padding: 4mm 6mm; background: #fff; color: #1e293b; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.ficha-doc h1 { font-size: 18px; font-weight: 800; margin: 0 0 12px; letter-spacing: -0.01em; }
.ficha-datos { font-size: 12.5px; color: #334155; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #cbd5e1; }
.ficha-instr { font-size: 12.5px; color: #475569; line-height: 1.6; margin: 0 0 18px; font-style: italic; }

.ficha-ejercicios { list-style: none; counter-reset: ej; margin: 0; padding: 0; }
.ficha-ejercicios > li { counter-increment: ej; margin-bottom: 20px; break-inside: avoid; page-break-inside: avoid; }
.ficha-ejercicios > li::before { content: counter(ej) '. '; font-weight: 800; color: #0369a1; }
.ficha-enunciado { display: inline; font-size: 13px; line-height: 1.6; }

.ficha-opciones { list-style: none; margin: 8px 0 0; padding: 0 0 0 18px; }
.ficha-opciones li { font-size: 12.5px; line-height: 1.9; }
.op-letra { font-weight: 700; color: #64748b; margin-right: 4px; }

.ficha-espacio.box { min-height: 90px; border: 0.75px solid #cbd5e1; border-radius: 6px; margin-top: 8px; }
.ficha-espacio.lines { margin-top: 10px; }
.ficha-espacio.lines .ln { border-bottom: 0.75px solid #94a3b8; height: 24px; }
.ficha-espacio.line { border-bottom: 0.75px solid #94a3b8; height: 24px; margin-top: 8px; max-width: 55%; }

@media print { @page { size: A4 portrait; margin: 14mm 16mm; } }
`;

const FICHA_DOC_STANDALONE = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
`;

/* ── Word (generado en el propio navegador, sin pasar por Electron) ── */

/** Construye el .docx. Separado de `saveFichaDocx` para poder probarlo sin DOM. */
export async function buildFichaDocxBlob(f: Ficha, lang: Lang): Promise<Blob> {
  const t = (k: string, vars?: Record<string, string | number>) => translate(lang, k, vars);
  const c = f.content;
  const letra = (i: number) => String.fromCharCode(97 + i);

  const children: Paragraph[] = [
    new Paragraph({ text: c.titulo || f.title, heading: HeadingLevel.TITLE, spacing: { after: 120 } }),
    new Paragraph({
      children: [new TextRun({
        text: `${t('Nombre')}: ______________________________     ${t('Fecha')}: ____________     ${t('Clase')}: __________`,
        size: 20,
      })],
      spacing: { after: 200 },
      border: { bottom: { style: 'single', size: 4, color: 'CBD5E1', space: 8 } },
    }),
  ];

  if (c.instrucciones) {
    children.push(new Paragraph({
      children: [new TextRun({ text: c.instrucciones, italics: true, color: '475569' })],
      spacing: { after: 240 },
    }));
  }

  c.ejercicios.forEach((ex, i) => {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${i + 1}. `, bold: true, color: '0369A1' }),
        new TextRun({ text: ex.enunciado }),
      ],
      spacing: { before: i === 0 ? 0 : 220, after: 60 },
    }));

    if (ex.tipo === 'opcion_multiple' && ex.opciones?.length) {
      ex.opciones.forEach((o, j) => {
        children.push(new Paragraph({
          children: [new TextRun({ text: `${letra(j)}) `, bold: true, color: '64748B' }), new TextRun({ text: o })],
          indent: { left: 340 },
          spacing: { after: 40 },
        }));
      });
    }

    const espacio = espacioTipo(ex.tipo);
    if (espacio === 'lines') {
      for (let k = 0; k < 3; k++) {
        children.push(new Paragraph({ text: '', spacing: { after: 260 }, border: { bottom: { style: 'single', size: 4, color: '94A3B8', space: 1 } } }));
      }
    } else if (espacio === 'line') {
      children.push(new Paragraph({ text: '', spacing: { after: 200 }, border: { bottom: { style: 'single', size: 4, color: '94A3B8', space: 1 } } }));
    } else if (espacio === 'box') {
      // Sin API sencilla de "caja" en docx: varias líneas en blanco hacen el mismo papel.
      for (let k = 0; k < 4; k++) {
        children.push(new Paragraph({ text: '', spacing: { after: 260 }, border: { bottom: { style: 'single', size: 4, color: 'CBD5E1', space: 1 } } }));
      }
    }
  });

  const doc = new Document({
    sections: [{ children, properties: { page: { margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 } } } }],
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
  });

  return Packer.toBlob(doc);
}

export async function saveFichaDocx(f: Ficha, lang: Lang) {
  const blob = await buildFichaDocxBlob(f, lang);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileBase(f) + '.docx';
  a.click();
  URL.revokeObjectURL(url);
}
