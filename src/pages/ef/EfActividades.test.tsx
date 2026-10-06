// @vitest-environment jsdom
/**
 * Actividades: el banco de partida se filtra por tipo, una del banco se copia
 * para adaptarla y las de la IA se guardan en las del docente.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EfActividades } from './EfActividades';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import { buildDemoEF } from '../../lib/demoEF';
import type { EfData } from '../../types/ef';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('../../services/gemini', async importOriginal => {
  const real = await importOriginal<typeof import('../../services/gemini')>();
  return { ...real, callGemini, hasApiKey: () => true };
});

const demo = buildDemoEF(new Date(2026, 9, 5));
let ultimo: EfData = demo.ef;
function Harness() {
  const [ef, setEf] = useState(demo.ef);
  return (
    <I18nProvider>
      <ToastProvider>
        <EfActividades classes={demo.classes} students={demo.students} ef={ef}
          onChangeEf={f => setEf(d => { ultimo = f(d); return ultimo; })} comunidad="madrid" />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => { localStorage.clear(); ultimo = demo.ef; callGemini.mockReset(); });
afterEach(() => cleanup());

describe('Actividades', () => {
  it('filtra por modalidad y enseña su lógica y su preparación', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('radio', { name: 'Lucha' }));
    expect(screen.getByText('Lucha de equilibrio por parejas')).toBeTruthy();
    expect(screen.getByText('Caídas y la tortuga')).toBeTruthy();
    expect(screen.queryByText('Bolos con botellas')).toBeNull();
    expect(screen.getByText(/caídas seguras \(rodar, amortiguar\) antes de cualquier lucha/)).toBeTruthy();
  });

  it('filtra el banco, copia una para adaptarla y guarda las de la IA', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('radio', { name: 'Para días de lluvia' }));
    expect(screen.getByText('Bolos con botellas')).toBeTruthy();
    expect(screen.queryByText('El pañuelo por números')).toBeNull();

    // Copiar y adaptar una del banco
    const bolos = screen.getByText('Bolos con botellas').closest('details')!;
    await user.click(within(bolos).getByText('Bolos con botellas'));
    await user.click(within(bolos).getByRole('button', { name: /Copiar y adaptar/ }));
    const titulo = screen.getByLabelText('Título');
    await user.clear(titulo);
    await user.type(titulo, 'Bolos del porche');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(ultimo.actividades[0]).toMatchObject({ titulo: 'Bolos del porche', tipo: 'lluvia', origen: 'propia' });

    // La IA
    callGemini.mockResolvedValue(JSON.stringify({ actividades: [
      { titulo: 'Puntería con aros', descripcion: 'Lanzar saquitos a aros.', organizacion: 'Por equipos', material: 'Aros', variantes: 'Más lejos', inclusion: 'Sentado' },
    ] }));
    await user.click(screen.getByRole('button', { name: /Proponer con IA/ }));
    await user.click(screen.getByRole('button', { name: /Proponer tres/ }));
    await user.click(await screen.findByRole('button', { name: /Guardar en mis actividades/ }));
    expect(ultimo.actividades[0]).toMatchObject({ titulo: 'Puntería con aros', tipo: 'lluvia', origen: 'ia' });
  });
});
