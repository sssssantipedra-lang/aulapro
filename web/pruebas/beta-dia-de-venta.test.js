/**
 * Simulación del día de la venta (5-11-2026): el cliente REAL (`createAndroidLicense` + el verificador de firmas) hablando con el
 * servidor REAL (`web/funciones/api/*`), con el interruptor de la beta primero abierto y después cerrado, como pasa el día que se
 * abre la venta. Demuestra que quien entró gratis queda bloqueado por todos los caminos: al renovar, con la app abierta, al
 * pedir el código, y sin conexión cuando caduca su firma. Y que fundadores y quien pagó no se tocan.
 *
 * Lo único falso es Google y Lemon Squeezy (`fetch`): todo lo demás es el código que corre en producción.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

// El interruptor de la beta, mutable para poder abrirlo y cerrarlo dentro de la prueba (en producción es la constante CONFIG_BETA)
const cfg = { abierta: true, hasta: null, dias: 3 };
vi.mock('../funciones/api/_beta.js', async importOriginal => {
  const real = await importOriginal();
  return {
    ...real,
    CONFIG_BETA: cfg,
    betaVigente: (ahora = Date.now(), c = cfg) => real.betaVigente(ahora, c),
    caducidadBeta: (ahora = Date.now(), c = cfg) => real.caducidadBeta(ahora, c),
    licenciaBeta: (email, secretos, ahora = Date.now(), c = cfg) => real.licenciaBeta(email, secretos, ahora, c),
    estadoBeta: (ahora = Date.now(), c = cfg) => real.estadoBeta(ahora, c),
  };
});

const post = vi.fn();
vi.mock('@capacitor/core', () => ({ CapacitorHttp: { post: o => post(o) } }));

const { createAndroidLicense } = await import('../../src/platform/androidLicense');
const { crearVerificador, esperadoDeRegistro } = await import('../../src/platform/firmaLicencia');
const { onRequestPost: cuentaServidor } = await import('../funciones/api/licencia/cuenta.js');
const { onRequestPost: licenciaServidor } = await import('../funciones/api/licencia/[accion].js');
const { clavePublica } = await import('../funciones/api/_firma.js');
const { responderSesion, COOKIE } = await import('../funciones/api/_sesion.js');
const { puerta } = await import('../funciones/api/_puerta.js');
const { secretosDeLicencia } = await import('../funciones/api/_secretos.js');
const { betaTerminada, licenciaVencida } = await import('../../src/lib/licenciaVencida');

const GOOGLE_CLIENT_ID = '617666474619-nkre1e8divbf9orspfjv8cpcl7meuoo0.apps.googleusercontent.com';
const DOCENTE = 'docente@ejemplo.org';
const FUNDADORA = 'fundadora@ejemplo.org';
const PAGADORA = 'pagadora@ejemplo.org';
const CLAVE_PAGADA = 'PAGO-0000-1111-2222-3333';
const SECRETO = 'secreto-de-la-prueba';
const DIA = 86_400_000;

/** Lo que el servidor guarda en el almacén de contadores: hay que comprobar que ahí no hay ningún correo. */
const almacen = new Map();
const kv = {
  get: async k => almacen.get(k) ?? null,
  put: async (k, v) => { almacen.set(k, v); },
  delete: async k => { almacen.delete(k); },
};
const env = { GOOGLE_CLIENT_SECRET: SECRETO, LEMONSQUEEZY_API_KEY: 'ls-falsa', FUNDADORES: FUNDADORA, LIMITE: kv };
const secretos = secretosDeLicencia(env);

// Google y Lemon Squeezy, falsos. El «token» de Google es el propio correo.
beforeAll(() => {
  globalThis.fetch = async url => {
    const u = String(url);
    if (u.includes('oauth2.googleapis.com/tokeninfo')) {
      const email = decodeURIComponent(u.split('id_token=')[1]);
      return new Response(JSON.stringify({ aud: GOOGLE_CLIENT_ID, email_verified: 'true', email }), { status: 200 });
    }
    if (u.includes('/orders?')) {
      const pagadora = u.includes(encodeURIComponent(PAGADORA));
      return new Response(JSON.stringify({ data: pagadora ? [{ id: '1', attributes: { status: 'paid' } }] : [] }), { status: 200 });
    }
    if (u.includes('/license-keys?')) return new Response(JSON.stringify({ data: [{ attributes: { key: CLAVE_PAGADA, status: 'active' } }] }), { status: 200 });
    return new Response('{}', { status: 404 });
  };
});

const memoria = () => {
  const m = new Map();
  return { m, get: async n => m.get(n) ?? '', set: async (n, v) => { if (v) m.set(n, v); else m.delete(n); return true; } };
};

