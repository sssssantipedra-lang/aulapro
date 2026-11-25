/**
 * Las rúbricas y la diana de ejemplo tienen sus clases y su categoría del cuaderno, como las crea la app,
 * y sus evaluaciones tienen columna, con su nota, en el cuaderno de su clase (25-11-2026: antes no
 * declaraban clase, no llegaban al cuaderno y en «Trabajo compartido» contaban 0).
 */
import { describe, it, expect } from 'vitest';
import { buildDemoData } from './demoData';
import { clasesDe, columnaDeEvaluacion, destinosDe, objetivosDe } from './objetivos';
import { usadoEn } from '../services/paquete';
import type { Lang } from '../i18n/core';

describe('instrumentos de ejemplo', () => {
  for (const lang of ['es', 'ca', 'en'] as Lang[]) {
    it(`en ${lang}, cada rúbrica y la diana tienen clase y una categoría de su cuaderno`, () => {
      const d = buildDemoData(lang);
      const instrumentos = [...d.rubrics, ...d.dianas];
      expect(d.dianas.length).toBeGreaterThan(0);
      for (const inst of instrumentos) {
        const objetivos = objetivosDe(inst);
        expect(objetivos.length, inst.id).toBeGreaterThan(0);
        for (const o of objetivos) {
          const clase = d.classes.find(c => c.id === o.class_id);
          expect(clase, `${inst.id} en ${o.class_id}`).toBeDefined();
          expect(clase?.subjects).toContain(o.subject);
          const cat = d.gradeCategories.find(c => c.id === o.category_id);
          expect(cat?.class_id, `${inst.id} en ${o.class_id}`).toBe(o.class_id);
        }
        // Se usa en todas las clases en las que tiene evaluaciones
        const conEvaluaciones = new Set(d.evaluations.filter(e => e.rubric_id === inst.id).map(e => e.class_id));
        expect(conEvaluaciones.size, inst.id).toBeGreaterThan(0);
        expect(new Set(clasesDe(inst))).toEqual(conEvaluaciones);
      }
    });
  }

  it('cada evaluación de ejemplo tiene columna y nota en el cuaderno de su clase', () => {
    const d = buildDemoData();
    const instrumentos = [...d.rubrics, ...d.dianas];
    for (const ev of d.evaluations) {
      const alumno = d.students.find(s => s.id === ev.student_id);
      expect(alumno?.class_id).toBe(ev.class_id);
      const inst = instrumentos.find(i => i.id === ev.rubric_id)!;
      const destinos = destinosDe(inst, ev.class_id);
      expect(destinos.length, `${ev.id}`).toBe(1);
      const { id, existe } = columnaDeEvaluacion(destinos[0].id, ev.date, d.gradeItems);
      expect(existe, `${ev.id} → ${id}`).toBe(true);
      const columna = d.gradeItems.find(i => i.id === id)!;
      expect(columna.class_id).toBe(ev.class_id);
      expect(columna.category_id).toBe(destinos[0].category_id);
      expect(columna.name).toBe(inst.name);
      expect(d.grades[id]?.[ev.student_id]).toBe(ev.grade);
    }
    // La de la clase principal conserva el id de siempre; las de las demás llevan su clase
    expect(d.gradeItems.some(i => i.id === 'gi-r1' && i.class_id === d.rubrics[0].class_id)).toBe(true);
    expect(d.gradeItems.some(i => i.id === 'gi-d1-c4')).toBe(true);
    // Sin columnas repetidas
    expect(new Set(d.gradeItems.map(i => i.id)).size).toBe(d.gradeItems.length);
  });

  it('en «Trabajo compartido» cuentan en sus clases', () => {
    const d = buildDemoData();
    const c3 = new Set(['c3']);
    expect(d.rubrics.filter(r => usadoEn(r, c3)).map(r => r.id)).toEqual(['r1', 'r2']);
    expect(d.dianas.filter(x => usadoEn(x, c3)).map(x => x.id)).toEqual(['d1']);
    const p1 = new Set(['p1']);
    expect(d.rubrics.filter(r => usadoEn(r, p1)).map(r => r.id)).toEqual(['r1', 'r3']);
  });
});
