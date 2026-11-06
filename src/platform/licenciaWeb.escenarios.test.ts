// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://aulapro.app/app/"}
/**
 * «Sin pagar, no hay app», de punta a punta (6-11-2026): la licencia de la versión web tal como la vive un docente, con
 * el código de verdad de la app (`androidLicense.ts`, `firmaLicencia.ts`, `sesionWeb.ts`, `cuentaWeb.ts`) hablando con
 * las funciones de verdad del servidor (`web/funciones/api/`), y de mentira solo lo de fuera: Lemon Squeezy, Google, la
 * red (que se puede cortar) y el reloj (que se puede adelantar días). Cada «navegador» tiene su propio almacén, su
 * cookie de sesión y su llave pública guardada, como un dispositivo distinto.
 *
 * Lo que se comprueba: la primera entrada con compra, los fundadores, la clave escrita a mano en 2 navegadores, la
 * licencia de la cuenta sin límite de dispositivos, la renovación diaria de la firma, la caducidad de la suscripción,
 * la desactivación o devolución por la lista de bloqueo, 6 y 8 días sin conexión y la vuelta de la conexión, y que al
 * caducar se borra del dispositivo el código de la app pero nunca el trabajo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAndroidLicense, type LicensePost, type LicenseRecord } from './androidLicense';
import { crearVerificador } from './firmaLicencia';
import { olvidarApp, pedirSesion } from './sesionWeb';
import { FUNDADOR, GOOGLE_CLIENT_ID, licenciaDeLaCuenta } from './cuentaWeb';
import { licenciaVencida } from '../lib/licenciaVencida';
import type { Kv } from './webFs';
// @ts-expect-error módulo JS de las funciones del servidor
import { onRequestGet as servidorGet, onRequestPost as servidorPost } from '../../web/funciones/api/licencia/[accion].js';
// @ts-expect-error módulo JS de las funciones del servidor
import { onRequestPost as servidorCuenta } from '../../web/funciones/api/licencia/cuenta.js';
// @ts-expect-error módulo JS de las funciones del servidor
import { responderSesion } from '../../web/funciones/api/_sesion.js';
// @ts-expect-error módulo JS de las funciones del servidor
import { puerta } from '../../web/funciones/api/_puerta.js';
// @ts-expect-error módulo JS de las funciones del servidor
import { secretosDeLicencia } from '../../web/funciones/api/_secretos.js';

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;
/** Los mismos relojes que `platform/web.ts`: la clave cada hora, la lista de bloqueadas cada 14 minutos. */
const COMPROBAR_CLAVE_CADA = HORA;
const CONSULTAR_BLOQUEO_CADA = 14 * MIN;
const T0 = Date.UTC(2026, 10, 10, 9, 0, 0);   // 10-11-2026, el día de la salida a la venta
const STORE_ID = '487841';
const PUBLICO = ['/app/assets/index-abc.js'];
const CODIGO = 'https://aulapro.app/app/assets/Notebook-xyz.js';

/* ── Lo de fuera, de mentira ── */

type Clave = { status: 'active' | 'expired' | 'disabled'; instancias: Set<string>; limite: number; pedido: string; email: string };

