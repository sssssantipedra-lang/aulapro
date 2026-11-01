// Netlify (aulapro.app): /api/licencia/sesion, la cookie de sesión que abre el código de la app.
// Misma lógica que web/funciones/api/licencia/sesion.js (ver web/funciones/api/_sesion.js).
import { responderSesion } from '../funciones/api/_sesion.js';

export default request => responderSesion(request, Netlify.env.get('GOOGLE_CLIENT_SECRET'));

export const config = { path: '/api/licencia/sesion' };
