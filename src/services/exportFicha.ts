/**
 * Exporta una ficha de trabajo a PDF o a Word — pensada para imprimir y
 * repartir en clase, así que sale en VERTICAL (a diferencia de la SdA o las
 * actas, que van horizontales) y sin las soluciones: el campo `solucion` de
 * cada ejercicio es solo para el profesorado y nunca se incluye aquí.
 *
 * Los ejercicios se agrupan en bloques de actividad con su propio color de
 * cabecera (rotando entre una paleta fija), con iconos reales —los mismos
 * trazados de Lucide que usa el resto de la app, ver `fichaIcons.ts`— y un
 * motivo decorativo junto al título, elegido por palabras clave del tema y
 * el área (ver `fichaMotifs.ts`): no hay ilustración de IA porque los
 * modelos de imagen de Gemini no están en el nivel gratuito de la API.
 *
 * Mismo patrón que `exportSda.ts`: el PDF es un documento HTML impreso por
 * Electron (`docs.savePdf`, con `landscape: false`); el Word lo genera la
 * librería `docx` en el propio navegador, sin pasar por Electron.
 */

import {
  Document, Packer, Paragraph, TextRun,
  Table, TableRow, TableCell, WidthType, BorderStyle,
} from 'docx';
import type { Ficha } from '../types';
import type { FichaExercise, FichaExerciseType, FichaActivity } from './resources';
import { translate, type Lang } from '../i18n';
import { svgLightbulb, svgPencil } from './fichaIcons';
import { pickMotifKey, MOTIF_COLORS, MOTIF_ICON } from './fichaMotifs';

function fileBase(f: Ficha): string {
  const slug = (s: string) => s.trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  return `ficha-${slug(f.title || 'de-trabajo')}`;
}

/**
 * Fichas guardadas antes de que existieran los bloques de actividad tenían
 * `ejercicios` plano, sin `actividades`. Se envuelve en un único bloque
 * implícito (sin título propio) para no perder ese contenido.
 */
function getActividades(content: Ficha['content']): FichaActivity[] {
  if (content.actividades?.length) return content.actividades;
  const legacy = (content as unknown as { ejercicios?: FichaExercise[] }).ejercicios;
  return legacy?.length ? [{ titulo: '', ejercicios: legacy }] : [];
}

/** Cuánto espacio en blanco necesita cada tipo "clásico" para responder a mano. */
type EspacioTipo = 'box' | 'lines' | 'line' | 'none';
function espacioTipo(tipo: FichaExerciseType): EspacioTipo {
  if (tipo === 'problema') return 'box';
  if (tipo === 'abierta') return 'lines';
  if (tipo === 'completar') return 'line';
  return 'none'; // opcion_multiple: el hueco es elegir una opción, no escribir
}

/** Colores de cabecera de actividad, en rotación. */
const ACTIVITY_COLORS = [
  { bg: '0369A1', light: 'E0F2FE' }, // azul
  { bg: '15803D', light: 'DCFCE7' }, // verde
  { bg: 'B45309', light: 'FEF3C7' }, // ámbar
  { bg: '6D28D9', light: 'EDE9FE' }, // violeta
];

/** Nombre de color en texto libre (ES/EN) -> hex sin "#", para "colorear". */
const COLOR_MAP: Record<string, string> = {
  rojo: 'EF4444', red: 'EF4444',
  azul: '3B82F6', blue: '3B82F6',
  verde: '22C55E', green: '22C55E',
  amarillo: 'EAB308', yellow: 'EAB308',
  naranja: 'F97316', orange: 'F97316',
  morado: 'A855F7', violeta: 'A855F7', purpura: 'A855F7', purple: 'A855F7',
  rosa: 'EC4899', pink: 'EC4899',
  marron: '92400E', brown: '92400E',
  negro: '1E293B', black: '1E293B',
  gris: '64748B', gray: '64748B', grey: '64748B',
  turquesa: '14B8A6', celeste: '38BDF8', cian: '06B6D4', cyan: '06B6D4',
  blanco: 'CBD5E1', white: 'CBD5E1',
};
function colorHex(name: string): string {
  const key = name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return COLOR_MAP[key] ?? '94A3B8';
}

