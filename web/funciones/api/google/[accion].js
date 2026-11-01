// Cloudflare Pages (respaldo de aulapro.app): ver _comun.js.
import { corsDe, pedirAGoogle } from './_comun.js';
import { dentroDelLimite, respuestaLimite, LIMITES } from '../_limite.js';

export const onRequestOptions = ({ request }) => new Response(null, { status: 204, headers: corsDe(request) });

export async function onRequestPost({ request, params, env }) {
  const cors = corsDe(request);
  const ip = request.headers.get('CF-Connecting-IP') || 'desconocida';
  if (!(await dentroDelLimite(env.LIMITE, `google-ip:${ip}`, LIMITES.google, LIMITES.ventana))) return respuestaLimite(cors);
  return pedirAGoogle(params.accion, await request.json().catch(() => ({})), env.GOOGLE_CLIENT_SECRET, cors);
}
