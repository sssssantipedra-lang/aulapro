/**
 * El cuaderno como una hoja de cálculo (22-11-2026, de la revisión a fondo de la app): pegar sobre una celda un
 * bloque copiado de una hoja de cálculo y poner una nota a quien no la tiene.
 *
 * Aquí va la lógica sin pantalla: leer lo que viene del portapapeles, decidir qué es una nota y preparar, sin
 * tocar nada, el plan de lo que cambiaría. La pantalla enseña ese plan antes de aplicarlo
 * (`components/cuaderno/VistaPreviaPegado.tsx`), porque lo pegado se casa **por posición, no por nombre**: la
 * primera fila pegada va al alumno de la celda donde se pega, la segunda al siguiente de la lista, y así.
 *
 * Reglas:
 *  - Una nota es un número de 0 a 10, con coma o punto decimal. Lo demás («NP», «11», «7/10») se señala y no entra.
 *  - Una celda vacía de lo pegado no cambia nada: nunca borra una nota que ya estaba.
 *  - Si la primera fila no trae ninguna nota y las demás sí, es la cabecera de la hoja y no se cuenta
 *    (el docente puede decir lo contrario).
 *  - Las columnas de texto del principio (los nombres) y el número de lista no ocupan columna del cuaderno: se
 *    enseñan al lado de cada alumno para comprobar el orden, y se avisa si un nombre no se parece al de su fila.
 *  - Lo que no cabe (más filas que alumnado, más columnas que actividades) se dice y no entra.
 */
import type { GradeMap } from '../types';

/** Lo que se ha leído en una celda: una nota, nada, o algo que no es una nota. */
export type Lectura = { tipo: 'nota'; valor: number } | { tipo: 'vacia' } | { tipo: 'mal' };

/** Una nota escrita: uno o dos dígitos y, si acaso, decimales con coma o con punto. */
const NOTA = /^(?:\d{1,2}(?:[.,]\d*)?|[.,]\d+)$/;

/**
 * Lee una nota escrita a mano o pegada: de 0 a 10, con coma o punto decimal, a dos decimales como mucho.
 * Es la misma regla para la celda del cuaderno, la lista de «Calificar esta actividad» y lo pegado.
 */
export function leerNota(texto: string): Lectura {
  const limpio = texto.replace(/\s+/g, '');
  if (limpio === '') return { tipo: 'vacia' };
  if (!NOTA.test(limpio)) return { tipo: 'mal' };
  const n = Number(limpio.replace(',', '.'));
  if (Number.isNaN(n) || n < 0 || n > 10) return { tipo: 'mal' };
  return { tipo: 'nota', valor: Math.round(n * 100) / 100 };
}

/** Tope de filas y de columnas que se leen de lo pegado: más que cualquier clase, y no se atasca con un texto enorme. */
export const MAX_FILAS = 300;
export const MAX_COLUMNAS = 60;

/**
 * Parte en filas y columnas lo que una hoja de cálculo deja en el portapapeles: columnas con tabulador y filas
 * con salto de línea; una celda con saltos o comillas va entre comillas dobles. Sin ningún tabulador, vale
 * también el punto y coma (un CSV abierto como texto). La coma nunca separa: es el decimal.
 * Las filas vacías del final se quitan (las hojas añaden una); las de en medio se conservan, porque la posición manda.
 */
