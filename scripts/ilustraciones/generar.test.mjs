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
  /** Fondo blanco, una sombra lila pegada al círculo, un círculo de contorno oscuro con el interior blanco y una mota suelta. */
  async function muestra() {
    const sharp = (await import('sharp')).default;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#fff"/>` +
      `<ellipse cx="100" cy="150" rx="62" ry="12" fill="#cfc4e8"/><circle cx="100" cy="90" r="60" fill="#fff" stroke="#0b2a5b" stroke-width="8"/>` +
      `<circle cx="100" cy="90" r="14" fill="#e11d48"/><rect x="176" y="20" width="6" height="5" fill="#222"/></svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }
  const alfas = async (buf) => {
    const sharp = (await import('sharp')).default;
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { info, alfa: (x, y) => data[(y * info.width + x) * 4 + 3] };
  };

  it('deja el exterior transparente y el blanco que encierra el contorno opaco', async () => {
    const { quitarFondoBlanco } = await import('./fondo.mjs');
    const { info, alfa } = await alfas(await quitarFondoBlanco(await muestra(), { lado: 200, margen: 0 }));
    expect([info.width, info.height]).toEqual([200, 200]);
    expect(alfa(2, 2)).toBe(0);            // esquina: fondo
    expect(alfa(100, 100)).toBe(255);      // dentro del círculo: el botón rojo
    expect(alfa(100, 60)).toBe(255);       // dentro del círculo, en blanco: se queda
  });

  it('pela la sombra de color pegada al sujeto y borra las motas sueltas', async () => {
    const { quitarFondoBlanco } = await import('./fondo.mjs');
    // Sin recorte ni reescalado exactos no se puede mirar un píxel: se compara el contenido con y sin sombra
    const sharp = (await import('sharp')).default;
    const con = await quitarFondoBlanco(await muestra(), { lado: 200, margen: 0 });
    const meta = await sharp(con).metadata();
    expect(meta.hasAlpha).toBe(true);
    // El círculo mide 128 de ancho con su contorno; sin sombra ni mota, el recorte es casi cuadrado (con sombra y mota, 6 px más ancho/alto)
    const { data, info } = await sharp(con).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let minX = info.width, maxX = 0, minY = info.height, maxY = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 0) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    // Cuadrado: la sombra (más ancha que el círculo) y la mota (a la derecha) harían un recorte más ancho que alto
    expect(Math.abs((maxX - minX) - (maxY - minY))).toBeLessThanOrEqual(3);
  });

  it('un color vivo sin contorno no se pela', async () => {
    const sharp = (await import('sharp')).default;
    const { quitarFondoBlanco } = await import('./fondo.mjs');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#fff"/><circle cx="50" cy="50" r="30" fill="#f59e0b"/></svg>`;
    const { alfa } = await alfas(await quitarFondoBlanco(await sharp(Buffer.from(svg)).png().toBuffer(), { lado: 100, margen: 0 }));
    expect(alfa(50, 50)).toBe(255);
  });

  it('recorta al contorno y cuadra, con el sujeto centrado', async () => {
    const { quitarFondoBlanco } = await import('./fondo.mjs');
    const { info } = await alfas(await quitarFondoBlanco(await muestra(), { lado: 128 }));
    expect([info.width, info.height]).toEqual([128, 128]);
  });
});
