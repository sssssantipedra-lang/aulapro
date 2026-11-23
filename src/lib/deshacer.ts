/**
 * «Deshacer» tras un borrado (20-11-2026, de la revisión a fondo de la app: ningún borrado tenía vuelta atrás y la
 * única salida era restaurar una copia entera).
 *
 * Cómo funciona: el estado de la app es inmutable, así que justo antes de borrar se guardan las referencias de
 * todo el perfil (`antes`) y, en el primer pintado tras el borrado, las de después (`despues`). Deshacer es
 * reponer las colecciones que cambiaron, tal como estaban: lo borrado vuelve con todo lo que se fue con él (al
 * eliminar una clase se van su alumnado, sus notas, su asistencia…). Solo se puede deshacer el último borrado y
 * mientras lo que se tocó siga como quedó: si el docente cambia después algo de esas mismas colecciones, reponer
 * las de antes se llevaría ese cambio, así que el aviso se retira.
 *
 * Aquí va la lógica sin pantalla (qué se borró, cómo se dice y cuándo deja de valer); el estado vive en
 * `hooks/useAppState.ts` y el aviso, en `components/ui/AvisoDeshacer.tsx`.
 */
import type { ApoyoData } from '../types/apoyo';
import type { EfData } from '../types/ef';

/** Lo que dura el aviso con el botón «Deshacer». */
export const DURACION_DESHACER_MS = 10_000;

export type TipoBorrado =
  | 'tarea' | 'clase' | 'alumno' | 'bloque' | 'horario' | 'evento'
  | 'rubrica' | 'diana' | 'escala' | 'evaluacion' | 'categoria' | 'columna' | 'lista' | 'informe'
  | 'autoevaluacion' | 'sda' | 'ficha' | 'reunion' | 'formacion' | 'anotacion'
  | 'grupo' | 'programa' | 'documento' | 'coordinacion' | 'adaptacion' | 'agenda' | 'foto'
  | 'exento' | 'apoyoEF' | 'prueba' | 'baremo' | 'actividad' | 'sesion' | 'material' | 'instalacion' | 'circuito' | 'pizarra'
  /** No es un borrado sino un cambio que también se deshace: las fechas de varias sesiones puestas o corridas de una vez. */
  | 'fechas'
  /** Tampoco es un borrado: los informes de seguimiento de toda una clase, creados de una vez (deshacer los quita). */
  | 'informesCreados';

/** Una cosa borrada, para decirla en el aviso. */
export interface Borrado {
  tipo: TipoBorrado;
  /** El nombre de lo borrado (o de su alumno o su clase), si lo tiene. */
  nombre?: string;
  /** Un día, YYYY-MM-DD (la lista de asistencia). */
  fecha?: string;
  /** Cuántas se fueron de una vez, si son más de una. */
  cuantos?: number;
}

/**
 * Cómo se dice cada cosa borrada, detrás de «Has eliminado…»: con su nombre (`uno`), sin él (`sin`) y varias a la
 * vez (`varios`). Son claves de traducción (el texto en castellano, como en el resto de la app): están en
 * `i18n/tanda/deshacer.ts` y una prueba comprueba que no falte ninguna en inglés ni en catalán.
 */
