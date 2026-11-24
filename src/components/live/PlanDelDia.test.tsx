// @vitest-environment jsdom
/**
 * La ventana «Plan del día» con «Dar la clase»: vacía propone la sesión de hoy de la clase y dice por qué;
 * traída, enseña los tres momentos con sus actividades como casillas y nada de lo que es del docente; al
 * marcar la última propone darla por dada, sin decidirlo.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgendaWidget } from './PizarraWidgets';
import { I18nProvider } from '../../i18n';
import { isoDate } from '../../lib/utils';
import { escribirPlanDeVentana, leerPlanDeVentana, planDeSesion, type FuenteDeSesiones, type OrigenPlan } from '../../lib/darLaClase';
import type { SesionEF } from '../../types/ef';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const sesion = (x: Partial<SesionEF> = {}): SesionEF => ({
  id: 's1', titulo: 'Fracciones equivalentes', claseId: 'c1', fecha: isoDate(),
  objetivo: 'OBJETIVO DEL DOCENTE', material: 'MATERIAL DEL DOCENTE', inclusion: 'MEDIDA DE INCLUSIÓN', planB: 'PLAN B',
  calentamiento: 'Lluvia de ideas (5 min): qué sabemos de las fracciones.',
  principal: 'Tiras de papel (20 min): doblar y comparar.\nFicha por parejas',
  calma: 'Puesta en común.',
  ...x,
} as SesionEF);

const fuente = (sesiones: SesionEF[], ef = false): FuenteDeSesiones => ({ sesiones, sdas: [], pizarras: [], ef });
const clase = { id: 'c1', name: '5º A' };

function montar(f: FuenteDeSesiones | undefined, onSesionDada?: (o: OrigenPlan) => void) {
  return render(<I18nProvider><AgendaWidget uid="agenda" clase={clase} fuente={f} onSesionDada={onSesionDada} onAmpliar={() => {}} /></I18nProvider>);
}

describe('Plan del día · traer la sesión', () => {
  it('vacía, propone la sesión de hoy de la clase y dice por qué', () => {
    montar(fuente([sesion(), sesion({ id: 's2', titulo: 'De otra clase', claseId: 'c2' })]));
    const lista = screen.getByRole('list', { name: 'Sesiones preparadas que puedes traer' });
    const propuestas = within(lista).getAllByRole('button');
    expect(propuestas).toHaveLength(1);
    expect(propuestas[0].textContent).toContain('Traer la sesión de hoy');
    expect(propuestas[0].textContent).toContain('Fracciones equivalentes');
    expect(propuestas[0].textContent).toContain('Tiene fecha de hoy y es de 5º A.');
  });

  it('sin sesiones que traer (o sin fuente, como en PT y AL) se escribe a mano como siempre', async () => {
    const user = userEvent.setup();
    montar(undefined);
    expect(screen.queryByRole('list', { name: 'Sesiones preparadas que puedes traer' })).toBeNull();
    await user.type(screen.getByPlaceholderText('Añadir una actividad'), 'Corregir los deberes{Enter}');
    expect(screen.getByRole('checkbox', { name: 'Corregir los deberes' })).toBeTruthy();
  });

  it('con algo ya escrito no propone nada: no se pisa lo que hay', async () => {
    const user = userEvent.setup();
    montar(fuente([sesion()]));
    await user.type(screen.getByPlaceholderText('Añadir una actividad'), 'Corregir los deberes{Enter}');
    expect(screen.queryByRole('list', { name: 'Sesiones preparadas que puedes traer' })).toBeNull();
  });

  it('traída, enseña los tres momentos del aula con sus actividades como casillas y nada del docente', async () => {
    const user = userEvent.setup();
    const r = montar(fuente([sesion()]));
    await user.click(screen.getByRole('button', { name: /Traer la sesión de hoy/ }));
    expect(screen.getByText('Fracciones equivalentes')).toBeTruthy();
    for (const m of ['Inicio', 'Desarrollo', 'Conclusión']) expect(screen.getByRole('region', { name: m })).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    expect(within(screen.getByRole('region', { name: 'Desarrollo' })).getAllByRole('checkbox').map(c => c.getAttribute('aria-label')))
      .toEqual(['Tiras de papel (20 min)', 'Ficha por parejas']);
    expect(screen.getByText('doblar y comparar.')).toBeTruthy();
    const visto = r.container.textContent ?? '';
    for (const no of ['OBJETIVO DEL DOCENTE', 'MATERIAL DEL DOCENTE', 'MEDIDA DE INCLUSIÓN', 'PLAN B']) expect(visto).not.toContain(no);
    // Y queda guardado en la ventana, con su sesión
    expect(leerPlanDeVentana('agenda').sesion?.origen).toEqual({ tipo: 'sesion', id: 's1' });
  });

  it('en Educación Física los momentos son activación, desarrollo y vuelta a la calma', async () => {
    const user = userEvent.setup();
    montar(fuente([sesion()], true));
    await user.click(screen.getByRole('button', { name: /Traer la sesión de hoy/ }));
    for (const m of ['Activación', 'Desarrollo', 'Vuelta a la calma']) expect(screen.getByRole('region', { name: m })).toBeTruthy();
  });
});

describe('Plan del día · dar la sesión por dada', () => {
  it('al marcar la última actividad lo propone, con su porqué; solo se marca si el docente lo pulsa', async () => {
    const user = userEvent.setup();
    const dadas: OrigenPlan[] = [];
    const plan = planDeSesion(sesion(), false);
    escribirPlanDeVentana('agenda', [...plan.tareas, { id: 't1', texto: 'Repartir autorizaciones', hecha: false }], plan.sesion);
    montar(fuente([sesion()]), o => dadas.push(o));
    const deSesion = screen.getAllByRole('checkbox').filter(c => c.getAttribute('aria-label') !== 'Repartir autorizaciones');
    expect(deSesion).toHaveLength(4);
    for (const c of deSesion.slice(0, 3)) await user.click(c);
    expect(screen.queryByText('¿Marcar la sesión como dada?')).toBeNull();
    await user.click(deSesion[3]);
    // Lo escrito a mano no cuenta: sigue sin marcar y aun así se propone
    expect(screen.getByText('¿Marcar la sesión como dada?')).toBeTruthy();
    expect(screen.getByText('Has marcado todas las actividades de «Fracciones equivalentes».')).toBeTruthy();
    expect(dadas).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Marcar como dada' }));
    expect(dadas).toEqual([{ tipo: 'sesion', id: 's1' }]);
  });

  it('cerrada la propuesta, no vuelve a salir', async () => {
    const user = userEvent.setup();
    const plan = planDeSesion(sesion(), false);
    escribirPlanDeVentana('agenda', plan.tareas.map(t => ({ ...t, hecha: true })), plan.sesion);
    const r = montar(fuente([sesion()]), () => {});
    expect(screen.getByText('¿Marcar la sesión como dada?')).toBeTruthy();
    await user.click(within(r.container.querySelector('.dlc-sug') as HTMLElement).getByRole('button', { name: /Cerrar|Descartar|Ahora no/ }));
    expect(screen.queryByText('¿Marcar la sesión como dada?')).toBeNull();
    r.unmount();
    montar(fuente([sesion()]), () => {});
    expect(screen.queryByText('¿Marcar la sesión como dada?')).toBeNull();
  });

  it('una sesión ya dada lo dice y no propone nada', () => {
    const s = sesion({ completada: true });
    const plan = planDeSesion(s, false);
    escribirPlanDeVentana('agenda', plan.tareas.map(t => ({ ...t, hecha: true })), plan.sesion);
    montar(fuente([s]), () => {});
    expect(screen.getByText('Sesión dada')).toBeTruthy();
    expect(screen.queryByText('¿Marcar la sesión como dada?')).toBeNull();
  });
});
