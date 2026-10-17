// @vitest-environment jsdom
/**
 * Portada de Educación Física: cuatro tarjetas con todo lo que ofrece cada
 * tema, y cada herramienta abre su pantalla. Y la barra de pestañas de una
 * pantalla solo enseña las de su tema.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EfInicio } from './EfInicio';
import { HubTabs } from '../../components/layout/HubTabs';
import { I18nProvider } from '../../i18n';
import { buildDemoEF } from '../../lib/demoEF';
import { EF_VACIO } from '../../lib/ef';
import { HUBS } from '../../lib/navigation';
import type { Section } from '../../types';

afterEach(() => cleanup());

const demo = buildDemoEF(new Date(2026, 9, 5));

describe('portada de Educación Física', () => {
  it('reparte las diez herramientas en cuatro tarjetas', () => {
    render(<I18nProvider><EfInicio ef={EF_VACIO} onNav={() => undefined} /></I18nProvider>);
    const tarjetas = screen.getAllByRole('article');
    expect(tarjetas.map(t => within(t).getByRole('heading').textContent)).toEqual(['Con el grupo', 'Alumnado', 'Preparar las clases', 'Circuitos y material']);
    const filas = (n: number) => within(tarjetas[n]).getAllByRole('button').map(b => b.querySelector('.ef-in-row-ttl')?.textContent);
    expect(filas(0)).toEqual(['En la pista', 'Equipos', 'Cronómetro de circuitos']);
    expect(filas(1)).toEqual(['Exentos y lesiones', 'Pruebas físicas']);
    expect(filas(2)).toEqual(['Actividades', 'Sesiones', 'Situaciones de aprendizaje']);
    expect(filas(3)).toEqual(['Pizarra de circuitos', 'Material e instalaciones']);
  });

  it('cada herramienta abre su pantalla', async () => {
    const user = userEvent.setup();
    const onNav = vi.fn();
    render(<I18nProvider><EfInicio ef={EF_VACIO} onNav={onNav} /></I18nProvider>);
    await user.click(screen.getByRole('button', { name: /Cronómetro de circuitos/ }));
    await user.click(screen.getByRole('button', { name: /Pizarra de circuitos/ }));
    await user.click(screen.getByRole('button', { name: /Pruebas físicas/ }));
    expect(onNav.mock.calls.map(c => c[0])).toEqual(['ef-circuitos', 'ef-pizarra', 'ef-pruebas']);
  });

  it('cada tarjeta acaba con un dato de lo que hay', () => {
    render(<I18nProvider><EfInicio ef={demo.ef} onNav={() => undefined} /></I18nProvider>);
    expect(screen.getByText(`Actividades tuyas: ${demo.ef.actividades.length} · Sesiones: ${demo.ef.sesiones.length}`)).toBeTruthy();
    expect(screen.getByText(`Pizarras guardadas: ${demo.ef.pizarras.length} · Material: ${demo.ef.material.length}`)).toBeTruthy();
  });

  it('todas las pantallas del apartado salen en alguna tarjeta', () => {
    render(<I18nProvider><EfInicio ef={EF_VACIO} onNav={() => undefined} /></I18nProvider>);
    const todas = HUBS.find(h => h.id === 'ef')!.tabs.map(t => t.id).filter(id => id !== 'ef-inicio');
    // No sobra ni falta ninguna fila
    expect(screen.getAllByRole('button')).toHaveLength(todas.length);
  });
});

describe('barra de pestañas de Educación Física', () => {
  const pestanas = (s: Section) => {
    render(<I18nProvider><HubTabs section={s} tipo="ef" onNav={() => undefined} /></I18nProvider>);
    return screen.getAllByRole('tab').map(t => t.textContent);
  };

  it('en la portada solo está «Resumen»', () => {
    expect(pestanas('ef-inicio')).toEqual(['Resumen']);
  });

  it('en una pantalla enseña la portada y las de su tema', () => {
    expect(pestanas('ef-equipos')).toEqual(['Resumen', 'En la pista', 'Equipos', 'Cronómetro de circuitos']);
    cleanup();
    expect(pestanas('ef-sesiones')).toEqual(['Resumen', 'Actividades', 'Sesiones', 'Situaciones de aprendizaje']);
    expect(screen.getByText('Preparar las clases')).toBeTruthy();
  });

  it('los demás apartados siguen con todas sus pestañas', () => {
    render(<I18nProvider><HubTabs section="reports" tipo="aula" onNav={() => undefined} /></I18nProvider>);
    expect(screen.getAllByRole('tab')).toHaveLength(HUBS.find(h => h.id === 'documents')!.tabs.length);
  });
});
