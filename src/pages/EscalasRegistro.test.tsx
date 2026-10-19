// @vitest-environment jsdom
/**
 * Escalas de registro: se crea una con un concepto, se valora a la clase con
 * pulgar arriba (bien hecho) o abajo (mejorable) y se guarda una evaluación
 * por alumno con su nota; pulsar otra vez el mismo pulgar lo quita.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EscalasRegistro } from './EscalasRegistro';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { Class, EvalDiana, Evaluation, Student } from '../types';

afterEach(cleanup);

const clases = ['4º A', '4º B'].map((name, i) => ({ id: `c${i + 1}`, name, subject: 'Educación Física', subjects: ['Educación Física'], color: '#000' }) as Class);
const alumnos: Student[] = [['s1', 'c1', 'Alumno 1'], ['s2', 'c1', 'Alumno 2'], ['s3', 'c2', 'Alumno 3']]
  .map(([id, class_id, name]) => ({ id, class_id, name, email: '', photo: null, alerts: [], notes: '' }) as Student);

const escala: EvalDiana = {
  id: 'reg1', tipo: 'registro', name: 'Saque de voleibol', class_id: 'c1', otras_clases: [{ class_id: 'c2' }],
  items: [{ id: 'i1', name: 'Golpea con la palma', weight: 1 }, { id: 'i2', name: 'Mira a la pelota', weight: 1 }],
};

function pinta(dianas: EvalDiana[] = [escala], evaluations: Evaluation[] = []) {
  const props = {
    onAddDiana: vi.fn(), onUpdateDiana: vi.fn(), onDeleteDiana: vi.fn(), onAddEvaluation: vi.fn(),
  };
  render(
    <I18nProvider><ToastProvider>
      <EscalasRegistro dianas={dianas} evaluations={evaluations} classes={clases} students={alumnos} gradeCategories={[]} {...props} />
    </ToastProvider></I18nProvider>,
  );
  return props;
}

describe('Escalas de registro', () => {
  it('sin ninguna, invita a crear la primera; las dianas de siempre no salen aquí', () => {
    pinta([{ id: 'd1', name: 'Una diana', items: [{ id: 'x', name: 'x', weight: 1 }] }]);
    expect(screen.getByText('Todavía no tienes ninguna escala de registro')).toBeTruthy();
    expect(screen.queryByText('Una diana')).toBeNull();
  });

  it('se crea con su concepto y sus clases', async () => {
    const user = userEvent.setup();
    const p = pinta([]);
    await user.click(screen.getAllByRole('button', { name: /Nueva escala|Crear la primera/ })[0]);
    await user.type(screen.getByLabelText('Nombre *'), 'Entrega a tiempo');
    await user.type(screen.getByLabelText('Concepto 1'), 'Trae la tarea');
    await user.selectOptions(screen.getByLabelText('Clase'), 'c1');
    await user.click(screen.getByRole('button', { name: 'Crear escala' }));
    expect(p.onAddDiana).toHaveBeenCalledOnce();
    expect(p.onAddDiana.mock.calls[0][0]).toMatchObject({ tipo: 'registro', name: 'Entrega a tiempo', class_id: 'c1', items: [{ name: 'Trae la tarea' }] });
  });

  it('se valora a la clase con pulgares y se guarda una evaluación por alumno, con su nota', async () => {
    const user = userEvent.setup();
    const p = pinta();
    await user.click(screen.getByRole('button', { name: /Valorar a la clase/ }));
    const ventana = within(document.querySelector('.modal-overlay.open') as HTMLElement);
    // Solo el alumnado de la clase elegida
    expect(ventana.getByText('Alumno 1')).toBeTruthy();
    expect(ventana.queryByText('Alumno 3')).toBeNull();

    await user.click(ventana.getByRole('button', { name: 'Alumno 1, Golpea con la palma: bien hecho' }));
    await user.click(ventana.getByRole('button', { name: 'Alumno 1, Mira a la pelota: mejorable' }));
    await user.click(ventana.getByRole('button', { name: 'Alumno 2, Golpea con la palma: mejorable' }));
    // Pulsar otra vez lo quita: el 2 solo queda con nada valorado
    await user.click(ventana.getByRole('button', { name: 'Alumno 2, Golpea con la palma: mejorable' }));
    await user.click(ventana.getByRole('button', { name: 'Guardar valoración' }));

    expect(p.onAddEvaluation).toHaveBeenCalledOnce();
    expect(p.onAddEvaluation.mock.calls[0][0]).toMatchObject({
      rubric_id: 'reg1', student_id: 's1', class_id: 'c1', instrument: 'diana', scores: { i1: 2, i2: 1 }, grade: 5,
    });
  });

  it('cambiar de clase enseña a sus alumnos, y lo ya valorado se recupera', async () => {
    const user = userEvent.setup();
    const previa: Evaluation = {
      id: 'e0', rubric_id: 'reg1', rubric_name: 'Saque de voleibol', student_id: 's3', student_name: 'Alumno 3', class_id: 'c2',
      date: '2026-10-01', scores: { i1: 2 }, notes: '', instrument: 'diana', grade: 10,
    };
    const p = pinta([escala], [previa]);
    await user.click(screen.getByRole('button', { name: /Valorar a la clase/ }));
    const ventana = within(document.querySelector('.modal-overlay.open') as HTMLElement);
    await user.selectOptions(ventana.getByLabelText('Clase'), 'c2');
    expect(ventana.getByText('Alumno 3')).toBeTruthy();
    expect(ventana.getByRole('button', { name: 'Alumno 3, Golpea con la palma: bien hecho' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(ventana.getByRole('button', { name: 'Guardar valoración' }));
    expect(p.onAddEvaluation).toHaveBeenCalledOnce();
    expect(p.onAddEvaluation.mock.calls[0][0]).toMatchObject({ student_id: 's3', class_id: 'c2', grade: 10 });
  });
});
