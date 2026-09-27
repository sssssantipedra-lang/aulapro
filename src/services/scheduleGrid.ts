/**
 * Del horario transcrito por la IA a sesiones con día y hora.
 *
 * Antes se le pedía a la IA que devolviera directamente «lunes, de 9:25 a
 * 10:20, Matemáticas». Leía bien las asignaturas, pero al tener que deducir
 * ella misma la posición de cada una se equivocaba a menudo: una celda vacía,
 * el recreo o una celda combinada bastaban para correr una sesión de hora o
 * de día.
 *
 * Ahora la IA solo copia la tabla tal cual, fila a fila y celda a celda
 * (vacías incluidas), y aquí se calcula el día por la columna y la hora por
 * la fila. Esa parte es aritmética: no se equivoca.
 */

/** Una celda del horario tal como la transcribe la IA. */
export interface GridCell {
  subject?: string;
  group?: string;
  room?: string;
}

/** Una fila (franja horaria) del horario. */
export interface GridRow {
  start?: string;
  end?: string;
  /** Recreo o descanso: la fila se ignora entera. */
  isBreak?: boolean;
  /** Una celda por columna de `dayHeaders`, en el mismo orden. */
  cells?: GridCell[];
}

export interface ScheduleGrid {
  /** Cabeceras de las columnas de días, en el orden en que aparecen. */
  dayHeaders?: string[];
  rows?: GridRow[];
}

/** Sesión ya colocada, lista para que el docente la revise. */
export interface DetectedBlock {
  day: number;
  time_start: string;
  time_end: string;
  subject: string;
  room?: string;
  className?: string;
}

/** Lo que se le exige a la IA: la tabla tal cual, sin interpretar posiciones. */
export const SCHEDULE_GRID_SCHEMA = {
  type: 'OBJECT',
  properties: {
    dayHeaders: {
      type: 'ARRAY',
      description: 'Cabeceras de las columnas de días, de izquierda a derecha (p. ej. «Lunes», «L», «Dilluns»). Sin la columna de las horas.',
      items: { type: 'STRING' },
    },
    rows: {
      type: 'ARRAY',
      description: 'Una entrada por cada fila del horario, de arriba abajo, recreos incluidos.',
      items: {
        type: 'OBJECT',
        properties: {
          start: { type: 'STRING', description: 'Hora de inicio de la fila, HH:MM' },
          end: { type: 'STRING', description: 'Hora de fin de la fila, HH:MM' },
          isBreak: { type: 'BOOLEAN', description: 'true si la fila es un recreo o descanso' },
          cells: {
            type: 'ARRAY',
            description: 'Exactamente una celda por cada cabecera de dayHeaders y en su mismo orden. Celda vacía = todos los campos "".',
            items: {
              type: 'OBJECT',
              properties: {
                subject: { type: 'STRING', description: 'Asignatura o actividad, "" si la celda está vacía' },
                group: { type: 'STRING', description: 'Grupo o curso (p. ej. «3º ESO A»), "" si no aparece' },
                room: { type: 'STRING', description: 'Aula, "" si no aparece' },
              },
              required: ['subject', 'group', 'room'],
            },
          },
        },
        required: ['start', 'end', 'isBreak', 'cells'],
      },
    },
  },
  required: ['dayHeaders', 'rows'],
} as const;

