// @vitest-environment jsdom
/**
 * Sesiones y situaciones de aprendizaje (21-10-2026): las sesiones de una clase
 * se agrupan por su SdA, se asocian a una que ya existe (una a una o varias a la
 * vez) o se crea una SdA nueva con ellas; el docente de aula usa la misma
 * pantalla, con inicio, desarrollo y cierre.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sesiones } from './Sesiones';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import { EF_VACIO } from '../lib/ef';
import type { Class, LearningSituation } from '../types';
import type { EfData, SesionEF } from '../types/ef';
import type { SdaContent } from '../services/learningSituations';

const generateSda = vi.hoisted(() => vi.fn());
vi.mock('../services/learningSituations', async importOriginal => ({ ...await importOriginal<typeof import('../services/learningSituations')>(), generateSda }));
vi.mock('../services/gemini', async importOriginal => ({ ...await importOriginal<typeof import('../services/gemini')>(), hasApiKey: () => true }));

const clase = (id: string, name: string): Class => ({ id, name, subject: 'Matemáticas', subjects: ['Matemáticas'], room: '', color: '#0284c7', etapa: 'primaria', curso: 4 });
const clases = [clase('c1', '4º A'), clase('c2', '4º B')];
const ses = (id: string, titulo: string, extra: Partial<SesionEF> = {}): SesionEF =>
  ({ id, titulo, claseId: 'c1', objetivo: 'Objetivo de ' + titulo, calentamiento: '', principal: '', calma: '', material: '', inclusion: '', planB: '', ...extra });
const sda = (id: string, numero: string, title: string): LearningSituation =>
  ({ id, at: '2026-10-01', date: '2026-10-01', class_id: 'c1', class_name: '4º A', title, request: { numero } as LearningSituation['request'], content: {} as SdaContent });

let ultimo: EfData;
const guardadas: LearningSituation[] = [];
const abrirSda = vi.fn();

function Harness({ sesiones, sdas, perfil = 'aula' as const }: { sesiones: SesionEF[]; sdas: LearningSituation[]; perfil?: 'ef' | 'aula' }) {
  const [ef, setEf] = useState<EfData>({ ...EF_VACIO, sesiones });
  const [lista, setLista] = useState(sdas);
  return (
    <I18nProvider><ToastProvider>
      <Sesiones perfil={perfil} classes={clases} students={[]} scheduleBlocks={[]} ef={ef}
        onChangeEf={f => setEf(d => { ultimo = f(d); return ultimo; })} comunidad="comunitat-valenciana"
        learningSituations={lista} onSaveSda={s => { guardadas.push(s); setLista(l => [s, ...l]); }} onAbrirSda={abrirSda} />
    </ToastProvider></I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear(); guardadas.length = 0; generateSda.mockReset(); abrirSda.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 21, 9, 0));
  window.scrollTo = () => {};
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const base = [
  ses('s1', '1. Conocemos', { sdaId: 'a', sdaOrden: 1 }), ses('s2', '2. Practicamos', { sdaId: 'a', sdaOrden: 2 }),
  ses('s3', 'Repaso suelto'), ses('s4', 'Otra suelta'), ses('s5', 'De otra clase', { claseId: 'c2' }),
];

describe('Sesiones · situaciones de aprendizaje', () => {
  it('las sesiones de una clase salen agrupadas por su SdA, y las sueltas al final', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness sesiones={base} sdas={[sda('a', '1', 'Los números')]} />);
    await user.click(screen.getByRole('button', { name: 'Abrir las sesiones de 4º A' }));
    const titulos = screen.getAllByRole('button', { expanded: true }).map(b => b.textContent ?? '');
    expect(titulos[0]).toMatch(/1\. Los números/);
    expect(titulos[1]).toMatch(/Sin situación de aprendizaje/);
    expect(screen.queryByText('De otra clase')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Ver la SdA' }));
    expect(abrirSda).toHaveBeenCalledOnce();
  });

  it('varias sesiones se asocian a una SdA que ya existe, a continuación de las suyas', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness sesiones={base} sdas={[sda('a', '1', 'Los números')]} />);
    await user.click(screen.getByRole('button', { name: 'Abrir las sesiones de 4º A' }));
    await user.click(screen.getByRole('button', { name: 'Elegir varias' }));
    await user.click(screen.getByRole('checkbox', { name: 'Elegir «Otra suelta»' }));
    await user.click(screen.getByRole('checkbox', { name: 'Elegir «Repaso suelto»' }));
    await user.click(screen.getByRole('button', { name: 'Asociar a una SdA' }));
    const ventana = within(screen.getByRole('dialog'));
    await user.click(ventana.getByRole('radio', { name: /Los números/ }));
    await user.click(ventana.getByRole('button', { name: 'Asociar' }));
    // Se asocian en el orden en que se ven
    const unidas = ultimo.sesiones.filter(s => s.sdaId === 'a').sort((x, y) => (x.sdaOrden ?? 0) - (y.sdaOrden ?? 0)).map(s => [s.id, s.sdaOrden]);
    expect(unidas.slice(0, 2)).toEqual([['s1', 1], ['s2', 2]]);
    expect(unidas).toHaveLength(4);
    expect(unidas.map(u => u[1])).toEqual([1, 2, 3, 4]);
  });

  it('desde la sesión, el desplegable la asocia a una SdA o se la quita', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness sesiones={base} sdas={[sda('a', '1', 'Los números')]} />);
    await user.click(screen.getByRole('button', { name: 'Abrir las sesiones de 4º A' }));
    await user.click(screen.getByText('Repaso suelto'));
    await user.selectOptions(screen.getByLabelText('Situación de aprendizaje', { selector: '#ef-s-sda' }), 'a');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(ultimo.sesiones.find(s => s.id === 's3')).toMatchObject({ sdaId: 'a', sdaOrden: 3 });
    await user.click(screen.getByText('Repaso suelto'));
    await user.selectOptions(screen.getByLabelText('Situación de aprendizaje', { selector: '#ef-s-sda' }), '');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(ultimo.sesiones.find(s => s.id === 's3')).not.toHaveProperty('sdaId');
  });

  it('con las sesiones elegidas se crea una SdA, se guarda y quedan asociadas a ella', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    generateSda.mockResolvedValue({ titulo: 'Repasamos y cerramos', sesiones: [], areas: [] } as unknown as SdaContent);
    render(<Harness sesiones={base} sdas={[]} />);
    await user.click(screen.getByRole('button', { name: 'Abrir las sesiones de 4º A' }));
    await user.click(screen.getByRole('button', { name: 'Elegir varias' }));
    await user.click(screen.getByRole('checkbox', { name: 'Elegir «Repaso suelto»' }));
    await user.click(screen.getByRole('checkbox', { name: 'Elegir «Otra suelta»' }));
    await user.click(screen.getByRole('button', { name: 'Crear una SdA con ellas' }));
    await user.click(screen.getByRole('button', { name: 'Crear la situación de aprendizaje' }));
    await waitFor(() => expect(generateSda).toHaveBeenCalledOnce());
    const peticion = generateSda.mock.calls[0][0];
    expect(peticion.numSesiones).toBe(2);
    expect(peticion.sesionesBase.map((x: { titulo: string }) => x.titulo)).toEqual(['Repaso suelto', 'Otra suelta']);
    expect(peticion.ef).toBeUndefined();
    await screen.findByText(/Creada «Repasamos y cerramos»/);
    expect(guardadas[0]).toMatchObject({ title: 'Repasamos y cerramos', class_id: 'c1' });
    expect(ultimo.sesiones.filter(s => s.sdaId === guardadas[0].id).map(s => s.id).sort()).toEqual(['s3', 's4']);
    await user.click(screen.getByRole('button', { name: 'Abrirla en Situaciones de aprendizaje' }));
    expect(abrirSda).toHaveBeenCalledOnce();
  });

  it('el docente de aula tiene inicio, desarrollo y cierre, y nada de instalaciones, modalidad, circuito ni IA de EF', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness sesiones={base} sdas={[]} />);
    expect(screen.queryByRole('button', { name: /Preparar con IA/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Nueva sesión' }));
    expect(screen.getByLabelText('Inicio de la sesión')).toBeTruthy();
    expect(screen.getByLabelText('Desarrollo de la sesión')).toBeTruthy();
    expect(screen.getByLabelText('Cierre de la sesión')).toBeTruthy();
    expect(screen.getByLabelText('Medidas de inclusión (DUA)')).toBeTruthy();
    expect(screen.queryByLabelText('Instalación')).toBeNull();
    expect(screen.queryByLabelText('Modalidad del juego o deporte')).toBeNull();
    expect(screen.queryByText('Circuito')).toBeNull();
  });

  it('con el perfil de EF sigue teniendo sus nombres y su circuito', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness sesiones={base} sdas={[]} perfil="ef" />);
    await user.click(screen.getByRole('button', { name: 'Nueva sesión' }));
    expect(screen.getByLabelText('Calentamiento')).toBeTruthy();
    expect(screen.getByLabelText('Modalidad del juego o deporte')).toBeTruthy();
  });
});
