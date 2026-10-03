// @vitest-environment jsdom
/**
 * La sección de competencias específicas de la Diana competencial, con el
 * currículo real de Madrid: las notas de las evaluaciones con criterios
 * oficiales llegan a su criterio, su competencia y su área, en una tabla con
 * el número, un resumen (el texto entero al pasar el ratón) y la nota.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { CompetenciasEspecificas } from './CompetenciasEspecificas';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../ui/Toast';
import { buildCompetenciasHtml } from '../../services/exportCompetencias';
import { notasDeMateria, resumir } from '../../lib/curriculum/evaluacionPorCriterios';
import { cargarCurriculo } from '../../lib/curriculum/cargar';
import { resolverGrupo } from '../../lib/curriculum';
import type { Class, Evaluation } from '../../types';

afterEach(() => { cleanup(); localStorage.clear(); });

const QUINTO: Class = {
  id: 'c1', name: '5º A', subject: 'Matemáticas', subjects: ['Matemáticas', 'Religión'], room: '', color: '#000',
  etapa: 'primaria', curso: 5,
};

const evaluacion = (notas: Record<string, number>): Evaluation => ({
  id: 'e' + Math.random(), rubric_id: 'r', rubric_name: 'Mercado', student_id: 's', student_name: 'Ana',
  class_id: 'c1', date: '2026-10-03', scores: {}, notes: '', officialCriteriaScores: notas,
});

function pinta(cls: Class, evaluaciones: Evaluation[]) {
  render(
    <I18nProvider><ToastProvider>
      <CompetenciasEspecificas cls={cls} comunidad="madrid" alumno="Ana López" evaluaciones={evaluaciones} />
    </ToastProvider></I18nProvider>,
  );
}

describe('competencias específicas del alumno', () => {
  it('una tabla por asignatura con número, resumen, veces evaluado y nota', async () => {
    pinta(QUINTO, [
      evaluacion({ 'matematicas|1.1': 5, 'matematicas|2.1': 9 }),
      evaluacion({ 'matematicas|1.1': 7 }),
    ]);
    const mates = (await screen.findByText('Matemáticas')).closest('details')!;
    expect(screen.queryByText('Religión')).toBeNull();
    // Área: media de las competencias 1 (6) y 2 (9)
    expect(within(mates.querySelector('summary')!).getByText('7,5')).toBeTruthy();
    const fila = within(mates).getByRole('rowheader', { name: '1.1' }).closest('tr')!;
    expect(within(fila).getByText('6,0')).toBeTruthy();
    expect(within(fila).getByText('2 veces')).toBeTruthy();
    // El resumen es corto; el texto entero va en el título (al pasar el ratón) y sale al tocarlo
    const resumen = within(fila).getByRole('button', { expanded: false });
    const entero = resumen.getAttribute('title')!;
    expect(entero.length).toBeGreaterThan(resumen.textContent!.length);
    expect(resumen.textContent).toMatch(/…$/);
    fireEvent.click(resumen);
    expect(resumen.textContent).toBe(entero);
    expect(resumen.getAttribute('aria-expanded')).toBe('true');
    // Solo lo evaluado: lo que falta va debajo, solo con su número
    expect(within(mates).queryByRole('rowheader', { name: '1.2' })).toBeNull();
    expect(within(mates).queryByRole('rowheader', { name: 'CE3' })).toBeNull();
    expect(within(mates).getByText('Faltan por evaluar:').parentElement!.textContent)
      .toMatch(/^Faltan por evaluar: 1\.2, 2\.2, 2\.3, 3\.1, .*8\.2$/);
    expect(screen.getByRole('button', { name: /Exportar PDF/ })).toBeTruthy();
  });

  it('una asignatura sin nada evaluado lo dice en una línea, sin tabla', async () => {
    const { materias } = await cargarCurriculo('madrid', 'primaria', 'es');
    const r = resolverGrupo('primaria', 'Matemáticas', 5, undefined, materias)!;
    const html = buildCompetenciasHtml({
      alumno: 'Ana', clase: '5º A', fecha: '2026-10-03',
      materias: [{ asignatura: 'Matemáticas', notas: notasDeMateria(r.entry, r.grupo, []) }],
    }, 'es');
    expect(html).toContain('Aún no hay ningún criterio evaluado.');
    expect(html).not.toContain('<table>');
  });

  it('sin notas todavía, explica cómo conseguirlas', async () => {
    pinta(QUINTO, []);
    expect(await screen.findByText(/Aún no hay notas/)).toBeTruthy();
  });

  it('una clase sin etapa ni curso pide que se indiquen', () => {
    pinta({ ...QUINTO, etapa: undefined, curso: undefined }, []);
    expect(screen.getByText(/Indica la etapa y el curso de la clase/)).toBeTruthy();
  });
});

describe('PDF de las competencias específicas', () => {
  it('una tabla por asignatura con cada competencia y criterio, solo con su número, y su nota', async () => {
    const { materias, normas } = await cargarCurriculo('madrid', 'primaria', 'es');
    const r = resolverGrupo('primaria', 'Matemáticas', 5, undefined, materias)!;
    const notas = notasDeMateria(r.entry, r.grupo, [evaluacion({ 'matematicas|2.1': 7.5 })]);
    const html = buildCompetenciasHtml({
      alumno: 'Ana López', clase: '5º A', fecha: '2026-10-03', cita: normas[0].corto.es,
      materias: [{ asignatura: 'Matemáticas', notas }],
    }, 'es');
    expect(html).toContain('<strong>Ana López</strong> · 5º A · 3 de octubre de 2026');
    expect(html).toContain('Currículo: Decreto 61/2022, de 13 de julio');
    expect(html).toContain('<tr class="ce"><th scope="row">CE2</th><td>7,5</td></tr>');
    expect(html).toContain('<tr><th scope="row">2.1</th><td>7,5</td></tr>');
    // Solo lo evaluado; lo que falta, en una línea, solo con su número
    expect(html).not.toContain('<th scope="row">2.2</th>');
    expect(html).not.toContain('<th scope="row">CE1</th>');
    expect(html).toMatch(/<strong>Faltan por evaluar:<\/strong> 1\.1, 1\.2, 2\.2, 2\.3, 3\.1, [^<]*8\.2<\/p>/);
    expect(html).toContain('Área: 7,5');
    // Solo el número: el texto de los criterios no va
    expect(html).not.toContain(r.entry.criterios[r.grupo][0].texto);
  });

  it('el resumen corta en la primera coma si cae pronto, o en la última palabra que cabe', () => {
    expect(resumir('Corto.')).toBe('Corto.');
    expect(resumir('Seleccionar entre diferentes estrategias para resolver un problema, justificando la elección y algo más largo.'))
      .toBe('Seleccionar entre diferentes estrategias para resolver un problema…');
    expect(resumir('Una frase muy larga sin ninguna coma que no termina nunca y sigue y sigue hasta pasarse del límite fijado'))
      .toMatch(/^Una frase muy larga sin ninguna coma que no termina nunca y sigue y…$/);
  });
});
