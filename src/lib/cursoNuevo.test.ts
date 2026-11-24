import { describe, it, expect } from 'vitest';
import type { Class, Ficha, LearningSituation, Rubric, EvalDiana, Student } from '../types';
import { buildDemoData } from './demoData';
import { buildDemoEF } from './demoEF';
import { buildDemoApoyo } from './demoApoyo';
import { APOYO_VACIO } from './apoyo';
import { EF_VACIO } from './ef';
import {
  archivoDelCurso, claseAlSubir, claseDelMismoCurso, cursoNuevoDe, cursoSiguiente, nombreAlSubir, nombresRepetidos,
  planDePartida, puedeSubir, resumenDeCursoNuevo, type DatosDelCurso, type Destino, type PlanDeCurso,
} from './cursoNuevo';

function vacio(): DatosDelCurso {
  return {
    tasks: [], classes: [], students: [], blocks: [], events: [], rubrics: [], dianas: [], evaluations: [],
    gradeCategories: [], gradeItems: [], grades: {}, dianaProfiles: {}, attendance: {}, reports: [],
    selfAssessments: [], learningSituations: [], fichas: [], workSessions: [], seatingPlans: {}, classMarks: [],
    marksConfigs: {}, apoyo: APOYO_VACIO, ef: EF_VACIO,
  };
}

/** El perfil de ejemplo del docente de aula, con la forma de un perfil guardado. */
function aula(): DatosDelCurso {
  const d = buildDemoData('es');
  return {
    ...vacio(), tasks: d.tasks, classes: d.classes, students: d.students, blocks: d.scheduleBlocks, events: d.calEvents,
    rubrics: d.rubrics, dianas: d.dianas, evaluations: d.evaluations, dianaProfiles: d.dianaProfiles,
    gradeCategories: d.gradeCategories, gradeItems: d.gradeItems, grades: d.grades, classMarks: d.classMarks,
    marksConfigs: d.marksConfigs,
  };
}

const clase = (id: string, name: string, etapa: Class['etapa'], curso: number | undefined, extra: Partial<Class> = {}): Class =>
  ({ id, name, subject: 'Música', subjects: ['Música'], room: '', color: '#000', etapa, curso, ...extra });
const alumno = (id: string, class_id: string, extra: Partial<Student> = {}): Student =>
  ({ id, class_id, name: `Alumno ${id}`, email: '', photo: null, alerts: [], notes: '', ...extra });

function plan(d: DatosDelCurso, destinos: Record<string, Destino>, extra: Partial<PlanDeCurso> = {}): PlanDeCurso {
  return { ...planDePartida(d.classes), ...extra, destinos: { ...planDePartida(d.classes).destinos, ...destinos } };
}

describe('subir de curso', () => {
  it('cambia el número del curso en el nombre, se escriba como se escriba', () => {
    expect(nombreAlSubir({ name: '5º A', etapa: 'primaria', curso: 5 })).toBe('6º A');
    expect(nombreAlSubir({ name: '5.º A', etapa: 'primaria', curso: 5 })).toBe('6.º A');
    expect(nombreAlSubir({ name: '5ºA', etapa: 'primaria', curso: 5 })).toBe('6ºA');
    expect(nombreAlSubir({ name: '1º ESO B', etapa: 'eso', curso: 1 })).toBe('2º ESO B');
    expect(nombreAlSubir({ name: 'Música 3ºB', etapa: 'primaria', curso: 3 })).toBe('Música 4ºB');
  });
  it('el ordinal escrito en catalán, en valenciano, en inglés o en largo sigue bien escrito', () => {
    const sube = (name: string, curso: number, etapa: Class['etapa'] = 'primaria', otros?: string[]) => nombreAlSubir({ name, etapa, curso }, otros);
    expect(sube('1r A', 1)).toBe('2n A');
    expect(sube('2n B', 2)).toBe('3r B');
    expect(sube('3r A', 3)).toBe('4t A');
    expect(sube('4t A', 4)).toBe('5è A');
    expect(sube('5è A', 5)).toBe('6è A');
    expect(sube('5é A', 5)).toBe('6é A');
    // Como ya los escriba el docente en sus otras clases
    expect(sube('4t A', 4, 'primaria', ['4t A', '6é B'])).toBe('5é A');
    expect(sube('6è Primària A', 6)).toBe('1r ESO A');
    expect(sube('6é de Primària B', 6)).toBe('1r ESO B');
    expect(sube('1r ESO C', 1, 'eso')).toBe('2n ESO C');
    expect(sube('3r ESO A', 3, 'eso')).toBe('4t ESO A');
    expect(sube('1st A', 1)).toBe('2nd A');
    expect(sube('2nd A', 2)).toBe('3rd A');
    expect(sube('3rd A', 3)).toBe('4th A');
    expect(sube('5th A', 5)).toBe('6th A');
    expect(sube('6th Primary A', 6)).toBe('1st ESO A');
    expect(sube('1er A', 1)).toBe('2º A');
    expect(sube('3ro B', 3)).toBe('4to B');
    // El nombre escrito con las tildes descompuestas (pegado desde otro sitio)
    expect(sube('5e\u0300 A', 5)).toBe('6è A');
  });
  it('una letra pegada al número es el grupo, no un ordinal', () => {
    expect(nombreAlSubir({ name: '4T', etapa: 'primaria', curso: 4 })).toBe('5T');
    expect(nombreAlSubir({ name: '2A', etapa: 'primaria', curso: 2 })).toBe('3A');
    expect(nombreAlSubir({ name: '5t', etapa: 'primaria', curso: 5 })).toBe('6t');
    expect(nombreAlSubir({ name: '3 r', etapa: 'primaria', curso: 3 })).toBe('4 r');
    expect(nombreAlSubir({ name: '1resto', etapa: 'primaria', curso: 1 })).toBe('2resto');
  });
  it('no toca otros números ni un nombre que no lleva el curso', () => {
    expect(nombreAlSubir({ name: 'Los delfines', etapa: 'primaria', curso: 2 })).toBe('Los delfines');
    expect(nombreAlSubir({ name: 'Aula 12 · 2º A', etapa: 'primaria', curso: 2 })).toBe('Aula 12 · 3º A');
    expect(nombreAlSubir({ name: '5º A' })).toBe('5º A');
  });
  it('de 6.º de Primaria se pasa a 1.º de ESO, también en el nombre', () => {
    expect(nombreAlSubir({ name: '6º Primaria A', etapa: 'primaria', curso: 6 })).toBe('1º ESO A');
    expect(nombreAlSubir({ name: '6º de Primària A', etapa: 'primaria', curso: 6 })).toBe('1º ESO A');
    expect(nombreAlSubir({ name: '6º A', etapa: 'primaria', curso: 6 })).toBe('1º A');
    const c = claseAlSubir(clase('x', '6º Primaria A', 'primaria', 6, { materiasOficiales: { Música: 'musica-y-danza' } }));
    expect(c).toMatchObject({ id: 'x', name: '1º ESO A', etapa: 'eso', curso: 1, subjects: ['Música'], materiasOficiales: {} });
  });
  it('dentro de la etapa conserva las asignaturas y sus materias oficiales, y quita la opción de Matemáticas', () => {
    const c = claseAlSubir(clase('x', '3º ESO A', 'eso', 3, { materiasOficiales: { Música: 'musica' }, opcionMatematicas: 'A', isTutoria: true, room: 'A1' }));
    expect(c).toMatchObject({ name: '4º ESO A', etapa: 'eso', curso: 4, materiasOficiales: { Música: 'musica' }, isTutoria: true, room: 'A1' });
    expect('opcionMatematicas' in c).toBe(false);
  });
  it('el nombre que corrige el docente manda', () => {
    expect(claseAlSubir(clase('x', '5º A', 'primaria', 5), '  6º Azul ').name).toBe('6º Azul');
    expect(claseAlSubir(clase('x', '5º A', 'primaria', 5), '   ').name).toBe('6º A');
  });
  it('4.º de ESO no puede subir: si se pide, se queda vacía', () => {
    expect(puedeSubir({ etapa: 'eso', curso: 4 })).toBe(false);
    expect(puedeSubir({ etapa: 'primaria', curso: 6 })).toBe(true);
    expect(puedeSubir({})).toBe(true);
    const d = { ...vacio(), classes: [clase('c4', '4º ESO A', 'eso', 4)], students: [alumno('a', 'c4')] };
    const n = cursoNuevoDe(d, plan(d, { c4: 'sube' }));
    expect(n.classes).toEqual(d.classes);
    expect(n.students).toEqual([]);
  });
});

