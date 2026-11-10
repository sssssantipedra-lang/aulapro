// Revisión adversarial de la licencia web del 5-11-2026 (antes de abrir la venta): lo que se corrigió, probado.
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

import { secretosDeLicencia } from '../funciones/api/_secretos.js';
import { firmar, clavePublica, leerFirmaValida } from '../funciones/api/_firma.js';
import { responderSesion, leerSesion, COOKIE } from '../funciones/api/_sesion.js';
import { puerta } from '../funciones/api/_puerta.js';
import { conFirma, onRequestPost as licencia, onRequestGet as licenciaGet } from '../funciones/api/licencia/[accion].js';
import { onRequestPost as sesionCf, onRequestDelete as sesionCfBorrar } from '../funciones/api/licencia/sesion.js';
import { onRequestPost as cuenta } from '../funciones/api/licencia/cuenta.js';
import { procesarAviso, estaBloqueada } from '../funciones/api/_bloqueos.js';
import { redDe, anotarComprobacion, TOPE_CONEXIONES } from '../funciones/api/_vigilancia.js';
import { huella } from '../funciones/api/_limite.js';
import { correoCanonico } from '../funciones/api/_correo.js';
import { caducadaVigilancia } from '../lib-netlify/vigilancia.mjs';

const S = 'secreto-de-prueba';
const CLAVE = 'ABCD1234-0000-1111-2222-3333WXYZ';
const cookieDe = res => (res.headers.get('Set-Cookie') ?? '').split(';')[0];
const pedirSesion = firma => new Request('https://aulapro.app/api/licencia/sesion', { method: 'POST', body: JSON.stringify({ firma }), headers: { 'Content-Type': 'application/json' } });
const kvFalso = () => {
  const m = new Map();
  return { m, get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, delete: async k => { m.delete(k); }, list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
};
const almacenFalso = () => { const m = new Map(); return { m, get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, del: async k => { m.delete(k); }, list: async p => [...m.keys()].filter(k => k.startsWith(p)) }; };
/** Deja la clave en la lista de bloqueadas de un KV como lo haría el aviso de Lemon Squeezy. */
const bloquearEn = async (kv, key) => kv.put(`bloqueo:${await huella(`clave:${key}`)}`, JSON.stringify({ desde: '2026-11-05' }));
// Con un cuerpo binario la respuesta no lleva Content-Type (con texto, Response pone text/plain solo)
const servido = (tipo, status = 200) => () => Promise.resolve(new Response(status === 404 ? null : new Uint8Array([1, 2, 3]), { status, headers: tipo ? { 'Content-Type': tipo } : {} }));
const PUBLICO = ['/app/assets/index-abc.js'];

describe('secretos', () => {
  it('un espacio o un salto de línea al pegar el secreto no cambia la llave: Netlify y Cloudflare siguen firmando igual', async () => {
    const limpio = secretosDeLicencia({ LICENCIA_SECRETO: S });
    const sucio = secretosDeLicencia({ LICENCIA_SECRETO: `${S}\n`, LICENCIA_SECRETO_ANTERIOR: ' viejo ' });
    expect(sucio).toEqual({ firmar: S, aceptar: [S, 'viejo'] });
    expect(await clavePublica(sucio)).toBe(await clavePublica(limpio));
    const firma = await firmar({ t: 'clave', key: 'K' }, sucio);
    expect((await leerFirmaValida(firma, limpio))?.key).toBe('K');
    expect(await leerSesion(cookieDe(await responderSesion(pedirSesion(firma), sucio)), limpio)).toMatchObject({ t: 'clave' });
  });
});

describe('sesión y lista de bloqueadas', () => {
  it('una firma de 7 días ya emitida no abre sesión si la clave se bloqueó después', async () => {
    const ahora = Date.now();
    const firma = await firmar({ t: 'clave', key: CLAVE, instance: '' }, S, ahora);
    const bloqueadas = new Set([CLAVE]);
    const bloqueada = async k => bloqueadas.has(k);
    // Antes del bloqueo, sesión; después, 401 y la cookie borrada
    expect((await responderSesion(pedirSesion(firma), S, ahora, async () => false)).status).toBe(200);
    const res = await responderSesion(pedirSesion(firma), S, ahora, bloqueada);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'bloqueada' });
    expect(res.headers.get('Set-Cookie')).toMatch(new RegExp(`^${COOKIE}=; `));
    // También la licencia de la cuenta, que lleva la clave; un fundador no lleva clave y entra
    expect((await responderSesion(pedirSesion(await firmar({ t: 'cuenta', email: 'a@b.es', key: CLAVE }, S, ahora)), S, ahora, bloqueada)).status).toBe(401);
    expect((await responderSesion(pedirSesion(await firmar({ t: 'cuenta', email: 'a@b.es', fundador: true }, S, ahora)), S, ahora, bloqueada)).status).toBe(200);
    // Si la lista falla, no se deja a nadie fuera
    expect((await responderSesion(pedirSesion(firma), S, ahora, async () => { throw new Error('kv'); })).status).toBe(200);
  });

  it('la copia de Cloudflare pasa su lista de bloqueadas a la sesión', async () => {
    const kv = kvFalso();
    const env = { LICENCIA_SECRETO: S, LIMITE: kv };
    const firma = await firmar({ t: 'clave', key: CLAVE, instance: '' }, secretosDeLicencia(env));
    expect((await sesionCf({ request: pedirSesion(firma), env })).status).toBe(200);
    await bloquearEn(kv, CLAVE);
    expect((await sesionCf({ request: pedirSesion(firma), env })).status).toBe(401);
    expect((await sesionCfBorrar({ request: new Request('https://aulapro.app/api/licencia/sesion', { method: 'DELETE' }), env })).status).toBe(200);
  });

  it('la llave pública no se guarda en caché: al cambiar la llave, la app ve la nueva al momento', async () => {
    const res = await licenciaGet({ request: new Request('https://x/api/licencia/clave'), params: { accion: 'clave' }, env: { LICENCIA_SECRETO: S } });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect((await res.json()).x).toBe(await clavePublica(S));
  });

  it('un fallo con un secreto no descarta el anterior durante un cambio de llave', async () => {
    const firma = await firmar({ t: 'clave', key: 'K' }, 'viejo');
    // El primer secreto no es una cadena normal: su llave falla al calcularse, y la del anterior se sigue probando
    const raro = { firmar: 'nuevo', aceptar: [{ toString() { throw new Error('x'); } }, 'viejo'] };
    expect((await leerFirmaValida(firma, raro))?.key).toBe('K');
  });
});

