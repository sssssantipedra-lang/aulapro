// Bloqueo al momento (2-11-2026): Lemon Squeezy avisa, la lista se pone al día y la clave deja de recibir la firma.
import { describe, it, expect, beforeEach } from 'vitest';
import { onRequestPost } from '../funciones/api/licencia/[accion].js';
import { firmaDeAvisoValida, procesarAviso, estaBloqueada, claveTerminada, pedidoDelAviso } from '../funciones/api/_bloqueos.js';

const kvFalso = () => {
  const m = new Map();
  return { m, get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, delete: async k => { m.delete(k); }, list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
};
const almacenFalso = () => { const m = new Map(); return { m, get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, del: async k => { m.delete(k); } }; };
const CLAVE = 'ABCD1234-0000-1111-2222-3333WXYZ';
const SECRETO = 'secreto-del-aviso';

async function firmar(cuerpo, secreto = SECRETO) {
  const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(cuerpo)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
const llamar = (env, accion, cuerpo, headers = {}) => onRequestPost({
  request: new Request(`https://x/api/licencia/${accion}`, { method: 'POST', body: cuerpo, headers: { Origin: 'https://aulapro.app', 'CF-Connecting-IP': '1.2.3.4', ...headers } }),
  params: { accion }, env,
});
const avisoDeClave = (status, extra = {}) => JSON.stringify({ meta: { event_name: 'license_key_updated' }, data: { type: 'license-keys', id: '9', attributes: { key: CLAVE, status, order_id: 77, ...extra } } });

/** La tienda: las claves del pedido 77 con el estado que diga `estadoTienda`. */
let estadoTienda = 'active';
beforeEach(() => {
  estadoTienda = 'active';
  globalThis.fetch = async url => {
    const u = String(url);
    if (u.includes('/license-keys?')) return new Response(JSON.stringify({ data: [{ attributes: { key: CLAVE, status: estadoTienda } }] }), { status: 200 });
    return new Response(JSON.stringify({ valid: true, license_key: { status: 'active' } }), { status: 200 });   // validate: la tienda aún la da por buena
  };
});

describe('bloqueo al momento con el aviso de Lemon Squeezy', () => {
  it('solo se acepta un aviso firmado con el secreto', async () => {
    const cuerpo = avisoDeClave('disabled');
    expect(await firmaDeAvisoValida(cuerpo, await firmar(cuerpo), SECRETO)).toBe(true);
    expect(await firmaDeAvisoValida(cuerpo, await firmar(cuerpo, 'otro'), SECRETO)).toBe(false);
    expect(await firmaDeAvisoValida(cuerpo + ' ', await firmar(cuerpo), SECRETO)).toBe(false);
    expect(await firmaDeAvisoValida(cuerpo, '', SECRETO)).toBe(false);
    const env = { LIMITE: kvFalso(), LEMONSQUEEZY_WEBHOOK_SECRET: SECRETO, LEMONSQUEEZY_API_KEY: 'k' };
    expect((await llamar(env, 'aviso', cuerpo, { 'X-Signature': 'mala' })).status).toBe(401);
    expect((await llamar({ LIMITE: kvFalso() }, 'aviso', cuerpo)).status).toBe(404);   // sin secreto, la dirección no existe
  });

  it('una clave desactivada en Lemon Squeezy queda bloqueada al momento, y la app lo ve en «estado»', async () => {
    estadoTienda = 'disabled';
    const env = { LIMITE: kvFalso(), LEMONSQUEEZY_WEBHOOK_SECRET: SECRETO, LEMONSQUEEZY_API_KEY: 'k', LICENCIA_SECRETO: 's' };
    const cuerpo = avisoDeClave('disabled');
    expect((await llamar(env, 'aviso', cuerpo, { 'X-Signature': await firmar(cuerpo) })).status).toBe(200);
    expect(await (await llamar(env, 'estado', `license_key=${CLAVE}`)).json()).toEqual({ bloqueada: true });
    expect(await (await llamar(env, 'estado', 'license_key=OTRA')).json()).toEqual({ bloqueada: false });
    // Y la comprobación de la clave ya no da firma, aunque la tienda aún la diera por buena
    const v = await (await llamar(env, 'validate', `license_key=${CLAVE}`)).json();
    expect(v.valid).toBe(false);
    expect(v.license_key.status).toBe('disabled');
    expect(v.aulapro_firma).toBeUndefined();
    expect(JSON.stringify([...env.LIMITE.m])).not.toContain(CLAVE);   // se guarda la huella, no la clave
  });

  it('si vuelve a valer (renovación, reactivada), sale de la lista', async () => {
    const almacen = almacenFalso();
    estadoTienda = 'expired';
    await procesarAviso(JSON.parse(avisoDeClave('expired')), { almacen, apiKey: 'k' });
    expect(await estaBloqueada(almacen, CLAVE)).toBe(true);
    estadoTienda = 'active';
    await procesarAviso({ data: { type: 'subscriptions', id: '5', attributes: { order_id: 77, status: 'active' } } }, { almacen, apiKey: 'k' });
    expect(await estaBloqueada(almacen, CLAVE)).toBe(false);
  });

  it('no se fía del nombre del aviso: copia lo que dice la tienda de las claves del pedido', async () => {
    const almacen = almacenFalso();
    estadoTienda = 'active';   // p. ej. una suscripción cancelada que sigue pagada hasta fin de periodo
    await procesarAviso({ meta: { event_name: 'subscription_cancelled' }, data: { type: 'subscriptions', id: '5', attributes: { order_id: 77, status: 'cancelled' } } }, { almacen, apiKey: 'k' });
    expect(await estaBloqueada(almacen, CLAVE)).toBe(false);
    expect(pedidoDelAviso({ data: { type: 'orders', id: '77', attributes: {} } })).toBe('77');
    expect(claveTerminada({ status: 'active', disabled: true })).toBe(true);
  });

  it('si la tienda no contesta, el aviso sale con error para que Lemon Squeezy lo repita', async () => {
    globalThis.fetch = async () => new Response('x', { status: 500 });
    const env = { LIMITE: kvFalso(), LEMONSQUEEZY_WEBHOOK_SECRET: SECRETO, LEMONSQUEEZY_API_KEY: 'k' };
    const cuerpo = JSON.stringify({ data: { type: 'subscriptions', id: '5', attributes: { order_id: 77 } } });
    expect((await llamar(env, 'aviso', cuerpo, { 'X-Signature': await firmar(cuerpo) })).status).toBe(502);
  });
});

describe('registro de los avisos', () => {
  it('apunta el nombre y el resultado, nunca la clave', async () => {
    const lineas = [];
    const original = console.log;
    console.log = t => lineas.push(String(t));
    try {
      estadoTienda = 'disabled';
      const env = { LIMITE: kvFalso(), LEMONSQUEEZY_WEBHOOK_SECRET: SECRETO, LEMONSQUEEZY_API_KEY: 'k' };
      const cuerpo = avisoDeClave('disabled');
      await llamar(env, 'aviso', cuerpo, { 'X-Signature': await firmar(cuerpo) });
      await llamar(env, 'aviso', cuerpo, { 'X-Signature': 'mala' });
    } finally { console.log = original; }
    expect(lineas[0]).toBe('[aviso Lemon Squeezy] license_key_updated · 1 clave bloqueada, 0 desbloqueadas');
    expect(lineas[1]).toContain('rechazado');
    expect(lineas.join(' ')).not.toContain(CLAVE);
    expect(lineas.join(' ')).not.toContain('77');
  });
});
