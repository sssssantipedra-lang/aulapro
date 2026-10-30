// Respaldo en Netlify de web/funciones/api/licencia/[accion].js (ver netlify.toml): pasa a Lemon
// Squeezy la activación, la comprobación o la desactivación de una clave. Admite CORS porque la app
// de aulapro.app la llama cuando Cloudflare no responde.
import { clavePublica } from '../funciones/api/_firma.js';
import { conFirma } from '../funciones/api/licencia/[accion].js';
import { corsPara } from '../funciones/api/_origenes.js';
import { dentroDelLimite, respuestaLimite } from './_limite.mjs';

const ACCIONES = new Set(['activate', 'validate', 'deactivate']);
const CAMPOS = ['license_key', 'instance_name', 'instance_id'];

export default async (request, context) => {
  const cors = corsPara(request.headers.get('Origin'));
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const accion = context.params.accion;
  const secreto = Netlify.env.get('GOOGLE_CLIENT_SECRET');
  if (request.method === 'GET' && accion === 'clave') {
    return new Response(JSON.stringify({ x: await clavePublica(secreto) }), {
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    });
  }
  if (request.method !== 'POST' || !ACCIONES.has(accion)) return new Response('Not found', { status: 404, headers: cors });
  const entrada = new URLSearchParams(await request.text());
  const salida = new URLSearchParams();
  for (const c of CAMPOS) {
    const v = entrada.get(c);
    if (v) salida.set(c, v.slice(0, 200));
  }

  // «activate» agota el cupo de dispositivos de una clave si se llama muchas veces: 5 por clave y
  // 20 por IP cada 10 minutos. Las demás acciones solo se limitan por IP.
  const ip = context.ip || 'desconocida';
  const key = salida.get('license_key') || '';
  const limites = accion === 'activate' && key
    ? [dentroDelLimite(`activar-clave:${key}`, 5, 600), dentroDelLimite(`${accion}-ip:${ip}`, 20, 600)]
    : [dentroDelLimite(`${accion}-ip:${ip}`, 20, 600)];
  if ((await Promise.all(limites)).some(ok => !ok)) return respuestaLimite(cors);

  const res = await fetch(`https://api.lemonsqueezy.com/v1/licenses/${accion}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: salida,
  });
  return new Response(await conFirma(accion, salida, res, secreto), {
    status: res.status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
};

export const config = { path: ['/api/licencia/:accion'], preferStatic: false };
