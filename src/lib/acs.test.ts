import { describe, it, expect } from 'vitest';
import {
  ESTRATEGIAS_ACS, GRADOS_ACS, INSTRUMENTOS_INICIALES, alternarCompetencia, alternarCriterio, alternarSaber, avisosAcs,
  conFila, desfaseCursos, filasSeguimiento, nuevaAcs, progresoTrimestre, seleccionValida,
} from './acs';
import { APOYO_VACIO, normalizarApoyo, sinAlumno } from './apoyo';
import { translate } from '../i18n';
import type { CurriculumEntry } from './curriculum';
import type { AlumnoApoyo } from '../types/apoyo';

const entry = {
  id: 'matematicas', nombre: 'Matemáticas',
  competencias: [{ n: 1, texto: 'Resolver problemas' }, { n: 2, texto: 'Razonar' }],
  criterios: { '3º Primaria': [
    { codigo: '1.1', competencia: 1, texto: 'Comprender problemas', codigoLiteral: true },
    { codigo: '1.2', competencia: 1, texto: 'Elegir estrategias', codigoLiteral: true },
    { codigo: '2.1', competencia: 2, texto: 'Explicar el proceso', codigoLiteral: true },
  ] },
  saberes: { '2': [{ bloque: 'A', tituloBloque: 'Sentido numérico', epigrafes: [] }, { bloque: 'B', tituloBloque: 'Sentido de la medida', epigrafes: [] }] },
} as unknown as CurriculumEntry;
// En Primaria andaluza los criterios van por curso y los saberes por ciclo: aquí, un solo grupo para los dos
entry.saberes['3º Primaria'] = entry.saberes['2'];
const G = '3º Primaria';

const alumno: AlumnoApoyo = {
  id: 'a1', nombre: 'Alumno 1', claseOrigen: '5º A', matricula: { etapa: 'primaria', curso: 5 }, nivel: { etapa: 'primaria', curso: 3 },
  categorias: ['Discapacidad intelectual'], diagnostico: '', necesidades: '', notas: '',
};
let n = 0;
const id = (p: string) => `${p}${++n}`;
const nueva = () => nuevaAcs(alumno, 'Matemáticas', { etapa: 'primaria', curso: 3 }, '2026-11-03', k => k, id);

describe('ACS: datos generales y avisos de la orden', () => {
  it('el desfase cuenta los cursos seguidos de la enseñanza básica, también de ESO a Primaria', () => {
    expect(desfaseCursos({ etapa: 'primaria', curso: 5 }, { etapa: 'primaria', curso: 3 })).toBe(2);
    expect(desfaseCursos({ etapa: 'eso', curso: 1 }, { etapa: 'primaria', curso: 4 })).toBe(3);
    expect(desfaseCursos(undefined, { etapa: 'primaria', curso: 4 })).toBeNull();
  });

  it('una ACS bien hecha no avisa de nada', () => {
    const acs = { ...alternarCriterio(nueva(), entry, G, '1.1'), fechaInforme: '2026-10-01' };
    expect(avisosAcs(acs, alumno)).toEqual([]);
  });

  it('avisa sin NEE, con menos de dos cursos de desfase, sin informe, sin criterios y con pesos que no suman 100', () => {
    const otro = { ...alumno, categorias: ['Trastorno por déficit de atención e hiperactividad (TDAH)'], matricula: { etapa: 'primaria' as const, curso: 4 } };
    const acs = { ...nueva(), instrumentos: [{ id: 'i', nombre: 'Observación', peso: 60 }] };
    const textos = avisosAcs(acs, otro).map(a => a.texto);
    expect(textos).toHaveLength(5);
    expect(avisosAcs(acs, otro).find(a => a.texto.startsWith('La {sigla} pide un desfase'))?.vars).toEqual({ sigla: 'ACS', n: 1 });
    expect(avisosAcs(acs, otro).find(a => a.texto.startsWith('Los pesos'))?.vars).toEqual({ n: 60 });
  });

  it('empieza sin fecha del informe (la escribe el docente) y con instrumentos que suman 100', () => {
    const acs = nuevaAcs({ ...alumno, informe: { fecha: '2026-09-20', fortalezas: '', orientaciones: '', ambitos: [] } }, 'Matemáticas', alumno.nivel!, '2026-11-03');
    expect(acs.fechaInforme).toBe('');
    expect(acs.instrumentos.reduce((s, i) => s + i.peso, 0)).toBe(100);
  });
});

