import { describe, it, expect } from 'vitest';
import { GOOGLE_CLIENT_ID, leerTokenGoogle } from './cuentaWeb';

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
