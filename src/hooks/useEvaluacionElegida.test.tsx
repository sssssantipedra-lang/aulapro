// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useEvaluacionElegida } from './useEvaluacionElegida';
import { SelectorEvaluacion } from '../components/SelectorEvaluacion';
import { I18nProvider } from '../i18n';

/** El cuaderno y las actas comparten la evaluación elegida y sus fechas (20-11-2026). */
describe('la evaluación elegida, común al cuaderno y a las actas', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 20, 10)); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('de entrada es la de hoy', () => {
    const { result } = renderHook(() => useEvaluacionElegida());
    expect(result.current.periodo).toBe('1ª evaluación');
    expect(result.current.deHoy).toBe('1ª evaluación');
    expect(result.current.rango).toEqual({ desde: '2026-09-01', hasta: '2026-12-31' });
    expect(result.current.cuenta('2026-10-10')).toBe(true);
    expect(result.current.cuenta('2027-02-10')).toBe(false);
  });

  it('lo que se elige en una pantalla es lo que abre la otra', () => {
    const cuaderno = renderHook(() => useEvaluacionElegida());
    act(() => cuaderno.result.current.elegir('Final de curso'));
    expect(cuaderno.result.current.rango).toBeNull();
    expect(cuaderno.result.current.cuenta('2027-02-10')).toBe(true);
    cuaderno.unmount();
    const actas = renderHook(() => useEvaluacionElegida());
    expect(actas.result.current.periodo).toBe('Final de curso');
  });

  it('dos pantallas montadas a la vez (el cuaderno y su pestaña de competencias) van siempre a la par', () => {
    const cuaderno = renderHook(() => useEvaluacionElegida());
    const competencias = renderHook(() => useEvaluacionElegida());
    act(() => competencias.result.current.elegir('2ª evaluación'));
    expect(cuaderno.result.current.periodo).toBe('2ª evaluación');
    act(() => cuaderno.result.current.cambiarRango({ desde: '2027-01-08', hasta: '2027-03-20' }));
    expect(competencias.result.current.rango).toEqual({ desde: '2027-01-08', hasta: '2027-03-20' });
    expect(competencias.result.current.cuenta('2027-01-05')).toBe(false);
    // La que se desmonta deja de escuchar
    competencias.unmount();
    act(() => cuaderno.result.current.elegir('Final de curso'));
    expect(cuaderno.result.current.periodo).toBe('Final de curso');
  });

  it('las fechas que se cambian en una valen en la otra, con las vecinas ajustadas', () => {
    const actas = renderHook(() => useEvaluacionElegida());
    act(() => actas.result.current.cambiarRango({ desde: '2026-09-08', hasta: '2026-12-04' }));
    expect(actas.result.current.rango).toEqual({ desde: '2026-09-08', hasta: '2026-12-04' });
    actas.unmount();
    const cuaderno = renderHook(() => useEvaluacionElegida());
    expect(cuaderno.result.current.rango).toEqual({ desde: '2026-09-08', hasta: '2026-12-04' });
    act(() => cuaderno.result.current.elegir('2ª evaluación'));
    expect(cuaderno.result.current.rango).toEqual({ desde: '2026-12-05', hasta: '2027-03-31' });
    // Un rango al revés no se guarda
    act(() => cuaderno.result.current.cambiarRango({ desde: '2027-03-01', hasta: '2027-01-01' }));
    expect(cuaderno.result.current.rango).toEqual({ desde: '2026-12-05', hasta: '2027-03-31' });
  });

  it('el selector enseña las cuatro, marca la de hoy y deja cambiar las fechas', () => {
    function Pantalla() {
      const ev = useEvaluacionElegida();
      return <><SelectorEvaluacion ev={ev} queCuenta="Lo que cuenta." /><output>{ev.periodo}</output></>;
    }
    render(<I18nProvider><Pantalla /></I18nProvider>);
    const botones = screen.getAllByRole('button').filter(b => b.hasAttribute('aria-pressed'));
    expect(botones.map(b => b.textContent)).toEqual(['1.ª', '2.ª', '3.ª', 'Curso']);
    expect(screen.getByRole('button', { name: '1ª evaluación (la de hoy)' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '2ª evaluación' }));
    expect(screen.getByRole('status').textContent).toBe('2ª evaluación');
    // Las fechas se abren con su botón y se cambian ahí mismo
    expect(screen.queryByLabelText('Último día de la evaluación')).toBeNull();
    fireEvent.click(screen.getByTitle('Cambiar las fechas de esta evaluación'));
    fireEvent.change(screen.getByLabelText('Último día de la evaluación'), { target: { value: '2027-03-19' } });
    expect((screen.getByLabelText('Último día de la evaluación') as HTMLInputElement).value).toBe('2027-03-19');
    // En «Curso» no hay fechas que cambiar
    fireEvent.click(screen.getByRole('button', { name: 'Final de curso' }));
    expect(screen.queryByTitle('Cambiar las fechas de esta evaluación')).toBeNull();
    expect(screen.getByText('Todo el curso')).toBeTruthy();
  });
});
