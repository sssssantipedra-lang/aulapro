/**
 * Poner fechas a las sesiones de una vez (20-11-2026, de la revisión a fondo de la app: fechar una situación de
 * aprendizaje de 8 sesiones costaba más de 30 toques mirando el horario aparte, y si se perdía una clase había
 * que recolocar a mano cada sesión posterior).
 *
 * «Poner fechas» reparte las sesiones, en su orden, en los huecos de la clase en el horario semanal a partir del
 * día que se elige, saltando las vacaciones y los días no lectivos del calendario escolar y los días que el
 * docente quite a mano. «No se dio» pasa una sesión al hueco siguiente y empuja a las que vienen detrás solo
 * mientras se pisen. Sin horario, una sesión cada tantos días lectivos.
 *
 * Aquí va la cuenta, sin pantalla y sin IA: propone y dice por qué se salta cada día; aplicar lo decide el
 * docente (`components/sesiones/PonerFechas.tsx`). Nada sale del dispositivo.
 */
import type { ScheduleBlock } from '../types';
import type { SesionEF } from '../types/ef';
import type { ComunidadId } from './curriculum/comunidades';
import type { ProvinciaId } from './provincias';
import { calendarioDe, cursoDe, diaEscolar, type ArchivoCalendarios, type EtapaCalendario } from './calendarioEscolar';
import { aMinutos } from './claseQueToca';
import { fromIsoDate, shiftDate } from './utils';

/** Por qué un día con clase en el horario se queda sin sesión. */
export type MotivoSalto =
  | { tipo: 'vacaciones' | 'no-lectivo'; nombre: string }
  /** Antes del primer día de clase o después del último. */
  | { tipo: 'fuera-de-curso' }
  /** Lo ha quitado el docente (un festivo local, una excursión). */
  | { tipo: 'quitado' };

export interface DiaSaltado { fecha: string; motivo: MotivoSalto }

/** Un hueco: un día con clase y, si sale del horario, su hora. `saltos`, los días que se han saltado para llegar a él. */
export interface Hueco { fecha: string; hora?: string; fin?: string; asignatura?: string; saltos: DiaSaltado[] }

/** Dónde hay clase: lo que hace falta para saber qué días valen. */
export interface DondeHayClase {
  /** Los bloques del horario en los que se dan estas sesiones (de su clase y de la asignatura elegida). Vacío, sin horario. */
  bloques: readonly ScheduleBlock[];
  /** Sin horario: una sesión cada tantos días lectivos, de lunes a viernes (1, todos). */
  cadaDias?: number;
  /** Por qué ese día no hay clase según el calendario escolar; `null` si la hay. */
  noLectivo?: (iso: string) => MotivoSalto | null;
  /** Los días que el docente ha quitado a mano. */
  quitados?: ReadonlySet<string>;
  /** El último día que vale (el final del curso): lo que no quepa antes se queda sin fecha. */
  hasta?: string;
}

/** Cuántos días se miran como mucho en busca de huecos: un curso entero. */
export const DIAS_QUE_SE_MIRAN = 370;
/** Dos bloques del mismo día separados por estos minutos o menos son la misma clase (dos horas seguidas, una sesión). */
export const MINUTOS_SEGUIDOS = 5;

/** 1 = lunes … 7 = domingo, como `ScheduleBlock.day`. */
export const diaDeLaSemana = (iso: string): number => fromIsoDate(iso).getDay() || 7;

export interface Franja { hora: string; fin: string; asignatura: string }

/**
 * Las clases de un día de la semana: los bloques ordenados por su hora, con los que van seguidos unidos en uno
 * (una hora doble es una sesión, no dos). Los bloques sin una hora válida no cuentan.
 */
export function franjasDelDia(bloques: readonly ScheduleBlock[], dia: number): Franja[] {
  const delDia = bloques
    .filter(b => Number(b.day) === dia)
    .map(b => ({ b, ini: aMinutos(b.time_start), fin: aMinutos(b.time_end) }))
    .filter((x): x is { b: ScheduleBlock; ini: number; fin: number } => x.ini !== null && x.fin !== null && x.fin > x.ini)
    .sort((x, y) => x.ini - y.ini);
  const out: (Franja & { finMin: number })[] = [];
  for (const { b, ini, fin } of delDia) {
    const ultima = out[out.length - 1];
    if (ultima && ini - ultima.finMin <= MINUTOS_SEGUIDOS) {
      if (fin > ultima.finMin) { ultima.fin = b.time_end; ultima.finMin = fin; }
      continue;
    }
    out.push({ hora: b.time_start, fin: b.time_end, asignatura: b.subject, finMin: fin });
  }
  return out.map(({ hora, fin, asignatura }) => ({ hora, fin, asignatura }));
}

