// Registro de usuarios y de uso (petición del dueño, 9-11-2026: «necesito saber el número de personas que se dan de alta y
// el correo», «un motor que mida el uso real de cada uno»). Saber quién usa AulaPro y cuánto, para mejorarla y para poder
// avisar a cada docente de lo que afecta a su servicio (por ejemplo, que termina el acceso gratuito).
//
// Qué se guarda de cada docente (y la privacidad lo explica, versión web, apartado 5):
//   - el correo de la cuenta con la que entra (Google o Microsoft) y de cuál de las dos es;
//   - el tipo de acceso (acceso anticipado, fundador o suscripción);
//   - el día de alta, el día de la última vez y, por cada día que la usa, los minutos de uso activo (la app abierta, a la
//     vista y con el docente tocándola; `src/platform/usoWeb.ts`).
// Nada del trabajo del docente ni de su alumnado: el servidor no lo ve nunca.
//
// Cuándo se apunta: al entrar o al renovar la licencia de la cuenta (`licencia/cuenta`) y con el aviso de uso que manda la
// app (`licencia/uso`), que lleva la licencia firmada: solo vale para la cuenta de esa firma, no se puede apuntar a otro.
//
// Cuánto dura: hasta 12 meses desde la última vez que se usó AulaPro (`PLAZO_USUARIO`); después se borra solo. También se
// borra a petición (`borrarUsuario`), y quien se opone deja de apuntarse (`excluir`: se guarda solo una huella de su correo).
//
// EL INTERRUPTOR: nada de esto se guarda si la variable `REGISTRO_USUARIOS` no vale `si` en Netlify y en Cloudflare. Se
// enciende el mismo día que se publica la privacidad que lo explica, nunca antes (docs/MANTENIMIENTO.md).
//
// Leerlo: la página aulapro.app/informe o `node scripts/usuarios.mjs`, con `USUARIOS_INFORME_SECRETO` (GET
// /api/licencia/usuarios). Netlify y Cloudflare apuntan cada uno lo suyo y el informe los junta (`fusionar`, en
// web/sitio/assets/informe-usuarios.js).
import { huella } from './_limite.js';
import { leerFirmaValida } from './_firma.js';
import { iguales } from './_vigilancia.js';
import { diaDe } from './_altas.js';

export const PLAZO_USUARIO = 365 * 24 * 3600;
/** Lo más que suma un solo aviso de uso: la app manda uno cada 15 minutos; con margen por si se retrasa. */
export const MAX_MINUTOS_AVISO = 30;
const MAX_MINUTOS_DIA = 24 * 60;
const TIPOS = new Set(['beta', 'fundador', 'pago', 'sin-licencia']);
const CORREO = /^[^\s@]{1,64}@[^\s@]{1,255}$/;

export const registroActivo = valor => String(valor ?? '').trim().toLowerCase() === 'si';
const normal = email => String(email ?? '').trim().toLowerCase();
const claveUsuario = email => `usuario:${normal(email)}`;
const claveExcluido = async email => `no-registrar:${await huella(`correo:${normal(email)}`)}`;

/** El tipo de acceso de una licencia firmada (`_firma.js`). */
export const tipoDeFirma = datos => (datos?.beta ? 'beta' : datos?.fundador ? 'fundador' : datos?.key ? 'pago' : 'sin-licencia');

async function actualizar(almacen, email, cambiar, ahora) {
  const e = normal(email);
  if (!almacen || !CORREO.test(e)) return false;
  try {
    if (await almacen.get(await claveExcluido(e))) return false;
    const dia = diaDe(ahora);
    const antes = (await almacen.get(claveUsuario(e))) ?? { email: e, alta: dia, dias: {} };
    const u = { ...antes, dias: { ...(antes.dias ?? {}) } };
    cambiar(u, dia);
    u.ultima = ahora.toISOString();
    u.hasta = new Date(ahora.getTime() + PLAZO_USUARIO * 1000).toISOString();
    // Los días de hace más de 13 meses ya no sirven para nada
    const limite = diaDe(new Date(ahora.getTime() - 400 * 86400_000));
    for (const d of Object.keys(u.dias)) if (d < limite) delete u.dias[d];
    await almacen.put(claveUsuario(e), u, PLAZO_USUARIO);
    return true;
  } catch {
    return false;   // nunca se deja a nadie sin entrar por un fallo del registro
  }
}

/** Al entrar o renovar la licencia de la cuenta: alta (la primera vez), día de uso y tipo de acceso. */
export function anotarEntrada(almacen, { email, tipo, proveedor }, ahora = new Date()) {
  return actualizar(almacen, email, (u, dia) => {
    if (TIPOS.has(tipo)) u.tipo = tipo;
    if (proveedor === 'google' || proveedor === 'microsoft') u.proveedor = proveedor;
    u.dias[dia] ??= 0;
  }, ahora);
}

