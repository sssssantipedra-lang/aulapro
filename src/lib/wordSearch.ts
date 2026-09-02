/**
 * Generador de sopas de letras para las fichas de trabajo.
 *
 * La IA (`services/resources.ts`) solo aporta la lista de palabras del tema;
 * la rejilla en sí NO la escribe la IA — un modelo de texto no puede
 * garantizar una cuadrícula sin solapamientos imposibles, así que la
 * colocación es un algoritmo determinista aquí. El resultado se calcula una
 * única vez, al generar la ficha, y se guarda en el propio ejercicio
 * (`rejilla` + `posiciones`), así que una ficha guardada siempre muestra la
 * misma sopa de letras al reabrirla, no una nueva cada vez.
 *
 * Direcciones: solo "hacia delante" (derecha, abajo, diagonal-abajo-derecha,
 * diagonal-abajo-izquierda) — sin palabras al revés. Es más fácil de
 * encontrar para alumnado de Primaria/Secundaria, que es el público de
 * AulaPro; una versión con las 8 direcciones se puede añadir después si hace
 * falta más dificultad.
 */

export interface WordSearchPlacement {
  /** Forma de la palabra tal y como se muestra en la lista (mayúsculas, con tildes). */
  palabra: string;
  fila: number;
  columna: number;
  /** [deltaFila, deltaColumna] por letra. */
  dir: [number, number];
}

export interface WordSearchGrid {
  size: number;
  /** `size` x `size`, una letra mayúscula (o "Ñ") por celda. */
  rejilla: string[][];
  /** Solo las palabras que consiguieron colocarse — ver nota en `buildWordSearchGrid`. */
  posiciones: WordSearchPlacement[];
}

/** Derecha, abajo, diagonal-abajo-derecha, diagonal-abajo-izquierda. */
const DIRECTIONS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];

const MAX_ATTEMPTS_PER_WORD = 200;
const MAX_GROWTH_STEPS = 5;
const MIN_SIZE = 10;
const MAX_SIZE = 16;

/** Pool con más vocales que consonantes, para que el relleno no desentone en castellano. */
const FILLER = 'AAAABEEEEIIIOOOOUUCCDDFGHJLMMNNPPRRSSSTTVYZ';

/** Rango Unicode U+0300–U+036F: marcas diacríticas combinantes (acentos) tras normalizar en forma NFD. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Mayúsculas, sin tildes, conservando la Ñ (que no es una vocal acentuada,
 * es su propia letra) y descartando espacios o cualquier carácter no
 * alfabético que se cuele si la IA no respeta "una sola palabra". La Ñ se
 * protege con un marcador ASCII antes de quitar tildes, porque NFD también
 * la descompondría en "N" + tilde combinante.
 */
function normalizeLetters(word: string): string {
  return word
    .toUpperCase()
    .replace(/Ñ/g, '{{N}}')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/\{\{N\}\}/g, 'Ñ')
    .replace(/[^A-ZÑ]/g, '');
}

function gridSize(lengths: number[]): number {
  const longest = Math.max(0, ...lengths);
  const totalChars = lengths.reduce((s, n) => s + n, 0);
  const bySpace = Math.ceil(Math.sqrt(totalChars * 2.6));
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, longest + 1, bySpace));
}

function fits(grid: (string | null)[][], size: number, letters: string, row: number, col: number, dir: [number, number]): boolean {
  const [dr, dc] = dir;
  for (let i = 0; i < letters.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    if (r < 0 || r >= size || c < 0 || c >= size) return false;
    const existing = grid[r][c];
    if (existing !== null && existing !== letters[i]) return false;
  }
  return true;
}

function fillRandomLetters(grid: (string | null)[][], size: number): void {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === null) grid[r][c] = FILLER[Math.floor(Math.random() * FILLER.length)];
    }
  }
}

/**
 * Coloca todas las palabras que quepan en una rejilla cuadrada. Si alguna no
 * cabe con el tamaño inicial, la rejilla crece (hasta `MAX_GROWTH_STEPS`
 * veces) y se reintenta desde cero. Si aun así alguna palabra no cabe —caso
 * raro, con demasiadas palabras largas—, esa palabra se omite del resultado
 * en vez de dejarla a medio colocar: mejor una sopa de letras más corta que
 * una con una palabra que nadie puede encontrar.
 *
 * Palabras de menos de 2 letras (tras limpiar) se descartan directamente.
 */
export function buildWordSearchGrid(rawWords: string[]): WordSearchGrid {
  const words = rawWords
    .map(w => ({ display: w.trim().toUpperCase(), letters: normalizeLetters(w) }))
    .filter(w => w.letters.length >= 2)
    .sort((a, b) => b.letters.length - a.letters.length);

  let size = gridSize(words.map(w => w.letters.length));

  for (let growth = 0; growth <= MAX_GROWTH_STEPS; growth++) {
    const grid: (string | null)[][] = Array.from({ length: size }, () => Array<string | null>(size).fill(null));
    const posiciones: WordSearchPlacement[] = [];
    let allPlaced = true;

    for (const w of words) {
      let placed = false;
      for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_WORD && !placed; attempt++) {
        const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
        const row = Math.floor(Math.random() * size);
        const col = Math.floor(Math.random() * size);
        if (fits(grid, size, w.letters, row, col, dir)) {
          for (let i = 0; i < w.letters.length; i++) grid[row + dir[0] * i][col + dir[1] * i] = w.letters[i];
          posiciones.push({ palabra: w.display, fila: row, columna: col, dir });
          placed = true;
        }
      }
      if (!placed) allPlaced = false;
    }

    if (allPlaced || growth === MAX_GROWTH_STEPS) {
      fillRandomLetters(grid, size);
      return { size, rejilla: grid as string[][], posiciones };
    }
    size++;
  }

  /* Inalcanzable: el bucle siempre devuelve en growth === MAX_GROWTH_STEPS. */
  throw new Error('No se pudo generar la sopa de letras');
}
