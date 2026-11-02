// Qué direcciones se salta la puerta de Netlify (web/netlify-edge/puerta.js). El 2-11-2026 la vigilancia vio que
// aulapro.app servía el código de la app sin sesión con …js%3F.css y …js%23.png: la función de borde no corría con
// direcciones acabadas en .css o .png, y Netlify servía el .js igualmente. Se prueba con la dirección tal cual llega
// y ya descodificada, porque no consta con cuál de las dos compara Netlify.
import { describe, it, expect } from 'vitest';
import { config } from '../netlify-edge/puerta.js';

const regla = p => new RegExp(p);
const pasaPorLaPuerta = ruta =>
  [config.pattern].flat().some(p => regla(p).test(ruta)) && ![config.excludedPattern].flat().some(p => regla(p).test(ruta));
const formas = ruta => { const otras = [ruta]; try { otras.push(decodeURIComponent(ruta)); } catch { /* % suelto */ } return otras; };

const f = 'Actitud-DTla19q0.js';
// Las de web/vigilar.mjs (variantesDeBloque) y alguna más con el mismo truco
const VARIANTES = [`/app/assets/${f}`, `//app/assets/${f}`, `/APP/assets/${f}`, `/%61pp/assets/${f}`, `/app/assets/${f.replace(/\.js$/, '.JS')}`,
  `/app/assets/${f}/`, `/app/assets/${f}%2F.css`, `/app/assets/${f}/.css`, `/app/assets/${f};.css`, `/app/assets/${f}%3F.css`,
  `/app/assets/${f}%23.png`, `/app/assets/${f}%3f.webp`, `/app/assets/${f}%3Fa.svg`, `/app/assets/${f}%23x.woff2`, `/app/assets/${f}.css`,
  `/app/assets/${f}%20.png`, `/app/assets/${f}%00.png`, `/app/assets/${f}?.css`, `/app/sw.js`, `/assets/i18n.js`];

describe('puerta de Netlify', () => {
  it('pasa por la puerta cualquier forma de pedir un bloque de código', () => {
    for (const v of VARIANTES) for (const ruta of formas(v)) expect(pasaPorLaPuerta(ruta), ruta).toBe(true);
  });

  it('se salta las imágenes, los estilos y las fuentes de nombre limpio, y las funciones', () => {
    for (const ruta of ['/assets/icono.svg', '/app/assets/index-Bx_9-aZ.css', '/ilustraciones/obj-llave.webp', '/capturas/portada/portatil-1.png',
      '/app/favicon.ico', '/fuentes/Lexend-Regular.woff2', '/api/licencia/validate', '/api/google/token'])
      expect(pasaPorLaPuerta(ruta), ruta).toBe(false);
  });

  it('las reglas no usan búsquedas hacia delante ni hacia atrás', () => {
    for (const p of [config.pattern, ...config.excludedPattern]) expect(p).not.toMatch(/\(\?[=!<]/);
  });
});