describe('puerta', () => {
  it('un 206 de varios rangos y una respuesta sin tipo se tratan como código: sin sesión, 401', async () => {
    const pedir = ruta => new Request(`https://aulapro.app${ruta}`);
    for (const siguiente of [servido('multipart/byteranges; boundary=abc', 206), servido(null)]) {
      expect((await puerta(pedir('/app/assets/Notebook-x.js'), S, PUBLICO, siguiente)).status).toBe(401);
    }
    // Lo público sigue saliendo, y un 404 sin tipo sigue siendo un 404
    expect((await puerta(pedir('/app/assets/index-abc.js'), S, PUBLICO, servido(null))).status).toBe(200);
    expect((await puerta(pedir('/app/assets/no-existe.js'), S, PUBLICO, servido(null, 404))).status).toBe(404);
    expect((await puerta(pedir('/app/icono-192.png'), S, PUBLICO, servido('image/png'))).status).toBe(200);
  });

  it('deja pasar lo que no lleva cuerpo (el paso previo de CORS y los 204), y nada más (10-11-2026)', async () => {
    const vacio = status => () => Promise.resolve(new Response(null, { status }));
    const opciones = new Request('https://aulapro-app.pages.dev/api/licencia/usuarios', { method: 'OPTIONS' });
    expect((await puerta(opciones, S, PUBLICO, vacio(204))).status).toBe(204);
    expect((await puerta(new Request('https://aulapro-app.pages.dev/api/licencia/uso', { method: 'POST' }), S, PUBLICO, vacio(204))).status).toBe(204);
    // Un OPTIONS que devolviera el código de la app sigue sin salir
    const conCodigo = new Request('https://aulapro-app.pages.dev/app/assets/Notebook-x.js', { method: 'OPTIONS' });
    expect((await puerta(conCodigo, S, PUBLICO, servido('text/javascript'))).status).toBe(401);
    expect((await puerta(conCodigo, S, PUBLICO, servido(null))).status).toBe(401);
  });
});

