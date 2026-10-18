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
import type { FichaExercise, FichaExerciseType, FichaActivity, FichaCandado, FichaRecuadro, FichaTarjeta, FichaVariante, FichaContent } from './resources';
import type { FichaLectura } from '../lib/lectura';
import { crosswordCells, type Crossword } from '../lib/crossword';
import { fichaTheme } from '../lib/fichaThemes';
import { loadThemeArt } from '../lib/themeArtDoc';
import { cargarFuenteCuaderno } from '../lib/fuenteCuaderno';
import { translate, type Lang } from '../i18n';
import { svgLightbulb, svgPencil } from './fichaIcons';
import { pickMotifKey, MOTIF_COLORS, MOTIF_ICON } from './fichaMotifs';
import { buildFigureSvg, FIGURE_W, FIGURE_H } from '../lib/geometryFigures';
import { downloadFile } from '../lib/download';
import { ATRIBUCION_MULBERRY, esMulberry, pictoDe } from '../lib/pictos';
import { pictoComoDato } from './exportAgenda';
import { dibujosEnOrden } from '../lib/pictosFicha';
import { estrellas, NOMBRE_DIFICULTAD } from '../lib/escalera';
import { esDensidad, type Densidad } from '../lib/densidad';
import { componerHoja, type Composicion } from './compositor';
import {
  fraccionSvgDato, fraccionTexto, letraFraccion, ordenUnir, tieneDecimalExacto, valorUnir, type CogidosFraccion, type FraccionDibujo,
} from '../lib/fraccionesDibujo';
import {
  CUADERNO_STYLE, autoevaluacionHtml, bancoHtml, cabeceraHtml, calculosHtml, clasificarHtml, completarHtml, contarHtml, contestarHtml, datosHtml, dibujarHtml,
  dibujosDeLaCabecera, dibujosHtml, esRespuestaCorta,
  estrellasSvg, etiquetarHtml, fraccionesAmbienteHtml, fraccionesHtml, lecturaHtml, lineasDeRespuesta, lineasHtml, lupaConsigna, nivelHtml, opcionesHtml, operacionHtml,
  recuadroHtml, recuadroLineas, respuestaHtml, rico, seccionHtml, serieDe, serieHtml,
  type Ilus,
} from './fichaCuaderno';
import { dibujosDeLaLectura } from '../lib/lectura';
import { partirNegritas, quitarNegritas, sinNegritasQueNoSePintan } from '../lib/negritas';
import { nombreIlustracion, urlIlustracion } from '../lib/ilustraciones';
import { bancoClasificar, esTipoConDibujos } from '../lib/dibujosEjercicio';
import { CARPETAS } from '../lib/carpetas';

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

/* ── Apoyos visuales: los pictogramas de la ficha ── */

/** Todos los pictogramas que usa la ficha, sin repetir. */
export function pictosDeFicha(c: FichaContent): string[] {
  if (!c.visual) return [];
  const ids = new Set<string>();
  const add = (id?: string) => { if (id) ids.add(id); };
  c.conceptos?.forEach(k => add(k.picto));
  for (const act of getActividades(c)) {
    act.pasos?.forEach(p => add(p.picto));
    act.recuerda?.forEach(r => add(r.picto));
    for (const ex of act.ejercicios) {
      add(ex.consigna);
      ex.imagenes?.forEach(im => add(im.picto));
      ex.pictosFilas?.forEach(add);
    }
  }
  return [...ids].filter(id => pictoDe(id));
}

/** Unos pictogramas como `data:`, por su id, para el HTML del PDF y la vista previa. */
export async function cargarPictos(ids: readonly string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(ids.map(async id => {
    const d = await pictoComoDato(id);
    if (d) out[id] = d;
  }));
  return out;
}

export const cargarPictosFicha = (c: FichaContent) => cargarPictos(pictosDeFicha(c));

/** Un `<img>` con el pictograma, o nada si aún no se ha cargado. */
type Pic = (id: string | undefined, cls: string) => string;

/* ── Hilo conductor: los dibujos del catálogo de la ficha ── */

/** Todos los dibujos del catálogo que usa la ficha (cabecera del hilo, bloques y ejercicios), sin repetir. */
export function ilustracionesDeFicha(c: FichaContent): string[] {
  // Los del texto de una ficha de lectura van aunque no haya hilo (el hilo es de los ejercicios y la cabecera)
  const ids = new Set<string>([...dibujosDeLaCabecera(c.hilo), ...dibujosDeLaLectura(c.lectura)]);
  if (!c.hilo) return [...ids];
  for (const act of getActividades(c)) {
    for (const ex of act.ejercicios) {
      ex.dibujos?.forEach(d => { if (d.ilustracion) ids.add(d.ilustracion); });
      ex.categorias?.forEach(cat => cat.dibujos.forEach(id => ids.add(id)));
    }
  }
  return [...ids];
}

const cacheIlustraciones = new Map<string, Promise<string | null>>();