/** El servidor de la licencia, tal cual lo llama la app (`/api/licencia/estado`...), en formato que entiende `createAndroidLicense`. */
const postLicencia = async (accion, datos) => {
  const res = await licenciaServidor({
    request: new Request(`https://aulapro.app/api/licencia/${accion}`, {
      method: 'POST', body: new URLSearchParams(datos),
      headers: { Origin: 'https://aulapro.app', 'CF-Connecting-IP': '203.0.113.5', 'Content-Type': 'application/x-www-form-urlencoded' },
    }),
    params: { accion }, env,
  });
  return { status: res.status, body: await res.json() };
};

/** Lo que hace `buscarLicencia` de cuentaWeb.ts con la respuesta de `licencia/cuenta`. */
async function buscarLicencia(email) {
  const res = await cuentaServidor({
    request: new Request('https://aulapro.app/api/licencia/cuenta', {
      method: 'POST', body: JSON.stringify({ token: email, proveedor: 'google' }),
      headers: { Origin: 'https://aulapro.app', 'CF-Connecting-IP': '203.0.113.5', 'Content-Type': 'application/json' },
    }),
    env,
  });
  const j = await res.json();
  const firma = j.firma ? { firma: j.firma } : {};
  if (j.fundador) return { key: 'fundador', ...firma };
  if (j.beta) return { key: 'beta', ...firma };
  if (j.key) return { key: j.key, ...firma };
  return { key: null };
}

/** El cliente tal como lo monta web.ts: verifica la firma con la llave pública del servidor. */
function cliente(secretosCliente = memoria(), email = DOCENTE, alPerder = vi.fn()) {
  const kvLlave = { m: new Map(), get: async k => kvLlave.m.get(k), set: async (k, v) => { kvLlave.m.set(k, v); }, del: async k => { kvLlave.m.delete(k); } };
  const verificarFirma = crearVerificador(kvLlave, async () => clavePublica(secretos));
  const lic = createAndroidLicense(secretosCliente, {
    enforced: true, post: postLicencia, comprobarSinEsperar: true, consultarBloqueoCada: 0, alPerder,
    verificar: async r => { const esp = esperadoDeRegistro(r, email); return !!esp && verificarFirma(r.firma, esp); },
  });
  return { lic, alPerder, secretos: secretosCliente };
}

const cookieDe = res => (res.headers.get('Set-Cookie') ?? '').split(';')[0];
const sesionConFirma = (firma, ahora = Date.now()) => responderSesion(new Request('https://aulapro.app/api/licencia/sesion', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firma }),
}), secretos, ahora);
const pedirCodigo = (cookie, ahora = Date.now()) => puerta(
  new Request('https://aulapro.app/app/assets/pantalla-abc.js', { headers: { Cookie: cookie } }), secretos, ['/app/assets/entrar.js'],
  () => Promise.resolve(new Response('codigo de la app', { headers: { 'Content-Type': 'application/javascript' } })), ahora,
);
const esperar = (ms = 30) => new Promise(r => setTimeout(r, ms));

beforeEach(() => {
  cfg.abierta = true; cfg.hasta = null; cfg.dias = 3;
  almacen.clear(); post.mockReset();
  const ls = new Map();
  globalThis.localStorage = {
    getItem: k => ls.get(k) ?? null, setItem: (k, v) => { ls.set(k, String(v)); }, removeItem: k => { ls.delete(k); },
    clear: () => ls.clear(), key: () => null, length: 0,
  };
});
afterEach(() => vi.useRealTimers());

