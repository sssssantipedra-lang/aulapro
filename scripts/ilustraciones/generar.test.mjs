import { describe, it, expect } from 'vitest';
import { entradas } from './generar.mjs';
import { LISTA, ETAPAS } from './lista.mjs';
import { MOTIF_KEYS } from '../../src/services/fichaMotifs';
import { puntuarIlustracion } from '../../src/lib/ilustraciones';

describe('lista de ilustraciones para fal.ai', () => {
  it('está completa: cada una con descripción en los tres idiomas, temas y áreas válidas', () => {
    const { errores } = entradas();
    expect(errores).toEqual([]);
  });

  it('las áreas son las mismas que usa la app para elegir el motivo de una ficha', () => {
    for (const fila of LISTA) for (const a of fila[7]) expect(MOTIF_KEYS, `${fila[0]}: ${a}`).toContain(a);
  });

  it('cada entrada es una entrada válida del catálogo y la app la relaciona con su tema', () => {
    const { out } = entradas();
    for (const { entrada } of out) {
      expect(entrada.fuente).toBe('img');
      expect(entrada.etapas).toEqual(ETAPAS);
      // Con su propio primer tema como tema de la ficha, tiene que encajar
      expect(puntuarIlustracion(entrada, { tema: entrada.temas[0], area: '' }), entrada.id).toBeGreaterThan(2);
    }
  });

  it('detecta una entrada incompleta', () => {
    const { errores } = entradas([
      ['mal id', 'objeto', 'a dog', 'Perro', '', 'Dog', ['Perro'], ['nada']],
      ['ani-gato', 'objeto', '', 'Gato', 'Gat', 'Cat', [], ['general']],
    ]);
    expect(errores.join('\n')).toContain('el id es');
    expect(errores.join('\n')).toContain('falta la descripción en ca');
    expect(errores.join('\n')).toContain('va en minúscula y sin tildes');
    expect(errores.join('\n')).toContain('áreas no válidas');
    expect(errores.join('\n')).toContain('falta el sujeto');
    expect(errores.join('\n')).toContain('faltan los temas');
  });
});

describe('quitar el fondo blanco', () => {
  /** Un fondo blanco con una sombra gris y un círculo de contorno oscuro con el interior blanco. */
  async function muestra() {
    const sharp = (await import('sharp')).default;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#fff"/>` +
      `<ellipse cx="100" cy="176" rx="60" ry="9" fill="#d4d4d8"/><circle cx="100" cy="90" r="60" fill="#fff" stroke="#0b2a5b" stroke-width="8"/>` +
      `<circle cx="100" cy="90" r="14" fill="#e11d48"/></svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  it('deja el exterior transparente, sin sombra, y el blanco que encierra el contorno opaco', async () => {
    const sharp = (await import('sharp')).default;
    const { quitarFondoBlanco } = await import('./fondo.mjs');
    const out = await quitarFondoBlanco(await muestra(), { lado: 200, margen: 0 });
    const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([200, 200]);
    const alfa = (x, y) => data[(y * info.width + x) * 4 + 3];
    expect(alfa(2, 2)).toBe(0);            // esquina: fondo
    expect(alfa(100, 100)).toBe(255);      // dentro del círculo: el botón rojo
    expect(alfa(100, 60)).toBe(255);       // dentro del círculo, en blanco: se queda
  });

  it('recorta al contorno y cuadra, con el sujeto centrado', async () => {
    const sharp = (await import('sharp')).default;
    const { quitarFondoBlanco } = await import('./fondo.mjs');
    const out = await quitarFondoBlanco(await muestra(), { lado: 128 });
    const { info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([128, 128]);
  });
});