/** Las clases de cada día de la semana (1 a 7), solo los días que tienen alguna: para decir «lunes 9:00, jueves 11:30». */
export function franjasDeLaSemana(bloques: readonly ScheduleBlock[]): { dia: number; franjas: Franja[] }[] {
  return [1, 2, 3, 4, 5, 6, 7].map(dia => ({ dia, franjas: franjasDelDia(bloques, dia) })).filter(x => x.franjas.length > 0);
}

/**
 * Los primeros `cuantos` huecos desde `desde` (ese día incluido). Con horario, cada clase de la semana es un
 * hueco; sin él, un día lectivo de cada `cadaDias`, de lunes a viernes. Cada hueco lleva los días con clase que
 * se han saltado justo antes de él y por qué. Devuelve menos si no caben antes de `hasta` o del tope de días.
 */
export function huecosDesde(donde: DondeHayClase, desde: string, cuantos: number): Hueco[] {
  const out: Hueco[] = [];
  if (cuantos <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(desde)) return out;
  const conHorario = franjasDeLaSemana(donde.bloques).length > 0;
  const cada = Math.max(1, Math.round(donde.cadaDias ?? 1));
  let saltos: DiaSaltado[] = [];
  let lectivos = 0;
  for (let i = 0, fecha = desde; i < DIAS_QUE_SE_MIRAN && out.length < cuantos; i++, fecha = shiftDate(fecha, 1)) {
    if (donde.hasta && fecha > donde.hasta) break;
    const dia = diaDeLaSemana(fecha);
    const franjas = conHorario ? franjasDelDia(donde.bloques, dia) : (dia <= 5 ? [null] : []);
    if (franjas.length === 0) continue;
    const motivo: MotivoSalto | null = donde.quitados?.has(fecha) ? { tipo: 'quitado' } : (donde.noLectivo?.(fecha) ?? null);
    if (motivo) { saltos.push({ fecha, motivo }); continue; }
    if (!conHorario) {
      // Sin horario se cuenta en días lectivos: el primero vale y, después, uno de cada tantos
      if (lectivos++ % cada !== 0) continue;
      out.push({ fecha, saltos });
      saltos = [];
      continue;
    }
    for (const f of franjas) {
      if (out.length >= cuantos || !f) break;
      out.push({ fecha, hora: f.hora, fin: f.fin, asignatura: f.asignatura, saltos });
      saltos = [];
    }
  }
  return out;
}

/** La fecha que se propone para una sesión: la que tenía (`antes`), la nueva y lo que se ha saltado para llegar. */
export interface FechaPropuesta { id: string; antes?: string; fecha: string; hora?: string; saltos: DiaSaltado[] }

export interface Reparto {
  propuestas: FechaPropuesta[];
  /** Las sesiones que no caben antes del final (se quedan como estaban). */
  sinHueco: string[];
}

type SesionConFecha = Pick<SesionEF, 'id' | 'fecha' | 'completada'>;

/**
 * Reparte las sesiones (en el orden en que llegan) en los huecos desde `desde`. Las que ya se dieron
 * (`completada`) no se tocan: conservan su día y no gastan hueco.
 */
export function repartir(sesiones: readonly SesionConFecha[], donde: DondeHayClase, desde: string): Reparto {
  const pendientes = sesiones.filter(s => !s.completada);
  const huecos = huecosDesde(donde, desde, pendientes.length);
  return {
    propuestas: huecos.map((h, i) => ({
      id: pendientes[i].id, ...(pendientes[i].fecha ? { antes: pendientes[i].fecha } : {}),
      fecha: h.fecha, ...(h.hora ? { hora: h.hora } : {}), saltos: h.saltos,
    })),
    sinHueco: pendientes.slice(huecos.length).map(s => s.id),
  };
}

