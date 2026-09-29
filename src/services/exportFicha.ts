/**
 * Exporta una ficha de trabajo a PDF o a Word — pensada para imprimir y
 * repartir en clase, así que sale en VERTICAL (a diferencia de la SdA o las
 * actas, que van horizontales) y sin las soluciones: el campo `solucion` de
 * cada ejercicio es solo para el profesorado y nunca se incluye aquí.
 *
 * El aspecto sale del tema de la ficha (`lib/fichaThemes.ts`): con historia,
 * cabecera con personaje, tarjeta de misión, bloques con emoji y cierre con
 * insignia; en «Clásica», el de siempre. Los bloques de actividad llevan su
 * color de cabecera (rotando entre los del tema), con iconos reales —los mismos
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
  Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, ImageRun,
} from 'docx';
import type { Ficha } from '../types';
import type { FichaExercise, FichaExerciseType, FichaActivity, FichaCandado, FichaTarjeta, FichaVariante } from './resources';
import { crosswordCells, type Crossword } from '../lib/crossword';
import { fichaTheme } from '../lib/fichaThemes';
import { translate, type Lang } from '../i18n';
import { svgLightbulb, svgPencil } from './fichaIcons';
import { pickMotifKey, MOTIF_COLORS, MOTIF_ICON } from './fichaMotifs';
import { buildFigureSvg, FIGURE_W, FIGURE_H } from '../lib/geometryFigures';
import { downloadFile } from '../lib/download';

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

const esc = (s: string) => (s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const nl2br = (s: string) => esc(s).replace(/\n/g, '<br>');

type Tr = (k: string, vars?: Record<string, string | number>) => string;

function exerciseBodyHtml(ex: FichaExercise, color: { bg: string; light: string }, t: Tr): string {
  const letra = (i: number) => String.fromCharCode(97 + i);
  let body = `<div class="ficha-enunciado">${esc(ex.enunciado)}</div>`;

  // Independiente del tipo: cualquier ejercicio puede llevar un diagrama, aunque en la práctica solo lo pidan los "problema".
  if (ex.figura) {
    body += `<div class="ficha-figura">${buildFigureSvg(ex.figura.forma, ex.figura.medidas, '#' + color.bg)}</div>`;
  }

  if (ex.tipo === 'opcion_multiple' && ex.opciones?.length) {
    body += `<ol class="ficha-opciones">${ex.opciones.map((o, j) => `<li><span class="op-letra">${letra(j)})</span> ${esc(o)}</li>`).join('')}</ol>`;
  } else if (ex.tipo === 'tabla_rellenar' && ex.columnas?.length && ex.filas?.length) {
    body += `<table class="ficha-tabla">` +
      `<thead><tr>${ex.columnas.map(col => `<th style="background:#${color.light};color:#${color.bg}">${esc(col)}</th>`).join('')}</tr></thead>` +
      `<tbody>${ex.filas.map(fila => `<tr>${fila.map(celda => celda ? `<td>${esc(celda)}</td>` : `<td class="blank"></td>`).join('')}</tr>`).join('')}</tbody>` +
      `</table>`;
  } else if (ex.tipo === 'relacionar' && ex.izquierda?.length && ex.derecha?.length) {
    body += `<div class="ficha-relacionar">` +
      `<div class="col">${ex.izquierda.map((it, i) => `<div class="item">${i + 1}. ${esc(it)}<span class="dot-r"></span></div>`).join('')}</div>` +
      `<div class="col">${ex.derecha.map((it, j) => `<div class="item"><span class="dot-l"></span>${letra(j).toUpperCase()}. ${esc(it)}</div>`).join('')}</div>` +
      `</div>`;
  } else if (ex.tipo === 'colorear') {
    if (ex.leyenda?.length) {
      body += `<div class="ficha-leyenda">${ex.leyenda.map(l => `<span class="chip"><span class="dot" style="background:#${colorHex(l.color)}"></span>${esc(l.color)}: ${esc(l.criterio)}</span>`).join('')}</div>`;
    }
    if (ex.itemsColorear?.length) {
      body += `<div class="ficha-colorear-items">${ex.itemsColorear.map(it => `<span class="item-box">${esc(it)}</span>`).join('')}</div>`;
    }
  } else if (ex.tipo === 'sopa_letras' && ex.rejilla?.length) {
    // Solo la rejilla en blanco: la solución (`posiciones`) es para el profesorado y no se exporta.
    const cols = ex.rejilla[0].length;
    body += `<div class="ficha-sopa" style="grid-template-columns:repeat(${cols},1fr)">` +
      ex.rejilla.flat().map(letra => `<span>${esc(letra)}</span>`).join('') +
      `</div>`;
    if (ex.palabras?.length) {
      body += `<div class="ficha-colorear-items">${ex.palabras.map(p => `<span class="item-box">${esc(p)}</span>`).join('')}</div>`;
    }
  } else if (ex.tipo === 'verdadero_falso' && ex.afirmaciones?.length) {
    body += `<div class="ficha-vf">${ex.afirmaciones.map(a =>
      `<div class="vf-row"><span class="vf-txt">${esc(a)}</span><span class="vf-box">${esc(t('V'))}</span><span class="vf-box">${esc(t('F'))}</span></div>`).join('')}</div>`;
  } else if (ex.tipo === 'ordenar' && ex.elementos?.length) {
    body += `<div class="ficha-ordenar">${ex.elementos.map(e => `<div class="ord-item"><span class="ord-num"></span>${esc(e)}</div>`).join('')}</div>`;
  } else if (ex.tipo === 'crucigrama' && ex.crucigrama?.entradas.length) {
    body += crosswordHtml(ex.crucigrama, t);
  } else if (ex.tipo === 'comic' && ex.vinetas?.length) {
    body += `<div class="ficha-comic" style="grid-template-columns:repeat(${Math.min(ex.vinetas.length, 4)},1fr)">${ex.vinetas.map((v, i) =>
      `<div class="panel"><span class="panel-n">${i + 1}</span>` +
      `<div class="bubble${v.texto ? '' : ' empty'}">${v.texto ? esc(v.texto) : '<div class="ln"></div><div class="ln"></div><div class="ln"></div>'}</div>` +
      `<div class="who">${esc(v.personaje)}</div></div>`).join('')}</div>`;
  } else {
    const espacio = espacioTipo(ex.tipo);
    body += espacio === 'box' ? '<div class="ficha-espacio box"></div>'
      : espacio === 'lines' ? '<div class="ficha-espacio lines"><div class="ln"></div><div class="ln"></div><div class="ln"></div></div>'
      : espacio === 'line' ? '<div class="ficha-espacio line"></div>'
      : '';
  }
  return body;
}

function crosswordHtml(cw: Crossword, t: Tr): string {
  const grid = crosswordCells(cw);
  const cells = grid.flat().map(c => c
    ? `<span class="cw-cell">${c.numero ? `<sup>${c.numero}</sup>` : ''}</span>`
    : '<span class="cw-void"></span>').join('');
  const clues = (dir: 'H' | 'V', label: string) => {
    const list = cw.entradas.filter(e => e.dir === dir);
    return list.length
      ? `<div class="cw-col"><div class="cw-lbl">${esc(label)}</div>${list.map(e => `<div class="cw-clue"><b>${e.numero}.</b> ${esc(e.pista)} <span class="cw-len">(${e.palabra.length})</span></div>`).join('')}</div>`
      : '';
  };
  const size = cw.columnas > 14 ? 5.2 : 6.4;
  return `<div class="ficha-cruci"><div class="cw-grid" style="grid-template-columns:repeat(${cw.columnas},${size}mm);grid-auto-rows:${size}mm">${cells}</div>` +
    `<div class="cw-clues">${clues('H', t('Horizontales'))}${clues('V', t('Verticales'))}</div></div>`;
}

export interface FichaHtmlOptions {
  /**
   * Vista previa dentro de la app: la hoja A4 con sombra sobre fondo gris, y
   * cada bloque marcado con `data-act`/`data-ex` para poder seleccionarlo
   * haciendo clic.
   */
  preview?: boolean;
  /** Bloque seleccionado en el editor, «actividad-ejercicio» (ej. "0-2") o «actividad» ("1"). */
  selected?: string;
}