export const DICHO: Record<TipoBorrado, { uno?: string; sin: string; varios?: string }> = {
  tarea: { uno: 'la tarea «{nombre}»', sin: 'una tarea', varios: '{n} tareas' },
  clase: { uno: 'la clase «{nombre}» y todo lo suyo', sin: 'una clase y todo lo suyo', varios: '{n} clases y todo lo suyo' },
  alumno: { uno: 'a {nombre} y todo lo suyo', sin: 'un alumno y todo lo suyo', varios: '{n} alumnos y todo lo suyo' },
  bloque: { uno: 'el bloque «{nombre}» del horario', sin: 'un bloque del horario', varios: '{n} bloques del horario' },
  horario: { sin: 'el horario entero' },
  evento: { uno: 'el evento «{nombre}»', sin: 'un evento', varios: '{n} eventos' },
  rubrica: { uno: 'la rúbrica «{nombre}»', sin: 'una rúbrica', varios: '{n} rúbricas' },
  diana: { uno: 'la diana «{nombre}»', sin: 'una diana', varios: '{n} dianas' },
  escala: { uno: 'la escala de registro «{nombre}»', sin: 'una escala de registro', varios: '{n} escalas de registro' },
  evaluacion: { uno: 'la evaluación de {nombre}', sin: 'una evaluación', varios: '{n} evaluaciones' },
  categoria: { uno: 'la categoría «{nombre}» y sus notas', sin: 'una categoría y sus notas', varios: '{n} categorías y sus notas' },
  columna: { uno: 'la columna «{nombre}» y sus notas', sin: 'una columna del cuaderno y sus notas', varios: '{n} columnas del cuaderno y sus notas' },
  lista: { uno: 'la lista de asistencia de {nombre} del {fecha}', sin: 'la lista de asistencia de un día', varios: '{n} listas de asistencia' },
  informe: { uno: 'el informe de {nombre}', sin: 'un informe', varios: '{n} informes' },
  autoevaluacion: { uno: 'la autoevaluación «{nombre}»', sin: 'una autoevaluación', varios: '{n} autoevaluaciones' },
  sda: { uno: 'la situación de aprendizaje «{nombre}»', sin: 'una situación de aprendizaje', varios: '{n} situaciones de aprendizaje' },
  ficha: { uno: 'la ficha «{nombre}»', sin: 'una ficha', varios: '{n} fichas' },
  reunion: { uno: 'la reunión «{nombre}»', sin: 'una reunión', varios: '{n} reuniones' },
  formacion: { uno: 'la formación «{nombre}»', sin: 'una formación', varios: '{n} formaciones' },
  anotacion: { uno: 'una anotación de {nombre}', sin: 'una anotación', varios: '{n} anotaciones' },
  grupo: { uno: 'el grupo «{nombre}» y sus registros', sin: 'un grupo y sus registros', varios: '{n} grupos y sus registros' },
  programa: { uno: 'el programa «{nombre}» y sus objetivos', sin: 'un programa y sus objetivos', varios: '{n} programas y sus objetivos' },
  documento: { uno: 'el documento «{nombre}»', sin: 'un documento', varios: '{n} documentos' },
  coordinacion: { sin: 'una coordinación', varios: '{n} coordinaciones' },
  adaptacion: { uno: 'la adaptación curricular de {nombre}', sin: 'una adaptación curricular', varios: '{n} adaptaciones curriculares' },
  agenda: { uno: 'la agenda «{nombre}»', sin: 'una agenda', varios: '{n} agendas' },
  foto: { sin: 'una foto', varios: '{n} fotos' },
  exento: { uno: 'la exención o lesión de {nombre}', sin: 'una exención o lesión', varios: '{n} exenciones o lesiones' },
  apoyoEF: { uno: 'el nivel de apoyo de {nombre}', sin: 'un nivel de apoyo', varios: '{n} niveles de apoyo' },
  prueba: { uno: 'la prueba «{nombre}» y sus marcas', sin: 'una prueba y sus marcas', varios: '{n} pruebas y sus marcas' },
  baremo: { sin: 'un baremo', varios: '{n} baremos' },
  actividad: { uno: 'la actividad «{nombre}»', sin: 'una actividad', varios: '{n} actividades' },
  sesion: { uno: 'la sesión «{nombre}»', sin: 'una sesión', varios: '{n} sesiones' },
  material: { uno: '«{nombre}» del inventario', sin: 'un material del inventario', varios: '{n} materiales del inventario' },
  instalacion: { uno: 'la instalación «{nombre}»', sin: 'una instalación', varios: '{n} instalaciones' },
  circuito: { uno: 'el circuito «{nombre}»', sin: 'un circuito', varios: '{n} circuitos' },
  pizarra: { uno: 'la pizarra «{nombre}»', sin: 'una pizarra', varios: '{n} pizarras' },
  fechas: { sin: 'la fecha de una sesión', varios: 'la fecha de {n} sesiones' },
  informesCreados: { sin: 'un informe de seguimiento', varios: '{n} informes de seguimiento' },
};

/** La frase del aviso y la de varios tipos mezclados. */
export const FRASE_BORRADO = 'Has eliminado {que}.';
export const VARIOS_ELEMENTOS = '{n} elementos';
/**
 * Lo que no es un borrado sino un cambio de varias cosas a la vez que se deshace igual (se apunta antes de
 * hacerlo, con `apuntarCambio` de `useAppState`): el aviso dice «Has cambiado…» en vez de «Has eliminado…».
 */
