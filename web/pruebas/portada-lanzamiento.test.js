// La portada en acceso anticipado gratuito (5-11-2026): el aviso de arriba y la tarjeta del precio salen en los tres idiomas, y solo
// con la beta abierta y la venta cerrada. Si falta un texto en catalán o inglés, la portada de ese idioma enseñaría castellano.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const leer = ruta => readFileSync(new URL(`../sitio/${ruta}`, import.meta.url), 'utf8');
const html = leer('index.html');

/** Lo que hace la portada con launch.js y los textos, sin navegador: `window` y la clase de <html>. */
function cargar(archivo, window = {}) {
  vm.runInNewContext(leer(archivo), { window });
  return window;
}

const clavesDelAviso = [...html.matchAll(/data-i18n="((?:early|el)\.[a-z0-9]+)"/g)].map(m => m[1]);

describe('el aviso de versión de lanzamiento gratuita en la portada', () => {
  it('el HTML trae el aviso de arriba y la tarjeta, con todos sus textos', () => {
    expect(html).toContain('class="early-bar"');
    expect(html).toContain('id="lanzamiento"');
    expect(new Set(clavesDelAviso)).toEqual(new Set(['early.t', 'early.s', 'early.more', 'el.k', 'el.t', 'el.price', 'el.once', 'el.save', 'el.l', 'el.i1', 'el.i2', 'el.i3', 'el.i4', 'el.n']));
  });

  it('cada texto existe en castellano, catalán e inglés, y el botón dice «Prueba gratis»', () => {
    const i18n = cargar('assets/i18n.js').AULA_I18N;
    for (const idioma of ['es', 'ca', 'en']) {
      for (const k of [...clavesDelAviso, 'buy.early']) expect(i18n[idioma][k], `${idioma}: ${k}`).toBeTruthy();
    }
    expect(i18n.es['buy.early']).toBe('Prueba gratis');
    // Decisiones del dueño (5-11-2026): el acceso gratuito se cierra «a partir de enero de 2027» y se mantiene la oferta de lanzamiento
    // (9,90 € el primer año hasta el 15-4-2027; después, 14,99 € al año). Si cambia la fecha o el precio, se cambian los tres idiomas a
    // la vez, y también el aviso de la app, la privacidad y las condiciones.
    const oferta = { es: '9,90', ca: '9,90', en: '9.90' };
    const renovacion = { es: '14,99', ca: '14,99', en: '14.99' };
    for (const idioma of ['es', 'ca', 'en']) {
      for (const k of ['el.t', 'el.save', 'el.l']) {
        expect(i18n[idioma][k], `${idioma}: ${k}`).toContain(oferta[idioma]);
        expect(i18n[idioma][k], `${idioma}: ${k}`).toContain('2027');
      }
      for (const k of ['el.t', 'el.l']) expect(i18n[idioma][k], `${idioma}: ${k}`).toContain(renovacion[idioma]);
      expect(i18n[idioma]['el.l'], `${idioma}: el.l`).toMatch(/15/);   // la fecha límite de la oferta
      // Ninguna duración suelta («2 meses»): lo que se anuncia es una fecha
      for (const k of clavesDelAviso) expect(i18n[idioma][k], `${idioma}: ${k}`).not.toMatch(/\b\d+ (mes|meses|días|dies|months|days)\b/i);
    }
  });

  it('solo se activa con el acceso anticipado abierto y la venta cerrada', () => {
    const lanzamiento = cargar('assets/launch.js').AULA_LAUNCH;
    // Hoy (beta abierta): acceso relleno y checkout vacío. Tras abrir la venta, al revés. Nunca los dos.
    expect(Boolean(lanzamiento.acceso)).not.toBe(Boolean(lanzamiento.checkout));
  });
});
