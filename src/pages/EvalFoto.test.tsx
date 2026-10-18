// @vitest-environment jsdom
/**
 * Evaluar por foto: se eligen alumno y fotos, la IA propone los puntos de cada
 * pregunta, el docente los corrige, la nota la recalcula el código y pasa al
 * cuaderno; «Siguiente alumno» deja las mismas opciones. A la IA no le llega el
 * nombre del alumno.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvalFoto } from './EvalFoto';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { Class, GradeCategory, GradeItem, Student } from '../types';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('../services/gemini', async importOriginal => {
  const real = await importOriginal<typeof import('../services/gemini')>();
  return { ...real, callGemini, hasApiKey: () => true };
});
// En jsdom no hay lienzo para reducir la foto
vi.mock('../lib/fotos', async importOriginal => {
  const real = await importOriginal<typeof import('../lib/fotos')>();
  return { ...real, fotoParaIA: async () => ({ name: 'foto.jpg', mimeType: 'image/jpeg', base64: 'QUJD' }) };
});

const clase = { id: 'c1', name: '5º A', subject: 'Matemáticas', subjects: ['Matemáticas'], etapa: 'primaria', curso: 5 } as Class;
const alumnos: Student[] = [14, 1, 5].map(n => ({ id: `s${n}`, class_id: 'c1', name: `Alumno ${n}`, email: '', photo: null, alerts: [], notes: '' }));
const categorias: GradeCategory[] = [{ id: 'cat1', class_id: 'c1', name: 'Exámenes', weight: 60, subject: 'Matemáticas' }];

const respuesta = JSON.stringify({
  titulo: 'Examen de fracciones', comentarioGeneral: 'Buen examen, sigue así.', puntosFuertes: ['Suma bien'], aMejorar: ['Simplificar'], avisos: [],
  preguntas: [
    { n: '1', enunciado: '1/2 + 1/4', respuesta: '3/4', puntosMax: 4, puntos: 4, estado: 'correcta', comentario: 'Bien', dudosa: false },
    { n: '2', enunciado: 'Simplifica 6/8', respuesta: '6/8', puntosMax: 3, puntos: 1, estado: 'incorrecta', comentario: 'Faltaba simplificar', dudosa: true },
    { n: '3', enunciado: 'Problema', respuesta: '2/3', puntosMax: 3, puntos: 3, estado: 'correcta', comentario: 'Bien', dudosa: false },
  ],
});

function pintar(items: GradeItem[] = []) {
  const añadidos: GradeItem[] = [];
  const notas: [string, string, number | null][] = [];
  render(
    <I18nProvider><ToastProvider>
      <EvalFoto classes={[clase]} students={alumnos} gradeCategories={categorias} gradeItems={items}
        onAddGradeItem={i => añadidos.push(i)} onSetGrade={(i, s, v) => notas.push([i, s, v])} onNav={() => {}} />
    </ToastProvider></I18nProvider>,
  );
  return { añadidos, notas };
}

async function conFoto() {
  fireEvent.change(screen.getByLabelText('Fotos del examen o del trabajo'), { target: { files: [new File(['x'], 'p1.jpg', { type: 'image/jpeg' })] } });
  await screen.findByAltText('Página 1');
}

beforeEach(() => { localStorage.clear(); callGemini.mockReset(); window.scrollTo = () => {}; });
afterEach(() => cleanup());

describe('Evaluar por foto · autoguardado', () => {
  it('una corrección sin guardar en el cuaderno se conserva al salir (sin las fotos) y se continúa con los puntos ya cambiados', async () => {
    const user = userEvent.setup();
    const antes = render(
      <I18nProvider><ToastProvider>
        <EvalFoto classes={[clase]} students={alumnos} gradeCategories={categorias} gradeItems={[]} onAddGradeItem={() => {}} onSetGrade={() => {}} onNav={() => {}} />
      </ToastProvider></I18nProvider>,
    );
    await user.selectOptions(screen.getByLabelText('Alumno'), 's5');
    await conFoto();
    callGemini.mockResolvedValue(respuesta);
    await user.click(screen.getByRole('button', { name: /Corregir con IA/ }));
    await screen.findByText('Examen de fracciones');
    const p2 = screen.getByLabelText('Puntos de la pregunta 2');
    await user.clear(p2);
    await user.type(p2, '3');
    antes.unmount();

    pintar();
    expect(screen.getByText(/Te quedó una corrección sin guardar: «Alumno 5: Examen de fracciones»/)).toBeTruthy();
    expect(screen.getByText(/Las fotos no se guardan/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect((screen.getByLabelText('Puntos de la pregunta 2') as HTMLInputElement).value).toBe('3');
    expect(screen.getByLabelText('Nota').textContent).toContain('10');
    expect((screen.getByLabelText('Alumno') as HTMLSelectElement).value).toBe('s5');
  });
});

describe('Evaluar por foto', () => {
  it('el alumnado sale en orden de lista y sin la IA no se corrige hasta que hay una foto', async () => {
    pintar();
    const opciones = within(screen.getByLabelText('Alumno')).getAllByRole('option').map(o => o.textContent);
    expect(opciones).toEqual(['Elige el alumno', 'Alumno 1', 'Alumno 5', 'Alumno 14']);
    expect((screen.getByRole('button', { name: /Corregir con IA/ }) as HTMLButtonElement).disabled).toBe(true);
    await conFoto();
    expect((screen.getByRole('button', { name: /Corregir con IA/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('la IA propone, el docente corrige los puntos, la nota la recalcula el código y pasa al cuaderno', async () => {
    const user = userEvent.setup();
    const { añadidos, notas } = pintar();
    await user.selectOptions(screen.getByLabelText('Alumno'), 's5');
    await user.type(screen.getByLabelText(/Soluciones y criterios, escritos/), '1) 3/4. 2) 3/4. 3) 2/3.');
    await conFoto();
    callGemini.mockResolvedValue(respuesta);
    await user.click(screen.getByRole('button', { name: /Corregir con IA/ }));

    // Lo que se le manda a la IA: las fotos y los criterios; nunca el nombre del alumno
    const prompt = callGemini.mock.calls[0][1] as string;
    expect(callGemini.mock.calls[0][2]).toHaveLength(1);
    expect(prompt).toContain('1) 3/4. 2) 3/4. 3) 2/3.');
    expect(prompt).toContain('Matemáticas, 5º Primaria');
    expect(prompt).not.toContain('Alumno 5');

    // La nota sale de los puntos: 4 + 1 + 3 de 10
    expect(await screen.findByText('Examen de fracciones')).toBeTruthy();
    expect(screen.getByText('8 de 10 puntos')).toBeTruthy();
    expect(screen.getByLabelText('Nota').textContent).toContain('8');
    expect(screen.getAllByText('Revísala')).toHaveLength(1);
    expect(screen.getAllByText('Ha escrito:')).toHaveLength(3);
    expect(screen.getByText('6/8')).toBeTruthy();

    // El docente da 3 en la pregunta 2: la nota sube y se nota que la cambió
    const p2 = screen.getByLabelText('Puntos de la pregunta 2');
    await user.clear(p2);
    await user.type(p2, '2,5');
    expect(screen.getByText(/9.5 de 10 puntos|9,5 de 10 puntos/)).toBeTruthy();
    expect(screen.getByText(/has cambiado 1 pregunta/)).toBeTruthy();
    // Y no puede pasarse del máximo de la pregunta
    await user.clear(p2);
    await user.type(p2, '9');
    expect(screen.getByLabelText('Nota').textContent).toContain('10');

    await user.click(screen.getByRole('button', { name: /Guardar la nota en el cuaderno/ }));
    expect(añadidos).toHaveLength(1);
    expect(añadidos[0]).toMatchObject({ class_id: 'c1', category_id: 'cat1', name: 'Examen de fracciones' });
    expect(notas).toEqual([[añadidos[0].id, 's5', 10]]);
  });

  it('al guardar a otro alumno del mismo examen, usa la columna que ya existe y «Siguiente alumno» deja las opciones', async () => {
    const user = userEvent.setup();
    const existente: GradeItem = { id: 'gi1', class_id: 'c1', category_id: 'cat1', name: 'Examen de fracciones', date: '2026-10-18' };
    const { añadidos, notas } = pintar([existente]);
    await user.selectOptions(screen.getByLabelText('Alumno'), 's1');
    await conFoto();
    callGemini.mockResolvedValue(respuesta);
    await user.click(screen.getByRole('button', { name: /Corregir con IA/ }));
    await screen.findByText('Examen de fracciones');
    await user.click(screen.getByRole('button', { name: /Guardar la nota en el cuaderno/ }));
    expect(añadidos).toEqual([]);
    expect(notas).toEqual([['gi1', 's1', 8]]);

    await user.click(screen.getByRole('button', { name: /Siguiente alumno/ }));
    // Pasa al siguiente de la lista, con las fotos y la corrección vacías y el nombre de la columna puesto
    expect((screen.getByLabelText('Alumno') as HTMLSelectElement).value).toBe('s5');
    expect(screen.queryByAltText('Página 1')).toBeNull();
    expect(screen.queryByText('Examen de fracciones', { selector: '.home-card-ttl' })).toBeNull();
    expect((screen.getByLabelText('Nombre en el cuaderno') as HTMLInputElement).value).toBe('Examen de fracciones');
    expect(within(screen.getByLabelText('Alumno')).getByRole('option', { name: '✓ Alumno 1' })).toBeTruthy();
  });

  it('si la IA no devuelve nada utilizable, lo dice y no inventa una nota', async () => {
    const user = userEvent.setup();
    pintar();
    await conFoto();
    callGemini.mockResolvedValue(JSON.stringify({ titulo: 'x', preguntas: [] }));
    await user.click(screen.getByRole('button', { name: /Corregir con IA/ }));
    await waitFor(() => expect(screen.getByText(/no pudo corregirlo con esas fotos/)).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Guardar la nota/ })).toBeNull();
  });
});
