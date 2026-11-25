/**
 * El informe de seguimiento para las familias, por reglas y sin IA (20-11-2026): las frases para la familia,
 * los datos de cada evaluación y lo que se conserva al recalcular.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { AttendanceMap, Class, ClassMark, CompetencyReport, Evaluation, GradeCategory, GradeItem, GradeMap, Student } from '../types';
import { DEFAULT_BLOCK, type MarksInput } from '../services/classMarks';
import { translate, EN_DICT } from '../i18n';
import { CA } from '../i18n/ca';
import {
  asistenciaDelPeriodo, claseDelPeriodo, componerSeguimiento, cuentasDePeriodo, datosCambiados, fraseParaFamilia, FRASE_FAMILIA,
  MAX_DE_COMPETENCIAS, MAX_FRASES, notasDelPeriodo, origenDelTexto, periodoAnterior, quitarFrase, recalcular, reglaDe, seguimientoLimpio, tablaPorReglas,
  textosParaTraducir, tieneContenido,
} from './informeSeguimiento';
import type { DatoResumen } from './resumenAlumno';

const es = (k: string, v?: Record<string, string | number>) => translate('es', k, v);
const en = (k: string, v?: Record<string, string | number>) => translate('en', k, v);
const ca = (k: string, v?: Record<string, string | number>) => translate('ca', k, v);

const HOY = '2027-02-10';
const P1 = '1ª evaluación', P2 = '2ª evaluación', P3 = '3ª evaluación', CURSO = 'Final de curso';
const cls: Class = { id: 'c1', name: '5.º A', subject: 'Lengua', subjects: ['Lengua', 'Plástica'] } as Class;
const alumno = (id: string): Student => ({ id, name: `Alumno ${id}`, class_id: 'c1', email: '', photo: null, alerts: [], notes: '' } as Student);
const cat = (id: string, weight: number, subject?: string): GradeCategory => ({ id, class_id: 'c1', name: id, weight, ...(subject ? { subject } : {}) });
const item = (id: string, category_id: string, date: string): GradeItem => ({ id, class_id: 'c1', category_id, name: `Actividad ${id}`, date });
const marca = (id: string, student_id: string, type: ClassMark['type'], date: string): ClassMark => ({ id, class_id: 'c1', student_id, type, date });
const evaluacion = (id: string, student_id: string, date: string, competencyScores: Record<string, number>, max_level?: number): Evaluation => ({
  id, rubric_id: 'r1', rubric_name: 'Exposición', student_id, student_name: `Alumno ${student_id}`, class_id: 'c1', date, scores: {}, notes: '',
  competencyScores, ...(max_level ? { max_level } : {}),
});

/** Lengua: pruebas 60 y tareas 40; Plástica, una categoría. El bloque de anotaciones, apagado salvo que se diga. */
function cuaderno(extra: Partial<MarksInput> = {}): MarksInput {
  const gradeItems = [
    item('ex1', 'pruebas', '2026-10-20'), item('ta1', 'tareas', '2026-11-05'),
    item('ex2', 'pruebas', '2027-02-03'), item('ta2', 'tareas', '2027-01-20'),
    item('lam', 'plastica', '2026-10-01'),
  ];
  const grades: GradeMap = {
    ex1: { a: 4, b: 8, c: 6, d: 6 }, ta1: { a: 6, b: 8, c: 6, d: 6 },
    ex2: { a: 8, b: 6, c: 6, d: 6 }, ta2: { a: 9, b: null, c: 6, d: 6 },
    lam: { a: 7, b: 7 },
  };
  const apagado = { ...DEFAULT_BLOCK, enabled: false };
  return {
    classes: [cls], students: ['a', 'b', 'c', 'd'].map(alumno),
    gradeCategories: [cat('pruebas', 60), cat('tareas', 40), cat('plastica', 100, 'Plástica')],
    gradeItems, grades, classMarks: [], marksConfigs: { 'c1|Lengua': apagado, 'c1|Plástica': apagado },
    ...extra,
  };
}

const componer = (d: MarksInput, periodo: string, id = 'a', extra: { attendance?: AttendanceMap; evaluations?: Evaluation[]; t?: typeof es; locale?: string } = {}) =>
  componerSeguimiento({
    clase: claseDelPeriodo(d, cls, periodo, HOY, {}), student: alumno(id),
    attendance: extra.attendance ?? {}, evaluations: extra.evaluations ?? [], t: extra.t ?? es, locale: extra.locale ?? 'es-ES',
  });

