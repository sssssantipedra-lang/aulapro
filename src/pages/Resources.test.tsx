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
const generar = vi.hoisted(() => vi.fn());
vi.mock('../services/resources', async orig => ({
  ...(await orig<typeof import('../services/resources')>()),
  generateFicha: generar,
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

describe('Recursos — autoguardado', () => {
  afterEach(() => { generar.mockClear(); localStorage.clear(); });
  it('una ficha generada y sin guardar queda como borrador al salir, y se continúa al volver', async () => {
    localStorage.clear();
    localStorage.setItem('aulapro_gemini_key', 'AIzaTEST');
    generar.mockResolvedValueOnce({ ...ficha.content, titulo: 'Fracciones con pizzas', historia: undefined, estilo: 'cuaderno' });
    const user = userEvent.setup();
    const antes = render(
      <I18nProvider><ToastProvider><Resources classes={[]} fichas={[]} onSave={() => {}} onDelete={() => {}} onNav={() => {}} /></ToastProvider></I18nProvider>,
    );
    await user.type(screen.getByLabelText('¿De qué va la ficha?'), 'fracciones');
    await user.click(screen.getByRole('button', { name: /Crear ficha/ }));
    expect(await screen.findByDisplayValue('Fracciones con pizzas')).toBeTruthy();
    // Se va a otra pantalla sin guardar: la copia queda hecha
    antes.unmount();

    setup(vi.fn(), []);
    expect(screen.getByText(/Te quedó una ficha sin guardar: «Fracciones con pizzas»/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByDisplayValue('Fracciones con pizzas')).toBeTruthy();
    expect(screen.getByText('Sin guardar')).toBeTruthy();
  });

  it('al guardarla, la copia se borra y no se vuelve a ofrecer', async () => {
    localStorage.clear();
    localStorage.setItem('aulapro_gemini_key', 'AIzaTEST');
    generar.mockResolvedValueOnce({ ...ficha.content, titulo: 'Fracciones con pizzas', historia: undefined, estilo: 'cuaderno' });
    const user = userEvent.setup();
    const onSave = vi.fn();
    const antes = render(
      <I18nProvider><ToastProvider><Resources classes={[]} fichas={[]} onSave={onSave} onDelete={() => {}} onNav={() => {}} /></ToastProvider></I18nProvider>,
    );
    await user.type(screen.getByLabelText('¿De qué va la ficha?'), 'fracciones');
    await user.click(screen.getByRole('button', { name: /Crear ficha/ }));
    await screen.findByDisplayValue('Fracciones con pizzas');
    await user.click(screen.getByRole('button', { name: /Guardar$/ }));
    expect(onSave).toHaveBeenCalledOnce();
    antes.unmount();
    setup(vi.fn(), []);
    expect(screen.queryByText(/Te quedó una ficha sin guardar/)).toBeNull();
  });
});

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
    // Los ejercicios salen en una línea cada uno; se abren al tocarlos
    expect(screen.queryByDisplayValue('Marca V o F.')).toBeNull();
    expect(screen.getByText('Marca V o F.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Editar el ejercicio 1' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Editar el ejercicio 1' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Editar el ejercicio 2' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Editar el ejercicio 1' }));
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
    const visual = screen.getByRole('checkbox', { name: /Con pictogramas/ }) as HTMLInputElement;
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

describe('Recursos · diseño «Cuaderno»', () => {
  const cuaderno: Ficha = {
    id: 'f2', at: '2026-10-14T10:00:00Z', date: '2026-10-14', title: 'Números hasta el millón',
    request: { tema: 'Números hasta el millón', area: 'Matemáticas', nivel: '5º', numEjercicios: 2, niveles: false, contextoClase: '' },
    content: {
      estilo: 'cuaderno', titulo: 'Matemáticas 5.º Primaria', explicacion: '', instrucciones: '',
      actividades: [{
        titulo: 'Descomponemos números',
        ejercicios: [{ tipo: 'calculos', enunciado: 'Descompón estos números:', lineas: ['583.742', '75.830'], respuesta: 'linea', solucion: '' }],
      }],
    },
  };

  it('al crear, «Cuaderno» es el aspecto elegido y se explica en una línea', () => {
    setup();
    expect(screen.getByRole('radio', { name: /Cuaderno/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/Una hoja de cuaderno de colegio/)).toBeTruthy();
  });

  it('edita la lista de cálculos y su respuesta, y la vista previa la pinta con su caja', async () => {
    const onSave = setup(vi.fn(), [cuaderno]);
    await userEvent.click(screen.getByText('Números hasta el millón'));
    expect(screen.getByText('Actividad 1')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Editar el ejercicio 1' }));
    const select = screen.getByDisplayValue('Una línea') as HTMLSelectElement;
    await userEvent.selectOptions(select, 'caja');
    const frame = document.querySelector('.fe-preview-frame') as HTMLIFrameElement;
    await waitFor(() => expect(frame.contentDocument?.querySelector('.cq-calculos.con-caja')).toBeTruthy(), { timeout: 2000 });
    await userEvent.click(screen.getByRole('button', { name: /^Guardar$/ }));
    expect(onSave.mock.calls[0][0].content.actividades[0].ejercicios[0].respuesta).toBe('caja');
  });

  it('añade un recuadro «Reto» a un bloque y llega a la hoja', async () => {
    const onSave = setup(vi.fn(), [cuaderno]);
    await userEvent.click(screen.getByText('Números hasta el millón'));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Recuadro del bloque' }), 'reto');
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto del recuadro' }), { target: { value: '¿Cuál es la cifra mayor?' } });
    const frame = document.querySelector('.fe-preview-frame') as HTMLIFrameElement;
    await waitFor(() => expect(frame.contentDocument?.querySelector('.cq-nota.reto')?.textContent).toContain('¿Cuál es la cifra mayor?'), { timeout: 2000 });
    await userEvent.click(screen.getByRole('button', { name: /^Guardar$/ }));
    expect(onSave.mock.calls[0][0].content.actividades[0].recuadro).toEqual({ tipo: 'reto', texto: '¿Cuál es la cifra mayor?' });
    // Y se puede quitar
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Recuadro del bloque' }), '');
    await userEvent.click(screen.getByRole('button', { name: /^Guardar$/ }));
    expect(onSave.mock.calls[1][0].content.actividades[0].recuadro).toBeUndefined();
  });
});

describe('Recursos · crear en dos pasos', () => {
  const lectura = {
    titulo: 'El dragón sin fuego', explicacion: '', instrucciones: 'Lee el texto.', estilo: 'cuaderno', formato: 'ficha',
    lectura: { genero: 'cuento', parrafos: ['Un dragón vivía solo.', 'Un día encontró un amigo.'], dibujos: [{ ilustracion: 'cue-dragon', parrafo: 0 }], pista: 'Fíjate en el dragón.', destrezas: ['Vocabulario'] },
    actividades: [{ titulo: 'Buscamos', dificultad: 1, ejercicios: [{ tipo: 'en_texto', enunciado: 'Rodea al dragón.', lineasRespuesta: 1, solucion: 'dragón' }] }],
  };

  it('el primer paso son cuatro tarjetas grandes; la comprensión lectora pide el tipo de texto y quita lo que no le sirve', async () => {
    setup(vi.fn(), []);
    const tipos = screen.getAllByRole('radio').filter(r => r.classList.contains('fe-tipo'));
    expect(tipos.map(t => t.querySelector('.ev-card-ttl')?.textContent)).toEqual(['Ficha de ejercicios', 'Comprensión lectora', 'Escape room', 'Tarjetas']);
    expect(tipos[0].getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('checkbox', { name: /Con pictogramas/ })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Poema' })).toBeNull();
    await userEvent.click(tipos[1]);
    expect(tipos[1].getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Poema' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Que elija la IA', checked: true })).toBeTruthy();
    // Sin pictogramas ni aspecto a elegir: la comprensión lectora es siempre «Cuaderno»
    expect(screen.queryByRole('checkbox', { name: /Con pictogramas/ })).toBeNull();
    expect(screen.queryByText('Aspecto de la ficha')).toBeNull();
    // Y propone 8 ejercicios
    expect((screen.getByLabelText('Nº de ejercicios') as HTMLInputElement).value).toBe('8');
    expect(screen.getByRole('button', { name: /Crear comprensión lectora/ })).toBeTruthy();
  });

  it('el número de ejercicios que traía el tipo cambia con él, pero uno cambiado a mano se respeta', async () => {
    setup(vi.fn(), []);
    const n = () => (screen.getByLabelText('Nº de ejercicios') as HTMLInputElement).value;
    expect(n()).toBe('6');
    await userEvent.click(screen.getByRole('radio', { name: /Comprensión lectora/ }));
    expect(n()).toBe('8');
    fireEvent.change(screen.getByLabelText('Nº de ejercicios'), { target: { value: '5' } });
    await userEvent.click(screen.getByRole('radio', { name: /Ficha de ejercicios/ }));
    expect(n()).toBe('5');
    await userEvent.click(screen.getByRole('radio', { name: /Tarjetas/ }));
    expect(screen.queryByRole('checkbox', { name: /Lectura fácil/ })).toBeNull();
  });

  it('crea una comprensión lectora en lectura fácil: la petición lleva el tipo de texto y la lectura fácil, y se abre el editor del texto', async () => {
    localStorage.setItem('aulapro_gemini_key', 'AIzaTEST');
    generar.mockResolvedValueOnce(lectura);
    setup(vi.fn(), []);
    await userEvent.click(screen.getByRole('radio', { name: /Comprensión lectora/ }));
    await userEvent.click(screen.getByRole('radio', { name: 'Poema' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Lectura fácil/ }));
    await userEvent.type(screen.getByLabelText('¿De qué va la ficha?'), 'un dragón');
    await userEvent.click(screen.getByRole('button', { name: /Crear comprensión lectora/ }));
    const pedido = generar.mock.calls[0][0];
    expect(pedido).toMatchObject({ tema: 'un dragón', lectura: true, generoLectura: 'poema', facil: true, estilo: 'cuaderno', formato: 'ficha', visual: false, numEjercicios: 8 });
    // El editor: el texto con sus párrafos y sin el selector de aspecto (siempre «Cuaderno»)
    expect(await screen.findByText(/El texto/)).toBeTruthy();
    expect(screen.getByDisplayValue('Un día encontró un amigo.')).toBeTruthy();
    expect(screen.queryByText('Aspecto')).toBeNull();
    expect(screen.queryByText('Antes de empezar')).toBeNull();
    // La vista previa pinta el texto y se puede cambiar
    fireEvent.change(screen.getByDisplayValue('Un día encontró un amigo.'), { target: { value: 'Un día llegó un mago.' } });
    const frame = document.querySelector('.fe-preview-frame') as HTMLIFrameElement;
    await waitFor(() => expect(frame.contentDocument?.querySelector('.lc-texto')?.textContent).toContain('Un día llegó un mago.'), { timeout: 2000 });
  });

  it('una ficha normal con lectura fácil: la petición la lleva; con tarjetas, no', async () => {
    localStorage.setItem('aulapro_gemini_key', 'AIzaTEST');
    generar.mockResolvedValue(lectura);
    setup(vi.fn(), []);
    await userEvent.type(screen.getByLabelText('¿De qué va la ficha?'), 'las sumas');
    await userEvent.click(screen.getByRole('checkbox', { name: /Lectura fácil/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Crear ficha$/ }));
    expect(generar.mock.calls.at(-1)![0]).toMatchObject({ lectura: false, facil: true });
  });

  it('el menú «Adaptar» de una comprensión lectora solo ofrece la lectura fácil', async () => {
    localStorage.setItem('aulapro_gemini_key', 'AIzaTEST');
    const f: Ficha = { id: 'fl', at: '2026-10-17T10:00:00Z', date: '2026-10-17', title: 'El dragón sin fuego', request: { tema: 'dragón', area: 'Lengua', nivel: '3º', numEjercicios: 1, niveles: false, contextoClase: '' }, content: lectura as never };
    setup(vi.fn(), [f]);
    expect(screen.getByText('Comprensión lectora', { selector: '.fe-mini-badge' })).toBeTruthy();
    await userEvent.click(screen.getByText('El dragón sin fuego'));
    await userEvent.click(screen.getByRole('button', { name: /Adaptar/ }));
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('Lectura fácil');
  });

  it('el aspecto y el hilo de una ficha de ejercicios van recogidos en una fila; el texto del Cuaderno se abre con «Cambiar»', async () => {
    setup(vi.fn(), [{ ...ficha, content: { ...ficha.content, estilo: 'cuaderno', historia: undefined } }]);
    await userEvent.click(screen.getByText('Rescate en el planeta Fracción'));
    expect(screen.getByText('Aspecto')).toBeTruthy();
    expect((document.querySelector('.fe-look') as HTMLDetailsElement).open).toBe(false);
  });
});