export function leerPegado(texto: string): string[][] {
  const t = texto.replace(/\r\n?/g, '\n');
  const sep = t.includes('\t') ? '\t' : t.includes(';') ? ';' : '\t';
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let i = 0;
  const cerrarCelda = () => { fila.push(celda.replace(/\s+/g, ' ').trim()); celda = ''; };
  const cerrarFila = () => { cerrarCelda(); filas.push(fila); fila = []; };
  while (i < t.length && filas.length < MAX_FILAS) {
    const c = t[i];
    if (c === '"' && celda === '') {
      // Celda entre comillas: llega hasta la comilla de cierre (dos seguidas son una comilla escrita)
      let j = i + 1;
      let dentro = '';
      let cerrada = false;
      while (j < t.length) {
        if (t[j] === '"') {
          if (t[j + 1] === '"') { dentro += '"'; j += 2; continue; }
          cerrada = true; j++; break;
        }
        dentro += t[j]; j++;
      }
      if (cerrada && (j >= t.length || t[j] === sep || t[j] === '\n')) { celda = dentro; i = j; continue; }
      // No era una celda entre comillas (una comilla suelta): se lee tal cual
      celda += c; i++; continue;
    }
    if (c === sep) { cerrarCelda(); i++; continue; }
    if (c === '\n') { cerrarFila(); i++; continue; }
    celda += c; i++;
  }
  if (filas.length < MAX_FILAS && (celda !== '' || fila.length > 0)) cerrarFila();
  while (filas.length && filas[filas.length - 1].every(x => x === '')) filas.pop();
  if (filas.length === 0) return [];
  // Rectángulo: todas las filas con las mismas columnas, sin las del final que vienen vacías enteras
  let ancho = Math.min(MAX_COLUMNAS, Math.max(...filas.map(f => f.length)));
  while (ancho > 1 && filas.every(f => (f[ancho - 1] ?? '') === '')) ancho--;
  return filas.map(f => Array.from({ length: ancho }, (_, k) => f[k] ?? ''));
}

/** Si lo pegado es un bloque (más de una celda): entonces se enseña la vista previa; una sola celda se pega como siempre. */
export function esBloque(filas: string[][]): boolean {
  return filas.length > 1 || (filas[0]?.length ?? 0) > 1;
}

/** Lo pegado, ya entendido: las notas en su rejilla y lo que venía alrededor. */
export interface Pegado {
  /** Las celdas que van al cuaderno, fila a fila, sin la cabecera ni las columnas de nombre o de número de lista. */
  celdas: string[][];
  /** El texto que acompañaba a cada fila (el nombre que traía la hoja), o `null` si no traía ninguno. */
  etiquetas: string[] | null;
  /** El título de cada columna en la hoja, si traía cabecera. */
  titulos: string[] | null;
  /** Si la primera fila se ha tomado como cabecera. */
  cabecera: boolean;
  /** Si la primera fila parece una cabecera (lo que se propone de partida). */
  pareceCabecera: boolean;
  /** Si se ha apartado una columna con el número de lista (1, 2, 3…). */
  numeroDeLista: boolean;
}

const esNota = (x: string) => leerNota(x).tipo === 'nota';
const hayTexto = (x: string) => leerNota(x).tipo === 'mal';

/** La primera fila parece la cabecera de la hoja: no trae ninguna nota, trae algún texto y debajo sí hay notas. */
export function pareceCabecera(filas: string[][]): boolean {
  if (filas.length < 2) return false;
  const primera = filas[0];
  return !primera.some(esNota) && primera.some(hayTexto) && filas.slice(1).some(f => f.some(esNota));
}

/** Una columna que cuenta 1, 2, 3… desde arriba (cinco filas o más): el número de lista, no una nota. */
function esNumeroDeLista(columna: string[]): boolean {
  return columna.length >= 5 && columna.every((x, k) => /^\d+\.?$/.test(x) && Number(x.replace('.', '')) === k + 1);
}

/**
 * Entiende lo pegado: aparta la cabecera y las columnas del principio que no son notas (el número de lista y los
 * nombres). Solo las del principio: una columna de texto en medio conserva su sitio y sus celdas se señalan, para
 * que una columna entera de «NP» no desplace a la siguiente. `cabecera` fuerza si la primera fila lo es.
 */
export function entenderPegado(filas: string[][], opciones: { cabecera?: boolean } = {}): Pegado {
  const parece = pareceCabecera(filas);
  const conCabecera = (opciones.cabecera ?? parece) && filas.length > 1;
  const cuerpo = conCabecera ? filas.slice(1) : filas;
  const ancho = filas[0]?.length ?? 0;
  const columna = (k: number) => cuerpo.map(f => f[k] ?? '');

  let primera = 0;
  let numeroDeLista = false;
  const deNombre: number[] = [];
  while (primera < ancho) {
    const col = columna(primera);
    // El número de lista solo si detrás queda algo: una sola columna de 1 a 5 son notas
    if (!numeroDeLista && deNombre.length === 0 && primera < ancho - 1 && esNumeroDeLista(col)) { numeroDeLista = true; primera++; continue; }
    if (!col.some(esNota) && col.some(hayTexto)) { deNombre.push(primera); primera++; continue; }
    break;
  }
  const etiquetas = deNombre.length ? cuerpo.map(f => deNombre.map(k => f[k] ?? '').filter(Boolean).join(' ')) : null;
  return {
    celdas: cuerpo.map(f => f.slice(primera)),
    etiquetas,
    titulos: conCabecera ? filas[0].slice(primera) : null,
    cabecera: conCabecera,
    pareceCabecera: parece,
    numeroDeLista,
  };
}

