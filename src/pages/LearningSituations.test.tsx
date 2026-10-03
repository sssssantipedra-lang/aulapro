// @vitest-environment jsdom
/**
 * Situaciones de aprendizaje: la biblioteca muestra las guardadas como
 * tarjetas, al abrir una se lee como documento (con índice) y se vuelve a la
 * biblioteca; «Nueva» abre el formulario.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LearningSituations } from './LearningSituations';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { Class, LearningSituation } from '../types';
import type { ComunidadId } from '../lib/curriculum/comunidades';

// Con clave de IA, para que el botón de generar funcione; la generación en sí
// no importa aquí y no llega a llamar a nadie.
const generateSda = vi.hoisted(() => vi.fn(async () => null));
vi.mock('../services/gemini', async importOriginal => ({
  ...await importOriginal<typeof import('../services/gemini')>(), hasApiKey: () => true,
}));
vi.mock('../services/learningSituations', async importOriginal => ({
  ...await importOriginal<typeof import('../services/learningSituations')>(), generateSda,
}));

afterEach(cleanup);
beforeAll(() => {
  // jsdom no trae IntersectionObserver ni scrollTo
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} takeRecords() { return []; } root = null; rootMargin = ''; thresholds = []; } as unknown as typeof IntersectionObserver;
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const sda: LearningSituation = {
  id: 'sda1', at: '2026-09-29T10:00:00Z', date: '2026-09-29', title: 'Mercado sostenible',
  request: { idea: 'mercado', numero: '2', temporalizacion: '1ª evaluación', meses: '', areas: ['Matemáticas'], numSesiones: 2, nivel: '3º ESO', contextoClase: '', metodologia: '' },
  content: {
    titulo: 'Mercado sostenible', justificacion: 'Reducir residuos del centro.', ods: '', objetivosEtapa: '', competenciasClave: 'STEM y CCL',
    explicacionCurricular: '', areas: [{ area: 'Matemáticas', competenciasEspecificas: 'CE1', criteriosEvaluacion: '1.1', saberesBasicos: 'Estadística' }],
    inclusionUniversal: '', inclusionAdicional: '', inclusionIndividualizada: '',
    sesiones: [{ fase: 'Activación', titulo: 'Recuento', descripcion: 'Contar residuos' }, { fase: 'Producto final', titulo: 'Mercado', descripcion: 'Celebrarlo' }],
    metodologia: 'ABP', agrupamiento: '', recursos: '', productoFinal: 'Un mercado', evaluacionTecnicas: '', evaluacionInstrumentos: '',
  },
};

function setup(list: LearningSituation[]) {
  render(
    <I18nProvider>
      <ToastProvider>
        <LearningSituations
          classes={[]} gradeCategories={[]} learningSituations={list} teacherName="Ana"
          onUpdateClass={() => {}} onSave={() => {}} onDelete={() => {}} onAddRubric={() => {}} onAddDiana={() => {}} onAddFicha={() => {}} onNav={() => {}}
        />
      </ToastProvider>
    </I18nProvider>,
  );
}

describe('Situaciones de aprendizaje', () => {
  it('sin ninguna, invita a crear la primera y abre el formulario', async () => {
    const user = userEvent.setup();
    setup([]);
    expect(screen.getByText('Todavía no tienes ninguna situación de aprendizaje')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Crear la primera/ }));
    expect(screen.getByLabelText(/Idea de la situación de aprendizaje/)).toBeTruthy();
  });

  it('abre una guardada como documento y vuelve a la biblioteca', async () => {
    const user = userEvent.setup();
    setup([sda]);
    await user.click(screen.getByRole('button', { name: /Mercado sostenible/ }));

    expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Mercado sostenible');
    expect(screen.getByRole('navigation', { name: 'Apartados' })).toBeTruthy();
    expect(screen.getByText('Recuento')).toBeTruthy();
    expect(screen.getByText('STEM')).toBeTruthy();

    // Un apartado se lee como texto y solo se edita al pulsar el lápiz
    expect(screen.queryByRole('textbox', { name: 'Justificación' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Editar «Justificación»' }));
    expect(screen.getByRole('textbox', { name: 'Justificación' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Mis situaciones de aprendizaje/ }));
    expect(screen.getAllByRole('button', { name: /Nueva situación de aprendizaje/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Mercado sostenible/ })).toBeTruthy();
  });

  it('en Materiales › Ficha se elige ficha, escape room o tarjetas', async () => {
    const user = userEvent.setup();
    setup([sda]);
    await user.click(screen.getByRole('button', { name: /Mercado sostenible/ }));
    await user.click(screen.getByRole('tab', { name: /Ficha/ }));
    const escape = screen.getByRole('radio', { name: /Escape room/ });
    await user.click(escape);
    expect(escape.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('button', { name: /Crear escape room/ })).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: /Tarjetas recortables/ }));
    expect(screen.getByLabelText('Nº de tarjetas')).toBeTruthy();
  });
});

describe('currículo de la comunidad en el formulario', () => {
  const quintoA: Class = {
    id: 'c1', name: '5º A', subject: 'Mates', subjects: ['Mates', 'Ciencias'], room: '', color: '#0284c7',
    etapa: 'primaria', curso: 5,
  };
  const sinNivel: Class = { id: 'c2', name: '5º B', subject: 'Mates', subjects: ['Mates'], room: '', color: '#10b981' };

  async function abrirFormulario(classes: Class[], comunidad: ComunidadId = 'cataluna') {
    const user = userEvent.setup();
    const onUpdateClass = vi.fn();
    render(
      <I18nProvider>
        <ToastProvider>
          <LearningSituations
            classes={classes} gradeCategories={[]} learningSituations={[]} teacherName="Ana" comunidad={comunidad}
            onUpdateClass={onUpdateClass} onSave={() => {}} onDelete={() => {}} onAddRubric={() => {}}
            onAddDiana={() => {}} onAddFicha={() => {}} onNav={() => {}}
          />
        </ToastProvider>
      </I18nProvider>,
    );
    await user.click(screen.getByRole('button', { name: /Crear la primera/ }));
    return { user, onUpdateClass };
  }

  it('con una clase que ya tiene nivel: un resumen con el decreto, sin volver a preguntar etapa y curso', async () => {
    const { user } = await abrirFormulario([quintoA]);
    await user.selectOptions(screen.getByLabelText('Clase', { selector: '#learningsituations-f3' }), 'c1');

    expect(screen.queryByLabelText('Etapa (currículo oficial)')).toBeNull();
    expect(screen.getByRole('button', { name: 'Cambiar en la clase' })).toBeTruthy();
    expect(screen.getAllByText(/5º de Primaria/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Currículo: Real Decreto 157\/2022, de 1 de marzo/)).toBeTruthy();
    // Cataluña aún no está copiada: se avisa en pantalla
    expect(screen.getByText(/Aula Pro aún no tiene el decreto de tu comunidad \(Cataluña\)/)).toBeTruthy();
  });

  it('«Fuera de España» cita el estatal sin avisar de nada', async () => {
    const { user } = await abrirFormulario([quintoA], 'fuera');
    await user.selectOptions(screen.getByLabelText('Clase', { selector: '#learningsituations-f3' }), 'c1');
    expect(screen.getByText(/Currículo: Real Decreto 157\/2022/)).toBeTruthy();
    expect(screen.queryByText(/aún no tiene el decreto/)).toBeNull();
  });

  it('pregunta la materia oficial del área que no tiene alias seguro, y lo recuerda en la clase', async () => {
    const { user, onUpdateClass } = await abrirFormulario([quintoA]);
    await user.selectOptions(screen.getByLabelText('Clase', { selector: '#learningsituations-f3' }), 'c1');

    // «Mates» tiene alias seguro; «Ciencias» no
    expect(screen.queryByLabelText('«Mates»: ¿qué materia oficial es?')).toBeNull();
    const ciencias = screen.getByLabelText('«Ciencias»: ¿qué materia oficial es?');
    await user.selectOptions(ciencias, 'Conocimiento del Medio Natural, Social y Cultural');

    expect(onUpdateClass).toHaveBeenCalledWith(expect.objectContaining({
      id: 'c1', materiasOficiales: { Ciencias: 'Conocimiento del Medio Natural, Social y Cultural' },
    }));
    // Sigue a la vista por si se quiere corregir
    expect((screen.getByLabelText('«Ciencias»: ¿qué materia oficial es?') as HTMLSelectElement).value)
      .toBe('Conocimiento del Medio Natural, Social y Cultural');
  });

  it('una clase sin nivel pide etapa y curso, avisa de que se guardarán y los guarda al generar', async () => {
    const { user, onUpdateClass } = await abrirFormulario([quintoA, sinNivel]);
    // Primero una con nivel y luego la otra: no debe heredar el curso de la primera
    await user.selectOptions(screen.getByLabelText('Clase', { selector: '#learningsituations-f3' }), 'c1');
    await user.selectOptions(screen.getByLabelText('Clase', { selector: '#learningsituations-f3' }), 'c2');
    expect((screen.getByLabelText('Etapa (currículo oficial)') as HTMLSelectElement).value).toBe('');

    await user.selectOptions(screen.getByLabelText('Etapa (currículo oficial)'), 'primaria');
    await user.selectOptions(screen.getByLabelText('Curso'), '3');
    expect(screen.getByText('Se guardarán en la clase «5º B» para las próximas situaciones de aprendizaje.')).toBeTruthy();

    await user.type(screen.getByLabelText(/Idea de la situación de aprendizaje/), 'Un huerto');
    await user.click(screen.getByRole('button', { name: /Generar situación de aprendizaje/ }));

    expect(onUpdateClass).toHaveBeenCalledWith(expect.objectContaining({ id: 'c2', etapa: 'primaria', curso: 3 }));
    expect(generateSda).toHaveBeenCalledWith(
      expect.objectContaining({ etapa: 'primaria', curso: 3, comunidad: 'cataluna' }), 'es', expect.anything(),
    );
  });
});

describe('de qué decreto sale una SdA ya generada', () => {
  const conNormativa = (normativa: NonNullable<LearningSituation['content']['normativa']>): LearningSituation =>
    ({ ...sda, content: { ...sda.content, normativa } });

  it('cita el decreto y, si fue el estatal por falta del de la comunidad, lo avisa', async () => {
    const user = userEvent.setup();
    setup([conNormativa({ comunidad: 'madrid', origen: 'estatal', cita: 'Real Decreto 217/2022, de 29 de marzo (BOE núm. 76, de 30 de marzo de 2022)' })]);
    await user.click(screen.getByRole('button', { name: /Mercado sostenible/ }));
    expect(screen.getByText('Currículo: Real Decreto 217/2022, de 29 de marzo (BOE núm. 76, de 30 de marzo de 2022)')).toBeTruthy();
    expect(screen.getByText(/Aula Pro aún no tiene el decreto de tu comunidad \(Comunidad de Madrid\)/)).toBeTruthy();
  });

  it('con el decreto de la comunidad, solo la cita', async () => {
    const user = userEvent.setup();
    setup([conNormativa({ comunidad: 'madrid', origen: 'autonomico', cita: 'Decreto 65/2022, de 20 de julio (BOCM núm. 176, de 26 de julio de 2022)' })]);
    await user.click(screen.getByRole('button', { name: /Mercado sostenible/ }));
    expect(screen.getByText(/Currículo: Decreto 65\/2022/)).toBeTruthy();
    expect(screen.queryByText(/aún no tiene el decreto/)).toBeNull();
  });

  it('marca las áreas que llevan el texto oficial del decreto, y no las que redactó la IA', async () => {
    const user = userEvent.setup();
    setup([{ ...sda, content: { ...sda.content, areas: [
      { ...sda.content.areas[0], oficial: true },
      { area: 'Religión', competenciasEspecificas: 'Libre', criteriosEvaluacion: 'Libre', saberesBasicos: 'Libre' },
    ] } }]);
    await user.click(screen.getByRole('button', { name: /Mercado sostenible/ }));
    const marcas = screen.getAllByText('Texto oficial');
    expect(marcas).toHaveLength(1);
    expect(marcas[0].closest('summary')?.textContent).toContain('Matemáticas');
  });

  it('una SdA anterior, sin normativa guardada, no cita nada', async () => {
    const user = userEvent.setup();
    setup([sda]);
    await user.click(screen.getByRole('button', { name: /Mercado sostenible/ }));
    expect(screen.queryByText(/^Currículo: /)).toBeNull();
  });
});

