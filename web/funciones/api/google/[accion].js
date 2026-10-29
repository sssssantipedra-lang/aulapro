// Cloudflare Pages (respaldo de aulapro.app): ver _comun.js.
import { CORS, pedirAGoogle } from './_comun.js';

export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

export async function onRequestPost({ request, params, env }) {
  return pedirAGoogle(params.accion, await request.json().catch(() => ({})), env.GOOGLE_CLIENT_SECRET);
}
