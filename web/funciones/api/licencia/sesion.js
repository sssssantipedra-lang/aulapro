// Cloudflare Pages: /api/licencia/sesion, la cookie de sesión que abre el código de la app (ver _sesion.js).
// Una clave en la lista de bloqueadas (_bloqueos.js) no abre sesión aunque su firma aún no haya caducado.
import { responderSesion } from '../_sesion.js';
import { secretosDeLicencia } from '../_secretos.js';
import { bloqueosKv, estaBloqueada } from '../_bloqueos.js';

const responder = ({ request, env }) => responderSesion(request, secretosDeLicencia(env), Date.now(), key => estaBloqueada(bloqueosKv(env.LIMITE), key));

export const onRequestPost = responder;
export const onRequestDelete = responder;
