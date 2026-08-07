/**
 * Sirve la interfaz compilada por http en vez de abrirla con file://.
 *
 * Por qué existe: con `file://` el origen de la página es `null`, y los
 * servicios que comprueban quién los incrusta se niegan a cargar. YouTube es
 * el caso claro — devuelve «Error 153: error de configuración del reproductor»
 * en el widget de Contenido de Aula Live, mientras que el mismo vídeo cargado
 * desde un origen `http://` funciona. Servir la app desde 127.0.0.1 le da un
 * origen legítimo y el problema desaparece.
 *
 * Solo escucha en 127.0.0.1: es para esta máquina, no para la red. La sala de
 * alumnos, que sí debe verse desde los móviles, tiene su propio servidor en
 * classroom.cjs.
 */

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json; charset=utf-8',
};

/**
 * Un puerto cualquiera que el sistema tenga libre (puerto 0). No se fija uno
 * concreto a propósito: no hay que adivinarlo desde fuera y así nunca choca
 * con otro programa del equipo.
 */
function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ port: 0, host: '127.0.0.1' }, () => resolve(server.address().port));
  });
}

class AppServer {
  constructor(rootDir) {
    this.root = path.resolve(rootDir);
    this.server = null;
    this.port = null;
  }

  async start() {
    if (this.port) return this.port;
    this.server = http.createServer((req, res) => this.handle(req, res));
    this.port = await listen(this.server);
    return this.port;
  }

  get url() {
    return this.port ? `http://127.0.0.1:${this.port}/` : null;
  }

  async handle(req, res) {
    let rel;
    try {
      rel = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    } catch {
      res.writeHead(400).end('Petición mal formada');
      return;
    }
    if (rel === '/' || rel === '') rel = '/index.html';

    // `path.join` deja pasar los `..`; se comprueba que el resultado siga
    // dentro de dist/ para que una ruta rebuscada no saque archivos del disco.
    const file = path.join(this.root, rel);
    if (file !== this.root && !file.startsWith(this.root + path.sep)) {
      res.writeHead(403).end('Fuera de la carpeta de la aplicación');
      return;
    }

    try {
      const stat = await fsp.stat(file);
      if (!stat.isFile()) throw new Error('no es un archivo');

      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stat.size,
        // Es un archivo local que cambia con cada versión instalada: que no se
        // quede una versión vieja en caché tras actualizar.
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404).end('No encontrado');
    }
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.port = null;
    }
  }
}

module.exports = { AppServer };
