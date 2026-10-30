import { describe, it, expect } from 'vitest';
import { onRequestPost } from '../funciones/api/licencia/[accion].js';
import { LIMITES } from '../funciones/api/_limite.js';

const kvFalso = () => { const m = new Map(); return { get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); } }; };
const activar = (env, clave, ip) => onRequestPost({
  request: new Request('https://x/api/licencia/activate', { method: 'POST', body: `license_key=${clave}&instance_name=AulaPro`, headers: { Origin: 'https://aulapro.app', 'CF-Connecting-IP': ip } }),
  params: { accion: 'activate' }, env,
});

describe('límites de las funciones de licencia', () => {
  it('un claustro de 30 docentes activa la misma clave de un pack desde la misma wifi sin que nadie quede bloqueado', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ activated: true, license_key: { status: 'active' }, instance: { id: 'i' } }), { status: 200 });
    const env = { LIMITE: kvFalso(), GOOGLE_CLIENT_SECRET: 's' };
    const estados = [];
    for (let i = 0; i < 60; i++) estados.push((await activar(env, 'PACK-30', '80.1.2.3')).status); // 30 docentes, 2 navegadores cada uno
    expect(estados.every(s => s === 200)).toBe(true);
  });

  it('un programa que llama sin parar sí se frena, por clave y por dirección', async () => {
    globalThis.fetch = async () => new Response('{}', { status: 200 });
    const env = { LIMITE: kvFalso(), GOOGLE_CLIENT_SECRET: 's' };
    let bloqueada = 0;
    for (let i = 0; i < LIMITES.clave + 5; i++) if ((await activar(env, 'UNA-CLAVE', `1.1.1.${i % 250}`)).status === 429) bloqueada++;
    expect(bloqueada).toBe(5);
    const otra = kvFalso();
    let porIp = 0;
    for (let i = 0; i < LIMITES.ip + 5; i++) if ((await activar({ LIMITE: otra, GOOGLE_CLIENT_SECRET: 's' }, `K${i}`, '9.9.9.9')).status === 429) porIp++;
    expect(porIp).toBe(5);
  });
});