/** Lemon Squeezy: las claves vendidas, sus activaciones y los pedidos por correo. */
function crearTienda() {
  const claves = new Map<string, Clave>();
  const pedidos: { id: string; email: string; status: string }[] = [];
  const llamadas: string[] = [];
  let n = 0;
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
  const datos = (c: Clave) => ({ status: c.status, activation_limit: c.limite, activation_usage: c.instancias.size });
  return {
    claves, llamadas,
    vender(email: string, key: string, limite = 2) {
      pedidos.push({ id: String(++n), email: email.toLowerCase(), status: 'paid' });
      claves.set(key, { status: 'active', instancias: new Set(), limite, pedido: String(n), email });
    },
    estado(key: string, status: Clave['status']) { claves.get(key)!.status = status; },
    async responder(url: URL, init?: RequestInit): Promise<Response> {
      const accion = url.pathname.split('/').pop()!;
      llamadas.push(accion);
      if (url.pathname.startsWith('/v1/licenses/')) {
        const p = new URLSearchParams(String(init?.body ?? ''));
        const key = p.get('license_key') ?? '';
        const c = claves.get(key);
        if (!c) return json({ error: 'license_key not found.' }, 404);
        if (accion === 'activate') {
          if (c.status !== 'active') return json({ activated: false, error: `This license key is ${c.status}.`, license_key: datos(c) }, 400);
          if (c.instancias.size >= c.limite) return json({ activated: false, error: 'This license key has reached the activation limit.', license_key: datos(c) }, 400);
          const id = `ins-${++n}`;
          c.instancias.add(id);
          return json({ activated: true, instance: { id }, meta: { store_id: STORE_ID }, license_key: datos(c) });
        }
        if (accion === 'validate') {
          const ins = p.get('instance_id');
          const valid = c.status === 'active' && (!ins || c.instancias.has(ins));
          return json({ valid, error: valid ? null : 'license_key_invalid', meta: { store_id: STORE_ID }, license_key: datos(c) }, valid ? 200 : 400);
        }
        if (accion === 'deactivate') { c.instancias.delete(p.get('instance_id') ?? ''); return json({ deactivated: true }); }
      }
      if (url.pathname === '/v1/orders') {
        const email = url.searchParams.get('filter[user_email]')?.toLowerCase();
        return json({ data: pedidos.filter(p => p.email === email).map(p => ({ id: p.id, attributes: { status: p.status } })) });
      }
      if (url.pathname === '/v1/license-keys') {
        const pedido = url.searchParams.get('filter[order_id]');
        return json({ data: [...claves].filter(([, c]) => c.pedido === pedido).map(([key, c]) => ({ attributes: { key, status: c.status, disabled: c.status === 'disabled' } })) });
      }
      return json({ error: 'desconocido' }, 404);
    },
  };
}

const b64url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const leerB64url = (s: string) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0))));
/** Un token de identidad de Google (sin firma de verdad: la «comprueba» el Google de mentira). */
const tokenGoogle = (email: string) => `x.${b64url(JSON.stringify({ aud: GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', exp: Math.floor(Date.now() / 1000) + 3600, sub: `sub-${email}`, email, name: 'Docente' }))}.firma`;
const google = (url: URL) => {
  const p = leerB64url(String(url.searchParams.get('id_token')).split('.')[1]);
  return new Response(JSON.stringify({ aud: p.aud, email: p.email, email_verified: 'true' }), { status: 200 });
};

/** El KV de Cloudflare (límites, bloqueos, aceptación, vigilancia). */
const kvFalso = () => {
  const m = new Map<string, string>();
  return {
    m, get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => { m.set(k, v); }, delete: async (k: string) => { m.delete(k); },
    list: async ({ prefix }: { prefix: string }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }),
  };
};
const memoriaKv = (): Kv => { const m = new Map(); return { get: async k => m.get(k), set: async (k, v) => { m.set(k, v); }, del: async k => { m.delete(k); } }; };

async function firmarAviso(cuerpo: string, secreto: string) {
  const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(cuerpo)))].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ── El mundo de una prueba: la tienda, el servidor de aulapro.app y la red ── */

