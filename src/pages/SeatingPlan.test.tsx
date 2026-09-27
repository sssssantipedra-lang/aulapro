// @vitest-environment jsdom
/**
 * Distribución de aula, montada de verdad: se sienta, se cambia y se levanta
 * a alumnos como lo haría el docente, y se comprueba lo que queda guardado.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SeatingPlan } from './SeatingPlan';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { Class, Student, SeatingPlan as Plan } from '../types';

afterEach(cleanup);

const cls = { id: 'c1', name: '4º ESO B' } as Class;
const alumno = (id: string, name: string) =>
  ({ id, class_id: 'c1', name, email: '', photo: null, alerts: [], notes: '' }) as Student;
const students = [alumno('s1', 'Ana López'), alumno('s2', 'Bruno Ruiz'), alumno('s3', 'Clara Soto')];

function Harness({ onPlan }: { onPlan?: (p: Plan) => void }) {
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  return (
    <I18nProvider>
      <ToastProvider>
        <SeatingPlan
          classes={[cls]} students={students}
          gradeCategories={[]} gradeItems={[]} grades={{}} attendance={{}}
          seatingPlans={plans}
          onSave={(id, p) => { setPlans(prev => ({ ...prev, [id]: p })); onPlan?.(p); }}
          onNav={() => {}}
        />
      </ToastProvider>
    </I18nProvider>
  );
}

const mesa = (n: number) => screen.getByText(`Mesa ${n}`).closest('.seat-table') as HTMLElement;

describe('Distribución de aula', () => {
  it('sin nadie sentado, todo el alumnado está en la bandeja', () => {
    render(<Harness />);
    expect(screen.getByText('3 sin mesa')).toBeTruthy();
    for (const s of students) expect(screen.getByRole('button', { name: new RegExp(s.name) })).toBeTruthy();
  });

  it('tocar un alumno y luego un asiento libre lo sienta, con su rol', async () => {
    const user = userEvent.setup();
    let last: Plan | undefined;
    render(<Harness onPlan={p => { last = p; }} />);

    await user.click(screen.getByRole('button', { name: /Ana López/ }));
    await user.click(within(mesa(1)).getAllByText('Sentar aquí')[0]);

    expect(last?.groups[0].studentIds[0]).toBe('s1');
    expect(within(mesa(1)).getByText('Ana López')).toBeTruthy();
    expect(within(mesa(1)).getByText('Portavoz')).toBeTruthy();
    expect(screen.getByText('2 sin mesa')).toBeTruthy();
  });

  it('la × devuelve al alumno a la bandeja', async () => {
    const user = userEvent.setup();
    let last: Plan | undefined;
    render(<Harness onPlan={p => { last = p; }} />);

    await user.click(screen.getByRole('button', { name: /Bruno Ruiz/ }));
    await user.click(within(mesa(2)).getAllByText('Sentar aquí')[0]);
    await user.click(within(mesa(2)).getByRole('button', { name: 'Quitar de la mesa' }));

    expect(last?.groups[1].studentIds.filter(Boolean)).toEqual([]);
    expect(screen.getByText('3 sin mesa')).toBeTruthy();
  });

  it('con todo el alumnado sentado, la bandeja desaparece y queda el aviso', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    for (const s of students) {
      await user.click(screen.getByRole('button', { name: new RegExp(s.name) }));
      await user.click(within(mesa(1)).getAllByText('Sentar aquí')[0]);
    }
    expect(screen.getByText('Todos sentados')).toBeTruthy();
    expect(screen.queryByText('Sin mesa asignada')).toBeNull();
  });

  it('sentar a alguien en un asiento ocupado devuelve al anterior a la bandeja', async () => {
    const user = userEvent.setup();
    let last: Plan | undefined;
    render(<Harness onPlan={p => { last = p; }} />);

    await user.click(screen.getByRole('button', { name: /Ana López/ }));
    await user.click(within(mesa(1)).getAllByText('Sentar aquí')[0]);
    await user.click(screen.getByRole('button', { name: /Clara Soto/ }));
    await user.click(within(mesa(1)).getByText('Ana López'));

    expect(last?.groups[0].studentIds[0]).toBe('s3');
    expect(screen.getByRole('button', { name: /Ana López/ })).toBeTruthy();
  });
});
