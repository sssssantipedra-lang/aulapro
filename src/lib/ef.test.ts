import { describe, it, expect } from 'vitest';
import {
  alumnadoParaIA, EF_VACIO, edadAproximada, efParaOtroCurso, exentosDelDia, normalizarEF, notaConBaremo, pruebasDe, sinAlumnoEF, sinClaseEF, asignaturaEF, PRUEBAS_DE_PARTIDA,
  hacerEquipos, parejasJuntas, fasesCircuito, duracionCircuito, PREPARADOS,
} from './ef';
import { buildDemoEF } from './demoEF';
import { tipoDePerfil } from './tipoDocente';
import { EF_MARK_TYPES, studentBlock, DEFAULT_BLOCK, targetLabel, esAsignaturaEF } from '../services/classMarks';
import type { ClassMark } from '../types';
import type { EfData } from '../types/ef';

describe('tipo de docente', () => {
  it('PT y AL por sus especialidades, EF por su tipo, y si no, de aula', () => {
    expect(tipoDePerfil({ especialidades: ['AL'] })).toBe('apoyo');
    expect(tipoDePerfil({ tipoDocente: 'ef' })).toBe('ef');
    expect(tipoDePerfil({ tipoDocente: 'raro' })).toBe('aula');
    expect(tipoDePerfil(null)).toBe('aula');
  });
});

describe('datos de EF', () => {
  it('lo guardado vuelve igual, y lo que no se entiende se descarta', () => {
    const demo = buildDemoEF(new Date(2026, 9, 5)).ef;
    expect(normalizarEF(JSON.parse(JSON.stringify(demo)))).toEqual(demo);
    expect(normalizarEF(undefined)).toEqual(EF_VACIO);
    const raro = normalizarEF({
      exentos: [{ id: 'x', alumnoId: 's', desde: 'ayer', limitaciones: [] }, { id: 'y', alumnoId: 's', desde: '2026-10-01', limitaciones: ['correr', 'volar'] }],
      niveles: { a: 2, b: 7 }, sexos: { a: 'F', b: 'X' }, marcas: [{ id: 'm', pruebaId: 'p', alumnoId: 'a', fecha: '2026-10-01', valor: 'mucho' }],
    });
    expect(raro.exentos.map(e => [e.id, e.limitaciones])).toEqual([['y', ['correr']]]);
    expect(raro.niveles).toEqual({ a: 2 });
    expect(raro.sexos).toEqual({ a: 'F' });
    expect(raro.marcas).toEqual([]);
  });

  it('exentos del día: desde su inicio y hasta su fin, o sin fin', () => {
    const d: EfData = { ...EF_VACIO, exentos: [
      { id: 'a', alumnoId: 's1', limitaciones: ['correr'], otra: '', desde: '2026-10-01', hasta: '2026-10-10', tarea: '', justificante: false, motivo: '' },
      { id: 'b', alumnoId: 's2', limitaciones: [], otra: 'Sin sol', desde: '2026-10-06', tarea: '', justificante: false, motivo: '' },
    ] };
    expect(exentosDelDia(d, '2026-10-05').map(e => e.id)).toEqual(['a']);
    expect(exentosDelDia(d, '2026-10-11').map(e => e.id)).toEqual(['b']);
  });

  it('al vaciar el curso quedan el material del docente y se va lo del alumnado', () => {
    const d = buildDemoEF(new Date(2026, 9, 5)).ef;
    const otro = efParaOtroCurso({ ...d, sesiones: [{ id: 's', titulo: 'X', claseId: 'c', fecha: '2026-10-05', objetivo: '', calentamiento: '', principal: '', calma: '', material: '', inclusion: '', planB: '' }] });
    expect(otro.exentos).toEqual([]);
    expect(otro.marcas).toEqual([]);
    expect(otro.niveles).toEqual({});
    expect(otro.material).toEqual(d.material);
    expect(otro.circuitos).toEqual(d.circuitos);
    expect(otro.sesiones[0].claseId).toBeUndefined();
  });

  it('borrar una clase quita lo de su alumnado y sus equipos, y deja sus sesiones sin clase', () => {
    const d = buildDemoEF(new Date(2026, 9, 5));
    const clase = d.classes[0].id;
    const alumnos = d.students.filter(s => s.class_id === clase).map(s => s.id);
    const ef: EfData = { ...d.ef, equipos: { [clase]: { fecha: '2026-10-05', grupos: [alumnos] } } };
    expect(ef.exentos.some(e => alumnos.includes(e.alumnoId))).toBe(true);
    expect(ef.sesiones.some(s => s.claseId === clase)).toBe(true);
    const sin = sinClaseEF(ef, clase, alumnos);
    expect(sin.exentos.some(e => alumnos.includes(e.alumnoId))).toBe(false);
    expect(sin.marcas.some(m => alumnos.includes(m.alumnoId))).toBe(false);
    expect(alumnos.some(id => id in sin.niveles || id in sin.sexos)).toBe(false);
    expect(sin.equipos[clase]).toBeUndefined();
    expect(sin.sesiones.some(s => s.claseId === clase)).toBe(false);
    expect(sin.sesiones).toHaveLength(ef.sesiones.length);
    // Lo de las otras clases no se toca
    expect(sin.exentos.length).toBe(ef.exentos.filter(e => !alumnos.includes(e.alumnoId)).length);
  });

  it('borrar un alumno lo quita de todo lo de EF', () => {
    const d = buildDemoEF(new Date(2026, 9, 5)).ef;
    const sin = sinAlumnoEF(d, 'ef-s01');
    expect(sin.niveles['ef-s01']).toBeUndefined();
    expect(sin.separar).toEqual([]);
    expect(sin.marcas.some(m => m.alumnoId === 'ef-s01')).toBe(false);
  });
});

