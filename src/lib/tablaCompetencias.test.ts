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