describe('las frases para la familia', () => {
  it('cada regla de «Lo más relevante» tiene su frase, o se ha decidido que no se le dice a la familia', () => {
    const fuente = fs.readFileSync(path.resolve(__dirname, 'resumenAlumno.ts'), 'utf8');
    const reglas = [...fuente.matchAll(/clave: '([^']+)'/g)].map(m => m[1]);
    expect(reglas.length).toBeGreaterThan(15);
    expect(reglas.filter(k => !(k in FRASE_FAMILIA))).toEqual([]);
  });

  it('las reglas que comparan con el resto de la clase no tienen frase', () => {
    const comparan = Object.keys(FRASE_FAMILIA).filter(k => /media de la clase/.test(k));
    expect(comparan).toHaveLength(2);
    for (const k of comparan) expect(FRASE_FAMILIA[k]).toBeNull();
    for (const texto of textosParaTraducir()) expect(texto).not.toMatch(/de la clase|compañer|resto del grupo/i);
  });

  it('todas están en inglés y en catalán, con las mismas variables, sin rayas largas y sin «profes»', () => {
    const vars = (s: string) => (s.match(/\{[a-z_]+\}/gi) ?? []).sort().join(',');
    const textos = textosParaTraducir();
    expect(textos.filter(k => !(k in EN_DICT) || !(k in CA))).toEqual([]);
    expect(textos.filter(k => vars(EN_DICT[k]) !== vars(k) || vars(CA[k]) !== vars(k))).toEqual([]);
    for (const k of textos) for (const x of [k, EN_DICT[k], CA[k]]) expect(x).not.toMatch(/—|profes\b/i);
  });

  it('la nota se escribe con la coma o el punto del idioma', () => {
    const d: DatoResumen = { tipo: 'notas', clave: 'Media de {nota} en {asignatura}', vars: { nota: 8.2, asignatura: 'Lengua' }, peso: 70 };
    expect(fraseParaFamilia(d, es, 'es-ES')).toBe('En Lengua su nota es de 8,2 sobre 10, un buen resultado.');
    expect(fraseParaFamilia(d, en, 'en-GB')).toBe('Grade in Lengua: 8.2 out of 10, a good result.');
    expect(fraseParaFamilia(d, ca, 'ca-ES')).toBe('En Lengua la seva nota és de 8,2 sobre 10, un bon resultat.');
  });

  it('un punto es «1 punto» y varios, «puntos»', () => {
    const sube = (d: number): DatoResumen => ({ tipo: 'notas', clave: 'Ha subido {d} puntos en {asignatura} respecto al periodo anterior', vars: { d, asignatura: 'Lengua' }, peso: 77 });
    expect(fraseParaFamilia(sube(1), es, 'es-ES')).toBe('Su nota en Lengua ha subido 1 punto respecto a la evaluación anterior.');
    expect(fraseParaFamilia(sube(1.5), es, 'es-ES')).toBe('Su nota en Lengua ha subido 1,5 puntos respecto a la evaluación anterior.');
  });

  it('una competencia se dice con palabras corrientes, sin siglas ni niveles', () => {
    const d: DatoResumen = { tipo: 'competencias', clave: 'Tiene que mejorar la competencia {competencia} (nivel {nivel} de 4)', vars: { competencia: 'Comunicación lingüística', nivel: 2 }, traducir: ['competencia'], peso: 70 };
    expect(fraseParaFamilia(d, es, 'es-ES')).toBe('Necesita reforzar la comunicación, de palabra y por escrito.');
    expect(fraseParaFamilia(d, ca, 'ca-ES')).toBe('Necessita reforçar la comunicació, de paraula i per escrit.');
    expect(fraseParaFamilia({ ...d, vars: { competencia: 'Una que no existe', nivel: 2 } }, es, 'es-ES')).toBeNull();
  });

  it('las anotaciones se cuentan sin las etiquetas rápidas del docente', () => {
    const d: DatoResumen = {
      tipo: 'actitud', clave: '{n} anotaciones negativas', vars: { n: 3 }, peso: 78,
      detalle: [{ etiqueta: 'Sin tarea', n: 2 }, { etiqueta: 'Mal comportamiento', n: 1 }],
    };
    expect(fraseParaFamilia(d, es, 'es-ES')).toBe('En clase se han recogido 3 anotaciones sobre aspectos que debe mejorar: tarea sin hacer (2 veces), comportamiento que debe mejorar.');
    expect(fraseParaFamilia(d, en, 'en-GB')).toBe('3 notes on things to improve were recorded in class: homework not done (2 times), behaviour that needs to improve.');
    // Sin el desglose no se deja «{detalle}» a la vista
    expect(fraseParaFamilia({ ...d, detalle: [] }, es, 'es-ES')).toBeNull();
  });

  it('una regla que no tiene frase no sale', () => {
    expect(fraseParaFamilia({ tipo: 'notas', clave: 'Una regla nueva sin frase', peso: 99 }, es, 'es-ES')).toBeNull();
    expect(fraseParaFamilia({ tipo: 'notas', clave: '{d} puntos por debajo de la media de la clase en {asignatura}', vars: { d: 2, asignatura: 'Lengua' }, peso: 80 }, es, 'es-ES')).toBeNull();
  });
});