/** Posición «al azar» pero fija de cada adorno, para que la vista previa no baile al editar. */
const DECOR_POS = [
  'top:8px;right:118px;font-size:22px;transform:rotate(-12deg)',
  'bottom:6px;right:34px;font-size:18px;transform:rotate(14deg)',
  'top:10px;right:22px;font-size:16px',
  'bottom:8px;right:150px;font-size:14px;transform:rotate(8deg)',
  'top:34px;right:78px;font-size:13px',
];

export function buildFichaHtml(f: Ficha, lang: Lang, opts: FichaHtmlOptions = {}): string {
  const t: Tr = (k, vars) => translate(lang, k, vars);
  const c = f.content;
  const actividades = getActividades(c);
  const theme = fichaTheme(c.estilo);
  const classic = theme.id === 'clasico';
  const historia = classic ? undefined : c.historia;
  const mark = (attr: string) => (opts.preview ? ` ${attr}` : '');
  const formato = c.formato ?? 'ficha';
  const escape = formato === 'escape';

  const actividadesHtml = actividades.map((act, actIdx) => {
    const color = theme.bloques[actIdx % theme.bloques.length];
    const emoji = act.emoji || theme.iconos[actIdx % theme.iconos.length];
    const label = `${t(escape ? 'Sala' : theme.paso)} ${actIdx + 1}`;
    const header = act.titulo
      ? `<div class="act-header" style="background:#${color.bg}">` +
        (classic ? svgPencil('#fff', 14) : `<span class="act-emoji">${esc(emoji)}</span>`) +
        `<span class="act-ttl">${esc(label)}: ${esc(act.titulo)}</span>` +
        (classic ? '' : `<span class="act-check" title="${esc(t('Hecho'))}"></span>`) +
        `</div>`
      : '';
    const narr = !classic && act.narrativa ? `<div class="act-narr" style="background:#${color.light}">${esc(act.narrativa)}</div>` : '';
    const ejerciciosHtml = act.ejercicios.map((ex, i) => {
      const id = `${actIdx}-${i}`;
      return `<li${mark(`data-ex="${id}"`)}${opts.selected === id ? ' class="is-selected"' : ''}>${exerciseBodyHtml(ex, color, t)}</li>`;
    }).join('');
    const sel = opts.selected === String(actIdx) ? ' is-selected' : '';
    const candado = escape && act.candado ? candadoHtml(act.candado, actIdx, actividades.length, color, t) : '';
    return `<section class="ficha-actividad${sel}"${mark(`data-act="${actIdx}"`)}>${header}${narr}` +
      `<ol class="ficha-ejercicios" style="border-color:#${color.bg};--num:#${color.bg}">${ejerciciosHtml}</ol>${candado}</section>`;
  }).join('');

  // La versión adaptada lleva una marca discreta para que el docente las distinga al repartir
  const marca = c.variante ? `<span class="var-mark" title="${esc(t(VARIANTE_LABEL[c.variante]))}">${VARIANTE_MARK[c.variante]}</span>` : '';
  const datos = `${t('Nombre')}: ______________________________&nbsp;&nbsp;&nbsp; ${t('Fecha')}: ____________&nbsp;&nbsp;&nbsp; ${t('Clase')}: __________${marca}`;

  const explicacionHtml = c.explicacion
    ? `<div class="ficha-explicacion"${mark('data-part="explicacion"')}><div class="lbl">${svgLightbulb('#' + theme.color, 15)}${esc(t('Antes de empezar'))}</div><div class="txt">${nl2br(c.explicacion)}</div></div>`
    : '';

  let headerHtml: string;
  if (classic) {
    const motifKey = pickMotifKey(f.request.tema, f.request.area);
    const motif = MOTIF_COLORS[motifKey];
    const motivoHtml = `<div class="ficha-motivo" style="background:#${motif.bg}">${MOTIF_ICON[motifKey]('#' + motif.accent, 34)}</div>`;
    headerHtml = `<div class="ficha-header"${mark('data-part="titulo"')}><h1>${esc(c.titulo || f.title)}</h1>${motivoHtml}</div>`;
  } else {
    const decor = theme.adornos.map((a, i) => `<span class="deco" style="${DECOR_POS[i % DECOR_POS.length]}">${esc(a)}</span>`).join('');
    headerHtml = `<header class="ficha-banner"${mark('data-part="titulo"')}>${decor}` +
      `<span class="banner-char">${esc(historia?.emoji || theme.personaje)}</span>` +
      `<div class="banner-txt"><div class="kicker">${esc(t(theme.nombre))}</div><h1>${esc(c.titulo || f.title)}</h1></div></header>`;
  }

  const misionHtml = historia?.mision
    ? `<div class="ficha-mision"${mark('data-part="historia"')}><div class="av">${esc(historia.emoji)}</div>` +
      `<div class="bubble"><div class="who">${esc(historia.personaje)}</div>${nl2br(historia.mision)}</div></div>`
    : '';

  const cierreHtml = historia
    ? `<section class="ficha-cierre"${mark('data-part="cierre"')}>` +
      `<div class="badge"><div class="badge-ring"><span>${esc(historia.emoji)}</span></div><div class="badge-name">${esc(historia.insignia)}</div></div>` +
      `<div class="cierre-body"><div class="cierre-ttl">${esc(t(escape ? '¡Habéis escapado!' : '¡Misión cumplida!'))}</div>` +
      (historia.cierre ? `<p>${nl2br(historia.cierre)}</p>` : '') +
      `<div class="selfeval"><span class="se-lbl">${esc(t('¿Cómo te ha ido?'))}</span>${['😃', '🙂', '😐', '😟'].map(e => `<span class="se">${e}</span>`).join('')}</div>` +
      `</div></section>`
    : '';

  const vars = `--c:#${theme.color};--cd:#${theme.oscuro};--cl:#${theme.claro};--paper:#${theme.papel};` +
    `--font:${theme.fuente};--font-t:${theme.fuenteTitulo};--r:${theme.radio}px;--bs:${theme.borde}`;

  const body = formato === 'tarjetas'
    ? tarjetasHtml(c.tarjetas ?? [], theme, mark, t)
    : actividadesHtml + cierreHtml;
  const docCls = `ficha-doc th-${theme.id}${c.variante === 'lectura_facil' ? ' lf' : ''}${formato === 'tarjetas' ? ' fmt-tarjetas' : ''}`;

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
    `<title>${esc(c.titulo || f.title)}</title>` +
    `<style>${FICHA_DOC_STANDALONE}${FICHA_DOC_STYLE}${opts.preview ? FICHA_PREVIEW_STYLE : ''}</style>` +
    `</head><body><article class="${docCls}" style='${vars}'>` +
    headerHtml +
    (formato === 'tarjetas' ? '' : `<div class="ficha-datos">${datos}</div>`) +
    misionHtml +
    explicacionHtml +
    (c.instrucciones ? `<p class="ficha-instr"${mark('data-part="instrucciones"')}>${formato === 'tarjetas' ? `<b>${esc(t('Cómo se juega'))}:</b> ` : ''}${esc(c.instrucciones)}</p>` : '') +
    body +
    `</article></body></html>`;
}

