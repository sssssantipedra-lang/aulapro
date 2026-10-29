// Respaldo en Netlify de web/funciones/api/licencia/[accion].js (ver netlify.toml): pasa a Lemon
// Squeezy la activación, la comprobación o la desactivación de una clave. Admite CORS porque la app
// de aulapro.app la llama cuando Cloudflare no responde.
const ACCIONES = new Set(['activate', 'validate', 'deactivate']);
const CAMPOS = ['license_key', 'instance_name', 'instance_id'];
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Accept' };

export default async (request, context) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const accion = context.params.accion;
  if (request.method !== 'POST' || !ACCIONES.has(accion)) return new Response('Not found', { status: 404, headers: CORS });
  const entrada = new URLSearchParams(await request.text());
  const salida = new URLSearchParams();
  for (const c of CAMPOS) {
    const v = entrada.get(c);
    if (v) salida.set(c, v.slice(0, 200));
  }
  const res = await fetch(`https://api.lemonsqueezy.com/v1/licenses/${accion}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: salida,
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
};

export const config = { path: ['/api/licencia/:accion'], preferStatic: false };
