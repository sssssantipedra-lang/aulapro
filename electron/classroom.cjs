/**
 * Sala de alumnos: pequeño servidor que se abre en el propio equipo del
 * docente mientras dura la actividad.
 *
 * Los alumnos entran desde el navegador de su móvil, en la misma wifi. No hace
 * falta instalar nada ni publicar ninguna web: cuando el docente cierra la
 * sala, el servidor se apaga y no queda nada accesible.
 */

const http = require('http');
const net = require('net');
const os = require('os');
const fs = require('fs');
const path = require('path');

const PREFERRED_PORT = 8080;
const MAX_PORT_TRIES = 12;

/** Sin caracteres que se confundan al dictarlos. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/** Interfaces que no sirven para que un móvil llegue al equipo. */
const IGNORED_IFACE = /tun|tap|vpn|virtual|vmware|vbox|hyper-?v|docker|loopback|bluetooth/i;

function randomCode() {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Direcciones por las que los alumnos pueden llegar, mejor primero.
 * Se descartan VPN y adaptadores virtuales porque no son alcanzables
 * desde el móvil de un alumno.
 */
/**
 * ¿Hay ya algo escuchando en ese puerto?
 *
 * Hay que preguntarlo conectándose, no confiando en que `listen` falle:
 * Windows permite enlazar un puerto ya ocupado sin dar EADDRINUSE (por el
 * SO_REUSEADDR que activa libuv), así que la sala creería haberse abierto
 * mientras el otro programa se queda con todas las peticiones.
 */
function portTaken(port) {
  return new Promise(resolve => {
    const probe = net.connect({ host: '127.0.0.1', port });
    const finish = taken => { probe.destroy(); resolve(taken); };
    probe.setTimeout(300);
    probe.once('connect', () => finish(true));
    probe.once('timeout', () => finish(false));
    probe.once('error', () => finish(false));   // nadie contesta: está libre
  });
}

/** Intenta escuchar en un puerto concreto. `false` si no se pudo. */
function listenOn(server, port) {
  return new Promise(resolve => {
    const onError = () => { server.removeListener('error', onError); resolve(false); };
    server.once('error', onError);
    server.listen({ port, host: '0.0.0.0' }, () => {
      server.removeListener('error', onError);
      resolve(true);
    });
  });
}

function localAddresses() {
  const found = [];
  const ifaces = os.networkInterfaces();

  for (const [name, addrs] of Object.entries(ifaces)) {
    if (IGNORED_IFACE.test(name)) continue;
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      // Prioridad: redes domésticas/escolares típicas primero
      let score = 3;
      if (a.address.startsWith('192.168.')) score = 0;
      else if (/^172\.(1[6-9]|2\d|3[01])\./.test(a.address)) score = 1;
      else if (a.address.startsWith('10.')) score = 2;
      found.push({ iface: name, ip: a.address, score });
    }
  }
  found.sort((a, b) => a.score - b.score);
  return found.map(f => ({ iface: f.iface, ip: f.ip }));
}

class ClassroomServer {
  constructor() {
    this.server = null;
    this.port = null;
    this.code = null;
    this.label = '';         // de quién es la sala, para no confundirla con otra
    this.activity = null;
    this.roster = [];        // [{ n, name, id }]
    this.responses = new Map(); // clave alumno -> respuesta
    this.onChange = null;    // aviso al proceso de la ventana
    this.studentPage = null;
  }

  get running() {
    return this.server !== null;
  }

  /** Estado que se envía a la interfaz del docente. */
  snapshot() {
    return {
      running: this.running,
      port: this.port,
      code: this.code,
      label: this.label,
      addresses: this.running ? localAddresses() : [],
      activity: this.activity,
      responses: [...this.responses.values()],
      connected: this.responses.size,
    };
  }

  loadStudentPage() {
    if (this.studentPage) return this.studentPage;
    try {
      this.studentPage = fs.readFileSync(path.join(__dirname, 'student.html'), 'utf8');
    } catch {
      this.studentPage = '<!doctype html><meta charset="utf-8"><p>No se encontró la página del alumno.</p>';
    }
    return this.studentPage;
  }