export const VARIANTE_LABEL: Record<FichaVariante, string> = {
  apoyo: 'Versión de apoyo',
  ampliacion: 'Versión de ampliación',
  lectura_facil: 'Lectura fácil',
};
const VARIANTE_MARK: Record<FichaVariante, string> = { apoyo: '◆', ampliacion: '▲', lectura_facil: '●' };

/** El candado al final de cada sala: una casilla por carácter del código, que el alumnado rellena. */
function candadoHtml(k: FichaCandado, idx: number, total: number, color: { bg: string; light: string }, t: Tr): string {
  const n = Math.max(3, k.codigo.length);
  const next = idx + 1 < total ? t('Abre la sala {n}', { n: idx + 2 }) : t('Abre el cofre final');
  return `<div class="ficha-candado" style="border-color:#${color.bg};background:#${color.light}">` +
    `<span class="lock">🔒</span>` +
    `<div class="lock-body"><div class="lock-ttl">${esc(t('Candado'))} · ${esc(next)}</div>` +
    (k.pista ? `<div class="lock-hint">${esc(k.pista)}</div>` : '') + `</div>` +
    `<div class="lock-boxes">${Array.from({ length: n }, () => `<span style="border-color:#${color.bg}"></span>`).join('')}</div>` +
    `</div>`;
}

/**
 * Tarjetas para recortar por la línea discontinua y doblar por la de puntos:
 * la pregunta queda delante y la respuesta, impresa del revés, detrás. Así se
 * imprimen a una sola cara.
 */
