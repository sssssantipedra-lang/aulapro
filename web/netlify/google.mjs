// Netlify (aulapro.app): el permiso para guardar en el Google Drive del docente. Misma lógica que
// web/funciones/api/google/_comun.js, que es la que se importa.
import { corsDe, pedirAGoogle } from '../funciones/api/google/_comun.js';
import { dentroDelLimite, respuestaLimite, LIMITES } from '../lib-netlify/limite.mjs';

export default async (request, context) => {
  const cors = corsDe(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return new Response('Not found', { status: 404, headers: cors });
  // Tope por IP (auditoría del 1-11-2026), como Microsoft: ver _comun.js
  if (!(await dentroDelLimite(`google-ip:${context.ip || 'desconocida'}`, LIMITES.google, LIMITES.ventana))) return respuestaLimite(cors);
  return pedirAGoogle(context.params.accion, await request.json().catch(() => ({})), Netlify.env.get('GOOGLE_CLIENT_SECRET'), cors);
};

export const config = { path: '/api/google/:accion' };
