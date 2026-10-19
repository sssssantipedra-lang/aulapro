import { createContext, useContext } from 'react';
import type { LicenseState } from '../types/electron';

/**
 * Qué puede hacer este equipo según su licencia (docs/WEB.md, apartado 3).
 *
 *  - `completo`: fundador o licencia activa (de por vida, o anual vigente).
 *  - `prueba`: sin licencia. Se explora con los datos de ejemplo; no se crean
 *    perfiles propios ni se usa la IA.
 *  - `caducada`: licencia anual sin renovar. Los datos se abren y se exportan
 *    siempre; lo que se cierra es la IA y crear perfiles nuevos.
 */
export type ModoAcceso = 'completo' | 'prueba' | 'caducada';

export interface Acceso {
  modo: ModoAcceso;
  /** Días que le quedan a una anual; `null` si la licencia no caduca. */
  daysLeft: number | null;
}

/** Desde cuántos días antes de caducar se avisa (igual que `RENEW_WARN_DAYS` de la licencia). */
export const AVISO_DIAS = 14;

const PRUEBA_KEY = 'aulapro_prueba';

export function accesoDe(state: LicenseState | null, prueba: boolean): Acceso {
  if (!state) return { modo: 'completo', daysLeft: null }; // navegador: sin licencia
  const daysLeft = state.daysLeft ?? null;
  if (state.status === 'caducada') return { modo: 'caducada', daysLeft: 0 };
  if (state.required || state.status === 'sin-licencia' || state.status === 'otro-equipo') {
    return prueba && state.enforced ? { modo: 'prueba', daysLeft: null } : { modo: 'completo', daysLeft };
  }
  return { modo: 'completo', daysLeft };
}

export function leerPrueba(): boolean {
  try { return localStorage.getItem(PRUEBA_KEY) === '1'; } catch { return false; }
}

export function guardarPrueba(on: boolean) {
  try { if (on) localStorage.setItem(PRUEBA_KEY, '1'); else localStorage.removeItem(PRUEBA_KEY); } catch { /* sin almacenamiento */ }
}

/* ── Candado de la IA ──
 * Lo comprueba `callGemini`, el único sitio por el que sale una petición a la
 * IA: así ninguna pantalla se puede dejar sin cerrar. */
let actual: Acceso = { modo: 'completo', daysLeft: null };

export function setAcceso(a: Acceso) { actual = a; }

/** El texto que se enseña si la IA está cerrada, o `null` si se puede usar. */
export function motivoIaCerrada(): string | null {
  if (actual.modo === 'prueba') return 'Estás en el modo de prueba. Activa tu licencia para usar la IA.';
  if (actual.modo === 'caducada') return 'Tu licencia anual ha caducado. Renuévala en aulapro.app para volver a usar la IA. Tus datos siguen disponibles.';
  return null;
}

export interface AccesoContexto {
  acceso: Acceso;
  /** Vuelve a la pantalla de activación (desde el aviso del modo de prueba o de una anual caducada). */
  activar: () => void;
  /** Enlace para comprar o renovar; vacío en Android (Google Play no deja enlazar a un pago). */
  buyUrl: string;
}

export const AccesoCtx = createContext<AccesoContexto>({ acceso: { modo: 'completo', daysLeft: null }, activar: () => {}, buyUrl: '' });
export const useAcceso = () => useContext(AccesoCtx);