export const FRASE_CAMBIO = 'Has cambiado {que}.';
/** Y lo que se crea de golpe (los informes de seguimiento de una clase): «Has creado…». */
export const FRASE_CREADO = 'Has creado {que}.';
const CREADOS: ReadonlySet<TipoBorrado> = new Set<TipoBorrado>(['informesCreados']);
const CAMBIOS: ReadonlySet<TipoBorrado> = new Set<TipoBorrado>(['fechas', ...CREADOS]);
/** Si lo apuntado es un cambio y no un borrado (para el dibujo del aviso). */
export const esCambio = (borrados: readonly Borrado[]): boolean => borrados.length > 0 && borrados.every(b => CAMBIOS.has(b.tipo));

/** Todas las claves de traducción de este archivo (para la prueba que exige las tres lenguas). */
export function clavesDeDeshacer(): string[] {
  const out = [FRASE_BORRADO, FRASE_CAMBIO, FRASE_CREADO, VARIOS_ELEMENTOS];
  for (const d of Object.values(DICHO)) out.push(...[d.uno, d.sin, d.varios].filter((x): x is string => !!x));
  return out;
}

type Traducir = (clave: string, vars?: Record<string, string | number>) => string;

/** Un nombre largo (una tarea, el título de una ficha) no cabe en el aviso: se corta. */
function corto(nombre: string, max = 48): string {
  const limpio = nombre.replace(/\s+/g, ' ').trim();
  return limpio.length > max ? limpio.slice(0, max - 1).trimEnd() + '…' : limpio;
}

function diaLegible(fecha: string, locale: string): string {
  const d = new Date(fecha + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? fecha : d.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
}

/**
 * Lo que dice el aviso: «Has eliminado la clase «3.º A» y todo lo suyo.». Varias cosas del mismo tipo se cuentan
 * («3 sesiones») y, si son de tipos distintos, se dice cuántas son.
 */
export function textoDeBorrados(borrados: Borrado[], t: Traducir, locale = 'es-ES'): string {
  const total = borrados.reduce((n, b) => n + Math.max(1, b.cuantos ?? 1), 0);
  const primero = borrados[0];
  let que: string;
  if (!primero) que = t(VARIOS_ELEMENTOS, { n: 0 });
  else if (borrados.some(b => b.tipo !== primero.tipo)) que = t(VARIOS_ELEMENTOS, { n: total });
  else {
    const dicho = DICHO[primero.tipo];
    const nombre = corto(primero.nombre ?? '');
    if (total > 1) que = dicho.varios ? t(dicho.varios, { n: total }) : t(dicho.sin);
    else if (dicho.uno && nombre && (!dicho.uno.includes('{fecha}') || primero.fecha)) {
      que = t(dicho.uno, { nombre, fecha: primero.fecha ? diaLegible(primero.fecha, locale) : '' });
    } else que = t(dicho.sin);
  }
  const creados = borrados.length > 0 && borrados.every(b => CREADOS.has(b.tipo));
  return t(creados ? FRASE_CREADO : esCambio(borrados) ? FRASE_CAMBIO : FRASE_BORRADO, { que });
}

/* ── El borrado pendiente de deshacer ── */

/** El último borrado, mientras se puede deshacer. `T` es el perfil entero, colección a colección. */
export interface BorradoPendiente<T> {
  /** Cambia con cada borrado: el aviso vuelve a contar su tiempo. */
  id: number;
  /** El perfil en el que se borró: en otro no vale. */
  perfil: string | null;
  borrados: Borrado[];
  /** Las colecciones como estaban justo antes de borrar. */
  antes: T;
  /** Como quedaron tras el borrado; `null` hasta el primer pintado después de él. */
  despues: T | null;
}

/**
 * Anota un borrado. Varios borrados seguidos en el mismo gesto (aún sin pintar, `despues` vacío) son uno solo:
 * se conserva el `antes` del primero y se suman los nombres. Si ya había otro pendiente, lo sustituye: solo se
 * puede deshacer el último.
 */
export function anotarBorrado<T>(
  prev: BorradoPendiente<T> | null,
  nuevo: { id: number; perfil: string | null; borrados: Borrado[]; antes: T },
): BorradoPendiente<T> {
  if (prev && !prev.despues && prev.perfil === nuevo.perfil) return { ...prev, borrados: [...prev.borrados, ...nuevo.borrados] };
  return { ...nuevo, despues: null };
}

/**
 * Si dos colecciones tienen lo mismo. Casi siempre basta con que sean la misma referencia; pero un borrado que no
 * encuentra nada que borrar (`filter` devuelve otra lista con los mismos elementos) o un cambio que deja las cosas
 * como estaban no cuentan como cambio, así que se mira hasta tres niveles (la asistencia es clase, día y alumno).
 */
export function mismoContenido(a: unknown, b: unknown, niveles = 3): boolean {
  if (Object.is(a, b)) return true;
  if (niveles <= 0 || typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => mismoContenido(x, b[i], niveles - 1));
  }
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  const ra = a as Record<string, unknown>, rb = b as Record<string, unknown>;
  return ka.every(k => k in rb && mismoContenido(ra[k], rb[k], niveles - 1));
}

