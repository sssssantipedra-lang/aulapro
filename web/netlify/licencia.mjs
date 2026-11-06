// Respaldo en Netlify de web/funciones/api/licencia/[accion].js (ver netlify.toml): pasa a Lemon
// Squeezy la activación, la comprobación o la desactivación de una clave. Admite CORS porque la app
// de aulapro.app la llama cuando Cloudflare no responde.
import { clavePublica } from '../funciones/api/_firma.js';
import { responderSesion } from '../funciones/api/_sesion.js';
import { conFirma, desactivarEnTienda } from '../funciones/api/licencia/[accion].js';
import { corsPara } from '../funciones/api/_origenes.js';
import { secretosDeNetlify } from '../funciones/api/_secretos.js';
import { dentroDeLimites, respuestaLimite, LIMITES } from '../lib-netlify/limite.mjs';
import { anotarComprobacion, cortarAlTope, responderInforme } from '../funciones/api/_vigilancia.js';
import { almacenBlobs, bloqueosBlobs } from '../lib-netlify/vigilancia.mjs';
import { estaBloqueada, responderAviso, responderEstado } from '../funciones/api/_bloqueos.js';

const ACCIONES = new Set(['activate', 'validate', 'deactivate']);
const CAMPOS = ['license_key', 'instance_name', 'instance_id'];

export default async (request, context) => {
  const cors = corsPara(request.headers.get('Origin'));
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const accion = context.params.accion;
  const secretos = secretosDeNetlify(k => Netlify.env.get(k));
  // /api/licencia/sesion coincide también con esta ruta, y gana: se atiende aquí (1-11-2026, daba 404 en aulapro.app)
  if (accion === 'sesion') return responderSesion(request, secretos, Date.now(), key => estaBloqueada(bloqueosBlobs(), key));
  // El informe de claves compartidas (_vigilancia.js): solo con el secreto CLAVES_INFORME_SECRETO
  if (request.method === 'GET' && accion === 'sospechosas') return responderInforme(request, Netlify.env.get('CLAVES_INFORME_SECRETO'), almacenBlobs(), cors);
  if (request.method === 'GET' && accion === 'clave') {
    return new Response(JSON.stringify({ x: await clavePublica(secretos) }), {
      // Sin caché (5-11-2026): al cambiar la llave, una copia guardada una hora dejaba a la app sin poder comprobar las firmas nuevas
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  // El aviso de Lemon Squeezy (webhook): pone al día la lista de licencias bloqueadas (_bloqueos.js)
  if (accion === 'aviso') return responderAviso(request, { secreto: Netlify.env.get('LEMONSQUEEZY_WEBHOOK_SECRET'), apiKey: Netlify.env.get('LEMONSQUEEZY_API_KEY'), almacen: bloqueosBlobs() });
  if (request.method !== 'POST' || (!ACCIONES.has(accion) && accion !== 'estado')) return new Response('Not found', { status: 404, headers: cors });
  const entrada = new URLSearchParams(await request.text());
  const salida = new URLSearchParams();
  for (const c of CAMPOS) {
    const v = entrada.get(c);
    if (v) salida.set(c, v.slice(0, 200));
  }

  // Un tope por clave y otro por IP, generosos (un claustro activa a la vez la misma clave de un pack desde
  // la misma wifi): solo frenan a un programa que llama sin parar. Ver LIMITES en funciones/api/_limite.js.
  const ip = context.ip || 'desconocida';
  const key = salida.get('license_key') || '';
  const topes = [[`${accion}-ip:${ip}`, LIMITES.ip], ...(accion === 'activate' && key ? [[`activar-clave:${key}`, LIMITES.clave]] : [])];
  if (!(await dentroDeLimites(topes))) return respuestaLimite(cors);
  // ¿Está bloqueada la clave? Solo lee la lista, sin llamar a la tienda: la app lo pregunta cada 15 minutos
  if (accion === 'estado') return responderEstado(salida, bloqueosBlobs(), cors);

  const res = await fetch(`https://api.lemonsqueezy.com/v1/licenses/${accion}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: salida,
  });
  const vigilar = () => anotarComprobacion(almacenBlobs(), key, ip).then(r => r.pasada && cortarAlTope(Netlify.env.get('CLAVES_CORTAR_AL_TOPE')));
  const bloqueada = () => estaBloqueada(bloqueosBlobs(), key);
  return new Response(await conFirma(accion, salida, res, secretos, vigilar, bloqueada, desactivarEnTienda), {
    status: res.status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
};

export const config = { path: ['/api/licencia/:accion'], preferStatic: false };
