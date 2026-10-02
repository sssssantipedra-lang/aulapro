// @vitest-environment jsdom
/**
 * Etapa, curso y materia oficial de la clase: se piden en el formulario de la
 * clase, una vez, y ahí mismo se pueden corregir con «Editar clase».
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClassesManager } from './ClassesManager';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { Class } from '../types';

afterEach(cleanup);

function setup(classes: Class[] = []) {
  const onAddClass = vi.fn();
  const onUpdateClass = vi.fn();
  render(
    <I18nProvider>
      <ToastProvider>
        <ClassesManager
          classes={classes} students={[]} evaluations={[]} rubrics={[]}
          onAddClass={onAddClass} onUpdateClass={onUpdateClass} onDeleteClass={() => {}}
          onAddStudent={() => {}} onUpdateStudent={() => {}} onDeleteStudent={() => {}}
          onAddStudents={() => {}} onOpenEval={() => {}} profileId="p1" comunidad="madrid"
        />
      </ToastProvider>
    </I18nProvider>,
  );
  return { onAddClass, onUpdateClass };
}

describe('clase con currículo oficial', () => {
  it('sin etapa ni curso no pregunta materias: la clase se crea como siempre', async () => {
    const user = userEvent.setup();
    const { onAddClass } = setup();
    await user.click(screen.getAllByRole('button', { name: /Nueva clase/ })[0]);
    await user.type(screen.getByLabelText('Nombre'), '5º A');
    await user.type(screen.getByLabelText('Asignatura 1'), 'Mates');
    expect(screen.queryByLabelText(/Materia oficial/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Crear clase' }));
    const creada = onAddClass.mock.calls[0][0] as Class;
    expect(creada.etapa).toBeUndefined();
    expect(creada.materiasOficiales).toBeUndefined();
  });

  it('con etapa y curso: detecta la materia segura, pregunta la dudosa y lo guarda en la clase', async () => {
    const user = userEvent.setup();
    const { onAddClass } = setup();
    await user.click(screen.getAllByRole('button', { name: /Nueva clase/ })[0]);
    await user.type(screen.getByLabelText('Nombre'), '2º B');
    await user.selectOptions(screen.getByLabelText('Etapa (currículo oficial)'), 'eso');
    await user.selectOptions(screen.getByLabelText('Curso'), '2');

    await user.type(screen.getByLabelText('Asignatura 1'), 'Mates');
    await user.click(screen.getByRole('button', { name: /Añadir otra asignatura/ }));
    await user.type(screen.getByLabelText('Asignatura 2'), 'Ciencias');

    // «Mates» se detecta sola; «Ciencias» no se adivina
    const mates = screen.getByLabelText('Materia oficial de «Mates»') as HTMLSelectElement;
    expect(mates.value).toBe('Matemáticas');
    expect(screen.getByText('detectada')).toBeTruthy();
    const ciencias = screen.getByLabelText('Materia oficial de «Ciencias»') as HTMLSelectElement;
    expect(ciencias.value).toBe('');
    await user.selectOptions(ciencias, 'Física y Química');

    // Madrid aún no tiene su decreto: se cita el estatal y se avisa en pantalla
    expect(screen.getByText(/Currículo: Real Decreto 217\/2022/)).toBeTruthy();
    expect(screen.getByText(/Aula Pro aún no tiene el decreto de tu comunidad \(Comunidad de Madrid\)/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Crear clase' }));
    const creada = onAddClass.mock.calls[0][0] as Class;
    expect(creada).toMatchObject({ etapa: 'eso', curso: 2, materiasOficiales: { Ciencias: 'Física y Química' } });
  });

  it('«Ninguna, modo libre» se guarda como null', async () => {
    const user = userEvent.setup();
    const { onAddClass } = setup();
    await user.click(screen.getAllByRole('button', { name: /Nueva clase/ })[0]);
    await user.type(screen.getByLabelText('Nombre'), '5º A');
    await user.selectOptions(screen.getByLabelText('Etapa (currículo oficial)'), 'primaria');
    await user.selectOptions(screen.getByLabelText('Curso'), '5');
    await user.type(screen.getByLabelText('Asignatura 1'), 'Mates');
    await user.selectOptions(screen.getByLabelText('Materia oficial de «Mates»'), 'Ninguna, modo libre');
    await user.click(screen.getByRole('button', { name: 'Crear clase' }));
    expect((onAddClass.mock.calls[0][0] as Class).materiasOficiales).toEqual({ Mates: null });
  });

  it('Matemáticas en 4º de ESO pide la opción A o B', async () => {
    const user = userEvent.setup();
    const { onAddClass } = setup();
    await user.click(screen.getAllByRole('button', { name: /Nueva clase/ })[0]);
    await user.type(screen.getByLabelText('Nombre'), '4º A');
    await user.selectOptions(screen.getByLabelText('Etapa (currículo oficial)'), 'eso');
    await user.selectOptions(screen.getByLabelText('Curso'), '4');
    await user.type(screen.getByLabelText('Asignatura 1'), 'Matemáticas');
    await user.click(screen.getByRole('button', { name: 'Matemáticas B' }));
    await user.click(screen.getByRole('button', { name: 'Crear clase' }));
    expect(onAddClass.mock.calls[0][0]).toMatchObject({ curso: 4, opcionMatematicas: 'B' });
  });
});

describe('editar una clase', () => {
  const clase: Class = {
    id: 'c1', name: '5º A', subject: 'Mates', subjects: ['Mates', 'Ciencias'], room: '', color: '#0284c7',
    owner: 'p1', etapa: 'primaria', curso: 5, materiasOficiales: { Ciencias: 'Conocimiento del Medio Natural, Social y Cultural' },
  };

  it('el lápiz abre el formulario relleno, y guardar actualiza la misma clase', async () => {
    const user = userEvent.setup();
    const { onUpdateClass, onAddClass } = setup([clase]);
    expect(screen.getByText(/5º de Primaria/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Editar clase' }));
    expect(screen.getByText('Editar clase', { selector: '.modal-title' })).toBeTruthy();
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('5º A');
    expect((screen.getByLabelText('Curso') as HTMLSelectElement).value).toBe('5');
    expect((screen.getByLabelText('Materia oficial de «Ciencias»') as HTMLSelectElement).value)
      .toBe('Conocimiento del Medio Natural, Social y Cultural');

    await user.clear(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), '5º B');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(onAddClass).not.toHaveBeenCalled();
    expect(onUpdateClass).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', name: '5º B', owner: 'p1', curso: 5 }));
  });

  it('quitar una asignatura no deja su materia oficial guardada', async () => {
    const user = userEvent.setup();
    const { onUpdateClass } = setup([clase]);
    await user.click(screen.getByRole('button', { name: 'Editar clase' }));
    const fila = screen.getByLabelText('Asignatura 2').parentElement!;
    await user.click(within(fila).getByTitle('Quitar'));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const guardada = onUpdateClass.mock.calls[0][0] as Class;
    expect(guardada.subjects).toEqual(['Mates']);
    expect(guardada.materiasOficiales).toBeUndefined();
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