/* ── PDF (HTML independiente, impreso por Electron en vertical) ── */

const esc = (s: string) => (s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
const nl2br = (s: string) => esc(s).replace(/\n/g, '<br>');

function exerciseBodyHtml(ex: FichaExercise, color: { bg: string; light: string }): string {
  const letra = (i: number) => String.fromCharCode(97 + i);
  let body = `<div class="ficha-enunciado">${esc(ex.enunciado)}</div>`;

  if (ex.tipo === 'opcion_multiple' && ex.opciones?.length) {
    body += `<ol class="ficha-opciones">${ex.opciones.map((o, j) => `<li><span class="op-letra">${letra(j)})</span> ${esc(o)}</li>`).join('')}</ol>`;
  } else if (ex.tipo === 'tabla_rellenar' && ex.columnas?.length && ex.filas?.length) {
    body += `<table class="ficha-tabla">` +
      `<thead><tr>${ex.columnas.map(col => `<th style="background:#${color.light};color:#${color.bg}">${esc(col)}</th>`).join('')}</tr></thead>` +
      `<tbody>${ex.filas.map(fila => `<tr>${fila.map(celda => celda ? `<td>${esc(celda)}</td>` : `<td class="blank"></td>`).join('')}</tr>`).join('')}</tbody>` +
      `</table>`;
  } else if (ex.tipo === 'relacionar' && ex.izquierda?.length && ex.derecha?.length) {
    body += `<div class="ficha-relacionar">` +
      `<div class="col">${ex.izquierda.map((it, i) => `<div class="item">${i + 1}. ${esc(it)}</div>`).join('')}</div>` +
      `<div class="col">${ex.derecha.map((it, j) => `<div class="item">${letra(j).toUpperCase()}. ${esc(it)}</div>`).join('')}</div>` +
      `</div>`;
  } else if (ex.tipo === 'colorear') {
    if (ex.leyenda?.length) {
      body += `<div class="ficha-leyenda">${ex.leyenda.map(l => `<span class="chip"><span class="dot" style="background:#${colorHex(l.color)}"></span>${esc(l.color)}: ${esc(l.criterio)}</span>`).join('')}</div>`;
    }
    if (ex.itemsColorear?.length) {
      body += `<div class="ficha-colorear-items">${ex.itemsColorear.map(it => `<span class="item-box">${esc(it)}</span>`).join('')}</div>`;
    }
  } else {
    const espacio = espacioTipo(ex.tipo);
    body += espacio === 'box' ? '<div class="ficha-espacio box"></div>'
      : espacio === 'lines' ? '<div class="ficha-espacio lines"><div class="ln"></div><div class="ln"></div><div class="ln"></div></div>'
      : espacio === 'line' ? '<div class="ficha-espacio line"></div>'
      : '';
  }
  return body;
}

