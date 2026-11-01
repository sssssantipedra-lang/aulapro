// Cloudflare Pages: /api/licencia/sesion, la cookie de sesión que abre el código de la app (ver _sesion.js).
import { responderSesion } from '../_sesion.js';

export const onRequestPost = ({ request, env }) => responderSesion(request, env.GOOGLE_CLIENT_SECRET);
export const onRequestDelete = ({ request, env }) => responderSesion(request, env.GOOGLE_CLIENT_SECRET);
