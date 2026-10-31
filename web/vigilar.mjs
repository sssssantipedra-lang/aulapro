// Vigilancia de la web: la comprueba desde fuera, como un visitante, y termina con error si algo falla.
// La lanza web-vigilancia.yml cada 30 minutos; si falla, abre una incidencia en GitHub (y GitHub avisa por
// correo) y la cierra sola cuando todo vuelve a funcionar.
//   node web/vigilar.mjs                      (comprueba https://aulapro.app)
//   VIGILAR_BASE=https://otra.web node web/vigilar.mjs
// Qué mira: la portada en sus tres idiomas, el mapa del sitio, el calendario que descarga la app y el
// vídeo; el certificado de seguridad (aviso 14 días antes de que caduque); que el dominio no esté a punto
// de caducar; las dos copias de respaldo; y, desde sondas situadas en España, que la web abra (los
// operadores bloquean direcciones de Cloudflare en los partidos de LaLiga: docs/WEB.md, apartado 4b).
import tls from 'node:tls';

const BASE = (process.env.VIGILAR_BASE || 'https://aulapro.app').replace(/\/$/, '');
const HOST = new URL(BASE).hostname;
const WWW = HOST.startsWith('www.') ? HOST : 'www.' + HOST;
const RESPALDOS = ['https://aulapro-app.pages.dev/', 'https://sssssantipedra-lang.github.io/aulapro/'];
const ESPERA = Number(process.env.VIGILAR_ESPERA_MS ?? 15000);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function pedir(url, headers = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  const t0 = Date.now();
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctl.signal, headers: { 'user-agent': 'AulaPro-vigilancia/1.0 (+https://aulapro.app)', ...headers } });
    return { r, ms: Date.now() - t0 };
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'no responde en 20 s' : (e.cause?.code || e.cause?.message || e.message));
  } finally { clearTimeout(t); }
}
async function texto(url, headers) {
  const { r, ms } = await pedir(url, headers);
  if (r.status >= 400) {
    // Cloudflare (Bot Fight Mode) pide una verificación a lo que no parece un navegador, y los servidores de
    // GitHub, desde donde vigila este script, lo son: el 19-10-2026 devolvió 403 durante casi 5 horas con la
    // web perfectamente viva (las copias de respaldo y las sondas en España abrían). Eso no es una caída.
    const cuerpo = r.status === 403 ? await r.text().catch(() => '') : '';
    if (r.status === 403 && (r.headers.get('cf-mitigated') || /challenge-platform|cf-chl|Just a moment/i.test(cuerpo)))
      throw Object.assign(new Error('Cloudflare pide una verificación al vigilante (403); no es una caída'), { mitigado: true });
    throw new Error(`responde ${r.status}`);
  }
  return { r, ms, t: await r.text() };
}

// Cada comprobación se repite hasta 3 veces (una caída de un minuto no es una caída).
async function comprobar(nombre, fn, { grave = true, veces = 3 } = {}) {
  let ultimo;
  for (let i = 1; i <= veces; i++) {
    try { const extra = await fn(); return { ok: true, linea: `✔ ${nombre}${extra ? ` (${extra})` : ''}` }; }
    catch (e) { ultimo = e; if (i < veces) await sleep(ESPERA); }
  }
  if (ultimo.mitigado) return { ok: true, linea: `⚠ ${nombre}: ${ultimo.message}`, mitigado: true };
  return { ok: !grave, linea: `${grave ? '✖' : '⚠'} ${nombre}: ${ultimo.message}` };
}

const pagina = (ruta, lang, minimo = 40000) => async () => {
  const { t, ms } = await texto(BASE + ruta);
  if (!t.includes('AulaPro') || !t.includes('</html>')) throw new Error('la página no es la de AulaPro');
  if (t.length < minimo) throw new Error(`la página está incompleta (${t.length} bytes)`);
  if (lang && !t.includes(`<html lang="${lang}"`)) throw new Error(`debería estar en ${lang}`);
  return `${(ms / 1000).toFixed(1)} s`;
};

function certificado(host) {
  return new Promise((res, rej) => {
    const s = tls.connect({ host, port: 443, servername: host, timeout: 15000 }, () => {
      const c = s.getPeerCertificate();
      s.end();
      if (!s.authorized) return rej(new Error(`certificado no válido (${s.authorizationError})`));
      const dias = Math.floor((new Date(c.valid_to) - Date.now()) / 864e5);
      if (dias < 14) return rej(new Error(`el certificado caduca en ${dias} días`));
      res(`caduca en ${dias} días`);
    });
    s.on('timeout', () => { s.destroy(); rej(new Error('no se puede abrir la conexión segura')); });
    s.on('error', e => rej(new Error(e.code || e.message)));
  });
}

