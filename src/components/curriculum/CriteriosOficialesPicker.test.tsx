// @vitest-environment jsdom
/**
 * Marcar en un criterio de rúbrica los criterios oficiales que evalúa, con el
 * currículo real de Madrid: salen las asignaturas de la clase con materia
 * oficial, y se pueden marcar criterios de varias a la vez.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CriteriosOficialesPicker } from './CriteriosOficialesPicker';
import { I18nProvider } from '../../i18n';
import type { Class, OfficialCriterionRef } from '../../types';

afterEach(() => { cleanup(); localStorage.clear(); });

const QUINTO: Class = {
  id: 'c1', name: '5º A', subject: 'Matemáticas', subjects: ['Matemáticas', 'Naturales', 'Religión'], room: '', color: '#000',
  etapa: 'primaria', curso: 5,
};

let ultimo: OfficialCriterionRef[] = [];
function Selector({ cls }: { cls: Class | null }) {
  const [v, setV] = useState<OfficialCriterionRef[]>([]);
  return (
    <CriteriosOficialesPicker
      idPrefix="p" cls={cls} comunidad="madrid" value={v}
      onChange={n => { ultimo = n; setV(n); }}
    />
  );
}

describe('criterios oficiales de un criterio de rúbrica', () => {
  it('marca criterios de varias materias de la clase, y se pueden quitar', async () => {
    const user = userEvent.setup();
    render(<I18nProvider><Selector cls={QUINTO} /></I18nProvider>);
    await user.click(screen.getByText('Criterios oficiales que evalúa'));
    // «Naturales» es Ciencias de la Naturaleza en Madrid; Religión no tiene currículo
    expect(await screen.findByText('Ciencias de la Naturaleza')).toBeTruthy();
    expect(screen.queryByText('Religión')).toBeNull();

    await user.click(document.getElementById('p-matematicas-2.1')!);
    await user.click(document.getElementById('p-ciencias-de-la-naturaleza-1.1')!);
    expect(ultimo).toEqual([
      { materia: 'matematicas', codigo: '2.1' },
      { materia: 'ciencias-de-la-naturaleza', codigo: '1.1' },
    ]);

    await user.click(screen.getByRole('button', { name: 'Quitar Matemáticas 2.1' }));
    expect(ultimo).toEqual([{ materia: 'ciencias-de-la-naturaleza', codigo: '1.1' }]);
  });

  it('sin clase, pide elegirla primero', async () => {
    const user = userEvent.setup();
    render(<I18nProvider><Selector cls={null} /></I18nProvider>);
    await user.click(screen.getByText('Criterios oficiales que evalúa'));
    expect(screen.getByText(/Elige arriba la clase/)).toBeTruthy();
  });
});
