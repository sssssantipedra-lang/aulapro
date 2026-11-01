// @vitest-environment jsdom
/** «Descargar mis datos» en la pantalla de licencia: solo sale si hay trabajo en este navegador, y baja una copia que la app sabe cargar. */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import { leerCopiaDeDatos } from '../lib/copiaDeDatos';

const perfiles = vi.hoisted(() => ({ lista: [] as { id: string; name: string }[], datos: {} as Record<string, unknown> }));
vi.mock('../services/storage', () => ({
  listProfiles: async () => perfiles.lista,
  loadData: async (id: string) => perfiles.datos[id] ?? {},
}));
const bajada = vi.hoisted(() => ({ blobs: [] as { blob: Blob; nombre: string }[] }));
vi.mock('../lib/download', () => ({
  downloadFile: async (blob: Blob, nombre: string) => { bajada.blobs.push({ blob, nombre }); },
  compartirArchivo: async () => true,
  puedeCompartirArchivos: () => false,
}));

import { DescargarMisDatos } from './DescargarMisDatos';
import { copiasDeEsteNavegador } from '../lib/copiasDeEsteNavegador';

const pintar = () => render(<I18nProvider><DescargarMisDatos /></I18nProvider>);
beforeEach(() => { perfiles.lista = []; perfiles.datos = {}; bajada.blobs = []; });
afterEach(cleanup);

describe('Descargar mis datos', () => {
  it('no sale si el navegador no tiene trabajo guardado', async () => {
    perfiles.lista = [{ id: 'p1', name: 'Docente' }];
    perfiles.datos = { p1: {} };
    pintar();
    await waitFor(() => expect(screen.queryByText('Descargar mis datos')).toBeNull());
  });

  it('con trabajo guardado, baja un archivo que la app puede cargar', async () => {
    perfiles.lista = [{ id: 'p1', name: 'Profesor Ñandú' }];
    perfiles.datos = { p1: { classes: [{ id: 'c1', name: '1º A' }], students: [] } };
    pintar();
    fireEvent.click(await screen.findByText('Descargar mis datos'));
    await waitFor(() => expect(bajada.blobs.length).toBe(1));
    expect(bajada.blobs[0]!.nombre).toMatch(/^aulapro-copia-Profesor-Nandu-\d{4}-\d{2}-\d{2}\.json$/);
    const r = leerCopiaDeDatos(await bajada.blobs[0]!.blob.text());
    expect(r.ok).toBe(true);
    expect(await screen.findByText(/Copia descargada/)).toBeTruthy();
  });

  it('si el navegador no deja leer, no sale (y no rompe la pantalla)', async () => {
    perfiles.lista = null as never;
    expect(await copiasDeEsteNavegador()).toEqual([]);
  });
});
