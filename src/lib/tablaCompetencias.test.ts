import { describe, it, expect } from 'vitest';
import { separarInforme, MARCA_TABLA } from './tablaCompetencias';

describe('separarInforme', () => {
  it('separa el texto de la tabla y descarta lo inválido', () => {
    const raw = `Texto del informe.\n${MARCA_TABLA}\n\`\`\`json\n[` +
      `{"clave":"stem","valoracion":"Bien","comentario":"Razona con soltura."},` +
      `{"clave":"CCL","valoracion":"mejorable","comentario":"Le cuesta exponer."},` +
      `{"clave":"XX","valoracion":"bien","comentario":"no existe"},` +
      `{"clave":"CD","valoracion":"regular","comentario":"valoración inválida"}]\n\`\`\``;
    const r = separarInforme(raw);
    expect(r.texto).toBe('Texto del informe.');
    expect(r.tabla.map(f => f.clave)).toEqual(['CCL', 'STEM']);
    expect(r.tabla[1].valoracion).toBe('bien');
  });
  it('sin marca o con JSON roto devuelve solo el texto', () => {
    expect(separarInforme('Solo texto').tabla).toEqual([]);
    expect(separarInforme(`Hola\n${MARCA_TABLA}\n{roto`)).toEqual({ texto: 'Hola', tabla: [] });
  });
});

import { valoracionDeNota, notasPorClave, aplicarNotas } from './tablaCompetencias';

describe('valoración por código', () => {
  it('umbrales y media por competencia', () => {
    expect([valoracionDeNota(3), valoracionDeNota(2.5), valoracionDeNota(1.4)]).toEqual(['bien', 'mejorable', 'mal']);
    expect(notasPorClave([{ competencyScores: { CCL: 4, STEM: 2 } }, { competencyScores: { CCL: 3 } }])).toEqual({ CCL: 3.5, STEM: 2 });
  });
  it('manda la nota sobre lo que diga la IA', () => {
    const t = aplicarNotas([
      { clave: 'CCL', valoracion: 'bien', comentario: 'x' },
      { clave: 'CD', valoracion: 'mejorable', comentario: 'y' },
    ], { CCL: 1.5 });
    expect(t.map(f => f.valoracion)).toEqual(['mal', 'mejorable']);
  });
});
