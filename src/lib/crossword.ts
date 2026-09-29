/**
 * Generador de crucigramas para las fichas de trabajo.
 *
 * Igual que con la sopa de letras (`wordSearch.ts`), la IA solo aporta las
 * palabras y sus pistas: la cuadrícula la monta este algoritmo, porque un
 * modelo de texto no puede garantizar que los cruces encajen letra a letra.
 * Se calcula una vez al generar la ficha y se guarda en el ejercicio, así que
 * reabrirla muestra siempre el mismo crucigrama.
 *
 * Cómo coloca: la palabra más larga va en horizontal y cada una de las
 * siguientes busca cruzarse con alguna ya puesta, sin quedar pegada en
 * paralelo a otra (eso crearía «palabras» falsas). De todas las posiciones
 * válidas se queda con la que más cruces hace; las palabras que no encuentran
 * sitio se reintentan al final y, si aun así no caben, se quedan fuera: mejor
 * un crucigrama con una palabra menos que uno imposible de resolver.
 */

import { normalizeLetters } from './wordSearch';

export type CrosswordDir = 'H' | 'V';

export interface CrosswordEntry {
  numero: number;
  /** Letras que van en las casillas: mayúsculas, sin tildes (la Ñ se mantiene). */
  palabra: string;
  pista: string;
  fila: number;
  columna: number;
  dir: CrosswordDir;
}

export interface Crossword {
  filas: number;
  columnas: number;
  entradas: CrosswordEntry[];
}

export interface CrosswordCell {
  letra: string;
  numero?: number;
}

const DELTA: Record<CrosswordDir, [number, number]> = { H: [0, 1], V: [1, 0] };

interface Placed { palabra: string; pista: string; fila: number; columna: number; dir: CrosswordDir }

export function buildCrossword(
  items: { palabra: string; pista: string }[],
  rand: () => number = Math.random,
): Crossword {
  const seen = new Set<string>();
  const words = items
    .map(it => ({ palabra: normalizeLetters(it.palabra), pista: it.pista.trim() }))
    .filter(w => w.palabra.length >= 2 && !seen.has(w.palabra) && seen.add(w.palabra))
    .sort((a, b) => b.palabra.length - a.palabra.length);
  if (!words.length) return { filas: 0, columnas: 0, entradas: [] };

  const cells = new Map<string, { letra: string; dirs: Set<CrosswordDir> }>();
  const key = (r: number, c: number) => `${r},${c}`;
  const placed: Placed[] = [];

  function put(w: { palabra: string; pista: string }, fila: number, columna: number, dir: CrosswordDir) {
    const [dr, dc] = DELTA[dir];
    for (let i = 0; i < w.palabra.length; i++) {
      const k = key(fila + dr * i, columna + dc * i);
      const cell = cells.get(k) ?? { letra: w.palabra[i], dirs: new Set<CrosswordDir>() };
      cell.dirs.add(dir);
      cells.set(k, cell);
    }
    placed.push({ ...w, fila, columna, dir });
  }

  /** Cruces que haría la palabra en esa posición, o -1 si no cabe. */
  function score(palabra: string, fila: number, columna: number, dir: CrosswordDir): number {
    const [dr, dc] = DELTA[dir];
    // Justo antes y justo después tiene que haber hueco: si no, se alarga otra palabra
    if (cells.has(key(fila - dr, columna - dc))) return -1;
    if (cells.has(key(fila + dr * palabra.length, columna + dc * palabra.length))) return -1;
    let crosses = 0;
    for (let i = 0; i < palabra.length; i++) {
      const r = fila + dr * i;
      const c = columna + dc * i;
      const cell = cells.get(key(r, c));
      if (cell) {
        if (cell.letra !== palabra[i] || cell.dirs.has(dir)) return -1;
        crosses++;
      } else {
        // Una casilla nueva no puede tocar de lado otra letra: saldría una palabra que no existe
        if (cells.has(key(r + dc, c + dr)) || cells.has(key(r - dc, c - dr))) return -1;
      }
    }
    return crosses;
  }

  function tryPlace(w: { palabra: string; pista: string }): boolean {
    let best: { fila: number; columna: number; dir: CrosswordDir; s: number }[] = [];
    let bestScore = 0;
    for (const p of placed) {
      const dir: CrosswordDir = p.dir === 'H' ? 'V' : 'H';
      const [pdr, pdc] = DELTA[p.dir];
      const [dr, dc] = DELTA[dir];
      for (let i = 0; i < p.palabra.length; i++) {
        for (let j = 0; j < w.palabra.length; j++) {
          if (p.palabra[i] !== w.palabra[j]) continue;
          const fila = p.fila + pdr * i - dr * j;
          const columna = p.columna + pdc * i - dc * j;
          const s = score(w.palabra, fila, columna, dir);
          if (s <= 0) continue;
          if (s > bestScore) { bestScore = s; best = []; }
          if (s === bestScore) best.push({ fila, columna, dir, s });
        }
      }
    }
    if (!best.length) return false;
    const pick = best[Math.floor(rand() * best.length)];
    put(w, pick.fila, pick.columna, pick.dir);
    return true;
  }

  put(words[0], 0, 0, 'H');
  let pending = words.slice(1);
  // Una palabra que no cabía puede caber cuando ya hay más puestas
  for (let pass = 0; pass < 3 && pending.length; pass++) {
    pending = pending.filter(w => !tryPlace(w));
  }

  // Normaliza para que la casilla más arriba a la izquierda sea (0,0)
  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
  for (const k of cells.keys()) {
    const [r, c] = k.split(',').map(Number);
    minR = Math.min(minR, r); minC = Math.min(minC, c);
    maxR = Math.max(maxR, r); maxC = Math.max(maxC, c);
  }

  // Números en orden de lectura; una horizontal y una vertical que empiezan en la misma casilla comparten número
  const starts = [...new Set(placed.map(p => key(p.fila - minR, p.columna - minC)))]
    .map(k => k.split(',').map(Number))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const numOf = new Map(starts.map(([r, c], i) => [key(r, c), i + 1]));

  const entradas = placed
    .map(p => ({
      numero: numOf.get(key(p.fila - minR, p.columna - minC))!,
      palabra: p.palabra, pista: p.pista,
      fila: p.fila - minR, columna: p.columna - minC, dir: p.dir,
    }))
    .sort((a, b) => (a.dir === b.dir ? a.numero - b.numero : a.dir === 'H' ? -1 : 1));

  return { filas: maxR - minR + 1, columnas: maxC - minC + 1, entradas };
}

/** La cuadrícula casilla a casilla: `null` es casilla negra (vacía). */
export function crosswordCells(cw: Crossword): (CrosswordCell | null)[][] {
  const grid: (CrosswordCell | null)[][] = Array.from({ length: cw.filas }, () => Array<CrosswordCell | null>(cw.columnas).fill(null));
  for (const e of cw.entradas) {
    const [dr, dc] = DELTA[e.dir];
    for (let i = 0; i < e.palabra.length; i++) {
      const r = e.fila + dr * i;
      const c = e.columna + dc * i;
      grid[r][c] = { ...(grid[r][c] ?? {}), letra: e.palabra[i] };
    }
  }
  for (const e of cw.entradas) grid[e.fila][e.columna]!.numero = e.numero;
  return grid;
}