describe('con la beta abierta', () => {
  it('cualquier docente con una cuenta verificada entra sin pagar y recibe una firma que dura 3 días como mucho', async () => {
    const ahora = Date.now();
    const b = await buscarLicencia(DOCENTE);
    expect(b.key).toBe('beta');
    const exp = JSON.parse(atob((b.firma).split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000;
    expect(exp - ahora).toBeLessThanOrEqual(3 * DIA + 5000);
    expect(exp - ahora).toBeGreaterThan(2 * DIA);
  });

  it('la app la guarda como acceso anticipado, abre y pide la sesión del código', async () => {
    const { lic } = cliente();
    const b = await buscarLicencia(DOCENTE);
    expect(await lic.porCuenta(b.key, b.firma)).toMatchObject({ required: false, status: 'beta' });
    const ses = await sesionConFirma(b.firma);
    expect(ses.status).toBe(200);
    expect((await pedirCodigo(cookieDe(ses))).status).toBe(200);
  });

  it('el servidor no guarda ningún correo: en sus contadores no aparece ni en claro', async () => {
    await buscarLicencia(DOCENTE);
    await postLicencia('estado', { tipo: 'beta' });
    expect(almacen.size).toBeGreaterThan(0);   // sí hay contadores (por IP y por cuenta), pero con huellas
    expect([...almacen.entries()].join('|')).not.toMatch(/ejemplo\.org|docente/i);
  });
});

describe('el día que se abre la venta (la beta se cierra)', () => {
  /** Un docente que entró en la beta y tiene la app guardada y abierta. */
  async function docenteEnBeta() {
    const c = cliente();
    const b = await buscarLicencia(DOCENTE);
    await c.lic.porCuenta(b.key, b.firma);
    const ses = await sesionConFirma(b.firma);
    return { ...c, firma: b.firma, cookie: cookieDe(ses) };
  }

  it('el servidor ya no da acceso gratuito: al renovar la licencia de la cuenta no hay nada, y la app se bloquea', async () => {
    const d = await docenteEnBeta();
    cfg.abierta = false;
    expect((await buscarLicencia(DOCENTE)).key).toBeNull();
    // Es lo que hace App.tsx al abrir o cada día: busca la compra y, sin ella, quita la licencia de la cuenta
    const estado = await d.lic.porCuenta(null);
    expect(estado).toMatchObject({ required: true, status: 'sin-licencia' });
    expect(betaTerminada()).toBe(true);     // la pantalla dirá «el acceso anticipado ha terminado», con el botón de suscribirse
    expect(licenciaVencida()).toBe(false);  // y no «tu suscripción terminó»
  });

  it('con la app ABIERTA, a los 15 minutos (aquí al momento) se bloquea sola', async () => {
    const d = await docenteEnBeta();
    cfg.abierta = false;
    const estado = await d.lic.revisar();
    expect(estado.required).toBe(true);
    expect(d.alPerder).toHaveBeenCalled();   // App.tsx lo escucha y enseña la pantalla de licencia
    expect(betaTerminada()).toBe(true);
  });

  it('al ABRIR la app otro día, con la firma aún vigente, se bloquea nada más contestar el servidor', async () => {
    const d = await docenteEnBeta();
    cfg.abierta = false;
    const reabierta = createAndroidLicense(d.secretos, {
      enforced: true, post: postLicencia, comprobarSinEsperar: true, consultarBloqueoCada: 0, alPerder: d.alPerder,
      verificar: async r => { const esp = esperadoDeRegistro(r, DOCENTE); return !!esp && crearVerificador({ get: async () => undefined, set: async () => {} }, async () => clavePublica(secretos))(r.firma, esp); },
    });
    expect((await reabierta.state()).required).toBe(false);   // abre al instante, como siempre...
    await esperar();
    expect((await reabierta.state()).required).toBe(true);    // ...y se bloquea en cuanto el servidor contesta
  });

  it('el código de las pantallas deja de servirse al momento, aunque su cookie siga sin caducar', async () => {
    const d = await docenteEnBeta();
    expect((await pedirCodigo(d.cookie)).status).toBe(200);
    cfg.abierta = false;
    const sin = await pedirCodigo(d.cookie);
    expect(sin.status).toBe(401);
    expect(await sin.text()).not.toContain('codigo de la app');
  });

  it('no se puede pedir una sesión nueva con la firma de beta que aún no ha caducado', async () => {
    const d = await docenteEnBeta();
    cfg.abierta = false;
    const res = await sesionConFirma(d.firma);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'beta-cerrada' });
    expect(res.headers.get('Set-Cookie')).toMatch(/Max-Age=0/);
  });

  it('sin conexión (nadie contesta) la firma de beta caduca sola a los 3 días y la app no abre', async () => {
    const d = await docenteEnBeta();
    post.mockResolvedValue(undefined);
    // Pasan 3 días y un minuto sin que la app pueda hablar con el servidor
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 3 * DIA + 60_000);
    const sinRed = createAndroidLicense(d.secretos, {
      enforced: true, post: async () => null, comprobarSinEsperar: true, consultarBloqueoCada: 0,
      verificar: async r => { const esp = esperadoDeRegistro(r, DOCENTE); return !!esp && crearVerificador({ get: async () => undefined, set: async () => {} }, async () => clavePublica(secretos))(r.firma, esp); },
    });
    expect(await sinRed.state()).toMatchObject({ required: true, status: 'sin-licencia' });
  });

  it('y la cookie de sesión tampoco vale pasados 3 días, haya o no cerrado el servidor', async () => {
    const d = await docenteEnBeta();
    expect((await pedirCodigo(d.cookie, Date.now() + 2 * DIA)).status).toBe(200);
    expect((await pedirCodigo(d.cookie, Date.now() + 3 * DIA + 60_000)).status).toBe(401);
  });

  it('el estado que consulta la app dice «bloqueada» solo cuando la beta está cerrada', async () => {
    expect((await postLicencia('estado', { tipo: 'beta' })).body).toEqual({ bloqueada: false });
    cfg.abierta = false;
    expect((await postLicencia('estado', { tipo: 'beta' })).body).toEqual({ bloqueada: true });
  });

  it('un fundador sigue entrando, y quien pagó conserva su clave', async () => {
    cfg.abierta = false;
    const f = await buscarLicencia(FUNDADORA);
    expect(f.key).toBe('fundador');
    expect((await pedirCodigo(cookieDe(await sesionConFirma(f.firma)))).status).toBe(200);
    const p = await buscarLicencia(PAGADORA);
    expect(p.key).toBe(CLAVE_PAGADA);
    expect((await pedirCodigo(cookieDe(await sesionConFirma(p.firma)))).status).toBe(200);
  });

  it('lo bloqueado se desbloquea pagando: tras el pago la cuenta recibe su clave y entra', async () => {
    cfg.abierta = false;
    // Esta cuenta aún no pagó: nada
    expect((await buscarLicencia(DOCENTE)).key).toBeNull();
    // Paga (en la tienda aparece su pedido con su clave): la función de la cuenta se la da y la app la activa
    const p = await buscarLicencia(PAGADORA);
    const { lic } = cliente(memoria(), PAGADORA);
    expect(await lic.porCuenta(p.key, p.firma)).toMatchObject({ required: false, status: 'activa' });
  });
});

