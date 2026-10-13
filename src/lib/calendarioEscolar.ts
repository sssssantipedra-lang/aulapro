/**
 * El calendario escolar de cada comunidad: inicio y fin de las clases,
 * vacaciones y días no lectivos (decisiones del dueño, 3-10-2026; ver
 * «Calendario escolar» en `docs/COMUNIDADES.md`).
 *
 * Sale de un JSON que se publica con la web (`web/sitio/calendario-escolar.json`,
 * en https://aulapro.app/calendario-escolar.json). La app lleva de serie el
 * mismo archivo, por si la primera vez no hay conexión; al abrirse descarga el
 * publicado y, si pasa las comprobaciones y es más nuevo, lo guarda en local.
 * Solo descarga: no envía nada del docente.
 *
 * Los días no lectivos no se guardan entre los eventos del docente
 * (`calEvents`): se calculan al pintar la Agenda, así que actualizarlos nunca
 * toca lo que el docente haya escrito. Los festivos locales dependen del
 * municipio y los añade el docente como un evento.
 *
 * Los nombres (vacaciones, festivos) van en castellano y se traducen con `t()`.
 */
import deSerie from '../../web/sitio/calendario-escolar.json';
import { textoNorma, type ComunidadId, type IdiomaApp, type Textos } from './curriculum/comunidades';
import { fromIsoDate, isoDate } from './utils';

export const URL_CALENDARIO = 'https://aulapro.app/calendario-escolar.json';
const CLAVE_LOCAL = 'aulapro_calendario_escolar';

export type EtapaCalendario = 'primaria' | 'eso';
const ETAPAS: EtapaCalendario[] = ['primaria', 'eso'];

export interface CalendarioCurso {
  comunidad: ComunidadId;
  /** «2026-2027». */
  curso: string;
  /** La norma que lo fija, en el idioma en que se publicó. */
  norma: Textos;
  url: string;
  /** `true` si las fechas se han comprobado contra el boletín, no solo contra fuentes de segunda mano. */
  verificado: boolean;
  clases: Partial<Record<EtapaCalendario, { inicio: string; fin: string }>>;
  vacaciones: { nombre: string; desde: string; hasta: string }[];
  noLectivos: { fecha: string; nombre: string }[];
}

export interface ArchivoCalendarios {
  version: 1;
  /** Fecha de la última revisión: se queda el archivo más nuevo. */
  actualizado: string;
  calendarios: CalendarioCurso[];
}

/* ══════════════ Comprobaciones ══════════════ */

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const esFecha = (v: unknown): v is string => typeof v === 'string' && ISO.test(v) && isoDate(fromIsoDate(v)) === v;
const esTexto = (v: unknown, max = 200): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const COMUNIDADES_CON_CALENDARIO = new Set<string>(['comunitat-valenciana', 'cataluna', 'madrid']);

/** Del 1 de septiembre del primer año al 31 de agosto del segundo. */
function limitesDelCurso(curso: string): [string, string] | null {
  const m = /^(\d{4})-(\d{4})$/.exec(curso);
  if (!m || Number(m[2]) !== Number(m[1]) + 1) return null;
  return [`${m[1]}-09-01`, `${m[2]}-08-31`];
}

