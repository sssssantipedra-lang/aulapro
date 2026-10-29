/**
 * Versión web: comprobar la firma que ponen las funciones de la licencia
 * (`web/funciones/api/_firma.js`, Ed25519). La app solo da por buena una
 * licencia que lleve una firma válida y que diga lo mismo que el registro:
 * escribir a mano un registro en el navegador ya no basta. No lo hace
 * imposible (quien cambie el código se lo salta), solo sube el listón.
 *
 * Se perdona lo que no se puede comprobar: sin la llave pública (sin conexión
 * la primera vez) o en un navegador sin Ed25519, la licencia vale.
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

  return async function verificar(firma: string | undefined, esperado: Esperado): Promise<boolean> {
    // Sin llave pública (sin conexión la primera vez, o el servidor sin secreto): no se puede comprobar
    let x = await clave(false);
    if (!x) return true;
    if (!firma) return false;
    const datos = leerFirma(firma);
    if (!datos) return false;
    for (const [k, v] of Object.entries(esperado)) {
      if (v === undefined) continue;
      const d = datos[k];
      if (k === 'email' ? String(d ?? '').toLowerCase() !== String(v).toLowerCase() : d !== v) return false;
    }
    let ok = await comprobarCon(x, firma);
    // La llave pudo cambiar (otro secreto de Google): se pide de nuevo una vez
    if (ok === false && (x = await clave(true))) ok = await comprobarCon(x, firma);
    return ok !== false;
  };
}
