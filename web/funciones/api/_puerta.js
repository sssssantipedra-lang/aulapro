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
import { comoSecretos } from './_secretos.js';
import { betaVigente, CONFIG_BETA } from './_beta.js';

/** Lo que el servidor sirve como código (el tipo sale de la extensión del archivo de verdad, no de la dirección). */
const ES_CODIGO = /javascript|ecmascript|wasm|multipart\/byteranges/i;

/**
 * Pide la respuesta (`siguiente`) y decide si sale. Sin lista (no se generó) o sin secreto (el servidor sin
 * configurar) deja pasar: mejor la app abierta que la de todo el mundo rota por un olvido.
 */
export async function puerta(request, secretos, publico, siguiente, ahora = Date.now(), cfgBeta = CONFIG_BETA) {
  const res = await siguiente();
  const { aceptar } = comoSecretos(secretos);
  // Una respuesta sin Content-Type se trata como código (revisión del 5-11-2026): la puerta cierra, no abre, ante lo que no sabe
  const tipo = res.headers.get('Content-Type');
  if (!publico || !aceptar.length || (tipo && !ES_CODIGO.test(tipo))) return res;
  if (publico.includes(new URL(request.url).pathname)) return res;
  const sesion = res.ok ? await leerSesion(request.headers.get('Cookie'), aceptar, ahora) : null;
  // Una sesión de acceso anticipado (beta) deja de valer en cuanto se cierra la beta, aunque su cookie no haya caducado (_beta.js)
  if (sesion && !(sesion.beta && !betaVigente(ahora, cfgBeta))) {
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