/** Las colecciones que el borrado cambió. */
export function coleccionesTocadas<T extends object>(p: BorradoPendiente<T>, claves: readonly (keyof T)[]): (keyof T)[] {
  const despues = p.despues;
  return despues ? claves.filter(k => !mismoContenido(p.antes[k], despues[k])) : [];
}

/**
 * Lo que toca hacer con el borrado pendiente en cada pintado. Devuelve el mismo objeto si nada cambia; uno nuevo
 * con el `despues` recién visto, la primera vez; y `null` si ya no se puede deshacer: se cambió de perfil, el
 * borrado no borró nada, o después se ha tocado alguna de las colecciones que cambió (reponer las de antes se
 * llevaría ese cambio).
 */
export function borradoAlPintar<T extends object>(
  p: BorradoPendiente<T> | null, perfil: string | null, ahora: T, claves: readonly (keyof T)[],
): BorradoPendiente<T> | null {
  if (!p) return null;
  if (p.perfil !== perfil) return null;
  if (!p.despues) return claves.some(k => !mismoContenido(p.antes[k], ahora[k])) ? { ...p, despues: ahora } : null;
  const despues = p.despues;
  return coleccionesTocadas(p, claves).some(k => !mismoContenido(ahora[k], despues[k])) ? null : p;
}

/** Lo que hay que reponer para deshacer: cada colección que cambió, como estaba antes. */
export function loQueVuelve<T extends object>(p: BorradoPendiente<T>, claves: readonly (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of coleccionesTocadas(p, claves)) out[k] = p.antes[k];
  return out;
}

/* ── PT y AL y Educación Física: qué se ha borrado ── */

/**
 * Las pantallas de PT y AL y de Educación Física cambian su parte del perfil con una función (`setApoyo`,
 * `setEf`), sin un «borrar» propio para cada cosa. Para ofrecerles el mismo «Deshacer» sin tocar cada pantalla,
 * se compara el antes y el después de cada cambio: es un borrado si una lista de las de abajo pierde elementos
 * y no gana ninguno (guardar uno editado o sustituirlo quita y pone; eso no es borrar). Manda la primera lista
 * de este orden que pierde algo: lo demás se fue con ella (los programas y registros de un alumno, las marcas
 * de una prueba) y vuelve con ella. No entran lo que se marca y se desmarca (niveles, parejas, marcas sueltas,
 * cierres de trimestre) ni lo que se quita dentro de un elemento (un objetivo de un programa, un paso de una agenda).
 *
 * Tampoco lo que sale de una lista sin que el docente haya borrado nada: la sesión del Registro diario de PT y AL
 * deja de guardarse sola cuando se queda sin datos (al desmarcar lo único marcado o vaciar el tema), y una prueba
 * física de serie solo está en la lista mientras está oculta, así que «Mostrar» la saca de ella (`cuenta`).
 */
type Nombrar<E> = (e: E, nombreDeAlumno: (id: string) => string | undefined) => string | undefined;

type Elemento<D, K extends keyof D> = D[K] extends (infer E)[] ? E : never;

interface ListaVigilada<D, K extends keyof D> {
  clave: K; tipo: TipoBorrado; nombre?: Nombrar<Elemento<D, K>>;
  /** Si la salida de este elemento es un borrado (por defecto, sí). */
  cuenta?: (e: Elemento<D, K>) => boolean;
}

