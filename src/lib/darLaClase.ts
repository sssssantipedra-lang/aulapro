/**
 * «Dar la clase» (20-11-2026, de la revisión a fondo de la app): la sesión preparada en Sesiones (o la de una
 * situación de aprendizaje que aún no se ha pasado a Sesiones) montada en «Pizarra y herramientas», en la
 * ventana «Plan del día»: los tres momentos con sus actividades como casillas, las imágenes a un toque y, en
 * Educación Física, su circuito.
 *
 * Aquí, lo que no depende de la pantalla y va con reglas, sin IA:
 *  - de una sesión a su plan (`planDeSesion`, `planDeSesionSda`). **Lo proyectado lo ve la clase**: solo salen
 *    el título de la sesión y el título y la descripción de cada actividad. Nunca el objetivo, el material,
 *    las medidas de inclusión, el plan B ni nada del alumnado;
 *  - qué sesión se propone en una ventana vacía y por qué (`sesionesParaProponer`);
 *  - a qué ventana va un plan sin borrar lo que hubiera (`ventanaParaPlan`, `fusionarPlan`);
 *  - el encargo que deja quien pulsa «Dar la clase» en otra pantalla y que la pizarra recoge al enseñarse
 *    (`encargarClase`, `tomarEncargo`), porque la pizarra sigue montada entre pantallas (`PizarraViva`).
 *
 * La ventana está en `components/live/PizarraWidgets.tsx` (`AgendaWidget`) y quien reparte, en
 * `pages/SecClassroom.tsx`. Las sesiones de PT y AL van por otro modelo y quedan fuera.
 */
import type { LearningSituation } from '../types';
import type { ImagenSesion, PizarraEF, SesionEF } from '../types/ef';
import { imagenesDeSesionSda } from './imagenesSesion';
import { claveDatos, huecoLibre, type Rect } from './pizarraAula';
import { activas, agruparPorSda } from './sesiones';

/* ── El plan ── */

/** De dónde sale el plan: una sesión de Sesiones o la sesión número `indice` (desde 0) de una SdA. */
export type OrigenPlan =
  | { tipo: 'sesion'; id: string }
  | { tipo: 'sda'; id: string; indice: number };

/**
 * Una casilla del plan del día. Las que escribe el docente a mano solo tienen `id`, `texto` y `hecha` (así se
 * guardaban antes de «Dar la clase» y así se siguen leyendo). Las de una sesión llevan su momento (0, 1 o 2) y,
 * si la hay, la descripción; su `id` empieza por `s`.
 */
export interface TareaPlan {
  id: string;
  texto: string;
  hecha: boolean;
  detalle?: string;
  momento?: 0 | 1 | 2;
}

/** Lo que la ventana recuerda de la sesión que tiene montada. */
export interface SesionEnPizarra {
  origen: OrigenPlan;
  titulo: string;
  /** Con los nombres de los momentos de Educación Física (activación, desarrollo y vuelta a la calma). */
  ef: boolean;
  claseId?: string;
}

export interface PlanDeClase { sesion: SesionEnPizarra; tareas: TareaPlan[] }

/** Lo que la pizarra conoce de las sesiones: llega desde `App`. */
export interface FuenteDeSesiones {
  sesiones: readonly SesionEF[];
  sdas: readonly LearningSituation[];
  /** Los circuitos dibujados en la pizarra de circuitos (Educación Física). */
  pizarras: readonly PizarraEF[];
  /** Perfil de Educación Física: sus sesiones llevan los nombres de los momentos de EF. */
  ef: boolean;
}

export const MAX_ACTIVIDADES_POR_MOMENTO = 12;
const MAX_TITULO = 140;
const MAX_DETALLE = 600;

const recortar = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s);

export const mismoOrigen = (a: OrigenPlan | null | undefined, b: OrigenPlan | null | undefined): boolean =>
  !!a && !!b && a.tipo === b.tipo && a.id === b.id && (a.tipo !== 'sda' || a.indice === (b as { indice: number }).indice);

/** Una casilla que viene de la sesión (y no escrita a mano por el docente). */
export const esDeSesion = (t: Pick<TareaPlan, 'id'>): boolean => /^s\d?-\d+$/.test(t.id);