/** Un nombre, en palabras comparables: sin tildes, sin mayúsculas y sin signos («Pérez Navarro, Lucía»). */
function palabras(nombre: string): string[] {
  return nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9ñç]+/).filter(Boolean);
}

/**
 * Si el nombre que traía la hoja puede ser el del alumno de su fila: todas las palabras del más corto están en el
 * otro, en cualquier orden («Pérez Navarro, Lucía» y «Lucía Pérez Navarro»; «Lucía» y «Lucía Pérez»). Solo sirve
 * para avisar: lo pegado se sigue casando por posición.
 */
export function nombresParecidos(a: string, b: string): boolean {
  const pa = palabras(a);
  const pb = palabras(b);
  if (pa.length === 0 || pb.length === 0) return true;
  const [corto, largo] = pa.length <= pb.length ? [pa, new Set(pb)] : [pb, new Set(pa)];
  return corto.every(p => largo.has(p));
}

/** Una nota que se va a escribir (o a quitar, con `null`). */
export interface CambioDeNota { itemId: string; studentId: string; value: number | null }

/**
 * Qué pasaría con una celda: `nueva` (no había nota), `cambia` (pisa la que había), `igual` (ya tenía esa),
 * `vacia` (lo pegado no trae nada: no se toca) o `mal` (no es una nota de 0 a 10: no entra).
 */
export type EstadoDeCelda = 'nueva' | 'cambia' | 'igual' | 'vacia' | 'mal';

export interface CeldaDelPlan {
  /** Lo que venía escrito en lo pegado. */
  texto: string;
  estado: EstadoDeCelda;
  /** La nota que hay ahora en el cuaderno. */
  antes: number | null;
  /** La nota que quedaría (la de antes, si la celda no entra). */
  valor: number | null;
}

export interface FilaDelPlan {
  alumnoId: string;
  nombre: string;
  /** El nombre que traía la hoja en esa fila, si traía. */
  etiqueta?: string;
  /** Si ese nombre no se parece al del alumno de la fila (posible fila descolocada). */
  descuadra: boolean;
  celdas: CeldaDelPlan[];
}

export interface PlanDePegado {
  /** Las actividades del cuaderno que reciben algo, en orden. */
  columnas: { id: string; nombre: string; titulo?: string }[];
  filas: FilaDelPlan[];
  /** Lo que se escribiría al aplicar: solo las notas nuevas y las que cambian. */
  cambios: CambioDeNota[];
  nuevas: number;
  cambian: number;
  iguales: number;
  /** Celdas que no son una nota de 0 a 10. */
  mal: number;
  /** Filas pegadas que no caben: van más allá del último alumno. */
  filasQueSobran: number;
  /** Columnas pegadas que no caben: van más allá de la última actividad. */
  columnasQueSobran: number;
  /** Filas cuyo nombre en la hoja no se parece al del alumno. */
  descuadradas: number;
}

export interface DondePegar {
  /** El alumnado de la tabla, en el orden en que se ve. */
  alumnado: { id: string; name: string }[];
  /** Las actividades de la tabla donde se puede escribir, en el orden en que se ven. */
  actividades: { id: string; name: string }[];
  /** La celda sobre la que se pega. */
  alumnoId: string;
  actividadId: string;
  /** Las notas que hay ahora. */
  notas: GradeMap;
}

/**
 * El plan de pegar: qué celda del cuaderno recibe cada celda pegada, hacia abajo desde el alumno y hacia la
 * derecha desde la actividad donde se pega. No toca nada: es lo que enseña la vista previa. Devuelve `null` si la
 * celda de partida no está en la tabla.
 */