/** Un dibujo del catálogo como `data:`, para incrustarlo en el PDF y en la vista previa. */
export function ilustracionComoDato(id: string): Promise<string | null> {
  let p = cacheIlustraciones.get(id);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}${urlIlustracion(id)}`);
        if (!res.ok) return null;
        const blob = await res.blob();
        return await new Promise<string | null>(resolve => {
          const lector = new FileReader();
          lector.onload = () => resolve(typeof lector.result === 'string' ? lector.result : null);
          lector.onerror = () => resolve(null);
          lector.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    })();
    p.then(r => { if (!r) cacheIlustraciones.delete(id); });
    cacheIlustraciones.set(id, p);
  }
  return p;
}

/** Unos dibujos del catálogo como `data:`, por su id. */
export async function cargarIlustraciones(ids: readonly string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(ids.map(async id => {
    const d = await ilustracionComoDato(id);
    if (d) out[id] = d;
  }));
  return out;
}

export const cargarIlustracionesFicha = (c: FichaContent) => cargarIlustraciones(ilustracionesDeFicha(c));

/* ── PDF (HTML independiente, impreso por Electron en vertical) ── */

const esc = (s: string) => (s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const nl2br = (s: string) => rico(s).replace(/\n/g, '<br>');

type Tr = (k: string, vars?: Record<string, string | number>) => string;

function exerciseBodyHtml(
  ex: FichaExercise, color: { bg: string; light: string }, t: Tr, pic?: Pic, cuaderno = false, ilus?: Ilus, lang: Lang = 'es',
  nuevoId: () => string = () => 'fr0',
): string {
  const letra = (i: number) => String.fromCharCode(97 + i);
  // «Cuaderno» con dibujos del catálogo (hilo conductor): cada dibujo lleva su espacio para contestar. Sin ellos
  // (se quitó el hilo, o aún no se han cargado), contar, etiquetar y clasificar se maquetan como una pregunta abierta
  const conDibujos = cuaderno && !!ilus;
  const tipo: FichaExerciseType = !conDibujos && esTipoConDibujos(ex.tipo) ? 'abierta' : ex.tipo;
  const dib = conDibujos ? dibujosHtml(ex, ilus!) : { lado: '', bandeja: '' };
  // Estos tipos usan sus dibujos de otra manera (uno por grupo, por elemento…): ni figura al lado ni bandeja
  const dibujosPropios = tipo === 'relacionar' || tipo === 'tabla_rellenar' || esTipoConDibujos(tipo);
  // Pizzas y tartas dibujadas por el código: el ejercicio «fracciones» las lleva con su espacio; en otro tipo, la figura del enunciado
  const frAmb = tipo !== 'fracciones' && ex.fracciones?.length ? fraccionesAmbienteHtml(ex, nuevoId) : { lado: '', bandeja: '' };
  const comp = cuaderno && tipo === 'completar' ? completarHtml(ex.enunciado) : null;
  // «Rodea en el texto…»: una lupa delante, que manda al texto
  const lupa = cuaderno && tipo === 'en_texto' ? lupaConsigna : '';
  // Con un recuadro de palabras, va antes de las frases que se completan con ellas
  const banco = tipo === 'completar' && ex.bancoPalabras?.length ? bancoHtml(ex.bancoPalabras) : '';
  const enunciado = banco + (pic && ex.consigna ? pic(ex.consigna, 'vis-consigna') : '') + `<div class="ficha-enunciado">${lupa}${comp ? comp.html : rico(ex.enunciado)}</div>`;
  const figuraSvg = ex.figura ? buildFigureSvg(ex.figura.forma, ex.figura.medidas, '#' + color.bg) : '';
  // La figura geométrica de un problema, enmarcada junto al enunciado como un dibujo suelto, si el tipo lo admite
  const figuraAlLado = cuaderno && !!figuraSvg && !dib.lado && ['problema', 'abierta', 'completar', 'opcion_multiple'].includes(tipo);
  const lado = dibujosPropios ? '' : frAmb.lado ? frAmb.lado : figuraAlLado ? `<div class="cq-fig svg">${figuraSvg}</div>` : dib.lado;
  let body = enunciado + (dibujosPropios ? '' : dib.bandeja) + frAmb.bandeja;
  // Fuera de «Cuaderno» no hay columna al lado del enunciado: la figura suelta va debajo
  if (!cuaderno && frAmb.lado) body += frAmb.lado;

  // Los dibujos del contenido, justo debajo del enunciado: lo que hay que contar o reconocer
  const dibujos = pic ? dibujosEnOrden(ex.imagenes) : [];
  if (dibujos.length) {
    body += `<div class="vis-imagenes${dibujos.length > 12 ? ' muchos' : ''}">${dibujos.map(id => pic!(id, 'vis-img')).join('')}</div>`;
  }

  // Independiente del tipo: cualquier ejercicio puede llevar un diagrama, aunque en la práctica solo lo pidan los "problema".
  if (figuraSvg && !figuraAlLado) body += `<div class="ficha-figura">${figuraSvg}</div>`;

  if (tipo === 'fracciones' && ex.fracciones?.length) {
    body += fraccionesHtml(ex, t, lang, nuevoId);
  } else if (conDibujos && tipo === 'contar') {
    body += contarHtml(ex, ilus!, t);
  } else if (conDibujos && tipo === 'etiquetar') {
    body += etiquetarHtml(ex, ilus!, lang);
  } else if (conDibujos && tipo === 'clasificar') {
    body += clasificarHtml(ex, ilus!, lang);
  } else if (tipo === 'opcion_multiple' && ex.opciones?.length) {
    body += cuaderno
      ? opcionesHtml(ex.opciones)
      : `<ol class="ficha-opciones">${ex.opciones.map((o, j) => `<li><span class="op-letra">${letra(j)})</span> ${rico(o)}</li>`).join('')}</ol>`;
  } else if (tipo === 'tabla_rellenar' && ex.columnas?.length && ex.filas?.length) {
    // Con apoyos visuales (pictogramas) o con dibujos del catálogo, una columna delante con el dibujo de cada fila
    const dibFilas = conDibujos && ex.dibujos?.length === ex.filas.length && ex.dibujos.some(d => d.ilustracion) ? ex.dibujos : null;
    const conDibujo = dibFilas ? true : !!pic && !!ex.pictosFilas?.some(Boolean);
    const imgFila = (fi: number) => dibFilas ? ilus!(dibFilas[fi].ilustracion, 'cq-tdib') : pic!(ex.pictosFilas?.[fi], 'vis-fila');
    body += `<table class="ficha-tabla">` +
      `<thead><tr>${conDibujo ? `<th class="vis-col" style="background:#${color.light}"></th>` : ''}${ex.columnas.map(col => `<th style="background:#${color.light};color:#${color.bg}">${esc(col)}</th>`).join('')}</tr></thead>` +
      `<tbody>${ex.filas.map((fila, fi) => `<tr>${conDibujo ? `<td class="vis-col">${imgFila(fi)}</td>` : ''}${fila.map(celda => celda ? `<td>${esc(celda)}</td>` : `<td class="blank"></td>`).join('')}</tr>`).join('')}</tbody>` +
      `</table>`;
  } else if (tipo === 'relacionar' && ex.izquierda?.length && ex.derecha?.length) {
    if (cuaderno) {
      // Una fila por pareja de huecos (izquierda y derecha a la misma altura), con el dibujo en el elemento que lo tenga
      const dibIzq = conDibujos && ex.dibujos?.length === ex.izquierda.length ? ex.dibujos : null;
      const filas = Math.max(ex.izquierda.length, ex.derecha.length);
      body += `<div class="cq-rel">` + Array.from({ length: filas }, (_, i) => {
        const img = dibIzq ? ilus!(dibIzq[i]?.ilustracion, 'cq-rel-img') : '';
        const izq = ex.izquierda![i] !== undefined
          ? `<div class="item${img ? ' con-dib' : ''}">${img}<span><b>${i + 1}.</b> ${rico(ex.izquierda![i])}</span><span class="dot-r"></span></div>` : '<div></div>';
        const der = ex.derecha![i] !== undefined
          ? `<div class="item"><span class="dot-l"></span><span><b>${letra(i).toUpperCase()}.</b> ${rico(ex.derecha![i])}</span></div>` : '<div></div>';
        return izq + der;
      }).join('') + `</div>`;
    } else {
      body += `<div class="ficha-relacionar">` +
        `<div class="col">${ex.izquierda.map((it, i) => `<div class="item">${i + 1}. ${rico(it)}<span class="dot-r"></span></div>`).join('')}</div>` +
        `<div class="col">${ex.derecha.map((it, j) => `<div class="item"><span class="dot-l"></span>${letra(j).toUpperCase()}. ${rico(it)}</div>`).join('')}</div>` +
        `</div>`;
    }
  } else if (tipo === 'colorear') {
    if (ex.leyenda?.length) {
      body += `<div class="ficha-leyenda">${ex.leyenda.map(l => `<span class="chip"><span class="dot" style="background:#${colorHex(l.color)}"></span>${esc(l.color)}: ${esc(l.criterio)}</span>`).join('')}</div>`;
    }
    if (ex.itemsColorear?.length) {
      body += `<div class="ficha-colorear-items">${ex.itemsColorear.map(it => `<span class="item-box">${esc(it)}</span>`).join('')}</div>`;
    }
  } else if (tipo === 'sopa_letras' && ex.rejilla?.length) {
    // Solo la rejilla en blanco: la solución (`posiciones`) es para el profesorado y no se exporta.
    const cols = ex.rejilla[0].length;
    body += `<div class="ficha-sopa" style="grid-template-columns:repeat(${cols},1fr)">` +
      ex.rejilla.flat().map(letra => `<span>${esc(letra)}</span>`).join('') +
      `</div>`;
    if (ex.palabras?.length) {
      body += `<div class="ficha-colorear-items">${ex.palabras.map(p => `<span class="item-box">${esc(p)}</span>`).join('')}</div>`;
    }
  } else if (tipo === 'verdadero_falso' && ex.afirmaciones?.length) {
    body += `<div class="ficha-vf">${ex.afirmaciones.map(a =>
      `<div class="vf-row"><span class="vf-txt">${rico(a)}</span><span class="vf-box">${esc(t('V'))}</span><span class="vf-box">${esc(t('F'))}</span></div>`).join('')}</div>`;
  } else if (tipo === 'calculos' && ex.lineas?.length) {
    body += calculosHtml(ex);
  } else if (cuaderno && serieDe(ex)) {
    // En «Cuaderno», una serie corta (números, palabras) se escribe en orden en una caja
    body += serieHtml(serieDe(ex)!);
  } else if (tipo === 'ordenar' && ex.elementos?.length) {
    body += `<div class="ficha-ordenar">${ex.elementos.map(e => `<div class="ord-item"><span class="ord-num"></span>${rico(e)}</div>`).join('')}</div>`;
  } else if (tipo === 'crucigrama' && ex.crucigrama?.entradas.length) {
    body += crosswordHtml(ex.crucigrama, t);
  } else if (tipo === 'comic' && ex.vinetas?.length) {
    body += `<div class="ficha-comic" style="grid-template-columns:repeat(${Math.min(ex.vinetas.length, 4)},1fr)">${ex.vinetas.map((v, i) =>
      `<div class="panel"><span class="panel-n">${i + 1}</span>` +
      `<div class="bubble${v.texto ? '' : ' empty'}">${v.texto ? esc(v.texto) : '<div class="ln"></div><div class="ln"></div><div class="ln"></div>'}</div>` +
      `<div class="who">${esc(v.personaje)}</div></div>`).join('')}</div>`;
  } else if (tipo === 'contestar' && ex.preguntas?.length) {
    body += cuaderno
      ? contestarHtml(ex)
      : `<div class="ficha-preguntas">${ex.preguntas.map(q => `<div class="pq">${rico(q)}</div><div class="ficha-espacio line"></div>`).join('')}</div>`;
  } else if (tipo === 'dibujar') {
    body += cuaderno ? dibujarHtml(ex) : '<div class="ficha-espacio box"></div>';
  } else if (tipo === 'en_texto') {
    const n = Math.max(0, Math.min(3, ex.lineasRespuesta ?? 0));
    body += n ? (cuaderno ? lineasHtml(n) : `<div class="ficha-espacio lines">${'<div class="ln"></div>'.repeat(n)}</div>`) : '';
  } else if (cuaderno) {
    // El espacio para contestar sigue a lo que se espera: una caja para una palabra o un número, las líneas justas para una frase, cuadrícula y respuesta para un problema
    if (tipo === 'problema') body += operacionHtml(t);
    else if (tipo === 'abierta') body += esRespuestaCorta(ex.solucion) ? respuestaHtml(t, true) : lineasHtml(lineasDeRespuesta(ex.solucion));
    else if (tipo === 'completar' && !comp?.hueco) body += respuestaHtml(t, false);
  } else {
    const espacio = espacioTipo(tipo);
    body += espacio === 'box' ? '<div class="ficha-espacio box"></div>'
      : espacio === 'lines' ? '<div class="ficha-espacio lines"><div class="ln"></div><div class="ln"></div><div class="ln"></div></div>'
      : espacio === 'line' ? '<div class="ficha-espacio line"></div>'
      : '';
  }
  // «Cuaderno»: todo el ejercicio en una columna; con un dibujo suelto o una figura, ésta a la derecha, enmarcada
  return cuaderno ? `<div class="cq-ej${lado ? ' con-fig' : ''}">${lado}${body}</div>` : body;
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
  /** Ilustración del tema (`loadThemeArt`) para la cabecera; sin ella va el emoji. */
  art?: string;
  /** Con apoyos visuales: los pictogramas como `data:`, por su id (`cargarPictosFicha`). */
  pictos?: Record<string, string>;
  /** Con hilo conductor: los dibujos del catálogo como `data:`, por su id (`cargarIlustracionesFicha`). */
  ilustraciones?: Record<string, string>;
  /** «Cuaderno»: el `@font-face` de su letra (`cargarFuenteCuaderno`); sin él, las letras del sistema. */
  fontCss?: string;
  /** «Cuaderno»: la densidad de la hoja; sin ella, la que fijó el docente en la ficha o, si no, la normal. */
  densidad?: Densidad;
}

/** Posición «al azar» pero fija de cada adorno, para que la vista previa no baile al editar. */
const DECOR_POS = [
  'top:8px;right:118px;font-size:22px;transform:rotate(-12deg)',
  'bottom:6px;right:34px;font-size:18px;transform:rotate(14deg)',
  'top:10px;right:22px;font-size:16px',
  'bottom:8px;right:150px;font-size:14px;transform:rotate(8deg)',
  'top:34px;right:78px;font-size:13px',
];

/** La ficha sin asteriscos sueltos; guardada para no recorrerla en cada repintado de la vista previa. */
const sinAsteriscos = new WeakMap<FichaContent, FichaContent>();
function contenidoLimpio(c: FichaContent): FichaContent {
  let l = sinAsteriscos.get(c);
  if (!l) { l = sinNegritasQueNoSePintan(c); sinAsteriscos.set(c, l); }
  return l;
}

export function buildFichaHtml(f: Ficha, lang: Lang, opts: FichaHtmlOptions = {}): string {
  const t: Tr = (k, vars) => translate(lang, k, vars);
  const c = contenidoLimpio(f.content);
  const actividades = getActividades(c);
  const theme = fichaTheme(c.estilo);
  const classic = theme.id === 'clasico';
  const cuaderno = theme.id === 'cuaderno';
  const historia = theme.historia ? c.historia : undefined;
  const mark = (attr: string) => (opts.preview ? ` ${attr}` : '');
  const formato = c.formato ?? 'ficha';
  const escape = formato === 'escape';
  const visual = !!c.visual && formato !== 'tarjetas';
  const nombre = (id: string) => { const p = pictoDe(id); return p ? p[lang] : ''; };
  const pic: Pic | undefined = visual
    ? (id, cls) => (id && opts.pictos?.[id] ? `<img class="${cls}" src="${opts.pictos[id]}" alt="${esc(nombre(id))}">` : '')
    : undefined;
  // Los dibujos del catálogo: con hilo conductor (cabecera y ejercicios) o con un texto de lectura (junto a sus párrafos)
  const ilus: Ilus | undefined = cuaderno && (c.hilo || c.lectura?.dibujos.length) && !visual
    ? (id, cls) => (id && opts.ilustraciones?.[id] ? `<img class="${cls}" src="${opts.ilustraciones[id]}" alt="">` : '')
    : undefined;
  const facil = c.variante === 'lectura_facil';

  // Los ids de dentro de cada pizza (el rayado) no pueden repetirse en el documento
  let nFraccion = 0;
  const nuevoId = () => `fr${++nFraccion}`;

  const actividadesHtml = actividades.map((act, actIdx) => {
    const color = theme.bloques[actIdx % theme.bloques.length];
    const emoji = act.emoji || theme.iconos[actIdx % theme.iconos.length];
    const label = `${t(escape ? 'Sala' : theme.paso)} ${actIdx + 1}`;
    const header = cuaderno
      ? seccionHtml(actIdx + 1, act.titulo, color, label, '', act.dificultad ? nivelHtml(act.dificultad, color, t) : '')
      : act.titulo
      ? `<div class="act-header" style="background:#${color.bg}">` +
        (classic ? svgPencil('#fff', 14) : `<span class="act-emoji">${esc(emoji)}</span>`) +
        `<span class="act-ttl">${esc(label)}: ${esc(act.titulo)}</span>` +
        (act.dificultad ? `<span class="act-niv" title="${esc(t('Nivel {n} de 3', { n: act.dificultad }))}">${estrellasSvg(act.dificultad, '#fff', 12)}</span>` : '') +
        (classic ? '' : `<span class="act-check" title="${esc(t('Hecho'))}"></span>`) +
        `</div>`
      : '';
    const narr = !classic && act.narrativa ? `<div class="act-narr" style="background:#${color.light}">${esc(act.narrativa)}</div>` : '';
    const ejerciciosHtml = act.ejercicios.map((ex, i) => {
      const id = `${actIdx}-${i}`;
      // En «Cuaderno», un verdadero o falso largo puede partirse entre dos páginas por una fila
      const clases = [opts.selected === id ? 'is-selected' : '', cuaderno && ex.tipo === 'verdadero_falso' ? 'largo' : ''].filter(Boolean).join(' ');
      return `<li${mark(`data-ex="${id}"`)}${clases ? ` class="${clases}"` : ''}>${exerciseBodyHtml(ex, color, t, pic, cuaderno, ilus, lang, nuevoId)}</li>`;
    }).join('');
    // «Cuaderno»: un solo ejercicio no lleva número; con listas de cálculos, letras (A., B.), para no confundirlas con las líneas 1., 2.
    const numeracion = !cuaderno ? '' : act.ejercicios.length === 1 ? ' sin' : act.ejercicios.some(e => e.tipo === 'calculos') ? ' letras' : '';
    const sel = opts.selected === String(actIdx) ? ' is-selected' : '';
    const candado = escape && act.candado ? candadoHtml(act.candado, actIdx, actividades.length, color, t) : '';
    if (pic) {
      // Ficha visual: qué hay que hacer, los pasos numerados con su pictograma
      // y, al lado de los ejercicios, lo que hay que recordar
      const indic = act.indicacion
        ? `<div class="vis-indic">${svgPencil('#' + color.bg, 18)}<span>${esc(act.indicacion)}</span></div>` : '';
      const pasos = act.pasos?.length
        ? `<div class="vis-pasos">${act.pasos.map((p, k) =>
          (k ? `<span class="vis-flecha" style="color:#${color.bg}">➜</span>` : '') +
          `<div class="vis-paso" style="background:#${color.light};border-color:#${color.bg}">` +
          `<span class="vis-n" style="background:#${color.bg}">${k + 1}</span>${pic(p.picto, 'vis-paso-img')}` +
          `<strong>${esc(p.verbo)}</strong>${p.detalle ? `<span>${esc(p.detalle)}</span>` : ''}</div>`).join('')}</div>`
        : '';
      const recuerda = act.recuerda?.length
        ? `<aside class="vis-recuerda"><div class="vis-recuerda-ttl">${esc(t('Recuerda'))}</div>${act.recuerda.map(r =>
          `<div class="vis-rec">${pic(r.picto, 'vis-rec-img')}<span>${esc(r.texto)}</span></div>`).join('')}</aside>`
        : '';
      return `<section class="ficha-actividad${sel}"${mark(`data-act="${actIdx}"`)}>${header}${narr}` +
        `<div class="vis-marco" style="border-color:#${color.bg};--num:#${color.bg}">${indic}${pasos}` +
        `<div class="vis-cuerpo${recuerda ? ' con-recuerda' : ''}"><ol class="ficha-ejercicios">${ejerciciosHtml}</ol>${recuerda}</div>` +
        `</div>${candado}</section>`;
    }
    if (cuaderno) {
      // La hoja de cuaderno: la franja del recuadro (antes de los ejercicios; el «Reto», después) y los ejercicios
      const nota = act.recuadro ? recuadroHtml(act.recuadro, t) : '';
      const antes = act.recuadro?.tipo === 'reto' ? '' : nota;
      const despues = act.recuadro?.tipo === 'reto' ? nota : '';
      return `<section class="ficha-actividad${sel}"${mark(`data-act="${actIdx}"`)} style="--sc:#${color.bg};--num:#${color.bg}">${header}` +
        `<div class="cq-cuerpo" style="--num:#${color.bg}">${antes}<ol class="ficha-ejercicios${numeracion}" style="--num:#${color.bg}">${ejerciciosHtml}</ol>${despues}</div>${candado}</section>`;
    }
    const notaAbajo = act.recuadro ? recuadroHtml(act.recuadro, t) : '';
    return `<section class="ficha-actividad${sel}"${mark(`data-act="${actIdx}"`)}>${header}${narr}` +
      `<ol class="ficha-ejercicios" style="border-color:#${color.bg};--num:#${color.bg}">${ejerciciosHtml}</ol>${notaAbajo ? `<div class="cq-cuerpo" style="margin-top:8px;--num:#${color.bg}">${notaAbajo}</div>` : ''}${candado}</section>`;
  }).join('');

  // La versión adaptada lleva una marca discreta para que el docente las distinga al repartir
  const marca = c.variante ? `<span class="var-mark" title="${esc(t(VARIANTE_LABEL[c.variante]))}">${VARIANTE_MARK[c.variante]}</span>` : '';
  // El área va delante, impresa: quien recoge las fichas sabe de qué asignatura es cada una
  const area = f.request.area?.trim();
  const datos = cuaderno ? '' : (area ? `<strong class="ficha-area">${esc(area)}</strong>&nbsp;&nbsp;&nbsp; ` : '') +
    `${t('Nombre')}: ______________________________&nbsp;&nbsp;&nbsp; ${t('Fecha')}: ____________&nbsp;&nbsp;&nbsp; ${t('Clase')}: __________${marca}`;

  // Con apoyos visuales, la explicación lleva sus tarjetas: un dibujo, el nombre y una frase
  const conceptosHtml = pic && c.conceptos?.length
    ? `<div class="vis-conceptos">${c.conceptos.map(k =>
      `<div class="vis-concepto">${pic(k.picto, 'vis-concepto-img')}<strong>${esc(k.titulo)}</strong><span>${esc(k.texto)}</span></div>`).join('')}</div>`
    : '';
  const explicacionHtml = c.explicacion || conceptosHtml
    ? `<div class="ficha-explicacion"${mark('data-part="explicacion"')}><div class="lbl">${svgLightbulb('#' + theme.color, 15)}${esc(t('Antes de empezar'))}</div>` +
      (c.explicacion ? `<div class="txt">${nl2br(c.explicacion)}</div>` : '') + `${conceptosHtml}</div>`
    : '';
  // La licencia de Mulberry pide la atribución allí donde salen sus pictogramas
  const conMulberry = !!pic && pictosDeFicha(c).some(id => esMulberry(id) && opts.pictos?.[id]);

  let headerHtml: string;
  if (cuaderno) {
    headerHtml = cabeceraHtml({
      titulo: c.titulo || f.title, tema: f.request.tema, area: f.request.area, nivel: f.request.nivel, marca: mark('data-part="titulo"'),
      hilo: visual ? undefined : c.hilo, ilus,
    });
  } else if (classic) {
    const motifKey = pickMotifKey(f.request.tema, f.request.area);
    const motif = MOTIF_COLORS[motifKey];
    const motivoHtml = `<div class="ficha-motivo" style="background:#${motif.bg}">${MOTIF_ICON[motifKey]('#' + motif.accent, 34)}</div>`;
    headerHtml = `<div class="ficha-header"${mark('data-part="titulo"')}><h1>${esc(c.titulo || f.title)}</h1>${motivoHtml}</div>`;
  } else {
    const decor = theme.adornos.map((a, i) => `<span class="deco" style="${DECOR_POS[i % DECOR_POS.length]}">${esc(a)}</span>`).join('');
    headerHtml = `<header class="ficha-banner"${mark('data-part="titulo"')}>${decor}` +
      (opts.art
        ? `<img class="banner-char art" src="${opts.art}" alt="">`
        : `<span class="banner-char">${esc(historia?.emoji || theme.personaje)}</span>`) +
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

  // Lectura fácil en «Cuaderno»: Lexend (hecha para leer con facilidad); se pone aquí porque lo que va en el propio elemento manda sobre la hoja de estilos
  const LETRA_FACIL = `"Lexend", Verdana, Arial, sans-serif`;
  const vars = `--c:#${theme.color};--cd:#${theme.oscuro};--cl:#${theme.claro};--paper:#${theme.papel};` +
    `--font:${cuaderno && facil ? LETRA_FACIL : theme.fuente};--font-t:${cuaderno && facil ? LETRA_FACIL : theme.fuenteTitulo};--r:${theme.radio}px;--bs:${theme.borde}`;

  const body = formato === 'tarjetas'
    ? tarjetasHtml(c.tarjetas ?? [], theme, mark, t)
    : actividadesHtml + cierreHtml;
  const densidad: Densidad = cuaderno && esDensidad(opts.densidad ?? c.densidad) ? (opts.densidad ?? c.densidad)! : 'normal';
  const docCls = `ficha-doc th-${theme.id}${cuaderno && densidad !== 'normal' ? ` d-${densidad}` : ''}${c.variante === 'lectura_facil' ? ' lf' : ''}${visual ? ' vis' : ''}${formato === 'tarjetas' ? ' fmt-tarjetas' : ''}`;

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
    `<title>${esc(c.titulo || f.title)}</title>` +
    `<style>${cuaderno ? opts.fontCss ?? '' : ''}${FICHA_DOC_STANDALONE}${FICHA_DOC_STYLE}${CUADERNO_STYLE}${opts.preview ? FICHA_PREVIEW_STYLE : ''}</style>` +
    `</head><body><article class="${docCls}" style='${vars}'>` +
    headerHtml +
    (formato === 'tarjetas' ? '' : cuaderno ? datosHtml(area, marca, t) : `<div class="ficha-datos">${datos}</div>`) +
    misionHtml +
    explicacionHtml +
    (c.instrucciones
      ? visual
        ? `<div class="ficha-instr vis-instr"${mark('data-part="instrucciones"')}>${svgPencil('#' + theme.oscuro, 20)}<span>${rico(c.instrucciones)}</span></div>`
        : `<p class="ficha-instr"${mark('data-part="instrucciones"')}>${formato === 'tarjetas' ? `<b>${esc(t('Cómo se juega'))}:</b> ` : ''}${rico(c.instrucciones)}</p>`
      : '') +
    (c.lectura && cuaderno ? lecturaHtml(c.lectura, { ilus, marca: mark('data-part="lectura"') }) : '') +
    body +
    (cuaderno && formato === 'ficha' ? autoevaluacionHtml(t) : '') +
    (conMulberry ? `<p class="vis-atrib">${esc(t('Pictogramas:'))} ${esc(ATRIBUCION_MULBERRY)}</p>` : '') +
    `</article></body></html>`;
}