describe('qué cuenta en cada evaluación', () => {
  it('la anterior a la 2.ª es la 1.ª; la 1.ª y «Final de curso» no tienen anterior', () => {
    expect(periodoAnterior(P2)).toBe(P1);
    expect(periodoAnterior(P3)).toBe(P2);
    expect(periodoAnterior(P1)).toBeNull();
    expect(periodoAnterior(CURSO)).toBeNull();
  });

  it('las fechas son las del cuaderno y el acta, también las que el docente cambió', () => {
    const c = cuentasDePeriodo(P2, HOY, {});
    expect(c.actual('2027-02-03')).toBe(true);
    expect(c.actual('2026-11-05')).toBe(false);
    expect(c.anterior?.('2026-11-05')).toBe(true);
    // Lo que no tiene fecha cuenta en todas, así que no sirve para comparar
    expect(c.actual(undefined)).toBe(true);
    expect(c.anterior?.(undefined)).toBe(false);
    const movidas = cuentasDePeriodo(P1, HOY, { [P1]: { desde: '2026-09-01', hasta: '2026-11-30' }, [P2]: { desde: '2026-12-01', hasta: '2027-03-31' } });
    expect(movidas.actual('2026-12-10')).toBe(false);
  });

  it('las notas de una evaluación son las del cuaderno de esa evaluación, asignatura por asignatura', () => {
    const d = cuaderno();
    const primera = notasDelPeriodo(claseDelPeriodo(d, cls, P1, HOY, {}), 'a');
    expect(primera.map(n => [n.asignatura, n.media])).toEqual([['Lengua', 4.8], ['Plástica', 7]]);
    expect(primera[0].categorias).toEqual([{ nombre: 'pruebas', peso: 60, media: 4 }, { nombre: 'tareas', peso: 40, media: 6 }]);
    const segunda = notasDelPeriodo(claseDelPeriodo(d, cls, P2, HOY, {}), 'a');
    // 8 × 0,6 + 9 × 0,4; en Plástica no hay nada en la 2.ª y no sale
    expect(segunda.map(n => [n.asignatura, n.media])).toEqual([['Lengua', 8.4]]);
    expect(segunda[0].evaluaciones).toBeUndefined();
  });

  it('con el bloque de anotaciones, la nota lo lleva y la categoría se llama como en el cuaderno', () => {
    const d = cuaderno({
      marksConfigs: { 'c1|Lengua': { ...DEFAULT_BLOCK, enabled: true, points: 2 }, 'c1|Plástica': { ...DEFAULT_BLOCK, enabled: false } },
      classMarks: [marca('m1', 'a', 'sin_tarea' as ClassMark['type'], '2026-10-10')],
    });
    const [lengua] = notasDelPeriodo(claseDelPeriodo(d, cls, P1, HOY, {}), 'a', es);
    const bloque = lengua.categorias.find(c => c.bloque);
    expect(bloque?.nombre).toBe('Trabajo diario y actitud');
    expect(bloque?.peso).toBe(20);
    expect(lengua.categorias.reduce((n, c) => n + c.peso, 0)).toBe(100);
  });

  it('quien solo tiene el bloque de anotaciones no tiene tabla de notas', () => {
    const d = cuaderno({
      marksConfigs: { 'c1|Lengua': { ...DEFAULT_BLOCK, enabled: true, points: 2 }, 'c1|Plástica': { ...DEFAULT_BLOCK, enabled: false } },
      grades: { ex1: { b: 8 }, ta1: { b: 8 } },
    });
    expect(notasDelPeriodo(claseDelPeriodo(d, cls, P1, HOY, {}), 'a')).toEqual([]);
  });

  it('en «Final de curso» va la nota de cada evaluación y la final con la regla del cuaderno', () => {
    const media = { ...DEFAULT_BLOCK, enabled: false, final: { modo: 'media' as const, pesos: [1, 1, 1] } };
    const continua = notasDelPeriodo(claseDelPeriodo(cuaderno(), cls, CURSO, HOY, {}), 'a')[0];
    // Evaluación continua: todas las notas juntas (pruebas 6, tareas 7,5)
    expect(continua.evaluaciones).toEqual([4.8, 8.4, null]);
    expect(continua.media).toBe(6.6);
    const deMedias = notasDelPeriodo(claseDelPeriodo(cuaderno({ marksConfigs: { 'c1|Lengua': media, 'c1|Plástica': media } }), cls, CURSO, HOY, {}), 'a')[0];
    expect(deMedias.media).toBe(6.6);
    const pesada = { ...media, final: { modo: 'media' as const, pesos: [1, 3, 0] } };
    const conPesos = notasDelPeriodo(claseDelPeriodo(cuaderno({ marksConfigs: { 'c1|Lengua': pesada, 'c1|Plástica': pesada } }), cls, CURSO, HOY, {}), 'a')[0];
    expect(conPesos.media).toBe(7.5);
  });

  it('la asistencia es la de las fechas de la evaluación', () => {
    const attendance: AttendanceMap = { c1: {
      '2026-10-01': { a: 'present' }, '2026-10-02': { a: 'absent' }, '2026-10-05': { a: 'late' }, '2026-10-06': { a: 'justified' },
      '2027-01-15': { a: 'absent' }, '2027-01-18': { b: 'absent' },
    } };
    const { actual } = cuentasDePeriodo(P1, HOY, {});
    expect(asistenciaDelPeriodo(attendance, 'c1', 'a', f => actual(f))).toEqual({ dias: 4, faltas: 1, justificadas: 1, retrasos: 1 });
    expect(asistenciaDelPeriodo(attendance, 'c1', 'a', f => cuentasDePeriodo(P2, HOY, {}).actual(f))).toEqual({ dias: 1, faltas: 1, justificadas: 0, retrasos: 0 });
    expect(asistenciaDelPeriodo(attendance, 'c1', 'a', f => cuentasDePeriodo(P3, HOY, {}).actual(f))).toBeNull();
  });

  it('la tabla de competencias la fija el código, en el orden oficial y con cualquier escala pasada a 4', () => {
    const tabla = tablaPorReglas([
      evaluacion('e1', 'a', '2026-10-01', { STEM: 3.8, CCL: 2 }),
      evaluacion('e2', 'a', '2026-10-08', { CD: 3 }, 3),
    ]);
    expect(tabla).toEqual([
      { clave: 'CCL', valoracion: 'mejorable', comentario: '' },
      { clave: 'STEM', valoracion: 'excelente', comentario: '' },
      { clave: 'CD', valoracion: 'excelente', comentario: '' },
    ]);
  });
});

