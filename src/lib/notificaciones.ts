/**
 * Avisos (25-11-2026, petición del dueño): una campana con el número de avisos y un panel con la lista. No es
 * una entrada del menú: sigue la norma de las funciones «inteligentes» del 18-11-2026 (dentro de lo que existe,
 * siempre con su porqué, con reglas y sin IA, y nada sale del dispositivo).
 *
 * Recoge cuatro cosas, con las reglas que ya tiene la app:
 *   - los eventos de la Agenda a los que les faltan `DIAS_CERCA` días o menos (de hoy a dentro de 5; nunca los
 *     ya pasados), que además parpadean en la Agenda y en el Inicio (`components/MarcaCerca.tsx`);
 *   - el alumnado que necesita atención, con las reglas y el umbral del radar (`lib/radarClase.ts`), el mismo que
 *     «Necesitan atención» del Inicio (sin los avisos escritos a mano en la ficha: son notas fijas, no algo que
 *     atender ahora, y el número no bajaría nunca);
 *   - las notas a medio poner: actividades de la evaluación de hoy que la mitad de la clase o más ya tiene
 *     calificadas y a las que les falta la nota de alguien (la regla de `columnasACompletar`, `lib/sugerencias.ts`),
 *     sin contar al alumnado exento de Educación Física ese día, que nunca tendrá marca;
 *   - las tareas sin marcar como hechas (las del Inicio).
 *
 * Aquí está todo lo que se puede probar sin pantalla: cuántos días faltan (con fechas locales, nunca UTC), qué
 * entra, en qué orden (primero lo más urgente) y qué avisos ha ocultado el docente con «Ya lo he visto». Un aviso
 * oculto vuelve si cambia su motivo: un evento cuando pasa a ser mañana u hoy, o cambia de día; un alumno cuando
 * la regla que lo trae es otra o habla de otra asignatura o competencia, o a las 4 semanas (lo que mira el radar ya es de otras semanas). Las tareas no se
 * ocultan: se marcan como hechas.
 */
import type { CalEvent, Class, GradeCategory, GradeItem, GradeMap, Student, Task } from '../types';
import type { AlumnoEnRadar, Radar } from './radarClase';
import { columnasACompletar } from './sugerencias';
import { isMarksCategory } from '../services/classMarks';

/** Hasta cuántos días antes un evento cuenta como cercano (de hoy, 0, a dentro de 5). */
export const DIAS_CERCA = 5;

const FECHA = /^(\d{4})-(\d{2})-(\d{2})/;

