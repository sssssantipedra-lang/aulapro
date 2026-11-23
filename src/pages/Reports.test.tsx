// @vitest-environment jsdom
/**
 * Informes (20-11-2026): el informe de seguimiento por reglas y sin IA, «Escribir a mano», toda la clase de
 * una vez y los datos de la evaluación elegida, también en lo que recibe la IA cuando redacta el texto.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import type { AttendanceMap, Class, ClassMark, CompetencyReport, Evaluation, GradeCategory, GradeItem, GradeMap, Student } from '../types';
import { DEFAULT_BLOCK } from '../services/classMarks';

const ia = vi.hoisted(() => ({ conClave: false, llamadas: [] as string[], respuesta: '' }));
vi.mock('../services/gemini', async importOriginal => ({
  ...await importOriginal<typeof import('../services/gemini')>(),
  hasApiKey: () => ia.conClave,
  callGemini: async (_sistema: string, usuario: string) => { ia.llamadas.push(usuario); return ia.respuesta; },
}));

import { Reports } from './Reports';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';

beforeEach(() => {
  guardados = []; localStorage.clear(); ia.conClave = false; ia.llamadas = []; ia.respuesta = '';
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2027, 1, 10, 10));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const clase = { id: 'c1', name: '1º ESO A', subject: 'Matemáticas', subjects: ['Matemáticas'], color: '#000' } as unknown as Class;
const alumnos = [1, 2, 3].map(n => ({ id: `s${n}`, class_id: 'c1', name: `Alumno ${n}`, email: '', photo: null, alerts: [], notes: '' }) as unknown as Student);
const categorias: GradeCategory[] = [{ id: 'k1', class_id: 'c1', name: 'Pruebas', weight: 100 }];
const actividades: GradeItem[] = [
  { id: 'i1', class_id: 'c1', category_id: 'k1', name: 'Examen de otoño', date: '2026-10-20' },
  { id: 'i2', class_id: 'c1', category_id: 'k1', name: 'Examen de invierno', date: '2027-02-03' },
];
// El alumno 3 no tiene nada en la 2.ª evaluación
const notas: GradeMap = { i1: { s1: 4, s2: 6, s3: 7 }, i2: { s1: 8.5, s2: 3 } };
const asistencia: AttendanceMap = { c1: { '2026-10-05': { s1: 'absent' }, '2027-01-20': { s1: 'present' }, '2027-01-21': { s1: 'late' } } };
const evaluaciones: Evaluation[] = [
  { id: 'e1', rubric_id: 'r1', rubric_name: 'Problemas de otoño', student_id: 's1', student_name: 'Alumno 1', class_id: 'c1', date: '2026-10-22', scores: {}, notes: '', competencyScores: { STEM: 1 } },
  { id: 'e2', rubric_id: 'r1', rubric_name: 'Problemas de invierno', student_id: 's1', student_name: 'Alumno 1', class_id: 'c1', date: '2027-02-02', scores: {}, notes: '', competencyScores: { STEM: 4, CCL: 2 } },
];
const anotaciones: ClassMark[] = [];
const bloques = { 'c1|Matemáticas': { ...DEFAULT_BLOCK, enabled: false } };

/** Los informes guardados, como los tendría el perfil: la pantalla de prueba los apunta aquí al cambiar. */
let guardados: CompetencyReport[] = [];
function Pantalla({ iniciales = [], alumnoInicial }: { iniciales?: CompetencyReport[]; alumnoInicial?: string }) {
  const [reports, setReports] = useState<CompetencyReport[]>(iniciales);
  useEffect(() => { guardados = reports; }, [reports]);
  const sinEl = (r: CompetencyReport) => (prev: CompetencyReport[]) => prev.filter(x => !(x.student_id === r.student_id && x.period === r.period));
  return (
    <I18nProvider><ToastProvider>
      <Reports classes={[clase]} students={alumnos} evaluations={evaluaciones} rubrics={[]} dianas={[]}
        gradeCategories={categorias} gradeItems={actividades} grades={notas} attendance={asistencia}
        classMarks={anotaciones} marksConfigs={bloques} reports={reports} alumnoInicial={alumnoInicial}
        onAddReport={r => setReports(prev => [r, ...sinEl(r)(prev)])}
        onAddReports={rs => setReports(prev => [...rs, ...prev])}
        onUpdateReport={r => setReports(prev => prev.map(x => (x.id === r.id ? r : x)))}
        onDeleteReport={id => setReports(prev => prev.filter(x => x.id !== id))}
        onNav={() => {}} />
    </ToastProvider></I18nProvider>
  );
}
/** En la lista, cada alumno lleva delante su número (o la marca de que ya tiene informe). */
const elegir = (nombre: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`${nombre}$`), pressed: false }));
const frases = () => [...document.querySelectorAll<HTMLTextAreaElement>('.inf-frases textarea')].map(x => x.value);
const hoja = () => document.querySelector('.inf-panel .inf-hoja')?.textContent ?? '';

