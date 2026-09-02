/**
 * Exporta un acta de reunión o una memoria de formación a PDF o a Word.
 *
 * Mismo patrón que `exportSda.ts`: el PDF es un documento HTML que imprime el
 * proceso de Electron (`docs.savePdf`) y el Word lo genera la librería `docx`
 * en el propio navegador, así que el Word funciona también en la versión web.
 *
 * A diferencia de la SdA, estos van en VERTICAL: son documentos de texto
 * corrido para archivar o entregar en el centro, no rejillas de columnas.
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType,
} from 'docx';
import type { WorkSession } from '../types';
import { translate, type Lang } from '../i18n';

type T = (k: string, vars?: Record<string, string | number>) => string;

function fileBase(s: WorkSession): string {
  const slug = (x: string) => x.trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  const prefijo = s.kind === 'meeting' ? 'acta' : 'formacion';
  return `${prefijo}-${slug(s.title || 'sin-titulo')}-${s.date}`;
}

/** Día del calendario a partir de `AAAA-MM-DD`, sin pasar por Date (ver audit.ts). */
function formatDay(iso: string): string {
  const [y, m, d] = (iso || '').split('-');
  return d && m && y ? `${Number(d)}/${Number(m)}/${y}` : iso;
}

/** Las filas de la ficha de cabecera, comunes al PDF y al Word. */
function headerRows(s: WorkSession, t: T): [string, string][] {
  const horas = [s.timeStart, s.timeEnd].filter(Boolean).join(' – ');
  const rows: [string, string | undefined][] = [
    [t('Fecha'), formatDay(s.date)],
    [t('Horario'), horas || undefined],
    [s.kind === 'meeting' ? t('Convoca') : t('Entidad y ponente'), s.organizer],
    [t('Lugar'), s.place],
    [t('Asistentes'), s.attendees],
    [t('Horas certificadas'), s.hours ? String(s.hours) : undefined],
  ];
  return rows.filter((r): r is [string, string] => !!r[1] && r[1].trim() !== '');
}

/* ── PDF (HTML independiente, impreso por Electron) ── */

const esc = (x: string) => (x ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
const nl2br = (x: string) => esc(x).replace(/\n/g, '<br>');

export function buildWorkSessionHtml(s: WorkSession, lang: Lang): string {
  const t: T = (k, vars) => translate(lang, k, vars);
  const doc = s.document;
  const tipo = s.kind === 'meeting' ? t('Acta de reunión') : t('Memoria de formación');
  const titulo = doc?.titulo || s.title;

  const ficha = headerRows(s, t)
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${nl2br(v)}</td></tr>`)
    .join('');

  const seccion = (title: string, body: string) =>
    body ? `<h2>${esc(title)}</h2>${body}` : '';

  const lista = (items: string[]) =>
    items.length ? `<ul>${items.map(i => `<li>${nl2br(i)}</li>`).join('')}</ul>` : '';

  const cuerpo = doc
    ? seccion(t('Resumen'), doc.resumen ? `<p>${nl2br(doc.resumen)}</p>` : '') +
      seccion(
        s.kind === 'meeting' ? t('Puntos tratados') : t('Contenidos trabajados'),
        doc.apartados.map(a => `<h3>${esc(a.titulo)}</h3><p>${nl2br(a.contenido)}</p>`).join(''),
      ) +
      seccion(s.kind === 'meeting' ? t('Acuerdos') : t('Ideas clave'), lista(doc.acuerdos)) +
      seccion(
        t('Tareas pendientes'),
        doc.tareas.length
          ? `<table class="tasks"><thead><tr><th>${esc(t('Tarea'))}</th><th>${esc(t('Responsable'))}</th><th>${esc(t('Plazo'))}</th></tr></thead><tbody>` +
            doc.tareas.map(x => `<tr><td>${nl2br(x.tarea)}</td><td>${nl2br(x.responsable || '—')}</td><td>${nl2br(x.plazo || '—')}</td></tr>`).join('') +
            '</tbody></table>'
          : '',
      ) +
      seccion(t('Aplicación en el aula'), lista(doc.aplicacionAula)) +
      seccion(s.kind === 'meeting' ? t('Cierre') : t('Valoración'), doc.cierre ? `<p>${nl2br(doc.cierre)}</p>` : '')
    // Sin documento generado se imprimen las anotaciones tal cual: sigue
    // siendo útil llevarse el papel a una reunión aunque no haya pasado por
    // la IA.
    : seccion(t('Anotaciones'), `<p>${nl2br(s.notes)}</p>`);

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
    `<title>${esc(titulo)}</title><style>${DOC_STYLE}</style></head>` +
    `<body><article class="ws-doc">` +
    `<p class="ws-kind">${esc(tipo.toUpperCase())}</p>` +
    `<h1>${esc(titulo)}</h1>` +
    (ficha ? `<table class="ws-head"><tbody>${ficha}</tbody></table>` : '') +
    cuerpo +
    `</article></body></html>`;
}

const DOC_STYLE = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
.ws-doc { max-width: 170mm; margin: 0 auto; padding: 4mm 2mm; background: #fff; color: #1e293b;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 12px; line-height: 1.6; }
.ws-kind { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; color: #1f4e79; margin: 0 0 4px; }
.ws-doc h1 { font-size: 19px; font-weight: 700; margin: 0 0 14px; letter-spacing: -0.01em; }
.ws-doc h2 { font-size: 13px; font-weight: 700; color: #1f4e79; margin: 20px 0 6px;
  border-bottom: 1.5px solid #bdd7ee; padding-bottom: 3px; text-transform: uppercase; letter-spacing: 0.04em; }
.ws-doc h3 { font-size: 12.5px; font-weight: 700; margin: 12px 0 2px; }
.ws-doc p { margin: 0 0 8px; }
.ws-doc ul { margin: 0 0 10px; padding-left: 20px; }
.ws-doc li { margin-bottom: 4px; }

.ws-head { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 11.5px; }
.ws-head th, .ws-head td { border: 0.75px solid #8faadc; padding: 5px 9px; text-align: left; vertical-align: top; }
.ws-head th { background: #dce6f1; color: #1e3a5f; font-weight: 700; width: 34mm; }

table.tasks { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-bottom: 10px; }
table.tasks th, table.tasks td { border: 0.75px solid #8faadc; padding: 5px 9px; text-align: left; vertical-align: top; }
table.tasks th { background: #dce6f1; color: #1e3a5f; font-weight: 700; }

h2, h3, tr, li { break-inside: avoid; page-break-inside: avoid; }
@media print { @page { size: A4 portrait; margin: 16mm 18mm; } }
`;

export async function saveWorkSessionPdf(s: WorkSession, lang: Lang) {
  const docs = window.electronAPI?.docs;
  if (!docs) return { error: 'not-desktop' as const };
  // Vertical: es un documento de texto, no una rejilla como la SdA.
  const res = await docs.savePdf(buildWorkSessionHtml(s, lang), fileBase(s) + '.pdf', { landscape: false });
  if (!res.canceled && !res.error && res.path) docs.reveal(res.path);
  return res;
}

/* ── Word (generado en el propio navegador) ── */

const BORDER = { style: BorderStyle.SINGLE, size: 2, color: '8FAADC' };
const TABLE_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, insideHorizontal: BORDER, insideVertical: BORDER };

function cell(text: string, opts: { label?: boolean; width?: number } = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.label ? { fill: 'DCE6F1' } : undefined,
    margins: { top: 80, bottom: 80, left: 110, right: 110 },
    children: [new Paragraph({ children: [new TextRun({ text: text || '—', bold: !!opts.label, size: 20 })] })],
  });
}

