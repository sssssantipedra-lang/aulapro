// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GOOGLE_CLIENT_ID, leerTokenGoogle, licenciaDeLaCuenta, licenciaMiradaHace } from './cuentaWeb';

const token = (p: object) => `x.${btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(p)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.firma`;
const AHORA = Date.UTC(2026, 9, 29);
const bueno = { aud: GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', exp: AHORA / 1000 + 3600, sub: '123', email: 'profesor@example.com', name: 'Profesor Ñúñez' };

describe('entrar con Google (versión web)', () => {
  it('lee la cuenta del token, con acentos', () => {
    expect(leerTokenGoogle(token(bueno), AHORA)).toEqual({ proveedor: 'google', id: '123', email: 'profesor@example.com', nombre: 'Profesor Ñúñez' });
  });
  it('rechaza un token de otra app, caducado o roto', () => {
    expect(leerTokenGoogle(token({ ...bueno, aud: 'otra' }), AHORA)).toBeNull();
    expect(leerTokenGoogle(token({ ...bueno, exp: AHORA / 1000 - 1 }), AHORA)).toBeNull();
    expect(leerTokenGoogle(token({ ...bueno, iss: 'malo' }), AHORA)).toBeNull();
    expect(leerTokenGoogle('basura', AHORA)).toBeNull();
  });
});

describe('buscar la compra de la cuenta', () => {
  afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

  it('dos búsquedas a la vez hacen una sola llamada a la función; una posterior, otra', async () => {
    sessionStorage.setItem('aulapro_token_google', token({ ...bueno, exp: Date.now() / 1000 + 3600 }));
    const fetchFalso = vi.fn(async () => new Response(JSON.stringify({ key: 'CLAVE', firma: 'f' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchFalso);
    const [a, b] = await Promise.all([licenciaDeLaCuenta(), licenciaDeLaCuenta()]);
    expect(a).toEqual({ key: 'CLAVE', firma: 'f' });
    expect(b).toEqual(a);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    await licenciaDeLaCuenta();
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it('recuerda que se acaba de mirar, para no repetir la llamada, pero no si falló', async () => {
    sessionStorage.setItem('aulapro_token_google', token({ ...bueno, exp: Date.now() / 1000 + 3600 }));
    expect(licenciaMiradaHace(60_000)).toBe(false);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('sin red'); }));
    await licenciaDeLaCuenta();
    expect(licenciaMiradaHace(60_000)).toBe(false);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));
    await licenciaDeLaCuenta();
    expect(licenciaMiradaHace(60_000)).toBe(true);
  });
});
