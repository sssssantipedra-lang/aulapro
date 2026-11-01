// «Sin pagar, no hay app» (1-11-2026, decisión del dueño, como Canva o Classroomscreen): el código de las
// pantallas de AulaPro (los bloques de /app/assets/ que no hacen falta para entrar o comprar) solo se
// entrega a quien tiene una sesión, y la sesión solo la crea el servidor, a partir de una licencia firmada
// por estas funciones (`_firma.js`) que no haya caducado. Es una cookie HttpOnly: el navegador la guarda y
// la manda, pero ni la página ni quien abre F12 pueden leerla, cambiarla o inventarla sin el secreto.
//
// Los datos del docente no pasan por aquí: siguen en su navegador y en su Drive u OneDrive. La cookie solo
// dice «esta licencia vale hasta tal día» (y de qué tipo es), sin el correo ni la clave.
//
// La firma es HMAC-SHA256 con una llave sacada del mismo secreto que las licencias firmadas (LICENCIA_SECRETO o, si
// no está, GOOGLE_CLIENT_SECRET; ver _secretos.js): las dos copias (Netlify y Cloudflare) aceptan las sesiones de la
// otra, y las del secreto anterior mientras se cambia.
import { DIAS_FIRMA, leerFirmaValida } from './_firma.js';
import { comoSecretos } from './_secretos.js';

export const COOKIE = 'aulapro_sesion';
const enc = new TextEncoder();
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const desdeB64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), c => c.charCodeAt(0));

/** Las llaves ya calculadas, por secreto (puede haber dos: el de ahora y el anterior). */
const cache = new Map();
async function llave(secreto) {
  if (cache.has(secreto)) return cache.get(secreto);
  const base = await crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const cruda = await crypto.subtle.sign('HMAC', base, enc.encode('aulapro-sesion-v1'));
  const llaveSesion = await crypto.subtle.importKey('raw', cruda, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  if (cache.size > 8) cache.clear();
  cache.set(secreto, llaveSesion);
  return llaveSesion;
}

/** La sesión firmada (con el secreto de ahora): «base64url(json).base64url(hmac)». */
export async function crearSesion(datos, secretos) {
  const cuerpo = b64url(enc.encode(JSON.stringify(datos)));
  const sello = await crypto.subtle.sign('HMAC', await llave(comoSecretos(secretos).firmar), enc.encode(cuerpo));
  return `${cuerpo}.${b64url(sello)}`;
}

/** Lo que dice la cookie de sesión de la petición (del secreto de ahora o del anterior), si es auténtica y no ha caducado; si no, `null`. */
export async function leerSesion(cabeceraCookie, secretos, ahora = Date.now()) {
  const { aceptar } = comoSecretos(secretos);
  if (!aceptar.length || !cabeceraCookie) return null;
  const valor = cabeceraCookie.split(/;\s*/).find(c => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!valor || valor.length > 2000) return null;
  const [cuerpo, sello] = valor.split('.');
  if (!cuerpo || !sello) return null;
  for (const secreto of aceptar) {
    try {
      if (!(await crypto.subtle.verify('HMAC', await llave(secreto), desdeB64url(sello), enc.encode(cuerpo)))) continue;
      const datos = JSON.parse(new TextDecoder().decode(desdeB64url(cuerpo)));
      return typeof datos.exp === 'number' && datos.exp * 1000 > ahora ? datos : null;
    } catch {
      return null;
    }
  }
  return null;
}

const cookie = (valor, segundos) => `${COOKIE}=${valor}; Path=/app/; Max-Age=${segundos}; HttpOnly; Secure; SameSite=Lax`;

const json = (cuerpo, status, extra = {}) => new Response(JSON.stringify(cuerpo), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
});

/**
 * /api/licencia/sesion. POST con `{ firma }` (la licencia firmada que la app ya tiene): si la firma es de
 * estas funciones y no ha caducado, deja la cookie hasta que caduque la firma (7 días como mucho).
 * DELETE la borra (la suscripción terminó). Solo desde la propia web: la cookie es de este sitio.
 */
export async function responderSesion(request, secretos, ahora = Date.now()) {
  if (request.method === 'DELETE') return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
  if (request.method !== 'POST') return json({ error: 'metodo' }, 405);
  const s = comoSecretos(secretos);
  if (!s.firmar) return json({ error: 'sin-configurar' }, 503);
  const { firma } = await request.json().catch(() => ({}));
  const datos = await leerFirmaValida(firma, s, ahora);
  if (!datos || !['clave', 'cuenta'].includes(datos.t)) return json({ error: 'firma' }, 401, { 'Set-Cookie': cookie('', 0) });
  const exp = Math.min(datos.exp, Math.floor(ahora / 1000) + DIAS_FIRMA * 86400);
  const valor = await crearSesion({ v: 1, t: datos.t, ...(datos.fundador ? { fundador: true } : {}), exp }, s);
  return json({ hasta: exp * 1000 }, 200, { 'Set-Cookie': cookie(valor, exp - Math.floor(ahora / 1000)) });
}
