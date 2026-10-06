// @vitest-environment jsdom
/**
 * Niveles de respuesta II y III en EF: se marca el nivel y lo que necesita
 * cada alumno (uno por alumno, sin diagnóstico), se cambia y se quita.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EfApoyos } from './EfApoyos';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import { buildDemoEF } from '../../lib/demoEF';
import type { EfData } from '../../types/ef';

const demo = buildDemoEF(new Date(2026, 9, 5));
const nombre = (id: string) => demo.students.find(s => s.id === id)!.name;
let ultimo: EfData = demo.ef;
function Harness() {
  const [ef, setEf] = useState(demo.ef);
  return (
    <I18nProvider>
      <ToastProvider>
        <EfApoyos classes={demo.classes} students={demo.students} ef={ef} onChangeEf={f => setEf(d => { ultimo = f(d); return ultimo; })} />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => { localStorage.clear(); ultimo = demo.ef; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Niveles de respuesta II y III', () => {
  it('lista el alumnado con su nivel, añade uno con lo que necesita y quita otro', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const fila = screen.getByText(nombre('ef-s05')).closest('li')!;
    expect(within(fila).getByText('Nivel III')).toBeTruthy();
    expect(within(fila).getByText(/Instrucciones cortas, de una en una/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Añadir alumno/ }));
    // Quien ya tiene nivel no se puede elegir otra vez
    const select = screen.getByLabelText('Alumno o alumna') as HTMLSelectElement;
    expect([...select.options].map(o => o.value)).not.toContain('ef-s05');
    await user.selectOptions(select, 'ef-s20');
    await user.click(screen.getByRole('radio', { name: /Nivel II: Medidas generales del grupo-clase/ }));
    await user.click(screen.getByRole('button', { name: 'Más tiempo y su propio ritmo' }));
    await user.type(screen.getByLabelText('Otra necesidad'), 'le cuesta esperar su turno');
    expect(screen.getByText(/No escribas aquí el diagnóstico/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(ultimo.apoyos.find(a => a.alumnoId === 'ef-s20')).toMatchObject({ nivel: 2, necesidades: ['tiempo'], otra: 'le cuesta esperar su turno' });

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: `Editar «${nombre('ef-s12')}»` }));
    await user.click(screen.getByRole('button', { name: /Quitar/ }));
    expect(ultimo.apoyos.some(a => a.alumnoId === 'ef-s12')).toBe(false);
    expect(ultimo.apoyos).toHaveLength(2);
  });
});
