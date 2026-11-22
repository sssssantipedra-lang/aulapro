/**
 * La Agenda enseña todo lo que tiene fecha (20-11-2026, de la revisión a fondo de la app: no pintaba las sesiones,
 * los exámenes del cuaderno ni las reuniones, y el docente apuntaba el examen dos veces).
 *
 * Además de los eventos del docente, el mes y la semana llevan «capas» de solo lectura con lo que ya tiene fecha
 * en otras pantallas: las sesiones, las actividades del cuaderno, las reuniones y formaciones y, en Educación
 * Física, las pruebas físicas. Nada se copia: se calcula al pintar, como el calendario escolar, y cada apunte
 * abre su pantalla. Las capas se apagan (se recuerda en el dispositivo) y todo se puede filtrar por clase.
 *
 * Aquí, la cuenta sin pantalla. Nada sale del dispositivo.
 */
import type { CalEvent, Class, GradeCategory, GradeItem, Section, Student, WorkSession } from '../types';
import type { MarcaPrueba, PruebaFisica, SesionEF } from '../types/ef';

export type CapaAgenda = 'sesiones' | 'cuaderno' | 'reuniones' | 'pruebas';

/** Las capas, en el orden en que se enseñan. El nombre va en castellano: quien lo enseña lo traduce. */
export const CAPAS: readonly { id: CapaAgenda; label: string; color: string }[] = [
  { id: 'sesiones', label: 'Sesiones', color: '#0ea5e9' },
  { id: 'cuaderno', label: 'Cuaderno', color: '#10b981' },
  { id: 'reuniones', label: 'Reuniones y formaciones', color: '#f59e0b' },
  { id: 'pruebas', label: 'Pruebas físicas', color: '#8b5cf6' },
];

export const colorDeCapa = (capa: CapaAgenda): string => CAPAS.find(c => c.id === capa)?.color ?? '#64748b';

/** Algo con fecha que vive en otra pantalla y la Agenda solo enseña. */
export interface ApunteDeAgenda {
  /** Único entre todos los apuntes. */
  id: string;
  capa: CapaAgenda;
  tipo: 'sesion' | 'actividad' | 'reunion' | 'formacion' | 'prueba';
  /** YYYY-MM-DD. */
  fecha: string;
  hora?: string;
  titulo: string;
  claseId?: string;
  /** La categoría del cuaderno (actividad) o quien convoca (reunión, formación). */
  extra?: string;
  /** Prueba física: cuántas marcas se tomaron ese día a esa clase. */
  cuantas?: number;
  /** Sesión: si ya se dio. */
  hecho?: boolean;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export interface DatosConFecha {
  classes: readonly Pick<Class, 'id'>[];
  sesiones?: readonly SesionEF[];
  gradeItems?: readonly GradeItem[];
  gradeCategories?: readonly Pick<GradeCategory, 'id' | 'name'>[];
  workSessions?: readonly Pick<WorkSession, 'id' | 'kind' | 'date' | 'timeStart' | 'title' | 'organizer'>[];
  marcas?: readonly MarcaPrueba[];
  pruebas?: readonly Pick<PruebaFisica, 'id' | 'nombre'>[];
  students?: readonly Pick<Student, 'id' | 'class_id'>[];
}

const ORDEN_CAPA: Record<CapaAgenda, number> = { sesiones: 0, cuaderno: 1, pruebas: 2, reuniones: 3 };

/**
 * Todo lo que tiene fecha fuera de la Agenda, por día y hora. Las sesiones archivadas no salen; las marcas de una
 * prueba física se juntan en un apunte por prueba, clase y día.
 */
export function apuntesDeAgenda(d: DatosConFecha): ApunteDeAgenda[] {
  const hayClase = new Set(d.classes.map(c => c.id));
  const clase = (id: string | undefined) => (id && hayClase.has(id) ? { claseId: id } : {});
  const out: ApunteDeAgenda[] = [];

  for (const s of d.sesiones ?? []) {
    if (s.archivada || !s.fecha || !ISO.test(s.fecha)) continue;
    out.push({ id: `sesiones:${s.id}`, capa: 'sesiones', tipo: 'sesion', fecha: s.fecha, titulo: s.titulo, ...clase(s.claseId), ...(s.completada ? { hecho: true } : {}) });
  }

  const categoria = new Map((d.gradeCategories ?? []).map(c => [c.id, c.name]));
  for (const g of d.gradeItems ?? []) {
    if (!g.date || !ISO.test(g.date)) continue;
    const extra = categoria.get(g.category_id);
    out.push({ id: `cuaderno:${g.id}`, capa: 'cuaderno', tipo: 'actividad', fecha: g.date, titulo: g.name, ...clase(g.class_id), ...(extra ? { extra } : {}) });
  }

  for (const w of d.workSessions ?? []) {
    if (!w.date || !ISO.test(w.date)) continue;
    out.push({
      id: `reuniones:${w.id}`, capa: 'reuniones', tipo: w.kind === 'training' ? 'formacion' : 'reunion', fecha: w.date, titulo: w.title,
      ...(w.timeStart ? { hora: w.timeStart } : {}), ...(w.organizer?.trim() ? { extra: w.organizer.trim() } : {}),
    });
  }

  if (d.marcas?.length) {
    const claseDe = new Map((d.students ?? []).map(s => [s.id, s.class_id]));
    const nombre = new Map((d.pruebas ?? []).map(p => [p.id, p.nombre]));
    const tomas = new Map<string, ApunteDeAgenda>();
    for (const m of d.marcas) {
      if (!m.fecha || !ISO.test(m.fecha) || !nombre.has(m.pruebaId)) continue;
      const c = claseDe.get(m.alumnoId);
      const k = `pruebas:${m.pruebaId}:${c ?? ''}:${m.fecha}`;
      const ya = tomas.get(k);
      if (ya) ya.cuantas = (ya.cuantas ?? 0) + 1;
      else tomas.set(k, { id: k, capa: 'pruebas', tipo: 'prueba', fecha: m.fecha, titulo: nombre.get(m.pruebaId)!, ...clase(c), cuantas: 1 });
    }
    out.push(...tomas.values());
  }

  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || ORDEN_CAPA[a.capa] - ORDEN_CAPA[b.capa]
    || (a.hora ?? '').localeCompare(b.hora ?? '') || a.titulo.localeCompare(b.titulo, 'es'));
}

