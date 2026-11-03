// El almacén de la vigilancia de claves compartidas (web/funciones/api/_vigilancia.js) sobre Netlify Blobs. Blobs no
// caduca nada solo: se borran a mano lo de más de 3 semanas (uso) y 8 semanas (sospechas), de vez en cuando.
import { getStore } from '@netlify/blobs';
import { semanaDe } from '../funciones/api/_vigilancia.js';

let purgado = false;
async function purgar(store) {
  const actual = semanaDe();
  const { blobs } = await store.list();
  for (const { key } of blobs) {
    const [tipo, semana] = key.split(':');
    const vida = tipo === 'sospechosa' ? 8 : 3;
    if (Number(semana) < actual - vida) await store.delete(key);
  }
}

export function almacenBlobs() {
  try {
    const store = getStore({ name: 'vigilancia-claves', consistency: 'strong' });
    if (!purgado || Math.random() < 0.02) { purgado = true; purgar(store).catch(() => {}); }
    return {
      get: k => store.get(k, { type: 'json' }),
      put: (k, v) => store.setJSON(k, v),
      list: async prefijo => (await store.list({ prefix: prefijo })).blobs.map(b => b.key),
    };
  } catch {
    return null;
  }
}

/**
 * Borra de un almacén de Blobs lo que ya ha pasado su plazo. Blobs no caduca nada solo, así que cada valor guarda hasta
 * cuándo vale (`hasta`, o `desde` más `vidaMs`) y de vez en cuando se repasa la lista entera.
 */
export async function purgarCaducados(store, vidaMs, ahora = Date.now()) {
  const { blobs } = await store.list();
  for (const { key } of blobs) {
    const v = await store.get(key, { type: 'json' }).catch(() => null);
    const fin = v?.hasta ? Date.parse(v.hasta) : v?.desde ? Date.parse(v.desde) + vidaMs : NaN;
    if (Number.isFinite(fin) && fin < ahora) await store.delete(key);
  }
}

const purgados = new Set();
function abrir(nombre, vidaMs) {
  const store = getStore({ name: nombre, consistency: 'strong' });
  if (!purgados.has(nombre) || Math.random() < 0.01) { purgados.add(nombre); purgarCaducados(store, vidaMs).catch(() => {}); }
  return store;
}

/**
 * La lista de licencias bloqueadas (web/funciones/api/_bloqueos.js) sobre Netlify Blobs. Cada entrada se borra a los 400
 * días, como en Cloudflare (3-11-2026, revisión del abogado del dueño: «las licencias canceladas tampoco las guardaría
 * para siempre»; antes, en Netlify, no se borraban).
 */
export function bloqueosBlobs() {
  try {
    const store = abrir('bloqueos-licencia', 400 * 24 * 3600 * 1000);
    return { get: k => store.get(k, { type: 'json' }), put: (k, v) => store.setJSON(k, v), del: k => store.delete(k) };
  } catch {
    return null;
  }
}

/** Las aceptaciones de las condiciones (web/funciones/api/_aceptacion.js), que se borran al pasar su `hasta`. */
export function aceptacionBlobs() {
  try {
    const store = abrir('aceptacion-condiciones', 0);
    return { get: k => store.get(k, { type: 'json' }), put: (k, v) => store.setJSON(k, v) };
  } catch {
    return null;
  }
}
