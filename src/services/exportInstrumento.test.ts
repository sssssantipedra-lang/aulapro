import { describe, it, expect } from 'vitest';
import { buildDianaHtml, buildRegistroHtml, buildRubricaHtml, dianaSvg, gruposRegistro, nombresDeClases } from './exportInstrumento';
import type { Class, EvalDiana, Rubric, Student } from '../types';

const clases = [{ id: 'c1', name: '4º A' }, { id: 'c2', name: '4º B' }] as Class[];
const rubrica: Rubric = {
  id: 'r1', name: 'Exposición oral', context: 'Trimestre 1', class_id: 'c1', otras_clases: [{ class_id: 'c2' }],
  criteria: [
    { id: 'k1', name: 'Claridad', descriptors: { 1: 'No se entiende', 2: 'Se entiende a ratos', 3: 'Clara', 4: 'Muy clara y precisa' }, competencies: ['CCL'] },
    { id: 'k2', name: 'Voz & ritmo <b>', descriptors: { 1: 'a', 2: 'b', 3: 'c', 4: 'd' } },
  ],
};
const diana: EvalDiana = { id: 'd1', name: 'Cooperación', items: [{ id: 'i1', name: 'Ayuda', weight: 1 }, { id: 'i2', name: 'Escucha', weight: 1 }, { id: 'i3', name: 'Aporta', weight: 1 }] };
const registro: EvalDiana = { id: 'g1', tipo: 'registro', name: 'Saque', class_id: 'c1', otras_clases: [{ class_id: 'c2' }], items: [{ id: 'x1', name: 'Palma abierta', weight: 1 }, { id: 'x2', name: 'Mira la pelota', weight: 1 }] };
const alumno = (id: string, class_id: string, name: string) => ({ id, class_id, name, email: '', photo: null, alerts: [], notes: '' }) as Student;

describe('instrumentos en PDF', () => {
  it('la rúbrica lleva sus niveles, sus criterios y sus descriptores, con el texto escapado', () => {
    const html = buildRubricaHtml(rubrica, nombresDeClases(rubrica, clases), 'es');
    expect(html).toContain('Exposición oral');
    expect(html).toContain('4º A · 4º B · Trimestre 1');
    for (const n of ['Insuficiente', 'Suficiente', 'Bien', 'Excelente']) expect(html).toContain(n);
    expect(html).toContain('Muy clara y precisa');
    expect(html).toContain('CCL');
    expect(html).toContain('Voz &amp; ritmo &lt;b&gt;');
    expect(html).not.toContain('<b>');
  });

  it('la diana se dibuja con un sector numerado por ítem y un anillo por nivel', () => {
    const svg = dianaSvg(diana);
    expect((svg.match(/<path /g) ?? []).length).toBe(3 * 4);
    expect((svg.match(/<text /g) ?? []).length).toBe(3);
    const html = buildDianaHtml(diana, [], 'es');
    expect(html).toContain('Escucha');
    expect(html).toContain('Del centro hacia fuera');
  });

  it('la escala de registro hace una hoja por clase con su alumnado, o filas en blanco', () => {
    const alumnos = [alumno('s2', 'c1', 'Beta'), alumno('s1', 'c1', 'Alfa'), alumno('s3', 'c2', 'Gamma')];
    const grupos = gruposRegistro(registro, clases, alumnos);
    expect(grupos).toEqual([{ clase: '4º A', alumnos: ['Alfa', 'Beta'] }, { clase: '4º B', alumnos: ['Gamma'] }]);
    const html = buildRegistroHtml(registro, grupos, 'es');
    expect((html.match(/<section/g) ?? []).length).toBe(2);
    expect((html.match(/class="fila"/g) ?? []).length).toBe(3);
    expect(html.indexOf('Alfa')).toBeLessThan(html.indexOf('Beta'));
    expect(html).toContain('👍');

    const enBlanco = buildRegistroHtml({ ...registro, class_id: undefined, otras_clases: undefined }, gruposRegistro({ ...registro, class_id: undefined, otras_clases: undefined }, clases, alumnos), 'es');
    expect((enBlanco.match(/class="fila"/g) ?? []).length).toBe(22);
  });
});
