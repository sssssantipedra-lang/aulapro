// Respaldo en Netlify de web/funciones/api/_limite.js: el límite de peticiones por IP o por clave de
// licencia, pero con Netlify Blobs en vez de Cloudflare KV (no hay KV aquí). Mismo motivo: que
// «activate» no sirva para agotar los dispositivos de una clave ajena y «cuenta» no sirva para
// aporrear la cuota de Lemon Squeezy o Google. No hace falta enlazar nada: Blobs ya está disponible
// para cualquier función del sitio.
import { getStore } from '@netlify/blobs';

import { huella, caducados, LIMITES as CIFRAS } from '../funciones/api/_limite.js';

const LIMITES_VENTANA = CIFRAS.ventana;

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
    // Escritura condicional (5-11-2026): leer y escribir por separado dejaba pasar una ráfaga de cientos de peticiones a la
    // vez (todas leían 0). Si otra invocación se adelanta, se vuelve a leer, hasta 3 veces.
    for (let intento = 0; intento < 3; intento++) {
      const leido = await store.getWithMetadata(k, { type: 'json' });
      const actual = Number(leido?.data ?? 0);
      if (actual >= maximo) return false;
      const r = await store.setJSON(k, actual + 1, leido?.etag ? { onlyIfMatch: leido.etag } : { onlyIfNew: true });
      if (r?.modified !== false) return true;
    }
    return true;
  } catch {
    // Si Blobs falla (p. ej. en `netlify dev` sin enlazar el sitio), no se bloquea: mejor no limitar
    // que tumbar la licencia de todo el mundo por un fallo de infraestructura ajeno a la licencia.
    return true;
  }
}

/** Primero el tope por IP y, solo si se cumple, el de la clave o la cuenta (ver `dentroDeLimites` en _limite.js). */
export async function dentroDeLimites(topes) {
  for (const [clave, maximo] of topes) if (!(await dentroDelLimite(clave, maximo, LIMITES_VENTANA))) return false;
  return true;
}

export const respuestaLimite = headers => new Response(JSON.stringify({ error: 'limite' }), {
  status: 429, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
