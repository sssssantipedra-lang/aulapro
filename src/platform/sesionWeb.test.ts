// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { olvidarApp, pedirSesion } from './sesionWeb';

const respuesta = (hasta: number) => vi.fn(async () => new Response(JSON.stringify({ hasta }), { status: 200 }));

beforeEach(() => localStorage.clear());

describe('sesión que abre el código de la app (versión web)', () => {
  it('se pide con la firma al mismo sitio, y no se vuelve a pedir mientras le quedan más de 2 días', async () => {
    const f = respuesta(Date.now() + 7 * 86400_000);
    expect(await pedirSesion('firma-1', f)).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${location.origin}/api/licencia/sesion`);
    expect(init.credentials).toBe('same-origin');
    expect(JSON.parse(String(init.body))).toEqual({ firma: 'firma-1' });
    // La firma no se guarda tal cual en el navegador (lleva el correo y la clave)
    expect(JSON.stringify({ ...localStorage })).not.toContain('firma-1');
    await pedirSesion('firma-1', f);
    expect(f).toHaveBeenCalledTimes(1);
    // Firma nueva (la renovación diaria): sesión nueva
    await pedirSesion('firma-2', f);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('a punto de caducar, se renueva', async () => {
    const f = respuesta(Date.now() + 86400_000);
    await pedirSesion('firma-1', f);
    await pedirSesion('firma-1', f);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('sin conexión no falla ni se queda colgada', async () => {
    expect(await pedirSesion('firma-1', vi.fn(async () => { throw new TypeError('sin red'); }))).toBe(false);
    expect(await pedirSesion(undefined)).toBe(false);
  });

  it('al terminar la suscripción se borra la sesión en el servidor y lo recordado', async () => {
    await pedirSesion('firma-1', respuesta(Date.now() + 7 * 86400_000));
    const f = vi.fn(async () => new Response('{}'));
    await olvidarApp(f);
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1].method).toBe('DELETE');
    expect(localStorage.length).toBe(0);
  });
});
