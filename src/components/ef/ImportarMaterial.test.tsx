// @vitest-environment jsdom
/**
 * Importar el inventario de EF desde un documento: se ve lo leído, se marca lo
 * que se quiere y se vuelca al catálogo (lo nuevo se añade; lo que ya estaba
 * toma la cantidad). Un PDF no sale del equipo hasta que se elige leerlo con la IA.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportarMaterial } from './ImportarMaterial';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../ui/Toast';
import { buildDemoEF } from '../../lib/demoEF';
import type { EfData } from '../../types/ef';

const materialDesdeDocumento = vi.hoisted(() => vi.fn());
vi.mock('../../services/efIA', async importOriginal => ({ ...await importOriginal<typeof import('../../services/efIA')>(), materialDesdeDocumento }));
vi.mock('../../services/gemini', async importOriginal => ({ ...await importOriginal<typeof import('../../services/gemini')>(), hasApiKey: () => true }));

let ultimo: EfData;
const inicial: EfData = { ...buildDemoEF(new Date(2026, 9, 5)).ef, material: [{ id: 'm1', nombre: 'Balón de voleibol', cantidad: 5, estado: 'regular', ubicacion: 'Pabellón' }] };

function Harness() {
  const [ef, setEf] = useState(inicial);
  return (
    <I18nProvider><ToastProvider>
      <ImportarMaterial open onClose={() => {}} ef={ef} onChangeEf={f => setEf(d => { ultimo = f(d); return ultimo; })} />
    </ToastProvider></I18nProvider>
  );
}

beforeAll(() => {
  // jsdom no trae File.text()
  if (!File.prototype.text) File.prototype.text = function (this: File) { return new Promise<string>(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsText(this); }); };
});
afterEach(() => { cleanup(); materialDesdeDocumento.mockReset(); });

describe('Importar material de un documento', () => {
  it('un CSV se lee en el equipo, se marca lo que se quiere y se vuelca al inventario', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const csv = 'Material;Cantidad;Estado\nBalones de voleibol;12;Bien\nConos;30;Regular\nPetos;24;\n';
    await user.upload(screen.getByLabelText('Documento con el inventario'), new File([csv], 'inventario.csv', { type: 'text/csv' }));
    await screen.findByText('Conos');
    expect(screen.getByText('Ya está (5): se actualiza')).toBeTruthy();
    expect(screen.getAllByText('Nuevo')).toHaveLength(2);

    await user.click(screen.getByRole('checkbox', { name: 'Importar «Petos»' }));
    await user.click(screen.getByRole('button', { name: 'Añadir 2 materiales al catálogo' }));
    expect(materialDesdeDocumento).not.toHaveBeenCalled();
    expect(ultimo.material.map(m => [m.nombre, m.cantidad, m.estado])).toEqual([
      ['Balón de voleibol', 12, 'bien'], ['Conos', 30, 'regular'],
    ]);
  });

  it('un PDF no se envía a la IA hasta que se pide, y se vuelca lo que devuelve', async () => {
    const user = userEvent.setup();
    materialDesdeDocumento.mockResolvedValue([{ nombre: 'Aros', cantidad: 20 }]);
    render(<Harness />);
    await user.upload(screen.getByLabelText('Documento con el inventario'), new File(['%PDF-1.4'], 'inventario.pdf', { type: 'application/pdf' }));
    await screen.findByRole('button', { name: /Leer con la IA/ });
    expect(materialDesdeDocumento).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Leer con la IA/ }));
    await waitFor(() => expect(materialDesdeDocumento).toHaveBeenCalledOnce());
    await user.click(await screen.findByRole('button', { name: 'Añadir 1 material al catálogo' }));
    expect(ultimo.material.at(-1)).toMatchObject({ nombre: 'Aros', cantidad: 20, estado: 'bien' });
  });

  it('un formato raro avisa', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness />);
    await user.upload(screen.getByLabelText('Documento con el inventario'), new File(['x'], 'foto.png', { type: 'image/png' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
