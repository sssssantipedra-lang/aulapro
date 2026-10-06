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
    expect(screen.getByRole('menuitem', { name: /Versión visual/ })).toBeTruthy();
    localStorage.removeItem('aulapro_gemini_key');
  });

  it('una ficha con apoyos visuales edita sus pasos, su «Recuerda» y la consigna de cada ejercicio', async () => {
    const visual: Ficha = {
      ...ficha, id: 'fv',
      content: {
        ...ficha.content, estilo: 'clasico', historia: undefined, visual: true,
        conceptos: [{ picto: 'apple', titulo: 'Fracción', texto: 'Una parte de algo.' }],
        actividades: [{
          titulo: 'Motor', indicacion: 'Primero, lee. Luego, rodea.',
          pasos: [{ picto: 'read-book', verbo: 'Lee', detalle: 'cada frase' }],
          recuerda: [{ texto: 'La mitad es 1/2.' }],
          ejercicios: [{ tipo: 'abierta', enunciado: 'Explica qué es una fracción.', consigna: 'write', solucion: '—' }],
        }],
      },
    };
    const onSave = setup(vi.fn(), [visual]);
    await userEvent.click(screen.getByText('Rescate en el planeta Fracción'));
    expect(screen.getByDisplayValue('Primero, lee. Luego, rodea.')).toBeTruthy();
    expect(screen.getByDisplayValue('Una parte de algo.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Consigna: Escribir' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Verbo del paso 1'), { target: { value: 'Mira' } });
    await userEvent.click(screen.getByRole('button', { name: /Añadir paso/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Quitar «Recuerda» 1' }));
    await userEvent.click(screen.getByRole('button', { name: /^Guardar$/ }));
    const act = onSave.mock.calls[0][0].content.actividades[0];
    expect(act.pasos).toEqual([{ picto: 'read-book', verbo: 'Mira', detalle: 'cada frase' }, { picto: 'write', verbo: '', detalle: '' }]);
    expect(act.recuerda).toEqual([]);
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

describe('Recursos · ficha adaptada (PT y AL)', () => {
  it('al elegir un alumno de apoyo se rellenan su nivel y lo que necesita, sin su nombre', async () => {
    const user = userEvent.setup();
    const apoyo = {
      alumnos: [{ id: 'a1', nombre: 'Marta Gil', claseOrigen: '4º B', matricula: { etapa: 'primaria' as const, curso: 4 }, nivel: { etapa: 'primaria' as const, curso: 2 },
        categorias: ['Discapacidad intelectual'], diagnostico: 'Discapacidad intelectual leve', necesidades: 'Aprende mejor con apoyo visual.', notas: '' }],
      grupos: [], programas: [], sesiones: [], documentos: [], coordinaciones: [], agendas: [], fotos: [],
    };
    render(
      <I18nProvider><ToastProvider>
        <Resources classes={[]} fichas={[]} onSave={() => {}} onDelete={() => {}} onNav={() => {}} apoyo={apoyo} />
      </ToastProvider></I18nProvider>,
    );
    const visual = screen.getByRole('checkbox', { name: /Instrucciones muy visuales/ }) as HTMLInputElement;
    expect(visual.checked).toBe(false);
    await user.selectOptions(screen.getByLabelText('Adaptada a'), 'a1');
    expect((screen.getByLabelText('Nivel o curso') as HTMLInputElement).value).toBe('2º Primaria');
    // Para un alumno de apoyo, las instrucciones salen muy visuales (se puede desmarcar)
    expect(visual.checked).toBe(true);
    const contexto = (screen.getByLabelText('Cómo es el grupo (opcional)') as HTMLTextAreaElement).value;
    expect(contexto).toContain('Aprende mejor con apoyo visual.');
    expect(contexto).not.toContain('Marta');
    expect(contexto).not.toContain('leve');
    // Volver a «Sin alumno concreto» lo vacía
    await user.selectOptions(screen.getByLabelText('Adaptada a'), '');
    expect((screen.getByLabelText('Cómo es el grupo (opcional)') as HTMLTextAreaElement).value).toBe('');
  });
});
