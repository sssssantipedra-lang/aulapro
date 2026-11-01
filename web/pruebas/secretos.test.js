// Auditoría del 1-11-2026: las licencias y las sesiones se firman con LICENCIA_SECRETO si está (si no, con el secreto
// de Google, como siempre) y se aceptan las del secreto anterior mientras se cambia. Y las funciones de Google ya no
// aceptan cualquier origen, y los topes se cuentan en orden (primero la IP).
import { describe, it, expect } from 'vitest';
import { secretosDeLicencia, comoSecretos } from '../funciones/api/_secretos.js';
import { firmar, leerFirmaValida, clavePublica } from '../funciones/api/_firma.js';
import { responderSesion, leerSesion } from '../funciones/api/_sesion.js';
import { puerta } from '../funciones/api/_puerta.js';
import { onRequestPost as activar, onRequestOptions as opcionesLicencia } from '../funciones/api/licencia/[accion].js';
import { onRequestOptions as opcionesGoogle, onRequestPost as google } from '../funciones/api/google/[accion].js';

const GOOGLE = 'secreto-de-google';
const PROPIO = 'secreto-propio-de-licencias';
const cookieDe = res => (res.headers.get('Set-Cookie') ?? '').split(';')[0];
const pedirSesion = firma => new Request('https://aulapro.app/api/licencia/sesion', { method: 'POST', body: JSON.stringify({ firma }), headers: { 'Content-Type': 'application/json' } });
const JS = () => Promise.resolve(new Response('codigo', { headers: { 'Content-Type': 'text/javascript' } }));

describe('secretos de las licencias', () => {
  it('sin LICENCIA_SECRETO todo sigue con el de Google, como hasta ahora', () => {
    expect(secretosDeLicencia({ GOOGLE_CLIENT_SECRET: GOOGLE })).toEqual({ firmar: GOOGLE, aceptar: [GOOGLE] });
    expect(secretosDeLicencia({})).toEqual({ firmar: '', aceptar: [] });
    expect(comoSecretos(GOOGLE)).toEqual({ firmar: GOOGLE, aceptar: [GOOGLE] });
  });

  it('con LICENCIA_SECRETO se firma con él y el secreto de Google ya no sirve para firmar licencias', async () => {
    const s = secretosDeLicencia({ GOOGLE_CLIENT_SECRET: GOOGLE, LICENCIA_SECRETO: PROPIO });
    expect(s).toEqual({ firmar: PROPIO, aceptar: [PROPIO] });
    const deGoogle = await firmar({ t: 'clave', key: 'K' }, GOOGLE);
    expect(await leerFirmaValida(deGoogle, s)).toBeNull();
    expect(await clavePublica(s)).toBe(await clavePublica(PROPIO));
  });

  it('al pasar a un secreto propio con el anterior en LICENCIA_SECRETO_ANTERIOR, nadie se queda fuera', async () => {
    const antes = { GOOGLE_CLIENT_SECRET: GOOGLE };
    const despues = { GOOGLE_CLIENT_SECRET: GOOGLE, LICENCIA_SECRETO: PROPIO, LICENCIA_SECRETO_ANTERIOR: GOOGLE };
    // Una firma y una sesión de antes del cambio
    const firmaVieja = await firmar({ t: 'clave', key: 'K' }, secretosDeLicencia(antes));
    const sesionVieja = cookieDe(await responderSesion(pedirSesion(firmaVieja), secretosDeLicencia(antes)));
    const s = secretosDeLicencia(despues);
    expect((await leerFirmaValida(firmaVieja, s))?.key).toBe('K');
    expect(await leerSesion(sesionVieja, s)).not.toBeNull();
    expect((await puerta(new Request('https://aulapro.app/app/assets/Notebook-x.js', { headers: { Cookie: sesionVieja } }), s, [], JS)).status).toBe(200);
    // Y las nuevas, con el secreto propio
    const nueva = cookieDe(await responderSesion(pedirSesion(firmaVieja), s));
    expect(await leerSesion(nueva, { aceptar: [PROPIO] })).not.toBeNull();
    // Sin el anterior, lo de antes deja de valer
    expect(await leerSesion(sesionVieja, secretosDeLicencia({ LICENCIA_SECRETO: PROPIO }))).toBeNull();
  });

  it('una firma de un secreto que no se acepta no abre sesión ni la puerta', async () => {
    const otra = await firmar({ t: 'clave', key: 'K' }, 'otro');
    const s = secretosDeLicencia({ GOOGLE_CLIENT_SECRET: GOOGLE, LICENCIA_SECRETO_ANTERIOR: PROPIO });
    expect((await responderSesion(pedirSesion(otra), s)).status).toBe(401);
    expect((await puerta(new Request('https://aulapro.app/app/assets/Notebook-x.js'), s, [], JS)).status).toBe(401);
  });
});

describe('las funciones solo atienden a los sitios de AulaPro y cuentan los topes en orden', () => {
  it('Google: CORS solo para aulapro.app y sus copias (antes, cualquier web)', async () => {
    const de = origen => opcionesGoogle({ request: new Request('https://x/api/google/token', { method: 'OPTIONS', headers: { Origin: origen } }) });
    expect(de('https://aulapro.app').headers.get('Access-Control-Allow-Origin')).toBe('https://aulapro.app');
    expect(de('https://web-ajena.example').headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(opcionesLicencia({ request: new Request('https://x', { headers: { Origin: 'https://web-ajena.example' } }) }).headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('Google: un programa que llama sin parar desde una IP se frena', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
    const m = new Map();
    const env = { GOOGLE_CLIENT_SECRET: GOOGLE, LIMITE: { get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); } } };
    const pedir = () => google({ request: new Request('https://x/api/google/token', { method: 'POST', body: '{"code":"x"}', headers: { 'CF-Connecting-IP': '5.5.5.5', Origin: 'https://aulapro.app' } }), params: { accion: 'token' }, env });
    const estados = [];
    for (let i = 0; i < 252; i++) estados.push((await pedir()).status);
    expect(estados.filter(s => s === 429)).toHaveLength(2);
  });

  it('con la IP ya frenada, una clave inventada no crea más contadores', async () => {
    globalThis.fetch = async () => new Response('{}', { status: 200 });
    const m = new Map();
    const env = { GOOGLE_CLIENT_SECRET: GOOGLE, LIMITE: { get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); } } };
    const pedir = clave => activar({ request: new Request('https://x/api/licencia/activate', { method: 'POST', body: `license_key=${clave}`, headers: { 'CF-Connecting-IP': '7.7.7.7' } }), params: { accion: 'activate' }, env });
    for (let i = 0; i < 150; i++) await pedir(`K${i}`);
    const contadores = m.size;
    for (let i = 150; i < 200; i++) expect((await pedir(`K${i}`)).status).toBe(429);
    expect(m.size).toBe(contadores);
  });
});
