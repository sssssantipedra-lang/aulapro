// La puerta delante de /app/assets/ («sin pagar, no hay app», ver _sesion.js). Lo que hace falta para
// entrar, comprar o escribir la clave (la página, los estilos, las imágenes y los bloques de código que
// carga la pantalla de entrada) es público; el resto del código de la app solo sale con una sesión válida.
// La lista de lo público la saca la compilación (`publico.json`, vite.config.ts) y la copia
// web/app/publico.mjs a `funciones/_publico.js` antes de publicar.
import { leerSesion } from './_sesion.js';

/**
 * `null` si la petición puede pasar; si no, la respuesta 401. Sin lista (no se generó) o sin secreto (el
 * servidor sin configurar) deja pasar: mejor la app abierta que la de todo el mundo rota por un olvido.
 */
export async function puerta(request, secreto, publico, ahora = Date.now()) {
  if (!publico || !secreto) return null;
  const ruta = new URL(request.url).pathname;
  const i = ruta.indexOf('/app/');
  const archivo = i >= 0 ? decodeURIComponent(ruta.slice(i + 5)) : '';
  if (!/^assets\/.+\.m?js$/.test(archivo) || publico.includes(archivo)) return null;
  if (await leerSesion(request.headers.get('Cookie'), secreto, ahora)) return null;
  return new Response('AulaPro: hace falta una suscripción activa. Entra en https://aulapro.app/app/', {
    status: 401,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** Lo que pasó por la puerta no se guarda en cachés compartidas (proxies): solo en el navegador de quien lo pidió. */
export function soloParaQuienPide(res, request, publico) {
  const archivo = new URL(request.url).pathname.split('/app/')[1] ?? '';
  if (!publico || !/^assets\/.+\.m?js$/.test(archivo) || publico.includes(archivo) || !res.ok) return res;
  const copia = new Response(res.body, res);
  copia.headers.set('Cache-Control', 'private, max-age=31536000, immutable');
  return copia;
}
