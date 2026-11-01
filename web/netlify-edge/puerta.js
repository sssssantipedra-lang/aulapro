// Netlify (aulapro.app): la puerta del código de la app («sin pagar, no hay app»). Misma lógica que
// web/funciones/_middleware.js (ver web/funciones/api/_puerta.js).
//
// Corre en todas las direcciones salvo las que no pueden ser código (imágenes, estilos, fuentes, vídeo): el
// mismo archivo se puede pedir con muchas formas de escribir su dirección (//app/, /APP/, %61pp…), así que
// limitarla a /app/assets/* dejaba pasar las demás (1-11-2026).
import { puerta } from '../funciones/api/_puerta.js';
import { secretosDeNetlify } from '../funciones/api/_secretos.js';
import publico from '../funciones/_publico.js';

export default (request, context) => puerta(request, secretosDeNetlify(k => Netlify.env.get(k)), publico, () => context.next());

export const config = {
  path: '/*',
  excludedPath: ['/api/*', '/*.webp', '/*.png', '/*.jpg', '/*.jpeg', '/*.gif', '/*.svg', '/*.ico', '/*.css', '/*.woff', '/*.woff2', '/*.mp4', '/*.webm', '/*.pdf'],
};
