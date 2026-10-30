// Netlify (aulapro.app): entrar con Microsoft y guardar en OneDrive. Misma lógica que
// web/funciones/api/_microsoft.js, que es la que se importa.
import { pedirAMicrosoft } from '../funciones/api/_microsoft.js';
import { corsPara } from '../funciones/api/_origenes.js';
import { dentroDelLimite, respuestaLimite, LIMITES } from '../lib-netlify/limite.mjs';

export default async (request, context) => {
  const cors = corsPara(request.headers.get('Origin'));
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return new Response('Not found', { status: 404, headers: cors });
  if (!(await dentroDelLimite(`microsoft-ip:${context.ip || 'desconocida'}`, LIMITES.microsoft, LIMITES.ventana))) return respuestaLimite(cors);
  return pedirAMicrosoft(context.params.accion, await request.json().catch(() => ({})), Netlify.env.get('MICROSOFT_CLIENT_SECRET'), cors);
};

export const config = { path: '/api/microsoft/:accion' };
