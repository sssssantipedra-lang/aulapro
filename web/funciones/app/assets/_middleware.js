// Cloudflare Pages: la puerta delante de /app/assets/ («sin pagar, no hay app», ver api/_puerta.js).
import { puerta, soloParaQuienPide } from '../../api/_puerta.js';
import publico from '../../_publico.js';

export async function onRequest({ request, env, next }) {
  const cerrada = await puerta(request, env.GOOGLE_CLIENT_SECRET, publico);
  if (cerrada) return cerrada;
  return soloParaQuienPide(await next(), request, publico);
}