export const VARIANTE_LABEL: Record<FichaVariante, string> = {
  apoyo: 'Versión de apoyo',
  ampliacion: 'Versión de ampliación',
  lectura_facil: 'Lectura fácil',
  visual: 'Versión visual',
};
const VARIANTE_MARK: Record<FichaVariante, string> = { apoyo: '◆', ampliacion: '▲', lectura_facil: '●', visual: '■' };

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

/** Lo que se carga aparte para dibujar la ficha (sin ello, el HTML sale sin dibujos ni letra propia). */
export type RecursosFicha = Pick<FichaHtmlOptions, 'art' | 'pictos' | 'ilustraciones' | 'fontCss'>;

/** Solo la hoja de ejercicios «Cuaderno» tiene densidad: las tarjetas y los demás diseños se quedan como están. */
export function admiteDensidad(c: FichaContent): boolean {
  return fichaTheme(c.estilo).id === 'cuaderno' && (c.formato ?? 'ficha') !== 'tarjetas';
}

/**
 * El compositor sobre una ficha: la mide con cada densidad (tal como se imprime) y dice cuál la deja mejor.
 * `null` si el diseño no admite densidad o no se pudo medir; entonces la hoja va con la densidad normal.
 */
export async function componerFicha(f: Ficha, lang: Lang, recursos: RecursosFicha): Promise<Composicion | null> {
  if (!admiteDensidad(f.content)) return null;
  return componerHoja(buildFichaHtml(f, lang, { ...recursos, densidad: 'normal' }));
}