describe('el informe compuesto', () => {
  it('reúne las notas, la asistencia, las competencias y las frases de la evaluación, con su porqué', () => {
    const r = componer(cuaderno(), P2, 'a', {
      attendance: { c1: { '2027-01-15': { a: 'present' }, '2027-01-18': { a: 'present' }, '2026-10-02': { a: 'absent' } } },
      evaluations: [evaluacion('e1', 'a', '2027-01-20', { CCL: 3.8 }), evaluacion('e0', 'a', '2026-10-20', { CCL: 1 })],
    });
    expect(r.hayDatos).toBe(true);
    expect(r.seguimiento.desde).toBe('2027-01-01');
    expect(r.seguimiento.hasta).toBe('2027-03-31');
    expect(r.seguimiento.asistencia).toEqual({ dias: 2, faltas: 0, justificadas: 0, retrasos: 0 });
    // La evaluación de octubre no cuenta en la 2.ª: sin ella, CCL es excelente
    expect(r.tabla).toEqual([{ clave: 'CCL', valoracion: 'excelente', comentario: '' }]);
    const positivos = r.seguimiento.positivos.map(f => f.texto);
    expect(positivos).toContain('En Lengua su nota es de 8,4 sobre 10, un buen resultado.');
    expect(positivos).toContain('Su nota en Lengua ha subido 3,6 puntos respecto a la evaluación anterior.');
    expect(positivos).toContain('Destaca en la comunicación, de palabra y por escrito.');
    expect(r.seguimiento.mejorar).toEqual([]);
    // El docente ve de qué dato sale cada frase
    expect(r.seguimiento.positivos.find(f => f.texto.startsWith('En Lengua'))?.origen).toBe('Notas: Media de 8,4 en Lengua');
    expect(r.seguimiento.positivos.every(f => !!f.origen)).toBe(true);
    expect(r.seguimiento.observacion).toBe('');
  });

  it('la frase de la nota dice la misma nota que la tabla, con el bloque de anotaciones', () => {
    // Sin el bloque la media de pruebas y tareas es 4,8 (por debajo de 5); con él (20 % y sin anotaciones que resten) pasa de 5
    const d = cuaderno({ marksConfigs: { 'c1|Lengua': { ...DEFAULT_BLOCK, enabled: true, points: 2 }, 'c1|Plástica': { ...DEFAULT_BLOCK, enabled: false } } });
    const r = componer(d, P1);
    const lengua = r.seguimiento.notas.find(n => n.asignatura === 'Lengua');
    expect(lengua?.media).toBeGreaterThanOrEqual(5);
    expect(r.seguimiento.mejorar.map(f => f.texto).filter(x => /todavía no llega al 5/.test(x))).toEqual([]);
    // Y sin el bloque, la frase lleva el 4,8 de la tabla
    const sin = componer(cuaderno(), P1);
    expect(sin.seguimiento.notas[0].media).toBe(4.8);
    expect(sin.seguimiento.mejorar.map(f => f.texto)).toContain('En Lengua su nota es de 4,8 sobre 10: todavía no llega al 5 y conviene reforzar la materia.');
  });

  it('no compara con el resto de la clase', () => {
    // «b» va dos puntos por encima de la clase en la 1.ª, pero eso no se le dice a la familia
    const r = componer(cuaderno(), P1, 'b');
    const todo = [...r.seguimiento.positivos, ...r.seguimiento.mejorar].map(f => `${f.texto} ${f.origen}`).join(' ');
    expect(todo).not.toMatch(/media de la clase|class average/i);
  });

  it('como mucho cinco frases a cada lado, y de ellas dos de competencias', () => {
    const r = componer(cuaderno(), P1, 'a', {
      evaluations: [evaluacion('e1', 'a', '2026-10-20', { CCL: 1, CP: 1.2, STEM: 1.4, CD: 1.6, CPSAA: 1.8, CC: 2, CE: 2.2 })],
      attendance: { c1: { '2026-10-02': { a: 'absent' }, '2026-10-05': { a: 'absent' }, '2026-10-06': { a: 'late' }, '2026-10-07': { a: 'late' } } },
    });
    expect(r.seguimiento.mejorar.length).toBeLessThanOrEqual(MAX_FRASES);
    expect(r.seguimiento.mejorar.filter(f => f.origen?.startsWith('Competencias')).length).toBe(MAX_DE_COMPETENCIAS);
    // La tabla sí las lleva todas
    expect(r.tabla).toHaveLength(7);
  });

  it('sin nada en la evaluación dice que no hay datos', () => {
    const r = componer(cuaderno(), P3);
    expect(r.hayDatos).toBe(false);
    expect(r.seguimiento.notas).toEqual([]);
    expect(r.seguimiento.asistencia).toBeNull();
    expect(tieneContenido({ seguimiento: r.seguimiento, tabla: r.tabla, text: '' })).toBe(false);
  });

  it('sale en el idioma de la app', () => {
    const r = componer(cuaderno(), P2, 'a', { t: ca, locale: 'ca-ES' });
    expect(r.seguimiento.positivos.map(f => f.texto)).toContain('En Lengua la seva nota és de 8,4 sobre 10, un bon resultat.');
  });
});

