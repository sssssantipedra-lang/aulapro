// @vitest-environment jsdom
/**
 * La ACS de Andalucía en la pantalla, con el currículo andaluz: se crea para un área, marcar un criterio marca su
 * competencia, el seguimiento del trimestre tiene una fila por criterio y los avisos de la orden se ven.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AcsApoyo } from './AcsApoyo';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import { APOYO_VACIO } from '../../lib/apoyo';
import { cargarCurriculo } from '../../lib/curriculum/cargar';
import { materiasDeCurriculo } from '../../lib/curriculum/materiasDeNivel';
import type { MateriaDeClase } from '../../lib/curriculum/criteriosParaIA';
import type { AlumnoApoyo, ApoyoData } from '../../types/apoyo';

afterEach(cleanup);

const alumno: AlumnoApoyo = {
  id: 'a1', nombre: 'Alumno 1', claseOrigen: '5º A', matricula: { etapa: 'primaria', curso: 5 }, nivel: { etapa: 'primaria', curso: 4 },
  categorias: ['Discapacidad intelectual'], diagnostico: '', necesidades: '', notas: '',
};

let ultimo: ApoyoData;
function Harness({ materias, comunidad = 'andalucia' }: { materias: MateriaDeClase[]; comunidad?: 'andalucia' | 'comunitat-valenciana' | 'cataluna' }) {
  const [data, setData] = useState<ApoyoData>({ ...APOYO_VACIO, alumnos: [alumno] });
  return (
    <I18nProvider><ToastProvider>
      <AcsApoyo alumno={alumno} data={data} onChange={f => setData(d => { ultimo = f(d); return ultimo; })}
        materias={materias} comunidad={comunidad} docente={{ nombre: 'Profesor', centro: '', curso: '2026-2027' }} />
    </ToastProvider></I18nProvider>
  );
}

describe('ACS de Andalucía', () => {
  it('se crea por área, se eligen criterios y se sigue cada trimestre', async () => {
    const user = userEvent.setup();
    const materias = materiasDeCurriculo(await cargarCurriculo('andalucia', 'primaria'), { etapa: 'primaria', curso: 4 });
    const mates = materias.find(m => m.entry.nombre === 'Matemáticas')!;
    const [c1] = mates.entry.criterios[mates.grupo];
    render(<Harness materias={materias} />);

    await user.selectOptions(screen.getByLabelText('Área'), 'Matemáticas');
    await user.click(screen.getByRole('button', { name: 'Nueva ACS' }));
    expect(ultimo.acs).toHaveLength(1);
    expect(ultimo.acs[0]).toMatchObject({ area: 'Matemáticas', nivel: { etapa: 'primaria', curso: 4 } });
    expect(ultimo.acs[0].responsables.especialista).toBe('Profesor');

    const dialogo = screen.getByRole('dialog');
    // Sin informe y con un desfase de un curso, avisa
    expect(within(dialogo).getByRole('status').textContent).toMatch(/al menos dos cursos .* aquí es de 1\./);
    expect(within(dialogo).getByRole('status').textContent).toMatch(/informe de evaluación psicopedagógica/);

    // El currículo de referencia se abre en el propio editor
    const criterio = await within(dialogo).findByRole('checkbox', { name: new RegExp(`^${c1.codigo.replace('.', '\\.')}\\.`) });
    await user.click(criterio);
    expect(ultimo.acs[0].criterios).toEqual([c1.codigo]);
    expect(ultimo.acs[0].competencias).toEqual([c1.competencia]);

    // Una fila de seguimiento por criterio elegido
    const grupo = within(dialogo).getByRole('group', { name: 'Grado de consecución' });
    await user.click(within(grupo).getByRole('button', { name: 'En proceso' }));
    expect(ultimo.acs[0].seguimiento).toHaveLength(1);
    expect(ultimo.acs[0].seguimiento[0]).toMatchObject({ tipo: 'criterio', clave: c1.codigo, grado: 'proceso' });

    // Bajar el curso de referencia a 3º quita el aviso del desfase
    await user.selectOptions(within(dialogo).getByLabelText('Curso de referencia de la ACS'), 'primaria-3');
    expect(ultimo.acs[0].nivel).toEqual({ etapa: 'primaria', curso: 3 });
    expect(within(dialogo).getByRole('status').textContent).not.toMatch(/aquí es de/);
  });

  it('en la Comunitat Valenciana es la ACIS del PAP, con horas de apoyo y la nota del trimestre', async () => {
    const user = userEvent.setup();
    const materias = materiasDeCurriculo(await cargarCurriculo('comunitat-valenciana', 'primaria'), { etapa: 'primaria', curso: 4 });
    render(<Harness materias={materias} comunidad="comunitat-valenciana" />);
    expect(screen.getByText('Adaptación curricular individual significativa (ACIS)')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Nueva ACIS' }));
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByRole('heading', { name: '2. Barreras y fortalezas para el aprendizaje y la participación' })).toBeTruthy();
    expect(within(dialogo).getByLabelText('Orientador u orientadora')).toBeTruthy();
    const horas = within(dialogo).getByLabelText('Pedagogía terapéutica, Fuera del aula');
    await user.clear(horas);
    await user.type(horas, '2');
    expect(ultimo.acs[0].apoyos?.ptFuera).toBe(2);
    await user.type(within(dialogo).getByLabelText('Calificación del 1º trimestre'), '6');
    expect(ultimo.acs[0].notas?.[1]).toBe('6');
  });

  it('en Cataluña es el PI, sin aviso de desfase, con la conformidad de la familia', async () => {
    const user = userEvent.setup();
    const materias = materiasDeCurriculo(await cargarCurriculo('cataluna', 'primaria'), { etapa: 'primaria', curso: 4 });
    render(<Harness materias={materias} comunidad="cataluna" />);
    await user.click(screen.getByRole('button', { name: 'Nuevo PI' }));
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByRole('status').textContent).not.toMatch(/desfase/);
    expect(within(dialogo).getByRole('status').textContent).toMatch(/conformidad de la familia/);
    await user.click(within(dialogo).getByRole('checkbox', { name: 'La familia está conforme con el PI' }));
    expect(ultimo.acs[0].familiaConforme).toBe(true);
    expect(within(dialogo).getByRole('status').textContent).not.toMatch(/conformidad de la familia/);
  });
});
