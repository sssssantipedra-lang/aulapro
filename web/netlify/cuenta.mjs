// Versión web: la licencia de quien entra con Google, sin escribir la clave (decisión del dueño,
// 29-10-2026). La app manda el token de Google recién emitido; aquí se comprueba con Google que es
// auténtico y de AulaPro, y con el correo verificado se busca en Lemon Squeezy un pedido pagado de
// la tienda de AulaPro y su clave. La app la activa como si el docente la hubiera escrito.
//
// Respaldo en Netlify (ver netlify.toml), con CORS: la app la llama cuando Cloudflare no responde.
// Necesita la variable LEMONSQUEEZY_API_KEY en el sitio de Netlify. El correo
// solo se usa para la búsqueda y, en huella, para anotar la aceptación de las condiciones (_aceptacion.js). Ver src/platform/cuentaWeb.ts.
import { firmar } from '../funciones/api/_firma.js';
import { corsPara } from '../funciones/api/_origenes.js';
import { verificarTokenMicrosoft } from '../funciones/api/_microsoft.js';
import { dentroDelLimite, respuestaLimite, LIMITES } from '../lib-netlify/limite.mjs';
import { secretosDeNetlify } from '../funciones/api/_secretos.js';
import { estaBloqueada } from '../funciones/api/_bloqueos.js';
import { aceptacionBlobs, altasBlobs, bloqueosBlobs, usuariosBlobs } from '../lib-netlify/vigilancia.mjs';
import { registrarAceptacion, versionValida } from '../funciones/api/_aceptacion.js';
import { anotarAlta } from '../funciones/api/_altas.js';
import { anotarEntrada, registroActivo } from '../funciones/api/_usuarios.js';
import { licenciaBeta } from '../funciones/api/_beta.js';
import { correoCanonico } from '../funciones/api/_correo.js';

const GOOGLE_CLIENT_ID = '617666474619-nkre1e8divbf9orspfjv8cpcl7meuoo0.apps.googleusercontent.com';
const STORE_ID = '487841';
const LS = 'https://api.lemonsqueezy.com/v1';

