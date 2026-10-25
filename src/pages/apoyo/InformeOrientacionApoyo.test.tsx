// @vitest-environment jsdom
/**
 * El informe del orientador: se pega, la IA propone, el docente revisa y guarda en la ficha; de ahí salen los programas.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InformeOrientacionApoyo } from './InformeOrientacionApoyo';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import { APOYO_VACIO } from '../../lib/apoyo';
import type { AlumnoApoyo, ApoyoData } from '../../types/apoyo';

const analizar = vi.hoisted(() => vi.fn());
const proponer = vi.hoisted(() => vi.fn());
vi.mock('../../services/gemini', async importOriginal => ({ ...await importOriginal<typeof import('../../services/gemini')>(), hasApiKey: () => true }));
vi.mock('../../services/informeOrientacion', async importOriginal => ({ ...await importOriginal<typeof import('../../services/informeOrientacion')>(), analizarInforme: analizar }));
vi.mock('../../services/apoyoIA', async importOriginal => ({ ...await importOriginal<typeof import('../../services/apoyoIA')>(), proponerObjetivos: proponer }));

afterEach(() => { cleanup(); analizar.mockReset(); proponer.mockReset(); });

const alumno: AlumnoApoyo = { id: 'a', nombre: 'Alumno 1', claseOrigen: '3º B', categorias: [], diagnostico: '', necesidades: '', notas: '' };

function montar(inicial: ApoyoData) {
  let datos = inicial;
  const onChange = vi.fn((f: (d: ApoyoData) => ApoyoData) => { datos = f(datos); });
  const vista = () => (
    <I18nProvider><ToastProvider>
      <InformeOrientacionApoyo alumno={datos.alumnos[0]} data={datos} onChange={onChange} especialidades={['PT']} comunidad="comunitat-valenciana" onNav={() => {}} />
    </ToastProvider></I18nProvider>
  );
  const r = render(vista());
  return { onChange, actual: () => datos, repintar: () => r.rerender(vista()) };
}

describe('Informe del orientador', () => {
  it('pega el informe, la IA propone, se guarda en la ficha y se crean los programas con sus objetivos', async () => {
    const lectoescritura = 'Programa personalizado para el aprendizaje de la lectura y la escritura';
    analizar.mockResolvedValue({
      categorias: [], diagnostico: 'Dislexia', necesidades: 'Necesita lectura adaptada.', fortalezas: 'Buena memoria visual', orientaciones: 'Textos cortos',
      ambitos: [lectoescritura],
      objetivos: [{ id: 'oo1', texto: 'Reconocer las letras del abecedario', ambito: lectoescritura, trimestres: [1], origen: 'informe' }],
    });
    proponer.mockResolvedValue([{ texto: 'Leer sílabas directas', trimestres: [1, 2], criterios: [] }]);
    const m = montar({ ...APOYO_VACIO, alumnos: [alumno] });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Subir o pegar el informe/ }));
    await user.type(screen.getByLabelText(/O pega aquí su texto/), 'Informe de Alumno 1');
    await user.click(screen.getByRole('button', { name: /Leer con IA/ }));
    expect(analizar).toHaveBeenCalledTimes(1);
    expect((await screen.findByLabelText('Diagnóstico') as HTMLInputElement).value).toBe('Dislexia');
    await user.click(screen.getByRole('button', { name: /Guardar en su ficha/ }));

    const a = m.actual().alumnos[0];
    expect(a.diagnostico).toBe('Dislexia');
    expect(a.informe).toMatchObject({ fortalezas: 'Buena memoria visual', orientaciones: 'Textos cortos', ambitos: [lectoescritura] });
    // El objetivo que plantea el informe se guarda entre los de la orientación
    expect(a.objetivosOrientacion).toMatchObject([{ texto: 'Reconocer las letras del abecedario', ambito: lectoescritura, origen: 'informe' }]);
    // El informe en sí no se guarda en ninguna parte
    expect(JSON.stringify(m.actual())).not.toContain('Informe de Alumno 1');

    m.repintar();
    await user.click(await screen.findByRole('button', { name: /Crear sus programas con IA/ }));
    const dialogo = screen.getAllByRole('dialog').find(d => within(d).queryByText(/Programas que se crean/))!;
    await user.click(within(dialogo).getByRole('button', { name: /Crear con IA/ }));
    await vi.waitFor(() => expect(m.actual().programas).toHaveLength(1));
    expect(m.actual().programas[0]).toMatchObject({ alumnoId: 'a', ambito: lectoescritura, especialidad: 'PT' });
    // Primero el objetivo del informe, tal cual; después el que propone la IA
    expect(m.actual().programas[0].objetivos.map(o => [o.texto, o.origen])).toEqual([['Reconocer las letras del abecedario', 'informe'], ['Leer sílabas directas', 'ia']]);
    // A la IA se le pide que complete, sin repetir el del informe
    expect(proponer.mock.calls[0][0].actuales.map((o: { texto: string }) => o.texto)).toEqual(['Reconocer las letras del abecedario']);
  });

  it('los objetivos que indica la orientadora, aunque no estén en el informe, se añaden a mano y pasan a su programa', async () => {
    const lectoescritura = 'Programa personalizado para el aprendizaje de la lectura y la escritura';
    const m = montar({ ...APOYO_VACIO, alumnos: [alumno] });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Objetivo que indica la orientadora'), 'Pedir ayuda cuando no entiende{Enter}');
    expect(m.actual().alumnos[0].objetivosOrientacion).toMatchObject([{ texto: 'Pedir ayuda cuando no entiende', origen: 'orientacion', trimestres: [1, 2, 3] }]);
    m.repintar();
    await user.selectOptions(screen.getByLabelText('Programa'), lectoescritura);
    m.repintar();
    await user.click(screen.getByRole('button', { name: /Pasar 1 objetivo a su programa/ }));
    expect(m.actual().programas).toMatchObject([{ ambito: lectoescritura, objetivos: [{ texto: 'Pedir ayuda cuando no entiende', origen: 'orientacion' }] }]);
    m.repintar();
    expect(screen.getByText('En su programa')).toBeTruthy();
  });
});
