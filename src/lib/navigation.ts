/**
 * Cómo se organiza el menú.
 *
 * Antes eran 21 entradas sueltas en cinco grupos, todas con el mismo peso:
 * demasiado para quien abre la aplicación por primera vez. Ahora el menú va
 * por tareas del día a día:
 *
 *   - Tu día a día: Inicio, Mis clases, Agenda, Cuaderno, Asistencia.
 *   - Tres «apartados» que reúnen pantallas hermanas, con pestañas arriba:
 *       Evaluar     → Rúbricas, Diana, Autoevaluaciones, Historial
 *       Documentos  → Informes, Actas, Situaciones de aprendizaje, Recursos
 *       En clase    → Distribución de aula, Aula Live, Sala de alumnos
 *   - Más (plegado): Reuniones, Formaciones, Trabajo compartido, Registro
 *     de cambios y Mi perfil.
 *
 * El profesorado especialista de PT y AL tiene su propio menú (decisión del
 * dueño, 5-10-2026: quien es de PT o de AL normalmente no es tutor). Lleva su
 * trabajo de apoyo como entradas sueltas, lo común de todo el profesorado y
 * Aula Live; nada de clases, cuaderno ni evaluación del grupo. Ver
 * `docs/PTAL.md`.
 *
 * El de Educación Física tiene el menú de aula y, después del Inicio, el
 * apartado «Educación Física» con sus herramientas (decisión del dueño,
 * 5-10-2026). Ser también tutor solo cambia su Inicio. Ver `docs/EF.md`.
 *
 * Las pantallas no cambian ni de identificador: todo lo que ya navegaba a
 * «rubrics» o «records» sigue funcionando; el apartado solo agrupa.
 */
import type { Section } from '../types';
import type { TipoDocente } from './tipoDocente';

export type NavIcon =
  | 'home' | 'classes' | 'agenda' | 'notebook' | 'attendance'
  | 'evaluate' | 'documents' | 'inclass' | 'ef'
  | 'session' | 'students' | 'goals' | 'coord' | 'reports' | 'resources' | 'live' | 'pictos'
  | 'meetings' | 'trainings' | 'share' | 'audit' | 'profile';

export interface NavHub {
  id: 'evaluate' | 'documents' | 'inclass' | 'ef';
  label: string;
  /** Para qué sirve, en una frase: se ve bajo las pestañas y en el tooltip del menú. */
  hint: string;
  icon: NavIcon;
  tabs: { id: Section; label: string }[];
}

export interface NavLink { id: Section; label: string; icon: NavIcon }

export type NavEntry = ({ kind: 'link' } & NavLink) | ({ kind: 'hub' } & NavHub);

export const HUBS: readonly NavHub[] = [
  {
    id: 'evaluate', label: 'Evaluar', icon: 'evaluate',
    hint: 'Evalúa con rúbricas o con la diana competencial, recoge autoevaluaciones y consulta todo lo evaluado.',
    tabs: [
      { id: 'rubrics',    label: 'Rúbricas' },
      { id: 'diana',      label: 'Diana competencial' },
      { id: 'selfassess', label: 'Autoevaluaciones' },
      { id: 'history',    label: 'Historial' },
    ],
  },
  {
    id: 'documents', label: 'Documentos', icon: 'documents',
    hint: 'Todo lo que acaba en papel: informes para las familias, actas de calificaciones, situaciones de aprendizaje y fichas.',
    tabs: [
      { id: 'reports',             label: 'Informes' },
      { id: 'records',             label: 'Actas' },
      { id: 'learning-situations', label: 'Situaciones de aprendizaje' },
      { id: 'resources',           label: 'Recursos' },
    ],
  },
  {
    id: 'inclass', label: 'En clase', icon: 'inclass',
    hint: 'Lo que usas con el alumnado delante: cómo se sientan, la pizarra y herramientas para proyectar, y las actividades desde sus móviles.',
    tabs: [
      { id: 'seating',        label: 'Distribución de aula' },
      { id: 'sec-classroom',  label: 'Aula Live' },
      { id: 'classroom-live', label: 'Sala de alumnos' },
    ],
  },
  {
    id: 'ef', label: 'Educación Física', icon: 'ef',
    hint: 'Lo propio de EF: observar en la pista, el alumnado exento o lesionado, las pruebas físicas, los equipos y los circuitos, las actividades y sesiones, y el material.',
    tabs: [
      { id: 'ef-pista',   label: 'En la pista' },
      { id: 'ef-exentos', label: 'Exentos y lesiones' },
      { id: 'ef-pruebas', label: 'Pruebas físicas' },
      { id: 'ef-equipos', label: 'Equipos' },
      { id: 'ef-circuitos', label: 'Circuitos' },
    ],
  },
];

type NavGroups = readonly { sect: string; items: NavEntry[]; collapsedByDefault?: boolean }[];

const link = (id: Section, label: string, icon: NavIcon): NavEntry => ({ kind: 'link', id, label, icon });
const hub = (id: NavHub['id']): NavEntry => ({ kind: 'hub', ...HUBS.find(h => h.id === id)! });

