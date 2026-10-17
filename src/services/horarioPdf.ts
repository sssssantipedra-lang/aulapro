/**
 * Las clases de cada día, sacadas del PDF del horario SIN IA.
 *
 * Un PDF hecho por el centro (o exportado de Excel) lleva el texto como texto,
 * con la posición de cada palabra en la página. Con eso se reconstruye la
 * tabla: las cabeceras «Lunes … Viernes» dan las columnas, las horas de la
 * columna de la izquierda dan las filas, y cada palabra cae en la celda donde
 * está. La tabla resultante pasa por `gridToBlocks` (el mismo cálculo de día y
 * hora que usaba el escáner con IA), así que lo único que se decide aquí es
 * qué texto cae en qué celda.
 *
 * Una foto o un PDF escaneado no llevan texto: de ellos no se saca nada y la
 * pantalla ofrece la IA como opción, o apuntar las clases a mano.
 */
import type { HorarioDocumento } from '../types';
import { abrirPdf } from '../lib/pdfjs';
import {
  gridToBlocks, normalizeTime, parseDayHeader,
  type DetectedBlock, type GridCell, type GridRow, type ScheduleGrid,
} from './scheduleGrid';

/** Un trozo de texto del PDF. `y` crece hacia abajo; `x` e `y` son su esquina de abajo a la izquierda. */
export interface TextoPdf {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const centroX = (t: TextoPdf) => t.x + t.w / 2;
const centroY = (t: TextoPdf) => t.y - t.h / 2;
const mediana = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/** Ordena de arriba abajo y, en la misma línea (aunque difiera una fracción de punto), de izquierda a derecha. */
function enOrdenDeLectura(items: TextoPdf[]): TextoPdf[] {
  const porY = [...items].sort((a, b) => a.y - b.y);
  const lineas: TextoPdf[][] = [];
  for (const t of porY) {
    const linea = lineas[lineas.length - 1];
    if (linea && Math.abs(linea[0].y - t.y) < Math.max(linea[0].h, t.h) * 0.4) linea.push(t);
    else lineas.push([t]);
  }
  return lineas.flatMap(l => l.sort((a, b) => a.x - b.x));
}

/** pdf.js parte a veces una palabra o una línea en trozos: se vuelven a juntar. */
function unirTrozos(items: TextoPdf[]): TextoPdf[] {
  const orden = enOrdenDeLectura(items.filter(t => t.str.trim() !== ''));
  const out: TextoPdf[] = [];
  for (const t of orden) {
    const prev = out[out.length - 1];
    const mismaLinea = prev && Math.abs(prev.y - t.y) < Math.max(prev.h, t.h) * 0.4;
    const hueco = prev ? t.x - (prev.x + prev.w) : 0;
    // Un hueco estrecho es un espacio entre palabras de una celda; uno ancho,
    // otra celda: no se juntan.
    if (prev && mismaLinea && hueco > -prev.h * 0.5 && hueco < Math.max(prev.h, t.h) * 0.9) {
      const espacio = hueco > Math.max(prev.h, t.h) * 0.12 && !/\s$/.test(prev.str) && !/^\s/.test(t.str) ? ' ' : '';
      prev.str += espacio + t.str;
      prev.w = Math.max(prev.w, t.x + t.w - prev.x);
      prev.h = Math.max(prev.h, t.h);
    } else {
      out.push({ ...t });
    }
  }
  return out;
}

/* ── Partir el texto de una celda en asignatura, grupo y aula ── */

const GRUPO = new RegExp(
  '\\b[1-6]\\s*[º°ª]\\s*(?:E\\.?S\\.?O\\.?|E\\.?P\\.?|Primaria|Prim\\.?|Bach(?:illerato)?\\.?)?\\s*[A-F]?\\b' +
  '|\\b[1-6]\\s*(?:ESO|EP|PRIM|BACH)\\s*[A-F]?\\b' +
  '|\\b[1-6][A-F]\\b',
  'i',
);
const AULA = /\b(?:aula|sala|laboratorio|lab|gimnasio|pista|taller|biblioteca)\b\.?\s*[\w.\-ºª]*/i;

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sobras = (s: string) => s.replace(/\s+/g, ' ').replace(/^[\s\-–—|/,·:;()]+|[\s\-–—|/,·:;()]+$/g, '').trim();

/**
 * Parte lo que hay en una celda. Si el grupo es uno de los que ya existen en
 * la app (`grupos`), se reconoce aunque venga escrito de forma rara.
 */
export function partirCelda(texto: string, grupos: readonly string[] = []): GridCell {
  let resto = texto.replace(/\s+/g, ' ').trim();
  if (!resto) return { subject: '', group: '', room: '' };

  let group = '';
  for (const g of [...grupos].sort((a, b) => b.length - a.length)) {
    const partes = g.trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) continue;
    const re = new RegExp(`(?<![\\p{L}\\d])${partes.map(escapar).join('\\s*')}(?![\\p{L}\\d])`, 'iu');
    if (re.test(resto)) { group = g; resto = resto.replace(re, ' '); break; }
  }
  if (!group) {
    const m = resto.match(GRUPO);
    if (m) { group = m[0].trim(); resto = resto.replace(m[0], ' '); }
  }

