// Netlify (aulapro.app): la puerta delante de /app/assets/ («sin pagar, no hay app»). Misma lógica que
// web/funciones/app/assets/_middleware.js (ver web/funciones/api/_puerta.js).
import { puerta, soloParaQuienPide } from '../funciones/api/_puerta.js';
import publico from '../funciones/_publico.js';

export default async (request, context) => {
  const cerrada = await puerta(request, Netlify.env.get('GOOGLE_CLIENT_SECRET'), publico);
  if (cerrada) return cerrada;
  return soloParaQuienPide(await context.next(), request, publico);
};

export const config = { path: '/app/assets/*' };
