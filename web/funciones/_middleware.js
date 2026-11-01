// Cloudflare Pages: la puerta del código de la app («sin pagar, no hay app», ver api/_puerta.js). En la raíz
// y no en app/assets/: Cloudflare sirve el mismo archivo con otras formas de escribir la dirección (//app/,
// %61pp, app%2Fassets…) que no pasaban por una puerta puesta solo en /app/assets/ (1-11-2026).
import { puerta } from './api/_puerta.js';
import { secretosDeLicencia } from './api/_secretos.js';
import publico from './_publico.js';

export const onRequest = ({ request, env, next }) => puerta(request, secretosDeLicencia(env), publico, () => next());
