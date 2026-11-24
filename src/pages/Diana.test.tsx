// @vitest-environment jsdom
/**
 * La Diana competencial por evaluación (20-11-2026): cuentan las evaluaciones de las fechas de la evaluación
 * elegida (la misma del cuaderno y las actas), cada evaluación guarda su Diana sin pisar las demás, y «Curso»
 * sigue siendo todo, con la Diana que ya había.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Diana } from './Diana';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { Class, DianaProfile, Evaluation, Student } from '../types';

// Un día de la 2.ª evaluación: lo de octubre es de la 1.ª y lo de febrero, de esta
beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2027, 1, 15, 10)); });
afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); });

const CLASE: Class = { id: 'c1', name: '5º A', subject: 'Tutoría', subjects: ['Tutoría'], room: '', color: '#000' };
const alumno = (id: string, name: string): Student => ({ id, class_id: 'c1', name, email: '', photo: null, alerts: [], notes: '' });
const ALUMNOS = [alumno('s1', 'Alumno 1'), alumno('s2', 'Alumno 2')];

const evaluacion = (id: string, date: string, competencyScores: Record<string, number>, max_level = 4): Evaluation => ({
  id, rubric_id: 'r', rubric_name: 'Mercado', student_id: 's1', student_name: '', class_id: 'c1',
  date, scores: {}, notes: '', competencyScores, max_level,
});
const EVALUACIONES = [
  evaluacion('e1', '2026-10-03', { STEM: 1, CD: 2 }),
  evaluacion('e2', '2027-02-10', { STEM: 4 }),
];
/** La Diana que el alumno tenía guardada antes de que hubiera evaluaciones: la de todo el curso. */
const DE_ANTES: Record<string, DianaProfile> = { s1: { scores: { ds2: 3 }, descriptors: { ds2: 'La de siempre' }, updated: '2026-11-12' } };

function Pantalla({ guardadas, alGuardar }: { guardadas: Record<string, DianaProfile>; alGuardar: (id: string, p: DianaProfile) => void }) {
  const [perfiles, setPerfiles] = useState(guardadas);
  return (
    <I18nProvider><ToastProvider>
      <Diana classes={[CLASE]} students={ALUMNOS} evaluations={EVALUACIONES} rubrics={[]} dianas={[]} lawDocument={null}
        dianaProfiles={perfiles} onSaveDiana={(id, p) => { alGuardar(id, p); setPerfiles(prev => ({ ...prev, [id]: p })); }} />
    </ToastProvider></I18nProvider>
  );
}

function pinta(guardadas: Record<string, DianaProfile> = DE_ANTES) {
  const alGuardar = vi.fn<(id: string, p: DianaProfile) => void>();
  render(<Pantalla guardadas={guardadas} alGuardar={alGuardar} />);
  fireEvent.change(screen.getByLabelText('Alumno'), { target: { value: 's1' } });
  return alGuardar;
}
const elegir = (periodo: RegExp) => fireEvent.click(screen.getByRole('button', { name: periodo }));
const estado = () => document.querySelector('.dn-estado')!.textContent!;
/** Cuántos sectores tienen nivel, leído de la cabecera del alumno («2/6 competencias evaluadas»). */
const evaluadas = () => document.body.textContent!.match(/(\d)\/6 competencias evaluadas/)![1];

