/**
 * La clase activa (20-11-2026): una sola regla para decidir qué clase abre cualquier pantalla que
 * trabaja clase a clase (cuaderno, asistencia, actas, informes, distribución, Educación Física…).
 * Antes cada pantalla decidía por su cuenta y casi todas abrían la primera de la lista.
 *
 * Por orden:
 *  1. la que la pantalla recibe pedida (una tarjeta del Inicio, «Anotar actitud» desde el cuaderno);
 *  2. la de ahora: la que está en marcha según el horario y el calendario escolar o, si no hay
 *     ninguna, la que empieza en los próximos `MARGEN_ANTES` minutos;
 *  3. la última con la que se trabajó en cualquier pantalla (se recuerda en el dispositivo, por perfil);
 *  4. la siguiente de hoy y, sin horario, la primera.
 *
 * Todo es local: ni la clase recordada ni la hora salen del dispositivo.
 */
import type { Class, ScheduleBlock } from '../types';
import { aMinutos, bloqueQueToca, enMarcha } from './claseQueToca';
import { calendarios, esLectivo, type ArchivoCalendarios, type EtapaCalendario } from './calendarioEscolar';
import type { ComunidadId } from './curriculum/comunidades';
import type { ProvinciaId } from './provincias';

/** Minutos antes de empezar en los que una clase ya cuenta como «la de ahora» (se abre la app al entrar en el aula). */
export const MARGEN_ANTES = 10;

type ConId = Pick<Class, 'id'>;

export interface ClaseDeAhora {
  id: string;
  /** `true` si está en marcha; `false` si está a punto de empezar. */
  enMarcha: boolean;
  desde: string;
  hasta: string;
}

/**
 * La clase de ahora según el horario: la que está en marcha o, si no hay ninguna, la que empieza
 * en los próximos `MARGEN_ANTES` minutos. `null` fuera de eso, o si el día no es lectivo.
 */
export function claseDeAhora(
  classes: ConId[], blocks: ScheduleBlock[], now = new Date(), lectivo = true,
): ClaseDeAhora | null {
  const b = bloqueQueToca(classes as Class[], blocks, now, lectivo);
  if (!b) return null;
  const marcha = enMarcha(b, now);
  if (!marcha) {
    const falta = (aMinutos(b.time_start) ?? Infinity) - (now.getHours() * 60 + now.getMinutes());
    if (falta > MARGEN_ANTES) return null;
  }
  return { id: b.class_id, enMarcha: marcha, desde: b.time_start, hasta: b.time_end };
}

/** Por qué se abre esa clase (para anotarla como usada y para decirlo en pantalla). */
export type MotivoDeClase = 'pedida' | 'ahora' | 'ultima' | 'siguiente' | 'primera' | '';

export interface ClaseAlAbrir { id: string; motivo: MotivoDeClase }

/** La regla. `classes` son las clases que la pantalla ofrece en su selector. */
export function claseAlAbrir(o: {
  classes: ConId[];
  blocks: ScheduleBlock[];
  now?: Date;
  lectivo?: boolean;
  /** La última clase con la que se trabajó en este dispositivo. */
  ultima?: string | null;
  /** La que pide quien abre la pantalla: manda sobre el horario. */
  pedida?: string | null;
}): ClaseAlAbrir {
  const { classes, blocks, now = new Date(), lectivo = true, ultima, pedida } = o;
  const esta = (id: string | null | undefined): id is string => !!id && classes.some(c => c.id === id);
  if (esta(pedida)) return { id: pedida, motivo: 'pedida' };
  const ahora = claseDeAhora(classes, blocks, now, lectivo);
  if (ahora) return { id: ahora.id, motivo: 'ahora' };
  if (esta(ultima)) return { id: ultima, motivo: 'ultima' };
  const siguiente = bloqueQueToca(classes as Class[], blocks, now, lectivo);
  if (siguiente) return { id: siguiente.class_id, motivo: 'siguiente' };
  const primera = classes[0]?.id ?? '';
  return { id: primera, motivo: primera ? 'primera' : '' };
}

/** Si hoy hay clase según el calendario escolar de la comunidad, para las etapas de esas clases. */
export function hayClaseHoy(
  archivo: ArchivoCalendarios, classes: Pick<Class, 'etapa'>[], comunidad: ComunidadId | undefined,
  provincia: ProvinciaId | null | undefined, now = new Date(),
): boolean {
  const e = new Set(classes.map(c => c.etapa).filter((x): x is EtapaCalendario => x === 'primaria' || x === 'eso'));
  return esLectivo(archivo, comunidad, now, e.size ? [...e] : ['primaria', 'eso'], provincia);
}

/* ══════════════ La última clase usada: en el dispositivo, por perfil ══════════════ */

const CLAVE = 'aulapro_clase_activa_';
/** Copia en memoria: si el navegador no deja guardar, al menos se recuerda mientras la app está abierta. */
const enMemoria = new Map<string, string>();

export function ultimaClase(perfil: string): string | null {
  const m = enMemoria.get(perfil);
  if (m) return m;
  try { return localStorage.getItem(CLAVE + perfil) || null; } catch { return null; }
}

export function recordarClase(perfil: string, id: string): void {
  if (!id || enMemoria.get(perfil) === id) return;
  enMemoria.set(perfil, id);
  try { localStorage.setItem(CLAVE + perfil, id); } catch { /* sin almacenamiento: queda en memoria */ }
}

/* ══════════════ La clase pedida al pasar de pantalla ══════════════ */

/**
 * Cuánto vale una petición: lo que tarda en abrirse la pantalla a la que se va (la primera vez se
 * descarga su código). Pasado ese tiempo ya no manda: la pantalla que se abra después sigue la regla.
 */
export const PEDIDA_VALE_MS = 15_000;
let pedida: { id: string; hasta: number } | null = null;

/**
 * Quien lleva a una pantalla con una clase concreta (una tarjeta de clase del Inicio, la franja
 * «Siguiente» de En clase) la pide antes de navegar: esa pantalla la abre aunque el horario diga otra.
 */
export function pedirClase(id: string, ahoraMs = Date.now()): void {
  pedida = id ? { id, hasta: ahoraMs + PEDIDA_VALE_MS } : null;
}

export function clasePedida(ahoraMs = Date.now()): string | null {
  return pedida && ahoraMs <= pedida.hasta ? pedida.id : null;
}

/** La pantalla que se abre la atiende una vez: la siguiente ya no la recibe. */
export function atenderClasePedida(): void {
  pedida = null;
}

/* ══════════════ Con el reloj, el calendario y el recuerdo de este dispositivo ══════════════ */

export interface DatosDeClaseActiva {
  /** El perfil abierto: la última clase se recuerda aparte para cada uno. */
  perfil: string;
  /** Todas las clases del docente (de sus etapas sale qué calendario escolar manda). */
  classes: Class[];
  blocks: ScheduleBlock[];
  comunidad?: ComunidadId;
  provincia?: ProvinciaId | null;
}

/** La clase que abre ahora mismo una pantalla que ofrece `classes` (por defecto, todas). */
export function claseAlAbrirAhora(
  d: DatosDeClaseActiva, classes: ConId[] = d.classes, pedidaPorLaPantalla?: string | null, now = new Date(),
): ClaseAlAbrir {
  return claseAlAbrir({
    classes, blocks: d.blocks, now,
    lectivo: hayClaseHoy(calendarios(), d.classes, d.comunidad, d.provincia, now),
    ultima: ultimaClase(d.perfil),
    pedida: pedidaPorLaPantalla ?? clasePedida(now.getTime()),
  });
}
