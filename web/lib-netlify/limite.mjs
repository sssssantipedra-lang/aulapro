// Respaldo en Netlify de web/funciones/api/_limite.js: el límite de peticiones por IP o por clave de
// licencia, pero con Netlify Blobs en vez de Cloudflare KV (no hay KV aquí). Mismo motivo: que
// «activate» no sirva para agotar los dispositivos de una clave ajena y «cuenta» no sirva para
// aporrear la cuota de Lemon Squeezy o Google. No hace falta enlazar nada: Blobs ya está disponible
// para cualquier función del sitio.
import { getStore } from '@netlify/blobs';

import { huella, caducados } from '../funciones/api/_limite.js';

export { LIMITES } from '../funciones/api/_limite.js';

let purgado = false;
/**
 * Netlify Blobs no caduca nada solo (Cloudflare KV, sí): se borran los contadores de ventanas ya pasadas, una
 * vez al arrancar la función y, de vez en cuando, después. Sin esto, los contadores se acumularían para siempre.
 */
async function purgar(store, ventana) {
  const { blobs } = await store.list();
  for (const k of caducados(blobs.map(b => b.key), ventana)) await store.delete(k);
}

export async function dentroDelLimite(clave, maximo, ventanaSeg) {
  try {
    const store = getStore({ name: 'limite-licencia', consistency: 'strong' });
    const ventana = Math.floor(Date.now() / 1000 / ventanaSeg);
    if (!purgado || Math.random() < 0.02) { purgado = true; purgar(store, ventana).catch(() => {}); }
    const k = `${await huella(clave)}:${ventana}`;
    const actual = (await store.get(k, { type: 'json' })) ?? 0;
    if (actual >= maximo) return false;
    await store.setJSON(k, actual + 1);
    return true;
  } catch {
    // Si Blobs falla (p. ej. en `netlify dev` sin enlazar el sitio), no se bloquea: mejor no limitar
    // que tumbar la licencia de todo el mundo por un fallo de infraestructura ajeno a la licencia.
    return true;
  }
}

export const respuestaLimite = headers => new Response(JSON.stringify({ error: 'limite' }), {
  status: 429, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
