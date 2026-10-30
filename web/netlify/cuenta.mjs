// Versión web: la licencia de quien entra con Google, sin escribir la clave (decisión del dueño,
// 29-10-2026). La app manda el token de Google recién emitido; aquí se comprueba con Google que es
// auténtico y de AulaPro, y con el correo verificado se busca en Lemon Squeezy un pedido pagado de
// la tienda de AulaPro y su clave. La app la activa como si el docente la hubiera escrito.
//
// Respaldo en Netlify (ver netlify.toml), con CORS: la app la llama cuando Cloudflare no responde.
// Necesita la variable LEMONSQUEEZY_API_KEY en el sitio de Netlify. El correo
// solo se usa para la búsqueda: no se guarda ni se registra. Ver src/platform/cuentaWeb.ts.
import { firmar } from '../funciones/api/_firma.js';
import { corsPara } from '../funciones/api/_origenes.js';
import { verificarTokenMicrosoft } from '../funciones/api/_microsoft.js';
import { dentroDelLimite, respuestaLimite, LIMITES } from '../lib-netlify/limite.mjs';

const GOOGLE_CLIENT_ID = '617666474619-nkre1e8divbf9orspfjv8cpcl7meuoo0.apps.googleusercontent.com';
const STORE_ID = '487841';
const LS = 'https://api.lemonsqueezy.com/v1';

const json = (cuerpo, status, cors) => new Response(JSON.stringify(cuerpo), {
  status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export default async (request, context) => {
  const cors = corsPara(request.headers.get('Origin'));
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const env = { LEMONSQUEEZY_API_KEY: Netlify.env.get('LEMONSQUEEZY_API_KEY'), FUNDADORES: Netlify.env.get('FUNDADORES'), GOOGLE_CLIENT_SECRET: Netlify.env.get('GOOGLE_CLIENT_SECRET') };

  // Tope por IP generoso: un centro entero entra desde la misma wifi (ver LIMITES en funciones/api/_limite.js).
  const ip = context.ip || 'desconocida';
  if (!(await dentroDelLimite(`cuenta-ip:${ip}`, LIMITES.ip, LIMITES.ventana))) return respuestaLimite(cors);

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

  // Fundadores (quien usaba la app de Windows o Android antes del 10-11-2026): gratis para siempre.
  // Sus correos van en la variable secreta FUNDADORES (separados por comas o saltos de línea), nunca en el repositorio.
  const fundadores = String(env.FUNDADORES ?? '').split(/[\s,;]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
  if (fundadores.includes(email)) return json({ fundador: true, firma: await firmar({ t: 'cuenta', email, fundador: true }, env.GOOGLE_CLIENT_SECRET) }, 200, cors);
  if (!env.LEMONSQUEEZY_API_KEY) return json({ error: 'sin-configurar' }, 503, cors);

  const cab = { Accept: 'application/vnd.api+json', Authorization: `Bearer ${env.LEMONSQUEEZY_API_KEY}` };
  const pedidos = await fetch(`${LS}/orders?filter[store_id]=${STORE_ID}&filter[user_email]=${encodeURIComponent(email)}`, { headers: cab });
  if (!pedidos.ok) return json({ error: 'tienda' }, 502, cors);
  for (const p of (await pedidos.json()).data ?? []) {
    if (p.attributes?.status !== 'paid') continue;
    const claves = await fetch(`${LS}/license-keys?filter[order_id]=${p.id}`, { headers: cab });
    if (!claves.ok) continue;
    for (const k of (await claves.json()).data ?? []) {
      const a = k.attributes ?? {};
      if (a.disabled || ['disabled', 'expired'].includes(a.status)) continue;
      if (a.key) return json({ key: a.key, firma: await firmar({ t: 'cuenta', email, key: a.key }, env.GOOGLE_CLIENT_SECRET) }, 200, cors);
    }
  }
  return json({ key: null }, 200, cors);
}

export const config = { path: '/api/licencia/cuenta' };