const json = (cuerpo, status, cors) => new Response(JSON.stringify(cuerpo), {
  status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export default async (request, context) => {
  const cors = corsPara(request.headers.get('Origin'));
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const env = { LEMONSQUEEZY_API_KEY: Netlify.env.get('LEMONSQUEEZY_API_KEY'), FUNDADORES: Netlify.env.get('FUNDADORES'), REGISTRO_USUARIOS: Netlify.env.get('REGISTRO_USUARIOS') };
  const secretos = secretosDeNetlify(k => Netlify.env.get(k));

  // Tope por IP generoso: un centro entero entra desde la misma wifi (ver LIMITES en funciones/api/_limite.js).
  const ip = context.ip || 'desconocida';
  if (!(await dentroDelLimite(`cuenta-ip:${ip}`, LIMITES.ip, LIMITES.ventana))) return respuestaLimite(cors);

  const { token, proveedor, acepta } = await request.json().catch(() => ({}));
  if (typeof token !== 'string' || token.length > 5000) return json({ error: 'token' }, 400, cors);

  let email;
  if (proveedor === 'microsoft') {
    // Microsoft no tiene un servicio que compruebe el token: se comprueba aquí (ver _microsoft.js)
    email = (await verificarTokenMicrosoft(token))?.email;
    if (!email) return json({ error: 'token' }, 401, cors);
  } else {
    const g = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
    if (!g.ok) return json({ error: 'token' }, 401, cors);
    const info = await g.json();
    if (info.aud !== GOOGLE_CLIENT_ID || String(info.email_verified) !== 'true' || !info.email) return json({ error: 'token' }, 401, cors);
    email = String(info.email).trim().toLowerCase();
  }
  // Y un tope por cuenta (auditoría del 1-11-2026): una misma cuenta llamando sin parar desde muchas IP no agota la tienda
  if (!(await dentroDelLimite(`cuenta-correo:${email}`, LIMITES.correo, LIMITES.ventana))) return respuestaLimite(cors);

  // Fundadores (quien usaba la app de Windows o Android antes del 10-11-2026): gratis para siempre.
  // Sus correos van en la variable secreta FUNDADORES (separados por comas o saltos de línea), nunca en el repositorio.
  // La aceptación de las condiciones (casilla de la entrada), con la cuenta ya comprobada: ver _aceptacion.js
  const registro = versionValida(acepta) ? await registrarAceptacion(aceptacionBlobs(), email, acepta) : null;
  const aceptacion = registro === null ? {} : { aceptacion: Boolean(registro) };

  // El registro de usuarios (_usuarios.js), solo con REGISTRO_USUARIOS=si: quién entra, con qué acceso y qué días
  const registrar = tipo => (registroActivo(env.REGISTRO_USUARIOS)
    ? anotarEntrada(usuariosBlobs(), { email, tipo, proveedor: proveedor === 'microsoft' ? 'microsoft' : 'google' }) : null);

  const fundadores = String(env.FUNDADORES ?? '').split(/[\s,;]+/).map(correoCanonico).filter(Boolean);
  if (fundadores.includes(correoCanonico(email))) {
    await registrar('fundador');
    return json({ fundador: true, firma: await firmar({ t: 'cuenta', email, fundador: true }, secretos), ...aceptacion }, 200, cors);
  }
  // Acceso anticipado gratuito (beta, funciones/api/_beta.js): igual que en Cloudflare
  const beta = await licenciaBeta(email, secretos);
  if (beta) {
    // Una cuenta que entra por primera vez cuenta como alta del acceso anticipado, sin guardar quién es (_altas.js)
    await registrar('beta');
    if (registro === 'nueva') await anotarAlta(altasBlobs());
    return json({ beta: true, firma: beta.firma, hasta: beta.hasta, ...aceptacion }, 200, cors);
  }
  if (!env.LEMONSQUEEZY_API_KEY) return json({ error: 'sin-configurar' }, 503, cors);

  const cab = { Accept: 'application/vnd.api+json', Authorization: `Bearer ${env.LEMONSQUEEZY_API_KEY}` };
  const pedidos = await fetch(`${LS}/orders?filter[store_id]=${STORE_ID}&filter[user_email]=${encodeURIComponent(email)}`, { headers: cab });
  if (!pedidos.ok) return json({ error: 'tienda' }, 502, cors);
  // Si hay un pedido pagado cuya clave ya no vale (la suscripción terminó), se avisa: así la app lo sabe en cualquier dispositivo, por el correo
  let vencida = false;
  for (const p of (await pedidos.json()).data ?? []) {
    // Un reembolso parcial (un gesto comercial) deja el pedido en `partial_refund` con la clave activa: cuenta como pagado (5-11-2026)
    if (!['paid', 'partial_refund'].includes(p.attributes?.status)) continue;
    const claves = await fetch(`${LS}/license-keys?filter[order_id]=${p.id}`, { headers: cab });
    // Si la tienda falla aquí, se dice (502) y la app lo reintenta: contestar «sin compra» quitaría la licencia a quien pagó (5-11-2026)
    if (!claves.ok) return json({ error: 'tienda' }, 502, cors);
    for (const k of (await claves.json()).data ?? []) {
      const a = k.attributes ?? {};
      // También la que Lemon Squeezy avisó que terminó, aunque su API aún no lo diga (_bloqueos.js)
      if (a.disabled || ['disabled', 'expired'].includes(a.status) || (await estaBloqueada(bloqueosBlobs(), a.key))) { vencida = true; continue; }
      if (a.key) {
        await registrar('pago');
        return json({ key: a.key, firma: await firmar({ t: 'cuenta', email, key: a.key }, secretos), ...aceptacion }, 200, cors);
      }
    }
  }
  await registrar('sin-licencia');
  return json(vencida ? { key: null, vencida: true, ...aceptacion } : { key: null, ...aceptacion }, 200, cors);
}

export const config = { path: '/api/licencia/cuenta' };
