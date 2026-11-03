import { describe, expect, it } from 'vitest';
import { anotarAceptacion, claveAceptacion, PLAZO_ACEPTACION, versionValida } from '../funciones/api/_aceptacion.js';
import { purgarCaducados } from '../lib-netlify/vigilancia.mjs';

const memoria = () => {
  const m = new Map();
  return { m, get: async k => m.get(k) ?? null, put: async (k, v, ttl) => { m.set(k, { ...v, ttl }); } };
};

describe('aceptación de las condiciones (3-11-2026)', () => {
  it('guarda la versión y la fecha con una huella del correo, nunca el correo', async () => {
    const a = memoria();
    expect(await anotarAceptacion(a, 'Docente@Ejemplo.es', '2026-11-03', new Date('2026-11-03T10:00:00Z'))).toBe(true);
    const k = await claveAceptacion('docente@ejemplo.es');
    const v = a.m.get(k);
    expect(v.versiones).toEqual({ '2026-11-03': '2026-11-03T10:00:00.000Z' });
    expect(v.ttl).toBe(PLAZO_ACEPTACION);
    expect(JSON.stringify([...a.m])).not.toMatch(/ejemplo/i);
  });

  it('conserva la primera fecha de cada versión y suma las nuevas', async () => {
    const a = memoria();
    await anotarAceptacion(a, 'x@y.es', '2026-11-03', new Date('2026-11-03T10:00:00Z'));
    await anotarAceptacion(a, 'x@y.es', '2026-11-03', new Date('2026-12-01T10:00:00Z'));
    await anotarAceptacion(a, 'x@y.es', '2027-01-10', new Date('2027-01-10T10:00:00Z'));
    const v = a.m.get(await claveAceptacion('x@y.es'));
    expect(v.versiones).toEqual({ '2026-11-03': '2026-11-03T10:00:00.000Z', '2027-01-10': '2027-01-10T10:00:00.000Z' });
  });

  it('no anota versiones raras ni falla si no hay almacén', async () => {
    expect(versionValida('2026-11-03')).toBe(true);
    expect(versionValida('<script>')).toBe(false);
    expect(await anotarAceptacion(memoria(), 'x@y.es', 'cualquiera')).toBe(false);
    expect(await anotarAceptacion(null, 'x@y.es', '2026-11-03')).toBe(false);
    expect(await anotarAceptacion({ get: async () => { throw new Error('x'); } }, 'x@y.es', '2026-11-03')).toBe(false);
  });

  it('Netlify borra lo que ha pasado su plazo', async () => {
    const datos = new Map([
      ['a', { hasta: '2020-01-01T00:00:00Z' }], ['b', { hasta: '2999-01-01T00:00:00Z' }],
      ['c', { desde: '2020-01-01T00:00:00Z' }], ['d', { desde: new Date().toISOString() }],
    ]);
    const store = {
      list: async () => ({ blobs: [...datos.keys()].map(key => ({ key })) }),
      get: async k => datos.get(k), delete: async k => { datos.delete(k); },
    };
    await purgarCaducados(store, 400 * 24 * 3600 * 1000);
    expect([...datos.keys()]).toEqual(['b', 'd']);
  });
});
