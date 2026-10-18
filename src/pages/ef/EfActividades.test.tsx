// @vitest-environment jsdom
/**
 * Actividades: el banco de partida se filtra por tipo, una del banco se copia
 * para adaptarla y las de la IA (también las que redacta desde una foto) se
 * guardan en las del docente.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, within, fireEvent, waitFor } from '@testing-library/react';
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
// En jsdom no hay lienzo para reducir la foto: se da ya reducida
const FOTO = { name: 'foto.jpg', mimeType: 'image/jpeg', base64: 'QUJD' };
vi.mock('../../lib/fotos', async importOriginal => {
  const real = await importOriginal<typeof import('../../lib/fotos')>();
  return { ...real, fotoParaIA: async () => FOTO };
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
  it('se abre en una tarjeta por tipo, con cuántas hay, y cada una abre sus actividades también en tarjetas', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // La portada: seis tarjetas, sin la lista entera
    for (const tipo of ['Juegos motrices', 'Deportes', 'Para días de lluvia', 'En el medio natural', 'Calentamiento', 'Vuelta a la calma']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${tipo}`) })).toBeTruthy();
    }
    expect(screen.queryByText('Bolos con botellas', { selector: '.ef-act-card-ttl' })).toBeNull();
    expect(within(screen.getByRole('button', { name: /^Para días de lluvia/ })).getByText(/\d+ actividades/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /^Para días de lluvia/ }));
    expect(screen.getByText('Bolos con botellas', { selector: '.ef-act-card-ttl' })).toBeTruthy();
    expect(screen.queryByText('El pañuelo por números', { selector: '.ef-act-card-ttl' })).toBeNull();
    // Sin la ficha entera: se lee al tocar la tarjeta
    expect(screen.queryByText('Para que participe todo el grupo (DUA-A)')).toBeNull();
    await user.click(screen.getByRole('button', { name: /^Todas las actividades/ }));
    expect(screen.getByRole('button', { name: /^Juegos motrices/ })).toBeTruthy();
  });

  it('dentro de un tipo se filtra por modalidad (solo las que hay) y enseña su lógica y su preparación', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^Juegos motrices/ }));
    const modalidades = within(screen.getByRole('radiogroup', { name: 'Modalidad' }));
    expect(modalidades.queryByRole('radio', { name: 'Red y pared' })).toBeNull();
    await user.click(modalidades.getByRole('radio', { name: 'Lucha' }));
    expect(screen.getByText('Lucha de equilibrio por parejas', { selector: '.ef-act-card-ttl' })).toBeTruthy();
    expect(screen.getByText('Caídas y la tortuga', { selector: '.ef-act-card-ttl' })).toBeTruthy();
    expect(screen.queryByText('Bolos con botellas', { selector: '.ef-act-card-ttl' })).toBeNull();
    expect(screen.getByText(/caídas seguras \(rodar, amortiguar\) antes de cualquier lucha/)).toBeTruthy();
  });

  it('buscar recorre todas las actividades, sin entrar en un tipo', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('Buscar actividades'), 'bolos');
    expect(screen.getByText('Bolos con botellas', { selector: '.ef-act-card-ttl' })).toBeTruthy();
    // Con la búsqueda cada tarjeta dice de qué tipo es
    expect(within(screen.getByText('Bolos con botellas', { selector: '.ef-act-card-ttl' }).closest('button')!).getByText('Para días de lluvia')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Deportes/ })).toBeNull();
  });

  it('copia una del banco para adaptarla y guarda las de la IA', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^Para días de lluvia/ }));
    expect(screen.getByText('Bolos con botellas', { selector: '.ef-act-card-ttl' })).toBeTruthy();

    // Se lee la ficha entera al tocar la tarjeta, y de ahí se copia para adaptarla
    await user.click(screen.getByText('Bolos con botellas', { selector: '.ef-act-card-ttl' }));
    const ficha = screen.getByRole('dialog', { name: 'Bolos con botellas' });
    expect(within(ficha).getByText('Para que participe todo el grupo (DUA-A)')).toBeTruthy();
    await user.click(within(ficha).getByRole('button', { name: /Copiar y adaptar/ }));
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

  it('desde una foto: la IA dice lo que ve y redacta la actividad para la edad de la clase', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /Desde una foto/ }));
    const reconocer = screen.getByRole('button', { name: /Reconocer y redactar/ });
    expect((reconocer as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/No uses fotos en las que se reconozca a tu alumnado/)).toBeTruthy();
    expect(screen.getByText(/de 12 a 13 años/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Foto de la actividad'), { target: { files: [new File(['x'], 'voley.jpg', { type: 'image/jpeg' })] } });
    expect(await screen.findByAltText('La foto elegida')).toBeTruthy();

    callGemini.mockResolvedValue(JSON.stringify({
      visto: 'Un partido de voleibol.', esActividad: 'si', titulo: 'Voleibol 2 contra 2', tipo: 'deporte', modalidad: 'red-pared',
      descripcion: 'Dos parejas en un campo pequeño.', organizacion: 'Parejas', material: 'Balones blandos', variantes: 'Atrapar', inclusion: 'Sin saltar',
    }));
    await user.click(screen.getByRole('button', { name: /Reconocer y redactar/ }));
    expect(await screen.findByText('Un partido de voleibol.')).toBeTruthy();
    expect(callGemini.mock.calls[0][2]).toEqual([FOTO]);
    expect(callGemini.mock.calls[0][1]).toContain('(12 a 13 años)');
    await user.click(screen.getByRole('button', { name: /Guardar en mis actividades/ }));
    expect(ultimo.actividades[0]).toMatchObject({ titulo: 'Voleibol 2 contra 2', tipo: 'deporte', modalidad: 'red-pared', origen: 'ia' });
    expect(screen.queryByRole('button', { name: /Reconocer y redactar/ })).toBeNull();
  });

  it('desde una foto: si no se ve una actividad física, lo dice', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /Desde una foto/ }));
    fireEvent.change(screen.getByLabelText('Foto de la actividad'), { target: { files: [new File(['x'], 'taza.jpg', { type: 'image/jpeg' })] } });
    await screen.findByAltText('La foto elegida');
    callGemini.mockResolvedValue(JSON.stringify({ visto: 'Una taza de café.', esActividad: 'no', titulo: '', tipo: 'juego', modalidad: 'ninguna', descripcion: '', organizacion: '', material: '', variantes: '', inclusion: '' }));
    await user.click(screen.getByRole('button', { name: /Reconocer y redactar/ }));
    expect(await screen.findByText(/no se ve una actividad física/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Guardar en mis actividades/ })).toBeNull();
  });

  it('desde un manual en PDF: la IA las saca clasificadas y se guardan las que se elijan', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /Desde un manual/ }));
    const leer = screen.getByRole('button', { name: /Leer y clasificar/ });
    expect((leer as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/AulaPro no lo guarda/)).toBeTruthy();

    // Un archivo que no es PDF no se acepta
    fireEvent.change(screen.getByLabelText('Manual en PDF'), { target: { files: [new File(['x'], 'notas.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText('«notas.txt» no es un PDF.')).toBeTruthy();
    expect((leer as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Manual en PDF'), { target: { files: [new File(['x'], 'manual.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => expect((screen.getByRole('button', { name: /Leer y clasificar/ }) as HTMLButtonElement).disabled).toBe(false));
    const act = (titulo: string, tipo: string, modalidad: string) => ({
      titulo, tipo, modalidad, descripcion: 'Se juega en grupos.', organizacion: 'Grupos', material: 'Aros', variantes: 'Más lejos', inclusion: 'Con un papel',
    });
    callGemini.mockResolvedValue(JSON.stringify({ actividades: [
      act('Los aros musicales', 'juego', 'cooperacion'), act('Estiramientos en círculo', 'calma', 'ninguna'), act('Bolos con botellas', 'lluvia', 'blanco-diana'),
    ] }));
    await user.click(screen.getByRole('button', { name: /Leer y clasificar/ }));

    expect(await screen.findByText(/Clasificadas:/)).toBeTruthy();
    expect(callGemini.mock.calls[0][2][0]).toMatchObject({ name: 'manual.pdf', mimeType: 'application/pdf' });
    // Ya existe «Bolos con botellas» en el banco: sale avisada y sin marcar
    expect(screen.getByText('Ya tienes una con este título.')).toBeTruthy();
    expect((screen.getByLabelText('Guardar «Bolos con botellas»') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Guardar «Los aros musicales»') as HTMLInputElement).checked).toBe(true);

    await user.click(screen.getByLabelText('Guardar «Estiramientos en círculo»'));
    await user.click(screen.getByRole('button', { name: /Guardar 1 en mis actividades/ }));
    expect(ultimo.actividades).toHaveLength(demo.ef.actividades.length + 1);
    expect(ultimo.actividades[0]).toMatchObject({ titulo: 'Los aros musicales', tipo: 'juego', modalidad: 'cooperacion', origen: 'ia' });
    expect(screen.queryByRole('button', { name: /Leer y clasificar/ })).toBeNull();
  });
});