describe('pruebas físicas', () => {
  it('las de partida, con las ocultas marcadas, y las del docente', () => {
    const d: EfData = { ...EF_VACIO, pruebas: [
      { id: 'cooper', nombre: '', categoria: 'resistencia', unidad: '', mejor: 'mas', descripcion: '', oculta: true },
      { id: 'p1', nombre: 'Abdominales en 30 s', categoria: 'fuerza', unidad: 'rep.', mejor: 'mas', descripcion: '', propia: true },
    ] };
    const ps = pruebasDe(d);
    expect(ps).toHaveLength(PRUEBAS_DE_PARTIDA.length + 1);
    expect(ps.find(p => p.id === 'cooper')?.oculta).toBe(true);
    expect(ps.find(p => p.id === 'cooper')?.nombre).toBe('Test de Cooper');
  });

  it('el baremo da la nota del tramo más alto alcanzado, en los dos sentidos', () => {
    const tramos = [{ marca: 140, nota: 5 }, { marca: 160, nota: 7 }, { marca: 180, nota: 10 }];
    expect(notaConBaremo({ tramos }, { mejor: 'mas' }, 165)).toBe(7);
    expect(notaConBaremo({ tramos }, { mejor: 'mas' }, 120)).toBe(5);
    const tiempos = [{ marca: 6, nota: 5 }, { marca: 5.5, nota: 8 }];
    expect(notaConBaremo({ tramos: tiempos }, { mejor: 'menos' }, 5.4)).toBe(8);
    expect(notaConBaremo({ tramos: [] }, { mejor: 'mas' }, 3)).toBeNull();
  });
});