describe('clases y alumnado', () => {
  const d = (): DatosDelCurso => ({
    ...vacio(),
    classes: [clase('a', '5º A', 'primaria', 5), clase('b', '5º B', 'primaria', 5), clase('c', '6º A', 'primaria', 6)],
    students: [
      alumno('1', 'a', { alerts: [{ id: 'al', text: 'Se sienta delante', level: 'info' }], notes: 'Nota' }),
      alumno('2', 'a'), alumno('3', 'b'), alumno('4', 'c'),
    ],
  });

  it('la que sube pasa de curso con su alumnado, la vacía se queda sin él y la que se va desaparece', () => {
    const n = cursoNuevoDe(d(), plan(d(), { a: 'sube', b: 'vacia', c: 'se-va' }));
    expect(n.classes.map(c => [c.id, c.name, c.curso])).toEqual([['a', '6º A', 6], ['b', '5º B', 5]]);
    expect(n.students.map(s => s.id)).toEqual(['1', '2']);
    expect(n.students.every(s => s.class_id === 'a')).toBe(true);
  });
  it('los avisos y las notas de la ficha se conservan solo si se pide', () => {
    const con = cursoNuevoDe(d(), plan(d(), { a: 'sube' }, { conservarAvisos: true }));
    expect(con.students[0].alerts).toHaveLength(1);
    expect(con.students[0].notes).toBe('Nota');
    const sin = cursoNuevoDe(d(), plan(d(), { a: 'sube' }, { conservarAvisos: false }));
    expect(sin.students[0].alerts).toEqual([]);
    expect(sin.students[0].notes).toBe('');
    expect(sin.students[0].name).toBe(con.students[0].name);
  });
  it('de partida todas se quedan vacías y se conserva todo lo que se puede elegir', () => {
    const p = planDePartida(d().classes);
    expect(p).toEqual({ destinos: { a: 'vacia', b: 'vacia', c: 'vacia' }, nombres: {}, conservarAvisos: true, conservarHorario: true, conservarCuaderno: true });
    const n = cursoNuevoDe(d(), p);
    expect(n.classes).toEqual(d().classes);
    expect(n.students).toEqual([]);
  });
  it('no cambia los datos que recibe', () => {
    const antes = d();
    const copia = JSON.stringify(antes);
    cursoNuevoDe(antes, plan(antes, { a: 'sube', c: 'se-va' }, { conservarAvisos: false }));
    expect(JSON.stringify(antes)).toBe(copia);
  });
  it('avisa de los nombres que quedarían repetidos', () => {
    // 5º A sube a «6º A» y la 6º A de ahora se queda vacía: dos «6º A»
    expect(nombresRepetidos(d().classes, plan(d(), { a: 'sube' }))).toEqual(['6º A']);
    expect(nombresRepetidos(d().classes, plan(d(), { a: 'sube', c: 'se-va' }))).toEqual([]);
    expect(nombresRepetidos(d().classes, { ...plan(d(), { a: 'sube' }), nombres: { a: '6º C' } })).toEqual([]);
  });
});

