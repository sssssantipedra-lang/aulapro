/**
 * Canal local de «Trabajo compartido»: un servidor mínimo en el equipo del
 * docente que manda, para que el que recibe (en la misma wifi, sin internet)
 * lea y escriba el paquete compartido por HTTP directo. El mismo patrón que
 * electron/classroom.cjs; aquí no hay alumnos, solo un paquete de datos.
 */

const crypto = require('crypto');
const http = require('http');
const net = require('net');
const os = require('os');

/** Puerto separado del de la Sala de alumnos (8080) para no pisarse. */
const PREFERRED_PORT = 8100;
const MAX_PORT_TRIES = 12;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
/** Un curso completo cabe de sobra; más que esto es sospechoso. */
const MAX_BODY = 2 * 1024 * 1024;
const IGNORED_IFACE = /tun|tap|vpn|virtual|vmware|vbox|hyper-?v|docker|loopback|bluetooth/i;

function randomCode() {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return out;
}

function portTaken(port) {
  return new Promise(resolve => {
    const probe = net.connect({ host: '127.0.0.1', port });
    const finish = taken => { probe.destroy(); resolve(taken); };
    probe.setTimeout(300);
    probe.once('connect', () => finish(true));
    probe.once('timeout', () => finish(false));
    probe.once('error', () => finish(false));
  });
}

function listenOn(server, port) {
  return new Promise(resolve => {
    const onError = () => { server.removeListener('error', onError); resolve(false); };
    server.once('error', onError);
    server.listen({ port, host: '0.0.0.0' }, () => { server.removeListener('error', onError); resolve(true); });
  });
}

function localAddresses() {
  const found = [];
  const ifaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (IGNORED_IFACE.test(name)) continue;
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
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

class SyncServer {
  constructor() {
    this.server = null;
    this.port = null;
    this.code = null;
    this.bundle = null;
    /** Llamado cuando el invitado envía su paquete (POST): se contesta con el del anfitrión ya actualizado. */
    this.onPeerBundle = null;
  }

  get running() {
    return this.server !== null;
  }

  snapshot() {
    return {
      running: this.running,
      port: this.port,
      code: this.code,
      addresses: this.running ? localAddresses() : [],
    };
  }

  async start({ bundle = null } = {}) {
    if (this.running) return this.snapshot();
    this.code = randomCode();
    this.bundle = bundle;
    const server = http.createServer((req, res) => this.handle(req, res));
    for (let attempt = 0; attempt <= MAX_PORT_TRIES; attempt++) {
      const port = PREFERRED_PORT + attempt;
      if (await portTaken(port)) continue;
      if (!await listenOn(server, port)) continue;
      server.on('error', () => {});
      this.server = server;
      this.port = port;
      return this.snapshot();
    }
    this.server = null;
    throw new Error('No se pudo abrir el canal local: no hay ningún puerto libre en este equipo.');
  }

  stop() {
    if (this.server) { try { this.server.close(); } catch { /* ya cerrado */ } }
    this.server = null;
    this.port = null;
    this.code = null;
    this.bundle = null;
    return this.snapshot();
  }

  setBundle(bundle) {
    this.bundle = bundle;
    return this.snapshot();
  }

  handle(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    // La app del invitado pide desde su propio origen (otro equipo de la red):
    // sin estas cabeceras el navegador/WebView bloquearía la respuesta.
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    const send = (status, body) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    };

    if (url.pathname !== '/share') return send(404, { error: 'no-encontrado' });
    const code = (url.searchParams.get('c') ?? '').toUpperCase();
    if (code !== this.code) return send(403, { error: 'codigo' });

    if (req.method === 'GET') {
      return send(200, this.bundle ?? {});
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > MAX_BODY) req.destroy();
      });
      req.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(body); } catch { return send(400, { error: 'formato' }); }
        if (this.onPeerBundle) this.onPeerBundle(parsed);
        return send(200, this.bundle ?? {});
      });
      return undefined;
    }

    return send(405, { error: 'metodo' });
  }
}

module.exports = { SyncServer, localAddresses };
