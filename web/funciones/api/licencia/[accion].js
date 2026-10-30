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
import { corsPara } from '../_origenes.js';
import { dentroDelLimite, respuestaLimite } from '../_limite.js';

const ACCIONES = new Set(['activate', 'validate', 'deactivate']);
const CAMPOS = ['license_key', 'instance_name', 'instance_id'];

/** Desde el 29-10-2026 esto es el respaldo de Netlify: la app de aulapro.app lo llama desde otro origen. */
export const onRequestOptions = ({ request }) => new Response(null, { status: 204, headers: corsPara(request.headers.get('Origin')) });

/** La llave pública con la que la app comprueba las licencias firmadas (`_firma.js`). */
export async function onRequestGet({ request, params, env }) {
  const cors = corsPara(request.headers.get('Origin'), 'GET, OPTIONS');
  if (params.accion !== 'clave') return new Response('Not found', { status: 404, headers: cors });
  return new Response(JSON.stringify({ x: await clavePublica(env.GOOGLE_CLIENT_SECRET) }), {
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

export async function onRequestPost({ request, params, env }) {
  const cors = corsPara(request.headers.get('Origin'));
  if (!ACCIONES.has(params.accion)) return new Response('Not found', { status: 404, headers: cors });
  const entrada = new URLSearchParams(await request.text());
  const salida = new URLSearchParams();
  for (const c of CAMPOS) {
    const v = entrada.get(c);
    if (v) salida.set(c, v.slice(0, 200));
  }

  // «activate» agota el cupo de dispositivos de una clave si se llama muchas veces: 5 por clave y
  // 20 por IP cada 10 minutos (de sobra para activar un dispositivo de verdad, poco para vaciar el
  // cupo de una clave ajena). Las demás acciones solo se limitan por IP.
  const ip = request.headers.get('CF-Connecting-IP') || 'desconocida';
  const key = salida.get('license_key') || '';
  const limites = params.accion === 'activate' && key
    ? [dentroDelLimite(env.LIMITE, `activar-clave:${key}`, 5, 600), dentroDelLimite(env.LIMITE, `${params.accion}-ip:${ip}`, 20, 600)]
    : [dentroDelLimite(env.LIMITE, `${params.accion}-ip:${ip}`, 20, 600)];
  if ((await Promise.all(limites)).some(ok => !ok)) return respuestaLimite(cors);

  const res = await fetch(`https://api.lemonsqueezy.com/v1/licenses/${params.accion}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: salida,
  });
  return new Response(await conFirma(params.accion, salida, res, env.GOOGLE_CLIENT_SECRET), {
    status: res.status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
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
