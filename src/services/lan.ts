/**
 * Canal local para «Trabajo compartido»: cuando los dos equipos están en la
 * misma wifi pero sin internet (el punto de encuentro de PeerJS no es
 * alcanzable), el que manda abre un pequeño servidor en su propio equipo y el
 * que recibe lee y escribe el paquete compartido por HTTP directo. Es el mismo
 * patrón que la Sala de alumnos.
 */

import type { SharedBundle } from './sync';

export interface LanTarget {
  ip: string;
  port: number;
  code: string;
}

/** La URL que identifica la sesión local: la que va en el QR o se dicta. */
export function buildLanUrl(ip: string, port: number, code: string): string {
  return `http://${ip}:${port}/share?c=${encodeURIComponent(code)}`;
}

/** Saca la dirección local de un QR o de un texto. `null` si no es de Aula Pro. */
export function parseLanUrl(raw: string): LanTarget | null {
  const s = (raw ?? '').trim();
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.pathname !== '/share') return null;
  const code = (u.searchParams.get('c') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) return null;
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname)) return null;
  return { ip: u.hostname, port: Number(u.port) || (u.protocol === 'https:' ? 443 : 80), code };
}

/** Trae el paquete compartido del anfitrión. `null` si no responde o el código no vale. */
export async function lanPullBundle(target: LanTarget): Promise<SharedBundle | null> {
  try {
    const res = await fetch(buildLanUrl(target.ip, target.port, target.code));
    if (!res.ok) return null;
    return (await res.json()) as SharedBundle;
  } catch {
    return null;
  }
}

/** Envía el paquete local al anfitrión y devuelve el suyo ya mezclado. */
export async function lanPushBundle(target: LanTarget, bundle: SharedBundle): Promise<SharedBundle | null> {
  try {
    // `text/plain` convierte el POST en una petición «simple» (sin preflight de
    // CORS); con `application/json` el WebView pedía un OPTIONS previo que en
    // Android no se resolvía y el anfitrión nunca se enteraba. El servidor lee
    // el cuerpo como JSON igualmente.
    const res = await fetch(buildLanUrl(target.ip, target.port, target.code), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(bundle),
    });
    if (!res.ok) return null;
    return (await res.json()) as SharedBundle;
  } catch {
    return null;
  }
}