describe('la Diana competencial por evaluación', () => {
  it('se abre en la evaluación de hoy, sin la Diana del curso, y dice dónde está lo guardado', () => {
    pinta();
    expect(screen.getByRole('button', { name: /2ª evaluación/, pressed: true })).toBeTruthy();
    expect(estado()).toContain('Diana de la 2.ª evaluación');
    expect(estado()).toContain('Sin guardar todavía');
    expect(estado()).toContain('Cuenta 1 evaluación de este alumno hecha en la 2.ª evaluación.');
    expect(evaluadas()).toBe('0');
    // La Diana de siempre no se ha perdido: está en «Curso», a un toque
    fireEvent.click(screen.getByRole('button', { name: /todo el curso/ }));
    expect(screen.getByRole('button', { name: /Final de curso/, pressed: true })).toBeTruthy();
    expect(estado()).toContain('Diana de todo el curso');
    expect(estado()).toContain('Guardada el 12 nov');
    expect(evaluadas()).toBe('1');
    expect(screen.getByText('La de siempre')).toBeTruthy();
  });

  it('se rellena solo con las evaluaciones de sus fechas', () => {
    pinta();
    // En la 2.ª solo cuenta la de febrero: STEM 4, y nada de Digital
    fireEvent.click(screen.getByRole('button', { name: /Rellenar desde evaluaciones/ }));
    expect(evaluadas()).toBe('1');
    expect(screen.getByText('Calculado a partir de: STEM 4 («Mercado»)')).toBeTruthy();
    // En la 1.ª, la de octubre: STEM 1 y Digital 2
    elegir(/^1ª evaluación/);
    expect(evaluadas()).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: /Rellenar desde evaluaciones/ }));
    expect(evaluadas()).toBe('2');
    expect(screen.getByText('Calculado a partir de: STEM 1 («Mercado»)')).toBeTruthy();
    // En la 3.ª no hay nada, y lo dice con lo que hay en el curso
    elegir(/^3ª evaluación/);
    expect(estado()).toContain('No hay evaluaciones de este alumno en la 3.ª evaluación. En todo el curso tiene 2.');
  });

  it('cada evaluación guarda la suya: ni pisa la del curso ni la de otra evaluación', () => {
    const alGuardar = pinta();
    fireEvent.click(screen.getByRole('button', { name: /Rellenar desde evaluaciones/ }));
    expect(estado()).toContain('Con cambios sin guardar');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    const [id, perfil] = alGuardar.mock.calls[0];
    expect(id).toBe('s1');
    // La del curso sigue como estaba, y la de la 2.ª va aparte
    expect(perfil.scores).toEqual({ ds2: 3 });
    expect(perfil.descriptors).toEqual({ ds2: 'La de siempre' });
    expect(perfil.updated).toBe('2026-11-12');
    expect(perfil.porEvaluacion?.['2026-2'].scores.ds2).toBe(4);
    expect(perfil.porEvaluacion?.['2026-2'].updated).toBe('2027-02-15');
    expect(estado()).toContain('Guardada el 15 feb');
    // Ahora la 1.ª
    elegir(/^1ª evaluación/);
    fireEvent.click(screen.getByRole('button', { name: /Rellenar desde evaluaciones/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    const segundo = alGuardar.mock.calls[1][1];
    expect(segundo.porEvaluacion?.['2026-1'].scores.ds2).toBe(1);
    expect(segundo.porEvaluacion?.['2026-2'].scores.ds2).toBe(4);
    expect(segundo.scores).toEqual({ ds2: 3 });
    // Y al volver a la 2.ª se ve la suya
    elegir(/^2ª evaluación/);
    expect(estado()).toContain('Guardada el 15 feb');
    expect(screen.getByText('Calculado a partir de: STEM 4 («Mercado»)')).toBeTruthy();
  });

  it('lo que se deja a medias al mirar otra evaluación u otro alumno sigue ahí al volver', () => {
    pinta();
    fireEvent.click(screen.getByRole('button', { name: /Rellenar desde evaluaciones/ }));
    elegir(/^Final de curso/);
    expect(estado()).toContain('Guardada el 12 nov');
    fireEvent.change(screen.getByLabelText('Alumno'), { target: { value: 's2' } });
    expect(evaluadas()).toBe('0');
    fireEvent.change(screen.getByLabelText('Alumno'), { target: { value: 's1' } });
    elegir(/^2ª evaluación/);
    expect(estado()).toContain('Con cambios sin guardar');
    expect(screen.getByText('Calculado a partir de: STEM 4 («Mercado»)')).toBeTruthy();
  });

  it('en «Curso» todo queda como antes: cuentan todas las evaluaciones y se guarda la Diana de siempre', () => {
    const alGuardar = pinta({});
    elegir(/^Final de curso/);
    expect(estado()).toContain('2 evaluaciones disponibles');
    fireEvent.click(screen.getByRole('button', { name: /Rellenar desde evaluaciones/ }));
    // STEM 1 y 4: media 2,5, que sube a 3; Digital, 2
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    const perfil = alGuardar.mock.calls[0][1];
    expect(perfil.scores.ds2).toBe(3);
    expect(perfil.scores.ds3).toBe(2);
    expect(perfil.porEvaluacion).toBeUndefined();
  });
});
