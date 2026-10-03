// @vitest-environment jsdom
/**
 * Los criterios oficiales de un criterio de rúbrica, con el currículo real de
 * Madrid. Normalmente los pone la IA: aquí se ven, se quitan y, para añadir
 * otro, se busca (la lista entera no se muestra nunca).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CriteriosOficialesPicker } from './CriteriosOficialesPicker';
import { CompetenciasDelInstrumento } from './CompetenciasDelInstrumento';
import { I18nProvider } from '../../i18n';
import type { Class, OfficialCriterionRef } from '../../types';

afterEach(() => { cleanup(); localStorage.clear(); });

const QUINTO: Class = {
  id: 'c1', name: '5º A', subject: 'Matemáticas', subjects: ['Matemáticas', 'Naturales', 'Religión'], room: '', color: '#000',
  etapa: 'primaria', curso: 5,
};

let ultimo: OfficialCriterionRef[] = [];
function Selector({ cls, inicial = [] }: { cls: Class | null; inicial?: OfficialCriterionRef[] }) {
  const [v, setV] = useState<OfficialCriterionRef[]>(inicial);
  return (
    <>
      <CompetenciasDelInstrumento cls={cls} comunidad="madrid" refs={v} />
      <CriteriosOficialesPicker idPrefix="p" cls={cls} comunidad="madrid" value={v} onChange={n => { ultimo = n; setV(n); }} />
    </>
  );
}

describe('criterios oficiales de un criterio de rúbrica', () => {
  it('muestra los que puso la IA con su asignatura y su competencia, sin la lista entera', async () => {
    render(<I18nProvider><Selector cls={QUINTO} inicial={[{ materia: 'matematicas', codigo: '2.1' }]} /></I18nProvider>);
    const marcados = (await screen.findAllByText(/Matemáticas · CE2/))[0];
    expect(marcados).toBeTruthy();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    // Arriba, la competencia específica que trabaja
    expect(screen.getByText('Competencias específicas que trabaja')).toBeTruthy();
    expect(screen.getByText(/Resolver situaciones problematizadas/)).toBeTruthy();
  });

  it('para añadir otro, se busca; y se puede quitar cualquiera', async () => {
    const user = userEvent.setup();
    render(<I18nProvider><Selector cls={QUINTO} inicial={[{ materia: 'matematicas', codigo: '2.1' }]} /></I18nProvider>);
    await user.click(await screen.findByRole('button', { name: /Añadir otro criterio/ }));
    await user.type(screen.getByRole('searchbox', { name: 'Buscar un criterio oficial' }), 'naturaleza 3.1');
    const resultados = screen.getAllByRole('button').filter(b => b.textContent?.includes('3.1'));
    expect(resultados).toHaveLength(1);
    expect(within(resultados[0]).getByText(/Ciencias de la Naturaleza · CE3/)).toBeTruthy();
    await user.click(resultados[0]);
    expect(ultimo).toEqual([{ materia: 'matematicas', codigo: '2.1' }, { materia: 'ciencias-de-la-naturaleza', codigo: '3.1' }]);

    await user.click(screen.getByRole('button', { name: 'Quitar Matemáticas 2.1' }));
    expect(ultimo).toEqual([{ materia: 'ciencias-de-la-naturaleza', codigo: '3.1' }]);
  });

  it('sin clase, pide elegirla arriba', () => {
    render(<I18nProvider><Selector cls={null} /></I18nProvider>);
    expect(screen.getByText(/Elige arriba la clase/)).toBeTruthy();
  });
});
