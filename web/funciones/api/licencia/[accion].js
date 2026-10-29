// Licencia de la versión web (aulapro.app/app/): una función de Cloudflare Pages que pasa a
// Lemon Squeezy la activación, la comprobación o la desactivación de una clave. Hace falta porque
// el navegador no puede llamar a la tienda directamente desde aulapro.app (CORS); la app de
// escritorio y la de Android sí, y por eso no pasan por aquí.
//
// Solo viajan la clave, el nombre genérico del dispositivo («AulaPro · Navegador») y el número de
// activación: nada del trabajo del docente. No se guarda ni se registra nada. Ver src/platform/web.ts.
//
// Cloudflare busca las funciones en una carpeta `functions/` junto a donde se publica: el workflow
// copia esta carpeta ahí antes de publicar (ver .github/workflows/web.yml).
import { clavePublica, firmar } from '../_firma.js';

const ACCIONES = new Set(['activate', 'validate', 'deactivate']);
const CAMPOS = ['license_key', 'instance_name', 'instance_id'];

const CORS_CF = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Accept' };

/** Desde el 29-10-2026 esto es el respaldo de Netlify: la app de aulapro.app lo llama desde otro origen. */
export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS_CF });

/** La llave pública con la que la app comprueba las licencias firmadas (`_firma.js`). */
export async function onRequestGet({ params, env }) {
  if (params.accion !== 'clave') return new Response('Not found', { status: 404, headers: CORS_CF });
  return new Response(JSON.stringify({ x: await clavePublica(env.GOOGLE_CLIENT_SECRET) }), {
    headers: { ...CORS_CF, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

export async function onRequestPost({ request, params, env }) {
  if (!ACCIONES.has(params.accion)) return new Response('Not found', { status: 404, headers: CORS_CF });
  const entrada = new URLSearchParams(await request.text());
  const salida = new URLSearchParams();
  for (const c of CAMPOS) {
    const v = entrada.get(c);
    if (v) salida.set(c, v.slice(0, 200));
  }
  const res = await fetch(`https://api.lemonsqueezy.com/v1/licenses/${params.accion}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: salida,
  });
  return new Response(await conFirma(params.accion, salida, res, env.GOOGLE_CLIENT_SECRET), {
    status: res.status,
    headers: { ...CORS_CF, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** Una clave activada o comprobada sale con la firma de AulaPro (`_firma.js`). */
export async function conFirma(accion, salida, res, secreto) {
  const texto = await res.text();
  if (accion === 'deactivate' || !res.ok) return texto;
  try {
    const d = JSON.parse(texto);
    const st = d.license_key?.status;
    if (!(d.activated || d.valid) || st === 'disabled' || st === 'expired') return texto;
    const instance = d.instance?.id ?? salida.get('instance_id') ?? '';
    d.aulapro_firma = await firmar({ t: 'clave', key: salida.get('license_key'), instance }, secreto);
    return JSON.stringify(d);
  } catch { return texto; }
}
