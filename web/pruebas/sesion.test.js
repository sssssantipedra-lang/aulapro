import { describe, it, expect } from 'vitest';
import { firmar } from '../funciones/api/_firma.js';
import { COOKIE, leerSesion, responderSesion } from '../funciones/api/_sesion.js';
import { puerta, soloParaQuienPide } from '../funciones/api/_puerta.js';

const S = 'secreto-de-prueba';
const pedir = (metodo, cuerpo) => new Request('https://aulapro.app/api/licencia/sesion', {
  method: metodo, headers: { 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined,
});
const cookieDe = res => (res.headers.get('Set-Cookie') ?? '').split(';')[0];
const PUBLICO = ['assets/index-abc.js', 'assets/react-def.js'];
const bloque = (archivo, cookie) => new Request(`https://aulapro.app/app/${archivo}`, { headers: cookie ? { Cookie: cookie } : {} });

describe('sesión que abre el código de la app («sin pagar, no hay app»)', () => {
  it('con una licencia firmada y vigente, el servidor deja una cookie HttpOnly que vale como mucho 7 días', async () => {
    const ahora = Date.now();
    const res = await responderSesion(pedir('POST', { firma: await firmar({ t: 'cuenta', email: 'a@b.es', key: 'K' }, S, ahora) }), S, ahora);
    expect(res.status).toBe(200);
    const c = res.headers.get('Set-Cookie');
    expect(c).toMatch(/HttpOnly/);
    expect(c).toMatch(/Secure/);
    expect(c).toMatch(/Path=\/app\//);
    const datos = await leerSesion(cookieDe(res), S, ahora);
    expect(datos.t).toBe('cuenta');
    // Sin el correo ni la clave en la cookie
    expect(JSON.stringify(datos)).not.toMatch(/a@b\.es|"K"/);
    expect(await leerSesion(cookieDe(res), S, ahora + 7 * 86400_000 + 1000)).toBeNull();
  });

  it('sin firma, con una firma inventada, de otro secreto o caducada, no hay sesión', async () => {
    for (const firma of [undefined, 'inventada.firma', await firmar({ t: 'clave', key: 'K' }, 'otro'), await firmar({ t: 'clave', key: 'K', exp: 1 }, S)]) {
      const res = await responderSesion(pedir('POST', { firma }), S);
      expect(res.status).toBe(401);
      expect(await leerSesion(cookieDe(res), S)).toBeNull();
    }
  });

  it('una cookie escrita a mano o retocada no vale', async () => {
    const res = await responderSesion(pedir('POST', { firma: await firmar({ t: 'clave', key: 'K' }, S) }), S);
    const [cuerpo, sello] = cookieDe(res).split('=')[1].split('.');
    const otra = btoa(JSON.stringify({ v: 1, t: 'clave', exp: 9999999999 })).replace(/=+$/, '');
    expect(await leerSesion(`${COOKIE}=${otra}.${sello}`, S)).toBeNull();
    expect(await leerSesion(`${COOKIE}=${cuerpo}.${sello}`, 'otro')).toBeNull();
  });

  it('DELETE borra la cookie (la suscripción terminó)', async () => {
    const res = await responderSesion(pedir('DELETE'), S);
    expect(res.headers.get('Set-Cookie')).toMatch(/Max-Age=0/);
  });
});

describe('la puerta de /app/assets/', () => {
  it('lo de entrar y comprar, los estilos y las imágenes salen sin sesión; el código de las pantallas, no', async () => {
    expect(await puerta(bloque('assets/index-abc.js'), S, PUBLICO)).toBeNull();
    expect(await puerta(bloque('assets/index-abc.css'), S, PUBLICO)).toBeNull();
    expect(await puerta(bloque('ilustraciones/sol.webp'), S, PUBLICO)).toBeNull();
    // El service worker y lo que no es de assets/ no pasan por la puerta
    expect(await puerta(bloque('sw.js'), S, PUBLICO)).toBeNull();
    const cerrada = await puerta(bloque('assets/Notebook-xyz.js'), S, PUBLICO);
    expect(cerrada.status).toBe(401);
    expect(cerrada.headers.get('Cache-Control')).toBe('no-store');
  });

  it('con sesión pasa, y lo que pasa no se guarda en cachés compartidas', async () => {
    const res = await responderSesion(pedir('POST', { firma: await firmar({ t: 'clave', key: 'K' }, S) }), S);
    const req = bloque('assets/Notebook-xyz.js', cookieDe(res));
    expect(await puerta(req, S, PUBLICO)).toBeNull();
    const servida = soloParaQuienPide(new Response('código', { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } }), req, PUBLICO);
    expect(servida.headers.get('Cache-Control')).toMatch(/^private/);
  });

  it('una cookie inventada no abre la puerta', async () => {
    expect((await puerta(bloque('assets/Notebook-xyz.js', `${COOKIE}=abc.def`), S, PUBLICO)).status).toBe(401);
  });

  it('sin lista generada o sin secreto deja pasar (no se rompe la app de todos por un olvido)', async () => {
    expect(await puerta(bloque('assets/Notebook-xyz.js'), S, null)).toBeNull();
    expect(await puerta(bloque('assets/Notebook-xyz.js'), '', PUBLICO)).toBeNull();
  });
});
