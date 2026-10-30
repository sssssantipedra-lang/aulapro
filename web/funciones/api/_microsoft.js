// Entrar con Microsoft (versión web). Dos cosas en el servidor, igual que con Google:
//
//  1. Cambiar el código de la página de Microsoft, o el permiso duradero (refresh token), por accesos
//     de una hora. Necesita el «secreto de cliente» (MICROSOFT_CLIENT_SECRET), que no puede ir dentro
//     de la app. No guarda ni registra nada. Ver `pedirAMicrosoft` y api/microsoft/[accion].js.
//  2. Comprobar de verdad el token de identidad que manda la app para buscar la licencia
//     (`verificarTokenMicrosoft`). Google tiene un servicio que lo hace (tokeninfo); Microsoft no, así que
//     aquí se comprueba la firma RS256 con las llaves públicas de Microsoft y los datos del token.
//
// Cuidado con el correo: en un token de Microsoft de una cuenta de centro o empresa, el correo lo escribe
// el administrador de ese inquilino y no está comprobado (basta crear un inquilino propio y poner el
// correo de otra persona). Solo se fía del correo si es una cuenta personal de Microsoft (Microsoft
// comprueba que es del titular) o si el token dice que el dominio del correo está verificado (`xms_edov`,
// notificación opcional «ID» en el registro de la aplicación). Si no, no hay licencia automática y el
// docente escribe su clave.
export const MICROSOFT_CLIENT_ID = 'aaf98623-576d-4fed-903f-3a0812385435'; // «Id. de aplicación (cliente)» del registro en entra.microsoft.com
const AUTORIDAD = 'https://login.microsoftonline.com/common';
const INQUILINO_PERSONAL = '9188040d-6c67-4c5b-b112-36a304b66dad';
const SCOPE_IDENTIDAD = 'openid email profile offline_access';
const SCOPE_ARCHIVOS = 'Files.ReadWrite.AppFolder';

// Las direcciones a las que vuelve la app desde la página de Microsoft; tienen que estar también en
// «URI de redirección» del registro (plataforma Web). Las mismas que las de Google (api/google/_comun.js).
export const VUELTAS = ['https://aulapro.app/app/', 'https://www.aulapro.app/app/', 'https://aulapro-respaldo.netlify.app/app/',
  'https://aulapro-app.pages.dev/app/', 'https://prueba.aulapro-app.pages.dev/app/', 'http://localhost:5173/'];

const enc = new TextEncoder();
const desdeB64url = s => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b + '='.repeat((4 - (b.length % 4)) % 4)), c => c.charCodeAt(0));
};
const leerJson = s => JSON.parse(new TextDecoder().decode(desdeB64url(s)));

let llaves = null;
/** Para las pruebas. */
export const olvidarLlaves = () => { llaves = null; };
/** Las llaves públicas de Microsoft (cambian de vez en cuando): se guardan una hora y se piden otra vez si falta la que se busca. */
async function llavePara(kid, fetcher, ahora) {
  if (!llaves || ahora - llaves.en > 3600_000 || !llaves.lista.some(k => k.kid === kid)) {
    const r = await fetcher(`${AUTORIDAD}/discovery/v2.0/keys`);
    if (!r.ok) throw new Error('llaves');
    llaves = { en: ahora, lista: (await r.json()).keys ?? [] };
  }
  return llaves.lista.find(k => k.kid === kid);
}

/**
 * Comprueba un token de identidad de Microsoft: firma, destinatario, emisor y caducidad. Devuelve
 * `{ email }` (en minúsculas) si el correo es de fiar, y `null` en cualquier otro caso.
 */