function tarjetasHtml(cards: FichaTarjeta[], theme: ReturnType<typeof fichaTheme>, mark: (a: string) => string, t: Tr): string {
  return `<div class="tj-grid">${cards.map((tj, i) => {
    const color = theme.bloques[i % theme.bloques.length];
    return `<div class="tj"${mark(`data-card="${i}"`)} style="--tj:#${color.bg};--tjl:#${color.light}">` +
      `<div class="tj-front"><span class="tj-n">${i + 1}</span><span class="tj-emoji">${esc(theme.iconos[i % theme.iconos.length])}</span>` +
      `<div class="tj-q">${esc(tj.pregunta)}</div></div>` +
      `<div class="tj-fold"><span>${esc(t('doblar'))}</span></div>` +
      `<div class="tj-back"><div class="tj-a"><span class="tj-albl">${esc(t('Respuesta'))}</span>${esc(tj.respuesta)}</div></div>` +
      `</div>`;
  }).join('')}</div><p class="tj-cut">✂️ ${esc(t('Recorta por la línea discontinua y dobla cada tarjeta por la mitad.'))}</p>`;
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
.ficha-doc { max-width: 100%; margin: 0 auto; padding: 4mm 6mm; background: #fff; color: #1e293b; font-family: var(--font); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.ficha-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 2px; }
.ficha-header h1 { font-size: 18px; font-weight: 800; margin: 0; letter-spacing: -0.01em; }
.ficha-motivo { width: 76px; height: 76px; border-radius: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.ficha-datos { font-size: 12.5px; color: #334155; margin: 10px 0 14px; padding-bottom: 10px; border-bottom: 1px solid #cbd5e1; }

.ficha-banner { position: relative; overflow: hidden; display: flex; align-items: center; gap: 14px; padding: 14px 18px; border-radius: var(--r); background: linear-gradient(135deg, var(--c), var(--cd)); color: #fff; min-height: 84px; }
.ficha-banner .deco { position: absolute; opacity: .55; line-height: 1; }
.ficha-banner .banner-char { font-size: 46px; line-height: 1; flex-shrink: 0; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(255,255,255,.18); border: 2px solid rgba(255,255,255,.45); }
.ficha-banner .banner-txt { position: relative; min-width: 0; padding-right: 150px; }
.ficha-banner .kicker { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; opacity: .85; margin-bottom: 3px; }
.ficha-banner h1 { font-family: var(--font-t); font-size: 21px; font-weight: 800; margin: 0; line-height: 1.2; }

.ficha-mision { display: flex; gap: 12px; align-items: flex-start; margin: 0 0 14px; }
.ficha-mision .av { font-size: 34px; line-height: 1; flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%; background: var(--cl); display: flex; align-items: center; justify-content: center; }
.ficha-mision .bubble { position: relative; flex: 1; background: var(--paper); border: 1.5px var(--bs) var(--c); border-radius: var(--r); padding: 10px 14px; font-size: 13px; line-height: 1.55; }
.ficha-mision .bubble::before { content: ''; position: absolute; left: -8px; top: 16px; width: 12px; height: 12px; background: var(--paper); border-left: 1.5px var(--bs) var(--c); border-bottom: 1.5px var(--bs) var(--c); transform: rotate(45deg); }
.ficha-mision .who { font-family: var(--font-t); font-weight: 800; color: var(--cd); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 3px; }

.ficha-explicacion { background: var(--cl); border: 1.25px solid var(--c); border-left: 5px solid var(--c); border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; }
.ficha-explicacion .lbl { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--cd); margin-bottom: 6px; }
.ficha-explicacion .txt { font-size: 13px; line-height: 1.6; color: #1e293b; }

.ficha-instr { font-size: 12.5px; color: #475569; line-height: 1.6; margin: 0 0 18px; font-style: italic; }

.ficha-actividad { margin-bottom: 20px; break-inside: avoid; page-break-inside: avoid; }
.ficha-actividad .act-header { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: var(--r) var(--r) 0 0; color: #fff; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; font-family: var(--font-t); }
.ficha-actividad .act-header svg { flex-shrink: 0; }
.ficha-actividad .act-ttl { flex: 1; }
.act-emoji { font-size: 17px; line-height: 1; }
.act-check { width: 16px; height: 16px; border-radius: 4px; border: 2px solid rgba(255,255,255,.9); flex-shrink: 0; }
.act-narr { font-size: 12px; font-style: italic; color: #334155; padding: 7px 14px; border-left: 1.5px var(--bs); border-right: 1.5px var(--bs); border-color: inherit; }
.ficha-actividad:has(.act-narr) .act-narr { border-color: var(--num, #cbd5e1); }

.ficha-ejercicios { list-style: none; counter-reset: ej; margin: 0; padding: 14px 16px 4px; border: 1.5px var(--bs); border-top: none; border-radius: 0 0 var(--r) var(--r); }
.ficha-actividad:not(:has(.act-header)) .ficha-ejercicios { border-radius: var(--r); border-top: 1.5px var(--bs); }
.ficha-ejercicios > li { counter-increment: ej; margin-bottom: 18px; break-inside: avoid; page-break-inside: avoid; }
.ficha-ejercicios > li:last-child { margin-bottom: 4px; }
.ficha-ejercicios > li::before { content: counter(ej) '. '; font-weight: 800; color: var(--num, var(--c)); }
.ficha-enunciado { display: inline; font-size: 13px; line-height: 1.6; }

.ficha-opciones { list-style: none; margin: 8px 0 0; padding: 0 0 0 18px; }
.ficha-opciones li { font-size: 12.5px; line-height: 1.9; }
.op-letra { font-weight: 700; color: #64748b; margin-right: 4px; }

.ficha-espacio.box { min-height: 90px; border: 0.75px solid #cbd5e1; border-radius: 6px; margin-top: 8px; }
.ficha-espacio.lines { margin-top: 10px; }
.ficha-espacio.lines .ln, .ficha-comic .ln { border-bottom: 0.75px solid #94a3b8; height: 24px; }
.ficha-espacio.line { border-bottom: 0.75px solid #94a3b8; height: 24px; margin-top: 8px; max-width: 55%; }

.ficha-tabla { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
.ficha-tabla th, .ficha-tabla td { border: 0.75px solid #cbd5e1; padding: 7px 10px; text-align: center; }
.ficha-tabla th { font-weight: 800; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.02em; }
.ficha-tabla td.blank { background: repeating-linear-gradient(135deg, #f8fafc, #f8fafc 6px, #f1f5f9 6px, #f1f5f9 7px); height: 26px; }

.ficha-relacionar { display: flex; justify-content: space-between; gap: 48px; margin-top: 10px; }
.ficha-relacionar .col { flex: 1; display: flex; flex-direction: column; gap: 16px; }
.ficha-relacionar .item { position: relative; font-size: 12.5px; padding: 7px 10px; border: 0.75px solid #cbd5e1; border-radius: 6px; background: #f8fafc; }
.ficha-relacionar .dot-r, .ficha-relacionar .dot-l { position: absolute; top: 50%; width: 8px; height: 8px; margin-top: -4px; border-radius: 50%; background: var(--c); }
.ficha-relacionar .dot-r { right: -14px; }
.ficha-relacionar .dot-l { left: -14px; }

.ficha-sopa { display: grid; gap: 1px; background: #cbd5e1; border: 1px solid #cbd5e1; margin: 10px 0 0; max-width: 78mm; }
.ficha-sopa span { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; background: #fff; font-family: "Courier New", monospace; font-weight: 700; font-size: 11px; }

.ficha-figura { margin-top: 8px; }
.ficha-figura svg { display: block; max-width: 46mm; height: auto; }

.ficha-leyenda { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 10px; }
.ficha-leyenda .chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; padding: 4px 10px; border-radius: 99px; background: #f1f5f9; border: 0.75px solid #e2e8f0; }
.ficha-leyenda .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.ficha-colorear-items { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
.ficha-colorear-items .item-box { display: inline-flex; align-items: center; justify-content: center; min-width: 52px; padding: 10px 14px; border: 1.25px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 700; background: #fff; }

.ficha-vf { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.vf-row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; padding: 6px 8px 6px 12px; border: 0.75px solid #e2e8f0; border-radius: 8px; background: #fff; }
.vf-txt { flex: 1; line-height: 1.45; }
.vf-box { width: 26px; height: 26px; flex-shrink: 0; border: 1.5px solid var(--c); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: var(--c); opacity: .9; }

.ficha-ordenar { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.ord-item { display: flex; align-items: center; gap: 10px; font-size: 12.5px; padding: 6px 10px 6px 6px; border: 0.75px dashed #cbd5e1; border-radius: 8px; }
.ord-num { width: 26px; height: 26px; flex-shrink: 0; border: 1.5px solid var(--c); border-radius: 50%; }

.ficha-cruci { display: flex; gap: 18px; align-items: flex-start; margin-top: 10px; flex-wrap: wrap; }
.cw-grid { display: grid; gap: 0; }
.cw-cell { position: relative; border: 0.9px solid #334155; background: #fff; margin: 0 -0.9px -0.9px 0; }
.cw-cell sup { position: absolute; top: 0.5px; left: 1.5px; font-size: 7px; font-weight: 700; color: #334155; line-height: 1; }
.cw-void { background: transparent; }
.cw-clues { flex: 1; min-width: 55mm; display: flex; flex-direction: column; gap: 8px; }
.cw-lbl { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--cd); margin-bottom: 3px; }
.cw-clue { font-size: 12px; line-height: 1.5; }
.cw-len { color: #94a3b8; font-size: 11px; }

.ficha-comic { display: grid; gap: 8px; margin-top: 10px; }
.ficha-comic .panel { position: relative; border: 2px solid #1e293b; border-radius: 6px; padding: 10px 8px 6px; min-height: 44mm; display: flex; flex-direction: column; justify-content: space-between; background: #fff; }
.ficha-comic .panel-n { position: absolute; top: -1px; left: -1px; background: #1e293b; color: #fff; font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 5px 0 5px 0; }
.ficha-comic .bubble { position: relative; background: #fff; border: 1.5px solid #1e293b; border-radius: 14px; padding: 7px 9px; font-size: 11.5px; line-height: 1.4; margin: 6px 0 10px; }
.ficha-comic .bubble::after { content: ''; position: absolute; bottom: -7px; left: 22px; width: 10px; height: 10px; background: #fff; border-right: 1.5px solid #1e293b; border-bottom: 1.5px solid #1e293b; transform: rotate(45deg); }
.ficha-comic .bubble.empty { padding-top: 0; }
.ficha-comic .bubble.empty .ln { height: 18px; }
.ficha-comic .who { font-size: 34px; line-height: 1; padding-left: 8px; }

.ficha-cierre { display: flex; gap: 18px; align-items: center; margin-top: 6px; padding: 14px 18px; border: 2px var(--bs) var(--c); border-radius: var(--r); background: var(--paper); break-inside: avoid; page-break-inside: avoid; }
.ficha-cierre .badge { flex-shrink: 0; width: 112px; text-align: center; }
.ficha-cierre .badge-ring { width: 84px; height: 84px; margin: 0 auto 6px; border-radius: 50%; border: 3px dashed var(--c); display: flex; align-items: center; justify-content: center; background: #fff; box-shadow: 0 0 0 5px var(--cl); }
.ficha-cierre .badge-ring span { font-size: 40px; line-height: 1; }
.ficha-cierre .badge-name { font-family: var(--font-t); font-size: 11px; font-weight: 800; color: var(--cd); text-transform: uppercase; letter-spacing: .04em; line-height: 1.3; }
.ficha-cierre .cierre-body { flex: 1; min-width: 0; }
.ficha-cierre .cierre-ttl { font-family: var(--font-t); font-size: 17px; font-weight: 800; color: var(--cd); }
.ficha-cierre p { font-size: 12.5px; line-height: 1.55; margin: 4px 0 10px; }
.selfeval { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: #475569; }
.selfeval .se-lbl { font-weight: 700; margin-right: 4px; }
.selfeval .se { width: 30px; height: 30px; border-radius: 50%; border: 1.25px solid #cbd5e1; display: flex; align-items: center; justify-content: center; font-size: 17px; }

.var-mark { float: right; font-size: 11px; color: #94a3b8; }

.ficha-candado { display: flex; align-items: center; gap: 12px; margin: 12px 0 0; padding: 10px 14px; border: 2px dashed; border-radius: var(--r); break-inside: avoid; page-break-inside: avoid; }
.ficha-candado .lock { font-size: 28px; line-height: 1; }
.ficha-candado .lock-body { flex: 1; min-width: 0; }
.ficha-candado .lock-ttl { font-family: var(--font-t); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: #1e293b; }
.ficha-candado .lock-hint { font-size: 11.5px; color: #475569; margin-top: 2px; line-height: 1.4; }
.ficha-candado .lock-boxes { display: flex; gap: 5px; }
.ficha-candado .lock-boxes span { width: 28px; height: 34px; border: 2px solid; border-radius: 6px; background: #fff; }
.ficha-actividad:has(.ficha-candado) .ficha-ejercicios { margin-bottom: 0; }

.fmt-tarjetas .ficha-instr { font-style: normal; background: var(--cl); border-radius: var(--r); padding: 8px 12px; margin-top: 12px; }
.tj-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-top: 1.5px dashed #94a3b8; border-left: 1.5px dashed #94a3b8; }
.tj { display: flex; flex-direction: column; height: 62mm; border-right: 1.5px dashed #94a3b8; border-bottom: 1.5px dashed #94a3b8; break-inside: avoid; page-break-inside: avoid; }
.tj-front, .tj-back { flex: 1; position: relative; display: flex; align-items: center; justify-content: center; padding: 6mm 7mm; text-align: center; }
.tj-front { background: linear-gradient(180deg, var(--tjl), #fff); }
.tj-n { position: absolute; top: 3mm; left: 4mm; font-size: 10px; font-weight: 800; color: var(--tj); }
.tj-emoji { position: absolute; top: 2mm; right: 3mm; font-size: 16px; }
.tj-q { font-family: var(--font-t); font-size: 13px; font-weight: 700; line-height: 1.35; color: #1e293b; }
.tj-fold { position: relative; border-top: 1.25px dotted #94a3b8; height: 0; }
.tj-fold span { position: absolute; left: 50%; top: -6px; transform: translateX(-50%); background: #fff; padding: 0 6px; font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: .1em; }
.tj-back .tj-a { transform: rotate(180deg); font-size: 12.5px; line-height: 1.35; color: #334155; }
.tj-albl { display: block; font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: var(--tj); margin-bottom: 2px; }
.tj-cut { font-size: 11px; color: #64748b; margin: 8px 0 0; }

.lf { font-family: Verdana, Arial, sans-serif !important; }
.lf .ficha-enunciado, .lf .ficha-explicacion .txt, .lf .ficha-mision .bubble { font-size: 15px; line-height: 1.8; }
.lf .ficha-instr { font-size: 14px; font-style: normal; line-height: 1.8; }
.lf .ficha-opciones li, .lf .vf-row, .lf .ord-item, .lf .ficha-relacionar .item, .lf .cw-clue { font-size: 14px; }
.lf .ficha-ejercicios > li { margin-bottom: 24px; }
.lf .act-narr { font-style: normal; font-size: 13px; }

@media print { @page { size: A4 portrait; margin: 14mm 16mm; } }
`;

const FICHA_DOC_STANDALONE = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
`;

/** Solo en la vista previa del editor: la hoja A4 sobre la mesa, y el bloque elegido resaltado. */
const FICHA_PREVIEW_STYLE = `
html, body { background: #e2e8f0; }
body { padding: 18px 0 28px; }
.ficha-doc { width: 210mm; min-height: 297mm; max-width: none; padding: 14mm 16mm; box-shadow: 0 2px 14px rgba(15,23,42,.18); border-radius: 2px; }
[data-ex], [data-act], [data-part], [data-card] { cursor: pointer; transition: outline-color .15s; outline: 2px solid transparent; outline-offset: 3px; border-radius: 4px; }
[data-ex]:hover, [data-part]:hover, [data-card]:hover { outline-color: rgba(99,102,241,.35); }
.is-selected { outline: 2.5px solid #6366f1 !important; outline-offset: 3px; }
`;

/* ── Word (generado en el propio navegador, sin pasar por Electron) ── */

const CELL_BORDER = { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' };
const CELL_BORDERS = { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER, insideHorizontal: CELL_BORDER, insideVertical: CELL_BORDER };

/**
 * `docx` no admite SVG en un `ImageRun`, solo mapas de bits — así que el
 * diagrama se pinta en un `<canvas>` (a 2x para que no salga borroso al
 * imprimir) y se saca como PNG. Todo esto es DOM/navegador, por eso
 * `buildFichaDocxBlob` — que ya era async por `Packer.toBlob` — es el único
 * sitio donde se llama. Si algo falla (por lo que sea, un SVG raro), se
 * devuelve null y el ejercicio se exporta sin el dibujo antes que reventar
 * la ficha entera.
 */
async function figureToImageRun(ex: FichaExercise, colorHexNoHash: string): Promise<ImageRun | null> {
  if (!ex.figura) return null;
  try {
    const svg = buildFigureSvg(ex.figura.forma, ex.figura.medidas, '#' + colorHexNoHash);
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('No se pudo cargar el SVG de la figura'));
        el.src = svgUrl;
      });
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = FIGURE_W * scale;
      canvas.height = FIGURE_H * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, FIGURE_W, FIGURE_H);
      const pngBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!pngBlob) return null;
      const bytes = new Uint8Array(await pngBlob.arrayBuffer());
      return new ImageRun({ type: 'png', data: bytes, transformation: { width: FIGURE_W, height: FIGURE_H } });
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  } catch {
    return null;
  }
}

const EMOJI_FONT = 'Segoe UI Emoji';
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER };
const spacer = (after = 160) => new Paragraph({ text: '', spacing: { after } });

function crosswordDocx(children: (Paragraph | Table)[], cw: Crossword, t: Tr) {
  const CELL = 340;
  const grid = crosswordCells(cw);
  const on = { style: BorderStyle.SINGLE, size: 6, color: '334155' };
  children.push(new Table({
    width: { size: CELL * cw.columnas, type: WidthType.DXA },
    borders: NO_BORDERS,
    rows: grid.map(row => new TableRow({
      height: { value: CELL, rule: 'exact' },
      children: row.map(cell => new TableCell({
        width: { size: CELL, type: WidthType.DXA },
        margins: { top: 0, bottom: 0, left: 20, right: 0 },
        borders: cell ? { top: on, bottom: on, left: on, right: on } : { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
        children: [new Paragraph({ children: cell?.numero ? [new TextRun({ text: String(cell.numero), size: 12, bold: true })] : [] })],
      })),
    })),
  }));
  children.push(spacer(120));
  for (const [dir, label] of [['H', t('Horizontales')], ['V', t('Verticales')]] as const) {
    const list = cw.entradas.filter(e => e.dir === dir);
    if (!list.length) continue;
    children.push(new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18 })], spacing: { after: 40 } }));
    for (const e of list) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `${e.numero}. `, bold: true }), new TextRun({ text: e.pista }), new TextRun({ text: ` (${e.palabra.length})`, color: '94A3B8' })],
        spacing: { after: 30 },
      }));
    }
  }
  children.push(spacer(160));
}

async function pushExerciseDocx(children: (Paragraph | Table)[], ex: FichaExercise, i: number, colorHexNoHash: string, t: Tr) {
  const letra = (n: number) => String.fromCharCode(97 + n);

  children.push(new Paragraph({
    children: [
      new TextRun({ text: `${i + 1}. `, bold: true, color: colorHexNoHash }),
      new TextRun({ text: ex.enunciado }),
    ],
    spacing: { before: i === 0 ? 0 : 220, after: 60 },
  }));

  const figureImage = await figureToImageRun(ex, colorHexNoHash);
  if (figureImage) {
    children.push(new Paragraph({ children: [figureImage], spacing: { after: 100 } }));
  }

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

  if (ex.tipo === 'sopa_letras' && ex.rejilla?.length) {
    // Solo la rejilla en blanco: la solución (`posiciones`) es para el profesorado y no se exporta.
    const CELL_DXA = 380;
    children.push(new Table({
      width: { size: CELL_DXA * ex.rejilla[0].length, type: WidthType.DXA },
      borders: CELL_BORDERS,
      rows: ex.rejilla.map(fila => new TableRow({
        children: fila.map(letra => new TableCell({
          width: { size: CELL_DXA, type: WidthType.DXA },
          margins: { top: 40, bottom: 40, left: 0, right: 0 },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: letra, font: 'Courier New', bold: true, size: 18 })],
          })],
        })),
      })),
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 160 } }));
    if (ex.palabras?.length) {
      children.push(new Paragraph({
        children: ex.palabras.map((p, pi) => new TextRun({ text: (pi > 0 ? '     ' : '') + `[ ${p} ]`, bold: true })),
        spacing: { after: 200 },
      }));
    }
    return;
  }

  if (ex.tipo === 'verdadero_falso' && ex.afirmaciones?.length) {
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: CELL_BORDERS,
      rows: ex.afirmaciones.map(a => new TableRow({
        children: [
          new TableCell({ width: { size: 84, type: WidthType.PERCENTAGE }, margins: { top: 70, bottom: 70, left: 120, right: 120 }, children: [new Paragraph({ text: a })] }),
          ...[t('V'), t('F')].map(x => new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: x, bold: true, color: colorHexNoHash, size: 18 })] })],
          })),
        ],
      })),
    }));
    children.push(spacer(200));
    return;
  }

  if (ex.tipo === 'ordenar' && ex.elementos?.length) {
    for (const e of ex.elementos) {
      children.push(new Paragraph({
        children: [new TextRun({ text: '(     )  ', bold: true, color: colorHexNoHash }), new TextRun({ text: e })],
        indent: { left: 340 },
        spacing: { after: 80 },
      }));
    }
    children.push(spacer(120));
    return;
  }

  if (ex.tipo === 'crucigrama' && ex.crucigrama?.entradas.length) {
    crosswordDocx(children, ex.crucigrama, t);
    return;
  }

  if (ex.tipo === 'comic' && ex.vinetas?.length) {
    const panelBorder = { style: BorderStyle.SINGLE, size: 12, color: '1E293B' };
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: panelBorder, bottom: panelBorder, left: panelBorder, right: panelBorder, insideHorizontal: panelBorder, insideVertical: panelBorder },
      rows: [new TableRow({
        children: ex.vinetas.map((v, vi) => new TableCell({
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
          children: [
            new Paragraph({ children: [new TextRun({ text: String(vi + 1), bold: true, size: 16, color: '64748B' })] }),
            ...(v.texto
              ? [new Paragraph({ children: [new TextRun({ text: `«${v.texto}»`, size: 19 })], spacing: { after: 160 } })]
              : [0, 1, 2].map(() => new Paragraph({ text: '', spacing: { after: 200 }, border: { bottom: { style: 'single', size: 4, color: '94A3B8', space: 1 } } }))),
            new Paragraph({ children: [new TextRun({ text: v.personaje, font: EMOJI_FONT, size: 48 })] }),
          ],
        })),
      })],
    }));
    children.push(spacer(200));
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

/** Tarjetas en Word: tabla de 2 columnas con bordes discontinuos; la respuesta va debajo de la línea de doblar. */
function tarjetasDocx(children: (Paragraph | Table)[], cards: FichaTarjeta[], theme: ReturnType<typeof fichaTheme>, t: Tr) {
  const CUT = { style: BorderStyle.DASHED, size: 8, color: '94A3B8' };
  const rows: TableRow[] = [];
  for (let i = 0; i < cards.length; i += 2) {
    rows.push(new TableRow({
      cantSplit: true,
      children: [0, 1].map(k => {
        const tj = cards[i + k];
        const color = theme.bloques[(i + k) % theme.bloques.length];
        return new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          margins: { top: 200, bottom: 200, left: 200, right: 200 },
          children: tj ? [
            new Paragraph({ children: [new TextRun({ text: `${i + k + 1}`, bold: true, size: 16, color: color.bg })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: tj.pregunta, bold: true, size: 22 })], spacing: { after: 360 } }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `· · · · · ${t('doblar')} · · · · ·`, size: 14, color: '94A3B8' })], spacing: { after: 200 } }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${t('Respuesta')}: `, bold: true, size: 16, color: color.bg }), new TextRun({ text: tj.respuesta, size: 20 })] }),
          ] : [new Paragraph({ text: '' })],
        });
      }),
    }));
  }
  if (!rows.length) return;
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: CUT, bottom: CUT, left: CUT, right: CUT, insideHorizontal: CUT, insideVertical: CUT },
    rows,
  }));
  children.push(new Paragraph({ children: [new TextRun({ text: `✂  ${t('Recorta por la línea discontinua y dobla cada tarjeta por la mitad.')}`, size: 18, color: '64748B' })], spacing: { before: 120 } }));
}

/** Construye el .docx. Separado de `saveFichaDocx` para poder probarlo sin DOM. */
export async function buildFichaDocxBlob(f: Ficha, lang: Lang): Promise<Blob> {
  const t = (k: string, vars?: Record<string, string | number>) => translate(lang, k, vars);
  const c = f.content;
  const actividades = getActividades(c);
  const theme = fichaTheme(c.estilo);
  const classic = theme.id === 'clasico';
  const historia = classic ? undefined : c.historia;

  // Sin imagen de IA (los modelos de imagen de Gemini no están en el nivel
  // gratuito), el título lleva el mismo color de motivo que usaría la
  // ilustración, a modo de cabecera con identidad — igual que las
  // cabeceras de actividad más abajo, sin necesitar rasterizar nada. Con un
  // tema, la cabecera es la del tema, con su personaje.
  const motif = classic
    ? MOTIF_COLORS[pickMotifKey(f.request.tema, f.request.area)]
    : { bg: theme.color, accent: 'FFFFFF' };
  const children: (Paragraph | Table)[] = [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: classic ? CELL_BORDERS : NO_BORDERS,
      rows: [new TableRow({
        children: [new TableCell({
          shading: { fill: motif.bg },
          margins: { top: 160, bottom: 160, left: 180, right: 180 },
          children: [
            ...(classic ? [] : [new Paragraph({
              children: [
                new TextRun({ text: `${historia?.emoji || theme.personaje}  `, font: EMOJI_FONT, size: 36 }),
                new TextRun({ text: `${t(theme.nombre).toUpperCase()}   ${theme.adornos.slice(0, 3).join(' ')}`, bold: true, color: 'FFFFFF', size: 16 }),
              ],
            })]),
            new Paragraph({
              children: [new TextRun({ text: c.titulo || f.title, bold: true, color: motif.accent, size: 32, font: classic ? undefined : theme.fuenteTitulo.split(',')[0].replace(/"/g, '') })],
            }),
          ],
        })],
      })],
    }),
    new Paragraph({ text: '', spacing: { after: 160 } }),
  ];

  children.push(new Paragraph({
    children: [new TextRun({
      text: `${t('Nombre')}: ______________________________     ${t('Fecha')}: ____________     ${t('Clase')}: __________${c.variante ? `     ${VARIANTE_MARK[c.variante]}` : ''}`,
      size: 20,
    })],
    spacing: { after: 200 },
    border: { bottom: { style: 'single', size: 4, color: 'CBD5E1', space: 8 } },
  }));

  if (historia?.mision) {
    const B = { style: BorderStyle.SINGLE, size: 8, color: theme.color };
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: B, bottom: B, left: B, right: B, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE }, shading: { fill: theme.claro },
            margins: { top: 120, bottom: 120, left: 120, right: 60 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: historia.emoji, font: EMOJI_FONT, size: 48 })] })],
          }),
          new TableCell({
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: [
              new Paragraph({ children: [new TextRun({ text: historia.personaje.toUpperCase(), bold: true, color: theme.oscuro, size: 18 })], spacing: { after: 40 } }),
              new Paragraph({ children: [new TextRun({ text: historia.mision })] }),
            ],
          }),
        ],
      })],
    }));
    children.push(spacer());
  }

  if (c.explicacion) {
    const EXPL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: classic ? '7DD3FC' : theme.color };
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: EXPL_BORDER, bottom: EXPL_BORDER, left: EXPL_BORDER, right: EXPL_BORDER, insideHorizontal: EXPL_BORDER, insideVertical: EXPL_BORDER },
      rows: [new TableRow({
        children: [new TableCell({
          shading: { fill: classic ? 'EFF6FF' : theme.claro },
          margins: { top: 140, bottom: 140, left: 160, right: 160 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: t('Antes de empezar'), bold: true, color: classic ? '0369A1' : theme.oscuro, size: 18 })],
              spacing: { after: 60 },
            }),
            new Paragraph({ children: [new TextRun({ text: c.explicacion, color: classic ? '0C4A6E' : '1E293B' })] }),
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

  const formato = c.formato ?? 'ficha';
  const escape = formato === 'escape';
  if (formato === 'tarjetas') tarjetasDocx(children, c.tarjetas ?? [], theme, t);

  for (const [actIdx, act] of (formato === 'tarjetas' ? [] : actividades).entries()) {
    const color = theme.bloques[actIdx % theme.bloques.length];
    const label = `${t(escape ? 'Sala' : theme.paso)} ${actIdx + 1}: ${act.titulo}`;
    if (act.titulo) {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: CELL_BORDERS,
        rows: [new TableRow({
          children: [new TableCell({
            shading: { fill: color.bg },
            margins: { top: 90, bottom: 90, left: 140, right: 140 },
            children: [new Paragraph({
              children: [
                ...(classic ? [] : [new TextRun({ text: `${act.emoji || theme.iconos[actIdx % theme.iconos.length]}  `, font: EMOJI_FONT, size: 22 })]),
                new TextRun({ text: label, bold: true, color: 'FFFFFF', size: 20 }),
              ],
            })],
          })],
        })],
      }));
      if (!classic && act.narrativa) {
        children.push(new Paragraph({
          children: [new TextRun({ text: act.narrativa, italics: true, color: '334155', size: 20 })],
          shading: { fill: color.light },
          spacing: { before: 60, after: 60 },
        }));
      }
      children.push(new Paragraph({ text: '', spacing: { after: 100 } }));
    }
    for (const [i, ex] of act.ejercicios.entries()) await pushExerciseDocx(children, ex, i, color.bg, t);
    if (escape && act.candado) {
      const next = actIdx + 1 < actividades.length ? t('Abre la sala {n}', { n: actIdx + 2 }) : t('Abre el cofre final');
      const B = { style: BorderStyle.DASHED, size: 12, color: color.bg };
      const n = Math.max(3, act.candado.codigo.length);
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: B, bottom: B, left: B, right: B, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
        rows: [new TableRow({
          children: [new TableCell({
            shading: { fill: color.light },
            margins: { top: 100, bottom: 100, left: 160, right: 160 },
            children: [
              new Paragraph({ children: [
                new TextRun({ text: '🔒  ', font: EMOJI_FONT, size: 28 }),
                new TextRun({ text: `${t('Candado')} · ${next}`.toUpperCase(), bold: true, size: 18 }),
              ] }),
              ...(act.candado.pista ? [new Paragraph({ children: [new TextRun({ text: act.candado.pista, size: 19, color: '475569' })], spacing: { after: 80 } })] : []),
              new Paragraph({ children: [new TextRun({ text: Array.from({ length: n }, () => '[   ]').join('  '), bold: true, size: 28, color: color.bg })] }),
            ],
          })],
        })],
      }));
    }
    children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
  }

  if (historia && formato !== 'tarjetas') {
    const B = { style: BorderStyle.DASHED, size: 12, color: theme.color };
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: B, bottom: B, left: B, right: B, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 26, type: WidthType.PERCENTAGE }, shading: { fill: theme.claro },
            margins: { top: 160, bottom: 160, left: 120, right: 120 },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: historia.emoji, font: EMOJI_FONT, size: 64 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: historia.insignia.toUpperCase(), bold: true, color: theme.oscuro, size: 16 })] }),
            ],
          }),
          new TableCell({
            margins: { top: 160, bottom: 160, left: 200, right: 160 },
            children: [
              new Paragraph({ children: [new TextRun({ text: t(escape ? '¡Habéis escapado!' : '¡Misión cumplida!'), bold: true, color: theme.oscuro, size: 30 })], spacing: { after: 60 } }),
              ...(historia.cierre ? [new Paragraph({ text: historia.cierre, spacing: { after: 120 } })] : []),
              new Paragraph({
                children: [
                  new TextRun({ text: `${t('¿Cómo te ha ido?')}   `, bold: true, color: '475569', size: 19 }),
                  new TextRun({ text: '😃   🙂   😐   😟', font: EMOJI_FONT, size: 28 }),
                ],
              }),
            ],
          }),
        ],
      })],
    }));
  }

  const doc = new Document({
    sections: [{ children, properties: { page: { margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 } } } }],
    // Lectura fácil: letra sin adornos y más grande
    styles: { default: { document: { run: c.variante === 'lectura_facil' ? { font: 'Verdana', size: 26 } : { font: 'Calibri', size: 22 } } } },
  });

  return Packer.toBlob(doc);
}

export async function saveFichaDocx(f: Ficha, lang: Lang) {
  const blob = await buildFichaDocxBlob(f, lang);
  await downloadFile(blob, fileBase(f) + '.docx');
}