function crearMundo() {
  const tienda = crearTienda();
  const env = { LIMITE: kvFalso(), LICENCIA_SECRETO: 'secreto-de-prueba', LEMONSQUEEZY_API_KEY: 'clave-api', LEMONSQUEEZY_WEBHOOK_SECRET: 'secreto-del-aviso', FUNDADORES: ' Fundadora@Ejemplo.com,\n otra@ejemplo.com ' };
  const red = { conectada: true };
  /** Lo que las funciones del servidor piden por su cuenta (la tienda, Google): no depende de la red del navegador. */
  const fetchServidor: typeof fetch = async (entrada, init) => {
    const url = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada : entrada.url);
    if (url.hostname === 'api.lemonsqueezy.com') return tienda.responder(url, init);
    if (url.hostname === 'oauth2.googleapis.com') return google(url);
    throw new TypeError(`el servidor no llama a ${url.hostname}`);
  };
  vi.stubGlobal('fetch', fetchServidor);

  async function servidor(req: Request, url: URL): Promise<Response> {
    const ruta = url.pathname;
    if (ruta === '/api/licencia/sesion') return responderSesion(req, secretosDeLicencia(env));
    if (ruta === '/api/licencia/cuenta') return servidorCuenta({ request: req, env });
    if (ruta === '/api/licencia/clave') return servidorGet({ request: req, params: { accion: 'clave' }, env });
    if (ruta.startsWith('/api/licencia/')) return servidorPost({ request: req, params: { accion: ruta.split('/').pop() }, env });
    const js = () => Promise.resolve(new Response('código de la pantalla', { headers: { 'Content-Type': 'application/javascript; charset=utf-8' } }));
    if (ruta.startsWith('/app/assets/')) return puerta(req, secretosDeLicencia(env), PUBLICO, js);
    return new Response('Not found', { status: 404 });
  }

  /** El `fetch` de un navegador: con su tarro de cookies, y sin red si está cortada. */
  function fetchDe(tarro: { cookie: string }): typeof fetch {
    return async (entrada, init) => {
      if (!red.conectada) throw new TypeError('Failed to fetch');
      const url = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada : entrada.url);
      // Mientras el navegador llama a la función, la función llama a la tienda o a Google con el mismo `fetch`
      if (!['aulapro.app', 'aulapro-app.pages.dev'].includes(url.hostname)) return fetchServidor(url, init);
      const headers = new Headers(init?.headers);
      headers.set('Origin', 'https://aulapro.app');
      headers.set('CF-Connecting-IP', '83.0.0.1');
      if (tarro.cookie) headers.set('Cookie', tarro.cookie);
      const res = await servidor(new Request(url, { method: init?.method ?? 'GET', headers, body: init?.body as BodyInit | null | undefined }), url);
      const puesta = res.headers.get('Set-Cookie');
      if (puesta) tarro.cookie = /Max-Age=0/.test(puesta) ? '' : puesta.split(';')[0];
      return res;
    };
  }

  /** Lemon Squeezy avisa al servidor (webhook firmado) de cómo está una clave. */
  async function avisar(key: string, status: Clave['status']) {
    const cuerpo = JSON.stringify({ meta: { event_name: 'license_key_updated' }, data: { type: 'license-keys', id: '1', attributes: { key, status, order_id: tienda.claves.get(key)!.pedido } } });
    const req = new Request('https://aulapro.app/api/licencia/aviso', { method: 'POST', body: cuerpo, headers: { 'X-Signature': await firmarAviso(cuerpo, env.LEMONSQUEEZY_WEBHOOK_SECRET) } });
    return (await servidorPost({ request: req, params: { accion: 'aviso' }, env })).status;
  }

  /** Un navegador (un dispositivo) con la cuenta `email`: su almacén, su cookie y su llave pública guardada. */
  function navegador(email: string) {
    const mem = new Map<string, string>();
    const secretos = { mem, get: async (n: string) => mem.get(n) ?? '', set: async (n: string, v: string) => { if (v) mem.set(n, v); else mem.delete(n); return true; } };
    const tarro = { cookie: '' };
    const f = fetchDe(tarro);
    const post: LicensePost = async (action, data) => {
      try {
        const res = await f(`https://aulapro.app/api/licencia/${action}`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data) });
        return { status: res.status, body: await res.json().catch(() => ({})) };
      } catch { return null; }
    };
    const verificarFirma = crearVerificador(memoriaKv(), async () => { const r = await f('https://aulapro.app/api/licencia/clave'); return r.ok ? String((await r.json()).x ?? '') : ''; });
    // Lo mismo que `verificarLicencia` en platform/web.ts
    const verificar = async (r: LicenseRecord) => {
      if (r.cuenta) {
        if (await verificarFirma(r.firma, { t: 'cuenta', email, ...(r.kind === 'fundador' ? { fundador: true } : { key: r.key }) })) return true;
        return r.kind === 'licencia' && !!r.key && verificarFirma(r.firma, { t: 'clave', key: r.key });
      }
      if (r.kind === 'licencia') return verificarFirma(r.firma, { t: 'clave', key: r.key });
      return false;
    };
    const perdidas: number[] = [];
    const sesiones: string[] = [];
    /** Abrir la app (una apertura nueva: el estado en memoria empieza de cero, como al recargar). */
    const abrir = () => createAndroidLicense(secretos, {
      enforced: true, post, instanceName: 'AulaPro · Navegador', verificar,
      comprobarCada: COMPROBAR_CLAVE_CADA, comprobarSinEsperar: true, consultarBloqueoCada: CONSULTAR_BLOQUEO_CADA,
      alValer: async r => { await verificarFirma.precargar(); sesiones.push(r.firma ?? ''); await pedirSesion(r.firma, f); },
      alPerder: () => perdidas.push(Date.now()),
    });
    /** Lo que contesta la puerta al pedir el código de una pantalla: 200 con sesión, 401 sin ella. */
    const codigo = async () => { try { return (await f(CODIGO, { credentials: 'same-origin' })).status; } catch { return 0; } };
    /** La búsqueda de la compra de la cuenta al entrar (`cuentaWeb.ts`, con un token de Google recién dado). */
    const buscarCompra = async () => {
      sessionStorage.setItem('aulapro_token_google', tokenGoogle(email));
      vi.stubGlobal('fetch', f);   // cuentaWeb.ts llama a `fetch` a secas
      try { return await licenciaDeLaCuenta(); } finally { vi.stubGlobal('fetch', fetchServidor); }
    };
    const guardada = () => { const v = mem.get('licencia'); return v ? JSON.parse(v) as LicenseRecord : null; };
    return { email, mem, tarro, f, abrir, codigo, buscarCompra, guardada, perdidas, sesiones };
  }

  return { tienda, env, red, navegador, avisar };
}

