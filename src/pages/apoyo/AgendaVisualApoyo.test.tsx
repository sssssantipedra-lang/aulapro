// @vitest-environment jsdom
/**
 * Agenda visual: se crea desde una plantilla, se le añaden pictogramas
 * buscándolos, se guarda y se enseña paso a paso a pantalla completa.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgendaVisualApoyo } from './AgendaVisualApoyo';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import { APOYO_VACIO } from '../../lib/apoyo';
import type { ApoyoData } from '../../types/apoyo';

let ultimo: ApoyoData = APOYO_VACIO;
function Harness({ inicial = APOYO_VACIO }: { inicial?: ApoyoData }) {
  const [data, setData] = useState(inicial);
  return (
    <I18nProvider>
      <ToastProvider>
        <AgendaVisualApoyo data={data} onChange={f => setData(d => { ultimo = f(d); return ultimo; })} />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => { localStorage.clear(); ultimo = APOYO_VACIO; });
afterEach(cleanup);

describe('Agenda visual', () => {
  it('desde una plantilla, con un pictograma buscado, se guarda en orden', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Ir al baño' }));
    expect(screen.getAllByRole('textbox', { name: /Texto del paso/ }).map(i => (i as HTMLInputElement).value))
      .toEqual(['Ir al baño', 'Lavarse las manos', 'Secarse las manos', 'Clase']);

    await user.click(screen.getByRole('button', { name: 'Añadir paso' }));
    const dialogo = screen.getByRole('dialog');
    await user.type(within(dialogo).getByRole('textbox', { name: 'Buscar un pictograma' }), 'contenta');
    await user.click(within(dialogo).getByRole('button', { name: 'Contenta' }));
    expect(within(dialogo).getByRole('status').textContent).toBe('1 paso añadido');
    await user.click(within(dialogo).getByRole('button', { name: /Listo/ }));

    // Lo pasa delante del último
    const botonesAntes = screen.getAllByRole('button', { name: 'Antes' });
    await user.click(botonesAntes[botonesAntes.length - 1]);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(ultimo.agendas).toHaveLength(1);
    expect(ultimo.agendas[0].titulo).toBe('Ir al baño');
    expect(ultimo.agendas[0].pasos.map(p => p.picto)).toEqual(['toilet-go', 'wash-hands', 'dry-hands', 'happy-lady', 'class-room']);
  });

  it('se enseña a pantalla completa y se tacha cada paso al tocarlo', async () => {
    const user = userEvent.setup();
    render(<Harness inicial={{ ...APOYO_VACIO, agendas: [{ id: 'a', titulo: 'Mañana', pasos: [
      { id: 'p1', picto: 'hello', texto: 'Hola' }, { id: 'p2', picto: 'sit', texto: 'Sentarse' },
    ] }] }} />);
    await user.click(screen.getByRole('button', { name: /Mostrar/ }));
    const show = screen.getByRole('dialog', { name: 'Mañana' });
    const hola = within(show).getByRole('button', { name: 'Hola' });
    expect(hola.className).toContain('ahora');
    await user.click(hola);
    expect(hola.getAttribute('aria-pressed')).toBe('true');
    expect(within(show).getByRole('button', { name: 'Sentarse' }).className).toContain('ahora');
    await user.click(within(show).getByRole('button', { name: /Volver a empezar/ }));
    expect(hola.getAttribute('aria-pressed')).toBe('false');
    await user.click(within(show).getByRole('button', { name: /Cerrar/ }));
    expect(screen.queryByRole('dialog', { name: 'Mañana' })).toBeNull();
  });
});