  let room = '';
  const a = resto.match(AULA);
  if (a) { room = a[0].trim(); resto = resto.replace(a[0], ' '); }

  let subject = sobras(resto);
  // Una celda que solo trae el grupo («3º A»): sirve de nombre de la sesión
  if (!subject && group) { subject = group; group = ''; }
  return { subject, group: sobras(group), room: sobras(room) };
}

/* ── Reconstruir la tabla ── */

interface FilaHora { start: string; end?: string; y: number }

const HORAS = /(\d{1,2})\s*[:.h]\s*(\d{2})/g;

function horasDe(texto: string): string[] {
  return [...texto.matchAll(HORAS)]
    .map(m => normalizeTime(`${m[1]}:${m[2]}`))
    .filter((h): h is string => h !== null);
}

/**
 * De los textos de una página a la tabla del horario, o `null` si la página no
 * tiene una (no hay cabeceras de días o no hay horas a la izquierda).
 */
export function gridDeTextos(textos: TextoPdf[], grupos: readonly string[] = []): ScheduleGrid | null {
  const items = unirTrozos(textos);
  if (items.length < 6) return null;

  // 1) Cabeceras de los días: la línea con más días distintos (al menos 3)
  const cabeceras = items.filter(t => t.str.length <= 16 && parseDayHeader(t.str) !== null);
  let mejor: TextoPdf[] = [];
  for (const base of cabeceras) {
    const linea = cabeceras.filter(t => Math.abs(t.y - base.y) < Math.max(t.h, base.h) * 0.6);
    const dias = new Set(linea.map(t => parseDayHeader(t.str)));
    const mejorDias = new Set(mejor.map(t => parseDayHeader(t.str)));
    if (dias.size > mejorDias.size) mejor = linea;
  }
  const porDia = new Map<number, TextoPdf>();
  for (const t of [...mejor].sort((a, b) => a.x - b.x)) {
    const d = parseDayHeader(t.str)!;
    if (!porDia.has(d)) porDia.set(d, t);
  }
  const cols = [...porDia.values()].sort((a, b) => a.x - b.x);
  if (cols.length < 3) return null;

  const centros = cols.map(centroX);
  const ancho = mediana(centros.slice(1).map((c, i) => c - centros[i]));
  const limites = centros.slice(1).map((c, i) => (c + centros[i]) / 2);
  const izquierda = centros[0] - ancho / 2;
  const columnaDe = (x: number) => limites.filter(l => x > l).length;

  // 2) Las horas, a la izquierda de la primera columna y bajo las cabeceras
  const yCabecera = Math.max(...cols.map(c => c.y));
  const cuerpo = items.filter(t => t.y > yCabecera + 1);
  const etiquetas = cuerpo
    .filter(t => centroX(t) < izquierda && horasDe(t.str).length > 0)
    .sort((a, b) => a.y - b.y);

  const filas: FilaHora[] = [];
  for (let i = 0; i < etiquetas.length; i++) {
    const t = etiquetas[i];
    const horas = horasDe(t.str);
    if (horas.length >= 2) { filas.push({ start: horas[0], end: horas[1], y: centroY(t) }); continue; }
    const sig = etiquetas[i + 1];
    // «8:30» y debajo «9:25»: la hora de inicio y la de fin de la misma fila
    if (sig && horasDe(sig.str).length === 1 && sig.y - t.y < t.h * 1.9) {
      filas.push({ start: horas[0], end: horasDe(sig.str)[0], y: (centroY(t) + centroY(sig)) / 2 });
      i++;
    } else {
      filas.push({ start: horas[0], y: centroY(t) });
    }
  }
  if (filas.length < 2) return null;

  // 3) Cada texto, a su fila (la etiqueta de hora más cercana) y su columna
  const paso = mediana(filas.slice(1).map((f, i) => f.y - filas[i].y)) || 20;
  const cortes = filas.slice(1).map((f, i) => (f.y + filas[i].y) / 2);
  const filaDe = (y: number) => cortes.filter(c => y > c).length;
  const ultimo = filas[filas.length - 1].y + paso / 2;

  const celdas: TextoPdf[][][] = filas.map(() => cols.map(() => []));
  for (const t of cuerpo) {
    const cx = centroX(t);
    const cy = centroY(t);
    if (cx < izquierda || cy > ultimo) continue;
    celdas[filaDe(cy)][columnaDe(cx)].push(t);
  }

  const rows: GridRow[] = filas.map((f, ri) => ({
    start: f.start,
    end: f.end ?? '',
    cells: cols.map((_, ci) => {
      const textos = enOrdenDeLectura(celdas[ri][ci]);
      return partirCelda(textos.map(t => t.str).join(' '), grupos);
    }),
  }));

  return { dayHeaders: cols.map(c => c.str), rows };
}