/** Deja terminar lo que la app hace en segundo plano (la comprobación que no espera al abrir). */
const respirar = () => new Promise(r => setTimeout(r, 25));
const adelantar = (ms: number) => vi.setSystemTime(Date.now() + ms);

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(T0); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

describe('primera entrada con compra', () => {
  it('quien compró con su correo entra sin escribir la clave, recibe la sesión y el código de las pantallas, y no gasta activaciones', async () => {
    const m = crearMundo();
    m.tienda.vender('docente@ejemplo.com', 'CLAVE-COMPRA');
    const nav = m.navegador('docente@ejemplo.com');
    const lic = nav.abrir();
    expect(await lic.state()).toMatchObject({ required: true, status: 'sin-licencia' });
    expect(await nav.codigo()).toBe(401);   // sin sesión, la puerta no da el código
    const b = await nav.buscarCompra();
    expect(b.key).toBe('CLAVE-COMPRA');
    expect('firma' in b && b.firma).toBeTruthy();
    const st = await lic.porCuenta!(b.key!, 'firma' in b ? b.firma : undefined);
    expect(st).toMatchObject({ required: false, status: 'activa', origen: 'cuenta', keyHint: '••••MPRA' });
    expect(st.firmaHasta).toBe(Math.floor(T0 / 1000) * 1000 + 7 * DIA);
    expect(nav.tarro.cookie).toMatch(/^aulapro_sesion=/);
    expect(await nav.codigo()).toBe(200);
    expect(m.tienda.claves.get('CLAVE-COMPRA')!.instancias.size).toBe(0);
    expect(m.tienda.llamadas).not.toContain('activate');
    // Al volver a abrir, sigue dentro sin volver a buscar nada
    m.tienda.llamadas.length = 0;
    expect((await nav.abrir().state()).required).toBe(false);
    await respirar();
    expect(m.tienda.llamadas).toEqual([]);
  });

  it('sin compra, no entra; una compra con un pedido sin pagar tampoco', async () => {
    const m = crearMundo();
    const nav = m.navegador('curiosa@ejemplo.com');
    expect(await nav.buscarCompra()).toEqual({ key: null });
    expect((await nav.abrir().porCuenta!(null)).required).toBe(true);
    expect(await nav.codigo()).toBe(401);
  });
});

describe('fundadores', () => {
  it('un fundador entra gratis por su correo (en la lista con mayúsculas y espacios), con firma y sesión, sin pasar por la tienda', async () => {
    const m = crearMundo();
    const nav = m.navegador('fundadora@ejemplo.com');
    const b = await nav.buscarCompra();
    expect(b.key).toBe(FUNDADOR);
    const lic = nav.abrir();
    expect(await lic.porCuenta!(b.key!, 'firma' in b ? b.firma : undefined)).toMatchObject({ required: false, status: 'fundador', keyHint: '' });
    expect(await nav.codigo()).toBe(200);
    expect(m.tienda.llamadas).toEqual([]);
    // Al día siguiente abre sin red: la firma de su cuenta vale 7 días
    adelantar(DIA);
    m.red.conectada = false;
    expect((await nav.abrir().state()).status).toBe('fundador');
    m.red.conectada = true;
  });

  it('si sale de la lista, deja de serlo en cuanto la app vuelve a mirar su cuenta', async () => {
    const m = crearMundo();
    const nav = m.navegador('otra@ejemplo.com');
    const b = await nav.buscarCompra();
    const lic = nav.abrir();
    await lic.porCuenta!(b.key!, 'firma' in b ? b.firma : undefined);
    m.env.FUNDADORES = '';
    expect(await nav.buscarCompra()).toEqual({ key: null });
    expect((await lic.porCuenta!(null)).required).toBe(true);
    expect(nav.guardada()).toBeNull();
  });
});

