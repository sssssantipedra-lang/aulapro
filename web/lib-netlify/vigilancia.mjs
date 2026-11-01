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
