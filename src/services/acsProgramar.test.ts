/**
 * La ACS para programar (decisión del dueño, 3-11-2026): objetivos concretos de sus criterios, paso a los programas de
 * PT, contexto para la IA solo a petición y sin nombres, y el envío cifrado al docente de aula o de EF.
 */
import { describe, it, expect } from 'vitest';
import { acsParaIA } from '../lib/acsContexto';
import { objetivosAcsAProgramas, ambitoDeAcs } from '../lib/acsProgramas';
import { alternarCriterio, alternarSaber, nuevaAcs, normalizarAcs } from '../lib/acs';
import { MODELOS_ACS, esDeAsignatura, modeloAcs } from '../lib/acsModelos';
import { APOYO_VACIO, curso, normalizarApoyo, sinAcsDeAula } from '../lib/apoyo';
import { palabrasDeNombres } from '../lib/barreras';
import { cargarCurriculo } from '../lib/curriculum/cargar';
import { materiasDeCurriculo } from '../lib/curriculum/materiasDeNivel';
import { objetivosDePropuesta, promptObjetivosAcs } from './acsIA';
import { acsDelArchivo, archivoAcs, contenidoAcsCompartido } from './acsCompartir';
import { descifrarCopia } from './copiaCifrada';
import { bloqueAcs } from './apoyoIA';
import type { AlumnoApoyo, CursoDe } from '../types/apoyo';

const nombreCurso = (c: CursoDe) => `${c.curso}º ${c.etapa === 'primaria' ? 'Primaria' : 'ESO'}`;
const alumno: AlumnoApoyo = {
  id: 'a1', nombre: 'Lucía Pérez Gómez', claseOrigen: '1º ESO B', matricula: { etapa: 'eso', curso: 1 }, nivel: { etapa: 'primaria', curso: 4 },
  necesidades: '', notas: '',
};
let n = 0;
const id = (p: string) => `${p}${++n}`;

async function ejemplo(comunidad: 'galicia' | 'andalucia' = 'andalucia') {
  const m = materiasDeCurriculo(await cargarCurriculo(comunidad, 'primaria'), { etapa: 'primaria', curso: 4 }).find(x => /matem/i.test(x.entry.nombre))!;
  const [c1, c2] = m.entry.criterios[m.grupo];
  let acs = nuevaAcs(alumno, m.entry.nombre, { etapa: 'primaria', curso: 4 }, '2026-11-03', k => k, id);
  acs = alternarSaber(alternarCriterio(alternarCriterio(acs, m.entry, m.grupo, c1.codigo), m.entry, m.grupo, c2.codigo), m.entry, m.grupo, m.entry.saberes[m.grupo][0].bloque);
  acs = {
    ...acs, estrategias: ['visual'], calificacion: 'Lucía se califica con la observación. Teléfono 612345678.',
    responsables: { tutor: 'Tutora Secreta', especialista: 'Profesor', materia: '' }, fechaInforme: '2026-09-15', justificacion: 'Justificación privada',
    objetivos: [{ id: 'o1', texto: 'Resolver problemas de una operación con material', trimestres: [1, 2], criterio: c1.codigo }],
  };
  return { m, acs, c1 };
}

describe('la ACS como contexto de la IA', () => {
  it('lleva criterios, saberes, objetivos y estrategias, y nunca nombres, profesorado, fechas ni teléfonos', async () => {
    const { m, acs, c1 } = await ejemplo();
    const texto = acsParaIA(acs, MODELOS_ACS.andalucia, m, nombreCurso, palabrasDeNombres([alumno.nombre]));
    expect(texto).toContain(`${c1.codigo}. ${c1.texto}`);
    expect(texto).toContain('Resolver problemas de una operación con material');
    expect(texto).toContain('Apoyos visuales');
    expect(texto).toContain('4º Primaria');
    expect(texto).not.toMatch(/Lucía|Tutora Secreta|2026-09|612345678|Justificación privada|Dato de salud/);
    expect(bloqueAcs(texto)).toContain('ADAPTACIÓN CURRICULAR SIGNIFICATIVA');
    expect(bloqueAcs('  ')).toBe('');
  });

  it('sin datos de salud: ni la categoría NEAE ni un diagnóstico escrito en sus textos (3-11-2026)', async () => {
    const { m, acs } = await ejemplo();
    const conSalud = {
      ...acs, otrasEstrategias: 'Por su TDAH, instrucciones de una en una', calificacion: 'Toma metilfenidato; se califica con observación',
      objetivos: [{ id: 'o2', texto: 'Contar hasta 20 pese a su discapacidad intelectual', trimestres: [1] as (1 | 2 | 3)[], criterio: '' }],
    };
    const texto = acsParaIA(conSalud, MODELOS_ACS.andalucia, m, nombreCurso, palabrasDeNombres([alumno.nombre]));
    expect(texto).not.toMatch(/TDAH|metilfenidato|discapacidad|Discapacidad/);
    expect(texto).toContain('instrucciones de una en una');
    const { prompt } = promptObjetivosAcs({ acs: conSalud, materia: m, alumnoTexto: 'Necesidades educativas: TEA. Necesita apoyo visual', nombreCurso });
    expect(prompt).not.toMatch(/TEA|discapacidad/);
    expect(prompt).toContain('Necesita apoyo visual');
  });
});

