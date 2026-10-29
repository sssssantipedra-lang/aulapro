import { describe, it, expect } from 'vitest';
import { crearVerificador } from './firmaLicencia';
// @ts-expect-error módulo JS de las funciones del servidor
import { clavePublica, firmar } from '../../web/funciones/api/_firma.js';
import type { Kv } from './webFs';

const memoriaKv = (): Kv => { const m = new Map(); return { get: async k => m.get(k), set: async (k, v) => { m.set(k, v); }, del: async k => { m.delete(k); } }; };

describe('licencia firmada (versión web)', () => {
  it('acepta lo firmado por el servidor y rechaza lo inventado o cambiado', async () => {
    const verificar = crearVerificador(memoriaKv(), () => clavePublica('secreto'));
    const firma = await firmar({ t: 'cuenta', email: 'docente@ejemplo.com', key: 'CLAVE-1' }, 'secreto');
    expect(await verificar(firma, { t: 'cuenta', email: 'Docente@ejemplo.com', key: 'CLAVE-1' })).toBe(true);
    // Otra clave, otra cuenta, sin firma o firmada con otra llave
    expect(await verificar(firma, { t: 'cuenta', email: 'docente@ejemplo.com', key: 'CLAVE-2' })).toBe(false);
    expect(await verificar(firma, { t: 'cuenta', email: 'otra@ejemplo.com', key: 'CLAVE-1' })).toBe(false);
    expect(await verificar(undefined, { t: 'cuenta', key: 'CLAVE-1' })).toBe(false);
    const falsa = await firmar({ t: 'cuenta', email: 'docente@ejemplo.com', key: 'CLAVE-1' }, 'otro');
    expect(await verificar(falsa, { t: 'cuenta', email: 'docente@ejemplo.com', key: 'CLAVE-1' })).toBe(false);
  });

  it('sin llave pública (sin conexión o servidor sin secreto) no bloquea', async () => {
    const verificar = crearVerificador(memoriaKv(), async () => '');
    expect(await verificar(undefined, { t: 'clave', key: 'X' })).toBe(true);
  });
});