/** La densidad con la que sale la ficha: la que fijó el docente o, si no, la que elige el compositor. */
export async function densidadDeFicha(f: Ficha, lang: Lang, recursos: RecursosFicha): Promise<Densidad | undefined> {
  if (!admiteDensidad(f.content)) return undefined;
  if (esDensidad(f.content.densidad)) return f.content.densidad;
  return (await componerFicha(f, lang, recursos))?.densidad;
}

export async function saveFichaPdf(f: Ficha, lang: Lang) {
  const docs = window.electronAPI?.docs;
  if (!docs) return { error: 'not-desktop' as const };
  const id = fichaTheme(f.content.estilo).id;
  const [art, pictos, ilustraciones, fontCss] = await Promise.all([
    loadThemeArt(id), cargarPictosFicha(f.content), cargarIlustracionesFicha(f.content), id === 'cuaderno' ? cargarFuenteCuaderno(f.content.variante === 'lectura_facil') : Promise.resolve(''),
  ]);
  const recursos: RecursosFicha = { art: art?.dataUrl, pictos, ilustraciones, fontCss };
  const densidad = await densidadDeFicha(f, lang, recursos);
  const html = buildFichaHtml(f, lang, { ...recursos, densidad });
  const res = await docs.savePdf(html, fileBase(f) + '.pdf', { landscape: false, carpeta: CARPETAS.fichas });
  if (!res.canceled && !res.error && res.path) docs.reveal(res.path);
  return res;
}

