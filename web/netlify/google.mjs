// Netlify (aulapro.app): el permiso para guardar en el Google Drive del docente. Misma lógica que
// web/funciones/api/google/_comun.js, que es la que se importa.
import { CORS, pedirAGoogle } from '../funciones/api/google/_comun.js';

export default async (request, context) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return new Response('Not found', { status: 404, headers: CORS });
  return pedirAGoogle(context.params.accion, await request.json().catch(() => ({})), Netlify.env.get('GOOGLE_CLIENT_SECRET'));
};

export const config = { path: '/api/google/:accion' };