/* ── Leer el PDF ── */

/** Hasta cuántas páginas se miran: un horario cabe en una, a veces en dos. */
const MAX_PAGINAS = 3;

/** Los textos de cada página del PDF, con su posición. */
export async function textosDelPdf(base64: string): Promise<TextoPdf[][]> {
  const { pdf, cerrar } = await abrirPdf(base64);
  try {
    const paginas: TextoPdf[][] = [];
    for (let n = 1; n <= Math.min(pdf.numPages, MAX_PAGINAS); n++) {
      const page = await pdf.getPage(n);
      const { items } = await page.getTextContent();
      paginas.push(items.flatMap(it => {
        if (!('str' in it)) return [];
        const [, , , d, e, f] = it.transform as number[];
        return [{ str: it.str, x: e, y: -f, w: it.width, h: it.height || Math.abs(d) || 8 }];
      }));
    }
    return paginas;
  } finally {
    cerrar();
  }
}

/**
 * Las clases de la semana que se leen del documento, o una lista vacía si no
 * se puede (una foto, un PDF escaneado, una tabla que no se reconoce).
 */
export async function detectarClases(doc: HorarioDocumento, grupos: readonly string[] = []): Promise<DetectedBlock[]> {
  if (doc.mimeType !== 'application/pdf') return [];
  let paginas: TextoPdf[][];
  try { paginas = await textosDelPdf(doc.base64); } catch { return []; }
  for (const textos of paginas) {
    const bloques = gridToBlocks(gridDeTextos(textos, grupos));
    if (bloques.length > 0) return bloques;
  }
  return [];
}
