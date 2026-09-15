/**
 * Exporta la distribución de aula a PDF (el plano visual, para pegar en la
 * pared o llevar impreso) o a Word (un listado por mesas, para archivar).
 *
 * Mismo patrón que `exportSda.ts`/`exportWorkSession.ts`: el PDF es HTML que
 * imprime Electron, el Word lo genera `docx` en el propio navegador. El plano
 * va en HORIZONTAL —como las actas—: son varias mesas en fila, no texto
 * corrido.
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType,
} from 'docx';
import type { Class, Student, SeatingPlan } from '../types';
import { seatStudentId } from '../types';
import { translate, type Lang } from '../i18n';
import { buildTableSvg } from '../lib/seatingLayout';
import { PALETTE } from '../lib/demoData';

type T = (k: string, vars?: Record<string, string | number>) => string;

function fileBase(cls: Class): string {
  const slug = (x: string) => x.trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  return `distribucion-aula-${slug(cls.name || 'clase')}`;
}

/** El rol de quien ocupa el asiento `i` en la semana actual (ver types/index.ts). */
export function roleForSeat(plan: SeatingPlan, seatIndex: number) {
  return plan.roles[(seatIndex + plan.weekOffset) % plan.groupSize] ?? null;
}

/**
 * «Rotada 1 vez» / «Rotada 3 veces»: la clave entera cambia según el número,
 * no un «vez/veces» a pelo — el diccionario traduce por texto en castellano
 * (ver `aulapro-i18n-2026-08` en memoria), así que un plural chapucero saldría
 * igual de chapucero en inglés.
 */
export function vecesLabel(n: number, t: T): string {
  if (n === 0) return t('Roles como se formaron los grupos');
  return n === 1 ? t('Rotada 1 vez') : t('Rotada {n} veces', { n });
}

function nombrePorId(students: Student[]): (id: string) => string | null {
  const mapa = new Map(students.map(s => [s.id, s.name]));
  return id => mapa.get(id) ?? null;
}

const esc = (x: string) => (x ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

/* ── PDF: el plano visual ── */

export function buildSeatingHtml(cls: Class, plan: SeatingPlan, students: Student[], lang: Lang): string {
  const t: T = (k, vars) => translate(lang, k, vars);
  const nombre = nombrePorId(students);

  const mesas = plan.groups.map((g, gi) => {
    const seats = Array.from({ length: plan.groupSize }, (_, i) => {
      const sid = seatStudentId(g, i);
      const n = sid ? nombre(sid) : null;
      const rol = n ? roleForSeat(plan, i)?.name ?? null : null;
      return { studentName: n, roleName: rol };
    });
    const color = PALETTE[gi % PALETTE.length];
    return `<div class="mesa">${buildTableSvg(seats, color, g.label)}</div>`;
  }).join('');

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
    `<title>${esc(t('Distribución de aula'))} — ${esc(cls.name)}</title><style>${STYLE}</style></head>` +
    `<body><header>` +
    `<h1>${esc(t('Distribución de aula'))}</h1>` +
    `<p>${esc(cls.name)}${cls.room ? ` · ${esc(t('Aula {room}', { room: cls.room }))}` : ''} · ` +
    `${esc(vecesLabel(plan.weekOffset, t))}</p>` +
    `</header><div class="mesas">${mesas}</div>` +
    `<footer>${plan.roles.map(r => `<span><strong>${esc(r.name)}:</strong> ${esc(r.description)}</span>`).join('')}</footer>` +
    `</body></html>`;
}

const STYLE = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 10mm 12mm; }
header { margin-bottom: 10mm; }
header h1 { font-size: 20px; font-weight: 800; margin: 0 0 4px; }
header p { font-size: 12px; color: #475569; margin: 0; }
.mesas { display: flex; flex-wrap: wrap; gap: 14mm 10mm; justify-content: center; align-items: flex-start; }
.mesa { width: 55mm; }
footer { margin-top: 12mm; padding-top: 6mm; border-top: 0.75px solid #cbd5e1; display: flex; flex-wrap: wrap; gap: 4mm 10mm; font-size: 10.5px; color: #334155; }
@media print { @page { size: A4 landscape; margin: 10mm 12mm; } }
`;

export async function saveSeatingPdf(cls: Class, plan: SeatingPlan, students: Student[], lang: Lang) {
  const docs = window.electronAPI?.docs;
  if (!docs) return { error: 'not-desktop' as const };
  const res = await docs.savePdf(buildSeatingHtml(cls, plan, students, lang), fileBase(cls) + '.pdf', { landscape: true });
  if (!res.canceled && !res.error && res.path) docs.reveal(res.path);
  return res;
}

/* ── Word: el listado por mesas ── */

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

export async function buildSeatingDocxBlob(cls: Class, plan: SeatingPlan, students: Student[], lang: Lang): Promise<Blob> {
  const t: T = (k, vars) => translate(lang, k, vars);
  const nombre = nombrePorId(students);

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: t('Distribución de aula').toUpperCase(), bold: true, size: 18, color: '1F4E79' })],
    }),
    new Paragraph({ text: cls.name, heading: HeadingLevel.TITLE, spacing: { after: 100 } }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({
        text: vecesLabel(plan.weekOffset, t),
        size: 20, color: '475569',
      })],
    }),
  ];

  for (const g of plan.groups) {
    children.push(heading(g.label));
    const filas = Array.from({ length: plan.groupSize }, (_, i) => {
      const sid = seatStudentId(g, i);
      const n = sid ? nombre(sid) : null;
      const rol = n ? roleForSeat(plan, i)?.name ?? '' : '';
      return { n: n ?? t('(asiento libre)'), rol };
    });
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS,
      rows: [
        new TableRow({ children: [cell(t('Alumno/a'), { label: true, width: 60 }), cell(t('Rol esta semana'), { label: true, width: 40 })] }),
        ...filas.map(f => new TableRow({ children: [cell(f.n), cell(f.rol)] })),
      ],
    }));
  }

  children.push(heading(t('Roles cooperativos')));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({ children: [cell(t('Rol'), { label: true, width: 30 }), cell(t('Responsabilidad'), { label: true, width: 70 })] }),
      ...plan.roles.map(r => new TableRow({ children: [cell(r.name), cell(r.description)] })),
    ],
  }));

  children.push(new Paragraph({
    spacing: { before: 400 },
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: t('Documento generado con Aula Pro'), size: 16, color: '94A3B8', italics: true })],
  }));

  const document = new Document({
    sections: [{ children, properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } } }],
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
  });

  return Packer.toBlob(document);
}

export async function saveSeatingDocx(cls: Class, plan: SeatingPlan, students: Student[], lang: Lang) {
  const blob = await buildSeatingDocxBlob(cls, plan, students, lang);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileBase(cls) + '.docx';
  a.click();
  URL.revokeObjectURL(url);
}
