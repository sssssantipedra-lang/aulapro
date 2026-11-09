// Los tres interruptores de la apertura de la venta (5-11-2026): la beta del servidor, la venta de la app y la portada tienen que
// estar siempre de acuerdo. Si alguien cambia uno a mano y se deja otro, esta prueba falla antes de publicar. Y se prueba el
// script que los cambia a la vez (scripts/abrir-venta.mjs) sobre los archivos reales, sin escribir nada.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { abrirLaVenta, ARCHIVOS, ENLACES, estadoDe, incoherencias } from '../../scripts/abrir-venta.mjs';

const leer = () => Object.fromEntries(Object.entries(ARCHIVOS).map(([k, ruta]) => [k, readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8')]));

describe('los tres interruptores de la venta', () => {
  it('hoy están de acuerdo entre sí', () => {
    expect(incoherencias(estadoDe(leer()))).toEqual([]);
  });

  it('con la venta cerrada, el archivo público de la portada no lleva ningún enlace de pago', () => {
    const textos = leer();
    if (estadoDe(textos).ventaAbierta) return;
    expect(textos.portada).not.toMatch(/lemonsqueezy/i);
  });

  it('abrir la venta cierra la beta, abre la venta y rellena la portada, todo a la vez', () => {
    const antes = leer();
    const despues = abrirLaVenta(antes);
    const e = estadoDe(despues);
    expect(e).toMatchObject({ betaAbierta: false, ventaAbierta: true, accesoAnticipado: false, acceso: '', checkout: ENLACES.checkout, pack5: ENLACES.pack5, pack10: ENLACES.pack10 });
    expect(incoherencias(e)).toEqual([]);
    // No toca nada más que esas líneas: mismo número de líneas en cada archivo salvo los enlaces de la portada
    for (const k of ['beta', 'app']) expect(despues[k].split('\n').length).toBe(antes[k].split('\n').length);
  });

  it('el script se niega a abrir dos veces la venta', () => {
    const despues = abrirLaVenta(leer());
    expect(() => abrirLaVenta(despues)).toThrow(/ya está abierta/);
  });

  it('detecta cada combinación peligrosa', () => {
    const base = { betaAbierta: true, ventaAbierta: false, accesoAnticipado: true, checkout: '', acceso: 'app/', pack5: '', pack10: '' };
    expect(incoherencias(base)).toEqual([]);
    // Venta abierta con la beta abierta: quien entró gratis seguiría sin pagar
    expect(incoherencias({ ...base, ventaAbierta: true, checkout: 'x', pack5: 'a', pack10: 'b' }).join()).toMatch(/beta también/);
    // Todo cerrado: nadie entraría
    expect(incoherencias({ ...base, betaAbierta: false, accesoAnticipado: false, acceso: '' }).join()).toMatch(/nadie/);
    // La app dice una cosa y el servidor otra
    expect(incoherencias({ ...base, accesoAnticipado: false }).join()).toMatch(/ACCESO_ANTICIPADO/);
    // La portada vende pero la app no
    expect(incoherencias({ ...base, checkout: 'x' }).join()).toMatch(/VENTA_ABIERTA/);
    // Venta abierta sin los packs
    expect(incoherencias({ betaAbierta: false, ventaAbierta: true, accesoAnticipado: false, checkout: 'x', acceso: '', pack5: '', pack10: '' }).join()).toMatch(/pack/);
  });
});