export const NAV_GROUPS: NavGroups = [
  {
    sect: 'Tu día a día',
    items: [
      link('dashboard',  'Inicio',            'home'),
      link('classes',    'Mis Clases',        'classes'),
      link('agenda',     'Agenda',            'agenda'),
      link('notebook',   'Cuaderno de Notas', 'notebook'),
      link('attendance', 'Asistencia',        'attendance'),
    ],
  },
  {
    sect: 'Trabajo docente',
    items: [hub('evaluate'), hub('documents'), hub('inclass')],
  },
  {
    sect: 'Más',
    collapsedByDefault: true,
    items: [
      link('meetings',  'Reuniones',           'meetings'),
      link('trainings', 'Formaciones',         'trainings'),
      link('share',     'Trabajo compartido',  'share'),
      link('audit',     'Registro de cambios', 'audit'),
      link('profile',   'Configuración',       'profile'),
    ],
  },
];

/**
 * El menú del profesorado especialista de PT y AL. Su día a día es el apoyo;
 * de las herramientas, las que sirven sin clases propias.
 */
export const NAV_APOYO: NavGroups = [
  {
    sect: 'Tu día a día',
    items: [
      link('dashboard',        'Inicio',                  'home'),
      link('apoyo-registro',   'Registro diario',         'session'),
      link('apoyo-alumnado',   'Alumnado y grupos',       'students'),
      link('apoyo-programas',  'Programas',               'goals'),
      link('apoyo-coordinaciones', 'Coordinaciones',      'coord'),
      link('apoyo-documentos', 'Programación e informes', 'reports'),
      link('agenda',           'Agenda',                  'agenda'),
    ],
  },
  {
    sect: 'Herramientas',
    items: [
      link('apoyo-agenda-visual', 'Agenda visual', 'pictos'),
      link('resources',     'Recursos',  'resources'),
      link('sec-classroom', 'Aula Live', 'live'),
    ],
  },
  {
    sect: 'Más',
    collapsedByDefault: true,
    items: [
      link('meetings',  'Reuniones',           'meetings'),
      link('trainings', 'Formaciones',         'trainings'),
      link('audit',     'Registro de cambios', 'audit'),
      link('profile',   'Configuración',       'profile'),
    ],
  },
];

/** El de EF: el de aula con su apartado después del Inicio. */
export const NAV_EF: NavGroups = NAV_GROUPS.map((g, i) => (i === 0
  ? { ...g, items: [g.items[0], hub('ef'), ...g.items.slice(1)] }
  : g));

/** El menú de cada tipo de docente. */
export function navGroupsFor(tipo: TipoDocente): NavGroups {
  return tipo === 'apoyo' ? NAV_APOYO : tipo === 'ef' ? NAV_EF : NAV_GROUPS;
}

/** El apartado al que pertenece una pantalla, si pertenece a alguno. */
export function hubOf(section: Section): NavHub | undefined {
  return HUBS.find(h => h.tabs.some(t => t.id === section));
}

/**
 * El apartado de la pantalla, solo si ese menú lo tiene: en el de PT y AL,
 * Recursos y Aula Live van sueltos y no llevan las pestañas de sus hermanas,
 * que ese menú no tiene.
 */
export function hubEnMenu(section: Section, tipo: TipoDocente): NavHub | undefined {
  const h = hubOf(section);
  return h && navGroupsFor(tipo).some(g => g.items.some(e => e.kind === 'hub' && e.id === h.id)) ? h : undefined;
}

/** Si la entrada del menú corresponde a la pantalla abierta. */
export function isCurrent(entry: NavEntry, section: Section): boolean {
  return entry.kind === 'link' ? entry.id === section : entry.tabs.some(t => t.id === section);
}

/* ── Última pestaña de cada apartado ──────────────────────────────────────
 * Volver a «Documentos» abre la pestaña en la que se estaba, no siempre la
 * primera: quien está con las actas quiere seguir con las actas.
 */
const LAST_KEY = 'aulapro_hub_last';

function readLast(): Partial<Record<NavHub['id'], Section>> {
  try { return JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}'); } catch { return {}; }
}

export function rememberTab(section: Section): void {
  const h = hubOf(section);
  if (!h) return;
  try { localStorage.setItem(LAST_KEY, JSON.stringify({ ...readLast(), [h.id]: section })); } catch { /* sin almacenamiento */ }
}

/** La pantalla que abre un apartado: la última usada, o la primera. */
export function hubTarget(h: NavHub): Section {
  const last = readLast()[h.id];
  return last && h.tabs.some(t => t.id === last) ? last : h.tabs[0].id;
}

/** Todas las pantallas a las que se llega desde el menú (para comprobar que no se pierde ninguna). */
export function reachableSections(tipo: TipoDocente = 'aula'): Section[] {
  return navGroupsFor(tipo).flatMap(g => g.items.flatMap(e => (e.kind === 'link' ? [e.id] : e.tabs.map(t => t.id))));
}