/** Lo que se ve: sin las capas apagadas y, con una clase elegida, solo lo de esa clase. */
export function apuntesVisibles(apuntes: readonly ApunteDeAgenda[], apagadas: ReadonlySet<CapaAgenda>, claseId?: string): ApunteDeAgenda[] {
  return apuntes.filter(a => !apagadas.has(a.capa) && (!claseId || a.claseId === claseId));
}

/**
 * Los eventos que se ven: todos o, con una clase elegida, solo los suyos. Un evento cuya clase ya no existe
 * cuenta como de ninguna.
 */
export function eventosVisibles<E extends Pick<CalEvent, 'classId'>>(eventos: readonly E[], claseId?: string): E[] {
  return claseId ? eventos.filter(e => e.classId === claseId) : [...eventos];
}

export function porFecha<T extends { fecha: string }>(lista: readonly T[]): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const x of lista) (out[x.fecha] ??= []).push(x);
  return out;
}

/** Las capas que ese perfil puede tener: las pruebas físicas, solo en Educación Física; las que no tienen pantalla en su menú, no. */
export function capasDe(esEF: boolean, tienePantalla: (s: Section) => boolean): CapaAgenda[] {
  return CAPAS.map(c => c.id).filter(id => (id !== 'pruebas' || esEF) && tienePantalla(pantallaDe({ capa: id, tipo: id === 'reuniones' ? 'reunion' : 'sesion' }, esEF)));
}

/** La pantalla que abre un apunte. */
export function pantallaDe(a: Pick<ApunteDeAgenda, 'capa' | 'tipo'>, esEF: boolean): Section {
  if (a.capa === 'sesiones') return esEF ? 'ef-sesiones' : 'sesiones';
  if (a.capa === 'cuaderno') return 'notebook';
  if (a.capa === 'pruebas') return 'ef-pruebas';
  return a.tipo === 'formacion' ? 'trainings' : 'meetings';
}

/* ══════════════ Una entrega con clase puede crear su columna en el cuaderno ══════════════ */

/**
 * Las categorías del cuaderno de esa clase en las que puede ir la columna de un examen o una entrega. Con varias
 * asignaturas en la clase, cada una lleva la suya delante para distinguirlas («Lengua · Pruebas»).
 */
export function categoriasParaColumna(
  categorias: readonly Pick<GradeCategory, 'id' | 'class_id' | 'name' | 'subject'>[], clase: Pick<Class, 'id' | 'subject' | 'subjects'> | undefined,
): { id: string; label: string }[] {
  if (!clase) return [];
  const suyas = categorias.filter(c => c.class_id === clase.id);
  const principal = clase.subjects?.[0] ?? clase.subject ?? '';
  const asignatura = (c: { subject?: string }) => c.subject?.trim() || principal;
  const varias = new Set(suyas.map(asignatura)).size > 1;
  return suyas.map(c => ({ id: c.id, label: varias && asignatura(c) ? `${asignatura(c)} · ${c.name}` : c.name }));
}

/** La columna del cuaderno de un evento con clase: su nombre y su día. Sin clase, sin nombre o sin categoría, ninguna. */
export function columnaDeEvento(ev: Pick<CalEvent, 'name' | 'date' | 'classId'>, categoryId: string, id: string): GradeItem | null {
  const name = ev.name.trim();
  if (!ev.classId || !name || !categoryId || !ISO.test(ev.date)) return null;
  return { id, class_id: ev.classId, category_id: categoryId, name, date: ev.date };
}

/* ══════════════ Las capas apagadas: en el dispositivo ══════════════ */

const CLAVE = 'aulapro_agenda_capas_apagadas';
const esCapa = (x: unknown): x is CapaAgenda => CAPAS.some(c => c.id === x);

/** Se guardan las apagadas, no las encendidas: una capa nueva sale encendida. */
export function capasApagadas(): Set<CapaAgenda> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    return new Set(Array.isArray(v) ? v.filter(esCapa) : []);
  } catch {
    return new Set();
  }
}

export function guardarCapasApagadas(apagadas: ReadonlySet<CapaAgenda>): void {
  try { localStorage.setItem(CLAVE, JSON.stringify([...apagadas])); } catch { /* sin sitio: vale para esta vez */ }
}
