// @vitest-environment jsdom
/**
 * «Guardar como archivo» y «Abrir archivo» de un instrumento (20-11-2026): lo guardado no lleva clases ni alumnado,
 * lo abierto rellena el editor sin guardarse solo, y un archivo que no toca se rechaza diciendo por qué.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../ui/Toast';
import { Rubrics } from '../../pages/Rubrics';
import { EscalasRegistro } from '../../pages/EscalasRegistro';
import { archivoDeDiana, archivoDeRubrica } from '../../lib/archivoInstrumento';
import { setApiKey } from '../../services/gemini';
import type { Class, EvalDiana, Rubric } from '../../types';

const descargado = vi.hoisted(() => ({ archivos: [] as { texto: Promise<string>; nombre: string; carpeta?: string }[] }));
vi.mock('../../lib/download', () => ({
  downloadFile: vi.fn(async (blob: Blob, nombre: string, carpeta?: string) => { descargado.archivos.push({ texto: blob.text(), nombre, carpeta }); }),
}));

beforeEach(() => { localStorage.clear(); setApiKey(''); descargado.archivos = []; });
afterEach(cleanup);

const clase = { id: 'c1', name: '5º A', subject: 'Lengua', subjects: ['Lengua'], color: '#000', etapa: 'primaria' } as Class;
const rubrica: Rubric = {
  id: 'r1', name: 'Debate', class_id: 'c1', subject: 'Lengua', category_id: 'cat1', context: 'Para 5º A',
  criteria: [
    { id: 'k1', name: 'Argumentos', descriptors: { 1: 'Opina sin dar razones.', 2: 'Da una razón.', 3: 'Da varias razones.', 4: 'Da razones y rebate las contrarias.' }, competencies: ['CCL'] },
    { id: 'k2', name: 'Turnos', descriptors: { 1: 'Interrumpe.', 2: 'Espera a veces.', 3: 'Respeta el turno.', 4: 'Respeta el turno y da paso a otros.' } },
  ],
};
const escala: EvalDiana = { id: 'reg1', tipo: 'registro', name: 'Saque', class_id: 'c1', items: [{ id: 'i1', name: 'Golpea con la palma', weight: 1 }] };

const json = (contenido: unknown, nombre = 'instrumento.json') => new File([JSON.stringify(contenido)], nombre, { type: 'application/json' });

function pintaRubricas(rubrics: Rubric[] = [rubrica]) {
  const onAddRubric = vi.fn();
  const props = {
    rubrics, dianas: [], evaluations: [], classes: [clase], students: [], gradeCategories: [], lawDocument: null,
    onAddRubric, onUpdateRubric: () => {}, onDeleteRubric: () => {}, onAddDiana: () => {}, onUpdateDiana: () => {}, onDeleteDiana: () => {}, onAddEvaluation: () => {},
  };
  render(<I18nProvider><ToastProvider><Rubrics {...props} vista="rubrics" /></ToastProvider></I18nProvider>);
  return { onAddRubric };
}

function pintaEscalas() {
  const onAddDiana = vi.fn();
  render(
    <I18nProvider><ToastProvider>
      <EscalasRegistro dianas={[escala]} evaluations={[]} classes={[clase]} students={[]} gradeCategories={[]}
        onAddDiana={onAddDiana} onUpdateDiana={() => {}} onDeleteDiana={() => {}} onAddEvaluation={() => {}} />
    </ToastProvider></I18nProvider>,
  );
  return { onAddDiana };
}

describe('un instrumento como archivo', () => {
  it('«Guardar como archivo» descarga la rúbrica sin su clase, su cuaderno ni su contexto', async () => {
    const user = userEvent.setup();
    pintaRubricas();
    await user.click(screen.getByRole('button', { name: 'Guardar «Debate» como archivo' }));
    expect(descargado.archivos).toHaveLength(1);
    expect(descargado.archivos[0].nombre).toBe('aulapro-rubrica-debate.json');
    const texto = await descargado.archivos[0].texto;
    expect(JSON.parse(texto)).toEqual(archivoDeRubrica(rubrica));
    expect(texto).not.toMatch(/c1|cat1|5º A|Lengua/);
    expect(await screen.findByText(/Guardado como archivo, sin alumnado ni clases/)).toBeTruthy();
  });

  it('«Abrir archivo» rellena el editor, sin clase marcada, y no guarda nada hasta que el docente lo crea', async () => {
    const user = userEvent.setup();
    const { onAddRubric } = pintaRubricas([]);
    await user.upload(screen.getByLabelText('Archivo de instrumento'), json(archivoDeRubrica(rubrica)));

    const nombre = await screen.findByLabelText('Nombre de la rúbrica *') as HTMLInputElement;
    expect(nombre.value).toBe('Debate');
    expect(screen.getAllByPlaceholderText('Nombre del criterio').map(i => (i as HTMLInputElement).value)).toEqual(['Argumentos', 'Turnos']);
    expect(onAddRubric).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Crear rúbrica' }));
    const creada = onAddRubric.mock.calls[0][0] as Rubric;
    expect(creada.class_id).toBeUndefined();
    expect(creada.id).not.toBe('r1');
    expect(creada.criteria.map(c => c.name)).toEqual(['Argumentos', 'Turnos']);
    expect(creada.criteria.every(c => !['k1', 'k2'].includes(c.id))).toBe(true);
    expect(creada.criteria[0].descriptors[4]).toBe('Da razones y rebate las contrarias.');
    expect(creada.criteria[0].competencies).toEqual(['CCL']);
  });

  it('un archivo de otro instrumento dice dónde se abre, y uno que no es un instrumento, que no lo es', async () => {
    const user = userEvent.setup();
    const { onAddRubric } = pintaRubricas([]);
    const entrada = screen.getByLabelText('Archivo de instrumento');
    await user.upload(entrada, json(archivoDeDiana(escala)));
    expect(await screen.findByText('Este archivo es una escala de registro: ábrelo desde Evaluar › Escalas de registro.')).toBeTruthy();
    await user.upload(entrada, json({ classes: [], students: [] }, 'copia.json'));
    expect(await screen.findByText(/no es una rúbrica, una diana ni una escala guardada desde AulaPro/)).toBeTruthy();
    await user.upload(entrada, new File(['%PDF-1.7 esto no es JSON'], 'acta.json', { type: 'application/json' }));
    expect(await screen.findByText(/No se ha podido leer el archivo/)).toBeTruthy();
    expect(screen.queryByLabelText('Nombre de la rúbrica *')).toBeNull();
    expect(onAddRubric).not.toHaveBeenCalled();
  });

  it('una escala de registro se guarda y se abre igual, en su pantalla', async () => {
    const user = userEvent.setup();
    const { onAddDiana } = pintaEscalas();
    await user.click(screen.getByRole('button', { name: 'Guardar «Saque» como archivo' }));
    expect(descargado.archivos[0].nombre).toBe('aulapro-escala-saque.json');
    const texto = await descargado.archivos[0].texto;
    expect(texto).not.toMatch(/c1|reg1/);

    await user.upload(screen.getByLabelText('Archivo de instrumento'), new File([texto], 'aulapro-escala-saque.json', { type: 'application/json' }));
    expect((await screen.findByLabelText('Nombre *') as HTMLInputElement).value).toBe('Saque');
    expect((screen.getByLabelText('Concepto 1') as HTMLInputElement).value).toBe('Golpea con la palma');
    await user.click(screen.getByRole('button', { name: 'Crear escala' }));
    expect(onAddDiana.mock.calls[0][0]).toMatchObject({ tipo: 'registro', name: 'Saque', items: [{ name: 'Golpea con la palma', weight: 1 }] });
    expect(onAddDiana.mock.calls[0][0].id).not.toBe('reg1');
    expect(onAddDiana.mock.calls[0][0].class_id).toBeUndefined();
  });
});
