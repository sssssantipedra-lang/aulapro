// Licencias firmadas de la versión web (petición del dueño, 29-10-2026): las funciones de la licencia
// firman lo que dan por bueno (la compra de una cuenta, un fundador, una clave activada) y la app solo
// se fía de lo que lleva una firma válida. Así no basta con escribir a mano un registro de licencia en
// el navegador. No lo hace imposible (quien cambie el código de la app se lo salta), solo sube el listón.
//
// Firma Ed25519 con una llave que se saca del secreto GOOGLE_CLIENT_SECRET, que ya está en Netlify y en
// Cloudflare: las dos copias firman con la misma llave sin otro secreto más. La pública se pide en
// /api/licencia/clave. Si cambia el secreto de Google, cambia la llave y las licencias se vuelven a firmar
// solas en la siguiente comprobación con conexión.
const enc = new TextEncoder();
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let cache = null;
async function llave(secreto) {
  if (cache?.secreto === secreto) return cache;
  const hmac = await crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const semilla = new Uint8Array(await crypto.subtle.sign('HMAC', hmac, enc.encode('aulapro-licencia-v1')));
  // PKCS#8 de una llave Ed25519 a partir de su semilla de 32 bytes
  const pkcs8 = new Uint8Array([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20, ...semilla]);
  const privada = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, true, ['sign']);
  const jwk = await crypto.subtle.exportKey('jwk', privada);
  cache = { secreto, privada, publica: jwk.x };
  return cache;
}

/**
 * Días que vale una firma (1-11-2026, decisión del dueño: «sin pagar, no hay app»). La app la renueva sola
 * cada día con conexión; si alguien bloquea las comprobaciones, a los 7 días la licencia deja de valer.
 */
export const DIAS_FIRMA = 7;

/** `datos` firmados: «base64url(json).base64url(firma)», con su caducidad (`exp`, en segundos). Sin secreto, cadena vacía. */
export async function firmar(datos, secreto, ahora = Date.now()) {
  if (!secreto) return '';
  const { privada } = await llave(secreto);
  const conCaducidad = { ...datos, exp: datos.exp ?? Math.floor(ahora / 1000) + DIAS_FIRMA * 86400 };
  const cuerpo = b64url(enc.encode(JSON.stringify(conCaducidad)));
  const firma = await crypto.subtle.sign({ name: 'Ed25519' }, privada, enc.encode(cuerpo));
  return `${cuerpo}.${b64url(firma)}`;
}

/** La llave pública (x de la JWK, base64url), para que la app compruebe las firmas. */
export async function clavePublica(secreto) {
  return secreto ? (await llave(secreto)).publica : '';
}

const desdeB64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), c => c.charCodeAt(0));

/** Lo que dice una firma de estas funciones, si es auténtica y no ha caducado; si no, `null`. */
export async function leerFirmaValida(firma, secreto, ahora = Date.now()) {
  if (!secreto || typeof firma !== 'string' || firma.length > 4000) return null;
  const [cuerpo, sello] = firma.split('.');
  if (!cuerpo || !sello) return null;
  try {
    const { publica } = await llave(secreto);
    const pub = await crypto.subtle.importKey('jwk', { kty: 'OKP', crv: 'Ed25519', x: publica }, { name: 'Ed25519' }, false, ['verify']);
    if (!(await crypto.subtle.verify({ name: 'Ed25519' }, pub, desdeB64url(sello), enc.encode(cuerpo)))) return null;
    const datos = JSON.parse(new TextDecoder().decode(desdeB64url(cuerpo)));
    if (typeof datos.exp !== 'number' || datos.exp * 1000 <= ahora) return null;
    return datos;
  } catch {
    return null;
  }
}