export function buildFichaHtml(f: Ficha, lang: Lang): string {
  const t = (k: string, vars?: Record<string, string | number>) => translate(lang, k, vars);
  const c = f.content;
  const actividades = getActividades(c);

  const actividadesHtml = actividades.map((act, actIdx) => {
    const color = ACTIVITY_COLORS[actIdx % ACTIVITY_COLORS.length];
    const header = act.titulo
      ? `<div class="act-header" style="background:#${color.bg}">${svgPencil('#fff', 14)}${t('Actividad {n}', { n: actIdx + 1 })}: ${esc(act.titulo)}</div>`
      : '';
    const ejerciciosHtml = act.ejercicios.map(ex => `<li>${exerciseBodyHtml(ex, color)}</li>`).join('');
    return `<section class="ficha-actividad">${header}<ol class="ficha-ejercicios" style="border-color:#${color.bg}">${ejerciciosHtml}</ol></section>`;
  }).join('');

  const datos = `${t('Nombre')}: ______________________________&nbsp;&nbsp;&nbsp; ${t('Fecha')}: ____________&nbsp;&nbsp;&nbsp; ${t('Clase')}: __________`;

  const explicacionHtml = c.explicacion
    ? `<div class="ficha-explicacion"><div class="lbl">${svgLightbulb('#0369a1', 15)}${esc(t('Antes de empezar'))}</div><div class="txt">${nl2br(c.explicacion)}</div></div>`
    : '';

  const motifKey = pickMotifKey(f.request.tema, f.request.area);
  const motif = MOTIF_COLORS[motifKey];
  const motivoHtml = `<div class="ficha-motivo" style="background:#${motif.bg}">${MOTIF_ICON[motifKey]('#' + motif.accent, 34)}</div>`;

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
    `<title>${esc(c.titulo || f.title)}</title>` +
    `<style>${FICHA_DOC_STANDALONE}${FICHA_DOC_STYLE}</style>` +
    `</head><body><article class="ficha-doc">` +
    `<div class="ficha-header"><h1>${esc(c.titulo || f.title)}</h1>${motivoHtml}</div>` +
    `<div class="ficha-datos">${datos}</div>` +
    explicacionHtml +
    (c.instrucciones ? `<p class="ficha-instr">${esc(c.instrucciones)}</p>` : '') +
    actividadesHtml +
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
.ficha-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 2px; }
.ficha-header h1 { font-size: 18px; font-weight: 800; margin: 0; letter-spacing: -0.01em; }
.ficha-motivo { width: 76px; height: 76px; border-radius: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.ficha-datos { font-size: 12.5px; color: #334155; margin: 10px 0 14px; padding-bottom: 10px; border-bottom: 1px solid #cbd5e1; }

.ficha-explicacion { background: linear-gradient(135deg, #eff6ff, #f0f9ff); border: 1.25px solid #7dd3fc; border-left: 5px solid #0ea5e9; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; }
.ficha-explicacion .lbl { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #0369a1; margin-bottom: 6px; }
.ficha-explicacion .txt { font-size: 13px; line-height: 1.6; color: #0c4a6e; }

.ficha-instr { font-size: 12.5px; color: #475569; line-height: 1.6; margin: 0 0 18px; font-style: italic; }

.ficha-actividad { margin-bottom: 20px; break-inside: avoid; page-break-inside: avoid; }
.ficha-actividad .act-header { display: flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: 8px 8px 0 0; color: #fff; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; }
.ficha-actividad .act-header svg { flex-shrink: 0; }

.ficha-ejercicios { list-style: none; counter-reset: ej; margin: 0; padding: 14px 16px 4px; border: 1.5px solid; border-top: none; border-radius: 0 0 8px 8px; }
.ficha-actividad:has(.act-header) .ficha-ejercicios { border-radius: 0 0 8px 8px; }
.ficha-actividad:not(:has(.act-header)) .ficha-ejercicios { border-radius: 8px; border-top: 1.5px solid; }
.ficha-ejercicios > li { counter-increment: ej; margin-bottom: 18px; break-inside: avoid; page-break-inside: avoid; }
.ficha-ejercicios > li:last-child { margin-bottom: 4px; }
.ficha-ejercicios > li::before { content: counter(ej) '. '; font-weight: 800; color: #0369a1; }
.ficha-enunciado { display: inline; font-size: 13px; line-height: 1.6; }

.ficha-opciones { list-style: none; margin: 8px 0 0; padding: 0 0 0 18px; }
.ficha-opciones li { font-size: 12.5px; line-height: 1.9; }
.op-letra { font-weight: 700; color: #64748b; margin-right: 4px; }

.ficha-espacio.box { min-height: 90px; border: 0.75px solid #cbd5e1; border-radius: 6px; margin-top: 8px; }
.ficha-espacio.lines { margin-top: 10px; }
.ficha-espacio.lines .ln { border-bottom: 0.75px solid #94a3b8; height: 24px; }
.ficha-espacio.line { border-bottom: 0.75px solid #94a3b8; height: 24px; margin-top: 8px; max-width: 55%; }

.ficha-tabla { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
.ficha-tabla th, .ficha-tabla td { border: 0.75px solid #cbd5e1; padding: 7px 10px; text-align: center; }
.ficha-tabla th { font-weight: 800; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.02em; }
.ficha-tabla td.blank { background: repeating-linear-gradient(135deg, #f8fafc, #f8fafc 6px, #f1f5f9 6px, #f1f5f9 7px); height: 26px; }

.ficha-relacionar { display: flex; justify-content: space-between; gap: 24px; margin-top: 10px; }
.ficha-relacionar .col { flex: 1; display: flex; flex-direction: column; gap: 16px; }
.ficha-relacionar .item { font-size: 12.5px; padding: 7px 10px; border: 0.75px solid #cbd5e1; border-radius: 6px; background: #f8fafc; }

.ficha-leyenda { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 10px; }
.ficha-leyenda .chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; padding: 4px 10px; border-radius: 99px; background: #f1f5f9; border: 0.75px solid #e2e8f0; }
.ficha-leyenda .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.ficha-colorear-items { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
.ficha-colorear-items .item-box { display: inline-flex; align-items: center; justify-content: center; min-width: 52px; padding: 10px 14px; border: 1.25px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 700; background: #fff; }

@media print { @page { size: A4 portrait; margin: 14mm 16mm; } }
`;

const FICHA_DOC_STANDALONE = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
`;

/* ── Word (generado en el propio navegador, sin pasar por Electron) ── */

const CELL_BORDER = { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' };
const CELL_BORDERS = { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER, insideHorizontal: CELL_BORDER, insideVertical: CELL_BORDER };

function pushExerciseDocx(children: (Paragraph | Table)[], ex: FichaExercise, i: number) {
  const letra = (n: number) => String.fromCharCode(97 + n);

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
    return;
  }

  if (ex.tipo === 'tabla_rellenar' && ex.columnas?.length && ex.filas?.length) {
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: CELL_BORDERS,
      rows: [
        new TableRow({
          children: ex.columnas.map(col => new TableCell({
            shading: { fill: 'E0F2FE' },
            children: [new Paragraph({ children: [new TextRun({ text: col, bold: true, color: '0369A1', size: 18 })] })],
          })),
        }),
        ...ex.filas.map(fila => new TableRow({
          children: fila.map(celda => new TableCell({
            shading: celda ? undefined : { fill: 'F8FAFC' },
            children: [new Paragraph({ text: celda || ' ' })],
          })),
        })),
      ],
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
    return;
  }

  if (ex.tipo === 'relacionar' && ex.izquierda?.length && ex.derecha?.length) {
    const izquierda = ex.izquierda;
    const derecha = ex.derecha;
    const n = Math.max(izquierda.length, derecha.length);
    const rows = Array.from({ length: n }, (_, r) => new TableRow({
      children: [
        new TableCell({ margins: { top: 100, bottom: 100, left: 120, right: 120 }, children: [new Paragraph({ text: izquierda[r] ? `${r + 1}. ${izquierda[r]}` : '' })] }),
        new TableCell({ margins: { top: 100, bottom: 100, left: 120, right: 120 }, children: [new Paragraph({ text: derecha[r] ? `${letra(r).toUpperCase()}. ${derecha[r]}` : '' })] }),
      ],
    }));
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: CELL_BORDERS, rows }));
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
    return;
  }

  if (ex.tipo === 'colorear') {
    if (ex.leyenda?.length) {
      children.push(new Paragraph({
        children: ex.leyenda.flatMap((l, li) => [
          new TextRun({ text: (li > 0 ? '     ' : '') + '● ', color: colorHex(l.color) }),
          new TextRun({ text: `${l.color}: ${l.criterio}`, size: 18, color: '475569' }),
        ]),
        spacing: { after: 100 },
      }));
    }
    if (ex.itemsColorear?.length) {
      children.push(new Paragraph({
        children: ex.itemsColorear.map((it, ii) => new TextRun({ text: (ii > 0 ? '     ' : '') + `[ ${it} ]`, bold: true })),
        spacing: { after: 200 },
      }));
    }
    return;
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
}

/** Construye el .docx. Separado de `saveFichaDocx` para poder probarlo sin DOM. */
export async function buildFichaDocxBlob(f: Ficha, lang: Lang): Promise<Blob> {
  const t = (k: string, vars?: Record<string, string | number>) => translate(lang, k, vars);
  const c = f.content;
  const actividades = getActividades(c);

  // Sin imagen de IA (los modelos de imagen de Gemini no están en el nivel
  // gratuito), el título lleva el mismo color de motivo que usaría la
  // ilustración, a modo de cabecera con identidad — igual que las
  // cabeceras de actividad más abajo, sin necesitar rasterizar nada.
  const motif = MOTIF_COLORS[pickMotifKey(f.request.tema, f.request.area)];
  const children: (Paragraph | Table)[] = [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: CELL_BORDERS,
      rows: [new TableRow({
        children: [new TableCell({
          shading: { fill: motif.bg },
          margins: { top: 160, bottom: 160, left: 180, right: 180 },
          children: [new Paragraph({
            children: [new TextRun({ text: c.titulo || f.title, bold: true, color: motif.accent, size: 32 })],
          })],
        })],
      })],
    }),
    new Paragraph({ text: '', spacing: { after: 160 } }),
  ];

  children.push(new Paragraph({
    children: [new TextRun({
      text: `${t('Nombre')}: ______________________________     ${t('Fecha')}: ____________     ${t('Clase')}: __________`,
      size: 20,
    })],
    spacing: { after: 200 },
    border: { bottom: { style: 'single', size: 4, color: 'CBD5E1', space: 8 } },
  }));

  if (c.explicacion) {
    const EXPL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '7DD3FC' };
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: EXPL_BORDER, bottom: EXPL_BORDER, left: EXPL_BORDER, right: EXPL_BORDER, insideHorizontal: EXPL_BORDER, insideVertical: EXPL_BORDER },
      rows: [new TableRow({
        children: [new TableCell({
          shading: { fill: 'EFF6FF' },
          margins: { top: 140, bottom: 140, left: 160, right: 160 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: t('Antes de empezar'), bold: true, color: '0369A1', size: 18 })],
              spacing: { after: 60 },
            }),
            new Paragraph({ children: [new TextRun({ text: c.explicacion, color: '0C4A6E' })] }),
          ],
        })],
      })],
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 160 } }));
  }

  if (c.instrucciones) {
    children.push(new Paragraph({
      children: [new TextRun({ text: c.instrucciones, italics: true, color: '475569' })],
      spacing: { after: 240 },
    }));
  }

  actividades.forEach((act, actIdx) => {
    const color = ACTIVITY_COLORS[actIdx % ACTIVITY_COLORS.length];
    if (act.titulo) {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: CELL_BORDERS,
        rows: [new TableRow({
          children: [new TableCell({
            shading: { fill: color.bg },
            margins: { top: 90, bottom: 90, left: 140, right: 140 },
            children: [new Paragraph({
              children: [new TextRun({ text: `${t('Actividad {n}', { n: actIdx + 1 })}: ${act.titulo}`, bold: true, color: 'FFFFFF', size: 20 })],
            })],
          })],
        })],
      }));
      children.push(new Paragraph({ text: '', spacing: { after: 100 } }));
    }
    act.ejercicios.forEach((ex, i) => pushExerciseDocx(children, ex, i));
    children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
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