describe('la fecha límite opcional (hasta)', () => {
  it('ninguna firma de beta vale más allá de la fecha, la pidas cuando la pidas', async () => {
    const hasta = Date.now() + 1 * DIA;
    cfg.hasta = new Date(hasta).toISOString();
    const b = await buscarLicencia(DOCENTE);
    const exp = JSON.parse(atob((b.firma).split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000;
    expect(exp).toBeLessThanOrEqual(hasta);
    // Pasada la fecha, el servidor no da más, aunque `abierta` siga a true
    expect((await sesionConFirma(b.firma, hasta + 1000)).status).toBe(401);
    expect((await pedirCodigo(cookieDe(await sesionConFirma(b.firma)), hasta + 1000)).status).toBe(401);
  });

  it('una fecha ilegible cuenta como cerrada: antes cortar que dejar entrar de más', async () => {
    cfg.hasta = 'mañana por la tarde';
    expect((await buscarLicencia(DOCENTE)).key).toBeNull();
  });
});

describe('no se puede hacer pasar una firma por otra', () => {
  it('una firma de beta o de fundador en un registro de «licencia comprada» sin clave no vale', async () => {
    expect(esperadoDeRegistro({ kind: 'licencia', cuenta: true }, DOCENTE)).toBeNull();
    expect(esperadoDeRegistro({ kind: 'licencia' }, DOCENTE)).toBeNull();
    // La firma de beta solo cumple lo que se espera de una beta
    const b = await buscarLicencia(DOCENTE);
    const verificar = crearVerificador({ get: async () => undefined, set: async () => {} }, async () => clavePublica(secretos));
    expect(await verificar(b.firma, esperadoDeRegistro({ kind: 'beta', cuenta: true }, DOCENTE))).toBe(true);
    expect(await verificar(b.firma, { t: 'cuenta', email: DOCENTE, fundador: true })).toBe(false);
    expect(await verificar(b.firma, { t: 'cuenta', email: DOCENTE, key: 'LO-QUE-SEA' })).toBe(false);
    // Y la de otra cuenta no vale para esta
    expect(await verificar(b.firma, { t: 'cuenta', email: 'otra@ejemplo.org', beta: true })).toBe(false);
  });

  it('la cookie de sesión de beta no se puede retocar para quitarle la marca de beta', async () => {
    const b = await buscarLicencia(DOCENTE);
    const ses = await sesionConFirma(b.firma);
    const [cuerpo, sello] = cookieDe(ses).split('=')[1].split('.');
    const datos = JSON.parse(atob(cuerpo.replace(/-/g, '+').replace(/_/g, '/')));
    expect(datos.beta).toBe(true);
    delete datos.beta;
    const sinMarca = btoa(JSON.stringify(datos)).replace(/=+$/, '');
    cfg.abierta = false;
    expect((await pedirCodigo(`${COOKIE}=${sinMarca}.${sello}`)).status).toBe(401);   // la firma ya no cuadra
  });
});
