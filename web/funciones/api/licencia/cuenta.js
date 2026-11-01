// Versión web: la licencia de quien entra con Google, sin escribir la clave (decisión del dueño,
// 29-10-2026). La app manda el token de Google recién emitido; aquí se comprueba con Google que es
// auténtico y de AulaPro, y con el correo verificado se busca en Lemon Squeezy un pedido pagado de
// la tienda de AulaPro y su clave. La app la activa como si el docente la hubiera escrito.
//
// Necesita el secreto LEMONSQUEEZY_API_KEY en el proyecto aulapro-app de Cloudflare Pages. El correo
// solo se usa para la búsqueda: no se guarda ni se registra. Ver src/platform/cuentaWeb.ts.
import { firmar } from '../_firma.js';
import { corsPara } from '../_origenes.js';
import { verificarTokenMicrosoft } from '../_microsoft.js';
import { dentroDelLimite, respuestaLimite, LIMITES } from '../_limite.js';
import { secretosDeLicencia } from '../_secretos.js';

const GOOGLE_CLIENT_ID = '617666474619-nkre1e8divbf9orspfjv8cpcl7meuoo0.apps.googleusercontent.com';
const STORE_ID = '487841';
const LS = 'https://api.lemonsqueezy.com/v1';

const json = (cuerpo, status, cors) => new Response(JSON.stringify(cuerpo), {
  status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

/** Desde el 29-10-2026 esto es el respaldo de Netlify: la app de aulapro.app lo llama desde otro origen. */
export const onRequestOptions = ({ request }) => new Response(null, { status: 204, headers: corsPara(request.headers.get('Origin')) });

export async function onRequestPost({ request, env }) {
  const cors = corsPara(request.headers.get('Origin'));
  const ip = request.headers.get('CF-Connecting-IP') || 'desconocida';
  // Tope por IP generoso: un centro entero entra desde la misma wifi (ver LIMITES en _limite.js).
  if (!(await dentroDelLimite(env.LIMITE, `cuenta-ip:${ip}`, LIMITES.ip, LIMITES.ventana))) return respuestaLimite(cors);

  const { token, proveedor } = await request.json().catch(() => ({}));
  if (typeof token !== 'string' || token.length > 5000) return json({ error: 'token' }, 400, cors);

  let email;
  if (proveedor === 'microsoft') {
    // Microsoft no tiene un servicio que compruebe el token: se comprueba aquí (ver _microsoft.js)
    email = (await verificarTokenMicrosoft(token))?.email;
    if (!email) return json({ error: 'token' }, 401, cors);
  } else {
    const g = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
    if (!g.ok) return json({ error: 'token' }, 401, cors);
    const info = await g.json();
    if (info.aud !== GOOGLE_CLIENT_ID || String(info.email_verified) !== 'true' || !info.email) return json({ error: 'token' }, 401, cors);
    email = String(info.email).trim().toLowerCase();
  }
  // Y un tope por cuenta (auditoría del 1-11-2026): una misma cuenta llamando sin parar desde muchas IP no agota la tienda
  if (!(await dentroDelLimite(env.LIMITE, `cuenta-correo:${email}`, LIMITES.correo, LIMITES.ventana))) return respuestaLimite(cors);
  const secretos = secretosDeLicencia(env);

  // Fundadores (quien usaba la app de Windows o Android antes del 10-11-2026): gratis para siempre.
  // Sus correos van en la variable secreta FUNDADORES (separados por comas o saltos de línea), nunca en el repositorio.
  const fundadores = String(env.FUNDADORES ?? '').split(/[\s,;]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
  if (fundadores.includes(email)) return json({ fundador: true, firma: await firmar({ t: 'cuenta', email, fundador: true }, secretos) }, 200, cors);
  if (!env.LEMONSQUEEZY_API_KEY) return json({ error: 'sin-configurar' }, 503, cors);

  const cab = { Accept: 'application/vnd.api+json', Authorization: `Bearer ${env.LEMONSQUEEZY_API_KEY}` };
  const pedidos = await fetch(`${LS}/orders?filter[store_id]=${STORE_ID}&filter[user_email]=${encodeURIComponent(email)}`, { headers: cab });
  if (!pedidos.ok) return json({ error: 'tienda' }, 502, cors);
  // Si hay un pedido pagado cuya clave ya no vale (la suscripción terminó), se avisa: así la app lo sabe en cualquier dispositivo, por el correo
  let vencida = false;
  for (const p of (await pedidos.json()).data ?? []) {
    if (p.attributes?.status !== 'paid') continue;
    const claves = await fetch(`${LS}/license-keys?filter[order_id]=${p.id}`, { headers: cab });
    if (!claves.ok) continue;
    for (const k of (await claves.json()).data ?? []) {
      const a = k.attributes ?? {};
      if (a.disabled || ['disabled', 'expired'].includes(a.status)) { vencida = true; continue; }
      if (a.key) return json({ key: a.key, firma: await firmar({ t: 'cuenta', email, key: a.key }, secretos) }, 200, cors);
    }
  }
  return json(vencida ? { key: null, vencida: true } : { key: null }, 200, cors);
}