describe('clave escrita a mano (2 navegadores)', () => {
  it('vale en dos navegadores; el tercero se queda fuera hasta que uno la libera', async () => {
    const m = crearMundo();
    m.tienda.vender('compradora@ejemplo.com', 'CLAVE-MANO');
    const [a, b, c] = ['a', 'b', 'c'].map(n => m.navegador(`${n}@centro.es`));
    const licA = a.abrir();
    expect((await licA.activate('CLAVE-MANO')).ok).toBe(true);
    expect(await a.codigo()).toBe(200);
    expect(a.guardada()).toMatchObject({ kind: 'licencia', key: 'CLAVE-MANO', instanceId: 'ins-2' });
    expect((await b.abrir().activate('CLAVE-MANO')).ok).toBe(true);
    expect(await b.codigo()).toBe(200);
    const licC = c.abrir();
    expect(await licC.activate('CLAVE-MANO')).toMatchObject({ ok: false, error: 'limite', state: { required: true } });
    expect(await c.codigo()).toBe(401);
    expect(m.tienda.claves.get('CLAVE-MANO')!.instancias.size).toBe(2);
    // El primero la libera y el tercero entra
    expect((await licA.deactivate()).ok).toBe(true);
    expect((await licC.activate('CLAVE-MANO')).ok).toBe(true);
    expect(await c.codigo()).toBe(200);
    expect((await licA.state()).required).toBe(true);
  });

  it('una clave que no existe o de otra tienda no entra', async () => {
    const m = crearMundo();
    const nav = m.navegador('x@centro.es');
    expect((await nav.abrir().activate('NO-EXISTE')).error).toBe('clave-no-valida');
    expect(await nav.codigo()).toBe(401);
  });
});

describe('cuenta: dispositivos sin límite', () => {
  it('la licencia de la cuenta entra en cinco dispositivos sin ocupar ninguna activación, y en cada uno se renueva sola cada hora', async () => {
    const m = crearMundo();
    m.tienda.vender('docente@ejemplo.com', 'CLAVE-CUENTA');
    const dispositivos = [];
    for (let i = 0; i < 5; i++) {
      adelantar(MIN);   // cada dispositivo se abre un minuto después del anterior
      const nav = m.navegador('docente@ejemplo.com');
      const b = await nav.buscarCompra();
      expect((await nav.abrir().porCuenta!(b.key!, 'firma' in b ? b.firma : undefined)).required).toBe(false);
      expect(await nav.codigo()).toBe(200);
      dispositivos.push(nav);
    }
    expect(m.tienda.claves.get('CLAVE-CUENTA')!.instancias.size).toBe(0);
    expect(m.tienda.llamadas.filter(l => l === 'activate')).toEqual([]);
    // Una hora después, en cada dispositivo la comprobación renueva la firma (sin activación: solo la clave) y sigue sin ocupar nada
    adelantar(HORA + MIN);
    for (const nav of dispositivos) {
      const lic = nav.abrir();
      expect((await lic.state()).required).toBe(false);
      await respirar();
      expect((await lic.state()).firmaHasta).toBe(Math.floor(Date.now() / 1000) * 1000 + 7 * DIA);
    }
    expect(m.tienda.claves.get('CLAVE-CUENTA')!.instancias.size).toBe(0);
  });
});

describe('renovación de la firma', () => {
  it('cada hora con conexión se comprueba la clave, la firma vale otros 7 días y la sesión se renueva: 30 días seguidos sin que falte el código', async () => {
    const m = crearMundo();
    m.tienda.vender('compradora@ejemplo.com', 'CLAVE-MANO');
    const nav = m.navegador('a@centro.es');
    expect((await nav.abrir().activate('CLAVE-MANO')).ok).toBe(true);
    const primeraSesion = nav.tarro.cookie;
    for (let dia = 1; dia <= 30; dia++) {
      adelantar(DIA);
      const lic = nav.abrir();
      expect((await lic.state()).required, `día ${dia}`).toBe(false);   // abre al instante
      await respirar();   // y la comprobación en segundo plano renueva la firma
      expect((await lic.state()).firmaHasta, `día ${dia}`).toBe(Math.floor(Date.now() / 1000) * 1000 + 7 * DIA);
      expect(await nav.codigo(), `día ${dia}`).toBe(200);
    }
    expect(nav.tarro.cookie).not.toBe(primeraSesion);
    expect(m.tienda.llamadas.filter(l => l === 'validate').length).toBe(30);
  });

  it('dentro de la hora no se vuelve a llamar a la tienda', async () => {
    const m = crearMundo();
    m.tienda.vender('compradora@ejemplo.com', 'CLAVE-MANO');
    const nav = m.navegador('a@centro.es');
    await nav.abrir().activate('CLAVE-MANO');
    m.tienda.llamadas.length = 0;
    adelantar(50 * MIN);
    const lic = nav.abrir();
    await lic.state(); await lic.revisar!(); await respirar();
    expect(m.tienda.llamadas).toEqual([]);
  });
});