describe('horario y cuaderno', () => {
  const base = aula();
  const destinos: Record<string, Destino> = { c1: 'sube', c2: 'vacia', c3: 'se-va' };

  it('el horario de las clases que siguen se conserva, y el de las que se van no', () => {
    const n = cursoNuevoDe(base, plan(base, destinos));
    expect(n.blocks.length).toBeGreaterThan(0);
    expect(n.blocks.some(b => b.class_id === 'c3')).toBe(false);
    expect(n.blocks.map(b => b.id)).toEqual(base.blocks.filter(b => !b.class_id || b.class_id !== 'c3').map(b => b.id));
    // Los de la clase que se queda vacía, tal cual
    expect(n.blocks.filter(b => b.class_id === 'c2')).toEqual(base.blocks.filter(b => b.class_id === 'c2'));
    // Un bloque sin clase (un recreo, una guardia) también se queda
    const conRecreo = { ...base, blocks: [...base.blocks, { ...base.blocks[0], id: 'recreo', class_id: '' }] };
    expect(cursoNuevoDe(conRecreo, plan(conRecreo, destinos)).blocks.some(b => b.id === 'recreo')).toBe(true);
  });
  it('el bloque de una clase que sube lleva su nombre nuevo si llevaba escrito el de antes, y solo eso cambia', () => {
    const n = cursoNuevoDe(base, plan(base, destinos));
    const antes = base.blocks.filter(b => b.class_id === 'c1');
    const ahora = n.blocks.filter(b => b.class_id === 'c1');
    expect(antes[0].subject).toBe('1º ESO A - Matemáticas');
    expect(ahora.map(b => b.subject)).toEqual(antes.map(() => '2º ESO A - Matemáticas'));
    expect(ahora.map(b => ({ ...b, subject: '' }))).toEqual(antes.map(b => ({ ...b, subject: '' })));
    // Con el nombre que corrige el docente, ese; y un bloque que solo dice la asignatura no se toca
    const suelto = { ...base, blocks: [{ ...antes[0], subject: 'Matemáticas' }, antes[0]] };
    const m = cursoNuevoDe(suelto, plan(suelto, destinos, { nombres: { c1: '2º ESO C' } }));
    expect(m.blocks.map(b => b.subject)).toEqual(['Matemáticas', '2º ESO C - Matemáticas']);
  });
  it('sin conservar el horario, empieza vacío', () => {
    expect(cursoNuevoDe(base, plan(base, destinos, { conservarHorario: false })).blocks).toEqual([]);
  });
  it('las categorías y los pesos se conservan en las clases que siguen, con el bloque de trabajo diario', () => {
    const n = cursoNuevoDe(base, plan(base, destinos));
    expect(n.gradeCategories).toEqual(base.gradeCategories.filter(g => g.class_id !== 'c3'));
    expect(n.gradeCategories.filter(g => g.class_id === 'c1').length).toBeGreaterThan(0);
    expect(Object.keys(n.marksConfigs).length).toBeGreaterThan(0);
    expect(Object.keys(n.marksConfigs).some(k => k.startsWith('c3|'))).toBe(false);
    expect(Object.keys(n.marksConfigs).some(k => k.startsWith('c1|'))).toBe(true);
  });
  it('sin conservar el cuaderno, no queda ninguna categoría', () => {
    const n = cursoNuevoDe(base, plan(base, destinos, { conservarCuaderno: false }));
    expect(n.gradeCategories).toEqual([]);
    expect(n.marksConfigs).toEqual({});
  });
  it('notas, columnas, evaluaciones, asistencia, anotaciones, informes, mesas y dianas competenciales empiezan limpios', () => {
    const lleno: DatosDelCurso = {
      ...base,
      attendance: { c1: { '2026-10-01': { s01: 'absent' } } },
      reports: [{ id: 'r', class_id: 'c1' } as never],
      seatingPlans: { c1: { class_id: 'c1' } as never },
      selfAssessments: [{ id: 'sa', class_id: 'c1' } as never],
    };
    expect(lleno.gradeItems.length).toBeGreaterThan(0);
    expect(lleno.evaluations.length).toBeGreaterThan(0);
    expect(lleno.classMarks.length).toBeGreaterThan(0);
    const n = cursoNuevoDe(lleno, plan(lleno, { c1: 'sube', c2: 'sube' }));
    expect(n.gradeItems).toEqual([]);
    expect(n.grades).toEqual({});
    expect(n.evaluations).toEqual([]);
    expect(n.attendance).toEqual({});
    expect(n.classMarks).toEqual([]);
    expect(n.reports).toEqual([]);
    expect(n.seatingPlans).toEqual({});
    expect(n.dianaProfiles).toEqual({});
    expect(n.selfAssessments).toEqual([]);
  });
  it('los eventos de la agenda que ya han pasado se van, y los de hoy en adelante se quedan', () => {
    const ev = (id: string, date: string) => ({ id, name: id, date, time: '09:00', type: 'meeting' as const, urgency: 'media' as const, color: '#000', desc: '' });
    const d = { ...base, events: [ev('junio', '2027-06-20'), ev('hoy', '2027-09-02'), ev('claustro', '2027-09-03'), ev('sin-fecha', '')] };
    const n = cursoNuevoDe(d, plan(d, {}), '2027-09-02');
    expect(n.events.map(e => e.id)).toEqual(['hoy', 'claustro']);
    const r = resumenDeCursoNuevo(d, plan(d, {}), '2027-09-02');
    expect(r.conserva.eventos).toBe(2);
    expect(r.borra.eventos).toBe(2);
    // Sin decir el día, cuenta el de hoy: lo de dentro de un siglo se queda y lo del siglo pasado se va
    const s = { ...base, events: [ev('lejos', '2126-01-01'), ev('antiguo', '1999-01-01')] };
    expect(cursoNuevoDe(s, plan(s, {})).events.map(e => e.id)).toEqual(['lejos']);
  });
  it('las tareas pendientes siguen y las hechas se van', () => {
    const d = { ...base, tasks: [{ id: 't1', text: 'Pendiente', priority: 'high' as const, done: false }, { id: 't2', text: 'Hecha', priority: 'low' as const, done: true }] };
    expect(cursoNuevoDe(d, plan(d, {})).tasks.map(t => t.id)).toEqual(['t1']);
  });
  it('las reuniones y formaciones no se tocan', () => {
    const d = { ...base, workSessions: [{ id: 'w1', kind: 'training', title: 'Curso' } as never] };
    expect(cursoNuevoDe(d, plan(d, {})).workSessions).toBe(d.workSessions);
  });
});

