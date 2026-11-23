import { describe, it, expect } from 'vitest';
import { separarInforme, MARCA_TABLA } from './tablaCompetencias';

describe('separarInforme', () => {
  it('separa el texto de la tabla y descarta lo inválido', () => {
    const raw = `Texto del informe.\n${MARCA_TABLA}\n\`\`\`json\n[` +
      `{"clave":"stem","valoracion":"Excelente","comentario":"Razona con soltura."},` +
      `{"clave":"CCL","valoracion":"mal","comentario":"Le cuesta exponer."},` +
      `{"clave":"XX","valoracion":"bien","comentario":"no existe"},` +
      `{"clave":"CD","valoracion":"regular","comentario":"valoración inválida"}]\n\`\`\``;
    const r = separarInforme(raw);
    expect(r.texto).toBe('Texto del informe.');
    expect(r.tabla.map(f => f.clave)).toEqual(['CCL', 'STEM']);
    expect(r.tabla.map(f => f.valoracion)).toEqual(['mejorable', 'excelente']);
  });
  it('sin marca o con JSON roto devuelve solo el texto', () => {
    expect(separarInforme('Solo texto').tabla).toEqual([]);
    expect(separarInforme(`Hola\n${MARCA_TABLA}\n{roto`)).toEqual({ texto: 'Hola', tabla: [] });
  });
});

import { valoracionDeNota, notasPorClave, aplicarNotas } from './tablaCompetencias';

describe('valoración por código', () => {
  it('umbrales y media por competencia', () => {
    expect([valoracionDeNota(3.6), valoracionDeNota(3), valoracionDeNota(2.5), valoracionDeNota(2.4)]).toEqual(['excelente', 'bien', 'bien', 'mejorable']);
    expect(notasPorClave([{ competencyScores: { CCL: 4, STEM: 2 } }, { competencyScores: { CCL: 3 } }])).toEqual({ CCL: 3.5, STEM: 2 });
  });
  it('manda la nota sobre lo que diga la IA', () => {
    const t = aplicarNotas([
      { clave: 'CCL', valoracion: 'excelente', comentario: 'x' },
      { clave: 'CD', valoracion: 'bien', comentario: 'y' },
    ], { CCL: 1.5 });
    expect(t.map(f => f.valoracion)).toEqual(['mejorable', 'bien']);
  });
});

describe('la escala y la tabla sin comentarios (informe de seguimiento, 20-11-2026)', () => {
  it('una rúbrica de tres o de cinco niveles se pasa a la escala de 4, como en el acta', () => {
    // 3 de 3 es el máximo: sin pasarlo a 4, nadie llegaba a «Excelente» con una rúbrica de tres niveles
    expect(notasPorClave([{ competencyScores: { CCL: 3 }, max_level: 3 }])).toEqual({ CCL: 4 });
    expect(notasPorClave([{ competencyScores: { CCL: 4 }, max_level: 5 }, { competencyScores: { CCL: 4 } }])).toEqual({ CCL: 3.6 });
    expect(valoracionDeNota(notasPorClave([{ competencyScores: { CD: 3 }, max_level: 3 }]).CD)).toBe('excelente');
  });

  it('sin ningún comentario, la tabla no lleva esa columna', async () => {
    const { tablaCompetenciasHtml } = await import('./tablaCompetencias');
    const t = (k: string) => k;
    const sin = tablaCompetenciasHtml([{ clave: 'CCL', valoracion: 'bien', comentario: '' }], t, () => 'Comunicación lingüística');
    expect(sin).not.toContain('Comentario');
    expect(sin.match(/<td/g)).toHaveLength(1);
    const con = tablaCompetenciasHtml([{ clave: 'CCL', valoracion: 'bien', comentario: 'Lee con soltura.' }, { clave: 'CD', valoracion: 'bien', comentario: '' }], t, () => '');
    expect(con).toContain('<th>Comentario</th>');
    expect(con.match(/<td/g)).toHaveLength(4);
  });
});
