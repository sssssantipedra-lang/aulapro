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

/** `datos` firmados: «base64url(json).base64url(firma)». Sin secreto, cadena vacía. */
export async function firmar(datos, secreto) {
  if (!secreto) return '';
  const { privada } = await llave(secreto);
  const cuerpo = b64url(enc.encode(JSON.stringify(datos)));
  const firma = await crypto.subtle.sign({ name: 'Ed25519' }, privada, enc.encode(cuerpo));
  return `${cuerpo}.${b64url(firma)}`;
}

/** La llave pública (x de la JWK, base64url), para que la app compruebe las firmas. */
export async function clavePublica(secreto) {
  return secreto ? (await llave(secreto)).publica : '';
}
