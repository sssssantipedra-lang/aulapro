// @vitest-environment jsdom
/**
 * Decisión del dueño (31-10-2026): no se pueden guardar dos alumnos con el mismo nombre en la misma clase (sin
 * distinguir mayúsculas ni tildes). Para la IA serían el mismo código y se mezclarían sus datos.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClassesManager } from './ClassesManager';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { Class, Student } from '../types';

afterEach(cleanup);

const clase = { id: 'c1', name: '5º A', subject: 'Matemáticas', subjects: ['Matemáticas'], etapa: 'primaria', curso: 5 } as Class;
const otra = { ...clase, id: 'c2', name: '5º B' } as Class;
const alumno = (id: string, name: string, class_id = 'c1'): Student => ({ id, class_id, name, email: '', photo: null, alerts: [], notes: '' });

function setup(students: Student[]) {
  const onAddStudent = vi.fn();
  const onAddStudents = vi.fn();
  render(
    <I18nProvider>
      <ToastProvider>
        <ClassesManager
          classes={[clase]} students={students} evaluations={[]} rubrics={[]}
          onAddClass={() => {}} onUpdateClass={() => {}} onDeleteClass={() => {}}
          onAddStudent={onAddStudent} onUpdateStudent={() => {}} onDeleteStudent={() => {}}
          onAddStudents={onAddStudents} onOpenEval={() => {}} profileId="p1" comunidad="galicia"
        />
      </ToastProvider>
    </I18nProvider>,
  );
  return { onAddStudent, onAddStudents };
}

describe('nombres repetidos en una clase', () => {
  it('no deja guardar un alumno que se llama igual que otro de la clase, aunque cambien mayúsculas o tildes', async () => {
    const user = userEvent.setup();
    const { onAddStudent } = setup([alumno('s1', 'Ana López')]);
    await user.click(screen.getByRole('button', { name: /Nuevo alumno/ }));
    await user.type(screen.getByPlaceholderText('Nombre completo'), 'ana lopez');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onAddStudent).not.toHaveBeenCalled();
    expect(await screen.findByText(/Ya hay un alumno que se llama «Ana López» en esta clase/)).toBeTruthy();

    // Con una inicial, sí
    await user.type(screen.getByPlaceholderText('Nombre completo'), ' R.');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onAddStudent).toHaveBeenCalledWith(expect.objectContaining({ name: 'ana lopez R.', class_id: 'c1' }));
  });

  it('el mismo nombre en otra clase sí se puede', async () => {
    const user = userEvent.setup();
    const { onAddStudent } = setup([alumno('s1', 'Ana López', otra.id)]);
    await user.click(screen.getByRole('button', { name: /Nuevo alumno/ }));
    await user.type(screen.getByPlaceholderText('Nombre completo'), 'Ana López');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onAddStudent).toHaveBeenCalled();
  });

  it('al importar, se saltan los que ya están en la clase y los repetidos en lo pegado, y lo dice', async () => {
    const user = userEvent.setup();
    const { onAddStudents } = setup([alumno('s1', 'Ana López')]);
    await user.click(screen.getByRole('button', { name: /Importar CSV/ }));
    fireEvent.change(screen.getByLabelText('Datos CSV'), { target: { value: 'Nombre,Email\nAna López,\nMarco Gil,\nmarco gil,' } });
    await user.click(screen.getByRole('button', { name: 'Importar' }));
    expect(onAddStudents).toHaveBeenCalledTimes(1);
    expect(onAddStudents.mock.calls[0][0].map((s: Student) => s.name)).toEqual(['Marco Gil']);
    expect(await screen.findByText(/ya hay alguien con ese nombre en la clase: Ana López, marco gil/)).toBeTruthy();
  });
});
