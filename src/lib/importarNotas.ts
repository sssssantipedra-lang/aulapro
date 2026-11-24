/**
 * Importar notas desde un archivo (24-11-2026, petición del dueño: «que se pueda insertar un Excel o un archivo con
 * notas y que la app ponga las notas en base a ese Excel»). Es lo mismo que pegar un bloque (`lib/pegarNotas.ts`):
 * se lee la hoja, se apartan la cabecera, el número de lista y los nombres, y cada fila va al alumno que se llama así
 * (`emparejarPorNombre`, con todo lo que se comprobó en sus cuatro vueltas de ataque). Lo que cambia es de dónde salen
 * las filas (un .xlsx, .xls, .ods o un .csv, leídos en el navegador: no sale nada del dispositivo) y que cada columna
 * de notas se lleva a la actividad que el docente elige, o a una nueva, en vez de ir hacia la derecha desde una celda.
 */
import { leerNota, leerPegado, MAX_COLUMNAS, MAX_FILAS, type Pegado } from './pegarNotas';
import { filasDeCsv } from './importarMaterial';

export const EXTENSIONES_NOTAS = '.xlsx,.xlsm,.xls,.ods,.csv,.tsv,.txt';
export const MAX_BYTES_NOTAS = 10 * 1024 * 1024;

/** Una hoja del archivo, ya como filas de texto. */
export interface HojaDeNotas { nombre: string; filas: string[][] }

/**
 * Deja la tabla de una hoja como la pegaría el docente: sin las filas de título de encima («Notas 1.ª evaluación»,
 * una sola celda con algo), sin columnas vacías a la izquierda ni a la derecha y sin filas vacías al final.
 */
export function recortarTabla(filas: string[][]): string[][] {
  let t = filas.slice(0, MAX_FILAS + 20).map(f => f.slice(0, MAX_COLUMNAS + 20).map(c => String(c ?? '').replace(/\s+/g, ' ').trim()));
  const llenas = (f: string[]) => f.filter(c => c !== '').length;
  while (t.length && llenas(t[t.length - 1]) === 0) t.pop();
  // Las filas de título de encima: una sola celda con algo (o ninguna) mientras más abajo hay filas con varias
  while (t.length > 1 && llenas(t[0]) <= 1 && t.slice(1).some(f => llenas(f) >= 2)) t = t.slice(1);
  if (t.length === 0) return [];
  const ancho = Math.max(...t.map(f => f.length));
  let izq = 0;
  while (izq < ancho && t.every(f => (f[izq] ?? '') === '')) izq++;
  let der = ancho;
  while (der > izq && t.every(f => (f[der - 1] ?? '') === '')) der--;
  return t.slice(0, MAX_FILAS).map(f => Array.from({ length: Math.min(der - izq, MAX_COLUMNAS) }, (_, k) => f[izq + k] ?? ''));
}

/** Lee un archivo de notas: las hojas con algo, cada una como filas de texto. Lanza un error si no se entiende. */
export async function leerArchivoDeNotas(file: File): Promise<HojaDeNotas[]> {
  const nombre = file.name.toLowerCase();
  let hojas: HojaDeNotas[];
  if (/\.(xlsx|xlsm|xls|ods)$/.test(nombre)) {
    const XLSX = await import('xlsx');
    const libro = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    // `raw: false`: el texto que se ve en la celda («7,5», «NP»), como al copiarla
    hojas = libro.SheetNames.map(n => ({
      nombre: n,
      filas: XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[n], { header: 1, blankrows: true, raw: false, defval: '' })
        .map(f => (f as unknown[]).map(c => String(c ?? ''))),
    }));
  } else if (/\.(csv|tsv)$/.test(nombre)) {
    hojas = [{ nombre: file.name, filas: filasDeCsv(await file.text()) }];
  } else if (/\.txt$/.test(nombre)) {
    hojas = [{ nombre: file.name, filas: leerPegado(await file.text()) }];
  } else {
    throw new Error('formato');
  }
  const conAlgo = hojas.map(h => ({ ...h, filas: recortarTabla(h.filas) })).filter(h => h.filas.length > 0);
  if (conAlgo.length === 0) throw new Error('vacio');
  return conAlgo;
}

/** Una columna de notas de la hoja: su título y lo que trae. */
export interface ColumnaDeNotas {
  /** Su posición entre las columnas de notas (`Pegado.celdas`). */
  k: number;
  titulo: string;
  /** Cuántas celdas traen una nota de 0 a 10, y cuántas algo que no lo es. */
  notas: number;
  mal: number;
  /** Las primeras notas, para reconocerla. */
  muestra: string[];
}

export function columnasDeNotas(pegado: Pegado): ColumnaDeNotas[] {
  const ancho = pegado.celdas[0]?.length ?? 0;
  return Array.from({ length: ancho }, (_, k) => {
    const col = pegado.celdas.map(f => f[k] ?? '');
    const lecturas = col.map(leerNota);
    return {
      k,
      titulo: pegado.titulos?.[k]?.trim() ?? '',
      notas: lecturas.filter(l => l.tipo === 'nota').length,
      mal: lecturas.filter(l => l.tipo === 'mal').length,
      muestra: col.filter(x => leerNota(x).tipo === 'nota').slice(0, 3),
    };
  });
}

const normal = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim();

/** A qué actividad va una columna: `id` de una que existe, `'nueva'` (se crea con el título de la columna) o `null` (no se importa). */
export type Destino = string | 'nueva' | null;

/**
 * Lo que se propone para cada columna: la actividad que se llama igual (sin tildes ni mayúsculas), o la única cuyo
 * nombre contiene el título o al revés; si no hay, una actividad nueva con el título de la columna; sin título o sin
 * ninguna nota, no se importa. Dos columnas no van a la misma actividad. El docente lo cambia antes de ver la vista previa.
 */
export function destinosPropuestos(columnas: ColumnaDeNotas[], actividades: { id: string; name: string }[]): Destino[] {
  const usadas = new Set<string>();
  return columnas.map(c => {
    if (c.notas === 0) return null;
    const t = normal(c.titulo);
    if (!t) return null;
    const libres = actividades.filter(a => !usadas.has(a.id));
    const igual = libres.filter(a => normal(a.name) === t);
    const contiene = libres.filter(a => {
      const n = normal(a.name);
      return n.length >= 4 && t.length >= 4 && (n.includes(t) || t.includes(n));
    });
    const elegida = igual.length === 1 ? igual[0] : igual.length === 0 && contiene.length === 1 ? contiene[0] : null;
    if (elegida) { usadas.add(elegida.id); return elegida.id; }
    return 'nueva';
  });
}

/**
 * Lo que se lleva a la vista previa: solo las columnas que se importan, en su orden, con su título. Las filas, los
 * nombres y el número de lista no cambian, así que el emparejado por nombre es el mismo que al pegar.
 */
export function pegadoDeColumnas(pegado: Pegado, columnas: number[]): Pegado {
  return {
    ...pegado,
    celdas: pegado.celdas.map(f => columnas.map(k => f[k] ?? '')),
    titulos: pegado.titulos ? columnas.map(k => pegado.titulos![k] ?? '') : null,
  };
}
