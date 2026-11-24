// @vitest-environment jsdom
/**
 * «Repartir con IA» (24-11-2026): sienta a todo el alumnado, también a quien estaba sin mesa, añade las mesas que
 * hagan falta y le pasa a la IA todo lo que el docente ha elegido. La IA se simula: lo que se prueba es qué se le pide
 * y cómo queda guardado.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Class, Student, SeatingPlan as Plan } from '../types';

const generar = vi.fn();
vi.mock('../services/classGroups', async importOriginal => ({
  ...(await importOriginal<typeof import('../services/classGroups')>()),
  generateBalancedGroups: (...a: unknown[]) => generar(...a),
}));
vi.mock('../services/gemini', async importOriginal => ({
  ...(await importOriginal<typeof import('../services/gemini')>()),
  hasApiKey: () => true,
}));

const { SeatingPlan } = await import('./SeatingPlan');
const { I18nProvider } = await import('../i18n');
const { ToastProvider } = await import('../components/ui/Toast');

afterEach(cleanup);
beforeEach(() => { generar.mockReset(); });

const cls = { id: 'c1', name: '4º ESO B' } as Class;
const alumnos = (n: number) => Array.from({ length: n }, (_, i) =>
  ({ id: `s${i + 1}`, class_id: 'c1', name: `Alumno ${i + 1}`, email: '', photo: null, alerts: [], notes: '' }) as Student);

function Harness({ students, inicial, onPlan }: { students: Student[]; inicial?: Plan; onPlan: (p: Plan) => void }) {
  const [plans, setPlans] = useState<Record<string, Plan>>(inicial ? { c1: inicial } : {});
  return (
    <I18nProvider>
      <ToastProvider>
        <SeatingPlan
          classes={[cls]} students={students}
          gradeCategories={[]} gradeItems={[]} grades={{}} attendance={{}}
          seatingPlans={plans}
          onSave={(id, p) => { setPlans(prev => ({ ...prev, [id]: p })); onPlan(p); }}
          onNav={() => {}} classMarks={[]} marksConfigs={{}} onAddMark={() => {}} onDeleteMark={() => {}}
        />
      </ToastProvider>
    </I18nProvider>
  );
}

/** La IA simulada: reparte a los que le piden en orden, llenando cada mesa hasta sus asientos libres. */
function iaQueReparte() {
  generar.mockImplementation(async (req: { students: { id: string }[]; mesas: { rolesLibres: unknown[] }[] }) => {
    const ids = req.students.map(s => s.id);
    return { grupos: req.mesas.map(m => ({ estudiantes: ids.splice(0, m.rolesLibres.length), justificacion: 'Equilibrada' })), sinAsignar: [] };
  });
}

describe('Repartir con IA', () => {
  it('con más alumnado que asientos, añade las mesas que faltan y sienta a todos', async () => {
    const user = userEvent.setup();
    iaQueReparte();
    let ultimo: Plan | undefined;
    render(<Harness students={alumnos(25)} onPlan={p => { ultimo = p; }} />);
    await user.click(screen.getByRole('button', { name: /Repartir con IA/ }));
    const v = screen.getAllByRole('dialog').find(d => d.closest('.modal-overlay.open'))!;
    expect(within(v).getByText(/se añadirán 2 mesas para que nadie se quede sin mesa/)).toBeTruthy();
    expect(within(v).getByText('Toda la clase: 25 alumnos')).toBeTruthy();
    expect(within(v).getByText(/7 mesas de 4 asientos/)).toBeTruthy();
    expect(within(v).getByText(/Roles de cada mesa: Portavoz, Secretario\/a, Responsable del material, Responsable del tiempo/)).toBeTruthy();
    await user.click(within(v).getByRole('button', { name: /Generar grupos con IA/ }));
    await waitFor(() => expect(ultimo?.numGroups).toBe(7));
    const req = generar.mock.calls[0][0];
    expect(req.students).toHaveLength(25);
    expect(req.mesas).toHaveLength(7);
    expect(req.roles.map((r: { name: string }) => r.name)).toEqual(['Portavoz', 'Secretario/a', 'Responsable del material', 'Responsable del tiempo']);
    expect(req.forma).toMatch(/Mesas cooperativas/);
    const sentados = ultimo!.groups.flatMap(g => g.studentIds.filter(Boolean));
    expect(new Set(sentados).size).toBe(25);
    await waitFor(() => expect(screen.getByText(/Todos sentados: se han añadido 2 mesas/)).toBeTruthy());
  });

  it('«sentar solo a los que faltan» deja a quien ya tiene mesa en su asiento', async () => {
    const user = userEvent.setup();
    iaQueReparte();
    let ultimo: Plan | undefined;
    const inicial: Plan = {
      class_id: 'c1', numGroups: 2, groupSize: 3, weekOffset: 0, updatedAt: '',
      roles: [{ id: 'r1', name: 'Portavoz', description: '' }, { id: 'r2', name: 'Secretario/a', description: '' }, { id: 'r3', name: 'Material', description: '' }],
      groups: [{ id: 'g1', label: 'Mesa 1', studentIds: ['s1', '', 's2'] }, { id: 'g2', label: 'Mesa 2', studentIds: [] }],
    };
    render(<Harness students={alumnos(5)} inicial={inicial} onPlan={p => { ultimo = p; }} />);
    await user.click(screen.getByRole('button', { name: /Repartir con IA/ }));
    const v = screen.getAllByRole('dialog').find(d => d.closest('.modal-overlay.open'))!;
    await user.click(within(v).getByRole('radio', { name: /sentar solo a los 3 que faltan/ }));
    expect(within(v).getByText('3 alumnos por sentar, en los asientos libres de cada mesa')).toBeTruthy();
    await user.click(within(v).getByRole('button', { name: /Generar grupos con IA/ }));
    await waitFor(() => expect(ultimo).toBeTruthy());
    const req = generar.mock.calls[0][0];
    expect(req.students.map((s: { id: string }) => s.id)).toEqual(['s3', 's4', 's5']);
    expect(req.mesas[0]).toEqual({ label: 'Mesa 1', sentados: ['s1', 's2'], rolesLibres: ['Secretario/a'] });
    expect(req.yaSentados.map((s: { id: string }) => s.id)).toEqual(['s1', 's2']);
    expect(ultimo!.groups[0].studentIds).toEqual(['s1', 's3', 's2']);
    expect(ultimo!.groups[1].studentIds).toEqual(['s4', 's5']);
  });
});
