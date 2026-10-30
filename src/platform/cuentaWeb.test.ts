// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GOOGLE_CLIENT_ID, leerTokenGoogle, leerTokenMicrosoft, licenciaDeLaCuenta, licenciaMiradaHace } from './cuentaWeb';

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

describe('entrar con Microsoft (versión web)', () => {
  const CLIENTE = 'cliente-ms';
  const ms = { aud: CLIENTE, tid: 'tenant-1', iss: 'https://login.microsoftonline.com/tenant-1/v2.0', exp: AHORA / 1000 + 3600, oid: 'oid-1', email: 'Profe@Outlook.com', name: 'Profe' };

  it('lee la cuenta del token: correo en minúsculas e identificador del inquilino y la persona', () => {
    expect(leerTokenMicrosoft(token(ms), AHORA, CLIENTE)).toEqual({ proveedor: 'microsoft', id: 'tenant-1.oid-1', email: 'profe@outlook.com', nombre: 'Profe' });
  });
  it('sin correo, usa el nombre de usuario para enseñarlo', () => {
    expect(leerTokenMicrosoft(token({ ...ms, email: undefined, preferred_username: 'profe@centro.es' }), AHORA, CLIENTE)?.email).toBe('profe@centro.es');
  });
  it('rechaza otra aplicación, otro emisor, caducado, roto, y todo si no hay identificador de cliente configurado', () => {
    expect(leerTokenMicrosoft(token({ ...ms, aud: 'otra' }), AHORA, CLIENTE)).toBeNull();
    expect(leerTokenMicrosoft(token({ ...ms, iss: 'https://login.microsoftonline.com/otro/v2.0' }), AHORA, CLIENTE)).toBeNull();
    expect(leerTokenMicrosoft(token({ ...ms, exp: AHORA / 1000 - 1 }), AHORA, CLIENTE)).toBeNull();
    expect(leerTokenMicrosoft('basura', AHORA, CLIENTE)).toBeNull();
    expect(leerTokenMicrosoft(token(ms), AHORA, '')).toBeNull();
  });
  it('un token de Google no vale como de Microsoft ni al revés', () => {
    expect(leerTokenMicrosoft(token(bueno), AHORA, CLIENTE)).toBeNull();
    expect(leerTokenGoogle(token(ms), AHORA)).toBeNull();
  });
});