/**
 * «No se dio»: la sesión `id` pasa a la primera clase de un día posterior al suyo, y las que vienen detrás (en el
 * orden del grupo, con fecha y sin completar) se corren al hueco siguiente solo mientras se pisen con la
 * anterior: en cuanto una cabe donde estaba, esa y las demás se quedan como estaban. Las que no tienen fecha no
 * se tocan. Solo salen en `propuestas` las que cambian de día.
 */
export function correrDesde(sesiones: readonly SesionConFecha[], id: string, donde: DondeHayClase): Reparto {
  const k = sesiones.findIndex(s => s.id === id);
  const primera = sesiones[k];
  if (!primera?.fecha) return { propuestas: [], sinHueco: [] };
  const detras = sesiones.slice(k + 1).filter((s): s is SesionConFecha & { fecha: string } => !!s.fecha && !s.completada);
  // Como mucho hace falta un hueco por sesión, más los del propio día que se pierde
  const huecos = huecosDesde(donde, primera.fecha, detras.length + 1 + 12);
  const propuestas: FechaPropuesta[] = [];
  const sinHueco: string[] = [];

  let i = huecos.findIndex(h => h.fecha > primera.fecha!);
  if (i < 0) return { propuestas: [], sinHueco: [primera.id, ...detras.map(s => s.id)] };
  propuestas.push({ id: primera.id, antes: primera.fecha, fecha: huecos[i].fecha, ...(huecos[i].hora ? { hora: huecos[i].hora } : {}), saltos: huecos[i].saltos });

  for (let n = 0; n < detras.length; n++) {
    const s = detras[n];
    // Cabe donde estaba: va después del hueco que ocupa la anterior
    if (s.fecha > huecos[i].fecha) break;
    // El mismo día que la anterior y ese día tiene otra clase libre detrás: no cambia de día, pero la gasta
    const siguiente = huecos[i + 1];
    if (!siguiente) { sinHueco.push(...detras.slice(n).map(x => x.id)); break; }
    i += 1;
    if (siguiente.fecha === s.fecha) continue;
    propuestas.push({ id: s.id, antes: s.fecha, fecha: siguiente.fecha, ...(siguiente.hora ? { hora: siguiente.hora } : {}), saltos: siguiente.saltos });
  }
  return { propuestas, sinHueco };
}

/** Las sesiones con las fechas propuestas puestas; las demás, tal cual. */
export function aplicarFechas<T extends { id: string; fecha?: string }>(sesiones: readonly T[], propuestas: readonly Pick<FechaPropuesta, 'id' | 'fecha'>[]): T[] {
  const nuevas = new Map(propuestas.map(p => [p.id, p.fecha]));
  return sesiones.map(s => (nuevas.has(s.id) && nuevas.get(s.id) !== s.fecha ? { ...s, fecha: nuevas.get(s.id) } : s));
}

/** Varios días seguidos saltados por lo mismo, dichos de una vez: «del 23 de diciembre al 7 de enero: vacaciones de Navidad». */
export interface TramoSaltado { desde: string; hasta: string; dias: number; motivo: MotivoSalto }

const mismoMotivo = (a: MotivoSalto, b: MotivoSalto) =>
  a.tipo === b.tipo && ('nombre' in a ? a.nombre : '') === ('nombre' in b ? b.nombre : '');

export function resumirSaltos(saltos: readonly DiaSaltado[]): TramoSaltado[] {
  const out: TramoSaltado[] = [];
  for (const s of saltos) {
    const ultimo = out[out.length - 1];
    if (ultimo && mismoMotivo(ultimo.motivo, s.motivo)) { ultimo.hasta = s.fecha; ultimo.dias += 1; } else out.push({ desde: s.fecha, hasta: s.fecha, dias: 1, motivo: s.motivo });
  }
  return out;
}

/* ══════════════ El calendario escolar ══════════════ */

/**
 * Por qué un día no hay clase según el calendario escolar de la comunidad, para las etapas de la clase:
 * vacaciones, día no lectivo o fuera del curso. Sin calendario para ese curso no se sabe: se da por lectivo y
 * el docente quita a mano los días sin clase.
 */
