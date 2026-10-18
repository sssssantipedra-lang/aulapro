/**
 * Borradores: la copia de seguridad de lo que se está generando o editando
 * y aún no se ha guardado (petición del dueño, 18-10-2026: «si se ha quedado
 * a medias sin guardar, que exista la opción de continuar»).
 *
 * Una ficha o una situación de aprendizaje que ha costado generar con la IA
 * se perdía si se cerraba la aplicación, se cambiaba de pantalla o se iba la
 * luz. Ahora cada pantalla que genera algo guarda aquí su estado mientras
 * hay cambios sin guardar, y al volver ofrece «Continuar» o «Descartar».
 *
 * Una sola copia por perfil y por tipo: cada una sustituye a la anterior,
 * así que nunca se acumulan. Va en localStorage y no en los datos del
 * perfil a propósito: es una red de seguridad aparte, que no depende del
 * guardado normal. Lo de Reuniones y Formaciones tiene su propio autoguardado
 * (`draftAutosave.ts`), anterior a este.
 */
import { getActiveProfileId } from './storage';

/** Lo que se puede autoguardar: cada pantalla tiene su tipo, y por tanto su copia. */
export type TipoBorrador =
  | 'ficha' | 'sda' | 'rubrica' | 'diana' | 'sesion-ef' | 'evaluacion-foto';

export interface Borrador<T> {
  datos: T;
  /** Cómo se llama lo que se estaba haciendo, para el aviso («Ficha: las fracciones»). */
  titulo: string;
  /** Instante del último autoguardado (ISO). */
  guardadoEn: string;
}

/** Pasado este tiempo, una copia deja de ofrecerse: ya no tiene sentido retomarla. */
export const CADUCA_EN_MS = 30 * 24 * 60 * 60 * 1000;
/** Cuánto se espera tras el último cambio antes de guardar la copia. */
export const ESPERA_MS = 1200;

const clave = (tipo: TipoBorrador) => `aulapro_borrador_${getActiveProfileId() ?? 'sin-perfil'}_${tipo}`;

export function guardarBorrador<T>(tipo: TipoBorrador, datos: T, titulo: string): string | null {
  const guardadoEn = new Date().toISOString();
  try {
    localStorage.setItem(clave(tipo), JSON.stringify({ datos, titulo, guardadoEn } satisfies Borrador<T>));
    return guardadoEn;
  } catch {
    // Sin almacenamiento o sin espacio: el borrador es una ayuda, nunca debe romper la pantalla
    return null;
  }
}

export function leerBorrador<T>(tipo: TipoBorrador, ahora: number = Date.now()): Borrador<T> | null {
  try {
    const raw = localStorage.getItem(clave(tipo));
    if (!raw) return null;
    const b = JSON.parse(raw) as Borrador<T>;
    if (!b || typeof b !== 'object' || b.datos == null || typeof b.guardadoEn !== 'string') return null;
    if (ahora - new Date(b.guardadoEn).getTime() > CADUCA_EN_MS) {
      borrarBorrador(tipo);
      return null;
    }
    return b;
  } catch {
    return null;
  }
}

export function borrarBorrador(tipo: TipoBorrador): void {
  try { localStorage.removeItem(clave(tipo)); } catch { /* sin almacenamiento */ }
}