describe('rúbricas, dianas y escalas: siguen con sus clases', () => {
  const clases = [clase('a', '5º A', 'primaria', 5), clase('b', '5º B', 'primaria', 5), clase('c', '6º A', 'primaria', 6)];
  const rubrica = (extra: Partial<Rubric>): Rubric => ({ id: 'r1', name: 'Exposición oral', criteria: [], ...extra });
  const con = (rubrics: Rubric[], dianas: EvalDiana[] = []): DatosDelCurso => ({ ...vacio(), classes: clases, rubrics, dianas });

  it('se conservan todas, también las que no tienen clase', () => {
    const d = con([rubrica({}), rubrica({ id: 'r2', class_id: 'a', subject: 'Música', category_id: 'g1' })]);
    const n = cursoNuevoDe(d, plan(d, { a: 'se-va', b: 'se-va', c: 'se-va' }));
    expect(n.rubrics.map(r => r.id)).toEqual(['r1', 'r2']);
    expect(n.rubrics[1]).toEqual({ id: 'r2', name: 'Exposición oral', criteria: [] });
  });
  it('la clase que sube o se queda vacía conserva la rúbrica, con su categoría del cuaderno', () => {
    const d = con([rubrica({ class_id: 'a', subject: 'Música', category_id: 'g1' })]);
    for (const destino of ['sube', 'vacia'] as const) {
      const n = cursoNuevoDe(d, plan(d, { a: destino }));
      expect(n.rubrics[0]).toEqual(d.rubrics[0]);
    }
  });
  it('sin conservar el cuaderno, sigue unida a la clase pero sin categoría', () => {
    const d = con([rubrica({ class_id: 'a', subject: 'Música', category_id: 'g1', otras_clases: [{ class_id: 'b', subject: 'Música', category_id: 'g9' }] })]);
    const n = cursoNuevoDe(d, plan(d, {}, { conservarCuaderno: false }));
    expect(n.rubrics[0]).toEqual({ id: 'r1', name: 'Exposición oral', criteria: [], class_id: 'a', subject: 'Música', otras_clases: [{ class_id: 'b', subject: 'Música' }] });
  });
  it('si la clase principal se va, pasa a serlo la primera de las otras que sigue', () => {
    const d = con([rubrica({
      class_id: 'a', subject: 'Música', category_id: 'g1',
      otras_clases: [{ class_id: 'c', subject: 'Plástica', category_id: 'g3' }, { class_id: 'b', subject: 'Música', category_id: 'g2' }],
      areas: [{ subject: 'Música', category_id: 'g1' }, { subject: 'Lengua', category_id: 'g7' }], modo_areas: 'criterio',
    })]);
    const n = cursoNuevoDe(d, plan(d, { a: 'se-va', c: 'se-va' }));
    // Las áreas eran de la clase principal de antes: ya no valen
    expect(n.rubrics[0]).toEqual({ id: 'r1', name: 'Exposición oral', criteria: [], class_id: 'b', subject: 'Música', category_id: 'g2' });
    const m = cursoNuevoDe(d, plan(d, { a: 'se-va' }));
    expect(m.rubrics[0]).toMatchObject({ class_id: 'c', subject: 'Plástica', category_id: 'g3', otras_clases: [{ class_id: 'b', subject: 'Música', category_id: 'g2' }] });
  });
  it('las áreas de una situación interdisciplinar se conservan si la clase principal sigue', () => {
    const areas = [{ subject: 'Música', category_id: 'g1' }, { subject: 'Lengua', category_id: 'g7', materia: 'lengua-castellana' }];
    const d = con([rubrica({ class_id: 'a', subject: 'Música', category_id: 'g1', areas, modo_areas: 'criterio' })]);
    expect(cursoNuevoDe(d, plan(d, { a: 'sube' })).rubrics[0]).toEqual(d.rubrics[0]);
    expect(cursoNuevoDe(d, plan(d, { a: 'sube' }, { conservarCuaderno: false })).rubrics[0].areas)
      .toEqual([{ subject: 'Música' }, { subject: 'Lengua', materia: 'lengua-castellana' }]);
  });
  it('las dianas y las escalas de registro, igual', () => {
    const diana = { id: 'd1', name: 'Diana', items: [], class_id: 'c', subject: 'Música', category_id: 'g3' } as unknown as EvalDiana;
    const escala = { id: 'e1', name: 'Escala', items: [], tipo: 'registro', class_id: 'a', otras_clases: [{ class_id: 'c' }] } as unknown as EvalDiana;
    const d = con([], [diana, escala]);
    const n = cursoNuevoDe(d, plan(d, { c: 'se-va' }));
    expect(n.dianas).toHaveLength(2);
    expect(n.dianas[0].class_id).toBeUndefined();
    expect(n.dianas[0].category_id).toBeUndefined();
    expect(n.dianas[1]).toMatchObject({ id: 'e1', tipo: 'registro', class_id: 'a' });
    expect(n.dianas[1].otras_clases).toBeUndefined();
  });
  it('en los datos de ejemplo, ninguna rúbrica ni diana se pierde ni queda apuntando a una clase que no está', () => {
    const base = aula();
    const n = cursoNuevoDe(base, plan(base, { c1: 'sube', c2: 'se-va', p6: 'se-va', p1: 'sube' }));
    const ids = new Set(n.classes.map(c => c.id));
    expect(n.rubrics.map(r => r.id)).toEqual(base.rubrics.map(r => r.id));
    expect(n.dianas.map(r => r.id)).toEqual(base.dianas.map(r => r.id));
    for (const i of [...n.rubrics, ...n.dianas]) {
      for (const id of [i.class_id, ...(i.otras_clases ?? []).map(o => o.class_id)]) if (id) expect(ids.has(id)).toBe(true);
    }
    const categorias = new Set(n.gradeCategories.map(g => g.id));
    for (const i of [...n.rubrics, ...n.dianas]) if (i.category_id) expect(categorias.has(i.category_id)).toBe(true);
  });
});

