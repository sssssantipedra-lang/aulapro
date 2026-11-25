// @vitest-environment jsdom
/**
 * La campana de los avisos y su panel: el número, los grupos con su porqué, lo que hace cada botón y las formas
 * de cerrarlo (Escape, la X, tocar fuera y el botón de atrás, que lo encuentra con `lib/loAbierto.ts`).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Campana, PanelAvisos } from './Notificaciones';
import { I18nProvider } from '../i18n';
import { avisosDe } from '../lib/notificaciones';
import { cerrarLoAbierto } from '../lib/loAbierto';
import { shiftDate } from '../lib/utils';
import type { Class, Student } from '../types';

afterEach(cleanup);

const HOY = '2026-11-25';
const clase: Class = { id: 'c1', name: '3º ESO A', subject: 'Matemáticas', subjects: ['Matemáticas'], isTutoria: false, room: '', color: '#000' } as Class;
const alumno = (id: string): Student => ({ id, class_id: 'c1', name: `Alumno ${id}`, email: '', photo: null, alerts: [], notes: '' });

const avisos = avisosDe({
  hoy: HOY,
  calEvents: [
    { id: 'e1', name: 'Examen de fracciones', date: shiftDate(HOY, 3), time: '09:00', type: 'deadline', urgency: 'media', color: '#000', desc: '', classId: 'c1' },
    { id: 'e2', name: 'Claustro', date: HOY, time: '17:00', type: 'meeting', urgency: 'media', color: '#000', desc: '' },
  ],
  classes: [clase], students: [alumno('1'), alumno('2'), alumno('3')],
  radar: { atencion: [{ student: alumno('2'), cls: clase, dato: { tipo: 'asistencia', clave: '{n} faltas sin justificar', vars: { n: 3 }, peso: 90 }, cuantos: 2 }], destacan: [] },
  gradeCategories: [{ id: 'cat', class_id: 'c1', name: 'Pruebas', weight: 100 }],
  gradeItems: [{ id: 'i1', class_id: 'c1', category_id: 'cat', name: 'Problemas', date: '2026-11-20' }],
  grades: { i1: { 1: 6, 2: 7 } },
  tasks: [{ id: 't1', text: 'Preparar la salida', priority: 'high', done: false }],
});

function panel(props: Partial<React.ComponentProps<typeof PanelAvisos>> = {}) {
  const fns = { onAbrir: vi.fn(), onOcultar: vi.fn(), onVolverAEnsenar: vi.fn(), onTareaHecha: vi.fn(), onCerrar: vi.fn() };
  render(
    <I18nProvider>
      <PanelAvisos avisos={avisos} ocultos={[]} variasClases abrirTareas {...fns} {...props} />
    </I18nProvider>,
  );
  return fns;
}

describe('la campana', () => {
  it('lleva el número de avisos y lo dice', () => {
    const onClick = vi.fn();
    render(<I18nProvider><Campana n={4} onClick={onClick} /></I18nProvider>);
    const b = screen.getByRole('button', { name: 'Avisos: 4 pendientes' });
    expect(b.textContent).toBe('4');
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalled();
  });

  it('sin avisos, sin número', () => {
    render(<I18nProvider><Campana n={0} onClick={() => {}} /></I18nProvider>);
    expect(screen.getByRole('button', { name: 'Avisos: no hay nada pendiente' }).textContent).toBe('');
  });

  it('con muchos, «99+»', () => {
    render(<I18nProvider><Campana n={120} onClick={() => {}} /></I18nProvider>);
    expect(screen.getByRole('button', { name: 'Avisos: 120 pendientes' }).textContent).toBe('99+');
  });
});

describe('el panel', () => {
  it('agrupa por tipo, lo más urgente primero, y cada grupo dice por qué', () => {
    panel();
    const dialogo = screen.getByRole('dialog', { name: 'Avisos' });
    const grupos = within(dialogo).getAllByRole('heading', { level: 3 }).map(h => h.textContent);
    // Claustro hoy (100) y el examen (70); el alumno (70, empata y va detrás del evento), la tarea alta (65) y las notas (40)
    expect(grupos).toEqual(['Eventos próximos2, 2 avisos', 'Alumnado que necesita atención1, 1 aviso', 'Tareas pendientes1, 1 aviso', 'Notas a medio poner1, 1 aviso']);
    expect(within(dialogo).getByText('Los eventos de tu Agenda a los que les faltan 5 días o menos.')).toBeTruthy();
    expect(within(dialogo).getByText('Hoy')).toBeTruthy();
    expect(within(dialogo).getByText('Faltan 3 días')).toBeTruthy();
    // El evento dice su clase; el alumno, su motivo y su clase; las notas, a quién le falta
    expect(within(dialogo).getByText(/3º ESO A$/, { selector: 'small' })).toBeTruthy();
    expect(within(dialogo).getByText('3 faltas sin justificar · y 1 más')).toBeTruthy();
    expect(within(dialogo).getByText('Alumno 2 · 3º ESO A')).toBeTruthy();
    expect(within(dialogo).getByText('Falta la nota de 1 de 3: Alumno 3')).toBeTruthy();
  });

  it('cada aviso abre donde vive, se oculta con «Ya lo he visto» y una tarea se marca como hecha', async () => {
    const user = userEvent.setup();
    const fns = panel();
    await user.click(screen.getByRole('button', { name: /^Examen de fracciones/ }));
    expect(fns.onAbrir.mock.calls[0][0]).toMatchObject({ tipo: 'evento', dias: 3 });
    await user.click(screen.getByRole('button', { name: 'Ya lo he visto: Alumno 2 · 3º ESO A' }));
    expect(fns.onOcultar.mock.calls[0][0]).toMatchObject({ tipo: 'alumno' });
    await user.click(screen.getByRole('checkbox', { name: 'Marcar como hecha: Preparar la salida' }));
    expect(fns.onTareaHecha).toHaveBeenCalledWith('t1');
    // Una tarea no se oculta: se hace
    expect(screen.queryByRole('button', { name: /Ya lo he visto: Preparar la salida/ })).toBeNull();
  });

  it('sin dónde abrir las tareas (PT y AL), la tarea se puede marcar pero no abrir', () => {
    panel({ abrirTareas: false });
    expect(screen.queryByRole('button', { name: /Preparar la salida/ })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Marcar como hecha: Preparar la salida' })).toBeTruthy();
  });

  it('sin avisos dice que no hay nada pendiente', () => {
    panel({ avisos: [] });
    expect(screen.getByText('No tienes nada pendiente.')).toBeTruthy();
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
  });

  it('dice cuántos hay ocultos y los vuelve a enseñar', async () => {
    const user = userEvent.setup();
    const fns = panel({ avisos: avisos.slice(1), ocultos: avisos.slice(0, 1) });
    expect(screen.getByText(/Has ocultado 1 aviso\./)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Volver a enseñarlos' }));
    expect(fns.onVolverAEnsenar).toHaveBeenCalled();
  });

  it('se cierra con Escape, con la X y tocando fuera', async () => {
    const user = userEvent.setup();
    const fns = panel();
    await user.keyboard('{Escape}');
    expect(fns.onCerrar).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(fns.onCerrar).toHaveBeenCalledTimes(2);
    fireEvent.click(document.querySelector('.ntf-fondo')!);
    expect(fns.onCerrar).toHaveBeenCalledTimes(3);
    // Tocar dentro no lo cierra
    fireEvent.click(screen.getByRole('dialog'));
    expect(fns.onCerrar).toHaveBeenCalledTimes(3);
  });

  it('el botón de atrás lo encuentra y lo cierra con su «Cerrar»', () => {
    const fns = panel();
    expect(cerrarLoAbierto(document, null, ['Cerrar', 'Salir'])).toBe(screen.getByRole('dialog'));
    expect(fns.onCerrar).toHaveBeenCalled();
  });

  it('al abrirse toma el foco', () => {
    panel();
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });

  it('el foco no sale del panel con Tab: da la vuelta dentro', async () => {
    const user = userEvent.setup();
    panel();
    const dialogo = screen.getByRole('dialog');
    const enfocables = [...dialogo.querySelectorAll<HTMLElement>('button, input')];
    enfocables[enfocables.length - 1].focus();
    await user.tab();
    expect(document.activeElement).toBe(enfocables[0]);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(enfocables[enfocables.length - 1]);
  });

  it('Escape no cierra el panel si el foco está en otra ventana abierta encima', () => {
    const fns = panel();
    const otra = document.createElement('button');
    document.body.appendChild(otra);
    otra.focus();
    fireEvent.keyDown(otra, { key: 'Escape' });
    expect(fns.onCerrar).not.toHaveBeenCalled();
    otra.remove();
  });

  it('al marcar una tarea lo dice y se puede deshacer allí mismo', async () => {
    const user = userEvent.setup();
    const fns = panel();
    await user.click(screen.getByRole('checkbox', { name: 'Marcar como hecha: Preparar la salida' }));
    expect(screen.getByRole('status').textContent).toContain('Tarea marcada como hecha: Preparar la salida');
    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(fns.onTareaHecha).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status').textContent).toContain('Tarea pendiente de nuevo: Preparar la salida');
  });

  it('al ocultar un aviso lo dice', async () => {
    const user = userEvent.setup();
    panel();
    await user.click(screen.getByRole('button', { name: 'Ya lo he visto: Alumno 2 · 3º ESO A' }));
    expect(screen.getByRole('status').textContent).toBe('Aviso ocultado: Alumno 2 · 3º ESO A');
  });

  it('las notas de una clase con varias asignaturas dicen de cuál es la actividad', () => {
    const varias = { ...clase, subjects: ['Lengua', 'Ciencias'] };
    const [notas] = avisosDe({
      hoy: HOY, calEvents: [], classes: [varias], students: [alumno('1'), alumno('2'), alumno('3')],
      gradeCategories: [{ id: 'cat', class_id: 'c1', name: 'Pruebas', weight: 100, subject: 'Ciencias' }],
      gradeItems: [{ id: 'i1', class_id: 'c1', category_id: 'cat', name: 'Problemas', date: '2026-11-20' }],
      grades: { i1: { 1: 6, 2: 7 } }, tasks: [],
    });
    panel({ avisos: [notas] });
    expect(screen.getByText('Problemas · 3º ESO A · Ciencias')).toBeTruthy();
  });

  it('en el panel las marcas de los eventos no laten (ya laten en la Agenda y en el Inicio)', () => {
    panel();
    expect(screen.getByText('Hoy').classList.contains('cerca-latido')).toBe(false);
  });
});
