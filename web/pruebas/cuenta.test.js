// La licencia por el correo de la cuenta (web/funciones/api/licencia/cuenta.js): fundadores, la compra de la cuenta, la
// suscripción terminada y la clave bloqueada, con Google y Lemon Squeezy de mentira. 6-11-2026.
import { describe, it, expect, beforeEach, vi } from 'vitest';
// Escrita antes del acceso anticipado gratuito (5-11-2026): comprueba las compras, así que corre con la beta cerrada, como
// tras abrir la venta. Con la beta abierta, cualquier cuenta recibe antes el acceso gratuito (ver beta-dia-de-venta.test.js).
vi.mock('../funciones/api/_beta.js', async importOriginal => {
  const real = await importOriginal();
  const cerrada = { ...real.CONFIG_BETA, abierta: false };
  return {
    ...real,
    CONFIG_BETA: cerrada,
    betaVigente: (ahora = Date.now(), c = cerrada) => real.betaVigente(ahora, c),
    caducidadBeta: (ahora = Date.now(), c = cerrada) => real.caducidadBeta(ahora, c),
    licenciaBeta: (email, secretos, ahora = Date.now(), c = cerrada) => real.licenciaBeta(email, secretos, ahora, c),
    estadoBeta: (ahora = Date.now(), c = cerrada) => real.estadoBeta(ahora, c),
  };
});

import { onRequestPost } from '../funciones/api/licencia/cuenta.js';
import { leerFirmaValida } from '../funciones/api/_firma.js';
import { procesarAviso } from '../funciones/api/_bloqueos.js';

const CLIENTE = '617666474619-nkre1e8divbf9orspfjv8cpcl7meuoo0.apps.googleusercontent.com';
const S = 'secreto-de-prueba';
const kvFalso = () => {
  const m = new Map();
  return { m, get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, delete: async k => { m.delete(k); }, list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
};
const env = () => ({ LIMITE: kvFalso(), LICENCIA_SECRETO: S, LEMONSQUEEZY_API_KEY: 'k', FUNDADORES: 'Fundadora@Ejemplo.com;\n otra@ejemplo.com' });
const llamar = (e, cuerpo) => onRequestPost({ request: new Request('https://aulapro.app/api/licencia/cuenta', { method: 'POST', body: JSON.stringify(cuerpo), headers: { Origin: 'https://aulapro.app', 'CF-Connecting-IP': '1.2.3.4' } }), env: e });

/** Google y la tienda: `google` dice de quién es el token; `pedidos` y `claves`, lo comprado. */
let google, pedidos, claves;
beforeEach(() => {
  google = { aud: CLIENTE, email: 'Docente@Ejemplo.com', email_verified: 'true' };
  pedidos = [{ id: '77', attributes: { status: 'paid' } }];
  claves = { 77: [{ attributes: { key: 'CLAVE-77', status: 'active' } }] };
  globalThis.fetch = async url => {
    const u = String(url);
    if (u.startsWith('https://oauth2.googleapis.com/tokeninfo')) return new Response(JSON.stringify(google), { status: google ? 200 : 400 });
    if (u.includes('/orders?')) return new Response(JSON.stringify({ data: pedidos }), { status: 200 });
    const pedido = new URL(u).searchParams.get('filter[order_id]');
    return new Response(JSON.stringify({ data: claves[pedido] ?? [] }), { status: 200 });
  };
});

describe('la licencia de la cuenta', () => {
  it('con un pedido pagado, da la clave y una firma de cuenta con el correo (en minúsculas) y la clave', async () => {
    const r = await llamar(env(), { token: 't', proveedor: 'google' });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.key).toBe('CLAVE-77');
    expect(await leerFirmaValida(j.firma, S)).toMatchObject({ t: 'cuenta', email: 'docente@ejemplo.com', key: 'CLAVE-77' });
  });

  it('un fundador por su correo, se escriba como se escriba en la lista, entra sin tienda y con firma de fundador', async () => {
    google.email = 'fundadora@ejemplo.com';
    const j = await (await llamar({ ...env(), LEMONSQUEEZY_API_KEY: '' }, { token: 't' })).json();
    expect(j.fundador).toBe(true);
    expect(await leerFirmaValida(j.firma, S)).toMatchObject({ t: 'cuenta', email: 'fundadora@ejemplo.com', fundador: true });
    expect(j.key).toBeUndefined();
  });

  it('sin compra, ni clave ni firma; con un pedido sin pagar, tampoco', async () => {
    pedidos = [];
    expect(await (await llamar(env(), { token: 't' })).json()).toEqual({ key: null });
    pedidos = [{ id: '77', attributes: { status: 'pending' } }];
    expect(await (await llamar(env(), { token: 't' })).json()).toEqual({ key: null });
  });

  it('la suscripción terminada (caducada o desactivada en la tienda) avisa de que venció, para que cualquier dispositivo lo diga', async () => {
    claves[77][0].attributes.status = 'expired';
    expect(await (await llamar(env(), { token: 't' })).json()).toEqual({ key: null, vencida: true });
    claves[77][0].attributes = { key: 'CLAVE-77', status: 'active', disabled: true };
    expect(await (await llamar(env(), { token: 't' })).json()).toEqual({ key: null, vencida: true });
  });

  it('una clave en la lista de bloqueadas (Lemon Squeezy avisó) venció aunque la tienda aún la dé por buena', async () => {
    const e = env();
    const almacen = { get: async k => { const v = await e.LIMITE.get(k); return v == null ? null : JSON.parse(v); }, put: (k, v) => e.LIMITE.put(k, JSON.stringify(v)), del: k => e.LIMITE.delete(k) };
    await procesarAviso({ data: { type: 'license-keys', attributes: { key: 'CLAVE-77', status: 'disabled' } } }, { almacen, apiKey: '' });
    expect(await (await llamar(e, { token: 't' })).json()).toEqual({ key: null, vencida: true });
    // Si se renueva, la lista la suelta y vuelve a entrar
    await procesarAviso({ data: { type: 'license-keys', attributes: { key: 'CLAVE-77', status: 'active' } } }, { almacen, apiKey: '' });
    expect((await (await llamar(e, { token: 't' })).json()).key).toBe('CLAVE-77');
  });

  it('un token que Google no reconoce, de otra app o sin correo comprobado, no busca nada', async () => {
    google = null;
    expect((await llamar(env(), { token: 't' })).status).toBe(401);
    google = { aud: 'otra', email: 'x@y.z', email_verified: 'true' };
    expect((await llamar(env(), { token: 't' })).status).toBe(401);
    google = { aud: CLIENTE, email: 'x@y.z', email_verified: 'false' };
    expect((await llamar(env(), { token: 't' })).status).toBe(401);
    expect((await llamar(env(), { token: 'x'.repeat(5001) })).status).toBe(400);
  });

  it('sin la clave de la tienda configurada lo dice, salvo para los fundadores', async () => {
    expect((await llamar({ ...env(), LEMONSQUEEZY_API_KEY: '' }, { token: 't' })).status).toBe(503);
  });
});
