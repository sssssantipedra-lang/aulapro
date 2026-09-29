// @vitest-environment jsdom
/**
 * Situaciones de aprendizaje: la biblioteca muestra las guardadas como
 * tarjetas, al abrir una se lee como documento (con índice) y se vuelve a la
 * biblioteca; «Nueva» abre el formulario.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LearningSituations } from './LearningSituations';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { LearningSituation } from '../types';

afterEach(cleanup);
beforeAll(() => {
  // jsdom no trae IntersectionObserver ni scrollTo
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} takeRecords() { return []; } root = null; rootMargin = ''; thresholds = []; } as unknown as typeof IntersectionObserver;
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const sda: LearningSituation = {
  id: 'sda1', at: '2026-09-29T10:00:00Z', date: '2026-09-29', title: 'Mercado sostenible',
  request: { idea: 'mercado', numero: '2', temporalizacion: '1ª evaluación', meses: '', areas: ['Matemáticas'], numSesiones: 2, nivel: '3º ESO', contextoClase: '', metodologia: '' },
  content: {
    titulo: 'Mercado sostenible', justificacion: 'Reducir residuos del centro.', ods: '', objetivosEtapa: '', competenciasClave: 'STEM y CCL',
    explicacionCurricular: '', areas: [{ area: 'Matemáticas', competenciasEspecificas: 'CE1', criteriosEvaluacion: '1.1', saberesBasicos: 'Estadística' }],
    inclusionUniversal: '', inclusionAdicional: '', inclusionIndividualizada: '',
    sesiones: [{ fase: 'Activación', titulo: 'Recuento', descripcion: 'Contar residuos' }, { fase: 'Producto final', titulo: 'Mercado', descripcion: 'Celebrarlo' }],
    metodologia: 'ABP', agrupamiento: '', recursos: '', productoFinal: 'Un mercado', evaluacionTecnicas: '', evaluacionInstrumentos: '',
  },
};

function setup(list: LearningSituation[]) {
  render(
    <I18nProvider>
      <ToastProvider>
        <LearningSituations
          classes={[]} gradeCategories={[]} learningSituations={list} teacherName="Ana"
          onSave={() => {}} onDelete={() => {}} onAddRubric={() => {}} onAddDiana={() => {}} onAddFicha={() => {}} onNav={() => {}}
        />
      </ToastProvider>
    </I18nProvider>,
  );
}

describe('Situaciones de aprendizaje', () => {
  it('sin ninguna, invita a crear la primera y abre el formulario', async () => {
    const user = userEvent.setup();
    setup([]);
    expect(screen.getByText('Todavía no tienes ninguna situación de aprendizaje')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Crear la primera/ }));
    expect(screen.getByLabelText(/Idea de la situación de aprendizaje/)).toBeTruthy();
  });

  it('abre una guardada como documento y vuelve a la biblioteca', async () => {
    const user = userEvent.setup();
    setup([sda]);
    await user.click(screen.getByRole('button', { name: /Mercado sostenible/ }));

    expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Mercado sostenible');
    expect(screen.getByRole('navigation', { name: 'Apartados' })).toBeTruthy();
    expect(screen.getByText('Recuento')).toBeTruthy();
    expect(screen.getByText('STEM')).toBeTruthy();

    // Un apartado se lee como texto y solo se edita al pulsar el lápiz
    expect(screen.queryByRole('textbox', { name: 'Justificación' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Editar «Justificación»' }));
    expect(screen.getByRole('textbox', { name: 'Justificación' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Mis situaciones de aprendizaje/ }));
    expect(screen.getAllByRole('button', { name: /Nueva situación de aprendizaje/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Mercado sostenible/ })).toBeTruthy();
  });
});
