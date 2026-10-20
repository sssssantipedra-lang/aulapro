// @vitest-environment jsdom
/**
 * Una situación de aprendizaje para varias clases (20-10-2026), con la opción
 * de tener en cuenta las barreras de aprendizaje del alumnado: a la IA le
 * llegan sin nombres, y lo que se guarda dice para qué clases sirve.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LearningSituations } from './LearningSituations';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { Class, LearningSituation, Student } from '../types';

const contenido = vi.hoisted(() => ({
  titulo: 'Un huerto', justificacion: 'x', ods: '', objetivosEtapa: '', competenciasClave: '', explicacionCurricular: '',
  areas: [{ area: 'Mates', competenciasEspecificas: '', criteriosEvaluacion: '', saberesBasicos: '' }],
  inclusionUniversal: '', inclusionAdicional: '', inclusionIndividualizada: '',
  sesiones: [{ fase: 'Activación', titulo: 'a', descripcion: 'b' }],
  metodologia: '', agrupamiento: '', recursos: '', productoFinal: '', evaluacionTecnicas: '', evaluacionInstrumentos: '',
}));
const generateSda = vi.hoisted(() => vi.fn(async () => contenido));
vi.mock('../services/gemini', async importOriginal => ({ ...await importOriginal<typeof import('../services/gemini')>(), hasApiKey: () => true }));
vi.mock('../services/learningSituations', async importOriginal => ({ ...await importOriginal<typeof import('../services/learningSituations')>(), generateSda }));

afterEach(() => { cleanup(); generateSda.mockClear(); });
beforeAll(() => {
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} takeRecords() { return []; } root = null; rootMargin = ''; thresholds = []; } as unknown as typeof IntersectionObserver;
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const clase = (id: string, name: string): Class => ({ id, name, subject: 'Mates', subjects: ['Mates'], room: '', color: '#0284c7', etapa: 'primaria', curso: 5 });
const clases = [clase('c1', '5º A'), clase('c2', '5º B'), clase('c3', '5º C')];
const alumno = (id: string, class_id: string, name: string, ...avisos: string[]): Student => ({
  id, class_id, name, email: '', photo: null, notes: '', alerts: avisos.map((text, i) => ({ id: `${id}${i}`, text, level: 'warn' as const })),
});
const alumnado = [
  alumno('s1', 'c1', 'Marta Gil', 'Dislexia'),
  alumno('s2', 'c2', 'Pablo Ruiz', 'Marta necesita más tiempo'),
  alumno('s3', 'c3', 'Eva Sanz', 'No debe salir'),
];

async function abrir(onSave = vi.fn()) {
  const user = userEvent.setup();
  render(
    <I18nProvider><ToastProvider>
      <LearningSituations classes={clases} students={alumnado} gradeCategories={[]} learningSituations={[]} comunidad="galicia"
        onUpdateClass={() => {}} onSave={onSave} onDelete={() => {}} onAddRubric={() => {}} onAddDiana={() => {}} onAddFicha={() => {}} onNav={() => {}} />
    </ToastProvider></I18nProvider>,
  );
  await user.click(screen.getByRole('button', { name: /Crear la primera/ }));
  await user.type(screen.getByLabelText(/Idea de la situación de aprendizaje/), 'Un huerto');
  return { user, onSave };
}

describe('Situaciones de aprendizaje · varias clases y barreras', () => {
  it('se marcan varias clases y se guarda una sola situación que lo dice', async () => {
    const { user, onSave } = await abrir();
    await user.click(screen.getByRole('button', { name: '5º A' }));
    await user.click(screen.getByRole('button', { name: '5º B' }));
    expect(screen.getByRole('button', { name: '5º B' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '5º C' }).getAttribute('aria-pressed')).toBe('false');
    await user.click(screen.getByRole('button', { name: /Generar situación de aprendizaje/ }));
    await user.click(await screen.findByRole('button', { name: /^Guardar/ }));
    const g = onSave.mock.calls[0][0] as LearningSituation;
    expect(g).toMatchObject({ class_id: 'c1', otras_clases: ['c2'], class_name: '5º A, 5º B' });
  });

  it('quitar la principal pasa a serlo la siguiente', async () => {
    const { user, onSave } = await abrir();
    await user.click(screen.getByRole('button', { name: '5º A' }));
    await user.click(screen.getByRole('button', { name: '5º B' }));
    await user.click(screen.getByRole('button', { name: '5º A' }));
    await user.click(screen.getByRole('button', { name: /Generar situación de aprendizaje/ }));
    await user.click(await screen.findByRole('button', { name: /^Guardar/ }));
    const g = onSave.mock.calls[0][0] as LearningSituation;
    expect(g.class_id).toBe('c2');
    expect(g.otras_clases).toBeUndefined();
  });

  it('sin marcar la casilla, no se envía ninguna barrera', async () => {
    const { user } = await abrir();
    await user.click(screen.getByRole('button', { name: '5º A' }));
    await user.click(screen.getByRole('button', { name: /Generar situación de aprendizaje/ }));
    expect((generateSda.mock.calls[0] as unknown[])[0]).toHaveProperty('barreras', undefined);
  });

  it('con la casilla, se envían las barreras de las clases elegidas y sin nombres', async () => {
    const { user } = await abrir();
    await user.click(screen.getByRole('button', { name: '5º A' }));
    await user.click(screen.getByRole('button', { name: '5º B' }));
    await user.click(screen.getByRole('checkbox', { name: /barreras de aprendizaje del alumnado \(2 alumnos con avisos\)/ }));
    // Se ve lo que se enviará
    expect(screen.getByText('el alumno necesita más tiempo')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Generar situación de aprendizaje/ }));
    expect((generateSda.mock.calls[0] as unknown[])[0]).toMatchObject({ barreras: ['Dislexia', 'el alumno necesita más tiempo'] });
  });

  it('sin clase no hay casilla, y con una clase con avisos sí', async () => {
    const { user } = await abrir();
    expect(screen.queryByRole('checkbox', { name: /barreras de aprendizaje/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: '5º C' }));
    expect(screen.getByRole('checkbox', { name: /\(1 alumno con avisos\)/ })).toBeTruthy();
  });
});