async function dominio() {
  const { r } = await pedir(`https://rdap.org/domain/${HOST.replace(/^www\./, '')}`);
  if (r.status !== 200) throw new Error(`el registro no responde (${r.status})`);
  const d = await r.json();
  const ev = (d.events || []).find(e => e.eventAction === 'expiration');
  if (!ev) throw new Error('no se ve la fecha de caducidad');
  const dias = Math.floor((new Date(ev.eventDate) - Date.now()) / 864e5);
  if (dias < 30) throw new Error(`el dominio caduca en ${dias} días: renovarlo`);
  return `caduca en ${dias} días`;
}

// Sondas de Globalping (red pública de voluntarios) situadas en España.
async function desdeEspana() {
  const api = 'https://api.globalping.io/v1/measurements';
  const cab = { 'content-type': 'application/json', 'user-agent': 'AulaPro-vigilancia/1.0' };
  const c = await fetch(api, { method: 'POST', headers: cab, body: JSON.stringify({ type: 'http', target: HOST, locations: [{ country: 'ES' }], limit: 8,
    measurementOptions: { protocol: 'HTTPS', request: { method: 'HEAD', path: '/' } } }) });
  if (!c.ok) return { nota: `no se pudo consultar las sondas (${c.status})` };
  const { id } = await c.json();
  let d;
  for (let i = 0; i < 25; i++) {
    await sleep(2000);
    d = await (await fetch(`${api}/${id}`, { headers: cab })).json();
    if (d.status === 'finished') break;
  }
  const res = d?.results || [];
  const abren = res.filter(x => x.result?.statusCode >= 200 && x.result?.statusCode < 400);
  const redes = res.filter(x => !(x.result?.statusCode >= 200 && x.result?.statusCode < 400)).map(x => `${x.probe?.network || '?'} (${x.probe?.city || '?'})`);
  return { total: res.length, abren: abren.length, redes };
}

const tareas = [
  comprobar(`${HOST}: portada en castellano`, pagina('/', 'es')),
  comprobar(`${WWW}: portada`, async () => {
    const { t } = await texto(`https://${WWW}/`);
    if (!t.includes('AulaPro') || t.length < 40000) throw new Error('la página no es la de AulaPro');
  }),
  comprobar(`${HOST}/ca: portada en catalán`, pagina('/ca', 'ca')),
  comprobar(`${HOST}/en: portada en inglés`, pagina('/en', 'en')),
  comprobar('mapa del sitio', async () => { const { t } = await texto(BASE + '/sitemap.xml'); if (!t.includes('<urlset')) throw new Error('no es un mapa del sitio'); }),
  comprobar('calendario escolar (lo descarga la app)', async () => {
    const { t } = await texto(BASE + '/calendario-escolar.json');
    const j = JSON.parse(t); if (!j || typeof j !== 'object') throw new Error('JSON vacío');
  }),
  comprobar('vídeo de la portada', async () => {
    const { r } = await pedir(BASE + '/assets/hero-frames/f001.webp', { range: 'bytes=0-1023' });
    if (r.status === 403 && r.headers.get('cf-mitigated'))
      throw Object.assign(new Error('Cloudflare pide una verificación al vigilante (403); no es una caída'), { mitigado: true });
    if (![200, 206].includes(r.status)) throw new Error(`responde ${r.status}`);
    if (!/image/.test(r.headers.get('content-type') || '')) throw new Error('no devuelve una imagen');
    await r.arrayBuffer();
  }),
  comprobar(`certificado de ${HOST}`, () => certificado(HOST)),
  comprobar(`certificado de ${WWW}`, () => certificado(WWW)),
  comprobar('caducidad del dominio', dominio, { grave: false, veces: 2 }),
  ...RESPALDOS.map(u => comprobar(`copia de respaldo ${new URL(u).hostname}`, pagina2(u))),
];
function pagina2(u) {
  return async () => { const { t, ms } = await texto(u); if (!t.includes('AulaPro') || t.length < 40000) throw new Error('la copia no es la de AulaPro'); return `${(ms / 1000).toFixed(1)} s`; };
}

const [resultados, es] = await Promise.all([Promise.all(tareas), desdeEspana().catch(e => ({ nota: `no se pudo consultar las sondas (${e.message})` }))]);
const lineas = resultados.map(r => r.linea);
let problemas = resultados.filter(r => !r.ok).length;
if (es.nota) lineas.push(`ℹ desde España: ${es.nota}`);
else if (es.total >= 3 && es.abren <= es.total / 2) { problemas++; lineas.push(`✖ desde España: solo ${es.abren} de ${es.total} sondas abren la web. Posible bloqueo de un operador. Fallan: ${es.redes.join(', ')}`); }
else lineas.push(`✔ desde España: abre en ${es.abren} de ${es.total} sondas${es.redes.length ? ` (no abre en ${es.redes.join(', ')})` : ''}`);

console.log(`${problemas ? 'PROBLEMAS EN LA WEB' : 'La web responde bien'} · ${new Date().toISOString()} · ${BASE}\n`);
for (const l of lineas) console.log(l);
process.exit(problemas ? 1 : 0);