const FICHA_DOC_STYLE = `
.ficha-doc { max-width: 100%; margin: 0 auto; padding: 4mm 6mm; background: #fff; color: #1e293b; font-family: var(--font); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.ficha-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 2px; }
.ficha-header h1 { font-size: 18px; font-weight: 800; margin: 0; letter-spacing: -0.01em; }
.ficha-motivo { width: 76px; height: 76px; border-radius: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.ficha-datos { font-size: 12.5px; color: #334155; margin: 10px 0 14px; padding-bottom: 10px; border-bottom: 1px solid #cbd5e1; }
.ficha-area { color: #0f172a; }

.ficha-banner { position: relative; overflow: hidden; display: flex; align-items: center; gap: 14px; padding: 14px 18px; border-radius: var(--r); background: linear-gradient(135deg, var(--c), var(--cd)); color: #fff; min-height: 84px; }
.ficha-banner .deco { position: absolute; opacity: .55; line-height: 1; }
.ficha-banner .banner-char { font-size: 46px; line-height: 1; flex-shrink: 0; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(255,255,255,.18); border: 2px solid rgba(255,255,255,.45); }
.ficha-banner .banner-char.art { width: 74px; height: 74px; border-radius: 14px; object-fit: cover; background: #fff; }
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
.ficha-actividad .act-niv { display: inline-flex; align-items: center; gap: 1px; flex-shrink: 0; }
.ficha-actividad .act-niv svg { display: block; }
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

.ficha-preguntas { margin-top: 6px; } .ficha-preguntas .pq { font-size: 12.5px; margin-top: 6px; } .ficha-ordenar { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
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

/* Apoyos visuales: letra grande y clara, pasos numerados con su pictograma, dibujos para contar */
.vis { font-family: Verdana, Arial, sans-serif !important; }
.vis .ficha-enunciado, .vis .ficha-explicacion .txt { font-size: 14.5px; line-height: 1.7; }
.vis .ficha-opciones li, .vis .vf-row, .vis .ord-item, .vis .ficha-relacionar .item, .vis .cw-clue { font-size: 14px; }
.vis-instr { display: flex; align-items: center; gap: 10px; font-style: normal; font-size: 14px; color: #1e293b; background: #fef3c7; border: 1.5px solid #f59e0b; border-radius: 10px; padding: 10px 14px; }
.vis-instr svg, .vis-indic svg { flex-shrink: 0; }
.vis-conceptos { display: grid; grid-template-columns: repeat(auto-fit, minmax(34mm, 1fr)); gap: 8px; margin-top: 10px; }
.vis-concepto { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; background: #fff; border: 1.25px solid var(--c); border-radius: 10px; padding: 8px 8px 10px; }
.vis-concepto-img { width: 64px; height: 64px; object-fit: contain; }
.vis-concepto strong { font-size: 13px; color: var(--cd); }
.vis-concepto span { font-size: 12.5px; line-height: 1.45; color: #1e293b; }
.vis-marco { border: 1.5px var(--bs); border-top: none; border-radius: 0 0 var(--r) var(--r); padding: 12px 14px 4px; }
.ficha-actividad:not(:has(.act-header)) .vis-marco { border-top: 1.5px var(--bs); border-radius: var(--r); }
.vis-marco .ficha-ejercicios { border: none; padding: 6px 0 0; border-radius: 0; }
.vis-indic { display: flex; align-items: center; gap: 8px; font-size: 13.5px; line-height: 1.5; background: #fef9c3; border-radius: 8px; padding: 8px 12px; margin-bottom: 10px; }
.vis-pasos { display: flex; align-items: stretch; gap: 4px; margin-bottom: 10px; }
.vis-paso { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 2px; border: 1.25px solid; border-radius: 10px; padding: 8px 6px 8px; break-inside: avoid; }
.vis-n { position: absolute; top: 5px; left: 5px; width: 22px; height: 22px; border-radius: 50%; color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.vis-paso-img { width: 54px; height: 54px; object-fit: contain; }
.vis-paso strong { font-size: 15px; color: #0f172a; }
.vis-paso span { font-size: 11px; line-height: 1.3; color: #334155; }
.vis-flecha { align-self: center; font-size: 18px; font-weight: 800; flex-shrink: 0; }
.vis-cuerpo.con-recuerda { display: grid; grid-template-columns: 1fr 52mm; gap: 12px; align-items: start; }
.vis-recuerda { background: #ecfdf5; border: 1.25px solid #34d399; border-radius: 10px; padding: 8px 10px; margin: 6px 0 12px; break-inside: avoid; }
.vis-recuerda-ttl { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #047857; margin-bottom: 6px; }
.vis-rec { display: flex; align-items: center; gap: 8px; font-size: 12.5px; line-height: 1.4; margin-bottom: 6px; }
.vis-rec-img { width: 38px; height: 38px; object-fit: contain; flex-shrink: 0; }
.vis-consigna { width: 28px; height: 28px; object-fit: contain; vertical-align: middle; margin: -4px 6px 0 2px; }
.vis-imagenes { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 8px 0 4px; padding: 6px 8px; border: 1px dashed #cbd5e1; border-radius: 10px; }
.vis-img { width: 46px; height: 46px; object-fit: contain; }
.vis-imagenes.muchos .vis-img { width: 34px; height: 34px; }
.ficha-tabla .vis-col { width: 40px; padding: 4px; }
.vis-fila { width: 28px; height: 28px; object-fit: contain; display: block; margin: 0 auto; }
.vis-atrib { font-size: 8.5px; color: #64748b; margin: 10px 0 0; }

.lf:not(.th-cuaderno) { font-family: Verdana, Arial, sans-serif !important; }
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

/**
 * Un pictograma (SVG en `data:`) como PNG para Word, que no admite SVG. Se
 * pinta en un `<canvas>`; si no se puede (sin DOM, o tarda demasiado), el
 * documento sale sin ese dibujo, con su texto.
 */
async function svgDatoAPng(url: string, px: number): Promise<Uint8Array | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      const timer = setTimeout(() => reject(new Error('timeout')), 4000);
      el.onload = () => { clearTimeout(timer); resolve(el); };
      el.onerror = () => { clearTimeout(timer); reject(new Error('svg')); };
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const k = Math.min(px / (img.naturalWidth || px), px / (img.naturalHeight || px));
    const w = (img.naturalWidth || px) * k, h = (img.naturalHeight || px) * k;
    ctx.drawImage(img, (px - w) / 2, (px - h) / 2, w, h);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** Los pictogramas de la ficha en PNG, por su id. */
async function pictosPng(c: FichaContent): Promise<Record<string, Uint8Array>> {
  const datos = await cargarPictosFicha(c);
  const out: Record<string, Uint8Array> = {};
  await Promise.all(Object.entries(datos).map(async ([id, url]) => {
    const png = await svgDatoAPng(url, 160);
    if (png) out[id] = png;
  }));
  return out;
}

/** Los dibujos del catálogo de la ficha (hilo conductor) en PNG, por su id: Word no admite WebP. */
async function ilustracionesPng(c: FichaContent): Promise<Record<string, Uint8Array>> {
  const datos = await cargarIlustracionesFicha(c);
  const out: Record<string, Uint8Array> = {};
  await Promise.all(Object.entries(datos).map(async ([id, url]) => {
    const png = await svgDatoAPng(url, 192);
    if (png) out[id] = png;
  }));
  return out;
}

type Imgs = Record<string, Uint8Array>;
const pictoRun = (imgs: Imgs | undefined, id: string | undefined, size: number) =>
  id && imgs?.[id] ? new ImageRun({ type: 'png', data: imgs[id], transformation: { width: size, height: size } }) : null;

const EMOJI_FONT = 'Segoe UI Emoji';
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER };
const spacer = (after = 160) => new Paragraph({ text: '', spacing: { after } });

/** Un texto con negritas (**así**) como trozos de Word. Con `base`, el formato de todos (color, tamaño…). */
function runsRicos(texto: string, base: { color?: string; size?: number; font?: string; italics?: boolean } = {}): TextRun[] {
  return partirNegritas(texto).map(p => new TextRun({ text: p.texto, bold: p.negrita || undefined, ...base }));
}

const lineaDocx = () => new Paragraph({ text: '', spacing: { after: 260 }, border: { bottom: { style: 'single', size: 4, color: '94A3B8', space: 1 } } });

/**
 * El texto de una ficha de lectura en Word: etiquetas y pista arriba, y el texto en una tabla con fondo crema, un párrafo
 * por fila y, en las filas que tienen dibujo, este en una segunda columna a la derecha. Un poema, un verso por línea.
 */
function lecturaDocx(children: (Paragraph | Table)[], l: FichaLectura, ilus: Imgs | undefined, color: string, facil: boolean) {
  const size = facil ? 30 : 25;
  const letra = facil ? 'Verdana' : 'Georgia';
  if (l.destrezas?.length || l.pista) {
    children.push(new Paragraph({
      children: [
        ...(l.destrezas ?? []).flatMap(d => [new TextRun({ text: ` ${d} `, bold: true, color, size: 19, shading: { type: 'clear', fill: 'EAF5FE', color: 'auto' } }), new TextRun({ text: '  ' })]),
        ...(l.pista ? [new TextRun({ text: l.pista, italics: !facil, bold: true, color, size: 20 })] : []),
      ],
      spacing: { after: 100 },
      keepNext: true,
    }));
  }
  const dibujo = new Map(l.dibujos.map(d => [d.parrafo, d.ilustracion]));
  let verso = 0;
  const filas = l.parrafos.map((p, i) => {
    const img = pictoRun(ilus, dibujo.get(i), facil ? 96 : 84);
    const cuerpo = l.genero === 'poema'
      ? p.split('\n').filter(v => v.trim()).map(v => {
        verso++;
        return new Paragraph({
          children: [
            ...(verso === 1 || verso % 5 === 0 ? [new TextRun({ text: `${verso}   `, bold: true, color, size: 18 })] : [new TextRun({ text: '      ' })]),
            ...runsRicos(v, { size, font: letra }),
          ],
        });
      })
      : [new Paragraph({
        children: [new TextRun({ text: `${i + 1}  `, bold: true, color, size: 18 }), ...runsRicos(p, { size, font: letra })],
        spacing: { after: 40, line: facil ? 400 : 330 },
      })];
    return new TableRow({
      cantSplit: true,
      children: [
        new TableCell({ width: { size: img ? 78 : 100, type: WidthType.PERCENTAGE }, columnSpan: img ? 1 : 2, margins: { top: 60, bottom: 60, left: 160, right: 120 }, children: cuerpo }),
        ...(img ? [new TableCell({ width: { size: 22, type: WidthType.PERCENTAGE }, margins: { top: 60, bottom: 60, left: 60, right: 120 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [img] })] })] : []),
      ],
    });
  });
  const B = { style: BorderStyle.SINGLE, size: 6, color: 'EADFBF' };
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [78, 22].map(n => Math.round(n * 90)),
    borders: { top: B, bottom: B, left: B, right: B, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
    rows: filas,
  }));
  children.push(spacer(200));
}

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

/** Una caja vacía para escribir la respuesta (el diseño «Cuaderno»): una tabla de una celda. */
function cajaDocx(color: string, ancho = 100, alto = 480): Table {
  const B = { style: BorderStyle.SINGLE, size: 8, color };
  return new Table({
    width: { size: ancho, type: WidthType.PERCENTAGE },
    borders: { top: B, bottom: B, left: B, right: B, insideHorizontal: B, insideVertical: B },
    rows: [new TableRow({ height: { value: alto, rule: 'atLeast' }, children: [new TableCell({ children: [new Paragraph({ text: '' })] })] })],
  });
}

/** «Contar» en Word: una fila por grupo (los dibujos y, al lado, su casilla) y, si se pide, la del total. */
function contarDocx(children: (Paragraph | Table)[], ex: FichaExercise, ilus: Imgs, t: Tr) {
  const grupos = (ex.dibujos ?? []).filter(d => d.ilustracion);
  const px = Math.max(0, ...grupos.map(g => g.cantidad ?? 1)) <= 5 ? 44 : 34;
  const casilla = (texto = '') => new TableCell({
    width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: 'center',
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: texto ? `${texto}  =` : '=', bold: true, color: '64748B' })] })],
  });
  const filas = grupos.map(g => new TableRow({
    height: { value: 760, rule: 'atLeast' },
    children: [
      new TableCell({ width: { size: 80, type: WidthType.PERCENTAGE }, verticalAlign: 'center', margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({
        children: Array.from({ length: Math.max(1, Math.min(10, g.cantidad ?? 1)) }, () => pictoRun(ilus, g.ilustracion, px)).filter((r): r is ImageRun => !!r),
      })] }),
      casilla(),
    ],
  }));
  if (ex.total && grupos.length > 1) {
    filas.push(new TableRow({
      height: { value: 600, rule: 'atLeast' },
      children: [
        new TableCell({ width: { size: 80, type: WidthType.PERCENTAGE }, verticalAlign: 'center', children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: t('Total').toUpperCase(), bold: true, color: '64748B' })] })] }),
        casilla(),
      ],
    }));
  }
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: CELL_BORDERS, rows: filas }));
  children.push(spacer(200));
}

/** Los dibujos de una lista en filas de `porFila`, cada celda con el dibujo y lo que `debajo` ponga bajo él. */
function rejillaDibujosDocx(
  children: (Paragraph | Table)[], ids: string[], ilus: Imgs, porFila: number, px: number,
  debajo: (i: number) => Paragraph[],
) {
  const filas: TableRow[] = [];
  for (let k = 0; k < ids.length; k += porFila) {
    filas.push(new TableRow({
      cantSplit: true,
      children: Array.from({ length: porFila }, (_, c) => {
        const i = k + c;
        if (i >= ids.length) return new TableCell({ children: [new Paragraph({ text: '' })] });
        return new TableCell({
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: pictoRun(ilus, ids[i], px) ? [pictoRun(ilus, ids[i], px)!] : [] }), ...debajo(i)],
        });
      }),
    }));
  }
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: CELL_BORDERS, rows: filas }));
  children.push(spacer(200));
}

/** «Etiquetar» en Word: los dibujos en una tabla con su línea debajo y, con banco, las palabras encima. */
function etiquetarDocx(children: (Paragraph | Table)[], ex: FichaExercise, ilus: Imgs, color: string, lang: Lang) {
  const ids = (ex.dibujos ?? []).map(d => d.ilustracion).filter(Boolean);
  if (ex.banco) {
    const palabras = ids.map(id => nombreIlustracion(id, lang) ?? '').filter(Boolean).sort((a, b) => a.localeCompare(b, lang));
    children.push(new Paragraph({ children: palabras.map((p, k) => new TextRun({ text: (k ? '    ' : '') + `[ ${p} ]`, bold: true, color })), spacing: { after: 120 } }));
  }
  rejillaDibujosDocx(children, ids, ilus, ids.length <= 4 ? Math.max(2, ids.length) : 3, 70,
    () => [new Paragraph({ text: '', spacing: { before: 120 }, border: { bottom: { style: 'single', size: 6, color: '94A3B8', space: 1 } } })]);
}

/** «Clasificar» en Word: los dibujos numerados con su nombre y, debajo, una tabla con un grupo por columna. */
function clasificarDocx(children: (Paragraph | Table)[], ex: FichaExercise, ilus: Imgs, color: string, lang: Lang) {
  const banco = bancoClasificar(ex.categorias);
  rejillaDibujosDocx(children, banco.map(d => d.id), ilus, Math.min(5, Math.max(2, banco.length)), 52,
    i => [new Paragraph({ alignment: AlignmentType.CENTER, children: [
      new TextRun({ text: `${i + 1}. `, bold: true, color }), new TextRun({ text: nombreIlustracion(banco[i].id, lang) ?? '', size: 18 }),
    ] })]);
  const cats = ex.categorias ?? [];
  if (!cats.length) return;
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: CELL_BORDERS,
    rows: [
      new TableRow({ children: cats.map(c => new TableCell({ shading: { fill: color }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.nombre.toUpperCase(), bold: true, color: 'FFFFFF', size: 20 })] })] })) }),
      new TableRow({ height: { value: 1100, rule: 'atLeast' }, children: cats.map(() => new TableCell({ children: [new Paragraph({ text: '' })] })) }),
    ],
  }));
  children.push(spacer(200));
}

/* ── Fracciones (pizzas y tartas) en Word ── */

const claveFraccion = (f: FraccionDibujo, cogidos: CogidosFraccion | undefined, vacia: boolean) =>
  `${f.objeto ?? 'pizza'}-${f.partes}-${f.tomadas}-${cogidos ?? 'ambos'}-${vacia ? 'v' : 'n'}`;

/** Las pizzas y tartas de la ficha en PNG, por su clave: Word no admite SVG. Sin DOM (o si falla), la ficha sale sin ellas. */
async function fraccionesPng(c: FichaContent): Promise<Imgs> {
  const pendientes = new Map<string, () => Promise<Uint8Array | null>>();
  for (const act of getActividades(c)) {
    for (const ex of act.ejercicios) {
      const vacia = ex.tipo === 'fracciones' && ex.modo === 'colorear';
      for (const f of ex.fracciones ?? []) {
        const clave = claveFraccion(f, ex.cogidos, vacia);
        if (!pendientes.has(clave)) pendientes.set(clave, () => svgDatoAPng(fraccionSvgDato(f, { cogidos: ex.cogidos, vacia, uid: 'w' }), 240));
      }
    }
  }
  const out: Imgs = {};
  await Promise.all([...pendientes].map(async ([clave, hacer]) => {
    const png = await hacer();
    if (png) out[clave] = png;
  }));
  return out;
}

const fraccionRun = (fp: Imgs | undefined, f: FraccionDibujo, ex: FichaExercise, vacia: boolean, px: number) =>
  pictoRun(fp, claveFraccion(f, ex.cogidos, vacia), px);

/** «Fracciones» en Word: las pizzas con su letra y su espacio (la fracción con su raya, el decimal), para colorear, o para unir en dos columnas. */
function fraccionesDocx(children: (Paragraph | Table)[], ex: FichaExercise, fp: Imgs | undefined, color: string, lang: Lang) {
  const fr = ex.fracciones ?? [];
  if (!fr.length) return;
  const modo = ex.modo ?? 'leer';
  const decimal = !!ex.decimal && fr.every(tieneDecimalExacto);
  const letra = (i: number) => new TextRun({ text: letraFraccion(i), bold: true, color });
  if (modo === 'unir' && fr.length >= 2) {
    const orden = ordenUnir(fr);
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: CELL_BORDERS,
      rows: fr.map((f, i) => new TableRow({
        cantSplit: true,
        children: [
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({
            children: [letra(i), new TextRun({ text: '   ' }), ...(fraccionRun(fp, f, ex, false, 70) ? [fraccionRun(fp, f, ex, false, 70)!] : [])],
          })] }),
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: 'center', children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `${i + 1}.  `, bold: true, color }), new TextRun({ text: valorUnir(fr[orden[i]], decimal, lang), size: 26 })],
          })] }),
        ],
      })),
    }));
    children.push(spacer(200));
    return;
  }
  const filas = Math.min(fr.length, 4);
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: CELL_BORDERS,
    rows: [new TableRow({
      cantSplit: true,
      children: fr.slice(0, filas).map((f, i) => new TableCell({
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [letra(i)] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: fraccionRun(fp, f, ex, modo === 'colorear', 96) ? [fraccionRun(fp, f, ex, modo === 'colorear', 96)!] : [] }),
          ...(modo === 'colorear'
            ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: fraccionTexto(f), bold: true, color, size: 30 })] })]
            : [
              // La fracción para escribir: dos huecos con la raya en medio
              new Paragraph({ alignment: AlignmentType.CENTER, text: '          ', spacing: { before: 120 }, border: { bottom: { style: 'single', size: 8, color: '1E293B', space: 1 } } }),
              new Paragraph({ alignment: AlignmentType.CENTER, text: '          ' }),
              ...(decimal ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '= ____________', color: '64748B' })] })] : []),
            ]),
        ],
      })),
    })],
  }));
  children.push(spacer(200));
}

/** Las pizzas de las que habla el enunciado de otro tipo de ejercicio, en una línea debajo de él. */
function fraccionesAmbienteDocx(children: (Paragraph | Table)[], ex: FichaExercise, fp: Imgs | undefined) {
  const runs = (ex.fracciones ?? []).flatMap((f, k) => {
    const r = fraccionRun(fp, f, ex, false, 84);
    return r ? (k ? [new TextRun({ text: '      ' }), r] : [r]) : [];
  });
  if (runs.length) children.push(new Paragraph({ children: runs, spacing: { after: 100 } }));
}

/** Cómo se rotula un ejercicio: «1. », «A. » o nada (un solo ejercicio en el bloque del diseño «Cuaderno»). */
type Marcador = string;

async function pushExerciseDocx(children: (Paragraph | Table)[], ex: FichaExercise, i: number, colorHexNoHash: string, t: Tr, imgs?: Imgs, marcador?: Marcador, cuaderno = false, ilus?: Imgs, lang: Lang = 'es', fp?: Imgs) {
  const letra = (n: number) => String.fromCharCode(97 + n);
  const consigna = pictoRun(imgs, ex.consigna, 26);

  // «Completar» con un recuadro de palabras: va primero, y la consigna después
  if (ex.tipo === 'completar' && ex.bancoPalabras?.length) {
    children.push(new Paragraph({
      children: ex.bancoPalabras.flatMap((w, k) => [new TextRun({ text: (k ? '   ' : '') + ` ${w} `, bold: true, color: colorHexNoHash, shading: { type: 'clear', fill: 'F1F5F9', color: 'auto' } })]),
      spacing: { before: i === 0 ? 0 : 220, after: 80 },
    }));
  }
  children.push(new Paragraph({
    children: [
      ...(marcador === '' ? [] : [new TextRun({ text: marcador ?? `${i + 1}. `, bold: true, color: colorHexNoHash })]),
      ...(consigna ? [consigna, new TextRun({ text: '  ' })] : []),
      ...runsRicos(ex.enunciado),
    ],
    spacing: { before: i === 0 || (ex.tipo === 'completar' && ex.bancoPalabras?.length) ? 0 : 220, after: 60 },
  }));

  // Ficha visual: lo que hay que contar o reconocer, debajo del enunciado
  const dibujos = imgs ? dibujosEnOrden(ex.imagenes).map(id => pictoRun(imgs, id, 40)).filter((r): r is ImageRun => !!r) : [];
  if (dibujos.length) {
    children.push(new Paragraph({ children: dibujos.flatMap((r, k) => (k ? [new TextRun({ text: '  ' }), r] : [r])), spacing: { after: 100 } }));
  }

  // Los tipos con dibujos propios (contar, etiquetar, clasificar, y los de relacionar y tablas) los pintan a su manera
  const dibujosPropios = ex.tipo === 'relacionar' || ex.tipo === 'tabla_rellenar' || esTipoConDibujos(ex.tipo);
  const conDibujos = !!ilus && cuaderno;
  const tipo: FichaExerciseType = !conDibujos && esTipoConDibujos(ex.tipo) ? 'abierta' : ex.tipo;

  // Hilo conductor: los dibujos del catálogo, cada uno repetido las veces que dice su cantidad
  if (ilus && !dibujosPropios && ex.dibujos?.length) {
    const total = ex.dibujos.reduce((n, d) => n + Math.max(1, d.cantidad ?? 1), 0);
    const px = total <= 1 ? 72 : total <= 4 ? 54 : total <= 8 ? 42 : 34;
    const runs = ex.dibujos.flatMap((d, g) => {
      const copias = Array.from({ length: Math.max(1, d.cantidad ?? 1) }, () => pictoRun(ilus, d.ilustracion, px)).filter((r): r is ImageRun => !!r);
      return copias.flatMap((r, k) => (g > 0 && k === 0 ? [new TextRun({ text: '      ' }), r] : [r]));
    });
    if (runs.length) children.push(new Paragraph({ children: runs, spacing: { after: 100 } }));
  }

  const figureImage = await figureToImageRun(ex, colorHexNoHash);
  if (figureImage) {
    children.push(new Paragraph({ children: [figureImage], spacing: { after: 100 } }));
  }

  if (ex.tipo === 'fracciones' && ex.fracciones?.length) { fraccionesDocx(children, ex, fp, colorHexNoHash, lang); return; }
  if (ex.fracciones?.length) fraccionesAmbienteDocx(children, ex, fp);

  if (conDibujos && tipo === 'contar') { contarDocx(children, ex, ilus!, t); return; }
  if (conDibujos && tipo === 'etiquetar') { etiquetarDocx(children, ex, ilus!, colorHexNoHash, lang); return; }
  if (conDibujos && tipo === 'clasificar') { clasificarDocx(children, ex, ilus!, colorHexNoHash, lang); return; }

  if (ex.tipo === 'opcion_multiple' && ex.opciones?.length) {
    ex.opciones.forEach((o, j) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `${letra(j)}) `, bold: true, color: '64748B' }), ...runsRicos(o)],
        indent: { left: 340 },
        spacing: { after: 40 },
      }));
    });
    return;
  }

  if (ex.tipo === 'tabla_rellenar' && ex.columnas?.length && ex.filas?.length) {
    const dibFilas = conDibujos && ex.dibujos?.length === ex.filas.length ? ex.dibujos : null;
    const conDibujo = dibFilas ? true : !!imgs && !!ex.pictosFilas?.some(id => id && imgs[id]);
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: CELL_BORDERS,
      rows: [
        new TableRow({
          children: [
            ...(conDibujo ? [new TableCell({ shading: { fill: 'E0F2FE' }, children: [new Paragraph({ text: '' })] })] : []),
            ...ex.columnas.map(col => new TableCell({
              shading: { fill: 'E0F2FE' },
              children: [new Paragraph({ children: [new TextRun({ text: col, bold: true, color: '0369A1', size: 18 })] })],
            })),
          ],
        }),
        ...ex.filas.map((fila, fi) => {
          const dibujo = dibFilas ? pictoRun(ilus, dibFilas[fi].ilustracion, 40) : conDibujo ? pictoRun(imgs, ex.pictosFilas?.[fi], 24) : null;
          return new TableRow({
            children: [
              ...(conDibujo ? [new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: dibujo ? [dibujo] : [] })] })] : []),
              ...fila.map(celda => new TableCell({
                shading: celda ? undefined : { fill: 'F8FAFC' },
                children: [new Paragraph({ text: celda || ' ' })],
              })),
            ],
          });
        }),
      ],
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
    return;
  }

  if (ex.tipo === 'relacionar' && ex.izquierda?.length && ex.derecha?.length) {
    const izquierda = ex.izquierda;
    const derecha = ex.derecha;
    const n = Math.max(izquierda.length, derecha.length);
    const dibIzq = conDibujos && ex.dibujos?.length === izquierda.length ? ex.dibujos : null;
    const rows = Array.from({ length: n }, (_, r) => new TableRow({
      children: [
        new TableCell({ margins: { top: 100, bottom: 100, left: 120, right: 120 }, children: [new Paragraph({
          children: [
            ...(dibIzq && pictoRun(ilus, dibIzq[r]?.ilustracion, 44) ? [pictoRun(ilus, dibIzq[r].ilustracion, 44)!, new TextRun({ text: '   ' })] : []),
            new TextRun({ text: izquierda[r] ? `${r + 1}. ${quitarNegritas(izquierda[r])}` : '' }),
          ],
        })] }),
        new TableCell({ margins: { top: 100, bottom: 100, left: 120, right: 120 }, children: [new Paragraph({ text: derecha[r] ? `${letra(r).toUpperCase()}. ${quitarNegritas(derecha[r])}` : '' })] }),
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
          new TableCell({ width: { size: 84, type: WidthType.PERCENTAGE }, margins: { top: 70, bottom: 70, left: 120, right: 120 }, children: [new Paragraph({ children: runsRicos(a) })] }),
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

  if (ex.tipo === 'calculos' && ex.lineas?.length) {
    const caja = ex.respuesta === 'caja';
    ex.lineas.forEach((l, k) => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${k + 1}.  `, bold: true, color: colorHexNoHash }),
          new TextRun({ text: `${l.replace(/[\s=_…]+$/u, '')}   =   ` }),
          new TextRun({ text: caja ? '[                    ]' : '______________________________', color: caja ? colorHexNoHash : '1E293B' }),
        ],
        indent: { left: 200 },
        spacing: { after: 100 },
      }));
    });
    children.push(spacer(100));
    return;
  }

  const serie = cuaderno ? serieDe(ex) : null;
  if (serie) {
    children.push(new Paragraph({ children: [new TextRun({ text: serie.join('   –   ') })], spacing: { after: 80 } }));
    children.push(cajaDocx(colorHexNoHash));
    children.push(spacer(140));
    return;
  }

  if (ex.tipo === 'ordenar' && ex.elementos?.length) {
    for (const e of ex.elementos) {
      children.push(new Paragraph({
        children: [new TextRun({ text: '(     )  ', bold: true, color: colorHexNoHash }), ...runsRicos(e)],
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

  // Comprensión lectora: preguntas con su línea, un recuadro para dibujar y lo que se escribe tras buscar en el texto
  if (ex.tipo === 'contestar' && ex.preguntas?.length) {
    const lineas = (ex.solucion ?? '').length / ex.preguntas.length > 60 ? 2 : 1;
    for (const q of ex.preguntas) {
      children.push(new Paragraph({ children: runsRicos(q), indent: { left: 340 }, spacing: { before: 100, after: 20 } }));
      for (let k = 0; k < lineas; k++) children.push(lineaDocx());
    }
    return;
  }
  if (ex.tipo === 'dibujar') {
    children.push(cajaDocx(colorHexNoHash, 100, 2600));
    for (let k = 0; k < Math.min(2, ex.lineasRespuesta ?? 0); k++) children.push(lineaDocx());
    children.push(spacer(120));
    return;
  }
  if (ex.tipo === 'en_texto') {
    for (let k = 0; k < Math.min(3, ex.lineasRespuesta ?? 0); k++) children.push(lineaDocx());
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

  if (cuaderno && (tipo === 'abierta' || tipo === 'problema')) {
    // El espacio sigue a lo que se espera, como en el PDF: una caja para una palabra o un número, las líneas justas para una frase, cuadrícula y respuesta para un problema
    if (tipo === 'problema') {
      children.push(cajaDocx(colorHexNoHash, 100, 1400));
      children.push(new Paragraph({ children: [new TextRun({ text: `${t('Respuesta')}: `, bold: true, color: colorHexNoHash }), new TextRun({ text: '_'.repeat(40) })], spacing: { before: 120, after: 160 } }));
    } else if (esRespuestaCorta(ex.solucion)) {
      children.push(new Paragraph({ children: [new TextRun({ text: `${t('Respuesta')}: `, bold: true, color: colorHexNoHash }), new TextRun({ text: '[                    ]', color: colorHexNoHash })], spacing: { before: 60, after: 160 } }));
    } else {
      for (let k = 0; k < lineasDeRespuesta(ex.solucion); k++) {
        children.push(new Paragraph({ text: '', spacing: { after: 260 }, border: { bottom: { style: 'single', size: 4, color: '94A3B8', space: 1 } } }));
      }
    }
    return;
  }

  const espacio = espacioTipo(tipo);
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

/** Ficha visual en Word: la indicación del bloque y sus pasos, una casilla por paso con su pictograma. */
function pushVisualActivityDocx(children: (Paragraph | Table)[], act: FichaActivity, color: { bg: string; light: string }, imgs?: Imgs) {
  if (act.indicacion) {
    children.push(new Paragraph({ children: [new TextRun({ text: `✏  ${act.indicacion}` })], shading: { fill: 'FEF9C3' }, spacing: { after: 120 } }));
  }
  if (!act.pasos?.length) return;
  const B = { style: BorderStyle.SINGLE, size: 6, color: color.bg };
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: B, bottom: B, left: B, right: B, insideHorizontal: B, insideVertical: B },
    rows: [new TableRow({
      cantSplit: true,
      children: act.pasos.map((p, k) => {
        const dibujo = pictoRun(imgs, p.picto, 44);
        return new TableCell({
          shading: { fill: color.light },
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
          children: [
            new Paragraph({ children: [new TextRun({ text: `${k + 1}`, bold: true, color: color.bg, size: 22 })] }),
            ...(dibujo ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [dibujo] })] : []),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: p.verbo, bold: true, size: 26 })] }),
            ...(p.detalle ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: p.detalle, size: 18, color: '334155' })] })] : []),
          ],
        });
      }),
    })],
  }));
  children.push(spacer(140));
}

