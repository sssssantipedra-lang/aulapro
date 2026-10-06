// @vitest-environment jsdom
/**
 * Sesiones: la IA prepara una sesión para una clase y un día, con las
 * limitaciones de ese día sin nombres; se revisa y se guarda. La demo trae
 * una sesión para mañana.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EfSesiones } from './EfSesiones';
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
        <EfSesiones classes={demo.classes} students={demo.students} scheduleBlocks={demo.blocks} ef={ef}
          onChangeEf={f => setEf(d => { ultimo = f(d); return ultimo; })} comunidad="comunitat-valenciana" />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  ultimo = demo.ef;
  callGemini.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 5, 9, 0));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Sesiones', () => {
  it('la IA prepara la sesión con las limitaciones de hoy, sin nombres, y se guarda tras revisarla', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText('Voleibol: el toque de dedos')).toBeTruthy();

    callGemini.mockResolvedValue(JSON.stringify({
      titulo: 'Bádminton: el clear', objetivo: 'Golpear alto y profundo.', calentamiento: 'Movilidad (10 min)',
      principal: 'Clear por parejas (25 min)', calma: 'Estiramientos (10 min)', material: 'Raquetas y volantes',
      inclusion: 'No puede correr: juega en un campo más estrecho.', planB: 'En el porche, con globos.',
    }));
    await user.click(screen.getByRole('button', { name: /Preparar con IA/ }));
    // 1º ESO A el lunes 5 de octubre de 2026: 55 minutos en el horario, y un lesionado
    expect((screen.getByLabelText('Minutos') as HTMLInputElement).value).toBe('55');
    expect(screen.getByText(/Ese día hay un alumno o alumna con alguna limitación/)).toBeTruthy();
    await user.type(screen.getByLabelText('Qué quieres trabajar'), 'el clear de bádminton');
    await user.click(screen.getByRole('button', { name: /Preparar la sesión/ }));

    const prompt = callGemini.mock.calls[0][1] as string;
    expect(prompt).toContain('No puede correr, No puede saltar');
    expect(prompt).not.toMatch(/Alumno 4|esguince/i);
    expect(prompt).toContain('Duración de la sesión: 55 minutos');

    expect((await screen.findByLabelText('Título') as HTMLInputElement).value).toBe('Bádminton: el clear');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    const s = ultimo.sesiones.find(x => x.titulo === 'Bádminton: el clear');
    expect(s).toMatchObject({ claseId: 'ef-c1', fecha: '2026-10-05', ia: true, planB: 'En el porche, con globos.' });
  });
});