describe('objetivos concretos', () => {
  it('la IA elige el criterio de una lista cerrada y lo repetido o inventado se descarta', async () => {
    const { m, acs, c1 } = await ejemplo();
    const { prompt, esquema } = promptObjetivosAcs({ acs, materia: m, alumnoTexto: 'Alumno: [código]', nombreCurso });
    expect(prompt).toContain(c1.codigo);
    expect(JSON.stringify(esquema)).toContain(c1.codigo);
    const r = objetivosDePropuesta(acs, { objetivos: [
      { texto: 'Contar hasta 100 con regletas', criterio: c1.codigo, trimestres: ['1'] },
      { texto: 'Resolver problemas de una operación con material', criterio: c1.codigo, trimestres: ['2'] },
      { texto: 'Algo con un criterio inventado', criterio: '9.9', trimestres: [] },
    ] }, id);
    expect(r.map(o => o.texto)).toEqual(['Contar hasta 100 con regletas', 'Algo con un criterio inventado']);
    expect(r[0]).toMatchObject({ criterio: c1.codigo, trimestres: [1] });
    expect(r[1].criterio).toBeUndefined();
    expect(r[1].trimestres).toEqual([1, 2, 3]);
  });

  it('pasan a un programa de PT con su criterio oficial, sin repetirse', async () => {
    const { m, acs, c1 } = await ejemplo();
    const ambito = ambitoDeAcs(acs, MODELOS_ACS.andalucia, 'andalucia', 'es', k => k);
    expect(ambito).toBe('Adaptación curricular significativa (ACS) · Matemáticas');
    const d = { ...APOYO_VACIO, alumnos: [alumno] };
    const r = objetivosAcsAProgramas(d, acs, ambito, m.entry.nombre, id);
    expect(r.pasados).toBe(1);
    expect(r.data.programas[0].objetivos[0]).toMatchObject({ origen: 'acs', criterios: [{ materia: m.entry.nombre, codigo: c1.codigo }], trimestres: [1, 2] });
    expect(objetivosAcsAProgramas(r.data, acs, ambito, m.entry.nombre, id).pasados).toBe(0);
    // En la Comunitat Valenciana van al programa de la ACIS del PAP
    expect(ambitoDeAcs(acs, MODELOS_ACS['comunitat-valenciana'], 'comunitat-valenciana', 'es', k => k)).toBe('Adaptación curricular individual significativa (ACIS)');
  });
});

describe('modelo general para el resto de comunidades', () => {
  it('Galicia usa el general con su currículo y no pide desfase', async () => {
    expect(modeloAcs('galicia').id).toBe('general');
    const { acs } = await ejemplo('galicia');
    expect(acs.criterios.length).toBe(2);
    expect(MODELOS_ACS.general.desfaseMinimo).toBeNull();
  });
});

describe('del especialista al docente de aula', () => {
  it('el archivo cifrado no lleva el nombre ni el diagnóstico, y se añade al alumno de la clase', async () => {
    const { acs } = await ejemplo();
    const c = contenidoAcsCompartido([acs], alumno, 'Profesor', new Date('2026-11-03'));
    expect(JSON.stringify(c)).not.toMatch(/Lucía|Dato de salud/);
    const blob = await archivoAcs([acs], alumno, 'Profesor', 'CLAVE-DE-PRUEBA-1');
    const abierto = await descifrarCopia(await blob.text(), 'CLAVE-DE-PRUEBA-1');
    const recibidas = acsDelArchivo(abierto, 'stu-9', id);
    expect(recibidas).toHaveLength(1);
    expect(recibidas[0]).toMatchObject({ alumnoId: 'stu-9', area: acs.area, criterios: acs.criterios, });
    expect(recibidas[0].id).not.toBe(acs.id);
    expect(recibidas[0].objetivos?.[0].texto).toBe('Resolver problemas de una operación con material');
  });

  it('la del aula se guarda con el perfil y se borra con el alumno', async () => {
    const { acs } = await ejemplo();
    const deAula = { ...acs, alumnoId: 'stu-9' };
    const d = normalizarApoyo(JSON.parse(JSON.stringify({ ...APOYO_VACIO, acsAula: [deAula, { ...deAula, id: 'x', nivel: { etapa: 'eso', curso: 9 } }] })));
    expect(d.acsAula).toHaveLength(1);
    expect(sinAcsDeAula(d, new Set(['stu-9'])).acsAula).toEqual([]);
    expect(normalizarAcs({ ...deAula, alumnoId: '' }, { has: x => x !== '' }, curso)).toBeNull();
  });
});

describe('marca en el cuaderno', () => {
  it('reconoce la asignatura aunque se escriba distinto', () => {
    expect(esDeAsignatura({ area: 'Matemáticas', materiaAula: '' }, 'Matemáticas')).toBe(true);
    expect(esDeAsignatura({ area: 'Matemáticas', materiaAula: 'Matemáticas (1º ESO)' }, 'matematicas')).toBe(true);
    expect(esDeAsignatura({ area: 'Educación Física', materiaAula: '' }, 'Educación física')).toBe(true);
    expect(esDeAsignatura({ area: 'Lengua Castellana y Literatura', materiaAula: '' }, 'Matemáticas')).toBe(false);
    expect(esDeAsignatura({ area: 'Educación Física', materiaAula: '' }, 'Educación Plástica')).toBe(false);
  });
});