export function motivoNoLectivo(
  archivo: ArchivoCalendarios, comunidad: ComunidadId | undefined, provincia: ProvinciaId | null | undefined, etapas: readonly EtapaCalendario[],
): (iso: string) => MotivoSalto | null {
  return iso => {
    const cal = calendarioDe(archivo, comunidad, cursoDe(fromIsoDate(iso)), provincia);
    if (!cal) return null;
    const dia = diaEscolar(cal, iso);
    if (dia) return { tipo: dia.tipo, nombre: dia.nombre };
    const cursos = etapas.map(e => cal.clases[e]).filter(c => c !== undefined);
    return cursos.length > 0 && !cursos.some(c => iso >= c.inicio && iso <= c.fin) ? { tipo: 'fuera-de-curso' } : null;
  };
}

/** El 31 de agosto del curso escolar de ese día: más allá no se reparte. */
export function finDelCursoDe(iso: string): string {
  return `${cursoDe(fromIsoDate(iso)).slice(5)}-08-31`;
}

/* ══════════════ En qué horas se dan: la asignatura ══════════════ */

const llano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Las asignaturas que la clase tiene en el horario, por orden de horas a la semana. */
export function asignaturasDeClase(bloques: readonly ScheduleBlock[], claseId: string | undefined): string[] {
  const cuenta = new Map<string, { nombre: string; n: number }>();
  for (const b of bloques) {
    if (!claseId || b.class_id !== claseId) continue;
    const k = llano(b.subject);
    const x = cuenta.get(k);
    if (x) x.n += 1; else cuenta.set(k, { nombre: b.subject, n: 1 });
  }
  return [...cuenta.values()].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es')).map(x => x.nombre);
}

/**
 * Las asignaturas que salen marcadas al abrir: las que se parecen a alguna pista (las áreas de la situación de
 * aprendizaje, «Educación Física» en ese perfil); si la clase solo tiene una, esa; si no, ninguna, y el docente
 * elige (repartir en todas las horas de un tutor de Primaria pondría cinco sesiones al día).
 */
export function asignaturasPropuestas(asignaturas: readonly string[], pistas: readonly string[]): string[] {
  if (asignaturas.length <= 1) return [...asignaturas];
  const claves = pistas.map(llano).filter(p => p.length >= 3);
  return asignaturas.filter(a => { const x = llano(a); return claves.some(p => x === p || x.includes(p) || p.includes(x)); });
}

/** Los bloques de la clase en esas asignaturas. */
export function bloquesDe(bloques: readonly ScheduleBlock[], claseId: string | undefined, asignaturas: readonly string[]): ScheduleBlock[] {
  if (!claseId) return [];
  const elegidas = new Set(asignaturas.map(llano));
  return bloques.filter(b => b.class_id === claseId && elegidas.has(llano(b.subject)));
}

/* ══════════════ Lo elegido la última vez, en el dispositivo ══════════════ */

const CLAVE = 'aulapro_reparto_sesiones';
const MAX_RECORDADOS = 120;

export interface RepartoRecordado { asignaturas?: string[]; cadaDias?: number }

function leerRecordados(): Record<string, RepartoRecordado> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, RepartoRecordado>) : {};
  } catch {
    return {};
  }
}

/** Lo que se eligió la última vez para ese grupo de sesiones (clase y situación de aprendizaje). */
export function repartoRecordado(grupo: string): RepartoRecordado {
  const r = leerRecordados()[grupo];
  if (!r || typeof r !== 'object') return {};
  return {
    ...(Array.isArray(r.asignaturas) ? { asignaturas: r.asignaturas.filter((x): x is string => typeof x === 'string') } : {}),
    ...(typeof r.cadaDias === 'number' && r.cadaDias >= 1 && r.cadaDias <= 10 ? { cadaDias: Math.round(r.cadaDias) } : {}),
  };
}

export function recordarReparto(grupo: string, r: RepartoRecordado): void {
  try {
    const todos = leerRecordados();
    delete todos[grupo];
    todos[grupo] = r;
    const claves = Object.keys(todos);
    for (const k of claves.slice(0, Math.max(0, claves.length - MAX_RECORDADOS))) delete todos[k];
    localStorage.setItem(CLAVE, JSON.stringify(todos));
  } catch {
    /* sin sitio o sin permiso: la próxima vez se vuelve a elegir */
  }
}