describe('situaciones, fichas y sesiones: siguen en su curso', () => {
  const a5 = clase('a', '5º A', 'primaria', 5);
  const b5 = clase('b', '5º B', 'primaria', 5);
  const a4 = clase('c', '4º A', 'primaria', 4);
  const a6 = clase('e', '6º A', 'primaria', 6);
  const sda = (extra: Partial<LearningSituation>): LearningSituation =>
    ({ id: 's1', at: '', date: '2026-10-01', title: 'El agua', request: {} as never, content: { sesiones: [] } as never, ...extra });
  const ficha = (extra: Partial<Ficha>): Ficha =>
    ({ id: 'f1', at: '', date: '2026-10-01', title: 'Fracciones', request: {} as never, content: {} as never, ...extra });

  it('la clase del mismo curso: ella misma si se queda vacía', () => {
    expect(claseDelMismoCurso(a5, [a5, b5])).toBe('a');
  });
  it('si sube, lo suyo pasa a la clase que llega a su curso, la de su misma letra', () => {
    // 5º A y 5º B suben a 6º; 4º A sube a 5º A
    const nuevas = [claseAlSubir(a5), claseAlSubir(b5), claseAlSubir(a4)];
    expect(claseDelMismoCurso(a5, nuevas)).toBe('c');
    // 5º B no tiene quien llegue con su letra, pero solo hay una clase de 5º: esa
    expect(claseDelMismoCurso(b5, nuevas)).toBe('c');
  });
  it('con varias clases en su curso y ninguna de su letra, a ninguna', () => {
    const c5 = clase('z', '5º C', 'primaria', 5);
    expect(claseDelMismoCurso(c5, [a5, b5])).toBeUndefined();
  });
  it('sin ninguna clase de su curso, a ninguna', () => {
    expect(claseDelMismoCurso(a5, [claseAlSubir(a5)])).toBeUndefined();
    expect(claseDelMismoCurso(a5, [])).toBeUndefined();
  });
  it('una clase sin etapa ni curso: lo suyo sigue con ella mientras exista', () => {
    const libre = clase('l', 'Taller', undefined, undefined);
    expect(claseDelMismoCurso(libre, [libre])).toBe('l');
    expect(claseDelMismoCurso(libre, [a5])).toBeUndefined();
  });

  it('el especialista que sube todos los grupos: lo de 5.º queda en el 5.º nuevo, y lo de 6.º, en el 6.º nuevo', () => {
    const d: DatosDelCurso = {
      ...vacio(), classes: [a4, a5, a6],
      learningSituations: [sda({ id: 's5', class_id: 'a', class_name: '5º A' }), sda({ id: 's6', class_id: 'e', class_name: '6º A' }), sda({ id: 's4', class_id: 'c', class_name: '4º A' })],
      fichas: [ficha({ id: 'f5', class_id: 'a', class_name: '5º A', sda_id: 's5' })],
      ef: { ...EF_VACIO, sesiones: [{ id: 'se5', titulo: 'Ritmo', claseId: 'a', fecha: '2026-10-02', completada: true } as never] },
    };
    // 4º A → 5º A, 5º A → 6º A, 6º A se va
    const n = cursoNuevoDe(d, plan(d, { c: 'sube', a: 'sube', e: 'se-va' }));
    expect(n.classes.map(c => [c.id, c.name])).toEqual([['c', '5º A'], ['a', '6º A']]);
    const s = Object.fromEntries(n.learningSituations.map(x => [x.id, x]));
    expect(s.s5).toMatchObject({ class_id: 'c', class_name: '5º A' });
    expect(s.s6).toMatchObject({ class_id: 'a', class_name: '6º A' });
    // Nadie llega a 4.º: se queda en la biblioteca, sin clase
    expect(s.s4.class_id).toBeUndefined();
    expect(s.s4.class_name).toBeUndefined();
    expect(n.fichas[0]).toMatchObject({ id: 'f5', class_id: 'c', class_name: '5º A', sda_id: 's5' });
    // La sesión sigue en 5.º, sin fecha y sin la marca de hecha
    expect(n.ef.sesiones[0]).toEqual({ id: 'se5', titulo: 'Ritmo', claseId: 'c' });
  });

  it('la clase que se queda vacía conserva sus situaciones, fichas y sesiones', () => {
    const d: DatosDelCurso = {
      ...vacio(), classes: [a5],
      learningSituations: [sda({ class_id: 'a', class_name: '5º A' })], fichas: [ficha({ class_id: 'a', class_name: '5º A' })],
      ef: { ...EF_VACIO, sesiones: [{ id: 'se', titulo: 'S', claseId: 'a', fecha: '2026-11-02', sdaId: 's1', sdaOrden: 2, archivada: true } as never] },
    };
    const n = cursoNuevoDe(d, plan(d, { a: 'vacia' }));
    expect(n.learningSituations[0]).toMatchObject({ class_id: 'a', class_name: '5º A' });
    expect(n.fichas[0]).toMatchObject({ class_id: 'a', class_name: '5º A' });
    expect(n.ef.sesiones[0]).toEqual({ id: 'se', titulo: 'S', claseId: 'a', sdaId: 's1', sdaOrden: 2, archivada: true });
  });

  it('el tutor que sube con su grupo y no tiene otra clase: lo de 5.º se queda sin clase, pero no se pierde', () => {
    const d: DatosDelCurso = {
      ...vacio(), classes: [a5],
      learningSituations: [sda({ class_id: 'a', class_name: '5º A' })], fichas: [ficha({ class_id: 'a', class_name: '5º A' }), ficha({ id: 'f2' })],
    };
    const n = cursoNuevoDe(d, plan(d, { a: 'sube' }));
    expect(n.learningSituations).toHaveLength(1);
    expect(n.learningSituations[0].class_id).toBeUndefined();
    expect(n.learningSituations[0].title).toBe('El agua');
    expect(n.fichas.map(f => [f.id, f.class_id])).toEqual([['f1', undefined], ['f2', undefined]]);
    expect(resumenDeCursoNuevo(d, plan(d, { a: 'sube' })).sinClase).toEqual({ situaciones: 1, fichas: 1, sesiones: 0, instrumentos: 0 });
  });

  it('una situación de varias clases se queda con las que siguen en su curso, sin repetir', () => {
    const d: DatosDelCurso = {
      ...vacio(), classes: [a5, b5, a6],
      learningSituations: [sda({ class_id: 'e', otras_clases: ['a', 'b'], class_name: '6º A, 5º A, 5º B' })],
    };
    // 6º A se va; 5º A se queda vacía; 5º B se va
    const n = cursoNuevoDe(d, plan(d, { e: 'se-va', a: 'vacia', b: 'se-va' }));
    // Lo de 5º B pasa a la única clase de 5.º que queda, que ya estaba: una sola vez
    expect(n.learningSituations[0]).toMatchObject({ class_id: 'a', class_name: '5º A' });
    expect(n.learningSituations[0].otras_clases).toBeUndefined();
    const m = cursoNuevoDe(d, plan(d, { e: 'vacia', a: 'vacia', b: 'vacia' }));
    expect(m.learningSituations[0]).toMatchObject({ class_id: 'e', otras_clases: ['a', 'b'], class_name: '6º A, 5º A, 5º B' });
  });

  it('las sesiones de una situación dejan de estar hechas, y lo demás no se toca', () => {
    const contenido = { titulo: 'x', sesiones: [{ fase: '1', titulo: 'A', descripcion: '', completada: true }, { fase: '2', titulo: 'B', descripcion: '' }] };
    const d: DatosDelCurso = { ...vacio(), classes: [a5], learningSituations: [sda({ class_id: 'a', content: contenido as never }), sda({ id: 's2', content: { sesiones: [{ fase: '1', titulo: 'C', descripcion: '' }] } as never })] };
    const n = cursoNuevoDe(d, plan(d, {}));
    expect(n.learningSituations[0].content).toEqual({ titulo: 'x', sesiones: [{ fase: '1', titulo: 'A', descripcion: '' }, { fase: '2', titulo: 'B', descripcion: '' }] });
    // Sin nada hecho, el contenido es el mismo objeto
    expect(n.learningSituations[1].content).toBe(d.learningSituations[1].content);
  });
});

