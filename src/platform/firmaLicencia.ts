/**
 * Versión web: comprobar la firma que ponen las funciones de la licencia
 * (`web/funciones/api/_firma.js`, Ed25519). La app solo da por buena una
 * licencia que lleve una firma válida y que diga lo mismo que el registro:
 * escribir a mano un registro en el navegador ya no basta. No lo hace
 * imposible (quien cambie el código se lo salta), solo sube el listón.
 *
 * Desde el 1-11-2026 cada firma caduca a los 7 días (el servidor la renueva
 * cada día con conexión) y sin la llave pública ya no se da nada por bueno:
 * antes bastaba con bloquear su descarga en el navegador. La llave se guarda
 * en el dispositivo en cuanto se activa una licencia (con conexión), así que
 * sin conexión se sigue pudiendo comprobar. Solo se perdona un navegador sin
 * Ed25519, que no puede comprobar nada.
 */
import type { Kv } from './webFs';

/** Lo que tiene que decir la firma. Solo se comparan los campos que se dan. */
export interface Esperado { t: 'cuenta' | 'clave'; email?: string; key?: string; fundador?: boolean; instance?: string }

const desdeB64url = (s: string) => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b + '='.repeat((4 - (b.length % 4)) % 4)), c => c.charCodeAt(0));
};

export function leerFirma(firma: string): Record<string, unknown> | null {
  try { return JSON.parse(new TextDecoder().decode(desdeB64url(firma.split('.')[0]))); } catch { return null; }
}

export function crearVerificador(kv: Kv, pedirClave: () => Promise<string>) {
  const CLAVE = 'licencia_clave_publica';

  async function comprobarCon(x: string, firma: string): Promise<boolean | null> {
    try {
      const [cuerpo, sello] = firma.split('.');
      if (!cuerpo || !sello) return false;
      const pub = await crypto.subtle.importKey('jwk', { kty: 'OKP', crv: 'Ed25519', x }, { name: 'Ed25519' }, false, ['verify']);
      return await crypto.subtle.verify({ name: 'Ed25519' }, pub, desdeB64url(sello), new TextEncoder().encode(cuerpo));
    } catch (err) {
      // Un navegador que no conoce Ed25519: no se puede comprobar
      return (err as DOMException)?.name === 'NotSupportedError' ? null : false;
    }
  }

  async function clave(nueva: boolean): Promise<string> {
    if (!nueva) { const k = await kv.get<string>(CLAVE).catch(() => undefined); if (k) return k; }
    const k = await pedirClave().catch(() => '');
    if (k) await kv.set(CLAVE, k).catch(() => {});
    return k;
  }

  async function verificar(firma: string | undefined, esperado: Esperado, ahora = Date.now()): Promise<boolean> {
    if (!firma) return false;
    const datos = leerFirma(firma);
    if (!datos) return false;
    // Caducada (o de antes del 1-11-2026, sin fecha): hay que renovarla con conexión
    if (typeof datos.exp !== 'number' || datos.exp * 1000 <= ahora) return false;
    let x = await clave(false);
    if (!x) return false;
    for (const [k, v] of Object.entries(esperado)) {
      if (v === undefined) continue;
      const d = datos[k];
      if (k === 'email' ? String(d ?? '').toLowerCase() !== String(v).toLowerCase() : d !== v) return false;
    }
    let ok = await comprobarCon(x, firma);
    // La llave pudo cambiar (otro secreto de Google): se pide de nuevo una vez
    if (ok === false && (x = await clave(true))) ok = await comprobarCon(x, firma);
    return ok !== false;
  }

  /** Guarda la llave pública en el dispositivo (al activar, con conexión), para comprobar después sin conexión. */
  verificar.precargar = () => clave(false).then(() => undefined, () => undefined);
  return verificar;
}

/** Hasta cuándo vale una firma (ms), o 0 si no se puede leer. Solo para decidir cuándo renovarla, no para fiarse. */
export function caducidadDeFirma(firma: string | undefined): number {
  const exp = firma ? leerFirma(firma)?.exp : undefined;
  return typeof exp === 'number' ? exp * 1000 : 0;
}