/** Los días de un AAAA-MM-DD contados como días de calendario, sin horas ni zona horaria. */
function diaNumero(iso: string): number | null {
  const m = FECHA.exec(iso ?? '');
  if (!m) return null;
  const [y, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // Date.UTC con los números del día: no hay cambio de hora ni zona de por medio, solo días de calendario
  const f = new Date(Date.UTC(y, mes - 1, d));
  // Una fecha imposible («2026-04-31») no es una fecha: Date la pasaría al mes siguiente y la Agenda no la pinta
  if (f.getUTCFullYear() !== y || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== d) return null;
  return Math.round(f.getTime() / 86_400_000);
}

/**
 * Cuántos días faltan de `hoy` a `fecha`, las dos en AAAA-MM-DD locales (`isoDate`): 0 hoy, 1 mañana, negativo si
 * ya pasó. `null` si alguna no es una fecha.
 */
export function diasHasta(fecha: string, hoy: string): number | null {
  const a = diaNumero(fecha), b = diaNumero(hoy);
  return a === null || b === null ? null : a - b;
}

/** Los días que faltan si la fecha está cerca (de 0 a `DIAS_CERCA`); si no, `null`. */
export function diasSiCerca(fecha: string, hoy: string): number | null {
  const d = diasHasta(fecha, hoy);
  return d !== null && d >= 0 && d <= DIAS_CERCA ? d : null;
}

type T = (clave: string, vars?: Record<string, string | number>) => string;

/** «Hoy», «Mañana», «Faltan 3 días». */
export function textoDeFalta(dias: number, t: T): string {
  if (dias <= 0) return t('Hoy');
  if (dias === 1) return t('Mañana');
  return t('Faltan {n} días', { n: dias });
}

/* ── Los avisos ── */

export type TipoAviso = 'evento' | 'alumno' | 'notas' | 'tarea';

interface Base {
  /** Lo identifica, con su motivo dentro: si el motivo cambia, la clave cambia y un aviso oculto vuelve. */
  clave: string;
  /** Para ordenar: más alto, más urgente. */
  urgencia: number;
}
export type Aviso =
  | (Base & { tipo: 'evento'; evento: CalEvent; dias: number; clase: Class | null })
  | (Base & { tipo: 'alumno' } & AlumnoEnRadar)
  | (Base & {
    tipo: 'notas'; item: GradeItem; cls: Class; faltan: Student[]; total: number;
    /** La asignatura de la actividad (la de su categoría o, sin ella, la principal de la clase), para abrir el cuaderno en ella. */
    asignatura: string;
  })
  | (Base & { tipo: 'tarea'; tarea: Task });

/** El orden de los grupos cuando empatan en urgencia, y el de siempre en las pruebas. */
export const TIPOS: readonly TipoAviso[] = ['evento', 'alumno', 'notas', 'tarea'];

/**
 * Cuánto apremia cada cosa. Un evento de hoy es lo primero (100) y uno a cinco días, 50; uno de urgencia alta,
 * un poco más. Un alumno con un dato grave (peso 85 o más, el rojo del Inicio), 70; si no, 60. Una tarea de
 * prioridad alta, 65; media, 45; baja, 35. Unas notas a medio poner, 40.
 */
export const urgenciaDeEvento = (dias: number, urgencia: CalEvent['urgency']) => 100 - 10 * dias + (urgencia === 'alta' ? 5 : 0);
const URGENCIA_TAREA: Record<Task['priority'], number> = { high: 65, medium: 45, low: 35 };
const URGENCIA_NOTAS = 40;

export interface DatosDeAvisos {
  /** Hoy, AAAA-MM-DD local. */
  hoy: string;
  calEvents: CalEvent[];
  classes: Class[];
  students: Student[];
  /** El radar del alumnado; sin él (o en un perfil sin Mis clases), no hay avisos de alumnado. */
  radar?: Radar;
  /** Las actividades y categorías guardadas (sin el bloque automático de «Trabajo diario y actitud»). */
  gradeItems: GradeItem[];
  gradeCategories: GradeCategory[];
  grades: GradeMap;
  tasks: Task[];
  /** Si una actividad cuenta en la evaluación de hoy (`cuentaEn` de `lib/periodos.ts`). Sin ella, cuentan todas. */
  enEvaluacion?: (fecha: string | undefined) => boolean;
  /** Las pantallas que el perfil tiene: sin el Cuaderno no hay notas a medio poner, y sin Mis clases, alumnado. */
  conCuaderno?: boolean;
  conAlumnado?: boolean;
  /**
   * Si un alumno estaba exento ese día (Educación Física, `exentosDelDia` de `lib/ef.ts`): no tendrá marca en la
   * prueba y no cuenta para las notas a medio poner, o el aviso no se iría nunca.
   */
  exentoEn?: (alumno: string, fecha: string) => boolean;
}

export function avisosDe(d: DatosDeAvisos): Aviso[] {
  const out: Aviso[] = [];
  const clases = new Map(d.classes.map(c => [c.id, c]));

  // Eventos: de hoy a dentro de 5 días; los ya pasados, no
  for (const ev of d.calEvents) {
    const dias = diasSiCerca(ev.date, d.hoy);
    if (dias === null) continue;
    // Lo que cambia el motivo: el día, y pasar a ser mañana u hoy
    const tramo = dias === 0 ? 'hoy' : dias === 1 ? 'manana' : 'pronto';
    out.push({
      tipo: 'evento', clave: `evento:${ev.id}:${ev.date}:${tramo}`, urgencia: urgenciaDeEvento(dias, ev.urgency),
      evento: ev, dias, clase: (ev.classId && clases.get(ev.classId)) || null,
    });
  }

  // Alumnado: el radar, con su umbral; un aviso por alumno, el de su dato más grave
  if (d.conAlumnado !== false) {
    for (const x of d.radar?.atencion ?? []) {
      // En la clave van la regla y de qué habla (la asignatura, la competencia), no sus números: si la media baja
      // de 4,2 a 4,0 sigue siendo lo mismo, pero si lo que va mal es otra asignatura, el aviso vuelve
      const deQue = Object.entries(x.dato.vars ?? {}).filter(([, v]) => typeof v === 'string').map(([k, v]) => `${k}=${v}`).sort().join('&');
      out.push({ tipo: 'alumno', clave: `alumno:${x.student.id}:${x.dato.clave}${deQue ? `:${deQue}` : ''}`, urgencia: x.dato.peso >= 85 ? 70 : 60, ...x });
    }
  }

  // Notas a medio poner: las actividades de la evaluación de hoy, ya fechadas (no las de un examen que aún no ha llegado)
  if (d.conCuaderno !== false) {
    const cuenta = d.enEvaluacion ?? (() => true);
    for (const cls of d.classes) {
      const principal = (cls.subjects?.length ? cls.subjects : [cls.subject]).filter(Boolean)[0] ?? '';
      const propias = new Map(d.gradeCategories.filter(c => c.class_id === cls.id && !isMarksCategory(c.id)).map(c => [c.id, c]));
      const items = d.gradeItems.filter(i => i.class_id === cls.id && propias.has(i.category_id)
        && cuenta(i.date) && (!i.date || i.date.slice(0, 10) <= d.hoy));
      const alumnos = d.students.filter(s => s.class_id === cls.id);
      const porId = new Map(alumnos.map(s => [s.id, s]));
      const ids = alumnos.map(s => s.id);
      // Sin exentos, todas de una vez; con ellos, cada actividad con quien no lo estaba su día
      const columnas = d.exentoEn
        ? items.flatMap(i => {
          const dia = (i.date || d.hoy).slice(0, 10);
          return columnasACompletar([i], d.grades, ids.filter(id => !d.exentoEn!(id, dia))).map(c => ({ ...c, total: ids.filter(id => !d.exentoEn!(id, dia)).length }));
        }).sort((a, b) => (b.item.date || '').localeCompare(a.item.date || ''))
        : columnasACompletar(items, d.grades, ids).map(c => ({ ...c, total: ids.length }));
      for (const c of columnas) {
        out.push({
          tipo: 'notas', clave: `notas:${c.item.id}`, urgencia: URGENCIA_NOTAS,
          item: c.item, cls, faltan: c.faltan.map(id => porId.get(id)!).filter(Boolean), total: c.total,
          asignatura: propias.get(c.item.category_id)?.subject ?? principal,
        });
      }
    }
  }

  // Tareas sin hacer
  for (const tarea of d.tasks) {
    if (!tarea.done) out.push({ tipo: 'tarea', clave: `tarea:${tarea.id}`, urgencia: URGENCIA_TAREA[tarea.priority] ?? URGENCIA_TAREA.medium, tarea });
  }

  // Lo más urgente primero; a igual urgencia, el orden de los tipos y, entre eventos, el de antes por hora
  return out
    .map((a, i) => ({ a, i }))
    .sort((x, y) => y.a.urgencia - x.a.urgencia
      || TIPOS.indexOf(x.a.tipo) - TIPOS.indexOf(y.a.tipo)
      || ordenEvento(x.a) - ordenEvento(y.a)
      || x.i - y.i)
    .map(x => x.a);
}

/** Entre dos eventos igual de urgentes, el que va antes por hora. */
const ordenEvento = (a: Aviso) => (a.tipo === 'evento' ? aMinutos(a.evento.time) : 0);
const aMinutos = (h: string | undefined) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(h ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60;
};

export interface GrupoDeAvisos { tipo: TipoAviso; avisos: Aviso[] }

/** Los avisos agrupados por tipo, para el panel: el grupo con lo más urgente, primero. */
export function agrupar(avisos: Aviso[]): GrupoDeAvisos[] {
  const grupos: GrupoDeAvisos[] = [];
  for (const a of avisos) {
    const g = grupos.find(x => x.tipo === a.tipo);
    if (g) g.avisos.push(a); else grupos.push({ tipo: a.tipo, avisos: [a] });
  }
  return grupos;
}

/* ── «Ya lo he visto»: lo que el docente ha ocultado, en este dispositivo ── */

/** Lo oculto: la clave del aviso y el día en que se ocultó. */
export type Ocultos = Record<string, string>;

/** Cuántos días dura oculto un aviso de alumnado: lo que mira el radar (4 semanas) ya es de otras semanas. */
export const CADUCA_ALUMNO = 28;
const MAXIMO = 400;

/** Si un aviso ocultado el día `dia` sigue oculto `hoy`. */
export function sigueOculto(clave: string, dia: string | undefined, hoy: string): boolean {
  if (!dia) return false;
  if (!clave.startsWith('alumno:')) return true;
  const d = diasHasta(dia, hoy);
  return d !== null && -d < CADUCA_ALUMNO;
}

/** Los avisos que se ven y los que el docente ha ocultado. Las tareas nunca se ocultan. */
export function separar(avisos: Aviso[], ocultos: Ocultos, hoy: string): { visibles: Aviso[]; ocultos: Aviso[] } {
  const visibles: Aviso[] = [], fuera: Aviso[] = [];
  for (const a of avisos) {
    if (a.tipo !== 'tarea' && sigueOculto(a.clave, ocultos[a.clave], hoy)) fuera.push(a); else visibles.push(a);
  }
  return { visibles, ocultos: fuera };
}

const claveDe = (perfil: string) => `aulapro_avisos_vistos_${perfil}`;

export function leerOcultos(perfil: string): Ocultos {
  try {
    const v = JSON.parse(localStorage.getItem(claveDe(perfil)) ?? '{}');
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string'));
  } catch { return {}; }
}

function guardar(perfil: string, o: Ocultos): Ocultos {
  // Solo los últimos `MAXIMO`: los más antiguos son de avisos que ya no salen
  const lista = Object.entries(o).sort((a, b) => a[1].localeCompare(b[1])).slice(-MAXIMO);
  const n = Object.fromEntries(lista);
  try { localStorage.setItem(claveDe(perfil), JSON.stringify(n)); } catch { /* sin almacenamiento: dura esta visita */ }
  return n;
}

/** Oculta un aviso («Ya lo he visto») y devuelve lo oculto nuevo. */
export function ocultarAviso(perfil: string, clave: string, hoy: string): Ocultos {
  return guardar(perfil, { ...leerOcultos(perfil), [clave]: hoy });
}

/** Vuelve a enseñar los avisos ocultos que se le pasan (los que hoy siguen saliendo). */
export function volverAEnsenar(perfil: string, claves: string[]): Ocultos {
  const o = { ...leerOcultos(perfil) };
  for (const c of claves) delete o[c];
  return guardar(perfil, o);
}