describe('perfil de Educación Física', () => {
  const hoy = new Date(2026, 5, 20);
  const ef = (): DatosDelCurso => ({ ...vacio(), ...buildDemoEF(hoy, 'es') });

  it('los datos de ejemplo tienen de todo', () => {
    const d = ef();
    expect(d.ef.material.length).toBeGreaterThan(0);
    expect(d.ef.sesiones.length).toBeGreaterThan(0);
    expect(Object.keys(d.ef.sexos).length).toBe(d.students.length);
  });
  it('conserva el material, las pruebas, los baremos, las actividades, las instalaciones, los circuitos y las pizarras', () => {
    const d = ef();
    const conPizarra: DatosDelCurso = { ...d, ef: { ...d.ef, pizarras: [{ id: 'pz1', nombre: 'Circuito de fuerza' } as never], circuitos: [{ id: 'ci1' } as never] } };
    const n = cursoNuevoDe(conPizarra, plan(conPizarra, { 'ef-c1': 'sube', 'ef-c2': 'vacia', 'ef-c3': 'se-va' }));
    for (const k of ['material', 'pruebas', 'baremos', 'actividades', 'instalaciones', 'circuitos', 'pizarras'] as const) {
      expect(n.ef[k], k).toBe(conPizarra.ef[k]);
    }
  });
  it('las marcas, los exentos y los equipos empiezan limpios', () => {
    const d = ef();
    const lleno: DatosDelCurso = { ...d, ef: { ...d.ef, equipos: { 'ef-c1': { grupos: [['ef-s00']] } as never }, exentos: [{ id: 'x', alumnoId: 'ef-s00' } as never], marcas: [{ id: 'm', alumnoId: 'ef-s00', pruebaId: 'p' } as never], pruebas: [{ id: 'p', nombre: 'Salto' } as never] } };
    const n = cursoNuevoDe(lleno, plan(lleno, { 'ef-c1': 'sube' }));
    expect(n.ef.marcas).toEqual([]);
    expect(n.ef.pruebas).toBe(lleno.ef.pruebas);
    expect(n.ef.exentos).toEqual([]);
    expect(n.ef.equipos).toEqual({});
  });
  it('del alumnado que sube se conservan el nivel, con quién no juntarlo y, con los avisos, sus medidas de apoyo', () => {
    const d = ef();
    const sube = d.students.filter(s => s.class_id === 'ef-c1').map(s => s.id);
    const otro = d.students.find(s => s.class_id === 'ef-c2')!.id;
    const lleno: DatosDelCurso = {
      ...d, ef: {
        ...d.ef,
        separar: [{ a: sube[0], b: sube[1] }, { a: sube[0], b: otro }],
        apoyos: [{ id: 'ap1', alumnoId: sube[0], nivel: 2, necesidades: [], otra: '' } as never, { id: 'ap2', alumnoId: otro, nivel: 2, necesidades: [], otra: '' } as never],
      },
    };
    const n = cursoNuevoDe(lleno, plan(lleno, { 'ef-c1': 'sube', 'ef-c2': 'vacia' }));
    expect(Object.keys(n.ef.sexos).sort()).toEqual([...sube].sort());
    expect(Object.keys(n.ef.niveles).sort()).toEqual([...sube].sort());
    expect(n.ef.separar).toEqual([{ a: sube[0], b: sube[1] }]);
    expect(n.ef.apoyos.map(a => a.id)).toEqual(['ap1']);
    const sinAvisos = cursoNuevoDe(lleno, plan(lleno, { 'ef-c1': 'sube' }, { conservarAvisos: false }));
    expect(sinAvisos.ef.apoyos).toEqual([]);
    expect(Object.keys(sinAvisos.ef.sexos)).toHaveLength(sube.length);
  });
  it('las sesiones se conservan sin fecha ni «hecha», en la clase de su curso', () => {
    const d = ef();
    expect(d.ef.sesiones.length).toBeGreaterThan(0);
    // 1º ESO A se queda vacía y 1º ESO B se va: las sesiones de 1.º siguen en 1.º; 3º ESO A sube y nadie llega a 3.º
    const n = cursoNuevoDe(d, plan(d, { 'ef-c1': 'vacia', 'ef-c2': 'se-va', 'ef-c3': 'sube' }));
    expect(n.ef.sesiones.map(s => s.id)).toEqual(d.ef.sesiones.map(s => s.id));
    expect(n.ef.sesiones.every(s => !s.fecha && !s.completada)).toBe(true);
    d.ef.sesiones.forEach((s, i) => {
      const esperada = s.claseId === 'ef-c1' || s.claseId === 'ef-c2' ? 'ef-c1' : undefined;
      expect(n.ef.sesiones[i].claseId, s.id).toBe(esperada);
      expect(n.ef.sesiones[i].titulo).toBe(s.titulo);
    });
  });
  it('el cuaderno de tres componentes y el horario siguen en las clases que siguen', () => {
    const d = ef();
    const n = cursoNuevoDe(d, plan(d, { 'ef-c1': 'sube', 'ef-c2': 'vacia', 'ef-c3': 'se-va' }));
    expect(n.classes.map(c => c.name)).toEqual(['2º ESO A', '1º ESO B']);
    expect(n.gradeCategories.filter(g => g.class_id === 'ef-c1').map(g => g.weight)).toEqual([40, 30, 30]);
    expect(n.gradeCategories.some(g => g.class_id === 'ef-c3')).toBe(false);
    expect(n.blocks.map(b => b.class_id).sort()).toEqual(d.blocks.filter(b => b.class_id !== 'ef-c3').map(b => b.class_id).sort());
    expect(n.students.map(s => s.class_id).every(id => id === 'ef-c1')).toBe(true);
    expect(n.gradeItems).toEqual([]);
  });
});

