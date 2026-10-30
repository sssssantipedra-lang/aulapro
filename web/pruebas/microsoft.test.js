import { describe, it, expect, beforeEach } from 'vitest';
import { verificarTokenMicrosoft, pedirAMicrosoft, olvidarLlaves } from '../funciones/api/_microsoft.js';

const CLIENTE = 'cliente-de-prueba';
const PERSONAL = '9188040d-6c67-4c5b-b112-36a304b66dad';
const AHORA = Date.UTC(2026, 9, 30);
const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

let par, jwks, fetcher, llamadas;
async function nuevoPar() {
  const p = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', p.publicKey);
  return { privada: p.privateKey, jwk: { kty: 'RSA', n: jwk.n, e: jwk.e, kid: 'k1' } };
}
async function token(claims, { kid = 'k1', alg = 'RS256', llave = par.privada } = {}) {
  const h = b64({ alg, kid, typ: 'JWT' });
  const p = b64({ aud: CLIENTE, tid: PERSONAL, iss: `https://login.microsoftonline.com/${claims.tid ?? PERSONAL}/v2.0`, exp: AHORA / 1000 + 3600, email: 'Profe@Outlook.com', ...claims });
  const firma = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', llave, new TextEncoder().encode(`${h}.${p}`))).toString('base64url');
  return `${h}.${p}.${firma}`;
}

describe('comprobar el token de Microsoft', () => {
  beforeEach(async () => {
    olvidarLlaves();
    par = await nuevoPar();
    jwks = { keys: [par.jwk] };
    llamadas = 0;
    fetcher = async () => { llamadas++; return new Response(JSON.stringify(jwks), { status: 200 }); };
  });
  const ver = (t, o = {}) => verificarTokenMicrosoft(t, CLIENTE, { fetcher, ahora: AHORA, ...o });

  it('acepta una cuenta personal y devuelve su correo en minúsculas', async () => {
    expect(await ver(await token({}))).toEqual({ email: 'profe@outlook.com' });
  });

  it('rechaza una firma que no es de Microsoft, otro destinatario, otro emisor y un token caducado', async () => {
    const otra = await nuevoPar();
    expect(await ver(await token({}, { llave: otra.privada }))).toBeNull();
    expect(await ver(await token({ aud: 'otra-app' }))).toBeNull();
    expect(await ver(await token({ iss: 'https://evil.example/v2.0' }))).toBeNull();
    expect(await ver(await token({ exp: AHORA / 1000 - 10 }))).toBeNull();
    expect(await ver(await token({}, { alg: 'none' }))).toBeNull();
    expect(await ver('basura')).toBeNull();
  });

  it('en una cuenta de centro o empresa solo se fía del correo si el dominio está verificado', async () => {
    const centro = 'f8cdef31-a31e-4b4a-93e4-5f571e91255a';
    // El administrador del inquilino puede escribir cualquier correo: sin `xms_edov`, nada
    expect(await ver(await token({ tid: centro, email: 'victima@edu.gva.es' }))).toBeNull();
    expect(await ver(await token({ tid: centro, email: 'docente@edu.gva.es', xms_edov: true }))).toEqual({ email: 'docente@edu.gva.es' });
    expect(await ver(await token({ tid: centro, email: 'docente@edu.gva.es', xms_edov: '1' }))).toEqual({ email: 'docente@edu.gva.es' });
    expect(await ver(await token({ tid: centro, email: 'docente@edu.gva.es', xms_edov: false }))).toBeNull();
  });

  it('sin correo en el token, o sin identificador de cliente configurado, no hay licencia', async () => {
    expect(await ver(await token({ email: undefined }))).toBeNull();
    expect(await verificarTokenMicrosoft(await token({}), '', { fetcher, ahora: AHORA })).toBeNull();
  });

  it('guarda las llaves y las vuelve a pedir si llega una que no conoce', async () => {
    await ver(await token({}));
    await ver(await token({}));
    expect(llamadas).toBe(1);
    const nueva = await nuevoPar();
    jwks = { keys: [par.jwk, { ...nueva.jwk, kid: 'k2' }] };
    expect(await ver(await token({}, { kid: 'k2', llave: nueva.privada }))).toEqual({ email: 'profe@outlook.com' });
    expect(llamadas).toBe(2);
  });
});

describe('canjear el código y renovar el permiso', () => {
  const cors = {};
  const ok = { access_token: 'A', expires_in: 3600, refresh_token: 'R2', id_token: 'I', scope: 's' };
  const verifier = 'v'.repeat(50);
  const con = (respuesta, status = 200) => { const peticiones = []; return { peticiones, fetcher: async (url, init) => { peticiones.push({ url, cuerpo: new URLSearchParams(init.body) }); return new Response(JSON.stringify(respuesta), { status }); } }; };

  it('canjea el código con el secreto y solo para direcciones de la lista', async () => {
    const f = con(ok);
    const r = await pedirAMicrosoft('token', { code: 'C', code_verifier: verifier, redirect_uri: 'https://aulapro.app/app/', archivos: true }, 'SECRETO', cors, f.fetcher, CLIENTE);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ access_token: 'A', refresh_token: 'R2', id_token: 'I' });
    expect(f.peticiones[0].cuerpo.get('client_secret')).toBe('SECRETO');
    expect(f.peticiones[0].cuerpo.get('scope')).toContain('Files.ReadWrite.AppFolder');
    const mala = await pedirAMicrosoft('token', { code: 'C', code_verifier: verifier, redirect_uri: 'https://evil.example/app/' }, 'SECRETO', cors, f.fetcher, CLIENTE);
    expect(mala.status).toBe(400);
    expect(f.peticiones).toHaveLength(1);
  });

  it('sin permiso de OneDrive pide solo la identidad', async () => {
    const f = con(ok);
    await pedirAMicrosoft('renovar', { refresh_token: 'R' }, 'S', cors, f.fetcher, CLIENTE);
    expect(f.peticiones[0].cuerpo.get('scope')).not.toContain('Files');
    expect(f.peticiones[0].cuerpo.get('grant_type')).toBe('refresh_token');
  });

  it('traduce un permiso caducado y la falta de configuración', async () => {
    const f = con({ error: 'invalid_grant' }, 400);
    const r = await pedirAMicrosoft('renovar', { refresh_token: 'R' }, 'S', cors, f.fetcher, CLIENTE);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: 'caducado' });
    expect((await pedirAMicrosoft('renovar', { refresh_token: 'R' }, '', cors, f.fetcher, CLIENTE)).status).toBe(503);
  });

  it('cuando Microsoft rechaza al cliente, dice el motivo (sin secretos) para poder arreglarlo', async () => {
    const f = con({ error: 'invalid_client', error_description: 'AADSTS7000215: Invalid client secret provided.\r\nTrace ID: abc\r\nTimestamp: 2026' }, 401);
    const r = await pedirAMicrosoft('token', { code: 'C', code_verifier: verifier, redirect_uri: 'https://aulapro.app/app/' }, 'SECRETO-MALO', cors, f.fetcher, CLIENTE);
    expect(r.status).toBe(502);
    const d = await r.json();
    expect(d).toEqual({ error: 'microsoft', motivo: 'invalid_client', detalle: 'AADSTS7000215: Invalid client secret provided.' });
    expect(JSON.stringify(d)).not.toContain('SECRETO-MALO');
    expect((await pedirAMicrosoft('renovar', { refresh_token: 'R' }, 'S', cors, f.fetcher, '')).status).toBe(503);
  });
});
