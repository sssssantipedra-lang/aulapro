/**
 * Lo que llega a cada sector de la Diana: las competencias clave de las
 * rúbricas y dianas (1-4) y las competencias específicas por las competencias
 * clave con las que las conecta el decreto (de 10 a 4).
 */
import { describe, it, expect } from 'vitest';
import { evidenciasPorSector, nivelDelSector } from './dianaSectores';
import type { NotaMateria } from './curriculum/evaluacionPorCriterios';
import type { Evaluation } from '../types';

const formato = { numero: (n: number) => String(n).replace('.', ','), ce: (n: number) => `CE${n}` };

const evaluacion = (competencyScores: Record<string, number>): Evaluation => ({
  id: 'e', rubric_id: 'r', rubric_name: 'Mercado', student_id: 's', student_name: '', class_id: 'c',
  date: '2026-10-03', scores: {}, notes: '', competencyScores,
});

const mates = (competencias: { n: number; nota: number | null; clave: string[] }[]): { asignatura: string; notas: NotaMateria } => ({
  asignatura: 'Matemáticas',
  notas: { id: 'matematicas', nombre: 'Matemáticas', grupo: '3', nota: null, competencias: competencias.map(c => ({ ...c, texto: '', criterios: [] })) },
});

describe('evidencias de la Diana', () => {
  it('las competencias clave de las rúbricas, como siempre', () => {
    const s = evidenciasPorSector([evaluacion({ CCL: 3, CPSAA: 2 })], [], formato);
    expect(s.ds1).toEqual([{ value: 3, etiqueta: 'CCL 3 («Mercado»)' }]);
    // CPSAA alimenta dos sectores: Social y Aprender a aprender
    expect(s.ds4).toHaveLength(1);
    expect(s.ds5).toHaveLength(1);
  });

  it('una rúbrica con otros niveles se pasa a 1-4 con su nivel más alto, como en el acta', () => {
    // El nivel más alto de una rúbrica de tres niveles es un 4 en la Diana; antes contaba como un 3
    const tres = evidenciasPorSector([{ ...evaluacion({ CCL: 3, STEM: 2 }), max_level: 3 }], [], formato);
    expect(tres.ds1).toEqual([{ value: 4, etiqueta: 'CCL 4 («Mercado»)' }]);
    // El valor va sin redondear (la media del sector sale de los mismos números que la del acta); la etiqueta, a un decimal
    expect(tres.ds2[0].value).toBeCloseTo(8 / 3, 10);
    expect(tres.ds2[0].etiqueta).toBe('STEM 2,7 («Mercado»)');
    // Y el de una de cinco tampoco se sale de la escala
    const cinco = evidenciasPorSector([{ ...evaluacion({ CCL: 5, STEM: 2.5 }), max_level: 5 }], [], formato);
    expect(cinco.ds1[0].value).toBe(4);
    expect(cinco.ds2[0].value).toBe(2);
    // Con cuatro niveles, o sin el dato, queda como estaba
    expect(evidenciasPorSector([{ ...evaluacion({ CCL: 3 }), max_level: 4 }], [], formato).ds1[0].value).toBe(3);
  });

  it('con las mismas evaluaciones, el sector de una sola competencia clave es el número del acta redondeado', () => {
    // La cuenta de la segunda página del acta (`claveDe` en `pages/Records.tsx`), sobre 4
    const delActa = (evs: Evaluation[], code: string) => {
      let suma = 0, n = 0;
      for (const ev of evs) {
        const max = ev.max_level && ev.max_level > 0 ? ev.max_level : 4;
        const v = ev.competencyScores?.[code];
        if (v !== undefined) { suma += (v / max) * 4; n++; }
      }
      return n ? Math.round((suma / n) * 10) / 10 : null;
    };
    const casos: Evaluation[][] = [
      [evaluacion({ STEM: 3, CD: 2, CE: 4 }), evaluacion({ STEM: 2, CD: 3 })],
      [{ ...evaluacion({ STEM: 2, CD: 1 }), max_level: 3 }, evaluacion({ STEM: 4, CD: 1 }), { ...evaluacion({ STEM: 5, CE: 2 }), max_level: 5 }],
      [{ ...evaluacion({ STEM: 3 }), max_level: 3 }, { ...evaluacion({ STEM: 1 }), max_level: 3 }, { ...evaluacion({ STEM: 2 }), max_level: 3 }],
    ];
    for (const evs of casos) {
      const s = evidenciasPorSector(evs, [], formato);
      // STEM, CD y CE son las únicas competencias clave de sus sectores (Matemática, Digital y Emprendimiento)
      for (const [code, sector] of [['STEM', 'ds2'], ['CD', 'ds3'], ['CE', 'ds6']] as const) {
        const acta = delActa(evs, code);
        const diana = nivelDelSector(s[sector]);
        if (acta === null) expect(diana).toBeNull();
        else {
          const media = s[sector].reduce((a, e) => a + e.value, 0) / s[sector].length;
          expect(Math.round(media * 10) / 10).toBe(acta);
          expect(diana).toBe(Math.max(1, Math.min(4, Math.round(media))));
        }
      }
    }
  });

  it('una competencia específica llega a los sectores de sus competencias clave, una vez por sector', () => {
    const s = evidenciasPorSector([], [mates([{ n: 2, nota: 7.5, clave: ['CCL', 'STEM', 'CCEC'] }])], formato);
    // 7,5 sobre 10 es un 3 de 4
    expect(s.ds2).toEqual([{ value: 3, etiqueta: 'Matemáticas CE2 7,5/10' }]);
    // CCL y CCEC van los dos a Comunicación: cuenta una vez
    expect(s.ds1).toHaveLength(1);
    expect(s.ds3).toEqual([]);
  });

  it('sin nota o sin conexión en el decreto, no aporta nada', () => {
    const s = evidenciasPorSector([], [mates([{ n: 1, nota: null, clave: ['STEM'] }, { n: 6, nota: 9, clave: [] }])], formato);
    expect(Object.values(s).flat()).toEqual([]);
  });

  it('el nivel del sector es la media de todo, redondeada de 1 a 4', () => {
    const s = evidenciasPorSector([evaluacion({ STEM: 4 })], [mates([{ n: 1, nota: 5, clave: ['STEM'] }])], formato);
    expect(s.ds2.map(e => e.value)).toEqual([4, 2]);
    expect(nivelDelSector(s.ds2)).toBe(3);
    expect(nivelDelSector([])).toBeNull();
    expect(nivelDelSector([{ value: 0.4, etiqueta: '' }])).toBe(1);
  });
});
