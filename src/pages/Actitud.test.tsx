// @vitest-environment jsdom
/**
 * Anotar actitud: la clase en una lista, un toque por anotación, sin sentar a
 * nadie antes. Se comprueba lo que queda guardado y que se puede deshacer.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Actitud } from './Actitud';
import { I18nProvider } from '../i18n';
import { requestActitud } from '../lib/actitudNav';
import { isoDate } from '../lib/utils';
import type { Class, Student, ClassMark } from '../types';

afterEach(cleanup);

const clases = [
  { id: 'c1', name: '1º ESO A', subject: 'Matemáticas', color: '#f00' },
  { id: 'c2', name: '2º ESO A', subject: 'Matemáticas', color: '#0f0' },
] as Class[];
const alumno = (id: string, name: string, class_id = 'c1') =>
  ({ id, class_id, name, email: '', photo: null, alerts: [], notes: '' }) as Student;
const students = [alumno('s10', 'Alumno 10'), alumno('s2', 'Alumno 2'), alumno('s9', 'Alumno 9', 'c2')];

function Harness({ onMarks }: { onMarks?: (m: ClassMark[]) => void }) {
  const [marks, setMarks] = useState<ClassMark[]>([]);
  const update = (next: ClassMark[]) => { setMarks(next); onMarks?.(next); };
  return (
    <I18nProvider>
      <Actitud
        classes={clases} students={students} classMarks={marks} marksConfigs={{}}
        attendance={{ c1: { [isoDate()]: { s10: 'absent' } } }}
        onAdd={m => update([...marks, m])}
        onDelete={id => update(marks.filter(m => m.id !== id))}
        onNav={() => {}}
      />
    </I18nProvider>
  );
}

const fila = (name: string) => screen.getByRole('group', { name }).closest('.act-row') as HTMLElement;

describe('Anotar actitud', () => {
  it('lista la clase en orden de lista y marca a quien tiene falta', () => {
    render(<Harness />);
    const nombres = [...document.querySelectorAll('.act-name > span:first-child')].map(e => e.textContent);
    expect(nombres).toEqual(['Alumno 2', 'Alumno 10']);
    expect(within(fila('Alumno 10')).getByText('Falta')).toBeTruthy();
  });

  it('un toque anota hoy, el contador sube y la flecha lo deshace', async () => {
    const user = userEvent.setup();
    let last: ClassMark[] = [];
    render(<Harness onMarks={m => { last = m; }} />);

    await user.click(within(fila('Alumno 2')).getByRole('button', { name: 'Participa' }));
    await user.click(within(fila('Alumno 2')).getByRole('button', { name: /Participa/ }));
    expect(last).toHaveLength(2);
    expect(last[0]).toMatchObject({ class_id: 'c1', student_id: 's2', type: 'participation', date: isoDate() });
    expect(within(fila('Alumno 2')).getByRole('button', { name: 'Participa, 2 hoy' })).toBeTruthy();

    await user.click(within(fila('Alumno 2')).getByRole('button', { name: 'Deshacer la última anotación de Alumno 2' }));
    expect(last).toHaveLength(1);
  });

  it('desde el Cuaderno se abre en la clase pedida', () => {
    requestActitud({ classId: 'c2' });
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Alumno 9' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Alumno 2' })).toBeNull();
  });
});