describe('observación en la pista', () => {
  it('cuenta en el bloque con sus partes de EF', () => {
    const m = (type: ClassMark['type']): ClassMark => ({ id: type, class_id: 'c', student_id: 's', type, date: '2026-10-05' });
    const b = studentBlock([m('ef-ropa'), m('ef-esfuerzo'), m('participation'), m('behavior-good')], DEFAULT_BLOCK);
    expect(b.parts.homework.score).toBe(9.5);
    expect(b.parts.participation.score).toBe(6);
    expect(b.parts.behavior.score).toBe(10);
    expect(EF_MARK_TYPES.map(x => x.id)).toContain('ef-no-participa');
    expect(targetLabel('homework', 'Educación Física')).toBe('Vestimenta e higiene');
    expect(targetLabel('homework', 'Matemáticas')).toBe('Tareas');
  });

  it('reconoce la asignatura de EF por sus nombres habituales', () => {
    expect(['EF', 'Educació Física', 'educacion fisica', 'Physical Education'].every(esAsignaturaEF)).toBe(true);
    expect(esAsignaturaEF('Física y Química')).toBe(false);
    expect(asignaturaEF({ subject: 'Tutoría', subjects: ['Tutoría', 'Educación Física'] })).toBe('Educación Física');
  });

  it('niveles II y III: a la IA llegan el nivel y lo que necesita, junto a la limitación del día, sin nombres', () => {
    const d = buildDemoEF(new Date(2026, 9, 5));
    const ids = d.students.filter(s => s.class_id === 'ef-c1').map(s => s.id);
    const lineas = alumnadoParaIA(d.ef, ids, '2026-10-05');
    expect(lineas).toEqual([
      'No puede correr, No puede saltar',
      'Nivel III (respuesta diferenciada con apoyos ordinarios adicionales): necesita anticipar la sesión, con imágenes o antes de empezar; instrucciones cortas, de una en una; un compañero o compañera de referencia; pocos estímulos: menos ruido y un espacio acotado',
    ]);
    expect(lineas.join(' ')).not.toMatch(/Alumno|esguince/i);
    // Si el mismo alumno está lesionado y tiene nivel, va en una sola línea
    const ambos = { ...d.ef, apoyos: [{ id: 'a', alumnoId: 'ef-s03', nivel: 2 as const, necesidades: ['senales' as const], otra: 'le cuesta esperar su turno' }] };
    expect(alumnadoParaIA(ambos, ids, '2026-10-05')).toEqual([
      'No puede correr, No puede saltar · Nivel II (medidas generales del grupo-clase): necesita señales visuales, además del silbato; le cuesta esperar su turno',
    ]);
  });

  it('niveles II y III: se cargan con cuidado, uno por alumno, y se van con el alumno y con el curso', () => {
    const n = normalizarEF({ apoyos: [
      { id: 'a', alumnoId: 's1', nivel: 3, necesidades: ['anticipar', 'inventada'], otra: 'x' },
      { id: 'b', alumnoId: 's1', nivel: 2, necesidades: [], otra: '' },
      { id: 'c', alumnoId: 's2', nivel: 4, necesidades: [], otra: '' },
      { id: 'd', alumnoId: 's3', nivel: '3', necesidades: [], otra: '' },
    ] });
    expect(n.apoyos).toEqual([{ id: 'a', alumnoId: 's1', nivel: 3, necesidades: ['anticipar'], otra: 'x' }]);
    expect(normalizarEF({}).apoyos).toEqual([]);
    expect(sinAlumnoEF(n, 's1').apoyos).toEqual([]);
    expect(efParaOtroCurso(n).apoyos).toEqual([]);
  });

  it('la edad de cada curso, para adaptar una actividad', () => {
    expect(edadAproximada('primaria', 1)).toEqual({ desde: 6, hasta: 7 });
    expect(edadAproximada('primaria', 6)).toEqual({ desde: 11, hasta: 12 });
    expect(edadAproximada('eso', 1)).toEqual({ desde: 12, hasta: 13 });
    expect(edadAproximada('eso', 4)).toEqual({ desde: 15, hasta: 16 });
  });
});

/** Un azar repetible, para que las pruebas den siempre lo mismo. */
function azarFijo(semilla: number) {
  let x = semilla;
  return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; };
}

