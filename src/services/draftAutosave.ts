/**
 * Autoguardado de las anotaciones de Reuniones y Formaciones.
 *
 * Mientras el formulario está abierto se guarda una copia cada minuto (y otra
 * al cerrar la ventana). Hay una sola copia por perfil y por tipo: cada
 * autoguardado sustituye al anterior, así que nunca se acumulan. Al guardar
 * de verdad se borra; si queda alguna (se cerró sin guardar), la pantalla
 * ofrece recuperarla.
 *
 * Va en localStorage y no en los datos del perfil a propósito: es una red de
 * seguridad aparte, que no depende del guardado normal ni de que el borrador
 * llegue a ser una reunión de verdad.
 */
import type { WorkSession, WorkSessionKind } from '../types';

export const AUTOSAVE_EVERY_MS = 60_000;

export interface Autosave {
  draft: WorkSession;
  /** Si el borrador era una reunión ya guardada que se estaba editando. */
  editing: boolean;
  savedAt: string;
}

const key = (profileId: string | null, kind: WorkSessionKind) =>
  `aulapro_autoguardado_${profileId ?? 'sin-perfil'}_${kind}`;

/** Un borrador sin título ni anotaciones no merece copia. */
export function hasContent(d: WorkSession): boolean {
  return !!(d.title.trim() || d.notes.trim());
}

export function writeAutosave(profileId: string | null, kind: WorkSessionKind, draft: WorkSession, editing: boolean): string | null {
  if (!hasContent(draft)) return null;
  const savedAt = new Date().toISOString();
  try {
    localStorage.setItem(key(profileId, kind), JSON.stringify({ draft, editing, savedAt } satisfies Autosave));
    return savedAt;
  } catch {
    return null;
  }
}

export function readAutosave(profileId: string | null, kind: WorkSessionKind): Autosave | null {
  try {
    const raw = localStorage.getItem(key(profileId, kind));
    if (!raw) return null;
    const a = JSON.parse(raw) as Autosave;
    return a?.draft && typeof a.draft.notes === 'string' ? a : null;
  } catch {
    return null;
  }
}

export function clearAutosave(profileId: string | null, kind: WorkSessionKind): void {
  try { localStorage.removeItem(key(profileId, kind)); } catch { /* sin almacenamiento */ }
}

/**
 * Si una copia sigue valiendo la pena: no si lo guardado ya contiene
 * exactamente lo mismo (se guardó después del último autoguardado).
 */
export function isWorthRecovering(a: Autosave, saved: WorkSession[]): boolean {
  if (!hasContent(a.draft)) return false;
  const same = saved.find(s => s.id === a.draft.id);
  if (!same) return true;
  return same.title !== a.draft.title || same.notes !== a.draft.notes
    || (same.attendees ?? '') !== (a.draft.attendees ?? '')
    || (same.organizer ?? '') !== (a.draft.organizer ?? '')
    || (same.place ?? '') !== (a.draft.place ?? '');
}
