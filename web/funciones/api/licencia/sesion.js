// Cloudflare Pages: /api/licencia/sesion, la cookie de sesión que abre el código de la app (ver _sesion.js).
import { responderSesion } from '../_sesion.js';
import { secretosDeLicencia } from '../_secretos.js';

export const onRequestPost = ({ request, env }) => responderSesion(request, secretosDeLicencia(env));
export const onRequestDelete = ({ request, env }) => responderSesion(request, secretosDeLicencia(env));