describe('guardar, recalcular y saber si está al día', () => {
  const guardado = (): Pick<CompetencyReport, 'seguimiento' | 'tabla'> => {
    const c = componer(cuaderno(), P2, 'a', { evaluations: [evaluacion('e1', 'a', '2027-01-20', { CCL: 3.8 })] });
    return {
      seguimiento: {
        ...c.seguimiento,
        positivos: [...c.seguimiento.positivos, { texto: 'Ayuda a quien lo necesita.' }],
        observacion: 'Me gustaría veros en enero.', ocultar: ['asistencia'],
      },
      tabla: c.tabla.map(f => ({ ...f, comentario: 'Expone con soltura.' })),
    };
  };

  it('al recalcular se conserva lo que escribió el docente y se cambian las frases que salían de un dato', () => {
    const antes = guardado();
    const d = cuaderno();
    d.grades.ex2 = { ...d.grades.ex2, a: 2 };
    const ahora = componer(d, P2, 'a', { evaluations: [evaluacion('e1', 'a', '2027-01-20', { CCL: 3.8 }), evaluacion('e2', 'a', '2027-02-01', { STEM: 2 })] });
    const r = recalcular(antes, ahora);
    expect(r.seguimiento.observacion).toBe('Me gustaría veros en enero.');
    expect(r.seguimiento.ocultar).toEqual(['asistencia']);
    expect(r.seguimiento.positivos.map(f => f.texto)).toContain('Ayuda a quien lo necesita.');
    expect(r.seguimiento.positivos.map(f => f.texto)).not.toContain('En Lengua su nota es de 8,4 sobre 10, un buen resultado.');
    expect(r.seguimiento.notas[0].media).toBe(4.8);
    expect(r.tabla).toEqual([
      { clave: 'CCL', valoracion: 'excelente', comentario: 'Expone con soltura.' },
      { clave: 'STEM', valoracion: 'mejorable', comentario: '' },
    ]);
  });

  it('al recalcular, una frase que el docente redactó a su manera se queda si su dato no ha cambiado', () => {
    const c = componer(cuaderno(), P2, 'a', { evaluations: [evaluacion('e1', 'a', '2027-01-20', { CCL: 3.8 })] });
    const deLaNota = c.seguimiento.positivos.find(f => f.origen?.includes('Media de'));
    const deLaCompetencia = c.seguimiento.positivos.find(f => f.origen?.includes('CCL') || f.origen?.includes('lingüística'));
    expect(deLaNota && deLaCompetencia).toBeTruthy();
    const antes: Pick<CompetencyReport, 'seguimiento' | 'tabla'> = {
      seguimiento: { ...c.seguimiento, positivos: c.seguimiento.positivos.map(f => (f === deLaNota ? { ...f, texto: 'Va muy bien en Lengua.' } : f === deLaCompetencia ? { ...f, texto: 'Se explica de maravilla.' } : f)) },
      tabla: c.tabla,
    };
    // Cambia la nota (otra media, otro dato) y no la competencia
    const d = cuaderno();
    d.grades.ex2 = { ...d.grades.ex2, a: 9.5 };
    const r = recalcular(antes, componer(d, P2, 'a', { evaluations: [evaluacion('e1', 'a', '2027-01-20', { CCL: 3.8 })] }));
    const textos = r.seguimiento.positivos.map(f => f.texto);
    expect(textos).toContain('Se explica de maravilla.');
    expect(textos).not.toContain('Va muy bien en Lengua.');
    expect(textos.some(x => x.startsWith('En Lengua su nota es de'))).toBe(true);
    // Y no se duplica: cada dato, una frase
    expect(new Set(r.seguimiento.positivos.map(f => f.origen)).size).toBe(r.seguimiento.positivos.length);
  });

  it('una frase que el docente quitó no vuelve al actualizar, aunque cambien sus números', () => {
    const evs = [evaluacion('e1', 'a', '2027-01-20', { CCL: 3.8 })];
    const c = componer(cuaderno(), P2, 'a', { evaluations: evs });
    const i = c.seguimiento.positivos.findIndex(f => f.origen?.includes('Media de'));
    expect(i).toBeGreaterThanOrEqual(0);
    const regla = c.seguimiento.positivos[i].regla;
    expect(regla).toBe('Media de {nota} en {asignatura}|Lengua');
    const sinElla = quitarFrase(c.seguimiento, 'positivos', i);
    expect(sinElla.quitadas).toEqual([regla]);
    // Se guarda y, después, la nota de Lengua cambia: la frase sería otra (otro texto, otro origen), pero es la misma regla
    const antes = { seguimiento: seguimientoLimpio(sinElla), tabla: c.tabla };
    const d = cuaderno();
    d.grades.ex2 = { ...d.grades.ex2, a: 9.5 };
    const r = recalcular(antes, componer(d, P2, 'a', { evaluations: evs }));
    expect(r.seguimiento.positivos.some(f => f.texto.startsWith('En Lengua su nota es de'))).toBe(false);
    expect(r.seguimiento.positivos.some(f => f.regla?.startsWith('Destaca en'))).toBe(true);
    expect(r.seguimiento.quitadas).toEqual([regla]);
    // Y lo sigue recordando en la siguiente actualización
    expect(recalcular(r, componer(d, P2, 'a', { evaluations: evs })).seguimiento.quitadas).toEqual([regla]);
    // Otra regla de la misma asignatura sí sale: quitar «buen resultado» no calla que no llega al 5
    const mal = cuaderno();
    mal.grades.ex2 = { ...mal.grades.ex2, a: 2 };
    expect(recalcular(antes, componer(mal, P2, 'a', { evaluations: evs })).seguimiento.mejorar.some(f => f.texto.includes('todavía no llega al 5'))).toBe(true);
  });

  it('la regla de una frase no lleva los números ni la actividad, y lo singular y lo plural son la misma', () => {
    expect(reglaDe({ clave: '1 falta sin justificar' })).toBe(reglaDe({ clave: '{n} faltas sin justificar', vars: { n: 4 } }));
    expect(reglaDe({ clave: '1 anotación negativa' })).toBe(reglaDe({ clave: '{n} anotaciones negativas', vars: { n: 3 } }));
    expect(reglaDe({ clave: 'Mejor nota: {nota} en «{actividad}»', vars: { nota: 9, actividad: 'Examen 1' } }))
      .toBe(reglaDe({ clave: 'Mejor nota: {nota} en «{actividad}»', vars: { nota: 8.5, actividad: 'Examen 2' } }));
    expect(reglaDe({ clave: 'Media de {nota} en {asignatura}', vars: { nota: 8, asignatura: 'Lengua' } }))
      .not.toBe(reglaDe({ clave: 'Media de {nota} en {asignatura}', vars: { nota: 8, asignatura: 'Plástica' } }));
    expect(reglaDe({ clave: '{n} faltas sin justificar' })).not.toBe(reglaDe({ clave: '{n} retrasos' }));
  });

  it('quitar una frase escrita a mano no apunta nada; quitar dos veces la misma regla, una sola vez', () => {
    const s = { notas: [], asistencia: null, observacion: '', mejorar: [], positivos: [{ texto: 'Mía.' }, { texto: 'A', regla: 'r' }, { texto: 'B', regla: 'r' }] };
    expect('quitadas' in quitarFrase(s, 'positivos', 0)).toBe(false);
    expect(quitarFrase(quitarFrase(s, 'positivos', 1), 'positivos', 1).quitadas).toEqual(['r']);
    expect(quitarFrase(s, 'positivos', 9)).toBe(s);
  });

  it('un informe guardado antes de recordar las frases quitadas se sigue leyendo y actualizando igual', () => {
    // Como se guardaban antes del 25-11-2026: frases con su origen, sin `regla`, y sin `quitadas`
    const c = componer(cuaderno(), P2, 'a', { evaluations: [evaluacion('e1', 'a', '2027-01-20', { CCL: 3.8 })] });
    const viejo: Pick<CompetencyReport, 'seguimiento' | 'tabla'> = {
      seguimiento: { ...c.seguimiento, positivos: c.seguimiento.positivos.map(({ regla: _r, ...f }) => { void _r; return { ...f }; }), mejorar: [] },
      tabla: c.tabla,
    };
    expect(viejo.seguimiento?.positivos.every(f => !('regla' in f))).toBe(true);
    const r = recalcular(viejo, c);
    expect(r.seguimiento.positivos.map(f => f.texto)).toEqual(c.seguimiento.positivos.map(f => f.texto));
    expect('quitadas' in r.seguimiento).toBe(false);
    expect(datosCambiados(viejo, c)).toBe(false);
    expect('quitadas' in seguimientoLimpio(viejo.seguimiento!)).toBe(false);
  });

  it('sabe si los datos han cambiado desde que se guardó', () => {
    const antes = guardado();
    const igual = componer(cuaderno(), P2, 'a', { evaluations: [evaluacion('e1', 'a', '2027-01-20', { CCL: 3.8 })] });
    expect(datosCambiados(antes, igual)).toBe(false);
    const d = cuaderno();
    d.grades.ex2 = { ...d.grades.ex2, a: 7 };
    expect(datosCambiados(antes, componer(d, P2, 'a', { evaluations: [evaluacion('e1', 'a', '2027-01-20', { CCL: 3.8 })] }))).toBe(true);
    expect(datosCambiados(antes, componer(cuaderno(), P2, 'a', { evaluations: [evaluacion('e1', 'a', '2027-01-20', { CCL: 2 })] }))).toBe(true);
    expect(datosCambiados(antes, componer(cuaderno(), P2, 'a', {
      evaluations: [evaluacion('e1', 'a', '2027-01-20', { CCL: 3.8 })], attendance: { c1: { '2027-01-15': { a: 'absent' } } },
    }))).toBe(true);
    // Un informe sin hoja de seguimiento (el de la IA, el escrito a mano) no tiene datos que caduquen
    expect(datosCambiados({ tabla: [] }, igual)).toBe(false);
  });

  it('al guardar se quitan las frases vacías y se recorta lo escrito', () => {
    const s = seguimientoLimpio({
      notas: [], asistencia: null,
      positivos: [{ texto: '  Trabaja   bien.  ' }, { texto: '   ' }], mejorar: [{ texto: '' }],
      observacion: '  Hablamos en enero.\n', ocultar: ['notas', 'notas'], quitadas: ['r1', 'r1', 'r2'],
    });
    expect(s.quitadas).toEqual(['r1', 'r2']);
    expect(s.positivos).toEqual([{ texto: 'Trabaja bien.' }]);
    expect(s.mejorar).toEqual([]);
    expect(s.observacion).toBe('Hablamos en enero.');
    expect(s.ocultar).toEqual(['notas']);
    expect('ocultar' in seguimientoLimpio({ notas: [], asistencia: null, positivos: [], mejorar: [], observacion: '', ocultar: [] })).toBe(false);
  });

  it('una hoja con todo quitado y sin texto no tiene nada que entregar', () => {
    const c = componer(cuaderno(), P2);
    expect(tieneContenido({ seguimiento: { ...c.seguimiento, positivos: [], mejorar: [], ocultar: ['notas', 'asistencia', 'competencias'] }, tabla: c.tabla, text: '' })).toBe(false);
    expect(tieneContenido({ seguimiento: { ...c.seguimiento, positivos: [], mejorar: [], ocultar: ['notas', 'asistencia', 'competencias'], observacion: 'Va bien.' }, tabla: [], text: '' })).toBe(true);
    expect(tieneContenido({ text: 'Un informe a mano.' })).toBe(true);
  });

  it('quién firma el texto: nadie si está vacío, la IA si lo redactó ella y el docente en lo demás', () => {
    expect(origenDelTexto('')).toBe('reglas');
    expect(origenDelTexto('   ', { text: 'Lo que había', origen: 'ia' })).toBe('reglas');
    expect(origenDelTexto('Texto nuevo')).toBe('mano');
    expect(origenDelTexto('Texto nuevo', { text: '', origen: 'reglas' })).toBe('mano');
    expect(origenDelTexto('Texto de la IA, corregido', { text: 'Texto de la IA', origen: 'ia' })).toBe('ia');
    // Los informes de antes no dicen quién los redactó: fue la IA
    expect(origenDelTexto('Texto corregido', { text: 'Texto de antes' })).toBe('ia');
    expect(origenDelTexto('Otro texto', { text: 'Texto mío', origen: 'mano' })).toBe('mano');
  });
});
