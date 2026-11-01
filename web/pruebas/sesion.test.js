import { describe, it, expect } from 'vitest';
import { firmar } from '../funciones/api/_firma.js';
import { COOKIE, leerSesion, responderSesion } from '../funciones/api/_sesion.js';
import { puerta } from '../funciones/api/_puerta.js';

const S = 'secreto-de-prueba';
const pedir = (metodo, cuerpo) => new Request('https://aulapro.app/api/licencia/sesion', {
  method: metodo, headers: { 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined,
});
const cookieDe = res => (res.headers.get('Set-Cookie') ?? '').split(';')[0];
const PUBLICO = ['/app/assets/index-abc.js', '/app/assets/react-def.js', '/app/sw.js', '/assets/app.js'];
const pedirRuta = (ruta, cookie) => new Request(`https://aulapro.app${ruta}`, { headers: cookie ? { Cookie: cookie } : {} });
const bloque = (archivo, cookie) => pedirRuta(`/app/${archivo}`, cookie);
/** Lo que serviría el alojamiento: el tipo sale del archivo de verdad, se pida como se pida. */
const servido = tipo => () => Promise.resolve(new Response('contenido', { headers: { 'Content-Type': tipo, 'Cache-Control': 'public, max-age=31536000, immutable' } }));
const JS = servido('application/javascript; charset=utf-8');

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

describe('la puerta del código de la app', () => {
  it('lo de entrar y comprar, los scripts de la web, los estilos y las imágenes salen sin sesión; el código de las pantallas, no', async () => {
    expect((await puerta(bloque('assets/index-abc.js'), S, PUBLICO, JS)).status).toBe(200);
    expect((await puerta(bloque('sw.js'), S, PUBLICO, JS)).status).toBe(200);
    expect((await puerta(pedirRuta('/assets/app.js'), S, PUBLICO, JS)).status).toBe(200);
    expect((await puerta(bloque('assets/index-abc.css'), S, PUBLICO, servido('text/css'))).status).toBe(200);
    expect((await puerta(bloque('ilustraciones/sol.webp'), S, PUBLICO, servido('image/webp'))).status).toBe(200);
    expect((await puerta(pedirRuta('/'), S, PUBLICO, servido('text/html'))).status).toBe(200);
    const cerrada = await puerta(bloque('assets/Notebook-xyz.js'), S, PUBLICO, JS);
    expect(cerrada.status).toBe(401);
    expect(cerrada.headers.get('Cache-Control')).toBe('no-store');
    expect(await cerrada.text()).not.toContain('contenido');
  });

  it('el mismo archivo pedido con otra forma de escribir la dirección no se salta la puerta (las 7 de aulapro.app del 1-11-2026)', async () => {
    for (const ruta of ['//app/assets/Notebook-xyz.js', '/APP/assets/Notebook-xyz.js', '/app/ASSETS/Notebook-xyz.js', '/%61pp/assets/Notebook-xyz.js',
      '/app%2Fassets/Notebook-xyz.js', '/app/assets/Notebook-xyz.JS', '/app/assets/Notebook-xyz.js%20', '/app/assets/Notebook-xyz.js/', '/app//assets/Notebook-xyz.js']) {
      expect((await puerta(pedirRuta(ruta), S, PUBLICO, JS)).status, ruta).toBe(401);
    }
    // Ni un bloque público pedido de otra forma (no hace falta: la app lo pide siempre por su dirección)
    expect((await puerta(pedirRuta('//app/assets/index-abc.js'), S, PUBLICO, JS)).status).toBe(401);
    // Lo que no es código, se pida como se pida, sale igual
    expect((await puerta(pedirRuta('/APP/'), S, PUBLICO, servido('text/html'))).status).toBe(200);
  });

  it('un 404 o un error salen tal cual, sin código', async () => {
    const no = () => Promise.resolve(new Response('Not found', { status: 404, headers: { 'Content-Type': 'application/javascript' } }));
    expect((await puerta(bloque('assets/nada.js'), S, PUBLICO, no)).status).toBe(404);
  });

  it('con sesión pasa, y lo que pasa no se guarda en cachés compartidas', async () => {
    const res = await responderSesion(pedir('POST', { firma: await firmar({ t: 'clave', key: 'K' }, S) }), S);
    const servida = await puerta(bloque('assets/Notebook-xyz.js', cookieDe(res)), S, PUBLICO, JS);
    expect(servida.status).toBe(200);
    expect(servida.headers.get('Cache-Control')).toMatch(/^private/);
    expect(await servida.text()).toBe('contenido');
  });

  it('una cookie inventada no abre la puerta', async () => {
    expect((await puerta(bloque('assets/Notebook-xyz.js', `${COOKIE}=abc.def`), S, PUBLICO, JS)).status).toBe(401);
  });

  it('sin lista generada o sin secreto deja pasar (no se rompe la app de todos por un olvido)', async () => {
    expect((await puerta(bloque('assets/Notebook-xyz.js'), S, null, JS)).status).toBe(200);
    expect((await puerta(bloque('assets/Notebook-xyz.js'), '', PUBLICO, JS)).status).toBe(200);
  });
});
