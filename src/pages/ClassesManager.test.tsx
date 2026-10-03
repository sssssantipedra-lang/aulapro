// @vitest-environment jsdom
/**
 * Crear y editar una clase: se eligen etapa y curso y se marcan las
 * asignaturas tal y como las llama el currículo de la comunidad del perfil.
 * Las que no están en la lista se añaden aparte y quedan en modo libre.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClassesManager } from './ClassesManager';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import { materiasDe } from '../lib/curriculum';
import type { Class } from '../types';
import type { ComunidadId } from '../lib/curriculum/comunidades';

afterEach(cleanup);

function setup(classes: Class[] = [], comunidad: ComunidadId = 'cataluna') {
  const onAddClass = vi.fn();
  const onUpdateClass = vi.fn();
  render(
    <I18nProvider>
      <ToastProvider>
        <ClassesManager
          classes={classes} students={[]} evaluations={[]} rubrics={[]}
          onAddClass={onAddClass} onUpdateClass={onUpdateClass} onDeleteClass={() => {}}
          onAddStudent={() => {}} onUpdateStudent={() => {}} onDeleteStudent={() => {}}
          onAddStudents={() => {}} onOpenEval={() => {}} profileId="p1" comunidad={comunidad}
        />
      </ToastProvider>
    </I18nProvider>,
  );
  return { onAddClass, onUpdateClass };
}

const materia = (nombre: string | RegExp) => screen.getByRole('button', { name: nombre });

async function nuevaClase(user: ReturnType<typeof userEvent.setup>, etapa: 'primaria' | 'eso', curso: string) {
  await user.click(screen.getAllByRole('button', { name: /Nueva clase/ })[0]);
  await user.type(screen.getByLabelText('Nombre'), '5º A');
  await user.selectOptions(screen.getByLabelText('Etapa (currículo oficial)'), etapa);
  await user.selectOptions(screen.getByLabelText('Curso'), curso);
}

describe('crear una clase', () => {
  it('sin etapa y curso no se ofrecen asignaturas ni se puede crear', async () => {
    const user = userEvent.setup();
    const { onAddClass } = setup();
    await user.click(screen.getAllByRole('button', { name: /Nueva clase/ })[0]);
    await user.type(screen.getByLabelText('Nombre'), '5º A');
    expect(screen.getByText(/Elige primero la etapa y el curso/)).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Asignaturas del currículo' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Crear clase' }));
    expect(onAddClass).not.toHaveBeenCalled();
  });

  it('ofrece las asignaturas oficiales del curso, con su nombre del currículo', async () => {
    const user = userEvent.setup();
    setup();
    await nuevaClase(user, 'primaria', '5');
    const grupo = screen.getByRole('group', { name: 'Asignaturas del currículo' });
    const nombres = [...grupo.querySelectorAll('button')].map(b => b.textContent);
    // Cataluña aún no está copiada: las 7 áreas del Real Decreto, en su orden
    expect(nombres).toEqual(materiasDe('primaria').map(m => m.nombre));
    // Y se cita de dónde salen, avisando de que es el estatal
    expect(screen.getByText(/Currículo: Real Decreto 157\/2022/)).toBeTruthy();
    expect(screen.getByText(/Aula Pro aún no tiene el decreto de tu comunidad \(Cataluña\)/)).toBeTruthy();
  });

  it('con el decreto de la comunidad copiado, ofrece sus áreas y lo cita, sin avisar del estatal', async () => {
    const user = userEvent.setup();
    setup([], 'comunitat-valenciana');
    await nuevaClase(user, 'primaria', '5');
    await waitFor(() => expect(materia('Música y Danza')).toBeTruthy());
    const grupo = screen.getByRole('group', { name: 'Asignaturas del currículo' });
    expect([...grupo.querySelectorAll('button')].map(b => b.textContent)).toEqual([
      'Conocimiento del Medio Natural, Social y Cultural', 'Educación Plástica y Visual', 'Música y Danza',
      'Educación Física', 'Valenciano: Lengua y Literatura', 'Lengua Castellana y Literatura',
      'Lengua Extranjera', 'Matemáticas', 'Educación en Valores Cívicos y Éticos',
    ]);
    expect(screen.getByText(
      'Currículo: Decreto 106/2022, de 5 de agosto (DOGV núm. 9402, de 10 de agosto de 2022), '
      + 'modificado por Decreto 96/2026, de 19 de junio (DOGV núm. 10391, de 25 de junio de 2026)',
    )).toBeTruthy();
    expect(screen.queryByText(/aún no tiene el decreto/)).toBeNull();
  });

  it('Educación en Valores solo aparece en el tercer ciclo', async () => {
    const user = userEvent.setup();
    setup();
    await nuevaClase(user, 'primaria', '2');
    expect(screen.queryByRole('button', { name: 'Educación en Valores Cívicos y Éticos' })).toBeNull();
    await user.selectOptions(screen.getByLabelText('Curso'), '6');
    expect(materia('Educación en Valores Cívicos y Éticos')).toBeTruthy();
  });

  it('guarda las marcadas en el orden del decreto, con su materia oficial, y las de fuera en modo libre', async () => {
    const user = userEvent.setup();
    const { onAddClass } = setup();
    await nuevaClase(user, 'primaria', '5');
    await user.click(materia('Matemáticas'));
    await user.click(materia('Conocimiento del Medio Natural, Social y Cultural'));
    expect(materia(/^Matemáticas$/).getAttribute('aria-pressed')).toBe('true');

    await user.type(screen.getByLabelText('Otra asignatura que no está en el currículo'), 'Religión{Enter}');
    expect(screen.getByText('Otras asignaturas')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Crear clase' }));
    const creada = onAddClass.mock.calls[0][0] as Class;
    const orden = materiasDe('primaria').map(m => m.nombre);
    expect(creada.subjects).toEqual([
      ...['Matemáticas', 'Conocimiento del Medio Natural, Social y Cultural'].sort((a, b) => orden.indexOf(a) - orden.indexOf(b)),
      'Religión',
    ]);
    expect(creada.subject).toBe(creada.subjects[0]);
    expect(creada).toMatchObject({
      etapa: 'primaria', curso: 5,
      materiasOficiales: {
        Matemáticas: 'Matemáticas',
        'Conocimiento del Medio Natural, Social y Cultural': 'Conocimiento del Medio Natural, Social y Cultural',
        Religión: null,
      },
    });
  });

  it('una de fuera de la lista se puede quitar antes de crear', async () => {
    const user = userEvent.setup();
    const { onAddClass } = setup();
    await nuevaClase(user, 'primaria', '5');
    await user.click(materia('Matemáticas'));
    await user.type(screen.getByLabelText('Otra asignatura que no está en el currículo'), 'Tutoría');
    await user.click(screen.getByRole('button', { name: 'Añadir' }));
    await user.click(screen.getByRole('button', { name: 'Quitar «Tutoría»' }));
    await user.click(screen.getByRole('button', { name: 'Crear clase' }));
    expect((onAddClass.mock.calls[0][0] as Class).subjects).toEqual(['Matemáticas']);
  });

  it('sin ninguna asignatura no se crea', async () => {
    const user = userEvent.setup();
    const { onAddClass } = setup();
    await nuevaClase(user, 'primaria', '5');
    await user.click(screen.getByRole('button', { name: 'Crear clase' }));
    expect(onAddClass).not.toHaveBeenCalled();
  });

  it('Matemáticas en 4º de ESO pide la opción A o B', async () => {
    const user = userEvent.setup();
    const { onAddClass } = setup();
    await nuevaClase(user, 'eso', '4');
    await user.click(materia('Matemáticas'));
    await user.click(screen.getByRole('button', { name: 'Matemáticas B' }));
    await user.click(screen.getByRole('button', { name: 'Crear clase' }));
    expect(onAddClass.mock.calls[0][0]).toMatchObject({ curso: 4, opcionMatematicas: 'B' });
  });
});

describe('editar una clase', () => {
  const clase: Class = {
    id: 'c1', name: '5º A', subject: 'Matemáticas', subjects: ['Matemáticas', 'Religión'], room: '', color: '#0284c7',
    owner: 'p1', etapa: 'primaria', curso: 5, materiasOficiales: { Matemáticas: 'Matemáticas', Religión: null },
  };

  it('el lápiz abre el formulario relleno, y guardar actualiza la misma clase', async () => {
    const user = userEvent.setup();
    const { onUpdateClass, onAddClass } = setup([clase]);
    expect(screen.getByText(/5º de Primaria/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Editar clase' }));
    expect(screen.getByText('Editar clase', { selector: '.modal-title' })).toBeTruthy();
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('5º A');
    expect((screen.getByLabelText('Curso') as HTMLSelectElement).value).toBe('5');
    expect(materia(/^Matemáticas$/).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Quitar «Religión»' })).toBeTruthy();

    await user.clear(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), '5º B');
    await user.click(materia('Educación Física'));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(onAddClass).not.toHaveBeenCalled();
    const guardada = onUpdateClass.mock.calls[0][0] as Class;
    expect(guardada).toMatchObject({ id: 'c1', name: '5º B', owner: 'p1', curso: 5 });
    expect(guardada.subjects).toContain('Educación Física');
    expect(guardada.materiasOficiales?.['Educación Física']).toBe('Educación Física');
  });

  it('una clase anterior, con asignaturas escritas a mano, conserva lo que se sabía de ellas', async () => {
    const user = userEvent.setup();
    const { onUpdateClass } = setup([{
      id: 'c2', name: '3º B', subject: 'Mates', subjects: ['Mates', 'Ciencias'], room: '', color: '#10b981',
    }]);
    await user.click(screen.getByRole('button', { name: 'Editar clase' }));
    // Sin etapa ni curso: hay que indicarlos para guardar
    await user.selectOptions(screen.getByLabelText('Etapa (currículo oficial)'), 'primaria');
    await user.selectOptions(screen.getByLabelText('Curso'), '3');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    const guardada = onUpdateClass.mock.calls[0][0] as Class;
    expect(guardada.subjects).toEqual(['Mates', 'Ciencias']);
    // «Mates» tiene alias seguro; «Ciencias» no, y queda en modo libre
    expect(guardada.materiasOficiales).toEqual({ Mates: 'Matemáticas', Ciencias: null });
  });

  it('con la app en otro idioma reconoce sus asignaturas oficiales y no les cambia el nombre', async () => {
    // Creada en castellano con la Comunitat Valenciana; se abre en valenciano
    localStorage.setItem('aulapro_lang', 'ca');
    try {
      const user = userEvent.setup();
      const { onUpdateClass } = setup([{
        ...clase, subjects: ['Matemáticas', 'Religión'],
        materiasOficiales: { Matemáticas: 'matematicas', Religión: null },
      }], 'comunitat-valenciana');
      await user.click(screen.getByRole('button', { name: 'Edita la classe' }));
      await waitFor(() => expect(materia('Matemàtiques').getAttribute('aria-pressed')).toBe('true'));
      // No sale como «otra asignatura»: solo Religión
      expect(screen.queryByRole('button', { name: 'Treu «Matemáticas»' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Treu «Religión»' })).toBeTruthy();

      await user.click(materia('Música i Dansa'));
      await user.click(screen.getByRole('button', { name: 'Desar els canvis' }));
      const guardada = onUpdateClass.mock.calls[0][0] as Class;
      expect(guardada.subjects).toEqual(['Música i Dansa', 'Matemáticas', 'Religión']);
      expect(guardada.materiasOficiales).toEqual({
        'Música i Dansa': 'musica-y-danza', Matemáticas: 'matematicas', Religión: null,
      });
    } finally {
      localStorage.removeItem('aulapro_lang');
    }
  });

  it('cambiar el curso fuera de 4º de ESO quita la opción de Matemáticas', async () => {
    const user = userEvent.setup();
    const { onUpdateClass } = setup([{ ...clase, etapa: 'eso', curso: 4, opcionMatematicas: 'A', subjects: ['Matemáticas'] }]);
    await user.click(screen.getByRole('button', { name: 'Editar clase' }));
    await user.selectOptions(screen.getByLabelText('Curso'), '3');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect((onUpdateClass.mock.calls[0][0] as Class).opcionMatematicas).toBeUndefined();
  });
});
