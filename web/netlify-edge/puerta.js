// Netlify (aulapro.app): la puerta del código de la app («sin pagar, no hay app»). Misma lógica que
// web/funciones/_middleware.js (ver web/funciones/api/_puerta.js).
//
// Corre en todas las direcciones salvo las que no pueden ser código (imágenes, estilos, fuentes, vídeo): el
// mismo archivo se puede pedir con muchas formas de escribir su dirección (//app/, /APP/, %61pp…), así que
// limitarla a /app/assets/* dejaba pasar las demás (1-11-2026).
//
// Lo que se salta se dice con una expresión regular que solo admite nombres limpios (letras, números, «_», «-»,
// «/» y un único punto, el de la extensión). Hasta el 2-11-2026 eran comodines como «/*.css», y Netlify servía el
// código con …js%3F.css y …js%23.png (el «?» y el «#» escritos con %) sin pasar por la puerta: lo vio la vigilancia.
import { puerta } from '../funciones/api/_puerta.js';
import { secretosDeNetlify } from '../funciones/api/_secretos.js';
import publico from '../funciones/_publico.js';

export default (request, context) => puerta(request, secretosDeNetlify(k => Netlify.env.get(k)), publico, () => context.next());

/** Lo que no pasa por la puerta. Sin búsquedas hacia delante (el enrutador de Netlify no tiene por qué admitirlas). */
export const SIN_PUERTA = [
  '^/api/.*$',
  '^/[A-Za-z0-9_/-]+\\.(webp|png|jpg|jpeg|gif|svg|ico|css|woff|woff2|mp4|webm|pdf)$',
];

export const config = {
  pattern: '^/.*$',
  excludedPattern: SIN_PUERTA,
};