export async function verificarTokenMicrosoft(token, clientId = MICROSOFT_CLIENT_ID, { fetcher = fetch, ahora = Date.now() } = {}) {
  try {
    if (!clientId) return null;
    const [h, p, s] = String(token).split('.');
    if (!h || !p || !s) return null;
    const cab = leerJson(h);
    if (cab.alg !== 'RS256' || !cab.kid) return null;
    const jwk = await llavePara(cab.kid, fetcher, ahora);
    if (!jwk || jwk.kty !== 'RSA') return null;
    const llave = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', llave, desdeB64url(s), enc.encode(`${h}.${p}`)))) return null;

    const d = leerJson(p);
    const seg = ahora / 1000;
    if (d.aud !== clientId || typeof d.tid !== 'string') return null;
    if (d.iss !== `https://login.microsoftonline.com/${d.tid}/v2.0`) return null;
    if (typeof d.exp !== 'number' || d.exp < seg || (typeof d.nbf === 'number' && d.nbf > seg + 300)) return null;
    const email = typeof d.email === 'string' ? d.email.trim().toLowerCase() : '';
    if (!email || !email.includes('@')) return null;
    const dominioVerificado = d.xms_edov === true || d.xms_edov === 1 || d.xms_edov === '1' || d.xms_edov === 'true';
    if (d.tid !== INQUILINO_PERSONAL && !dominioVerificado) return null;
    return { email };
  } catch {
    return null;
  }
}

const json = (cuerpo, status, cors) => new Response(JSON.stringify(cuerpo), {
  status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

/**
 * `accion`: 'token' (código de la página de Microsoft → accesos) o 'renovar' (permiso duradero → acceso
 * nuevo). `cuerpo.archivos`: con el permiso de OneDrive (`Files.ReadWrite.AppFolder`) o solo la identidad.
 */
export async function pedirAMicrosoft(accion, cuerpo, secreto, cors, fetcher = fetch, clientId = MICROSOFT_CLIENT_ID) {
  if (!secreto || !clientId) return json({ error: 'sin-configurar' }, 503, cors);
  const p = new URLSearchParams({ client_id: clientId, client_secret: secreto });
  const scope = cuerpo.archivos ? `${SCOPE_IDENTIDAD} ${SCOPE_ARCHIVOS}` : SCOPE_IDENTIDAD;
  if (accion === 'token') {
    if (typeof cuerpo.code !== 'string' || cuerpo.code.length > 4000) return json({ error: 'codigo' }, 400, cors);
    if (typeof cuerpo.code_verifier !== 'string' || cuerpo.code_verifier.length < 43 || cuerpo.code_verifier.length > 128) return json({ error: 'codigo' }, 400, cors);
    if (!VUELTAS.includes(cuerpo.redirect_uri)) return json({ error: 'direccion' }, 400, cors);
    p.set('grant_type', 'authorization_code'); p.set('code', cuerpo.code); p.set('redirect_uri', cuerpo.redirect_uri);
    p.set('code_verifier', cuerpo.code_verifier); p.set('scope', scope);
  } else if (accion === 'renovar') {
    if (typeof cuerpo.refresh_token !== 'string' || cuerpo.refresh_token.length > 4000) return json({ error: 'token' }, 400, cors);
    p.set('grant_type', 'refresh_token'); p.set('refresh_token', cuerpo.refresh_token); p.set('scope', scope);
  } else {
    return json({ error: 'accion' }, 404, cors);
  }
  const r = await fetcher(`${AUTORIDAD}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: p });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) {
    // El motivo que da Microsoft (código AADSTS y primera frase) para poder saber qué falla; no lleva ni el secreto ni el código del docente
    const detalle = String(d.error_description ?? '').split(/\r?\n/)[0].slice(0, 220);
    return json({ error: d.error === 'invalid_grant' || d.error === 'interaction_required' ? 'caducado' : 'microsoft', ...(d.error ? { motivo: String(d.error).slice(0, 60) } : {}), ...(detalle ? { detalle } : {}) }, r.status === 400 ? 401 : 502, cors);
  }
  // Microsoft da un permiso duradero nuevo en cada renovación: la app guarda el último para que no caduque
  return json({ access_token: d.access_token, expires_in: d.expires_in, ...(d.refresh_token ? { refresh_token: d.refresh_token } : {}), scope: d.scope, ...(d.id_token ? { id_token: d.id_token } : {}) }, 200, cors);
}