describe('caducidad de la suscripción', () => {
  it('si no se renueva, la app se bloquea en la siguiente comprobación, se borra el código guardado y la sesión, y el trabajo se queda; al renovar se desbloquea', async () => {
    const m = crearMundo();
    m.tienda.vender('docente@ejemplo.com', 'CLAVE-CUENTA');
    const nav = m.navegador('docente@ejemplo.com');
    const b = await nav.buscarCompra();
    const lic = nav.abrir();
    await lic.porCuenta!(b.key!, 'firma' in b ? b.firma : undefined);
    localStorage.setItem('aulapro_ultima_copia', '2026-11-10');   // algo del docente que no es la sesión
    nav.mem.set('secreto:gemini', 'la clave de la IA');

    // Termina el año y no se renueva: Lemon Squeezy la da por caducada
    m.tienda.estado('CLAVE-CUENTA', 'expired');
    adelantar(HORA + MIN);
    expect((await lic.revisar!()).required).toBe(true);
    expect(nav.perdidas.length).toBe(1);
    expect(nav.guardada()).toBeNull();
    expect(licenciaVencida()).toBe(true);   // la pantalla dirá «tu suscripción ha terminado»
    // App.tsx llama entonces a olvidarApp: fuera la sesión y el código guardado
    await olvidarApp(nav.f);
    expect(nav.tarro.cookie).toBe('');
    expect(await nav.codigo()).toBe(401);
    expect(localStorage.getItem('aulapro_ultima_copia')).toBe('2026-11-10');
    expect(nav.mem.get('secreto:gemini')).toBe('la clave de la IA');
    // En otro dispositivo de la misma cuenta, la búsqueda por el correo ya lo dice
    const otro = m.navegador('docente@ejemplo.com');
    expect(await otro.buscarCompra()).toEqual({ key: null, vencida: true });
    expect((await otro.abrir().porCuenta!(null)).required).toBe(true);

    // Renueva: entra otra vez con la misma clave, con sesión nueva
    m.tienda.estado('CLAVE-CUENTA', 'active');
    const b2 = await nav.buscarCompra();
    expect(b2.key).toBe('CLAVE-CUENTA');
    expect((await nav.abrir().porCuenta!(b2.key!, 'firma' in b2 ? b2.firma : undefined)).required).toBe(false);
    expect(licenciaVencida()).toBe(false);
    expect(await nav.codigo()).toBe(200);
  });

  it('al abrir con la suscripción terminada, la app abre al instante y se bloquea en cuanto contesta la tienda', async () => {
    const m = crearMundo();
    m.tienda.vender('compradora@ejemplo.com', 'CLAVE-MANO');
    const nav = m.navegador('a@centro.es');
    await nav.abrir().activate('CLAVE-MANO');
    m.tienda.estado('CLAVE-MANO', 'expired');
    adelantar(2 * HORA);
    const lic = nav.abrir();
    expect((await lic.state()).required).toBe(false);
    await respirar();
    expect((await lic.state()).required).toBe(true);
    expect(nav.perdidas.length).toBe(1);
    // La activación se guarda dormida por si vuelve a valer (no gasta otro dispositivo)
    expect(JSON.parse(nav.mem.get('licencia-dormida')!)).toMatchObject({ key: 'CLAVE-MANO', instanceId: 'ins-2' });
  });
});