/** El aviso de uso de la app: suma los minutos de uso activo de hoy. */
export function anotarUso(almacen, { email, tipo }, minutos, ahora = new Date()) {
  const m = Math.round(Number(minutos));
  if (!Number.isFinite(m) || m < 1) return Promise.resolve(false);
  return actualizar(almacen, email, (u, dia) => {
    if (TIPOS.has(tipo)) u.tipo = tipo;
    u.dias[dia] = Math.min(MAX_MINUTOS_DIA, (u.dias[dia] ?? 0) + Math.min(m, MAX_MINUTOS_AVISO));
  }, ahora);
}

/** Borra el registro de un docente. Con `excluir`, además deja de apuntarse (se opone al registro). */
export async function borrarUsuario(almacen, email, { excluir = false } = {}) {
  const e = normal(email);
  if (!almacen || !CORREO.test(e)) return false;
  await almacen.del(claveUsuario(e));
  if (excluir) await almacen.put(await claveExcluido(e), { fecha: new Date().toISOString() }, 0);   // «fecha», no «desde»: la purga de Netlify no la borra
  return true;
}

export async function listarUsuarios(almacen) {
  const out = [];
  for (const k of await almacen.list('usuario:')) {
    const u = await almacen.get(k);
    if (u?.email) out.push(u);
  }
  return out;
}

// El informe (fusionar, analizar, aCsv) vive en web/sitio/assets/informe-usuarios.js: lo usan la página aulapro.app/informe
// y scripts/usuarios.mjs, no el servidor, que solo guarda y entrega los registros.

// ---- Lo que atienden las funciones ----

const respuesta = (cuerpo, status, cors) => new Response(cuerpo == null ? null : JSON.stringify(cuerpo), {
  status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

/**
 * `POST /api/licencia/uso` `{ firma, minutos }`: el aviso de uso de la app. Contesta 204 siempre (también con el registro
 * apagado o una firma que no vale): a la app no le cambia nada y no hay nada que averiguar desde fuera.
 */
export async function responderUso(request, { secretos, almacen, activo }, cors = {}, ahora = new Date()) {
  if (request.method !== 'POST') return respuesta({ error: 'metodo' }, 405, cors);
  const { firma, minutos } = await request.json().catch(() => ({}));
  if (activo && typeof firma === 'string' && firma.length < 4000) {
    const datos = await leerFirmaValida(firma, secretos, ahora.getTime()).catch(() => null);
    if (datos?.t === 'cuenta' && datos.email) await anotarUso(almacen, { email: datos.email, tipo: tipoDeFirma(datos) }, minutos, ahora);
  }
  return respuesta(null, 204, cors);
}

/**
 * `GET /api/licencia/usuarios`: los registros, para `scripts/usuarios.mjs`. `POST` `{ accion: 'borrar' | 'excluir', correo }`:
 * borra a un docente (y con «excluir», deja de apuntarlo). Solo con el secreto `USUARIOS_INFORME_SECRETO`; sin él, no existe.
 */
export async function responderUsuarios(request, { secreto, almacen }, cors = {}) {
  // Sin espacios ni saltos de línea al principio o al final (10-11-2026): la página recorta lo que se escribe, y un
  // secreto pegado en el panel de Netlify con un espacio o un salto de línea detrás no coincidía nunca
  const limpio = String(secreto ?? '').trim();
  if (!limpio) return new Response('Not found', { status: 404, headers: cors });
  const dado = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!dado || !iguales(dado, limpio)) return respuesta({ error: 'no-autorizado' }, 401, cors);
  if (!almacen) return respuesta({ error: 'almacen' }, 503, cors);
  if (request.method === 'GET') return respuesta({ hoy: diaDe(), usuarios: await listarUsuarios(almacen) }, 200, cors);
  if (request.method === 'POST') {
    const { accion, correo } = await request.json().catch(() => ({}));
    if (!['borrar', 'excluir'].includes(accion)) return respuesta({ error: 'accion' }, 400, cors);
    const ok = await borrarUsuario(almacen, correo, { excluir: accion === 'excluir' });
    return respuesta(ok ? { ok: true } : { error: 'correo' }, ok ? 200 : 400, cors);
  }
  return respuesta({ error: 'metodo' }, 405, cors);
}

/** El almacén sobre Cloudflare KV (el espacio `LIMITE`). `ttl` 0 = sin caducidad (la lista de quien se opuso). */
export const usuariosKv = kv => (kv ? {
  get: async k => { const v = await kv.get(k); return v == null ? null : JSON.parse(v); },
  put: (k, v, ttl) => kv.put(k, JSON.stringify(v), ttl ? { expirationTtl: ttl } : undefined),
  del: k => kv.delete(k),
  list: async prefijo => {
    const out = [];
    let cursor;
    do {
      const r = await kv.list({ prefix: prefijo, cursor });
      out.push(...r.keys.map(x => x.name));
      cursor = r.list_complete ? undefined : r.cursor;
    } while (cursor);
    return out;
  },
} : null);