const VINETA = /^\s*(?:[•·▪◦*–—-]+|\d{1,2}[.)]|[a-z]\))\s+/i;
/**
 * Lo que «Pasar a sesiones» añade detrás de la descripción de cada actividad (`actividadEnTexto`): cómo se
 * organiza y con qué material, en el idioma en que se creó. No se proyecta: el plan es título y descripción.
 */
const COLA = /\s(?:Organizaci[óo]n|Organitzaci[óo]|Organi[sz]ation|Materiale?s?):\s[\s\S]*$/;

/**
 * Parte una línea de una sesión en el título de la actividad y su descripción. Las sesiones se escriben en
 * texto libre, así que se reconocen las formas habituales: «Nombre (8 min): cómo se hace», «Nombre (8 min).
 * Cómo se hace», «Nombre: cómo se hace» y «Nombre. Cómo se hace». Una línea sin esa forma es toda título.
 */
export function partirActividad(linea: string): { titulo: string; detalle?: string } {
  const txt = linea.replace(VINETA, '').replace(/\s+/g, ' ').trim();
  if (!txt) return { titulo: '' };
  const m = /^(.{2,90}?\(\s*\d{1,3}\s*(?:min|['′’])[^)]{0,12}\))\s*[.:]?\s*(.*)$/i.exec(txt)
    ?? /^(.{2,70}?):\s+(.+)$/.exec(txt)
    ?? /^(.{2,70}?)\.\s+(.+)$/.exec(txt);
  if (!m) return { titulo: recortar(txt.replace(/[.:]$/, ''), MAX_TITULO) };
  const detalle = (' ' + m[2]).replace(COLA, '').trim();
  return { titulo: recortar(m[1].trim(), MAX_TITULO), ...(detalle ? { detalle: recortar(detalle, MAX_DETALLE) } : {}) };
}

const lineasDe = (texto: string | undefined): string[] =>
  (texto ?? '').split(/\r?\n+/).map(l => l.trim()).filter(l => l.replace(VINETA, '').trim()).slice(0, MAX_ACTIVIDADES_POR_MOMENTO);

const tarea = (momento: 0 | 1 | 2 | undefined, i: number, a: { titulo: string; detalle?: string }): TareaPlan => ({
  id: `s${momento ?? ''}-${i}`, texto: a.titulo, hecha: false,
  ...(a.detalle ? { detalle: a.detalle } : {}), ...(momento === undefined ? {} : { momento }),
});

/**
 * El plan de una sesión de Sesiones: una casilla por línea de su inicio (calentamiento), su desarrollo (parte
 * principal) y su cierre (vuelta a la calma). El objetivo, el material, las medidas de inclusión y el plan B
 * no salen: son del docente.
 */
export function planDeSesion(s: SesionEF, ef: boolean): PlanDeClase {
  const partes = [s.calentamiento, s.principal, s.calma];
  return {
    sesion: { origen: { tipo: 'sesion', id: s.id }, titulo: s.titulo.trim(), ef, ...(s.claseId ? { claseId: s.claseId } : {}) },
    tareas: partes.flatMap((texto, m) => lineasDe(texto)
      .map(partirActividad).filter(a => a.titulo)
      .map((a, i) => tarea(m as 0 | 1 | 2, i, a))),
  };
}

/**
 * El plan de la sesión número `indice` (desde 0) de una situación de aprendizaje: el nombre y la descripción
 * de cada actividad de sus tres momentos. Una SdA de antes, sin momentos, da las líneas de su descripción.
 */
export function planDeSesionSda(sda: LearningSituation, indice: number): PlanDeClase | null {
  const s = sda.content.sesiones[indice];
  if (!s) return null;
  const sesion: SesionEnPizarra = {
    origen: { tipo: 'sda', id: sda.id, indice }, titulo: `${indice + 1}. ${s.titulo}`.trim(), ef: !!sda.content.ef,
    ...(sda.class_id ? { claseId: sda.class_id } : {}),
  };
  if (!s.momentos) {
    return { sesion, tareas: lineasDe(s.descripcion).map(partirActividad).filter(a => a.titulo).map((a, i) => tarea(undefined, i, a)) };
  }
  const momentos = [s.momentos.preimpacto, s.momentos.impacto, s.momentos.postimpacto];
  return {
    sesion,
    tareas: momentos.flatMap((x, m) => {
      const actividades = x.actividades.filter(a => a.nombre.trim()).slice(0, MAX_ACTIVIDADES_POR_MOMENTO).map(a => ({
        titulo: recortar(`${a.nombre.trim()}${a.minutos ? ` (${a.minutos} min)` : ''}`, MAX_TITULO),
        ...(a.descripcion.trim() ? { detalle: recortar(a.descripcion.trim(), MAX_DETALLE) } : {}),
      }));
      // Un momento sin actividades pero con texto: sus líneas
      const lista = actividades.length ? actividades : lineasDe(x.texto).map(partirActividad).filter(a => a.titulo);
      return lista.map((a, i) => tarea(m as 0 | 1 | 2, i, a));
    }),
  };
}

/** Una imagen que se enseña a toda la pizarra con un toque: una de la sesión o su circuito dibujado. */
export interface ImagenDeVisor { src: string; pie?: string }

/** El plan de lo que se pide, o `null` si esa sesión ya no existe. */
export function planDeOrigen(fuente: FuenteDeSesiones, origen: OrigenPlan): PlanDeClase | null {
  if (origen.tipo === 'sesion') {
    const s = fuente.sesiones.find(x => x.id === origen.id);
    return s ? planDeSesion(s, fuente.ef) : null;
  }
  const sda = fuente.sdas.find(x => x.id === origen.id);
  return sda ? planDeSesionSda(sda, origen.indice) : null;
}

/** Lo que de la sesión se mira en el momento, sin guardarlo en la ventana: si está dada, sus imágenes y su circuito. */
export interface SesionViva { completada: boolean; imagenes: ImagenSesion[]; circuito?: PizarraEF }

export function sesionViva(fuente: FuenteDeSesiones, origen: OrigenPlan): SesionViva | null {
  if (origen.tipo === 'sesion') {
    const s = fuente.sesiones.find(x => x.id === origen.id);
    if (!s) return null;
    const circuito = s.pizarraId ? fuente.pizarras.find(p => p.id === s.pizarraId) : undefined;
    return { completada: !!s.completada, imagenes: imagenesDeSesionSda(s), ...(circuito ? { circuito } : {}) };
  }
  const s = fuente.sdas.find(x => x.id === origen.id)?.content.sesiones[origen.indice];
  return s ? { completada: !!s.completada, imagenes: imagenesDeSesionSda(s) } : null;
}

/**
 * Las casillas al volver a traer una sesión a una ventana. Si es la misma sesión que ya tenía, se conserva lo
 * marcado en las actividades que siguen igual; si es otra, las de la anterior se van. Lo que el docente
 * escribió a mano se queda siempre, al final.
 */
export function fusionarPlan(actuales: readonly TareaPlan[], nuevas: readonly TareaPlan[], mismaSesion: boolean): TareaPlan[] {
  const hechas = new Set(mismaSesion ? actuales.filter(t => esDeSesion(t) && t.hecha).map(t => `${t.momento ?? ''}|${t.texto}`) : []);
  return [
    ...nuevas.map(t => (hechas.has(`${t.momento ?? ''}|${t.texto}`) ? { ...t, hecha: true } : t)),
    ...actuales.filter(t => !esDeSesion(t)),
  ];
}

/** Si están marcadas todas las actividades de la sesión (y tiene alguna): entonces se propone darla por dada. */
export function sesionRecorrida(tareas: readonly TareaPlan[]): boolean {
  const deSesion = tareas.filter(esDeSesion);
  return deSesion.length > 0 && deSesion.every(t => t.hecha);
}

/** La clave de la sugerencia «marcar la sesión como dada» (`lib/sugerencias.ts`): cerrada, no vuelve a salir. */
export const claveSesionDada = (o: OrigenPlan): string => (o.tipo === 'sesion' ? `sesiondada:${o.id}` : `sesiondada:sda:${o.id}:${o.indice}`);

/* ── Qué sesión se propone, y por qué ── */

export interface PropuestaDeSesion {
  sesion: SesionEF;
  /** `hoy`: tiene fecha de hoy. `siguiente`: es la primera sin dar de su situación de aprendizaje o de la clase. */
  motivo: 'hoy' | 'siguiente';
  /** El título de su situación de aprendizaje, si la tiene. */
  sda?: string;
}

export const MAX_PROPUESTAS = 4;

/** Las sesiones sin dar de la clase que tienen fecha de hoy, en el orden en que se ven en Sesiones. */
export function sesionesDeHoy(
  fuente: Pick<FuenteDeSesiones, 'sesiones' | 'sdas'>, claseId: string, hoy: string,
): SesionEF[] {
  return sesionesParaProponer(fuente, claseId, hoy).filter(p => p.motivo === 'hoy').map(p => p.sesion);
}

/**
 * Lo que una ventana «Plan del día» vacía ofrece traer, de la clase elegida en la pizarra:
 *  1. las sesiones sin dar con fecha de hoy;
 *  2. de cada situación de aprendizaje (y de las sesiones sueltas) que no tenga ninguna para hoy, la primera
 *     sin dar que no esté fechada para más adelante: «Pasar a sesiones» las deja sin fecha y en su orden.
 * Como mucho `MAX_PROPUESTAS`. Las archivadas y las ya dadas no se proponen.
 */
export function sesionesParaProponer(
  fuente: Pick<FuenteDeSesiones, 'sesiones' | 'sdas'>, claseId: string, hoy: string,
): PropuestaDeSesion[] {
  const pendientes = activas(fuente.sesiones).filter(s => (s.claseId ?? '') === claseId && !s.completada);
  const grupos = agruparPorSda(pendientes, [...fuente.sdas]);
  const deHoy: PropuestaDeSesion[] = [];
  const siguientes: PropuestaDeSesion[] = [];
  for (const g of grupos) {
    const sda = g.sda?.title;
    const hoyDelGrupo = g.sesiones.filter(s => s.fecha === hoy);
    if (hoyDelGrupo.length) { deHoy.push(...hoyDelGrupo.map(sesion => ({ sesion, motivo: 'hoy' as const, ...(sda ? { sda } : {}) }))); continue; }
    const siguiente = g.sesiones.find(s => !s.fecha || s.fecha < hoy);
    if (siguiente) siguientes.push({ sesion: siguiente, motivo: 'siguiente', ...(sda ? { sda } : {}) });
  }
  return [...deHoy, ...siguientes].slice(0, MAX_PROPUESTAS);
}

/* ── A qué ventana va ── */

export interface VentanaDePlan { id: string; tareas: readonly TareaPlan[]; sesion: SesionEnPizarra | null }

/**
 * La ventana «Plan del día» a la que va lo que se pide, sin borrar nada:
 *  - si la sesión ya está montada en una, esa (`misma`: se conserva lo marcado);
 *  - si no, la primera que esté vacía (`vacia`);
 *  - si no hay ninguna así, `null`: se abre una ventana nueva y las que hubiera se quedan como estaban.
 * Sin sesión (solo abrir el plan del día): la vacía o, si no, la primera que haya.
 */
export function ventanaParaPlan(ventanas: readonly VentanaDePlan[], origen: OrigenPlan | null): { id: string; modo: 'misma' | 'vacia' } | null {
  const misma = origen ? ventanas.find(v => mismoOrigen(v.sesion?.origen, origen)) : undefined;
  if (misma) return { id: misma.id, modo: 'misma' };
  const vacia = ventanas.find(v => v.tareas.length === 0 && !v.sesion);
  if (vacia) return { id: vacia.id, modo: 'vacia' };
  return !origen && ventanas[0] ? { id: ventanas[0].id, modo: 'misma' } : null;
}

/**
 * Sitio para el plan del día sin tapar a nadie: el primer hueco libre con su tamaño y, si no lo hay, con menos
 * alto (de `paso` en `paso`, hasta `minAlto`): en un móvil, entre las barras y los iconos de las ventanas
 * minimizadas no cabe entero. Antes se recorta a lo que dejan libre las barras. `null` si no cabe ni así.
 */
export function huecoParaPlan(
  tam: { width: number; height: number }, minAlto: number, ocupados: readonly Rect[], area: { width: number; height: number },
  margen: { arriba: number; abajo: number; lados: number }, paso = 40,
): Rect | null {
  const width = Math.min(tam.width, area.width - 2 * margen.lados);
  const alto = Math.min(tam.height, area.height - margen.arriba - margen.abajo);
  for (let height = alto; height >= minAlto; height -= paso) {
    const r = huecoLibre({ width, height }, ocupados, area, margen);
    if (r) return r;
  }
  return null;
}

/* ── Lo guardado en cada ventana (en el dispositivo, como el resto de la pizarra) ── */

export const esTareas = (x: unknown): x is TareaPlan[] =>
  Array.isArray(x) && x.every(e => {
    if (!e || typeof e !== 'object') return false;
    const t = e as Record<string, unknown>;
    return typeof t.id === 'string' && typeof t.texto === 'string' && typeof t.hecha === 'boolean'
      && (t.detalle === undefined || typeof t.detalle === 'string')
      && (t.momento === undefined || t.momento === 0 || t.momento === 1 || t.momento === 2);
  });

export const esSesionEnPizarra = (x: unknown): x is SesionEnPizarra | null => {
  if (x === null) return true;
  if (!x || typeof x !== 'object') return false;
  const s = x as Record<string, unknown>;
  const o = s.origen as Record<string, unknown> | undefined;
  return typeof s.titulo === 'string' && typeof s.ef === 'boolean' && !!o && typeof o.id === 'string'
    && (o.tipo === 'sesion' || (o.tipo === 'sda' && typeof o.indice === 'number'));
};

/** Los campos de una ventana «Plan del día»: sus casillas y la sesión que tiene montada. */
export const CAMPO_PLAN = 'plan';
export const CAMPO_SESION = 'sesion';

function leer<T>(clave: string, valida: (x: unknown) => x is T): T | undefined {
  try {
    const raw = localStorage.getItem(clave);
    if (raw === null) return undefined;
    const x: unknown = JSON.parse(raw);
    return valida(x) ? x : undefined;
  } catch { return undefined; }
}

/** Lo que tiene ahora una ventana «Plan del día», leído de donde ella lo guarda. */
export function leerPlanDeVentana(id: string): VentanaDePlan {
  return {
    id,
    tareas: leer(claveDatos(id, CAMPO_PLAN), esTareas) ?? [],
    sesion: leer(claveDatos(id, CAMPO_SESION), esSesionEnPizarra) ?? null,
  };
}

/** Deja en una ventana sus casillas y su sesión; la ventana lo lee al montarse. */
export function escribirPlanDeVentana(id: string, tareas: readonly TareaPlan[], sesion: SesionEnPizarra | null): void {
  try {
    localStorage.setItem(claveDatos(id, CAMPO_PLAN), JSON.stringify(tareas));
    localStorage.setItem(claveDatos(id, CAMPO_SESION), JSON.stringify(sesion));
  } catch { /* sin almacenamiento: la ventana se abre vacía y ofrece traer la sesión */ }
}

/* ── El encargo: de la pantalla donde se pulsa «Dar la clase» a la pizarra ── */

/** Lo que se pide a la pizarra: la clase y, si la hay, la sesión ya convertida en plan (`null`: solo abrir el plan del día). */
export interface EncargoDeClase { claseId?: string; plan: PlanDeClase | null }

/** Un encargo que la pizarra no ha recogido en este tiempo (no llegó a abrirse) se olvida. */
export const ENCARGO_VALE_MS = 60_000;

let pendiente: { encargo: EncargoDeClase; hasta: number } | null = null;
const oyentes = new Set<() => void>();

/**
 * Deja un encargo para la pizarra. Se llama justo antes de ir a ella: si ya está montada (sigue viva entre
 * pantallas), lo recoge en cuanto se enseña; si no, al montarse.
 */
export function encargarClase(encargo: EncargoDeClase, ahoraMs = Date.now()): void {
  pendiente = { encargo, hasta: ahoraMs + ENCARGO_VALE_MS };
  [...oyentes].forEach(f => f());
}

export function hayEncargo(ahoraMs = Date.now()): boolean {
  return !!pendiente && ahoraMs <= pendiente.hasta;
}

/** La pizarra recoge el encargo una sola vez. */
export function tomarEncargo(ahoraMs = Date.now()): EncargoDeClase | null {
  const p = pendiente;
  pendiente = null;
  return p && ahoraMs <= p.hasta ? p.encargo : null;
}

/** Avisa a `f` cuando llega un encargo, y ya mismo si hay uno esperando. Devuelve cómo dejar de escuchar. */
export function suscribirEncargo(f: () => void): () => void {
  oyentes.add(f);
  if (hayEncargo()) f();
  return () => { oyentes.delete(f); };
}
