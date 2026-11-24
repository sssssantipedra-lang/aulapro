// @vitest-environment jsdom
/**
 * Rúbricas · «Desde un modelo» (20-11-2026): sin clave de la IA la ventana de «Nueva rúbrica» se abre en los
 * modelos, «Usar y adaptar» rellena el editor manual y la rúbrica se guarda con sus cuatro niveles y sus
 * competencias clave. Y el aviso de la clave abre su ventana en vez de llevar a Configuración.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Rubrics } from './Rubrics';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import { setApiKey } from '../services/gemini';
import { cerrarClaveIA, ventanaClaveAbierta } from '../lib/claveIA';
import { MODELOS_RUBRICA } from '../lib/modelosInstrumentos';
import type { Class, Rubric } from '../types';

beforeEach(() => { localStorage.clear(); setApiKey(''); });
afterEach(() => { cleanup(); cerrarClaveIA(); setApiKey(''); });

const clasesDeEso = [1, 2, 3].map(n => ({ id: `c${n}`, name: `${n}º ESO A`, subject: 'Lengua', subjects: ['Lengua'], color: '#000', etapa: 'eso' }) as Class);

function pinta({ classes = [] as Class[], ef = false, rubrics = [] as Rubric[] } = {}) {
  const onAddRubric = vi.fn();
  const props = {
    rubrics, dianas: [], evaluations: [], classes, students: [], gradeCategories: [], lawDocument: null,
    onAddRubric, onUpdateRubric: () => {}, onDeleteRubric: () => {}, onAddDiana: () => {}, onUpdateDiana: () => {}, onDeleteDiana: () => {}, onAddEvaluation: () => {},
  };
  render(<I18nProvider><ToastProvider><Rubrics {...props} vista="rubrics" ef={ef} /></ToastProvider></I18nProvider>);
  return { onAddRubric };
}

const pestana = (nombre: string | RegExp) => screen.getByRole('button', { name: nombre, pressed: true });
const tarjetas = () => [...document.querySelectorAll<HTMLElement>('.mi-tarjeta')];
const tarjeta = (id: string) => document.querySelector<HTMLElement>(`.mi-tarjeta[data-modelo="${id}"]`)!;

describe('Nueva rúbrica · desde un modelo', () => {
  it('sin clave de la IA se abre en «Desde un modelo», con las diez rúbricas; con clave, en la IA', async () => {
    const user = userEvent.setup();
    pinta();
    await user.click(screen.getByRole('button', { name: /Nueva rúbrica/ }));
    expect(pestana('Desde un modelo')).toBeTruthy();
    expect(tarjetas().map(t => t.dataset.modelo)).toEqual(MODELOS_RUBRICA.map(m => m.id));
    cleanup();

    setApiKey('clave-de-prueba');
    pinta();
    await user.click(screen.getByRole('button', { name: /Nueva rúbrica/ }));
    expect(screen.getByLabelText('Contexto de la actividad *')).toBeTruthy();
    expect(document.querySelector('.mi-tarjeta')).toBeNull();
  });

  it('el estado vacío ofrece empezar por un modelo, y sin clave, crear a mano', async () => {
    const user = userEvent.setup();
    pinta();
    expect(screen.getByRole('button', { name: 'Crear a mano' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Empezar desde un modelo' }));
    expect(pestana('Desde un modelo')).toBeTruthy();
  });

  it('«Usar y adaptar» abre el editor manual relleno y la rúbrica se guarda con sus niveles y sus competencias', async () => {
    const user = userEvent.setup();
    const { onAddRubric } = pinta();
    await user.click(screen.getByRole('button', { name: /Nueva rúbrica/ }));
    await user.click(screen.getByRole('button', { name: 'Usar y adaptar «Trabajo en equipo»' }));

    expect(pestana('Manual')).toBeTruthy();
    const nombre = screen.getByLabelText('Nombre de la rúbrica *') as HTMLInputElement;
    expect(nombre.value).toBe('Trabajo en equipo');
    expect(screen.getAllByPlaceholderText('Nombre del criterio').map(i => (i as HTMLInputElement).value)).toEqual([
      'Responsabilidad con su parte', 'Participación y aportaciones', 'Escucha y respeto', 'Organización y uso del tiempo',
    ]);

    // Se adapta antes de guardar
    await user.type(nombre, ' (proyecto del río)');
    await user.click(screen.getByRole('button', { name: 'Crear rúbrica' }));
    expect(onAddRubric).toHaveBeenCalledOnce();
    const r = onAddRubric.mock.calls[0][0] as Rubric;
    expect(r.name).toBe('Trabajo en equipo (proyecto del río)');
    expect(r.criteria).toHaveLength(4);
    for (const c of r.criteria) {
      expect(Object.keys(c.descriptors).map(Number)).toEqual([1, 2, 3, 4]);
      for (const d of Object.values(c.descriptors)) expect(d.length).toBeGreaterThan(15);
      expect(c.competencies?.length).toBeGreaterThan(0);
    }
  });

  it('la etapa de partida es la de las clases y cambia la versión que se usa', async () => {
    const user = userEvent.setup();
    pinta({ classes: clasesDeEso });
    await user.click(screen.getByRole('button', { name: /Nueva rúbrica/ }));
    expect(screen.getByRole('button', { name: 'ESO', pressed: true })).toBeTruthy();
    expect(within(tarjeta('exposicion-oral')).getByText('Versión de ESO')).toBeTruthy();
    expect(within(tarjeta('cuaderno')).getByText('Primaria y ESO')).toBeTruthy();

    await user.click(within(tarjeta('exposicion-oral')).getByRole('button', { name: 'Ver los descriptores' }));
    expect(tarjeta('exposicion-oral').textContent).toContain('Presenta datos sueltos, leídos o memorizados, sin relacionarlos.');

    await user.click(screen.getByRole('button', { name: 'Primaria' }));
    expect(within(tarjeta('exposicion-oral')).getByText('Versión de Primaria')).toBeTruthy();
    expect(tarjeta('exposicion-oral').textContent).toContain('Nombra el tema y da uno o dos datos sueltos, con ayuda.');
  });

  it('otro modelo sustituye al anterior sin preguntar, pero pregunta si el docente ya ha escrito algo', async () => {
    const user = userEvent.setup();
    pinta();
    await user.click(screen.getByRole('button', { name: /Nueva rúbrica/ }));
    await user.click(screen.getByRole('button', { name: 'Usar y adaptar «Proyecto»' }));
    await user.click(screen.getByRole('button', { name: 'Desde un modelo' }));
    await user.click(screen.getByRole('button', { name: 'Usar y adaptar «Lectura en voz alta»' }));
    const nombre = () => screen.getByLabelText('Nombre de la rúbrica *') as HTMLInputElement;
    expect(nombre().value).toBe('Lectura en voz alta');

    await user.type(nombre(), ' de 3.º');
    await user.click(screen.getByRole('button', { name: 'Desde un modelo' }));
    await user.click(screen.getByRole('button', { name: 'Usar y adaptar «Proyecto»' }));
    expect(screen.getByText('Sustituirá lo que ya tienes escrito.')).toBeTruthy();
    await user.click(within(tarjeta('proyecto')).getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Manual' }));
    expect(nombre().value).toBe('Lectura en voz alta de 3.º');

    await user.click(screen.getByRole('button', { name: 'Desde un modelo' }));
    await user.click(screen.getByRole('button', { name: 'Usar y adaptar «Proyecto»' }));
    await user.click(screen.getByRole('button', { name: 'Sustituir' }));
    expect(nombre().value).toBe('Proyecto');
  });

  it('en Educación Física salen primero sus rúbricas', async () => {
    const user = userEvent.setup();
    pinta({ ef: true });
    await user.click(screen.getByRole('button', { name: /Nueva rúbrica/ }));
    expect(tarjetas().slice(0, 2).map(t => t.dataset.modelo)).toEqual(['ef-juego-colectivo', 'ef-expresion-corporal']);
  });

  it('sin clave, la pestaña de la IA no deja generar y «Configurar la IA» abre la ventana de la clave sin cerrar la rúbrica', async () => {
    const user = userEvent.setup();
    pinta();
    await user.click(screen.getByRole('button', { name: /Nueva rúbrica/ }));
    await user.click(screen.getByRole('button', { name: /IA$/ }));
    await user.type(screen.getByLabelText('Contexto de la actividad *'), 'Debate sobre el agua');
    expect((screen.getByRole('button', { name: /Generar rúbrica/ }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Configurar la IA' }));
    expect(ventanaClaveAbierta()).toBe(true);
    expect((screen.getByLabelText('Contexto de la actividad *') as HTMLTextAreaElement).value).toBe('Debate sobre el agua');
  });
});
