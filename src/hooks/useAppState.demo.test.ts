// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppState, demoSnapshot } from './useAppState';
import { sumaDePesos, blockConfig, isMarksCategory } from '../services/classMarks';

describe('cargar datos de ejemplo desde el Inicio', () => {
  it('carga lo mismo que «Explorar con datos de ejemplo»', () => {
    const { result } = renderHook(() => useAppState());
    act(() => result.current.loadDemoData('es'));
    const d = demoSnapshot('es');
    const st = result.current;
    expect(st.dianas).toEqual(d.dianas);
    expect(st.evaluations).toEqual(d.evaluations);
    expect(st.dianaProfiles).toEqual(d.dianaProfiles);
    expect(st.marksConfigs).toEqual(d.marksConfigs);
    expect(st.classMarks).toEqual(d.classMarks);
  });

  it('el cuaderno de cada clase suma 40 + 40 + 20, sin aviso de pesos', () => {
    const d = demoSnapshot('es');
    for (const c of d.classes) {
      const cats = d.gradeCategories.filter(g => g.class_id === c.id && !isMarksCategory(g.id));
      const own = cats.reduce((a, g) => a + g.weight, 0);
      const cfg = blockConfig(d.marksConfigs, c.id, c.subject);
      expect(sumaDePesos(own, cfg.points * 10), c.name).toEqual({ ok: true, total: 100 });
    }
  });
});