describe('equipos', () => {
  const ids = Array.from({ length: 22 }, (_, i) => `a${i}`);
  // Seis de nivel 3, ocho de nivel 2 y ocho de nivel 1; diez chicas y doce chicos
  const niveles = Object.fromEntries(ids.map((id, i) => [id, (i < 6 ? 3 : i < 14 ? 2 : 1) as 1 | 2 | 3]));
  const sexos = Object.fromEntries(ids.map((id, i) => [id, (i % 11 < 5 ? 'F' : 'M') as 'F' | 'M']));
  const separar = [{ a: 'a0', b: 'a1' }, { a: 'a2', b: 'a3' }, { a: 'a14', b: 'a15' }];

  it('reparte a todos, en equipos que se llevan como mucho uno', () => {
    for (let s = 1; s < 20; s++) {
      const eq = hacerEquipos(ids, 4, { niveles, sexos, separar }, { nivel: true, sexo: true, separar: true }, azarFijo(s));
      expect(eq).toHaveLength(4);
      expect(eq.flat().sort()).toEqual([...ids].sort());
      const tam = eq.map(g => g.length);
      expect(Math.max(...tam) - Math.min(...tam)).toBeLessThanOrEqual(1);
    }
  });

  it('iguala el nivel, mezcla chicos y chicas y separa las parejas', () => {
    for (let s = 1; s < 20; s++) {
      const eq = hacerEquipos(ids, 4, { niveles, sexos, separar }, { nivel: true, sexo: true, separar: true }, azarFijo(s));
      const medias = eq.map(g => g.reduce((t, id) => t + niveles[id], 0) / g.length);
      expect(Math.max(...medias) - Math.min(...medias)).toBeLessThan(0.5);
      const chicas = eq.map(g => g.filter(id => sexos[id] === 'F').length);
      expect(Math.max(...chicas) - Math.min(...chicas)).toBeLessThanOrEqual(1);
      expect(parejasJuntas(eq, separar)).toEqual([]);
    }
  });

  it('cada vez sale un reparto distinto, y con pocos alumnos no hay más equipos que alumnos', () => {
    const a = hacerEquipos(ids, 3, { niveles, sexos, separar: [] }, { nivel: true, sexo: false, separar: false }, azarFijo(1));
    const b = hacerEquipos(ids, 3, { niveles, sexos, separar: [] }, { nivel: true, sexo: false, separar: false }, azarFijo(2));
    expect(a).not.toEqual(b);
    expect(hacerEquipos(['x', 'y'], 5, { niveles: {}, sexos: {}, separar: [] }, { nivel: true, sexo: true, separar: true })).toHaveLength(2);
    expect(hacerEquipos([], 4, { niveles: {}, sexos: {}, separar: [] }, { nivel: true, sexo: true, separar: true })).toEqual([]);
  });

  it('los equipos guardados se quedan al cargar, y sin el alumno que se borra', () => {
    const d: EfData = { ...EF_VACIO, equipos: { c: { fecha: '2026-10-05', grupos: [['a', 'b'], ['c']] } } };
    expect(normalizarEF(JSON.parse(JSON.stringify(d))).equipos).toEqual(d.equipos);
    expect(sinAlumnoEF(d, 'b').equipos.c.grupos).toEqual([['a'], ['c']]);
    expect(efParaOtroCurso(d).equipos).toEqual({});
  });
});

describe('cronómetro de circuitos', () => {
  const c = { estaciones: ['Sentadillas', 'Plancha', 'Comba'], trabajo: 30, descanso: 15, rondas: 2, descansoRondas: 60 };

  it('preparados, cada estación con su descanso, el descanso largo entre rondas y sin descanso al final', () => {
    const f = fasesCircuito(c);
    expect(f[0]).toEqual({ tipo: 'preparados', segundos: PREPARADOS, estacion: 0, ronda: 1 });
    expect(f.slice(1, 7).map(x => `${x.tipo}:${x.estacion}`)).toEqual([
      'trabajo:0', 'descanso:1', 'trabajo:1', 'descanso:2', 'trabajo:2', 'descansoRondas:0',
    ]);
    expect(f.at(-1)).toMatchObject({ tipo: 'trabajo', estacion: 2, ronda: 2 });
    expect(f.filter(x => x.tipo === 'trabajo')).toHaveLength(6);
    // 6 × 30 de trabajo, 4 × 15 de descanso y 60 entre rondas
    expect(duracionCircuito(c)).toBe(180 + 60 + 60);
  });

  it('sin descansos, las fases de cero segundos no salen', () => {
    const f = fasesCircuito({ ...c, descanso: 0, descansoRondas: 0, rondas: 1 });
    expect(f.map(x => x.tipo)).toEqual(['preparados', 'trabajo', 'trabajo', 'trabajo']);
  });
});

describe('modalidades de juegos y deportes', () => {
  it('se guardan en actividades y sesiones, y una que no existe se descarta', () => {
    const d = normalizarEF({
      actividades: [
        { id: 'a', titulo: 'Rondo', tipo: 'deporte', modalidad: 'invasion' },
        { id: 'b', titulo: 'Esgrima', tipo: 'deporte', modalidad: 'esgrima' },
      ],
      sesiones: [{ id: 's', titulo: 'Voleibol', modalidad: 'red-pared' }],
    });
    expect(d.actividades.map(a => a.modalidad)).toEqual(['invasion', undefined]);
    expect(d.sesiones[0].modalidad).toBe('red-pared');
  });
});