describe('perfil de PT y AL', () => {
  const hoy = new Date(2026, 5, 20);
  const pt = (): DatosDelCurso => ({ ...vacio(), apoyo: buildDemoApoyo(hoy, 'es') });

  it('conserva el alumnado de apoyo con sus grupos, sus programas, sus adaptaciones y sus agendas', () => {
    const d = pt();
    expect(d.apoyo.alumnos.length).toBeGreaterThan(0);
    expect(d.apoyo.sesiones.length).toBeGreaterThan(0);
    const n = cursoNuevoDe(d, planDePartida([]));
    expect(n.apoyo.alumnos).toBe(d.apoyo.alumnos);
    expect(n.apoyo.grupos).toBe(d.apoyo.grupos);
    expect(n.apoyo.programas).toBe(d.apoyo.programas);
    expect(n.apoyo.agendas).toBe(d.apoyo.agendas);
    expect(n.apoyo.fotos).toBe(d.apoyo.fotos);
    expect(n.apoyo.acs.map(a => a.id)).toEqual(d.apoyo.acs.map(a => a.id));
  });
  it('los registros de las sesiones, las coordinaciones, los cierres y los documentos empiezan limpios', () => {
    const n = cursoNuevoDe(pt(), planDePartida([]));
    expect(n.apoyo.sesiones).toEqual([]);
    expect(n.apoyo.coordinaciones).toEqual([]);
    expect(n.apoyo.evaluaciones).toEqual([]);
    expect(n.apoyo.documentos).toEqual([]);
  });
  it('las adaptaciones pierden las notas de los trimestres y la promoción del curso que acaba', () => {
    const d = pt();
    const conAcs: DatosDelCurso = { ...d, apoyo: { ...d.apoyo, acs: [{ id: 'acs1', alumnoId: d.apoyo.alumnos[0].id, notas: { t1: 'x' }, promocion: 'sí' } as never] } };
    const n = cursoNuevoDe(conAcs, planDePartida([]));
    expect(n.apoyo.acs).toEqual([{ id: 'acs1', alumnoId: d.apoyo.alumnos[0].id }]);
  });
  it('la adaptación de aula sigue con el alumno que sube, y se va con el que sale', () => {
    const d: DatosDelCurso = {
      ...vacio(),
      classes: [clase('a', '5º A', 'primaria', 5), clase('b', '5º B', 'primaria', 5)],
      students: [alumno('1', 'a'), alumno('2', 'b')],
      apoyo: { ...APOYO_VACIO, acsAula: [{ id: 'x1', alumnoId: '1', notas: { t1: 'x' } } as never, { id: 'x2', alumnoId: '2' } as never] },
    };
    const n = cursoNuevoDe(d, plan(d, { a: 'sube', b: 'vacia' }));
    expect(n.apoyo.acsAula).toEqual([{ id: 'x1', alumnoId: '1' }]);
  });
  it('el resumen cuenta lo de PT y AL', () => {
    const d = pt();
    const r = resumenDeCursoNuevo(d, planDePartida([]));
    expect(r.conserva.alumnadoDeApoyo).toBe(d.apoyo.alumnos.length);
    expect(r.conserva.programas).toBe(d.apoyo.programas.length);
    expect(r.borra.registrosDeApoyo).toBe(d.apoyo.sesiones.length);
    expect(r.borra.coordinaciones).toBe(d.apoyo.coordinaciones.length);
  });
});

