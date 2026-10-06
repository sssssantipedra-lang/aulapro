// @vitest-environment jsdom
/**
 * Material e instalaciones: se añade material, se cambia su estado desde la
 * tabla (y sale en «Para reponer») y se añade una instalación cubierta.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EfMaterial } from './EfMaterial';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import { EF_VACIO } from '../../lib/ef';
import type { EfData } from '../../types/ef';

let ultimo: EfData = EF_VACIO;
function Harness() {
  const [ef, setEf] = useState(EF_VACIO);
  return (
    <I18nProvider>
      <ToastProvider>
        <EfMaterial ef={ef} onChangeEf={f => setEf(d => { ultimo = f(d); return ultimo; })} />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => { localStorage.clear(); ultimo = EF_VACIO; });
afterEach(() => cleanup());

describe('Material e instalaciones', () => {
  it('añade material y una instalación cubierta, y avisa de lo que hay que reponer', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /Añadir material/ }));
    await user.type(screen.getByLabelText('Material'), 'Conos');
    await user.clear(screen.getByLabelText('Cantidad'));
    await user.type(screen.getByLabelText('Cantidad'), '30');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(ultimo.material[0]).toMatchObject({ nombre: 'Conos', cantidad: 30, estado: 'bien' });

    await user.selectOptions(screen.getByLabelText('Estado de Conos'), 'reponer');
    expect(ultimo.material[0].estado).toBe('reponer');
    expect(screen.getByText('Para reponer: Conos.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Añadir instalación/ }));
    await user.type(screen.getByLabelText('Nombre'), 'Pabellón');
    await user.click(screen.getByLabelText(/Es cubierta/));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(ultimo.instalaciones[0]).toMatchObject({ nombre: 'Pabellón', cubierta: true });
    expect(screen.getByText('Cubierta: sirve con lluvia')).toBeTruthy();
  });
});
