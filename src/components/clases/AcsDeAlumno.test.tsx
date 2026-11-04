// @vitest-environment jsdom
/**
 * La ACS en la ficha de un alumno de «Mis clases»: el docente de aula la crea para su materia (con el currículo de su
 * comunidad, también una sin modelo propio), marca sus necesidades y firma como profesorado de la materia.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AcsDeAlumno } from './AcsDeAlumno';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../ui/Toast';
import { APOYO_VACIO } from '../../lib/apoyo';
import type { ApoyoData } from '../../types/apoyo';
import type { Class, Student } from '../../types';

afterEach(cleanup);

const cls = { id: 'c1', name: '1º ESO B', subject: 'Matemáticas', subjects: ['Matemáticas'], room: '', color: '', etapa: 'eso', curso: 1 } as Class;
const student: Student = { id: 's1', class_id: 'c1', name: 'Alumno 1', email: '', photo: null, alerts: [], notes: '' };

let ultimo: ApoyoData;
function Harness() {
  const [data, setData] = useState<ApoyoData>(APOYO_VACIO);
  return (
    <I18nProvider><ToastProvider>
      <AcsDeAlumno student={student} cls={cls} apoyo={data} onApoyo={f => setData(d => { ultimo = f(d); return ultimo; })}
        comunidad="galicia" docente={{ nombre: 'Profesor', centro: '', curso: '2026-2027' }} />
    </ToastProvider></I18nProvider>
  );
}

describe('ACS en Mis clases', () => {
  it('se crea con el modelo general, en acsAula, firmada por el profesorado de la materia', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Recibir del especialista de PT' })).toBeTruthy();
    const area = await screen.findByLabelText('Área');
    const mates = [...(area as HTMLSelectElement).options].find(o => /matem/i.test(o.text))!;
    await user.selectOptions(area, mates.value);
    await user.click(screen.getByRole('button', { name: 'Nueva ACS' }));
    expect(ultimo.acs).toEqual([]);
    expect(ultimo.acsAula).toHaveLength(1);
    expect(ultimo.acsAula[0]).toMatchObject({ alumnoId: 's1', nivel: { etapa: 'primaria', curso: 5 } });
    expect(ultimo.acsAula[0].responsables.materia).toBe('Profesor');
    const dialogo = screen.getByRole('dialog');
    expect(ultimo.acsAula[0]).not.toHaveProperty('categorias');   // AulaPro ya no guarda la categoría NEAE
    expect(within(dialogo).queryByRole('button', { name: 'Discapacidad intelectual' })).toBeNull();
    expect(within(dialogo).queryByRole('button', { name: 'Enviar al docente de aula' })).toBeNull();
  });
});