describe('Informes sin clave de IA', () => {
  it('no es un muro: ofrece el informe de seguimiento y «Escribir a mano», y no los botones de la IA', () => {
    render(<Pantalla />);
    expect(screen.getByRole('button', { name: 'Informes de seguimiento de la clase' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Redactar con IA los que faltan' })).toBeNull();
    elegir('Alumno 1');
    expect(screen.getByRole('button', { name: 'Informe de seguimiento' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Escribir a mano' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Generar informe' })).toBeNull();
  });

  it('el informe de seguimiento cuenta los datos de la evaluación elegida y se edita antes de guardar', () => {
    render(<Pantalla />);
    // Hoy es 10 de febrero: la 2.ª evaluación
    elegir('Alumno 1');
    fireEvent.click(screen.getByRole('button', { name: 'Informe de seguimiento' }));
    expect(guardados).toHaveLength(0);
    const datos = document.querySelector('.inf-partes')?.textContent ?? '';
    expect(datos).toContain('8,5');
    expect(datos).not.toContain('4,0');
    // La asistencia de enero (2 días, 1 retraso), sin la falta de octubre
    expect(datos).toMatch(/Días registrados2.*Faltas sin justificar0.*Retrasos1/);
    expect(frases()).toContain('En Matemáticas su nota es de 8,5 sobre 10, un buen resultado.');
    expect(frases()).toContain('Su nota en Matemáticas ha subido 4,5 puntos respecto a la evaluación anterior.');
    // El docente ve de qué dato sale cada frase
    expect(screen.getByText('Sale de: Notas: Media de 8,5 en Matemáticas')).toBeTruthy();

    fireEvent.change(document.querySelector('.inf-frases textarea') as HTMLTextAreaElement, { target: { value: 'Ha mejorado mucho este trimestre.' } });
    fireEvent.change(screen.getByLabelText('Observaciones del docente'), { target: { value: 'Seguimos así.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar informe' }));

    expect(guardados).toHaveLength(1);
    const r = guardados[0];
    expect(r.period).toBe('2ª evaluación');
    expect(r.origen).toBe('reglas');
    expect(r.seguimiento?.desde).toBe('2027-01-01');
    expect(r.seguimiento?.observacion).toBe('Seguimos así.');
    expect(r.seguimiento?.positivos.map(f => f.texto)).toContain('Ha mejorado mucho este trimestre.');
    // Solo la evaluación con rúbrica de febrero: STEM excelente (la de octubre, con un 1, no cuenta)
    expect(r.tabla).toEqual([{ clave: 'CCL', valoracion: 'mejorable', comentario: '' }, { clave: 'STEM', valoracion: 'excelente', comentario: '' }]);
    expect(hoja()).toContain('Ha mejorado mucho este trimestre.');
    expect(hoja()).not.toContain('Sale de');
  });

  it('en la 1.ª evaluación salen los datos de la 1.ª', () => {
    render(<Pantalla />);
    fireEvent.click(screen.getByRole('button', { name: '1ª evaluación' }));
    elegir('Alumno 1');
    fireEvent.click(screen.getByRole('button', { name: 'Informe de seguimiento' }));
    const datos = document.querySelector('.inf-partes')?.textContent ?? '';
    expect(datos).toContain('4,0');
    expect(datos).toMatch(/Días registrados1.*Faltas sin justificar1/);
    expect(frases()).toContain('En Matemáticas su nota es de 4 sobre 10: todavía no llega al 5 y conviene reforzar la materia.');
    expect(frases()).toContain('Ha faltado a clase 1 día sin justificante.');
  });

  it('toda la clase de una vez: crea los de quienes tienen datos y no pisa los que ya había', () => {
    const previo: CompetencyReport = { id: 'p1', student_id: 's2', student_name: 'Alumno 2', class_id: 'c1', period: '2ª evaluación', date: '2027-02-01', text: 'Escrito por mí.', origen: 'mano' };
    render(<Pantalla iniciales={[previo]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Informes de seguimiento de la clase' }));
    // El alumno 1 tiene datos; el 2 ya tenía informe; el 3 no tiene nada en la 2.ª evaluación
    expect(guardados.map(r => r.student_id).sort()).toEqual(['s1', 's2']);
    expect(guardados.find(r => r.student_id === 's2')?.text).toBe('Escrito por mí.');
    expect(guardados.find(r => r.student_id === 's1')?.seguimiento?.notas[0].media).toBe(8.5);
    expect(screen.getByText(/1 informe de seguimiento creado\. Revísalo antes de entregarlo\..*1 alumno no tiene datos en esta evaluación\./)).toBeTruthy();
  });

  it('«Escribir a mano» guarda un informe sin IA ni reglas, y sin texto no guarda nada', () => {
    render(<Pantalla />);
    elegir('Alumno 3');
    expect(screen.getByText('Sin datos en esta evaluación')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Escribir a mano' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar informe' }));
    expect(guardados).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Texto del informe'), { target: { value: 'Se ha incorporado este mes y se está adaptando bien.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar informe' }));
    expect(guardados).toHaveLength(1);
    expect(guardados[0]).toMatchObject({ student_id: 's3', origen: 'mano', text: 'Se ha incorporado este mes y se está adaptando bien.' });
    expect(guardados[0].seguimiento).toBeUndefined();
    expect(hoja()).toContain('Se ha incorporado este mes');
  });

  it('desde la ficha del alumno se abre ya su informe de seguimiento, sin guardar nada todavía', () => {
    render(<Pantalla alumnoInicial="s1" />);
    expect(document.querySelector('.inf-editor')).toBeTruthy();
    expect(within(document.querySelector('.inf-panel') as HTMLElement).getByText('Alumno 1')).toBeTruthy();
    expect(guardados).toHaveLength(0);
    fireEvent.click(within(document.querySelector('.inf-editor') as HTMLElement).getByRole('button', { name: 'Cancelar' }));
    expect(document.querySelector('.inf-editor')).toBeNull();
    expect(screen.getByRole('button', { name: 'Informe de seguimiento' })).toBeTruthy();
  });

  it('avisa si los datos han cambiado desde que se hizo el informe, y «Actualizar los datos» conserva lo escrito', () => {
    const viejo: CompetencyReport = {
      id: 'v1', student_id: 's1', student_name: 'Alumno 1', class_id: 'c1', period: '2ª evaluación', date: '2027-01-25', text: '', origen: 'reglas', tabla: [],
      seguimiento: {
        desde: '2027-01-01', hasta: '2027-03-31', notas: [{ asignatura: 'Matemáticas', media: 6, categorias: [{ nombre: 'Pruebas', peso: 100, media: 6 }] }], asistencia: null,
        positivos: [{ texto: 'Una frase de las reglas de entonces.', origen: 'Notas: Media de 6 en Matemáticas' }, { texto: 'Ayuda a quien lo necesita.' }], mejorar: [],
        observacion: 'Hablamos en la reunión.',
      },
    };
    render(<Pantalla iniciales={[viejo]} />);
    elegir('Alumno 1');
    expect(screen.getByText(/Los datos de esta evaluación han cambiado desde que se hizo el informe/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar los datos' }));
    expect(frases()).toContain('Ayuda a quien lo necesita.');
    expect(frases()).not.toContain('Una frase de las reglas de entonces.');
    expect((screen.getByLabelText('Observaciones del docente') as HTMLTextAreaElement).value).toBe('Hablamos en la reunión.');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(guardados[0].seguimiento?.notas[0].media).toBe(8.5);
    expect(screen.queryByText(/Los datos de esta evaluación han cambiado/)).toBeNull();
  });
});

describe('Informes con la IA como opción', () => {
  beforeEach(() => { ia.conClave = true; });

  it('lo que recibe la IA es de la evaluación elegida: notas, asistencia y evaluaciones', async () => {
    ia.respuesta = 'Texto de la IA.';
    render(<Pantalla />);
    elegir('Alumno 1');
    fireEvent.click(screen.getByRole('button', { name: 'Generar informe' }));
    await waitFor(() => expect(guardados).toHaveLength(1));
    const enviado = ia.llamadas[0];
    expect(enviado).toContain('2ª evaluación');
    expect(enviado).toContain('Problemas de invierno');
    expect(enviado).not.toContain('Problemas de otoño');
    expect(enviado).toContain('NOTA DEL CUADERNO EN Matemáticas: 8,5 sobre 10.');
    expect(enviado).toContain('ASISTENCIA: 2 sesiones registradas, 0 faltas sin justificar, 0 justificadas, 1 retrasos.');
    expect(guardados[0]).toMatchObject({ text: 'Texto de la IA.', origen: 'ia', period: '2ª evaluación' });
  });

  it('en un informe de seguimiento la IA solo pone el texto y los comentarios: la valoración, las frases y la observación no cambian', async () => {
    ia.respuesta = 'Un párrafo de la IA.\n###TABLA###\n[{"clave":"STEM","valoracion":"mejorable","comentario":"Resuelve problemas con soltura."},{"clave":"CD","valoracion":"excelente","comentario":"Sin datos."}]';
    render(<Pantalla />);
    elegir('Alumno 1');
    fireEvent.click(screen.getByRole('button', { name: 'Informe de seguimiento' }));
    fireEvent.change(screen.getByLabelText('Observaciones del docente'), { target: { value: 'Seguimos así.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar informe' }));
    const antes = guardados[0];
    fireEvent.click(screen.getByRole('button', { name: 'Redactar el texto con IA' }));
    await waitFor(() => expect(guardados[0].text).toBe('Un párrafo de la IA.'));
    const r = guardados[0];
    expect(r.origen).toBe('ia');
    expect(r.seguimiento).toEqual(antes.seguimiento);
    // STEM sigue «excelente» (lo fija el código) con el comentario de la IA; CD, que no tiene nota, no entra
    expect(r.tabla).toEqual([{ clave: 'CCL', valoracion: 'mejorable', comentario: '' }, { clave: 'STEM', valoracion: 'excelente', comentario: 'Resuelve problemas con soltura.' }]);
  });

  it('antes de que la IA vuelva a redactar un texto corregido a mano, pregunta', async () => {
    const corregido: CompetencyReport = { id: 'x1', student_id: 's1', student_name: 'Alumno 1', class_id: 'c1', period: '2ª evaluación', date: '2027-02-01', text: 'Texto que corregí.', origen: 'ia', editado: true };
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Pantalla iniciales={[corregido]} />);
    elegir('Alumno 1');
    fireEvent.click(screen.getByRole('button', { name: 'Volver a generar' }));
    expect(confirmar).toHaveBeenCalledOnce();
    expect(ia.llamadas).toHaveLength(0);
    expect(guardados[0].text).toBe('Texto que corregí.');
    confirmar.mockRestore();
  });
});