function calendarioValido(c: unknown): c is CalendarioCurso {
  if (!c || typeof c !== 'object') return false;
  const x = c as Record<string, unknown>;
  if (typeof x.comunidad !== 'string' || !COMUNIDADES_CON_CALENDARIO.has(x.comunidad)) return false;
  const lim = typeof x.curso === 'string' ? limitesDelCurso(x.curso) : null;
  if (!lim) return false;
  const dentro = (f: unknown) => esFecha(f) && f >= lim[0] && f <= lim[1];
  const norma = x.norma as Record<string, unknown> | undefined;
  if (!norma || typeof norma !== 'object' || !(esTexto(norma.es, 300) || esTexto(norma.ca, 300))) return false;
  // La fuente siempre enlazada, y solo a una dirección segura
  if (typeof x.url !== 'string' || !x.url.startsWith('https://')) return false;
  if (typeof x.verificado !== 'boolean') return false;
  const clases = x.clases as Record<string, { inicio?: unknown; fin?: unknown }> | undefined;
  if (!clases || typeof clases !== 'object') return false;
  const etapas = Object.keys(clases);
  if (etapas.length === 0 || etapas.some(e => !ETAPAS.includes(e as EtapaCalendario))) return false;
  if (etapas.some(e => !dentro(clases[e].inicio) || !dentro(clases[e].fin) || (clases[e].inicio as string) >= (clases[e].fin as string))) return false;
  const vac = x.vacaciones, dias = x.noLectivos;
  if (!Array.isArray(vac) || !Array.isArray(dias)) return false;
  // Una cantidad razonable: ningún calendario tiene más de unos pocos periodos ni de unos treinta días sueltos
  if (vac.length > 6 || dias.length > 30) return false;
  if (!vac.every(v => v && esTexto(v.nombre, 80) && dentro(v.desde) && dentro(v.hasta) && v.desde <= v.hasta)) return false;
  if (!dias.every(d => d && esTexto(d.nombre, 80) && dentro(d.fecha))) return false;
  return true;
}

/**
 * El archivo, si pasa todas las comprobaciones: fechas que existen y caen
 * dentro de su curso, cantidades razonables y la fuente enlazada. Un
 * calendario que no las pasa invalida el archivo entero: mejor lo de antes
 * que un calendario a medias.
 */
export function validarArchivo(raw: unknown): ArchivoCalendarios | null {
  if (!raw || typeof raw !== 'object') return null;
  const x = raw as Record<string, unknown>;
  if (x.version !== 1 || !esFecha(x.actualizado) || !Array.isArray(x.calendarios)) return null;
  if (x.calendarios.length > 60 || !x.calendarios.every(calendarioValido)) return null;
  const vistos = new Set<string>();
  for (const c of x.calendarios as CalendarioCurso[]) {
    const k = `${c.comunidad}|${c.curso}`;
    if (vistos.has(k)) return null;
    vistos.add(k);
  }
  return raw as ArchivoCalendarios;
}

/* ══════════════ Qué es cada día ══════════════ */