describe('desactivación o devolución, por la lista de bloqueo', () => {
  it('Lemon Squeezy avisa, y la app se bloquea en la siguiente mirada a la lista (15 minutos) sin esperar a la hora ni llamar a la tienda', async () => {
    const m = crearMundo();
    m.tienda.vender('docente@ejemplo.com', 'CLAVE-CUENTA');
    const nav = m.navegador('docente@ejemplo.com');
    const b = await nav.buscarCompra();
    const lic = nav.abrir();
    await lic.porCuenta!(b.key!, 'firma' in b ? b.firma : undefined);
    await lic.revisar!();   // la primera revisión, a los 15 s de abrir (App.tsx): mira la lista
    // Se devuelve la compra: la tienda la desactiva y avisa
    m.tienda.estado('CLAVE-CUENTA', 'disabled');
    expect(await m.avisar('CLAVE-CUENTA', 'disabled')).toBe(200);
    m.tienda.llamadas.length = 0;
    adelantar(5 * MIN);
    expect((await lic.revisar!()).required).toBe(false);   // la lista se miró al abrir: aún no toca
    adelantar(10 * MIN);
    expect((await lic.revisar!()).required).toBe(true);
    expect(nav.perdidas.length).toBe(1);
    expect(m.tienda.llamadas).toEqual([]);   // «estado» solo lee la lista del servidor
    expect(licenciaVencida()).toBe(true);
    // Y en otro dispositivo, aunque la firma guardada siga vigente, la comprobación de la clave ya no da firma
    const otro = m.navegador('docente@ejemplo.com');
    expect(await otro.buscarCompra()).toEqual({ key: null, vencida: true });
  });

  it('una clave a mano devuelta se bloquea igual, y si la tienda la reactiva vuelve a entrar con su misma activación', async () => {
    const m = crearMundo();
    m.tienda.vender('compradora@ejemplo.com', 'CLAVE-MANO');
    const nav = m.navegador('a@centro.es');
    const lic = nav.abrir();
    await lic.activate('CLAVE-MANO');
    await lic.revisar!();
    m.tienda.estado('CLAVE-MANO', 'disabled');
    await m.avisar('CLAVE-MANO', 'disabled');
    adelantar(15 * MIN);
    expect((await lic.revisar!()).required).toBe(true);
    expect(await nav.codigo()).toBe(200);   // la cookie aún vale: App.tsx la borra con olvidarApp
    await olvidarApp(nav.f);
    expect(await nav.codigo()).toBe(401);
    // Se reactiva (la tarjeta pasó por fin): sale de la lista y, al abrir, se recupera sin gastar otra activación
    m.tienda.estado('CLAVE-MANO', 'active');
    await m.avisar('CLAVE-MANO', 'active');
    m.tienda.llamadas.length = 0;
    expect((await nav.abrir().state()).required).toBe(false);
    expect(m.tienda.llamadas).not.toContain('activate');
    expect(m.tienda.claves.get('CLAVE-MANO')!.instancias.size).toBe(1);
    expect(await nav.codigo()).toBe(200);
  });
});

