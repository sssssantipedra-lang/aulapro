// @vitest-environment jsdom
/**
 * Las competencias clave de un criterio o ítem: las pone la IA y el docente
 * las marca o desmarca aquí. Arriba, el resumen de todo el instrumento.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CompetenciasClavePicker } from './CompetenciasClavePicker';
import { CompetenciasDelInstrumento } from './CompetenciasDelInstrumento';
import { I18nProvider } from '../../i18n';
import { competenciasClaveValidas } from '../../lib/utils';

afterEach(() => { cleanup(); localStorage.clear(); });

let ultimo: string[] = [];
function Editor({ inicial }: { inicial: string[] }) {
  const [v, setV] = useState(inicial);
  return (
    <>
      <CompetenciasDelInstrumento cls={null} comunidad="madrid" clave={v} refs={[]} />
      <CompetenciasClavePicker value={v} onChange={n => { ultimo = n; setV(n); }} />
    </>
  );
}

describe('competencias clave de un criterio', () => {
  it('las ocho, con las que puso la IA marcadas; se marcan y desmarcan', async () => {
    const user = userEvent.setup();
    render(<I18nProvider><Editor inicial={['STEM']} /></I18nProvider>);
    expect(screen.getAllByRole('button')).toHaveLength(8);
    const stem = screen.getByRole('button', { name: 'STEM, Matemática, ciencia, tecnología e ingeniería' });
    expect(stem.getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: /^CCL,/ }));
    expect(ultimo).toEqual(['CCL', 'STEM']); // en el orden oficial
    await user.click(stem);
    expect(ultimo).toEqual(['CCL']);
  });

  it('arriba, las del instrumento con su nombre, aunque la clase no tenga currículo oficial', () => {
    render(<I18nProvider><Editor inicial={['CPSAA', 'CCL']} /></I18nProvider>);
    expect(screen.getByText('Competencias clave que trabaja')).toBeTruthy();
    expect(screen.getByText('Comunicación lingüística')).toBeTruthy();
    expect(screen.getByText('Personal, social y de aprender a aprender')).toBeTruthy();
    expect(screen.queryByText('Competencias específicas que trabaja')).toBeNull();
  });

  it('sin ninguna, explica dónde saldrán', () => {
    render(<I18nProvider><Editor inicial={[]} /></I18nProvider>);
    expect(screen.getByText(/Saldrán aquí al marcar las competencias clave/)).toBeTruthy();
  });

  it('solo códigos de la LOMLOE, sin repetir y en orden', () => {
    expect(competenciasClaveValidas(['cd', 'CCL', 'CD', 'XX', 3])).toEqual(['CCL', 'CD']);
    expect(competenciasClaveValidas('CCL')).toEqual([]);
  });
});
