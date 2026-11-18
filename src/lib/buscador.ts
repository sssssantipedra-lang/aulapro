/**
 * El buscador general (18-11-2026, decisión del dueño): una sola caja para ir a
 * cualquier pantalla, clase, alumno, rúbrica, diana, escala, situación de
 * aprendizaje o ficha escribiendo unas letras. Aquí, qué se busca y en qué
 * orden sale; la ventana es `components/Buscador.tsx`. Todo en el dispositivo.
 */
import type { Class, EvalDiana, Ficha, LearningSituation, Rubric, Section, Student } from '../types';
import type { NavEntry } from './navigation';

export type TipoResultado = 'pantalla' | 'clase' | 'alumno' | 'rubrica' | 'diana' | 'escala' | 'sda' | 'ficha';

export interface Resultado {
  tipo: TipoResultado;
  id: string;
  titulo: string;
  /** Dónde está: la clase del alumno, el apartado de la pantalla… */
  detalle: string;
  /** La pantalla a la que lleva. */
  section: Section;
}

export const NOMBRE_TIPO: Record<TipoResultado, string> = {
  pantalla: 'Pantallas', clase: 'Clases', alumno: 'Alumnado', rubrica: 'Rúbricas', diana: 'Dianas',
  escala: 'Escalas de registro', sda: 'Situaciones de aprendizaje', ficha: 'Fichas',
};

/** Cuántos resultados se enseñan como mucho de cada tipo, y en total. */
export const MAX_POR_TIPO = 5;
export const MAX_RESULTADOS = 14;

/** Sin tildes ni mayúsculas: «rubrica» encuentra «Rúbrica». */
export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Cuánto encaja un texto con lo buscado: 3 si empieza por ello, 2 si alguna
 * palabra empieza por ello, 1 si lo contiene; con varias palabras, todas tienen
 * que estar (en el título o en el detalle) y cuenta la que peor encaja. 0 = no.
 */
export function encaje(titulo: string, detalle: string, palabras: string[]): number {
  const t = normalizar(titulo), d = normalizar(detalle);
  let peor = 3;
  for (const p of palabras) {
    const n = t.startsWith(p) ? 3 : new RegExp(`(^|[^a-z0-9ñ])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t) ? 2 : t.includes(p) ? 1 : d.includes(p) ? 0.5 : 0;
    if (n === 0) return 0;
    peor = Math.min(peor, n);
  }
  return peor;
}

export interface DatosDelBuscador {
  /** El menú del docente (`navGroupsFor`), para las pantallas. */
  menu: readonly { items: NavEntry[] }[];
  classes: Class[];
  students: Student[];
  rubrics: Rubric[];
  dianas: EvalDiana[];
  learningSituations: LearningSituation[];
  fichas: Ficha[];
  /** Solo el docente de aula y el de EF tienen clases, evaluación y documentos; el de PT y AL, no. */
  conAula: boolean;
  /** En EF las situaciones de aprendizaje están en su apartado. */
  ef: boolean;
}

/** Todas las pantallas del menú, con las pestañas de cada apartado («Evaluar › Rúbricas»). */
export function pantallasDe(menu: DatosDelBuscador['menu'], t: (k: string) => string): Resultado[] {
  return menu.flatMap(g => g.items).flatMap((item): Resultado[] => (item.kind === 'link'
    ? [{ tipo: 'pantalla', id: item.id, titulo: t(item.label), detalle: '', section: item.id }]
    : item.tabs.map((tab, i) => ({
      tipo: 'pantalla' as const, id: tab.id, section: tab.id,
      // La portada del apartado se llama como el apartado, no «Resumen»
      titulo: i === 0 ? t(item.label) : t(tab.label), detalle: i === 0 ? '' : t(item.label),
    }))));
}

/**
 * Lo que encaja con lo escrito, lo mejor primero. Sin nada escrito, las
 * pantallas del menú: la caja también sirve para moverse sin buscar.
 */
export function buscar(q: string, d: DatosDelBuscador, t: (k: string) => string): Resultado[] {
  const pantallas = pantallasDe(d.menu, t);
  const palabras = normalizar(q).split(/\s+/).filter(Boolean);
  if (!palabras.length) return pantallas.slice(0, MAX_RESULTADOS);

  const clase = (id?: string) => d.classes.find(c => c.id === id)?.name ?? '';
  const todo: Resultado[] = [
    ...pantallas,
    ...(d.conAula ? [
      ...d.classes.map((c): Resultado => ({ tipo: 'clase', id: c.id, titulo: c.name, detalle: (c.subjects?.length ? c.subjects : [c.subject]).filter(Boolean).join(' · '), section: 'classes' })),
      ...d.students.map((s): Resultado => ({ tipo: 'alumno', id: s.id, titulo: s.name, detalle: clase(s.class_id), section: 'classes' })),
      ...d.rubrics.map((r): Resultado => ({ tipo: 'rubrica', id: r.id, titulo: r.name, detalle: clase(r.class_id), section: 'rubrics' })),
      ...d.dianas.map((x): Resultado => (x.tipo === 'registro'
        ? { tipo: 'escala', id: x.id, titulo: x.name, detalle: clase(x.class_id), section: 'registros' }
        : { tipo: 'diana', id: x.id, titulo: x.name, detalle: clase(x.class_id), section: 'dianas' })),
      ...d.learningSituations.map((s): Resultado => ({ tipo: 'sda', id: s.id, titulo: s.title, detalle: s.class_name ?? '', section: d.ef ? 'ef-sda' : 'learning-situations' })),
    ] : []),
    ...d.fichas.map((f): Resultado => ({ tipo: 'ficha', id: f.id, titulo: f.title, detalle: f.class_name ?? '', section: 'resources' })),
  ];

  const porTipo = new Map<TipoResultado, number>();
  return todo
    .map((r, i) => ({ r, i, n: encaje(r.titulo, r.detalle, palabras) }))
    .filter(x => x.n > 0)
    // Lo que mejor encaja, primero; a igualdad, en el orden de arriba (pantallas, clases, alumnado…)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .filter(x => {
      const n = porTipo.get(x.r.tipo) ?? 0;
      porTipo.set(x.r.tipo, n + 1);
      return n < MAX_POR_TIPO;
    })
    .slice(0, MAX_RESULTADOS)
    .map(x => x.r);
}
