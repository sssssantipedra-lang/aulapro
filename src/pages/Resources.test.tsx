// @vitest-environment jsdom
/**
 * Recursos: una ficha guardada se abre en el editor por bloques, el tema se
 * cambia sin volver a generar, los bloques se mueven y se borran, y la vista
 * previa A4 es el mismo HTML que se imprime.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Resources } from './Resources';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { Ficha } from '../types';

// La IA, simulada: lo que se prueba aquí es que el editor añade lo que devuelve
vi.mock('../services/resources', async orig => ({
  ...(await orig<typeof import('../services/resources')>()),
  addExercise: vi.fn(async () => ({ tipo: 'abierta', enunciado: 'Un reto nuevo', solucion: '—' })),
  moreCards: vi.fn(async () => [1, 2, 3, 4].map(n => ({ pregunta: `Nueva ${n}`, respuesta: `R${n}` }))),
}));

afterEach(cleanup);
beforeAll(() => {
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const ficha: Ficha = {
  id: 'f1', at: '2026-09-29T10:00:00Z', date: '2026-09-29', title: 'Rescate en el planeta Fracción',
  request: { tema: 'fracciones', area: 'Matemáticas', nivel: '5º', numEjercicios: 2, niveles: false, contextoClase: '' },
  content: {
    estilo: 'espacio', titulo: 'Rescate en el planeta Fracción',
    historia: { personaje: 'Capitana Nova', emoji: '👩‍🚀', mision: 'Repara la nave.', cierre: '¡Bien hecho!', insignia: 'Piloto de las fracciones' },
    explicacion: 'Repaso.', instrucciones: 'Hazlo con calma.',
    actividades: [{
      titulo: 'Motor', emoji: '🚀', narrativa: 'Arranca el motor.',
      ejercicios: [
        { tipo: 'verdadero_falso', enunciado: 'Marca V o F.', afirmaciones: ['1/2 = 2/4'], solucion: 'V' },
        { tipo: 'abierta', enunciado: 'Explica qué es una fracción.', solucion: '—' },
      ],
    }],
  },
};

function setup(onSave = vi.fn(), list: Ficha[] = [ficha]) {
  render(
    <I18nProvider>
      <ToastProvider>
        <Resources classes={[]} fichas={list} onSave={onSave} onDelete={() => {}} onNav={() => {}} />
      </ToastProvider>
    </I18nProvider>,
  );
  return onSave;
}

describe('Recursos — editor de fichas', () => {
  it('muestra la biblioteca con el tema de cada ficha y el selector de mundos', () => {
    setup();
    expect(screen.getByText('Rescate en el planeta Fracción')).toBeTruthy();
    expect(screen.getAllByText('Misión espacial').length).toBeGreaterThan(0);
    expect(screen.getByRole('radio', { name: /Que elija la IA/ })).toBeTruthy();
  });

  it('abre la ficha en el editor con la historia y sus bloques', async () => {
    setup();
    await userEvent.click(screen.getByText('Rescate en el planeta Fracción'));
    expect(screen.getByDisplayValue('Capitana Nova')).toBeTruthy();
    expect(screen.getByDisplayValue('Motor')).toBeTruthy();
    expect(screen.getByDisplayValue('Marca V o F.')).toBeTruthy();
    expect(screen.getByText('Vista previa · así se imprime')).toBeTruthy();
  });

  it('cambiar de tema no regenera nada y cambia la etiqueta de los bloques', async () => {
    const onSave = setup();
    await userEvent.click(screen.getByText('Rescate en el planeta Fracción'));
    expect(screen.getByText('Misión 1')).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: /Caso de detectives/ }));
    expect(screen.getByText('Pista 1')).toBeTruthy();
    expect(screen.getByText('Sin guardar')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /^Guardar$/ }));
    expect(onSave.mock.calls[0][0].content.estilo).toBe('detectives');
    // La historia se conserva tal cual
    expect(onSave.mock.calls[0][0].content.historia.personaje).toBe('Capitana Nova');
  });

  it('mueve y borra ejercicios', async () => {
    const onSave = setup();
    await userEvent.click(screen.getByText('Rescate en el planeta Fracción'));
    const bajar = screen.getAllByRole('button', { name: 'Bajar' });
    await userEvent.click(bajar[0]);
    await userEvent.click(screen.getByRole('button', { name: /^Guardar$/ }));
    expect(onSave.mock.calls[0][0].content.actividades[0].ejercicios.map((e: { tipo: string }) => e.tipo)).toEqual(['abierta', 'verdadero_falso']);
    await userEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    await userEvent.click(screen.getByRole('button', { name: /^Guardar$/ }));
    expect(onSave.mock.calls[1][0].content.actividades[0].ejercicios).toHaveLength(1);
  });

  it('editar el enunciado llega a la vista previa', async () => {
    setup();
    await userEvent.click(screen.getByText('Rescate en el planeta Fracción'));
    fireEvent.change(screen.getByDisplayValue('Explica qué es una fracción.'), { target: { value: 'Dibuja tres cuartos.' } });
    const frame = document.querySelector('.fe-preview-frame') as HTMLIFrameElement;
    await waitFor(() => expect(frame.contentDocument?.body.textContent).toContain('Dibuja tres cuartos.'), { timeout: 2000 });
    expect(frame.contentDocument?.body.textContent).toContain('Piloto de las fracciones');
  });

  it('escape room: cada bloque es una sala con su código editable', async () => {
    const onSave = setup(vi.fn(), [{ ...ficha, content: { ...ficha.content, formato: 'escape', actividades: ficha.content.actividades.map(a => ({ ...a, candado: { codigo: '472', pista: 'Resultados en orden' } })) } }]);
    await userEvent.click(screen.getByText('Rescate en el planeta Fracción'));
    expect(screen.getByText('Sala 1')).toBeTruthy();
    const code = screen.getByDisplayValue('472');
    fireEvent.change(code, { target: { value: 'a-9 b' } });
    await userEvent.click(screen.getByRole('button', { name: /^Guardar$/ }));
    expect(onSave.mock.calls[0][0].content.actividades[0].candado.codigo).toBe('A9B');
  });

  it('tarjetas: se editan y se añaden en una lista', async () => {
    const onSave = setup(vi.fn(), [{ ...ficha, content: { ...ficha.content, formato: 'tarjetas', actividades: [], tarjetas: [{ pregunta: '¿1/2 de 8?', respuesta: '4' }] } }]);
    await userEvent.click(screen.getByText('Rescate en el planeta Fracción'));
    expect(screen.getByDisplayValue('¿1/2 de 8?')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Añadir tarjeta/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Guardar$/ }));
    expect(onSave.mock.calls[0][0].content.tarjetas).toHaveLength(2);
  });

  it('el menú «Adaptar» ofrece apoyo, ampliación y lectura fácil', async () => {
    localStorage.setItem('aulapro_gemini_key', 'AIzaTEST');
    setup();
    await userEvent.click(screen.getByText('Rescate en el planeta Fracción'));
    await userEvent.click(screen.getByRole('button', { name: 'Adaptar' }));
    expect(screen.getByRole('menuitem', { name: /Versión de apoyo/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Versión de ampliación/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Lectura fácil/ })).toBeTruthy();
    localStorage.removeItem('aulapro_gemini_key');
  });

  it('añade un ejercicio con IA al final del bloque', async () => {
    localStorage.setItem('aulapro_gemini_key', 'AIzaTEST');
    const onSave = setup();
    await userEvent.click(screen.getByText('Rescate en el planeta Fracción'));
    await userEvent.click(screen.getByRole('button', { name: /Añadir ejercicio con IA/ }));
    expect(await screen.findByDisplayValue('Un reto nuevo')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /^Guardar$/ }));
    expect(onSave.mock.calls[0][0].content.actividades[0].ejercicios).toHaveLength(3);
    localStorage.removeItem('aulapro_gemini_key');
  });

  it('añade 4 tarjetas más con IA', async () => {
    localStorage.setItem('aulapro_gemini_key', 'AIzaTEST');
    const onSave = setup(vi.fn(), [{ ...ficha, content: { ...ficha.content, formato: 'tarjetas', actividades: [], tarjetas: [{ pregunta: '¿1/2 de 8?', respuesta: '4' }] } }]);
    await userEvent.click(screen.getByText('Rescate en el planeta Fracción'));
    await userEvent.click(screen.getByRole('button', { name: /4 tarjetas más con IA/ }));
    expect(await screen.findByDisplayValue('Nueva 4')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /^Guardar$/ }));
    expect(onSave.mock.calls[0][0].content.tarjetas).toHaveLength(5);
    localStorage.removeItem('aulapro_gemini_key');
  });
});