/** Normaliza «9», «9:5», «09.30», «9h» a formato HH:MM. */
export function normalizeTime(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase().replace(/[.h]/g, ':').replace(/:$/, '');
  const m = s.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const plain = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

/**
 * Días de la semana en castellano, catalán/valenciano, gallego, euskera e
 * inglés, que son los horarios que puede tener un docente en España.
 */
const DAY_PREFIXES: [number, string[]][] = [
  [1, ['lunes', 'lun', 'dilluns', 'dl', 'luns', 'astelehen', 'monday', 'mon']],
  [2, ['martes', 'mar', 'dimarts', 'dm', 'asteartea', 'tuesday', 'tue']],
  [3, ['miercoles', 'mie', 'mier', 'dimecres', 'dc', 'mercores', 'asteazken', 'wednesday', 'wed']],
  [4, ['jueves', 'jue', 'dijous', 'dj', 'xoves', 'osteguna', 'thursday', 'thu']],
  [5, ['viernes', 'vie', 'divendres', 'dv', 'venres', 'ostirala', 'friday', 'fri']],
];
const DAY_LETTERS: Record<string, number> = { l: 1, m: 2, x: 3, j: 4, v: 5 };

/** 1 = lunes … 5 = viernes, o `null` si la cabecera no es un día laborable. */
export function parseDayHeader(raw: string): number | null {
  const s = plain(raw);
  if (!s) return null;
  if (s.length === 1) return DAY_LETTERS[s] ?? null;
  for (const [day, prefixes] of DAY_PREFIXES) {
    // Coincide la palabra entera, o la cabecera empieza por una forma larga
    // («Lunes 12», «Mon.»), pero «ma» sola no basta para decir martes.
    if (prefixes.some(p => s === p || (p.length >= 3 && s.startsWith(p)))) return day;
  }
  return null;
}

/**
 * A qué día corresponde cada columna. Si todas las cabeceras se entienden y
 * no se repiten, se usan; si no, se supone el orden habitual lunes → viernes.
 */
export function mapColumnsToDays(headers: readonly string[], columns: number): number[] {
  const parsed = headers.slice(0, columns).map(parseDayHeader);
  const valid = parsed.length === columns
    && parsed.every(d => d !== null)
    && new Set(parsed).size === parsed.length;
  if (valid) return parsed as number[];
  return Array.from({ length: columns }, (_, i) => i + 1);
}

/** Celdas que no son una clase: se descartan igual que las vacías. */
const NOT_A_CLASS = /^(recreo|patio|descanso|pausa|guardia|guardias|libre|hora libre|reunion|reuniones|comida|almuerzo|esbarjo|pati|lliure|recreo\s*\/?\s*guardia|-+|—+|x)$/;

function isClassCell(subject: string): boolean {
  const s = subject.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return s.length > 0 && !NOT_A_CLASS.test(s) && !/^(guardia|recreo)\b/.test(s);
}

const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Coloca cada celda de la tabla transcrita en su día y su hora. */
export function gridToBlocks(grid: ScheduleGrid | null | undefined): DetectedBlock[] {
  const rows = Array.isArray(grid?.rows) ? grid.rows : [];
  const headers = Array.isArray(grid?.dayHeaders) ? grid.dayHeaders.map(h => String(h ?? '')) : [];

  // Número de columnas de días: el de las cabeceras si lo hay; si no, el de
  // la fila más ancha. Nunca más de 5 (sábados y domingos no se usan).
  const widest = Math.max(0, ...rows.map(r => (Array.isArray(r.cells) ? r.cells.length : 0)));
  const columns = Math.min(5, headers.length || widest);
  if (columns === 0) return [];
  const days = mapColumnsToDays(headers, columns);

  // Hora de inicio de cada fila, para cerrar las que no traen hora de fin.
  const starts = rows.map(r => {
    const direct = normalizeTime(r.start);
    if (direct) return direct;
    // «8:30 - 9:25» metido entero en start
    const m = String(r.start ?? '').match(/(\d{1,2}[:.h]?\d{0,2})\s*[-–—a]\s*(\d{1,2}[:.h]?\d{0,2})/);
    return m ? normalizeTime(m[1]) : null;
  });

  const out: DetectedBlock[] = [];
  rows.forEach((row, ri) => {
    const start = starts[ri];
    if (!start || row.isBreak) return;

    let end = normalizeTime(row.end);
    if (!end) {
      const m = String(row.start ?? '').match(/[-–—a]\s*(\d{1,2}[:.h]?\d{0,2})\s*$/);
      end = m ? normalizeTime(m[1]) : null;
    }
    if (!end || end <= start) {
      const next = starts.slice(ri + 1).find(s => s && s > start);
      end = next ?? addMinutes(start, 55);
    }

    const cells = Array.isArray(row.cells) ? row.cells.slice(0, columns) : [];
    cells.forEach((cell, ci) => {
      const subject = clean(cell?.subject, 60);
      if (!isClassCell(subject)) return;
      out.push({
        day: days[ci],
        time_start: start,
        time_end: end,
        subject,
        className: clean(cell?.group, 40),
        room: clean(cell?.room, 30),
      });
    });
  });

  // Una misma sesión transcrita dos veces (p. ej. por una celda combinada
  // repetida en la misma franja) solo se añade una vez.
  const seen = new Set<string>();
  return out
    .filter(b => {
      const k = `${b.day}|${b.time_start}|${b.subject.toLowerCase()}|${(b.className ?? '').toLowerCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.day - b.day || a.time_start.localeCompare(b.time_start));
}

/**
 * Rellena las celdas combinadas de una hoja de cálculo con el valor de su
 * esquina, que es donde lo guarda Excel: así una clase de dos horas o un
 * recreo que ocupa toda la fila no se convierten en celdas vacías y la IA no
 * corre las columnas.
 */
export function fillMergedCells(
  sheet: Record<string, unknown> & { '!merges'?: { s: { r: number; c: number }; e: { r: number; c: number } }[] },
  encode: (addr: { r: number; c: number }) => string,
): void {
  for (const m of sheet['!merges'] ?? []) {
    const origin = sheet[encode(m.s)];
    if (!origin) continue;
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r === m.s.r && c === m.s.c) continue;
        sheet[encode({ r, c })] = { ...(origin as object) };
      }
    }
  }
}