  async start({ roster = [], activity = null, label = '' } = {}) {
    if (this.running) return this.snapshot();

    this.code = randomCode();
    this.label = String(label || '').slice(0, 60);
    this.roster = roster;
    this.activity = activity;
    this.responses.clear();

    const server = http.createServer((req, res) => this.handle(req, res));

    for (let attempt = 0; attempt <= MAX_PORT_TRIES; attempt++) {
      const port = PREFERRED_PORT + attempt;
      if (await portTaken(port)) continue;              // ocupado: al siguiente
      if (!await listenOn(server, port)) continue;

      // Ya en marcha: un fallo posterior no debe tumbar la aplicación.
      server.on('error', () => {});
      this.server = server;
      this.port = port;
      return this.snapshot();
    }

    this.server = null;
    throw new Error('No se pudo abrir la sala: no hay ningún puerto libre en este equipo.');
  }

  stop() {
    if (this.server) {
      try { this.server.close(); } catch { /* ya cerrado */ }
      this.server = null;
    }
    this.port = null;
    this.code = null;
    this.label = '';
    this.activity = null;
    this.responses.clear();
    return this.snapshot();
  }

  setActivity(activity) {
    this.activity = activity;
    // Cambiar de actividad limpia las respuestas de la anterior
    this.responses.clear();
    return this.snapshot();
  }

  setRoster(roster, label) {
    this.roster = roster || [];
    if (typeof label === 'string' && label) this.label = label.slice(0, 60);
    return this.snapshot();
  }

  /* ── Peticiones ── */

  handle(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const send = (status, type, body) => {
      res.writeHead(status, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        // Solo se usa desde la propia red; evita que otra web haga peticiones
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(body);
    };
    const json = (status, obj) => send(status, 'application/json; charset=utf-8', JSON.stringify(obj));

    // La página se sirve en cualquier ruta: el código se valida en la API
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname.startsWith('/r/'))) {
      return send(200, 'text/html; charset=utf-8', this.loadStudentPage());
    }

    // De quién es esta sala. Único punto sin código: sirve para que un alumno
    // que ha tecleado mal la dirección vea que ha llegado a otra clase antes de
    // pelearse con el código. No revela la lista, ni la actividad, ni nada más.
    if (req.method === 'GET' && url.pathname === '/api/room') {
      return json(200, { label: this.label || null });
    }

    const code = url.searchParams.get('c');
    const validCode = typeof code === 'string' && code.toUpperCase() === this.code;

    if (req.method === 'GET' && url.pathname === '/api/state') {
      if (!validCode) return json(403, { error: 'codigo' });
      return json(200, {
        activity: this.activity,
        roster: this.roster.map(s => ({ n: s.n, name: s.name })),
        answered: [...this.responses.values()].map(r => r.n),
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/submit') {
      if (!validCode) return json(403, { error: 'codigo' });
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 64 * 1024) req.destroy(); // corta envíos absurdos
      });
      req.on('end', () => {
        let payload;
        try { payload = JSON.parse(body); } catch { return json(400, { error: 'formato' }); }

        const entry = {
          n: Number(payload.n) || null,
          name: String(payload.name || '').slice(0, 80),
          activityId: this.activity?.id ?? null,
          type: this.activity?.type ?? null,
          data: payload.data ?? null,
          at: new Date().toISOString(),
        };
        // Una respuesta por alumno y actividad; la última sustituye a la anterior
        const key = `${entry.activityId}:${entry.n ?? entry.name}`;
        // En lluvia de ideas se acumulan varias aportaciones
        if (entry.type === 'brainstorm') {
          const prev = this.responses.get(key);
          const ideas = [...(prev?.data?.ideas ?? []), ...(entry.data?.ideas ?? [])].slice(-20);
          entry.data = { ideas };
        }
        this.responses.set(key, entry);
        this.onChange?.(this.snapshot());
        return json(200, { ok: true });
      });
      return undefined;
    }

    return send(404, 'text/plain; charset=utf-8', 'No encontrado');
  }
}

module.exports = { ClassroomServer, localAddresses };
