// Versión web: el permiso para guardar en el Google Drive del docente (ver src/platform/googleDrive.ts).
// Google solo da un permiso duradero (refresh token) a cambio del «secreto de cliente», que no puede ir
// dentro de la app. Estas funciones hacen ese cambio y nada más: reciben el código o el refresh token
// del navegador, se lo pasan a Google con el secreto y devuelven la respuesta. No guardan nada, no ven
// ningún dato del docente (los archivos van del navegador a Drive directamente) y no registran nada.
// Necesitan la variable GOOGLE_CLIENT_SECRET. La misma lógica, en web/netlify/google.mjs.
//
// Desde el 1-11-2026 (auditoría) solo aceptan peticiones del navegador desde los sitios de AulaPro (`corsPara`, como las
// de la licencia y las de Microsoft; antes, `*`) y tienen un tope de peticiones por IP (`LIMITES.google`): sin él,
// cualquiera podía llamarlas sin parar, gastando las invocaciones del alojamiento y la cuota del cliente de Google.
import { corsPara } from '../_origenes.js';

export const GOOGLE_CLIENT_ID = '617666474619-nkre1e8divbf9orspfjv8cpcl7meuoo0.apps.googleusercontent.com';
// Las direcciones a las que vuelve la app desde la página de Google (Safari; tienen que estar también
// en «URI de redireccionamiento autorizados» del cliente «AulaPro web»). Sin ella, la ventana emergente.
const VUELTAS = ['https://aulapro.app/app/', 'https://www.aulapro.app/app/', 'https://aulapro-respaldo.netlify.app/app/',
  'https://aulapro-app.pages.dev/app/', 'https://prueba.aulapro-app.pages.dev/app/', 'http://localhost:5173/'];
/** Las cabeceras CORS de una petición: solo los orígenes de AulaPro (ver _origenes.js). */
export const corsDe = request => corsPara(request.headers.get('Origin'));
export const json = (cuerpo, status = 200, cors = {}) => new Response(JSON.stringify(cuerpo), {
  status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

/** `accion`: 'token' (código de la ventana de Google → permisos) o 'renovar' (refresh token → nuevo acceso). */
export async function pedirAGoogle(accion, cuerpo, secreto, cors = {}) {
  const json_ = (c, status) => json(c, status, cors);
  if (!secreto) return json_({ error: 'sin-configurar' }, 503);
  const p = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: secreto });
  if (accion === 'token') {
    if (typeof cuerpo.code !== 'string' || cuerpo.code.length > 2000) return json_({ error: 'codigo' }, 400);
    p.set('grant_type', 'authorization_code'); p.set('code', cuerpo.code); p.set('redirect_uri', VUELTAS.includes(cuerpo.redirect_uri) ? cuerpo.redirect_uri : 'postmessage');
  } else if (accion === 'renovar') {
    if (typeof cuerpo.refresh_token !== 'string' || cuerpo.refresh_token.length > 2000) return json_({ error: 'token' }, 400);
    p.set('grant_type', 'refresh_token'); p.set('refresh_token', cuerpo.refresh_token);
  } else {
    return json_({ error: 'accion' }, 404);
  }
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: p });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) return json_({ error: d.error === 'invalid_grant' ? 'caducado' : 'google' }, r.status === 400 ? 401 : 502);
  return json_({ access_token: d.access_token, expires_in: d.expires_in, ...(d.refresh_token ? { refresh_token: d.refresh_token } : {}), scope: d.scope, ...(d.id_token ? { id_token: d.id_token } : {}) }, 200);
}
