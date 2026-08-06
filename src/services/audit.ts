/**
 * Registro de cambios: quién tocó qué y cuándo.
 *
 * Sirve para dos cosas. La primera, poder responder a «esta nota no era la que
 * yo puse»: queda constancia del valor anterior y del nuevo. La segunda, dar el
 * «cuándo» y el «quién» que necesita la sincronización entre docentes para
 * decidir qué versión de un dato debe ganar.
 *
 * No se registra todo: las tareas, el horario y el calendario son ruido. Solo
 * entra lo que tiene consecuencias académicas o viaja entre equipos.
 */

export type AuditAction = 'create' | 'update' | 'delete';

export type AuditEntity =
  | 'class' | 'student'
  | 'grade' | 'gradeItem' | 'gradeCategory'
  | 'evaluation' | 'attendance' | 'report'
  | 'rubric' | 'diana'
  | 'sync' | 'system';

export interface AuditEntry {
  id: string;
  /**
   * Instante exacto, en ISO. Aquí `toISOString()` es correcto porque guarda un
   * momento del tiempo, no un día del calendario: para mostrarlo se convierte a
   * hora local. No copiar este patrón para fechas de día (ver `formatDay`).
   */
  at: string;
  /** Docente que hizo el cambio. */
  who: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  /** Qué se tocó, en lenguaje llano. */
  what: string;
  /** Cómo cambió, cuando tiene sentido: «5,5 → 7,0». */
  detail?: string;
}

/** Tope de entradas. Las más antiguas se van cayendo. */
export const MAX_ENTRIES = 1200;

export function pushEntry(log: AuditEntry[], entry: AuditEntry): AuditEntry[] {
  const next = [entry, ...log];
  return next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next;
}

export function newEntry(
  who: string,
  action: AuditAction,
  entity: AuditEntity,
  entityId: string,
  what: string,
  detail?: string,
): AuditEntry {
  return {
    id: 'au' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    at: new Date().toISOString(),
    who: who || 'Sin perfil',
    action, entity, entityId, what, detail,
  };
}

/* ── Etiquetas para la interfaz ── */

export const ACTION_LABEL: Record<AuditAction, string> = {
  create: 'Creó',
  update: 'Cambió',
  delete: 'Borró',
};

export const ACTION_COLOR: Record<AuditAction, string> = {
  create: '#047857',
  update: '#0369a1',
  delete: '#b91c1c',
};

export const ENTITY_LABEL: Record<AuditEntity, string> = {
  class: 'Clase',
  student: 'Alumno',
  grade: 'Nota',
  gradeItem: 'Prueba',
  gradeCategory: 'Categoría',
  evaluation: 'Evaluación',
  attendance: 'Asistencia',
  report: 'Informe',
  rubric: 'Rúbrica',
  diana: 'Diana',
  sync: 'Sincronización',
  system: 'Sistema',
};

/** Grupos del filtro, para no acabar con doce casillas. */
export const ENTITY_GROUPS: { id: string; label: string; entities: AuditEntity[] }[] = [
  { id: 'grades',  label: 'Calificaciones', entities: ['grade', 'gradeItem', 'gradeCategory'] },
  { id: 'evals',   label: 'Evaluación',   entities: ['evaluation', 'rubric', 'diana', 'report'] },
  { id: 'people',  label: 'Clases',       entities: ['class', 'student'] },
  { id: 'attend',  label: 'Asistencia',   entities: ['attendance'] },
  { id: 'sync',    label: 'Compartido',   entities: ['sync', 'system'] },
];

/* ── Formato ── */

/**
 * Día del calendario a partir de una fecha `AAAA-MM-DD`.
 * Se parte la cadena a mano: convertirla a `Date` la interpreta como UTC y en
 * España acaba mostrando el día anterior.
 */
export function formatDay(iso: string): string {
  const [y, m, d] = (iso || '').split('-');
  return d && m && y ? `${Number(d)}/${Number(m)}/${y}` : iso;
}

/** Nota con coma decimal, o una raya si no hay nota. */
export function formatGrade(v: number | null | undefined, locale = 'es-ES'): string {
  if (typeof v !== 'number') return '—';
  return v.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Día natural de una marca de tiempo, en hora local. */
export function dayKeyOf(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at.slice(0, 10);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** «hoy», «ayer» o la fecha, para las cabeceras del registro. */
export function friendlyDay(dayKey: string, lang: 'es' | 'en' = 'es'): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  const y = new Date(now.getTime() - 86400000);
  const yesterday = `${y.getFullYear()}-${p(y.getMonth() + 1)}-${p(y.getDate())}`;
  if (dayKey === today) return lang === 'en' ? 'Today' : 'Hoy';
  if (dayKey === yesterday) return lang === 'en' ? 'Yesterday' : 'Ayer';
  return formatDay(dayKey);
}

export function formatTime(at: string, locale = 'es-ES'): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/** Registro a CSV para Excel español (BOM + punto y coma). */
export function auditToCsv(entries: AuditEntry[]): string {
  const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['Fecha', 'Hora', 'Docente', 'Acción', 'Tipo', 'Qué', 'Detalle'].map(esc).join(';'),
    ...entries.map(e => [
      formatDay(dayKeyOf(e.at)),
      formatTime(e.at),
      e.who,
      ACTION_LABEL[e.action],
      ENTITY_LABEL[e.entity],
      e.what,
      e.detail ?? '',
    ].map(esc).join(';')),
  ];
  return '﻿' + rows.join('\r\n');
}