describe('licencia de la cuenta', () => {
  const token = 'token-de-google';
  const pedir = () => cuenta({
    request: new Request('https://x/api/licencia/cuenta', { method: 'POST', body: JSON.stringify({ token }), headers: { Origin: 'https://aulapro.app', 'CF-Connecting-IP': '1.2.3.4' } }),
    env: { LICENCIA_SECRETO: S, LEMONSQUEEZY_API_KEY: 'k' },
  });
  const tienda = ({ pedidos = 200, claves = 200 }) => async url => {
    const u = String(url);
    if (u.includes('tokeninfo')) return new Response(JSON.stringify({ aud: '617666474619-nkre1e8divbf9orspfjv8cpcl7meuoo0.apps.googleusercontent.com', email_verified: 'true', email: 'A@B.es' }), { status: 200 });
    if (u.includes('/orders?')) return new Response(JSON.stringify({ data: [{ id: '77', attributes: { status: 'paid' } }] }), { status: pedidos });
    if (u.includes('/license-keys?')) return new Response(JSON.stringify({ data: [{ attributes: { key: CLAVE, status: 'active' } }] }), { status: claves });
    return new Response('?', { status: 500 });
  };

  it('si la tienda falla al dar las claves de un pedido, se dice (502): nunca «sin compra», que quitaría la licencia a quien pagó', async () => {
    globalThis.fetch = tienda({});
    expect(await (await pedir()).json()).toMatchObject({ key: CLAVE });
    globalThis.fetch = tienda({ claves: 429 });
    const res = await pedir();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'tienda' });
  });
});

describe('bloqueos', () => {
  it('con la clave de la API, el aviso no desbloquea por su cuenta: si la tienda falla, la clave sigue bloqueada', async () => {
    const almacen = almacenFalso();
    globalThis.fetch = async () => new Response(JSON.stringify({ data: [{ attributes: { key: CLAVE, status: 'disabled' } }] }), { status: 200 });
    await procesarAviso({ data: { type: 'license-keys', attributes: { key: CLAVE, status: 'disabled', order_id: 77 } } }, { almacen, apiKey: 'k' });
    expect(await estaBloqueada(almacen, CLAVE)).toBe(true);
    // Llega tarde un aviso «active» de antes y la tienda no contesta: error para que se repita, y nada cambia
    globalThis.fetch = async () => new Response('x', { status: 500 });
    await expect(procesarAviso({ data: { type: 'license-keys', attributes: { key: CLAVE, status: 'active', order_id: 77 } } }, { almacen, apiKey: 'k' })).rejects.toThrow();
    expect(await estaBloqueada(almacen, CLAVE)).toBe(true);
    // Sin clave de la API sigue valiendo lo que trae el aviso
    await procesarAviso({ data: { type: 'license-keys', attributes: { key: CLAVE, status: 'active', order_id: 77 } } }, { almacen });
    expect(await estaBloqueada(almacen, CLAVE)).toBe(false);
  });

  it('activar una clave bloqueada devuelve a la tienda el dispositivo que acaba de gastar', async () => {
    const devueltos = [];
    const res = new Response(JSON.stringify({ activated: true, instance: { id: 'ins-9' }, license_key: { status: 'active' } }), { status: 200 });
    const salida = new URLSearchParams({ license_key: CLAVE });
    const d = JSON.parse(await conFirma('activate', salida, res, S, null, async () => true, (key, instance) => { devueltos.push([key, instance]); }));
    expect(d).toMatchObject({ activated: false, valid: false, error: 'license_key_disabled' });
    expect(d.aulapro_firma).toBeUndefined();
    expect(devueltos).toEqual([[CLAVE, 'ins-9']]);
  });

  it('en la copia de Cloudflare, activar una clave bloqueada llama a deactivate en la tienda', async () => {
    const llamadas = [];
    globalThis.fetch = async (url, init) => {
      llamadas.push([String(url), init?.body ? Object.fromEntries(new URLSearchParams(init.body)) : null]);
      return new Response(JSON.stringify({ activated: true, instance: { id: 'ins-9' }, license_key: { status: 'active' } }), { status: 200 });
    };
    const kv = kvFalso();
    await bloquearEn(kv, CLAVE);
    const res = await licencia({ request: new Request('https://x/api/licencia/activate', { method: 'POST', body: `license_key=${CLAVE}&instance_name=x`, headers: { Origin: 'https://aulapro.app', 'CF-Connecting-IP': '1.2.3.4' } }), params: { accion: 'activate' }, env: { LICENCIA_SECRETO: S, LIMITE: kv } });
    expect((await res.json()).activated).toBe(false);
    expect(llamadas.map(([u]) => u.split('/').pop())).toEqual(['activate', 'deactivate']);
    expect(llamadas[1][1]).toEqual({ license_key: CLAVE, instance_id: 'ins-9' });
  });
});