describe('resumen antes de aplicar', () => {
  it('cuenta las clases, el alumnado, lo que se conserva y lo que se borra', () => {
    const d = aula();
    const p = plan(d, { c1: 'sube', c2: 'sube', c3: 'se-va', p6: 'se-va' });
    const r = resumenDeCursoNuevo(d, p, '2999-01-01');
    expect(r.clases).toEqual({ suben: 2, vacias: d.classes.length - 4, seVan: 2 });
    expect(r.alumnado.sigue).toBe(12);
    expect(r.alumnado.sale).toBe(d.students.length - 12);
    expect(r.conserva.rubricas).toBe(d.rubrics.length);
    expect(r.conserva.dianas + r.conserva.escalas).toBe(d.dianas.length);
    expect(r.conserva.bloquesDeHorario + r.borra.bloquesDeHorario).toBe(d.blocks.length);
    expect(r.conserva.categorias + r.borra.categorias).toBe(d.gradeCategories.length);
    expect(r.borra.evaluaciones).toBe(d.evaluations.length);
    expect(r.borra.columnas).toBe(d.gradeItems.length);
    expect(r.borra.notas).toBeGreaterThan(0);
    expect(r.borra.anotaciones).toBe(d.classMarks.length);
    expect(r.borra.eventos).toBe(d.events.length);
  });
  it('lo que dice el resumen es lo que hace el cambio', () => {
    const d = aula();
    const p = plan(d, { c1: 'sube', p1: 'sube', c4: 'se-va' }, { conservarHorario: false, conservarCuaderno: false });
    const r = resumenDeCursoNuevo(d, p);
    const n = cursoNuevoDe(d, p);
    expect(r.conserva.bloquesDeHorario).toBe(0);
    expect(r.borra.bloquesDeHorario).toBe(d.blocks.length);
    expect(r.conserva.categorias).toBe(0);
    expect(r.alumnado.sigue).toBe(n.students.length);
    expect(r.clases.suben + r.clases.vacias).toBe(n.classes.length);
  });
  it('cuenta el alumnado que sigue con avisos o notas en su ficha', () => {
    const d: DatosDelCurso = {
      ...vacio(), classes: [clase('a', '5º A', 'primaria', 5)],
      students: [alumno('1', 'a', { alerts: [{ id: 'x', text: 'Gafas', level: 'info' }] }), alumno('2', 'a', { notes: 'Algo' }), alumno('3', 'a')],
    };
    expect(resumenDeCursoNuevo(d, plan(d, { a: 'sube' })).alumnado.conAvisos).toBe(2);
    expect(resumenDeCursoNuevo(d, plan(d, { a: 'sube' }, { conservarAvisos: false })).alumnado.conAvisos).toBe(0);
  });
  it('un alumno de un perfil antiguo, sin avisos ni notas en su ficha, no rompe la cuenta', () => {
    const antiguo = { id: '9', class_id: 'a', name: 'Alumno 9', email: '', photo: null } as unknown as Student;
    const d: DatosDelCurso = { ...vacio(), classes: [clase('a', '5º A', 'primaria', 5)], students: [antiguo, alumno('2', 'a', { notes: 'Algo' })] };
    expect(resumenDeCursoNuevo(d, plan(d, { a: 'sube' })).alumnado).toMatchObject({ sigue: 2, conAvisos: 1 });
  });
});

describe('el curso escolar', () => {
  it('el siguiente al del perfil, con su misma forma', () => {
    expect(cursoSiguiente('2026-2027')).toBe('2027-2028');
    expect(cursoSiguiente('2026/27')).toBe('2027/28');
    expect(cursoSiguiente(' 2026 - 2027 ')).toBe('2027 - 2028');
    expect(cursoSiguiente('2098/99')).toBe('2099/00');
  });
  it('si el perfil no lo dice, el que toca por la fecha', () => {
    expect(cursoSiguiente('', new Date(2027, 5, 25))).toBe('2027-2028');
    expect(cursoSiguiente('Curso de prueba', new Date(2027, 8, 3))).toBe('2027-2028');
    expect(cursoSiguiente('', new Date(2027, 1, 10))).toBe('2026-2027');
  });
  it('el archivo de la copia lleva el nombre del curso que acaba', () => {
    expect(archivoDelCurso('2026-2027', '2027-06-25')).toBe('aulapro-curso-2026-2027.json');
    expect(archivoDelCurso('2026/27', '2027-06-25')).toBe('aulapro-curso-2026-27.json');
    expect(archivoDelCurso('  ', '2027-06-25')).toBe('aulapro-curso-2027-06-25.json');
  });
});

describe('el resumen en líneas', () => {
  it('solo enseña lo que hay, y los avisos solo si se conservan', async () => {
    const { lineasDelResumen } = await import('./cursoNuevo');
    const d: DatosDelCurso = {
      ...vacio(), classes: [clase('a', '5º A', 'primaria', 5), clase('b', '5º B', 'primaria', 5)],
      students: [alumno('1', 'a', { notes: 'x' }), alumno('2', 'b')],
    };
    const p = plan(d, { a: 'sube', b: 'se-va' });
    const l = lineasDelResumen(resumenDeCursoNuevo(d, p), p);
    expect(l.conserva).toEqual([
      { texto: 'Clases que suben de curso', n: 1 },
      { texto: 'Alumnado que sigue contigo', n: 1 },
      { texto: 'Alumnado que sigue con avisos o notas en su ficha', n: 1 },
    ]);
    expect(l.borra).toEqual([{ texto: 'Clases que se van', n: 1 }, { texto: 'Alumnado que sale de tu perfil', n: 1 }]);
    const sin = { ...p, conservarAvisos: false };
    expect(lineasDelResumen(resumenDeCursoNuevo(d, sin), sin).conserva.map(x => x.texto)).not.toContain('Alumnado que sigue con avisos o notas en su ficha');
  });
  it('cada línea posible está en inglés y en catalán', async () => {
    const { lineasDelResumen } = await import('./cursoNuevo');
    const { EN_DICT } = await import('../i18n');
    const { CA } = await import('../i18n/ca');
    // Un resumen con un 1 en todo, para que salgan todas las líneas
    const unos = <T extends object>(o: T): T => Object.fromEntries(Object.keys(o).map(k => [k, 1])) as T;
    const r = resumenDeCursoNuevo(vacio(), planDePartida([]));
    const todo = { clases: unos(r.clases), alumnado: unos(r.alumnado), conserva: unos(r.conserva), borra: unos(r.borra), sinClase: unos(r.sinClase) };
    const l = lineasDelResumen(todo, { conservarAvisos: true });
    expect(l.conserva.length).toBeGreaterThan(15);
    expect(l.borra.length).toBeGreaterThan(15);
    for (const { texto } of [...l.conserva, ...l.borra]) {
      expect(EN_DICT[texto], texto).toBeTruthy();
      expect(CA[texto], texto).toBeTruthy();
    }
  });
});
