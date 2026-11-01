// Netlify (aulapro.app): /api/licencia/sesion, la cookie de sesión que abre el código de la app.
// Misma lógica que web/funciones/api/licencia/sesion.js (ver web/funciones/api/_sesion.js).
import { responderSesion } from '../funciones/api/_sesion.js';
import { secretosDeNetlify } from '../funciones/api/_secretos.js';

export default request => responderSesion(request, secretosDeNetlify(k => Netlify.env.get(k)));

export const config = { path: '/api/licencia/sesion' };
