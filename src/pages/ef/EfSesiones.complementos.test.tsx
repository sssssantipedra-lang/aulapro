// @vitest-environment jsdom
/**
 * Sesiones de EF: se adjunta un instrumento de evaluación que ya existe o se
 * crea una escala de registro ahí mismo, y se añade el circuito, ya dibujado
 * o nuevo con la pizarra de circuitos sin salir de la sesión.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EfSesiones } from './EfSesiones';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import { buildDemoEF } from '../../lib/demoEF';
import type { EfData } from '../../types/ef';
import type { EvalDiana, Rubric } from '../../types';

const demo = buildDemoEF(new Date(2026, 9, 5));
let ultimo: EfData = demo.ef;
const rubrica: Rubric = { id: 'r1', name: 'Rúbrica de juego limpio', criteria: [{ id: 'c1', name: 'Respeta las reglas', descriptors: { 1: 'a', 2: 'b', 3: 'c', 4: 'd' } }] };
const diana: EvalDiana = { id: 'd1', name: 'Diana de cooperación', items: [{ id: 'i1', name: 'Ayuda al equipo', weight: 1 }] };
const registro: EvalDiana = { id: 'g1', tipo: 'registro', name: 'Saque', items: [{ id: 'i2', name: 'Golpea con la palma', weight: 1 }] };
const onAddDiana = vi.fn();
const onNav = vi.fn();

function Harness({ inicial = demo.ef }: { inicial?: EfData }) {
  const [ef, setEf] = useState(inicial);
  const [dianas, setDianas] = useState<EvalDiana[]>([diana, registro]);
  return (
    <I18nProvider><ToastProvider>
      <EfSesiones classes={demo.classes} students={demo.students} scheduleBlocks={demo.blocks} ef={ef}
        onChangeEf={f => setEf(d => { ultimo = f(d); return ultimo; })} comunidad="comunitat-valenciana"
        rubrics={[rubrica]} dianas={dianas} onAddDiana={d => { onAddDiana(d); setDianas(x => [...x, d]); }} onNav={onNav} />
    </ToastProvider></I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear(); ultimo = demo.ef; onAddDiana.mockReset(); onNav.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 5, 9, 0));
  window.scrollTo = () => {};
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function nuevaSesion(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Nueva sesión/ }));
  await user.type(screen.getByLabelText('Título'), 'Voleibol: el saque');
}

describe('Sesiones de EF · evaluación y circuito', () => {
  it('se adjuntan instrumentos que ya existen, de uno en uno, y se guardan con la sesión', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    await nuevaSesion(user);
    await user.selectOptions(screen.getByLabelText('Instrumento que ya tienes'), 'rubrica:r1');
    await user.click(screen.getByRole('button', { name: /^Adjuntar$/ }));
    await user.selectOptions(screen.getByLabelText('Instrumento que ya tienes'), 'registro:g1');
    await user.click(screen.getByRole('button', { name: /^Adjuntar$/ }));
    expect(screen.getByText('Rúbrica de juego limpio')).toBeTruthy();
    expect(screen.getByText(/Escala de registro · Golpea con la palma/)).toBeTruthy();
    // Lo ya adjuntado no se ofrece otra vez
    const opciones = [...(screen.getByLabelText('Instrumento que ya tienes') as HTMLSelectElement).options].map(o => o.value);
    expect(opciones).toEqual(['', 'diana:d1']);

    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    const s = ultimo.sesiones.find(x => x.titulo === 'Voleibol: el saque')!;
    expect(s.instrumentos).toEqual([{ tipo: 'rubrica', id: 'r1' }, { tipo: 'registro', id: 'g1' }]);
  });

  it('se crea una escala de registro desde la sesión y queda adjunta, con la clase de la sesión', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    await nuevaSesion(user);
    await user.click(screen.getByRole('button', { name: /Crear una escala de registro/ }));
    await user.type(screen.getByLabelText('Nombre de la escala'), 'Técnica del saque');
    await user.type(screen.getByLabelText('Conceptos que se valoran, uno por línea'), 'Golpea con la palma{enter}Mira a la pelota');
    await user.click(screen.getByRole('button', { name: 'Crear y añadir' }));
    expect(onAddDiana).toHaveBeenCalledOnce();
    const d = onAddDiana.mock.calls[0][0] as EvalDiana;
    expect(d).toMatchObject({ tipo: 'registro', name: 'Técnica del saque', class_id: demo.classes[0].id });
    expect(d.items.map(i => i.name)).toEqual(['Golpea con la palma', 'Mira a la pelota']);
    expect(screen.getByText('Técnica del saque')).toBeTruthy();
  });

  it('«Crear una rúbrica» lleva a Evaluar y deja la sesión como borrador para continuar', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const r = render(<Harness />);
    await nuevaSesion(user);
    await user.click(screen.getByRole('button', { name: /Crear una rúbrica/ }));
    expect(onNav).toHaveBeenCalledWith('rubrics');
    r.unmount();
    render(<Harness />);
    expect(screen.getByText(/Te quedó una sesión sin guardar: «Voleibol: el saque»/)).toBeTruthy();
  });

  it('se dibuja un circuito nuevo con la pizarra de circuitos sin salir de la sesión, y queda en la sesión', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    await nuevaSesion(user);
    await user.click(screen.getByRole('button', { name: /Dibujar un circuito nuevo/ }));
    const ventana = within(await screen.findByRole('dialog', { name: 'Circuito de la sesión' }));
    await user.type(await ventana.findByLabelText('Nombre de la pizarra'), 'Circuito de saques');
    await user.click(ventana.getByRole('button', { name: /^Guardar$/ }));

    await waitFor(() => expect(ultimo.pizarras.some(p => p.nombre === 'Circuito de saques')).toBe(true));
    expect(await screen.findByAltText('Circuito «Circuito de saques»')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    const s = ultimo.sesiones.find(x => x.titulo === 'Voleibol: el saque')!;
    expect(s.pizarraId).toBe(ultimo.pizarras.find(p => p.nombre === 'Circuito de saques')!.id);
  });

  it('se adjunta un circuito que ya estaba dibujado y se puede quitar', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness inicial={{ ...demo.ef, pizarras: [{ id: 'p1', nombre: 'Estaciones', elementos: [], trazos: [] }] }} />);
    await nuevaSesion(user);
    await user.selectOptions(screen.getByLabelText('Circuito ya dibujado'), 'p1');
    expect(screen.getByAltText('Circuito «Estaciones»')).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: /Quitar de la sesión/ }).pop()!);
    expect(screen.queryByAltText('Circuito «Estaciones»')).toBeNull();
  });
});