/** El curso escolar de una fecha: de septiembre a agosto. */
export function cursoDe(fecha: Date): string {
  const y = fecha.getFullYear();
  return fecha.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/** Se conservan el curso actual y los siguientes; los anteriores se borran. */
export function sinCursosPasados(archivo: ArchivoCalendarios, hoy: Date): ArchivoCalendarios {
  const actual = cursoDe(hoy);
  return { ...archivo, calendarios: archivo.calendarios.filter(c => c.curso >= actual) };
}

export function calendarioDe(archivo: ArchivoCalendarios, comunidad: ComunidadId | undefined, curso: string): CalendarioCurso | null {
  return archivo.calendarios.find(c => c.comunidad === comunidad && c.curso === curso) ?? null;
}

/** Si la comunidad tiene algún calendario: para las demás, la Agenda no dice nada. */
export function tieneCalendario(archivo: ArchivoCalendarios, comunidad: ComunidadId | undefined): boolean {
  return archivo.calendarios.some(c => c.comunidad === comunidad);
}

export type DiaEscolar =
  | { tipo: 'vacaciones'; nombre: string }
  | { tipo: 'no-lectivo'; nombre: string };

/** Si ese día no hay clase por el calendario: vacaciones o un día no lectivo. Los fines de semana no cuentan. */
export function diaEscolar(cal: CalendarioCurso | null, iso: string): DiaEscolar | null {
  if (!cal) return null;
  const dia = cal.noLectivos.find(d => d.fecha === iso);
  if (dia) return { tipo: 'no-lectivo', nombre: dia.nombre };
  const vac = cal.vacaciones.find(v => iso >= v.desde && iso <= v.hasta);
  return vac ? { tipo: 'vacaciones', nombre: vac.nombre } : null;
}

/**
 * Si ese día hay clase según el calendario de la comunidad: no es vacaciones
 * ni día no lectivo y cae dentro del curso de alguna de las etapas que se dan.
 * Sin calendario para ese curso, se da por lectivo: manda el horario.
 */
export function esLectivo(
  archivo: ArchivoCalendarios, comunidad: ComunidadId | undefined, fecha: Date, etapas: EtapaCalendario[],
): boolean {
  const cal = calendarioDe(archivo, comunidad, cursoDe(fecha));
  if (!cal) return true;
  const iso = isoDate(fecha);
  if (diaEscolar(cal, iso)) return false;
  const cursos = etapas.map(e => cal.clases[e]).filter(c => c !== undefined);
  return cursos.length === 0 || cursos.some(c => iso >= c.inicio && iso <= c.fin);
}

/** El primer y el último día de clase de cada etapa que cae en ese día, para marcarlo. */
export interface MarcaDelDia { tipo: 'inicio' | 'fin'; etapa: EtapaCalendario }

export function marcasDelDia(cal: CalendarioCurso | null, iso: string, etapas: EtapaCalendario[]): MarcaDelDia[] {
  if (!cal) return [];
  return etapas.flatMap((etapa): MarcaDelDia[] => {
    const c = cal.clases[etapa];
    if (!c) return [];
    if (c.inicio === iso) return [{ tipo: 'inicio', etapa }];
    if (c.fin === iso) return [{ tipo: 'fin', etapa }];
    return [];
  });
}

export const citarCalendario = (cal: CalendarioCurso, idioma: IdiomaApp) => textoNorma(cal.norma, idioma);

/* ══════════════ De serie, guardado y descarga ══════════════ */

const DE_SERIE = validarArchivo(deSerie);
if (!DE_SERIE) throw new Error('calendario-escolar.json no pasa las comprobaciones');

function guardado(): ArchivoCalendarios | null {
  try {
    const raw = localStorage.getItem(CLAVE_LOCAL);
    return raw ? validarArchivo(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** El más nuevo de los dos: el guardado de la última descarga o el que trae la app. */
export function masNuevo(a: ArchivoCalendarios, b: ArchivoCalendarios | null): ArchivoCalendarios {
  return b && b.actualizado > a.actualizado ? b : a;
}

let actual: ArchivoCalendarios = DE_SERIE;
let leido = false;
const oyentes = new Set<() => void>();

export function calendarios(): ArchivoCalendarios {
  if (!leido) { leido = true; actual = masNuevo(DE_SERIE!, guardado()); }
  return actual;
}

export function suscribir(fn: () => void): () => void {
  oyentes.add(fn);
  return () => { oyentes.delete(fn); };
}

let descarga: Promise<void> | null = null;

/**
 * Descarga el calendario publicado, una vez por sesión. Sin conexión, o si
 * lo descargado no pasa las comprobaciones, sigue lo que había.
 */
export function actualizarCalendarios(hoy = new Date()): Promise<void> {
  if (descarga) return descarga;
  descarga = (async () => {
    if (typeof fetch !== 'function') return;
    const ctl = new AbortController();
    const espera = setTimeout(() => ctl.abort(), 10_000);
    try {
      const res = await fetch(URL_CALENDARIO, { signal: ctl.signal, cache: 'no-cache', credentials: 'omit' });
      if (!res.ok) return;
      const nuevo = validarArchivo(await res.json());
      if (!nuevo || nuevo.actualizado <= calendarios().actualizado) return;
      actual = sinCursosPasados(nuevo, hoy);
      try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify(actual)); } catch { /* lleno: vale para esta sesión */ }
      oyentes.forEach(fn => fn());
    } catch {
      /* sin conexión: sigue lo guardado */
    } finally {
      clearTimeout(espera);
    }
  })();
  return descarga;
}