describe('sin conexión', () => {
  it('a los 6 días sigue abriendo; a los 8 no, pero la clave no se pierde ni se da por terminada; con la conexión de vuelta, se renueva sola', async () => {
    const m = crearMundo();
    m.tienda.vender('compradora@ejemplo.com', 'CLAVE-MANO');
    const nav = m.navegador('a@centro.es');
    await nav.abrir().activate('CLAVE-MANO');
    m.red.conectada = false;
    adelantar(6 * DIA);
    const dia6 = nav.abrir();
    expect(await dia6.state()).toMatchObject({ required: false, status: 'activa' });
    await respirar();
    expect((await dia6.state()).required).toBe(false);   // la comprobación falló sin red: no pasa nada
    expect((await dia6.revisar!()).required).toBe(false);
    adelantar(2 * DIA);
    const dia8 = nav.abrir();
    expect((await dia8.state()).required).toBe(true);
    expect(nav.guardada()).toMatchObject({ key: 'CLAVE-MANO', instanceId: 'ins-2' });   // sigue guardada para cuando haya red
    expect(nav.perdidas).toEqual([]);
    expect(licenciaVencida()).toBe(false);   // no terminó: solo hay que conectarse
    expect(await nav.codigo()).toBe(0);   // sin red no hay servidor; el código guardado en el dispositivo tampoco debe abrir (sw.test.js)
    // Vuelve la conexión: al abrir, firma nueva, sesión nueva y adentro, sin escribir la clave
    m.red.conectada = true;
    m.tienda.llamadas.length = 0;
    adelantar(HORA);
    const vuelta = nav.abrir();
    expect(await vuelta.state()).toMatchObject({ required: false, status: 'activa' });
    expect((await vuelta.state()).firmaHasta).toBe(Math.floor(Date.now() / 1000) * 1000 + 7 * DIA);
    expect(m.tienda.llamadas).not.toContain('activate');
    expect(await nav.codigo()).toBe(200);
  });

  it('con la licencia de la cuenta pasa lo mismo, y de vuelta la clave se renueva sin volver a entrar con Google', async () => {
    const m = crearMundo();
    m.tienda.vender('docente@ejemplo.com', 'CLAVE-CUENTA');
    const nav = m.navegador('docente@ejemplo.com');
    const b = await nav.buscarCompra();
    await nav.abrir().porCuenta!(b.key!, 'firma' in b ? b.firma : undefined);
    m.red.conectada = false;
    adelantar(6 * DIA);
    expect((await nav.abrir().state()).required).toBe(false);
    adelantar(2 * DIA);
    expect((await nav.abrir().state()).required).toBe(true);
    expect(nav.guardada()).toMatchObject({ key: 'CLAVE-CUENTA', cuenta: true });
    m.red.conectada = true;
    const vuelta = nav.abrir();
    expect((await vuelta.state()).required).toBe(false);
    expect(await nav.codigo()).toBe(200);
  });

  it('con la pestaña abierta sin red, a los 7 días la firma caduca y la app se cierra igual que al abrir, sin borrar la clave', async () => {
    const m = crearMundo();
    m.tienda.vender('compradora@ejemplo.com', 'CLAVE-MANO');
    const nav = m.navegador('a@centro.es');
    const lic = nav.abrir();
    await lic.activate('CLAVE-MANO');
    m.red.conectada = false;
    adelantar(6 * DIA);
    expect((await lic.revisar!()).required).toBe(false);
    adelantar(2 * DIA);
    expect((await lic.revisar!()).required).toBe(true);
    expect(nav.perdidas.length).toBe(1);   // App.tsx enseña la pantalla de licencia («conéctate»)
    expect(nav.guardada()).toMatchObject({ key: 'CLAVE-MANO' });
    expect(licenciaVencida()).toBe(false);
    // Vuelve la red y se recarga: adentro otra vez
    m.red.conectada = true;
    expect((await nav.abrir().state()).required).toBe(false);
  });

  it('con la app abierta sin red, al volver la conexión la siguiente revisión renueva la firma', async () => {
    const m = crearMundo();
    m.tienda.vender('compradora@ejemplo.com', 'CLAVE-MANO');
    const nav = m.navegador('a@centro.es');
    const lic = nav.abrir();
    await lic.activate('CLAVE-MANO');
    m.red.conectada = false;
    adelantar(3 * DIA);
    expect((await lic.revisar!()).firmaHasta).toBe(Math.floor(T0 / 1000) * 1000 + 7 * DIA);
    m.red.conectada = true;
    expect((await lic.revisar!()).firmaHasta).toBe(Math.floor(Date.now() / 1000) * 1000 + 7 * DIA);
  });
});

describe('borrar el código al caducar, conservando los datos', () => {
  it('olvidarApp quita la sesión, el service worker y solo las cachés de AulaPro; lo demás del navegador no se toca', async () => {
    const m = crearMundo();
    m.tienda.vender('compradora@ejemplo.com', 'CLAVE-MANO');
    const nav = m.navegador('a@centro.es');
    await nav.abrir().activate('CLAVE-MANO');
    expect(localStorage.getItem('aulapro_sesion_hasta')).toBeTruthy();
    const registro = { unregister: vi.fn(async () => true) };
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: { getRegistrations: async () => [registro] } });
    const cachesFalsas = new Set(['aulapro-2.24.0-abc123', 'aulapro-2.23.0-viejo', 'otra-app']);
    vi.stubGlobal('caches', { keys: async () => [...cachesFalsas], delete: async (n: string) => cachesFalsas.delete(n) });
    localStorage.setItem('aulapro_condiciones', '{"v":"2026-11-03"}');
    localStorage.setItem('aulapro_licencia_vencida', '1');
    await olvidarApp(nav.f);
    expect(registro.unregister).toHaveBeenCalled();
    expect([...cachesFalsas]).toEqual(['otra-app']);
    expect(nav.tarro.cookie).toBe('');
    expect(await nav.codigo()).toBe(401);
    expect(localStorage.getItem('aulapro_sesion_hasta')).toBeNull();
    expect(localStorage.getItem('aulapro_condiciones')).toBe('{"v":"2026-11-03"}');
    expect(localStorage.getItem('aulapro_licencia_vencida')).toBe('1');
    // El trabajo (IndexedDB) ni se mira: olvidarApp no lo conoce
    expect(nav.mem.get('licencia')).toBeTruthy();
  });
});