function vigilar<D>() {
  return <K extends keyof D>(clave: K, tipo: TipoBorrado, nombre?: Nombrar<Elemento<D, K>>, cuenta?: (e: Elemento<D, K>) => boolean): ListaVigilada<D, K> => ({ clave, tipo, nombre, cuenta });
}

const deApoyo = vigilar<ApoyoData>();
const LISTAS_APOYO = [
  deApoyo('alumnos', 'alumno', a => a.nombre),
  deApoyo('grupos', 'grupo', g => g.nombre),
  deApoyo('programas', 'programa', p => p.ambito),
  deApoyo('acs', 'adaptacion', (a, alumno) => alumno(a.alumnoId)),
  deApoyo('acsAula', 'adaptacion', (a, alumno) => alumno(a.alumnoId)),
  deApoyo('documentos', 'documento', d => d.titulo),
  deApoyo('coordinaciones', 'coordinacion'),
  deApoyo('agendas', 'agenda', a => a.titulo),
  deApoyo('fotos', 'foto'),
];

const deEF = vigilar<EfData>();
const LISTAS_EF = [
  // Las de serie no se borran: solo están en la lista mientras están ocultas, y «Mostrar» las saca de ella
  deEF('pruebas', 'prueba', p => p.nombre, p => !!p.propia),
  deEF('sesiones', 'sesion', s => s.titulo),
  deEF('actividades', 'actividad', a => a.titulo),
  deEF('circuitos', 'circuito', c => c.nombre),
  deEF('pizarras', 'pizarra', p => p.nombre),
  deEF('material', 'material', m => m.nombre),
  deEF('instalaciones', 'instalacion', i => i.nombre),
  deEF('exentos', 'exento', (e, alumno) => alumno(e.alumnoId)),
  deEF('apoyos', 'apoyoEF', (a, alumno) => alumno(a.alumnoId)),
  deEF('baremos', 'baremo'),
];

function idos<E extends { id: string }>(antes: E[] | undefined, despues: E[] | undefined): E[] {
  if (antes === despues || !antes?.length) return [];
  const quedan = new Set((despues ?? []).map(x => x.id));
  const fuera = antes.filter(x => !quedan.has(x.id));
  if (!fuera.length) return [];
  // Si además entra alguno nuevo, es una sustitución (guardar con otro id), no un borrado
  const habia = new Set(antes.map(x => x.id));
  return (despues ?? []).some(x => !habia.has(x.id)) ? [] : fuera;
}

function borradoDe<D>(
  listas: ListaVigilada<D, keyof D>[], antes: D, despues: D, nombreDeAlumno: (id: string) => string | undefined,
): Borrado[] {
  if (antes === despues) return [];
  for (const l of listas) {
    const cuenta = l.cuenta as ((e: { id: string }) => boolean) | undefined;
    const fuera = idos(antes[l.clave] as { id: string }[] | undefined, despues[l.clave] as { id: string }[] | undefined)
      .filter(e => !cuenta || cuenta(e));
    if (!fuera.length) continue;
    if (fuera.length > 1) return [{ tipo: l.tipo, cuantos: fuera.length }];
    const nombre = l.nombre ? (l.nombre as Nombrar<{ id: string }>)(fuera[0], nombreDeAlumno) : undefined;
    return [{ tipo: l.tipo, nombre: nombre?.trim() || undefined }];
  }
  return [];
}

/** Lo que un cambio de PT y AL ha borrado (vacío si no ha borrado nada). `nombreDeAlumno`, para las adaptaciones del aula. */
export function borradoDeApoyo(antes: ApoyoData, despues: ApoyoData, nombreDeAlumno: (id: string) => string | undefined = () => undefined): Borrado[] {
  const deApoyoODeAula = (id: string) => antes.alumnos.find(a => a.id === id)?.nombre ?? nombreDeAlumno(id);
  return borradoDe(LISTAS_APOYO as ListaVigilada<ApoyoData, keyof ApoyoData>[], antes, despues, deApoyoODeAula);
}

/** Lo que un cambio de Educación Física ha borrado (vacío si no ha borrado nada). */
export function borradoDeEF(antes: EfData, despues: EfData, nombreDeAlumno: (id: string) => string | undefined = () => undefined): Borrado[] {
  return borradoDe(LISTAS_EF as ListaVigilada<EfData, keyof EfData>[], antes, despues, nombreDeAlumno);
}