/** Ficha visual en Word: el recuadro «Recuerda» al final del bloque. */
function pushRecuerdaDocx(children: (Paragraph | Table)[], act: FichaActivity, imgs: Imgs | undefined, t: Tr) {
  const B = { style: BorderStyle.SINGLE, size: 6, color: '34D399' };
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: B, bottom: B, left: B, right: B, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
    rows: [new TableRow({
      children: [new TableCell({
        shading: { fill: 'ECFDF5' },
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        children: [
          new Paragraph({ children: [new TextRun({ text: t('Recuerda').toUpperCase(), bold: true, color: '047857', size: 18 })], spacing: { after: 60 } }),
          ...(act.recuerda ?? []).map(r => {
            const dibujo = pictoRun(imgs, r.picto, 30);
            return new Paragraph({ children: [...(dibujo ? [dibujo, new TextRun({ text: '  ' })] : []), new TextRun({ text: r.texto })], spacing: { after: 60 } });
          }),
        ],
      })],
    })],
  }));
  children.push(spacer(120));
}

/** El recuadro de un bloque («Cuaderno») en Word: una caja con borde discontinuo, debajo de los ejercicios. */
function pushRecuadroDocx(children: (Paragraph | Table)[], r: FichaRecuadro, t: Tr) {
  const color = r.tipo === 'reto' ? 'E0900A' : '1E88D8';
  const B = { style: BorderStyle.DASHED, size: 8, color };
  const { titulo, lineas, respuesta } = recuadroLineas(r, t);
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: B, bottom: B, left: B, right: B, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
    rows: [new TableRow({
      cantSplit: true,
      children: [new TableCell({
        shading: { fill: r.tipo === 'reto' ? 'FFF8E6' : 'EAF5FE' },
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
        children: [
          new Paragraph({ children: [new TextRun({ text: titulo.toUpperCase(), bold: true, color, size: 22 })], spacing: { after: 60 } }),
          ...lineas.map(l => new Paragraph({ children: [new TextRun({ text: l, size: 20 })], spacing: { after: 30 } })),
          ...(respuesta ? [new Paragraph({ children: [new TextRun({ text: `${t('Respuesta')}: ______________________________`, bold: true, color, size: 20 })], spacing: { before: 60 } })] : []),
        ],
      })],
    })],
  }));
  children.push(spacer(120));
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
  const c = contenidoLimpio(f.content);
  const actividades = getActividades(c);
  const theme = fichaTheme(c.estilo);
  const classic = theme.id === 'clasico';
  const cuaderno = theme.id === 'cuaderno';
  const historia = theme.historia ? c.historia : undefined;

  // Sin imagen de IA (los modelos de imagen de Gemini no están en el nivel
  // gratuito), el título lleva el mismo color de motivo que usaría la
  // ilustración, a modo de cabecera con identidad — igual que las
  // cabeceras de actividad más abajo, sin necesitar rasterizar nada. Con un
  // tema, la cabecera es la del tema, con su personaje.
  const art = classic || cuaderno ? null : await loadThemeArt(theme.id);
  const visual = !!c.visual && (c.formato ?? 'ficha') !== 'tarjetas';
  const imgs = visual ? await pictosPng(c) : undefined;
  // Con hilo conductor: los dibujos del catálogo (cabecera, bloques y ejercicios)
  const ilus = (c.hilo || c.lectura) && !visual ? await ilustracionesPng(c) : undefined;
  // Pizzas y tartas por fracciones: dibujadas por el código, a PNG
  const fp = cuaderno && !visual ? await fraccionesPng(c) : undefined;
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
            ...(classic || cuaderno ? [] : [new Paragraph({
              children: [
                art
                  ? new ImageRun({ type: 'jpg', data: art.bytes, transformation: { width: 56, height: 56 } })
                  : new TextRun({ text: `${historia?.emoji || theme.personaje}`, font: EMOJI_FONT, size: 36 }),
                new TextRun({ text: '  ' }),
                new TextRun({ text: `${t(theme.nombre).toUpperCase()}   ${theme.adornos.slice(0, 3).join(' ')}`, bold: true, color: 'FFFFFF', size: 16 }),
              ],
            })]),
            new Paragraph({
              children: [new TextRun({
                text: cuaderno ? (c.titulo || f.title).toUpperCase() : c.titulo || f.title, bold: true, color: motif.accent, size: cuaderno ? 36 : 32,
                font: classic ? undefined : cuaderno ? 'Trebuchet MS' : theme.fuenteTitulo.split(',')[0].replace(/"/g, ''),
              })],
            }),
            // «Cuaderno» con hilo: los tres dibujos de la cabecera, a la derecha del título
            ...(cuaderno && ilus ? [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: dibujosDeLaCabecera(c.hilo).map(id => pictoRun(ilus, id, 52)).filter((r): r is ImageRun => !!r),
            })] : []),
          ],
        })],
      })],
    }),
    new Paragraph({ text: '', spacing: { after: 160 } }),
  ];

  const area = f.request.area?.trim();
  children.push(new Paragraph({
    children: [
      ...(area ? [new TextRun({ text: `${area}     `, bold: true, size: 20 })] : []),
      new TextRun({
        text: `${t('Nombre')}: ______________________________     ${t('Fecha')}: ____________     ${t('Clase')}: __________${c.variante ? `     ${VARIANTE_MARK[c.variante]}` : ''}`,
        size: 20,
      }),
    ],
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
            new Paragraph({ children: runsRicos(c.explicacion, { color: classic ? '0C4A6E' : '1E293B' }) }),
          ],
        })],
      })],
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 160 } }));
  }

  // Ficha visual: las tarjetas de la explicación, en fila
  if (visual && c.conceptos?.length) {
    const B = { style: BorderStyle.SINGLE, size: 6, color: theme.color };
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: B, bottom: B, left: B, right: B, insideHorizontal: B, insideVertical: B },
      rows: [new TableRow({
        children: c.conceptos.map(k => {
          const dibujo = pictoRun(imgs, k.picto, 56);
          return new TableCell({
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
              ...(dibujo ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [dibujo] })] : []),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: k.titulo, bold: true, color: theme.oscuro })], spacing: { after: 40 } }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: k.texto, size: 20 })] }),
            ],
          });
        }),
      })],
    }));
    children.push(spacer());
  }

  if (c.instrucciones) {
    children.push(visual
      ? new Paragraph({
        children: [...runsRicos(c.instrucciones, { color: '1E293B' })],
        shading: { fill: 'FEF3C7' },
        border: { top: { style: 'single', size: 6, color: 'F59E0B', space: 4 }, bottom: { style: 'single', size: 6, color: 'F59E0B', space: 4 }, left: { style: 'single', size: 6, color: 'F59E0B', space: 4 }, right: { style: 'single', size: 6, color: 'F59E0B', space: 4 } },
        spacing: { after: 240 },
      })
      : new Paragraph({
        children: runsRicos(c.instrucciones, { italics: c.variante !== 'lectura_facil', color: '475569' }),
        spacing: { after: 240 },
      }));
  }

  if (c.lectura) lecturaDocx(children, c.lectura, ilus, theme.color, c.variante === 'lectura_facil');

  const formato = c.formato ?? 'ficha';
  const escape = formato === 'escape';
  if (formato === 'tarjetas') tarjetasDocx(children, c.tarjetas ?? [], theme, t);

  for (const [actIdx, act] of (formato === 'tarjetas' ? [] : actividades).entries()) {
    const color = theme.bloques[actIdx % theme.bloques.length];
    const label = `${t(escape ? 'Sala' : theme.paso)} ${actIdx + 1}: ${act.titulo}`;
    if (cuaderno) {
      // Número con fondo de color y título en el color del bloque, subrayado con su línea
      children.push(new Paragraph({
        children: [
          new TextRun({ text: ` ${actIdx + 1} `, bold: true, color: 'FFFFFF', size: 28, shading: { type: 'clear', fill: color.bg, color: 'auto' } }),
          new TextRun({ text: `  ${(act.titulo || label).toUpperCase()}`, bold: true, color: color.bg, size: 26, font: 'Trebuchet MS' }),
          ...(act.dificultad ? [new TextRun({ text: `     ${estrellas(act.dificultad)} ${t(NOMBRE_DIFICULTAD[act.dificultad])}`, bold: true, color: color.bg, size: 18, font: 'Trebuchet MS' })] : []),
        ],
        border: { bottom: { style: 'single', size: 8, color: color.bg, space: 4 } },
        spacing: { before: 120, after: 160 },
        keepNext: true,
      }));
    } else if (act.titulo) {
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
                ...(act.dificultad ? [new TextRun({ text: `    ${estrellas(act.dificultad)}`, bold: true, color: 'FFFFFF', size: 20 })] : []),
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
    if (visual) pushVisualActivityDocx(children, act, color, imgs);
    // «Cuaderno»: un solo ejercicio no lleva número; con listas de cálculos, letras
    const marcador = (i: number): Marcador | undefined => !cuaderno ? undefined
      : act.ejercicios.length === 1 ? ''
      : act.ejercicios.some(e => e.tipo === 'calculos') ? `${String.fromCharCode(65 + i)}. ` : undefined;
    for (const [i, ex] of act.ejercicios.entries()) await pushExerciseDocx(children, ex, i, color.bg, t, imgs, marcador(i), cuaderno, ilus, lang, fp);
    if (act.recuadro) pushRecuadroDocx(children, act.recuadro, t);
    if (visual && act.recuerda?.length) pushRecuerdaDocx(children, act, imgs, t);
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

  if (visual && pictosDeFicha(c).some(id => esMulberry(id) && imgs?.[id])) {
    children.push(new Paragraph({ children: [new TextRun({ text: `${t('Pictogramas:')} ${ATRIBUCION_MULBERRY}`, size: 14, color: '64748B' })], spacing: { before: 200 } }));
  }

  const doc = new Document({
    sections: [{ children, properties: { page: { margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 } } } }],
    // Lectura fácil y ficha visual: letra sin adornos y más grande
    styles: {
      default: {
        document: c.variante === 'lectura_facil'
          // Letra grande y sin adornos, más espacio entre líneas y sin justificar (dislexia)
          ? { run: { font: 'Verdana', size: 28 }, paragraph: { spacing: { line: 360 } } }
          : { run: visual ? { font: 'Verdana', size: 26 } : { font: 'Calibri', size: 22 } },
      },
    },
  });

  return Packer.toBlob(doc);
}

export async function saveFichaDocx(f: Ficha, lang: Lang) {
  const blob = await buildFichaDocxBlob(f, lang);
  await downloadFile(blob, fileBase(f) + '.docx', CARPETAS.fichas);
}
