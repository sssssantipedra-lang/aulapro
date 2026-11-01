import { describe, it, expect } from 'vitest';
import { caducidadDeFirma, crearVerificador } from './firmaLicencia';
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

  it('sin llave pública no da nada por bueno (antes bastaba con bloquear su descarga)', async () => {
    const firma = await firmar({ t: 'clave', key: 'X' }, 'secreto');
    const verificar = crearVerificador(memoriaKv(), async () => '');
    expect(await verificar(firma, { t: 'clave', key: 'X' })).toBe(false);
    expect(await verificar(undefined, { t: 'clave', key: 'X' })).toBe(false);
  });

  it('la llave guardada al activar sirve después sin conexión', async () => {
    const kv = memoriaKv();
    let conexion = true;
    const verificar = crearVerificador(kv, async () => (conexion ? clavePublica('secreto') : ''));
    await verificar.precargar();
    conexion = false;
    expect(await verificar(await firmar({ t: 'clave', key: 'X' }, 'secreto'), { t: 'clave', key: 'X' })).toBe(true);
  });

  it('una firma caduca a los 7 días, y una de antes del 1-11-2026 (sin fecha) ya no vale', async () => {
    const verificar = crearVerificador(memoriaKv(), () => clavePublica('secreto'));
    const ahora = Date.now();
    const firma = await firmar({ t: 'clave', key: 'X' }, 'secreto', ahora);
    expect(caducidadDeFirma(firma)).toBe(Math.floor(ahora / 1000) * 1000 + 7 * 86400_000);
    expect(await verificar(firma, { t: 'clave', key: 'X' }, ahora + 6 * 86400_000)).toBe(true);
    expect(await verificar(firma, { t: 'clave', key: 'X' }, ahora + 7 * 86400_000 + 1000)).toBe(false);
    // Firmada de verdad, pero caducada hace tiempo
    expect(await verificar(await firmar({ t: 'clave', key: 'X', exp: 1 }, 'secreto'), { t: 'clave', key: 'X' })).toBe(false);
  });
});