export function planDePegado(pegado: Pegado, donde: DondePegar): PlanDePegado | null {
  const f0 = donde.alumnado.findIndex(a => a.id === donde.alumnoId);
  const c0 = donde.actividades.findIndex(a => a.id === donde.actividadId);
  if (f0 < 0 || c0 < 0) return null;
  const anchoPegado = pegado.celdas[0]?.length ?? 0;
  const alumnos = donde.alumnado.slice(f0, f0 + pegado.celdas.length);
  const actividades = donde.actividades.slice(c0, c0 + anchoPegado);
  const plan: PlanDePegado = {
    columnas: actividades.map((a, k) => ({ id: a.id, nombre: a.name, ...(pegado.titulos?.[k] ? { titulo: pegado.titulos[k] } : {}) })),
    filas: [], cambios: [], nuevas: 0, cambian: 0, iguales: 0, mal: 0,
    filasQueSobran: pegado.celdas.length - alumnos.length,
    columnasQueSobran: anchoPegado - actividades.length,
    descuadradas: 0,
  };
  alumnos.forEach((alumno, f) => {
    const etiqueta = pegado.etiquetas?.[f] || undefined;
    const descuadra = !!etiqueta && !nombresParecidos(etiqueta, alumno.name);
    if (descuadra) plan.descuadradas++;
    const celdas = actividades.map((act, c): CeldaDelPlan => {
      const texto = pegado.celdas[f][c] ?? '';
      const actual = donde.notas[act.id]?.[alumno.id];
      const antes = typeof actual === 'number' ? actual : null;
      const leida = leerNota(texto);
      if (leida.tipo === 'vacia') return { texto, estado: 'vacia', antes, valor: antes };
      if (leida.tipo === 'mal') { plan.mal++; return { texto, estado: 'mal', antes, valor: antes }; }
      if (antes === leida.valor) { plan.iguales++; return { texto, estado: 'igual', antes, valor: antes }; }
      plan.cambios.push({ itemId: act.id, studentId: alumno.id, value: leida.valor });
      if (antes === null) { plan.nuevas++; return { texto, estado: 'nueva', antes, valor: leida.valor }; }
      plan.cambian++;
      return { texto, estado: 'cambia', antes, valor: leida.valor };
    });
    plan.filas.push({ alumnoId: alumno.id, nombre: alumno.name, ...(etiqueta ? { etiqueta } : {}), descuadra, celdas });
  });
  return plan;
}

/* ── Poner una nota a quien no tiene ── */

/** Quién no tiene nota en una actividad, en el orden de la lista. */
export function sinNota<A extends { id: string }>(alumnado: A[], notasDeActividad: Record<string, number | null> | undefined): A[] {
  return alumnado.filter(a => typeof notasDeActividad?.[a.id] !== 'number');
}

/** Los cambios de poner `valor` a quien no tiene nota en una actividad: nunca pisa una nota que ya está. */
export function cambiosDeRelleno(
  itemId: string, alumnado: { id: string }[], notasDeActividad: Record<string, number | null> | undefined, valor: number,
): CambioDeNota[] {
  return sinNota(alumnado, notasDeActividad).map(a => ({ itemId, studentId: a.id, value: valor }));
}

/** De los cambios pedidos, los que de verdad cambian algo respecto a las notas que hay. */
export function cambiosReales(cambios: CambioDeNota[], notas: GradeMap): CambioDeNota[] {
  return cambios.filter(c => (notas[c.itemId]?.[c.studentId] ?? null) !== c.value);
}

/** Las notas con los cambios puestos (sin tocar el mapa que llega). */
export function conCambios(notas: GradeMap, cambios: CambioDeNota[]): GradeMap {
  if (cambios.length === 0) return notas;
  const out: GradeMap = { ...notas };
  const copiadas = new Set<string>();
  for (const c of cambios) {
    if (!copiadas.has(c.itemId)) { out[c.itemId] = { ...(out[c.itemId] ?? {}) }; copiadas.add(c.itemId); }
    out[c.itemId][c.studentId] = c.value;
  }
  return out;
}

/** Si la pantalla se maneja con el dedo (tableta o móvil): ahí calificar en lista es más cómodo que en la tabla. */
export function pantallaTactil(): boolean {
  try { return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches; } catch { return false; }
}