describe('vigilancia de claves compartidas', () => {
  it('una IPv6 cuenta por su red /64: las direcciones temporales de un mismo docente no son conexiones distintas', async () => {
    expect(redDe('2a02:1234:5678:9abc:1111:2222:3333:4444')).toBe('2a02:1234:5678:9abc::/64');
    expect(redDe('2a02:1234:5678:9abc::1')).toBe('2a02:1234:5678:9abc::/64');
    expect(redDe('2A02:0db8::')).toBe('2a02:db8:0:0::/64');
    expect(redDe('::1')).toBe('0:0:0:0::/64');
    expect(redDe('83.1.2.3')).toBe('83.1.2.3');
    expect(redDe('')).toBe('desconocida');
    const almacen = almacenFalso();
    for (let i = 0; i < 20; i++) await anotarComprobacion(almacen, CLAVE, `2a02:1234:5678:9abc:${i}:2:3:4`);
    expect((await anotarComprobacion(almacen, CLAVE, '2a02:1234:5678:9abc:ffff::1')).conexiones).toBe(1);
    for (let i = 0; i <= TOPE_CONEXIONES; i++) await anotarComprobacion(almacen, CLAVE, `2a02:${i}:0:0::1`);
    expect((await anotarComprobacion(almacen, CLAVE, '2a02:0:0:0::9')).pasada).toBe(true);
  });
});

describe('revisión del 5-11-2026, segunda tanda', () => {
  it('los correos de Gmail se comparan con FUNDADORES sin puntos, sin etiqueta y con googlemail como gmail', () => {
    expect(correoCanonico('Nombre.Apellido+aula@GoogleMail.com')).toBe('nombreapellido@gmail.com');
    expect(correoCanonico('nombreapellido@gmail.com')).toBe('nombreapellido@gmail.com');
    expect(correoCanonico('Docente+x@centro.edu')).toBe('docente@centro.edu');
    expect(correoCanonico('docente.uno@centro.edu')).toBe('docente.uno@centro.edu');   // fuera de Gmail los puntos cuentan
    expect(correoCanonico('sin-arroba')).toBe('');
  });

  it('un fundador con el correo anotado de otra forma entra, y un pedido con reembolso parcial sigue siendo una compra', async () => {
    const pedir = (env, status) => {
      globalThis.fetch = async url => {
        const u = String(url);
        if (u.includes('tokeninfo')) return new Response(JSON.stringify({ aud: '617666474619-nkre1e8divbf9orspfjv8cpcl7meuoo0.apps.googleusercontent.com', email_verified: 'true', email: 'Nombre.Apellido@gmail.com' }), { status: 200 });
        if (u.includes('/orders?')) return new Response(JSON.stringify({ data: [{ id: '77', attributes: { status } }] }), { status: 200 });
        if (u.includes('/license-keys?')) return new Response(JSON.stringify({ data: [{ attributes: { key: CLAVE, status: 'active' } }] }), { status: 200 });
        return new Response('?', { status: 500 });
      };
      return cuenta({ request: new Request('https://x/api/licencia/cuenta', { method: 'POST', body: JSON.stringify({ token: 't' }), headers: { Origin: 'https://aulapro.app', 'CF-Connecting-IP': '1.2.3.4' } }), env: { LICENCIA_SECRETO: S, LEMONSQUEEZY_API_KEY: 'k', ...env } });
    };
    expect(await (await pedir({ FUNDADORES: 'otro@x.es, nombreapellido+aula@googlemail.com' }, 'paid')).json()).toMatchObject({ fundador: true });
    expect(await (await pedir({}, 'partial_refund')).json()).toMatchObject({ key: CLAVE });
    expect(await (await pedir({}, 'refunded')).json()).toEqual({ key: null });
  });

  it('al borrar la sesión (y al negarla por bloqueo) se pide al navegador que vacíe la caché HTTP del código', async () => {
    const res = await responderSesion(new Request('https://aulapro.app/api/licencia/sesion', { method: 'DELETE' }), S);
    expect(res.headers.get('Clear-Site-Data')).toBe('"cache"');
    const firma = await firmar({ t: 'clave', key: CLAVE }, S);
    expect((await responderSesion(pedirSesion(firma), S, Date.now(), async () => true)).headers.get('Clear-Site-Data')).toBe('"cache"');
    expect((await responderSesion(pedirSesion(firma), S)).headers.get('Clear-Site-Data')).toBeNull();
  });

  it('en Netlify las huellas de uso se borran a las 3 semanas y las sospechosas a las 8, como dice la privacidad', () => {
    expect(caducadaVigilancia('uso:100:abc', 102)).toBe(false);
    expect(caducadaVigilancia('uso:100:abc', 103)).toBe(true);
    expect(caducadaVigilancia('sospechosa:100:abc', 107)).toBe(false);
    expect(caducadaVigilancia('sospechosa:100:abc', 108)).toBe(true);
  });
});
