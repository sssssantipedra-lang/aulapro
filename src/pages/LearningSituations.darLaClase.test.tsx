// @vitest-environment jsdom
/**
 * «Dar la clase» desde una situación de aprendizaje guardada: cada sesión sin dar lleva el botón, que pide
 * a la app esa sesión (por su situación y su número); con cambios sin guardar no sale, porque la pizarra lee
 * la situación guardada.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LearningSituations } from './LearningSituations';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { LearningSituation } from '../types';

vi.mock('../services/gemini', async importOriginal => ({
  ...await importOriginal<typeof import('../services/gemini')>(), hasApiKey: () => false,
}));

afterEach(() => { cleanup(); localStorage.clear(); });
beforeAll(() => {
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} takeRecords() { return []; } root = null; rootMargin = ''; thresholds = []; } as unknown as typeof IntersectionObserver;
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const sda: LearningSituation = {
  id: 'sda1', at: '2026-09-29T10:00:00Z', date: '2026-09-29', title: 'Mercado sostenible',
  request: { idea: 'mercado', numero: '2', temporalizacion: '1ª evaluación', meses: '', areas: ['Matemáticas'], numSesiones: 3, nivel: '3º ESO', contextoClase: '', metodologia: '' },
  content: {
    titulo: 'Mercado sostenible', justificacion: 'Reducir residuos del centro.', ods: '', objetivosEtapa: '', competenciasClave: 'STEM y CCL',
    explicacionCurricular: '', areas: [{ area: 'Matemáticas', competenciasEspecificas: 'CE1', criteriosEvaluacion: '1.1', saberesBasicos: 'Estadística' }],
    inclusionUniversal: '', inclusionAdicional: '', inclusionIndividualizada: '',
    sesiones: [
      { fase: 'Activación', titulo: 'Recuento', descripcion: 'Contar residuos', completada: true },
      { fase: 'Desarrollo', titulo: 'Gráficas', descripcion: 'Dibujar los datos' },
      { fase: 'Producto final', titulo: 'Mercado', descripcion: 'Celebrarlo' },
    ],
    metodologia: 'ABP', agrupamiento: '', recursos: '', productoFinal: 'Un mercado', evaluacionTecnicas: '', evaluacionInstrumentos: '',
  },
};

function montar(onDarLaClase?: (sdaId: string, indice: number) => void) {
  render(
    <I18nProvider><ToastProvider>
      <LearningSituations
        classes={[]} gradeCategories={[]} learningSituations={[sda]}
        onUpdateClass={() => {}} onSave={() => {}} onDelete={() => {}} onAddRubric={() => {}} onAddDiana={() => {}} onAddFicha={() => {}} onNav={() => {}}
        onDarLaClase={onDarLaClase}
      />
    </ToastProvider></I18nProvider>,
  );
}

describe('Situaciones de aprendizaje · «Dar la clase»', () => {
  it('cada sesión sin dar de la situación guardada lleva el botón, que pide esa sesión', async () => {
    const user = userEvent.setup();
    const pedidas: [string, number][] = [];
    montar((id, i) => pedidas.push([id, i]));
    await user.click(screen.getByRole('button', { name: /Mercado sostenible/ }));
    // La primera ya está dada: no lo lleva
    expect(screen.queryByRole('button', { name: 'Dar la clase: «Recuento»' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Dar la clase: «Gráficas»' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Dar la clase: «Mercado»' }));
    expect(pedidas).toEqual([['sda1', 2]]);
  });

  it('con cambios sin guardar no sale: la pizarra montaría la versión guardada', async () => {
    const user = userEvent.setup();
    montar(() => {});
    await user.click(screen.getByRole('button', { name: /Mercado sostenible/ }));
    expect(screen.getAllByRole('button', { name: /^Dar la clase/ })).toHaveLength(2);
    await user.type(screen.getByLabelText('Título'), ' y justo');
    expect(screen.queryByRole('button', { name: /^Dar la clase/ })).toBeNull();
  });

  it('sin quien la atienda (PT y AL) no hay botón', async () => {
    const user = userEvent.setup();
    montar(undefined);
    await user.click(screen.getByRole('button', { name: /Mercado sostenible/ }));
    expect(screen.queryByRole('button', { name: /^Dar la clase/ })).toBeNull();
  });
});
