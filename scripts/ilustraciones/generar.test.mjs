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