function heading(text: string) {
  return new Paragraph({
    spacing: { before: 280, after: 100 },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: '1F4E79' })],
  });
}

const body = (text: string) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, size: 22 })] });
const bullet = (text: string) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text, size: 22 })] });

/** Construye el .docx. Separado del guardado para poder probarlo sin DOM. */
export async function buildWorkSessionDocxBlob(s: WorkSession, lang: Lang): Promise<Blob> {
  const t: T = (k, vars) => translate(lang, k, vars);
  const doc = s.document;
  const tipo = s.kind === 'meeting' ? t('Acta de reunión') : t('Memoria de formación');

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: tipo.toUpperCase(), bold: true, size: 18, color: '1F4E79' })],
    }),
    new Paragraph({ text: doc?.titulo || s.title, heading: HeadingLevel.TITLE, spacing: { after: 200 } }),
  ];

  const ficha = headerRows(s, t);
  if (ficha.length) {
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: ficha.map(([k, v]) => new TableRow({ children: [cell(k, { label: true, width: 30 }), cell(v, { width: 70 })] })),
    }));
  }

  if (!doc) {
    children.push(heading(t('Anotaciones')));
    s.notes.split('\n').forEach(line => children.push(body(line)));
  } else {
    if (doc.resumen) { children.push(heading(t('Resumen')), body(doc.resumen)); }

    if (doc.apartados.length) {
      children.push(heading(s.kind === 'meeting' ? t('Puntos tratados') : t('Contenidos trabajados')));
      doc.apartados.forEach(a => {
        children.push(new Paragraph({ spacing: { before: 140, after: 40 }, children: [new TextRun({ text: a.titulo, bold: true, size: 22 })] }));
        children.push(body(a.contenido));
      });
    }

    if (doc.acuerdos.length) {
      children.push(heading(s.kind === 'meeting' ? t('Acuerdos') : t('Ideas clave')));
      doc.acuerdos.forEach(a => children.push(bullet(a)));
    }

    if (doc.tareas.length) {
      children.push(heading(t('Tareas pendientes')));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_BORDERS,
        rows: [
          new TableRow({ children: [cell(t('Tarea'), { label: true, width: 50 }), cell(t('Responsable'), { label: true, width: 27 }), cell(t('Plazo'), { label: true, width: 23 })] }),
          ...doc.tareas.map(x => new TableRow({ children: [cell(x.tarea), cell(x.responsable), cell(x.plazo)] })),
        ],
      }));
    }

    if (doc.aplicacionAula.length) {
      children.push(heading(t('Aplicación en el aula')));
      doc.aplicacionAula.forEach(a => children.push(bullet(a)));
    }

    if (doc.cierre) {
      children.push(heading(s.kind === 'meeting' ? t('Cierre') : t('Valoración')));
      children.push(body(doc.cierre));
    }
  }

  children.push(new Paragraph({
    spacing: { before: 400 },
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: t('Documento generado con Aula Pro'), size: 16, color: '94A3B8', italics: true })],
  }));

  const document = new Document({
    sections: [{
      children,
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
    }],
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
  });

  return Packer.toBlob(document);
}

export async function saveWorkSessionDocx(s: WorkSession, lang: Lang) {
  const blob = await buildWorkSessionDocxBlob(s, lang);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileBase(s) + '.docx';
  a.click();
  URL.revokeObjectURL(url);
}
