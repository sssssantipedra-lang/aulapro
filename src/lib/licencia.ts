import { createContext, useContext } from 'react';
import type { LicenseState } from '../types/electron';

/**
 * Lo que la interfaz hace con el estado de la licencia, aparte de la pantalla de
 * activación: una licencia anual caducada deja la app en solo lectura (decisión
 * del dueño, 20-10-2026: «no se podrá hacer nada, solo revisar lo que ya estaba
 * creado») y una a punto de caducar avisa antes. Las reglas de fechas están en
 * `electron/licenseCore.cjs` y `platform/androidLicense.ts`.
 */

/** Cuántos días antes de caducar se avisa (igual que `WARN_BEFORE` del proceso principal). */
export const AVISO_DIAS = 30;

export type AvisoLicencia = 'caducada' | 'por-caducar' | null;

export function avisoLicencia(s: LicenseState | null | undefined): AvisoLicencia {
  if (!s) return null;
  if (s.status === 'caducada') return 'caducada';
  if (s.status === 'activa' && s.daysLeft !== null && s.daysLeft <= AVISO_DIAS) return 'por-caducar';
  return null;
}

/** Con la licencia caducada se puede abrir y exportar lo creado, pero no cambiarlo. */
export const soloLectura = (s: LicenseState | null | undefined) => s?.status === 'caducada';

const KEY = 'aulapro_aviso_caducidad';

/** El aviso de «a punto de caducar» se cierra una vez por fecha de caducidad (al renovar, vuelve a avisar el año siguiente). */
export function avisoCerrado(expiresAt: string): boolean {
  try { return localStorage.getItem(KEY) === expiresAt; } catch { return false; }
}

export function cerrarAviso(expiresAt: string) {
  try { localStorage.setItem(KEY, expiresAt); } catch { /* almacenamiento no disponible */ }
}

export interface LicenciaContexto {
  state: LicenseState | null;
  soloLectura: boolean;
  /** Pregunta ahora a la tienda; devuelve el estado nuevo o `null` si no hubo conexión. */
  recomprobar: () => Promise<LicenseState | null>;
}

/** `null` si no hay licencia que mirar (el navegador). */
export const LicenciaCtx = createContext<LicenciaContexto | null>(null);

export function useLicencia(): LicenciaContexto | null {
  return useContext(LicenciaCtx);
}
