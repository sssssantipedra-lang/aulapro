// Cloudflare Pages (respaldo de aulapro.app): entrar con Microsoft y guardar en OneDrive. Ver ../_microsoft.js.
// Necesita el secreto MICROSOFT_CLIENT_SECRET (y, opcional, un KV `LIMITE`: ver ../_limite.js).
import { pedirAMicrosoft } from '../_microsoft.js';
import { corsPara } from '../_origenes.js';
import { dentroDelLimite, respuestaLimite } from '../_limite.js';

export const onRequestOptions = ({ request }) => new Response(null, { status: 204, headers: corsPara(request.headers.get('Origin')) });

export async function onRequestPost({ request, params, env }) {
  const cors = corsPara(request.headers.get('Origin'));
  const ip = request.headers.get('CF-Connecting-IP') || 'desconocida';
  if (!(await dentroDelLimite(env.LIMITE, `microsoft-ip:${ip}`, 40, 600))) return respuestaLimite(cors);
  return pedirAMicrosoft(params.accion, await request.json().catch(() => ({})), env.MICROSOFT_CLIENT_SECRET, cors);
}
