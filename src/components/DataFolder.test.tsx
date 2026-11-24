// @vitest-environment jsdom
/** Restaurar una copia de «Mis datos» de antes de «Empezar curso nuevo» devuelve también el perfil a su curso escolar. */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import { ToastProvider } from './ui/Toast';
import { apuntarCambioDeCurso } from '../lib/cursoAnterior';

const disco = vi.hoisted(() => ({
  copias: [] as { file: string; size: number; at: string }[],
  restauradas: [] as string[],
  perfil: [] as { id: string; patch: Record<string, unknown> }[],
}));
vi.mock('../services/storage', async original => ({
  ...(await original<typeof import('../services/storage')>()),
  isDesktop: () => true,
  folderInfo: async () => ({ path: '', bytes: 0, backups: disco.copias }),
  restoreBackup: async (_id: string, file: string) => { disco.restauradas.push(file); return true; },
  updateProfile: async (id: string, patch: Record<string, unknown>) => { disco.perfil.push({ id, patch }); },
}));
vi.mock('../lib/guardadoBloqueado', () => ({ bloquearGuardado: () => {} }));

import { DataFolder } from './DataFolder';

const pintar = () => render(
  <I18nProvider><ToastProvider>
    <DataFolder profileId="p1" courseLabel="2026-2027" onClearSchoolYear={async () => {}} />
  </ToastProvider></I18nProvider>,
);

beforeEach(() => {
  localStorage.clear();
  disco.copias = []; disco.restauradas = []; disco.perfil = [];
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  // La pantalla se recarga tras restaurar: aquí no
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('restaurar una copia de «Mis datos»', () => {
  const ANTES = 'copia-2026-09-03T10-00-00-antes-de-curso-nuevo.json';
  const DESPUES = 'copia-2026-09-20T08-00-00.json';

  it('una copia de antes de empezar el curso nuevo devuelve el perfil al curso anterior', async () => {
    apuntarCambioDeCurso('p1', '2025-2026', new Date('2026-09-03T10:00:02Z'));
    disco.copias = [{ file: DESPUES, size: 10, at: '2026-09-20T08:00:00Z' }, { file: ANTES, size: 10, at: '2026-09-03T10:00:00Z' }];
    pintar();
    const botones = await screen.findAllByText('Restaurar');
    fireEvent.click(botones[1]);
    await waitFor(() => expect(disco.restauradas).toEqual([ANTES]));
    await waitFor(() => expect(disco.perfil).toEqual([{ id: 'p1', patch: { course: '2025-2026' } }]));
  });

  it('una copia del curso nuevo no toca el curso del perfil', async () => {
    apuntarCambioDeCurso('p1', '2025-2026', new Date('2026-09-03T10:00:02Z'));
    disco.copias = [{ file: DESPUES, size: 10, at: '2026-09-20T08:00:00Z' }];
    pintar();
    fireEvent.click(await screen.findByText('Restaurar'));
    await waitFor(() => expect(disco.restauradas).toEqual([DESPUES]));
    await screen.findByText(/Copia restaurada/);
    expect(disco.perfil).toEqual([]);
  });

  it('sin haber empezado ningún curso en este dispositivo, restaurar es lo de siempre', async () => {
    disco.copias = [{ file: ANTES, size: 10, at: '2026-09-03T10:00:00Z' }];
    pintar();
    fireEvent.click(await screen.findByText('Restaurar'));
    await waitFor(() => expect(disco.restauradas).toEqual([ANTES]));
    await screen.findByText(/Copia restaurada/);
    expect(disco.perfil).toEqual([]);
  });
});
