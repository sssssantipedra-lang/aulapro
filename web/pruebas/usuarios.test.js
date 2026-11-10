/**
 * El registro de usuarios y de uso (9-11-2026, `_usuarios.js`): el servidor real de `licencia/cuenta`, `licencia/uso` y
 * `licencia/usuarios` (Cloudflare), con Google y Lemon Squeezy falsos, y el motor que lee el uso de cada docente.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { onRequestPost as cuenta } from '../funciones/api/licencia/cuenta.js';
import { onRequestGet as licenciaGet, onRequestPost as licenciaPost } from '../funciones/api/licencia/[accion].js';
import { firmar } from '../funciones/api/_firma.js';
import { secretosDeLicencia } from '../funciones/api/_secretos.js';
import { diaDe } from '../funciones/api/_altas.js';
import { anotarUso } from '../funciones/api/_usuarios.js';
import { aCsv, analizar, analizarUsuario, fusionar } from '../sitio/assets/informe-usuarios.js';

const GOOGLE_CLIENT_ID = '617666474619-nkre1e8divbf9orspfjv8cpcl7meuoo0.apps.googleusercontent.com';
const INFORME = 'secreto-del-informe-de-usuarios';
const datos = new Map();
const kv = {
  get: async k => datos.get(k) ?? null,
  put: async (k, v) => { datos.set(k, v); },
  delete: async k => { datos.delete(k); },
  list: async ({ prefix }) => ({ keys: [...datos.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }),
};
const base = { GOOGLE_CLIENT_SECRET: 'secreto', LEMONSQUEEZY_API_KEY: 'ls', FUNDADORES: 'fundadora@ejemplo.org', LIMITE: kv, USUARIOS_INFORME_SECRETO: INFORME };
let env = base;
const encendido = { ...base, REGISTRO_USUARIOS: 'si' };

beforeAll(() => {
  globalThis.fetch = async url => {
    const u = String(url);
    if (u.includes('tokeninfo')) return new Response(JSON.stringify({ aud: GOOGLE_CLIENT_ID, email_verified: 'true', email: decodeURIComponent(u.split('id_token=')[1]) }));
    return new Response(JSON.stringify({ data: [] }));
  };
});
beforeEach(() => { datos.clear(); env = base; });

let ip = 1;
const cab = () => ({ Origin: 'https://aulapro.app', 'CF-Connecting-IP': `198.51.100.${ip++ % 250}`, 'Content-Type': 'application/json' });
const entrar = async email => (await cuenta({
  request: new Request('https://aulapro.app/api/licencia/cuenta', { method: 'POST', body: JSON.stringify({ token: email, proveedor: 'google', acepta: '2026-11-09' }), headers: cab() }),
  env,
})).json();
const avisarUso = (firma, minutos) => licenciaPost({
  request: new Request('https://aulapro.app/api/licencia/uso', { method: 'POST', body: JSON.stringify({ firma, minutos }), headers: cab() }),
  params: { accion: 'uso' }, env,
});
const informe = (secreto = INFORME) => licenciaGet({
  request: new Request('https://aulapro.app/api/licencia/usuarios', { headers: secreto ? { Authorization: `Bearer ${secreto}` } : {} }),
  params: { accion: 'usuarios' }, env,
});
const borrar = (accion, correo) => licenciaPost({
  request: new Request('https://aulapro.app/api/licencia/usuarios', { method: 'POST', body: JSON.stringify({ accion, correo }), headers: { Authorization: `Bearer ${INFORME}`, 'Content-Type': 'application/json' } }),
  params: { accion: 'usuarios' }, env,
});
const usuarios = () => [...datos.entries()].filter(([k]) => k.startsWith('usuario:')).map(([, v]) => JSON.parse(v));

describe('con el registro apagado (como está hasta publicar la privacidad)', () => {
  it('no guarda ningún correo ni al entrar ni con los avisos de uso', async () => {
    const j = await entrar('docente@ejemplo.org');
    expect(j.beta).toBe(true);
    expect((await avisarUso(j.firma, 15)).status).toBe(204);
    expect(usuarios()).toEqual([]);
    expect([...datos.entries()].join('|')).not.toMatch(/ejemplo\.org/);
  });
});

describe('con el registro encendido (REGISTRO_USUARIOS=si)', () => {
  beforeEach(() => { env = encendido; });

  it('apunta al docente al entrar: correo, proveedor, tipo, alta y el día', async () => {
    await entrar('Docente@Ejemplo.org');
    await entrar('fundadora@ejemplo.org');
    const [d, f] = usuarios().sort((a, b) => a.email.localeCompare(b.email));
    expect(d).toMatchObject({ email: 'docente@ejemplo.org', tipo: 'beta', proveedor: 'google', alta: diaDe(), dias: { [diaDe()]: 0 } });
    expect(f).toMatchObject({ email: 'fundadora@ejemplo.org', tipo: 'fundador' });
  });

  it('suma los minutos de uso activo con la firma de la cuenta, y nunca más de 30 por aviso', async () => {
    const j = await entrar('docente@ejemplo.org');
    await avisarUso(j.firma, 15);
    await avisarUso(j.firma, 500);
    expect(usuarios()[0].dias[diaDe()]).toBe(45);
  });

  it('una firma falsa, caducada o sin cuenta no apunta nada', async () => {
    await avisarUso('inventada.firma', 15);
    const caducada = await firmar({ t: 'cuenta', email: 'otro@ejemplo.org', beta: true, exp: 1 }, secretosDeLicencia(env));
    await avisarUso(caducada, 15);
    const deClave = await firmar({ t: 'clave', key: 'ABC' }, secretosDeLicencia(env));
    await avisarUso(deClave, 15);
    const ajena = await firmar({ t: 'cuenta', email: 'x@ejemplo.org', beta: true }, { firmar: 'otro-secreto', aceptar: ['otro-secreto'] });
    await avisarUso(ajena, 15);
    expect(usuarios()).toEqual([]);
  });

  it('el informe pide su secreto; borrar quita al docente y excluir impide volver a apuntarlo', async () => {
    expect((await informe('otro')).status).toBe(401);
    await entrar('una@ejemplo.org');
    await entrar('dos@ejemplo.org');
    const j = await (await informe()).json();
    expect(j.usuarios.map(u => u.email).sort()).toEqual(['dos@ejemplo.org', 'una@ejemplo.org']);

    expect((await borrar('borrar', 'una@ejemplo.org')).status).toBe(200);
    expect(usuarios().map(u => u.email)).toEqual(['dos@ejemplo.org']);
    await entrar('una@ejemplo.org');   // sigue usando AulaPro: vuelve a apuntarse
    expect(usuarios()).toHaveLength(2);

    expect((await borrar('excluir', 'dos@ejemplo.org')).status).toBe(200);
    const f = await entrar('dos@ejemplo.org');
    await avisarUso(f.firma, 15);
    expect(usuarios().map(u => u.email)).toEqual(['una@ejemplo.org']);
    // La lista de exclusión guarda una huella, no el correo
    expect([...datos.keys()].filter(k => k.startsWith('no-registrar:')).join()).not.toMatch(/ejemplo/);
  });

  it('un secreto pegado en el panel con un espacio o un salto de línea detrás sigue valiendo', async () => {
    env = { ...encendido, USUARIOS_INFORME_SECRETO: `  ${INFORME}\n` };
    expect((await informe()).status).toBe(200);
    expect((await informe('otra-cosa')).status).toBe(401);
  });

  it('sin el secreto en el servidor, el informe no existe', async () => {
    env = { ...encendido, USUARIOS_INFORME_SECRETO: '' };
    expect((await informe()).status).toBe(404);
  });
});

describe('el motor', () => {
  const u = (alta, dias, extra = {}) => ({ email: `${alta}@ejemplo.org`, tipo: 'beta', alta, dias, ...extra });

  it('estado, racha, frecuencia y si sigue una semana después', () => {
    const hoy = '2026-11-30';
    const habitual = analizarUsuario(u('2026-11-10', { '2026-11-10': 20, '2026-11-17': 30, '2026-11-26': 10, '2026-11-27': 0, '2026-11-28': 40, '2026-11-29': 25, '2026-11-30': 15 }), hoy);
    expect(habitual).toMatchObject({ estado: 'activo', racha: 5, diasDeUso: 7, dias7: 5, minutos7: 90, sigueTrasUnaSemana: true });
    expect(habitual.frecuencia).toBe('semanal');   // 7 días en 21 desde el alta: 2,3 por semana
    expect(analizarUsuario(u('2026-11-05', { '2026-11-05': 30 }), hoy)).toMatchObject({ estado: 'perdido', racha: 0, sigueTrasUnaSemana: false, diasSinUsar: 25 });
    expect(analizarUsuario(u('2026-11-10', { '2026-11-15': 30 }), hoy).estado).toBe('en riesgo');
    expect(analizarUsuario(u('2026-11-27', { '2026-11-27': 5 }), hoy)).toMatchObject({ estado: 'nuevo', sigueTrasUnaSemana: null });
    const diario = analizarUsuario(u('2026-11-23', Object.fromEntries(['23', '24', '25', '26', '27', '30'].map(d => [`2026-11-${d}`, 30]))), hoy);
    expect(diario).toMatchObject({ frecuencia: 'habitual', racha: 1 });
  });

  it('el resumen: activos, horas y retención por semana de alta', () => {
    const inf = analizar([
      u('2026-11-10', { '2026-11-10': 30, '2026-11-20': 30, '2026-11-30': 60 }),
      { ...u('2026-11-11', { '2026-11-11': 10 }), email: 'b@ejemplo.org' },
      { ...u('2026-11-28', { '2026-11-28': 10 }), email: 'c@ejemplo.org', tipo: 'pago' },
    ], '2026-11-30');
    expect(inf.usuarios.map(f => f.n)).toEqual([1, 2, 3]);
    expect(inf.resumen).toMatchObject({ usuarios: 3, activosHoy: 1, activos7: 2, activos30: 3, horas7: 1.2, porTipo: { beta: 2, pago: 1 } });
    expect(inf.resumen.retencion).toEqual([
      { semana: '2026-11-09', altas: 2, conUnaSemana: 2, siguen: 1, porcentaje: 50 },
      { semana: '2026-11-23', altas: 1, conUnaSemana: 0, siguen: 0, porcentaje: null },
    ]);
  });

  it('junta Netlify y Cloudflare sumando los minutos de cada día', () => {
    const [f] = fusionar(
      [{ email: 'a@ejemplo.org', alta: '2026-11-12', ultima: '2026-11-20T10:00:00Z', tipo: 'beta', dias: { '2026-11-12': 10, '2026-11-20': 5 } }],
      [{ email: 'a@ejemplo.org', alta: '2026-11-10', ultima: '2026-11-21T10:00:00Z', tipo: 'pago', dias: { '2026-11-20': 15, '2026-11-21': 30 } }],
    );
    expect(f).toMatchObject({ alta: '2026-11-10', tipo: 'pago', dias: { '2026-11-12': 10, '2026-11-20': 20, '2026-11-21': 30 } });
  });

  it('el CSV no deja que un correo se convierta en una fórmula de Excel', () => {
    const csv = aCsv(analizar([{ email: '=HYPERLINK("x")@ejemplo.org', alta: '2026-11-10', dias: {} }], '2026-11-10'));
    expect(csv.split('\r\n')[1]).toMatch(/^1;"'=HYPERLINK\(""x""\)@ejemplo\.org";/);
  });

  it('un aviso sin minutos o con minutos raros no apunta nada', async () => {
    const m = new Map();
    const a = { get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, del: async k => { m.delete(k); }, list: async () => [] };
    expect(await anotarUso(a, { email: 'x@ejemplo.org' }, 0)).toBe(false);
    expect(await anotarUso(a, { email: 'x@ejemplo.org' }, 'mucho')).toBe(false);
    expect(await anotarUso(a, { email: 'no es un correo' }, 10)).toBe(false);
    expect(m.size).toBe(0);
  });
});

describe('la página del informe (aulapro.app/informe, 10-11-2026)', () => {
  it('no la indexan los buscadores, lleva su CSP estricta en Netlify y en Cloudflare y la contraseña no puede acabar en la dirección', async () => {
    const { readFileSync } = await import('node:fs');
    const html = readFileSync(new URL('../sitio/informe.html', import.meta.url), 'utf8');
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).toMatch(/<form id="entrar"[^>]*method="post"/);
    expect(readFileSync(new URL('../sitio/sitemap.xml', import.meta.url), 'utf8')).not.toContain('informe');
    const cf = readFileSync(new URL('../sitio/_headers', import.meta.url), 'utf8').match(/\n\/informe\n  Content-Security-Policy: (.*)/)?.[1];
    const nf = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8').match(/for = "\/informe"\n  \[headers\.values\]\n    Content-Security-Policy = "(.*)"/)?.[1];
    expect(cf).toBeTruthy();
    expect(nf).toBe(cf);
    expect(cf).toContain("script-src 'self';");
    expect(cf).toContain("form-action 'none'");
    expect(cf).toContain("frame-ancestors 'none'");
  });

  it('el respaldo acepta la contraseña desde aulapro.app (CORS con Authorization) y sin ella sigue cerrado', async () => {
    const { corsPara } = await import('../funciones/api/_origenes.js');
    expect(corsPara('https://aulapro.app', 'GET, OPTIONS')['Access-Control-Allow-Headers']).toContain('Authorization');
    expect(corsPara('https://otra-web.example')['Access-Control-Allow-Origin']).toBeUndefined();
  });
});
