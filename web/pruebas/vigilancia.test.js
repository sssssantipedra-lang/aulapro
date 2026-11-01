// Claves compartidas (auditoría del 1-11-2026, M4): la comprobación sin activación se cuenta por conexiones distintas.
import { describe, it, expect, beforeEach } from 'vitest';
import { onRequestPost, onRequestGet } from '../funciones/api/licencia/[accion].js';
import { anotarComprobacion, clavesSospechosas, TOPE_CONEXIONES, recortarClave } from '../funciones/api/_vigilancia.js';

/** Un KV de Cloudflare en memoria, con `list` por prefijo. */
const kvFalso = () => {
  const m = new Map();
  return { m, get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
};
const almacenFalso = () => { const m = new Map(); return { m, get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, list: async p => [...m.keys()].filter(k => k.startsWith(p)) }; };
const CLAVE = 'ABCD1234-0000-1111-2222-3333WXYZ';
const comprobar = (env, ip, cuerpo = `license_key=${CLAVE}`) => onRequestPost({
  request: new Request('https://x/api/licencia/validate', { method: 'POST', body: cuerpo, headers: { Origin: 'https://aulapro.app', 'CF-Connecting-IP': ip } }),
  params: { accion: 'validate' }, env,
});

beforeEach(() => {
  globalThis.fetch = async () => new Response(JSON.stringify({ valid: true, license_key: { status: 'active' } }), { status: 200 });
});

describe('vigilancia de claves compartidas', () => {
  it('un docente con casa, colegio y móvil no queda anotado, ni guarda su IP ni su clave en claro', async () => {
    const a = almacenFalso();
    for (const ip of ['1.1.1.1', '2.2.2.2', '3.3.3.3', '1.1.1.1']) await anotarComprobacion(a, CLAVE, ip);
    expect(await clavesSospechosas(a)).toEqual([]);
    const todo = JSON.stringify([...a.m]);
    expect(todo).not.toContain('1.1.1.1');
    expect(todo).not.toContain(CLAVE);
    expect([...a.m.values()][0]).toHaveLength(3);
  });

  it('una clave usada desde más de 15 conexiones en una semana queda anotada, recortada', async () => {
    const a = almacenFalso();
    for (let i = 0; i <= TOPE_CONEXIONES; i++) await anotarComprobacion(a, CLAVE, `10.0.0.${i}`);
    const lista = await clavesSospechosas(a);
    expect(lista).toHaveLength(1);
    expect(lista[0].clave).toBe('ABCD1234…WXYZ');
    expect(lista[0].conexiones).toBe(TOPE_CONEXIONES + 1);
    expect(recortarClave('corta')).toBe('…');
  });

  it('por defecto solo anota: la firma sigue llegando aunque pase del tope', async () => {
    const env = { LIMITE: kvFalso(), LICENCIA_SECRETO: 's' };
    let ultima;
    for (let i = 0; i <= TOPE_CONEXIONES + 2; i++) ultima = await (await comprobar(env, `10.0.1.${i}`)).json();
    expect(ultima.aulapro_firma).toBeTruthy();
  });

  it('con CLAVES_CORTAR_AL_TOPE=si, pasado el tope no hay firma', async () => {
    const env = { LIMITE: kvFalso(), LICENCIA_SECRETO: 's', CLAVES_CORTAR_AL_TOPE: 'si' };
    const firmas = [];
    for (let i = 0; i <= TOPE_CONEXIONES + 2; i++) firmas.push(!!(await (await comprobar(env, `10.0.2.${i}`)).json()).aulapro_firma);
    expect(firmas.slice(0, TOPE_CONEXIONES)).toEqual(Array(TOPE_CONEXIONES).fill(true));
    expect(firmas.at(-1)).toBe(false);
  });

  it('una comprobación con número de activación no se cuenta (esa la limita Lemon Squeezy)', async () => {
    const env = { LIMITE: kvFalso(), LICENCIA_SECRETO: 's', CLAVES_CORTAR_AL_TOPE: 'si' };
    for (let i = 0; i <= TOPE_CONEXIONES + 2; i++) await comprobar(env, `10.0.3.${i}`, `license_key=${CLAVE}&instance_id=inst-1`);
    expect([...env.LIMITE.m.keys()].some(k => k.startsWith('uso:'))).toBe(false);
  });

  it('el informe solo se da con el secreto, y sin él configurado no existe', async () => {
    const env = { LIMITE: kvFalso(), LICENCIA_SECRETO: 's' };
    for (let i = 0; i <= TOPE_CONEXIONES; i++) await comprobar(env, `10.0.4.${i}`);
    const pedir = (e, auth) => onRequestGet({ request: new Request('https://x/api/licencia/sospechosas', { headers: auth ? { Authorization: auth } : {} }), params: { accion: 'sospechosas' }, env: e });
    expect((await pedir(env, 'Bearer x')).status).toBe(404);
    const conSecreto = { ...env, CLAVES_INFORME_SECRETO: 'secreto-largo' };
    expect((await pedir(conSecreto, 'Bearer otro')).status).toBe(401);
    expect((await pedir(conSecreto)).status).toBe(401);
    const r = await pedir(conSecreto, 'Bearer secreto-largo');
    expect(r.status).toBe(200);
    const cuerpo = await r.json();
    expect(cuerpo.tope).toBe(TOPE_CONEXIONES);
    expect(cuerpo.claves[0].clave).toBe('ABCD1234…WXYZ');
  });

  it('si el almacén falla, nadie se queda sin licencia', async () => {
    const roto = { get: async () => { throw new Error('x'); }, put: async () => {}, list: async () => [] };
    expect(await anotarComprobacion(roto, CLAVE, '1.1.1.1')).toEqual({ conexiones: 0, pasada: false });
  });
});