describe('ACS: selección curricular', () => {
  it('marcar un criterio marca su competencia; quitar la competencia quita sus criterios', () => {
    let acs = alternarCriterio(nueva(), entry, G, '1.2');
    acs = alternarCriterio(acs, entry, G, '1.1');
    expect(acs.criterios).toEqual(['1.1', '1.2']);
    expect(acs.competencias).toEqual([1]);
    acs = alternarCriterio(acs, entry, G, '2.1');
    expect(acs.competencias).toEqual([1, 2]);
    acs = alternarCompetencia(acs, entry, G, 1);
    expect(acs.criterios).toEqual(['2.1']);
    expect(acs.competencias).toEqual([2]);
    expect(alternarCriterio(acs, entry, G, '9.9')).toBe(acs);
  });

  it('los saberes van en el orden del decreto', () => {
    const acs = alternarSaber(alternarSaber(nueva(), entry, G, 'B'), entry, G, 'A');
    expect(acs.saberes).toEqual(['A', 'B']);
    expect(alternarSaber(acs, entry, G, 'A').saberes).toEqual(['B']);
  });

  it('al cambiar de curso, lo que no está en el currículo nuevo se cae', () => {
    const acs = { ...nueva(), competencias: [1, 7], criterios: ['2.1', '1.1', '7.3'], saberes: ['Z', 'A'] };
    const v = seleccionValida(acs, entry, G);
    expect(v.competencias).toEqual([1]);
    expect(v.criterios).toEqual(['1.1', '2.1']);
    expect(v.saberes).toEqual(['A']);
  });
});

describe('ACS: seguimiento trimestral', () => {
  it('una fila por criterio y por bloque de saberes, y solo se guardan las que tienen algo', () => {
    let acs = alternarSaber(alternarCriterio(alternarCriterio(nueva(), entry, G, '1.1'), entry, G, '2.1'), entry, G, 'A');
    expect(filasSeguimiento(acs, 1).map(f => `${f.tipo}:${f.clave}`)).toEqual(['criterio:1.1', 'criterio:2.1', 'saber:A']);
    acs = conFila(acs, { trimestre: 1, tipo: 'criterio', clave: '1.1', grado: 'proceso', observaciones: 'Con apoyo visual' });
    acs = conFila(acs, { trimestre: 2, tipo: 'criterio', clave: '1.1', grado: 'conseguido', observaciones: '' });
    expect(filasSeguimiento(acs, 1)[0]).toMatchObject({ grado: 'proceso', observaciones: 'Con apoyo visual' });
    expect(filasSeguimiento(acs, 2)[0].grado).toBe('conseguido');
    expect(progresoTrimestre(acs, 1)).toEqual({ hechas: 1, total: 3 });
    acs = conFila(acs, { trimestre: 1, tipo: 'criterio', clave: '1.1', observaciones: ' ' });
    expect(acs.seguimiento).toHaveLength(1);
  });
});

describe('ACS: guardado', () => {
  const acs = { ...conFila(alternarCriterio(nueva(), entry, G, '1.1'), { trimestre: 1, tipo: 'criterio', clave: '1.1', grado: 'proceso', observaciones: '' }),
    estrategias: ['visual', 'inventada'], ajustes: { 1: 'Más apoyo visual', 2: '' } };
  const data = { ...APOYO_VACIO, alumnos: [alumno], acs: [acs] };

  it('se conserva al abrir el perfil, y lo que no se entiende se descarta', () => {
    const d = normalizarApoyo(JSON.parse(JSON.stringify(data)));
    expect(d.acs).toHaveLength(1);
    expect(d.acs[0]).toMatchObject({ criterios: ['1.1'], competencias: [1], estrategias: ['visual'], ajustes: { 1: 'Más apoyo visual' } });
    expect(d.acs[0].seguimiento).toEqual([{ trimestre: 1, tipo: 'criterio', clave: '1.1', grado: 'proceso', observaciones: '' }]);
    const raro = normalizarApoyo({ ...data, acs: [{ ...acs, alumnoId: 'otro' }, { ...acs, id: 'b', nivel: { etapa: 'eso', curso: 9 } }, 7] });
    expect(raro.acs).toEqual([]);
    expect(normalizarApoyo({ alumnos: [] }).acs).toEqual([]);
  });

  it('se borra con su alumno', () => {
    expect(sinAlumno(data, 'a1').acs).toEqual([]);
  });
});

describe('ACS: textos', () => {
  it('las estrategias, los grados y los instrumentos están en los tres idiomas', () => {
    const claves = [...ESTRATEGIAS_ACS.map(e => e.texto), ...GRADOS_ACS.map(g => g.texto), ...INSTRUMENTOS_INICIALES.map(i => i.nombre)];
    for (const k of claves) {
      expect(translate('en', k), k).not.toBe(k);
      expect(translate('ca', k), k).not.toBe(k);
    }
  });
});
