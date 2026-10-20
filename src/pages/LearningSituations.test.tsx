// @vitest-environment jsdom
/**
 * Situaciones de aprendizaje: la biblioteca muestra las guardadas como
 * tarjetas, al abrir una se lee como documento (con índice) y se vuelve a la
 * biblioteca; «Nueva» abre el formulario.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LearningSituations } from './LearningSituations';
import { guardarBorrador, leerBorrador } from '../services/borradores';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { Class, LearningSituation } from '../types';
import type { SesionEF } from '../types/ef';
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

function setup(list: LearningSituation[], onSave: (s: LearningSituation) => void = () => {}) {
  render(
    <I18nProvider>
      <ToastProvider>
        <LearningSituations
          classes={[]} gradeCategories={[]} learningSituations={list}
          onUpdateClass={() => {}} onSave={onSave} onDelete={() => {}} onAddRubric={() => {}} onAddDiana={() => {}} onAddFicha={() => {}} onNav={() => {}}
        />
      </ToastProvider>
    </I18nProvider>,
  );
}

describe('Situaciones de aprendizaje · autoguardado', () => {
  it('al volver ofrece la SdA que quedó a medias y «Continuar» la abre con sus sesiones', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    guardarBorrador('sda', {
      content: { ...sda.content, titulo: 'Un huerto en el patio' }, editingId: null, classId: '', idea: 'huerto', numero: '1', temporalizacion: '', meses: '',
      areas: ['Matemáticas'], numSesiones: 2, nivel: '3º ESO', etapa: '', curso: '', opcionMatematicas: 'A', materias: {}, contextoClase: '', metodologia: '',
      efModelo: '', efModalidad: '', efMinutos: '55', rubricRows: null, dianaRows: null, fichaContent: null,
    }, 'Un huerto en el patio');
    setup([]);
    expect(screen.getByText(/Te quedó una situación de aprendizaje sin guardar: «Un huerto en el patio»/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect((screen.getByLabelText('Título') as HTMLTextAreaElement).value).toBe('Un huerto en el patio');
    expect(screen.getByText('Recuento')).toBeTruthy();
    expect(screen.getByText('Sin guardar')).toBeTruthy();
    localStorage.clear();
  });

  it('abrir una guardada sin cambiarla no deja borrador; cambiarla y salir, sí', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    const r = render(
      <I18nProvider><ToastProvider>
        <LearningSituations classes={[]} gradeCategories={[]} learningSituations={[sda]}
          onUpdateClass={() => {}} onSave={() => {}} onDelete={() => {}} onAddRubric={() => {}} onAddDiana={() => {}} onAddFicha={() => {}} onNav={() => {}} />
      </ToastProvider></I18nProvider>,
    );
    await user.click(screen.getByRole('button', { name: /Mercado sostenible/ }));
    r.unmount();
    expect(leerBorrador('sda')).toBeNull();

    const r2 = render(
      <I18nProvider><ToastProvider>
        <LearningSituations classes={[]} gradeCategories={[]} learningSituations={[sda]}
          onUpdateClass={() => {}} onSave={() => {}} onDelete={() => {}} onAddRubric={() => {}} onAddDiana={() => {}} onAddFicha={() => {}} onNav={() => {}} />
      </ToastProvider></I18nProvider>,
    );
    await user.click(screen.getByRole('button', { name: /Mercado sostenible/ }));
    const titulo = screen.getByLabelText('Título');
    await user.clear(titulo);
    await user.type(titulo, 'Mercado muy sostenible');
    r2.unmount();
    expect(leerBorrador<{ editingId: string; content: { titulo: string } }>('sda')?.datos).toMatchObject({ editingId: 'sda1', content: { titulo: 'Mercado muy sostenible' } });
    localStorage.clear();
  });
});

describe('Situaciones de aprendizaje', () => {
  it('una sesión se marca como completada, se guarda en el acto y cuenta en el progreso', async () => {
    const user = userEvent.setup();
    const guardadas: LearningSituation[] = [];
    setup([sda], s => guardadas.push(s));
    await user.click(screen.getByRole('button', { name: /Mercado sostenible/ }));
    expect(screen.getByText('0 de 2 completadas')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Marcar la sesión 1 como completada' }));
    expect(screen.getByText('1 de 2 completadas')).toBeTruthy();
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0].content.sesiones.map(x => !!x.completada)).toEqual([true, false]);

    await user.click(screen.getByRole('button', { name: 'Marcar la sesión 1 como pendiente' }));
    expect(guardadas[1].content.sesiones.map(x => !!x.completada)).toEqual([false, false]);
  });

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

describe('sesiones de EF en preimpacto, impacto y postimpacto', () => {
  const act = (nombre: string, material = '1 balón por pareja') => ({ nombre, minutos: 10, descripcion: 'Se juega por parejas: punto si recibe en el área.', organizacion: 'Parejas en media pista', material });
  const ef: LearningSituation = {
    ...sda, id: 'ef9', title: 'Liga de voleibol', class_id: 'c1', class_name: '4º A',
    content: {
      ...sda.content, titulo: 'Liga de voleibol', ef: { modelos: ['educacion-deportiva'], referencias: [] },
      sesiones: [{
        fase: 'Desarrollo', titulo: 'El toque de dedos', descripcion: 'Se trabaja el toque en movimiento.',
        momentos: {
          preimpacto: { texto: 'Se colocan cuatro zonas con conos.', actividades: [act('Pilla-pilla de cadenas', 'ninguno')] },
          impacto: { texto: 'Progresión de 2 contra 1 a 3 contra 2.', actividades: [act('Toque y desmarque'), act('Rondo de 4 contra 1')] },
          postimpacto: { texto: 'Puesta en común con semáforo.', actividades: [act('Estiramientos en círculo', 'ninguno')] },
        },
      }],
    },
  };
  const claseEF = { id: 'c1', name: '4º A', subject: 'Educación Física', subjects: ['Educación Física'], etapa: 'primaria', curso: 4 } as Class;

  it('se leen los tres momentos con sus actividades reales, y al pasarlas a Sesiones de EF cada momento va a su parte', async () => {
    const user = userEvent.setup();
    const pasadas: SesionEF[][] = [];
    render(
      <I18nProvider><ToastProvider>
        <LearningSituations
          classes={[claseEF]} gradeCategories={[]} learningSituations={[ef]}
          onUpdateClass={() => {}} onSave={() => {}} onDelete={() => {}} onAddRubric={() => {}} onAddDiana={() => {}} onAddFicha={() => {}} onNav={() => {}}
          ef={{ material: '', instalaciones: '', limitacionesDe: () => [], onPasarSesiones: s => pasadas.push(s) }}
        />
      </ToastProvider></I18nProvider>,
    );
    await user.click(screen.getByRole('button', { name: /Liga de voleibol/ }));
    for (const m of ['Preimpacto', 'Impacto', 'Postimpacto']) expect(screen.getByRole('region', { name: m })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Impacto' })).getByText('Toque y desmarque')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Preimpacto' })).getByText('Pilla-pilla de cadenas')).toBeTruthy();
    expect(screen.getByText('Progresión de 2 contra 1 a 3 contra 2.')).toBeTruthy();
    expect(screen.getByText('40 min')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Pasar a Sesiones de EF/ }));
    const s = pasadas[0][0];
    expect(s.objetivo).toBe('Se trabaja el toque en movimiento.');
    expect(s.calentamiento).toContain('Pilla-pilla de cadenas (10 min).');
    expect(s.principal).toContain('Rondo de 4 contra 1');
    expect(s.calma).toContain('Estiramientos en círculo');
    expect(s.material).toBe('1 balón por pareja');
  });
});

describe('copiar a otras clases', () => {
  const clase = (id: string, name: string, curso: number, etapa: 'primaria' | 'eso' = 'primaria'): Class => ({
    id, name, subject: 'Educación Física', subjects: ['Educación Física'], etapa, curso,
  } as Class);
  const clases = [clase('c1', '4º A', 4), clase('c2', '4º B', 4), clase('c3', '4º C', 4), clase('c5', '5º A', 5)];
  const propia: LearningSituation = { ...sda, id: 'ef1', title: 'Juegos del mundo', class_id: 'c1', class_name: '4º A', request: { ...sda.request, etapa: 'primaria', curso: 4 } };

  it('copia la situación a las clases elegidas: marca las del mismo curso y cada una la recibe como suya', async () => {
    const user = userEvent.setup();
    const guardadas: LearningSituation[] = [];
    render(
      <I18nProvider>
        <ToastProvider>
          <LearningSituations
            classes={clases} gradeCategories={[]} learningSituations={[propia, { ...propia, id: 'ef2', class_id: 'c3', class_name: '4º C' }]}
            onUpdateClass={() => {}} onSave={x => guardadas.push(x)} onDelete={() => {}} onAddRubric={() => {}} onAddDiana={() => {}} onAddFicha={() => {}} onNav={() => {}}
          />
        </ToastProvider>
      </I18nProvider>,
    );
    await user.click(screen.getAllByRole('button', { name: 'Copiar a otras clases' })[0]);
    const ventana = screen.getByRole('dialog', { name: 'Copiar a otras clases' });
    const marcada = (n: string) => (within(ventana).getByRole('checkbox', { name: new RegExp(`^${n}`) }) as HTMLInputElement).checked;
    // La propia clase no sale; 4º B, del mismo curso, sí y marcada; 4º C ya la tiene; 5º A es de otro curso
    expect(within(ventana).queryByRole('checkbox', { name: /^4º A/ })).toBeNull();
    expect(marcada('4º B')).toBe(true);
    expect(marcada('4º C')).toBe(false);
    expect(within(ventana).getByText('ya la tiene')).toBeTruthy();
    expect(marcada('5º A')).toBe(false);
    expect(within(ventana).getByText('otro curso')).toBeTruthy();

    await user.click(within(ventana).getByRole('checkbox', { name: /^5º A/ }));
    await user.click(within(ventana).getByRole('button', { name: 'Copiar a 2 clases' }));
    expect(guardadas.map(g => [g.class_id, g.class_name, g.title])).toEqual([['c2', '4º B', 'Juegos del mundo'], ['c5', '5º A', 'Juegos del mundo']]);
    expect(guardadas[1].request.curso).toBe(5);
    expect(new Set(guardadas.map(g => g.id)).size).toBe(2);
    expect(guardadas.every(g => g.id !== propia.id)).toBe(true);
  });
});

describe('currículo de la comunidad en el formulario', () => {
  const quintoA: Class = {
    id: 'c1', name: '5º A', subject: 'Mates', subjects: ['Mates', 'Ciencias'], room: '', color: '#0284c7',
    etapa: 'primaria', curso: 5,
  };
  const sinNivel: Class = { id: 'c2', name: '5º B', subject: 'Mates', subjects: ['Mates'], room: '', color: '#10b981' };

  async function abrirFormulario(classes: Class[], comunidad: ComunidadId = 'galicia') {
    const user = userEvent.setup();
    const onUpdateClass = vi.fn();
    render(
      <I18nProvider>
        <ToastProvider>
          <LearningSituations
            classes={classes} gradeCategories={[]} learningSituations={[]} comunidad={comunidad}
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
    await user.click(screen.getByRole('button', { name: '5º A' }));

    expect(screen.queryByLabelText('Etapa (currículo oficial)')).toBeNull();
    expect(screen.getByRole('button', { name: 'Cambiar en la clase' })).toBeTruthy();
    expect(screen.getAllByText(/5º de Primaria/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Currículo: Real Decreto 157\/2022, de 1 de marzo/)).toBeTruthy();
    // Galicia sigue el estatal: se avisa en pantalla
    expect(screen.getByText('Galicia sigue el currículo estatal.')).toBeTruthy();
  });

  it('«Fuera de España» cita el estatal sin avisar de nada', async () => {
    const { user } = await abrirFormulario([quintoA], 'fuera');
    await user.click(screen.getByRole('button', { name: '5º A' }));
    expect(screen.getByText(/Currículo: Real Decreto 157\/2022/)).toBeTruthy();
    expect(screen.queryByText(/sigue el currículo estatal/)).toBeNull();
  });

  it('pregunta la materia oficial del área que no tiene alias seguro, y lo recuerda en la clase', async () => {
    const { user, onUpdateClass } = await abrirFormulario([quintoA]);
    await user.click(screen.getByRole('button', { name: '5º A' }));

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
    await user.click(screen.getByRole('button', { name: '5º A' }));
    await user.click(screen.getByRole('button', { name: '5º A' }));
    await user.click(screen.getByRole('button', { name: '5º B' }));
    expect((screen.getByLabelText('Etapa (currículo oficial)') as HTMLSelectElement).value).toBe('');

    await user.selectOptions(screen.getByLabelText('Etapa (currículo oficial)'), 'primaria');
    await user.selectOptions(screen.getByLabelText('Curso'), '3');
    expect(screen.getByText('Se guardarán en la clase «5º B» para las próximas situaciones de aprendizaje.')).toBeTruthy();

    await user.type(screen.getByLabelText(/Idea de la situación de aprendizaje/), 'Un huerto');
    await user.click(screen.getByRole('button', { name: /Generar situación de aprendizaje/ }));

    expect(onUpdateClass).toHaveBeenCalledWith(expect.objectContaining({ id: 'c2', etapa: 'primaria', curso: 3 }));
    expect(generateSda).toHaveBeenCalledWith(
      expect.objectContaining({ etapa: 'primaria', curso: 3, comunidad: 'galicia' }), 'es', expect.anything(),
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
    expect(screen.getByText('Comunidad de Madrid sigue el currículo estatal.')).toBeTruthy();
  });

  it('con el decreto de la comunidad, solo la cita', async () => {
    const user = userEvent.setup();
    setup([conNormativa({ comunidad: 'madrid', origen: 'autonomico', cita: 'Decreto 65/2022, de 20 de julio (BOCM núm. 176, de 26 de julio de 2022)' })]);
    await user.click(screen.getByRole('button', { name: /Mercado sostenible/ }));
    expect(screen.getByText(/Currículo: Decreto 65\/2022/)).toBeTruthy();
    expect(screen.queryByText(/sigue el currículo estatal/)).toBeNull();
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

