// Netlify (aulapro.app): /api/licencia/sesion, la cookie de sesión que abre el código de la app.
// Misma lógica que web/funciones/api/licencia/sesion.js (ver web/funciones/api/_sesion.js). En la práctica la
// atiende web/netlify/licencia.mjs (su ruta /api/licencia/:accion gana); las dos hacen lo mismo.
import { responderSesion } from '../funciones/api/_sesion.js';
import { secretosDeNetlify } from '../funciones/api/_secretos.js';
import { estaBloqueada } from '../funciones/api/_bloqueos.js';
import { bloqueosBlobs } from '../lib-netlify/vigilancia.mjs';

export default request => responderSesion(request, secretosDeNetlify(k => Netlify.env.get(k)), Date.now(), key => estaBloqueada(bloqueosBlobs(), key));

export const config = { path: '/api/licencia/sesion' };
