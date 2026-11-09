/**
 * Las altas del acceso anticipado (9-11-2026, `_altas.js`): el servidor real de `licencia/cuenta` y del informe, con Google
 * falso. Cuenta cada cuenta nueva una sola vez y no guarda nada que identifique a nadie.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { onRequestPost as cuenta } from '../funciones/api/licencia/cuenta.js';
import { onRequestGet as licenciaGet } from '../funciones/api/licencia/[accion].js';
import { anotarAlta, contarAltas, diaDe } from '../funciones/api/_altas.js';
import { registrarAceptacion } from '../funciones/api/_aceptacion.js';

const GOOGLE_CLIENT_ID = '617666474619-nkre1e8divbf9orspfjv8cpcl7meuoo0.apps.googleusercontent.com';
const INFORME = 'secreto-del-informe';

/** Cloudflare KV en memoria, con `list` por prefijo. */
const datos = new Map();
const kv = {
  get: async k => datos.get(k) ?? null,
  put: async (k, v) => { datos.set(k, v); },
  delete: async k => { datos.delete(k); },
  list: async ({ prefix }) => ({ keys: [...datos.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }),
};
const env = { GOOGLE_CLIENT_SECRET: 'secreto', LEMONSQUEEZY_API_KEY: 'ls', FUNDADORES: 'fundadora@ejemplo.org', LIMITE: kv, CLAVES_INFORME_SECRETO: INFORME };

beforeAll(() => {
  globalThis.fetch = async url => {
    const u = String(url);
    if (u.includes('tokeninfo')) {
      const email = decodeURIComponent(u.split('id_token=')[1]);
      return new Response(JSON.stringify({ aud: GOOGLE_CLIENT_ID, email_verified: 'true', email }));
    }
    return new Response(JSON.stringify({ data: [] }));
  };
});
beforeEach(() => datos.clear());

let ip = 1;
const entrar = async (email, acepta = '2026-11-05') => (await cuenta({
  request: new Request('https://aulapro.app/api/licencia/cuenta', {
    method: 'POST', body: JSON.stringify({ token: email, proveedor: 'google', ...(acepta ? { acepta } : {}) }),
    headers: { Origin: 'https://aulapro.app', 'CF-Connecting-IP': `203.0.113.${ip++ % 250}`, 'Content-Type': 'application/json' },
  }),
  env,
})).json();

const informe = async (secreto = INFORME) => licenciaGet({
  request: new Request('https://aulapro.app/api/licencia/altas', { headers: secreto ? { Authorization: `Bearer ${secreto}` } : {} }),
  params: { accion: 'altas' }, env,
});

describe('altas del acceso anticipado', () => {
  it('cuenta cada cuenta nueva una vez, aunque vuelva a entrar o renueve', async () => {
    expect((await entrar('una@ejemplo.org')).beta).toBe(true);
    await entrar('una@ejemplo.org');
    await entrar('una@ejemplo.org', null);          // la renovación diaria ya no manda la aceptación
    await entrar('Otra@Ejemplo.org');
    await entrar('otra@ejemplo.org');
    const r = await informe();
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.total).toBe(2);
    expect(j.dias).toEqual([{ dia: diaDe(), altas: 2 }]);
  });

  it('la respuesta a la app no cambia: sigue diciendo si la aceptación quedó anotada', async () => {
    const j = await entrar('tres@ejemplo.org');
    expect(j).toMatchObject({ beta: true, aceptacion: true });
    expect(await entrar('tres@ejemplo.org')).toMatchObject({ aceptacion: true });
  });

  it('no cuenta a los fundadores ni a quien ya había aceptado antes', async () => {
    await entrar('fundadora@ejemplo.org');
    await registrarAceptacion({ get: kv.get, put: (k, v) => kv.put(k, JSON.stringify(v)) }, 'antigua@ejemplo.org', '2026-11-03');
    // aceptacionKv guarda JSON; lo de arriba imita una aceptación ya anotada por el servidor
    await entrar('antigua@ejemplo.org');
    expect((await (await informe()).json()).total).toBe(0);
  });

  it('no guarda ningún correo, ni huella, ni IP: solo el día y un número al azar', async () => {
    await entrar('cuatro@ejemplo.org');
    const altas = [...datos.entries()].filter(([k]) => k.startsWith('alta:'));
    expect(altas).toHaveLength(1);
    const [k, v] = altas[0];
    expect(k).toMatch(/^alta:\d{4}-\d{2}-\d{2}:[0-9a-f-]{36}$/);
    expect(v).toBe('1');
    // Y la clave de la aceptación (huella del correo) no aparece en la del alta
    const huella = [...datos.keys()].find(x => x.startsWith('aceptacion:')).slice('aceptacion:'.length);
    expect(k).not.toContain(huella);
  });

  it('el informe pide el secreto y no existe sin él', async () => {
    expect((await informe('otro')).status).toBe(401);
    expect((await informe(null)).status).toBe(401);
    const sin = await licenciaGet({ request: new Request('https://aulapro.app/api/licencia/altas'), params: { accion: 'altas' }, env: { ...env, CLAVES_INFORME_SECRETO: '' } });
    expect(sin.status).toBe(404);
  });

  it('agrupa por día de España y ordena del más antiguo al más reciente', async () => {
    const m = new Map();
    const a = { put: async k => { m.set(k, 1); }, list: async p => [...m.keys()].filter(k => k.startsWith(p)) };
    await anotarAlta(a, new Date('2026-11-10T22:30:00Z'));   // 23:30 del 10 en España (invierno, UTC+1)
    await anotarAlta(a, new Date('2026-11-10T23:30:00Z'));   // 00:30 del 11 en España
    await anotarAlta(a, new Date('2026-11-10T09:00:00Z'));
    expect(await contarAltas(a)).toEqual({ total: 3, dias: [{ dia: '2026-11-10', altas: 2 }, { dia: '2026-11-11', altas: 1 }] });
    expect(await anotarAlta(null)).toBe(false);
    expect(await anotarAlta({ put: async () => { throw new Error('x'); } })).toBe(false);
  });
});
