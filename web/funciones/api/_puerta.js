// La puerta del código de la app («sin pagar, no hay app», ver _sesion.js). Lo que hace falta para entrar,
// comprar o escribir la clave (la página, los estilos, las imágenes y los bloques de código que carga la
// pantalla de entrada) es público; el resto del código de la app solo sale con una sesión válida.
//
// Se decide por LO QUE SE SIRVE, no por cómo se pide (1-11-2026). La primera versión miraba si la dirección
// era /app/assets/…js, y Netlify y Cloudflare sirven el mismo archivo con muchas otras: //app/…, /APP/…,
// /%61pp/…, /app%2Fassets/…, …JS, …js%20, …js/ (las siete dieron el código sin sesión en aulapro.app). Ahora,
// todo JavaScript que sale de la web necesita sesión, salvo el que está en la lista de lo público pedido
// exactamente por su dirección: la de la web (assets/*.js), el service worker y los bloques de entrar.
// La lista la escribe web/app/publico.mjs al publicar en `funciones/_publico.js`.
import { leerSesion } from './_sesion.js';

/** Lo que el servidor sirve como código (el tipo sale de la extensión del archivo de verdad, no de la dirección). */
const ES_CODIGO = /javascript|ecmascript|wasm/i;

/**
 * Pide la respuesta (`siguiente`) y decide si sale. Sin lista (no se generó) o sin secreto (el servidor sin
 * configurar) deja pasar: mejor la app abierta que la de todo el mundo rota por un olvido.
 */
export async function puerta(request, secreto, publico, siguiente, ahora = Date.now()) {
  const res = await siguiente();
  if (!publico || !secreto || !ES_CODIGO.test(res.headers.get('Content-Type') ?? '')) return res;
  if (publico.includes(new URL(request.url).pathname)) return res;
  if (res.ok && (await leerSesion(request.headers.get('Cookie'), secreto, ahora))) {
    // Lo que pasó por la puerta no se guarda en cachés compartidas (proxies): solo en el navegador de quien lo pidió
    const copia = new Response(res.body, res);
    copia.headers.set('Cache-Control', 'private, max-age=31536000, immutable');
    return copia;
  }
  if (!res.ok) return res;   // un 404 o un error no enseñan código
  await res.body?.cancel().catch(() => {});
  return new Response('AulaPro: hace falta una suscripción activa. Entra en https://aulapro.app/app/', {
    status: 401,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
