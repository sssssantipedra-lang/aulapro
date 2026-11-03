/**
 * La ACS de Andalucía con el currículo andaluz de verdad: el documento lleva los textos oficiales del curso de
 * referencia, y a la IA solo le llegan listas cerradas y nada del profesorado.
 */
import { describe, it, expect } from 'vitest';
import { contenidoAcs, docxAcs, firmasAcs, htmlAcs } from './acsDocumento';
import { aplicarPropuesta, promptAcs } from './acsIA';
import { alternarCriterio, alternarSaber, conFila, nuevaAcs } from '../lib/acs';
import { APOYO_VACIO } from '../lib/apoyo';
import { cargarCurriculo } from '../lib/curriculum/cargar';
import { materiasDeCurriculo } from '../lib/curriculum/materiasDeNivel';
import type { AlumnoApoyo, CursoDe } from '../types/apoyo';

const nombreCurso = (c: CursoDe) => `${c.curso}º ${c.etapa === 'primaria' ? 'Primaria' : 'ESO'}`;
const alumno: AlumnoApoyo = {
  id: 'a1', nombre: 'Alumno 1', claseOrigen: '1º ESO B', matricula: { etapa: 'eso', curso: 1 }, nivel: { etapa: 'primaria', curso: 4 },
  categorias: ['Discapacidad intelectual'], diagnostico: 'Dato de salud que no debe salir', necesidades: 'Aprende mejor con apoyo visual', notas: '',
};
const docente = { nombre: 'Profesor', centro: 'CEIP de prueba', curso: '2026-2027' };

async function matematicas4() {
  const curriculo = await cargarCurriculo('andalucia', 'primaria');
  const m = materiasDeCurriculo(curriculo, { etapa: 'primaria', curso: 4 }).find(x => x.entry.nombre === 'Matemáticas');
  if (!m) throw new Error('Sin Matemáticas de 4º en Andalucía');
  return m;
}

async function acsDePrueba() {
  const m = await matematicas4();
  const [c1, c2] = m.entry.criterios[m.grupo];
  let acs = nuevaAcs(alumno, m.entry.nombre, { etapa: 'primaria', curso: 4 }, '2026-11-03');
  acs = alternarCriterio(alternarCriterio(acs, m.entry, m.grupo, c1.codigo), m.entry, m.grupo, c2.codigo);
  acs = alternarSaber(acs, m.entry, m.grupo, m.entry.saberes[m.grupo][0].bloque);
  acs = conFila(acs, { trimestre: 1, tipo: 'criterio', clave: c1.codigo, grado: 'proceso', observaciones: 'Con material manipulativo' });
  acs = {
    ...acs, fechaInforme: '2026-09-15', justificacion: 'Nivel de 4º en cálculo y problemas.',
    responsables: { tutor: 'Tutora de 1º B', especialista: 'Profesor', materia: 'Profesor de Matemáticas' },
    materiaAula: 'Matemáticas (1º ESO)', estrategias: ['visual', 'tiempo'], ajustes: { 1: 'Más tiempo en las pruebas' },
  };
  return { m, acs, c1 };
}

describe('documento de la ACS', () => {
  it('lleva los cuatro bloques con los textos oficiales del curso de referencia', async () => {
    const { m, acs, c1 } = await acsDePrueba();
    const c = contenidoAcs(acs, alumno, m, docente, nombreCurso, 'es');
    expect(c.titulo).toBe('Adaptación curricular significativa · Matemáticas (1º ESO)');
    expect(c.secciones.map(s => s.titulo)).toEqual([
      '1. Datos generales y dictamen', '2. Selección curricular',
      '3. Adaptaciones metodológicas y criterios de calificación', '4. Seguimiento y valoración trimestral',
    ]);
    const html = htmlAcs(c, 'es', firmasAcs('es'));
    expect(html).toContain('15/09/2026');
    expect(html).toContain('4º Primaria');
    expect(html).toContain('3 cursos');
    expect(html).toContain(`${c1.codigo}. ${c1.texto}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    expect(html).toContain(`CE${c1.competencia}.`);
    expect(html).toContain('Apoyos visuales: imágenes, pictogramas y esquemas');
    expect(html).toContain('Observación directa');
    expect(html).toContain('En proceso');
    expect(html).toContain('Con material manipulativo');
    expect(html).toContain('Más tiempo en las pruebas');
    expect(html).toContain('Tutora de 1º B');
    // El diagnóstico nunca sale en el documento
    expect(html).not.toContain('Dato de salud');
    // Los tres trimestres salen aunque estén vacíos, para rellenarlos en papel
    expect(html.match(/<h3>\dº trimestre<\/h3>/g)).toHaveLength(3);
  });

  it('en catalán, los textos de la app se traducen y el currículo se queda como está', async () => {
    const { m, acs } = await acsDePrueba();
    const html = htmlAcs(contenidoAcs(acs, alumno, m, docente, nombreCurso, 'ca'), 'ca', firmasAcs('ca'));
    expect(html).toContain('Selecció curricular');
    expect(html).toContain('Signatures');
  });

  it('se puede sacar en Word', async () => {
    const { m, acs } = await acsDePrueba();
    const blob = await docxAcs(contenidoAcs(acs, alumno, m, docente, nombreCurso, 'es'), 'es', firmasAcs('es'));
    expect(blob.size).toBeGreaterThan(5000);
  });
});

describe('propuesta de la IA', () => {
  it('le llegan listas cerradas del currículo y nada del profesorado ni del diagnóstico', async () => {
    const { m, acs } = await acsDePrueba();
    const { prompt, esquema } = promptAcs({ acs, alumno, materia: m, data: { ...APOYO_VACIO, alumnos: [alumno] }, lang: 'es', nombreCurso });
    expect(prompt).toContain('4º Primaria');
    expect(prompt).toContain('3 cursos por debajo');
    expect(prompt).toContain(m.entry.criterios[m.grupo][0].texto);
    expect(prompt).not.toContain('Tutora de 1º B');
    expect(prompt).not.toContain('Profesor de Matemáticas');
    expect(prompt).not.toContain('Dato de salud');
    expect(prompt).not.toContain('2026-09-15');
    const props = (esquema as { properties: Record<string, { items?: { enum: string[] } }> }).properties;
    expect(props.criterios.items!.enum).toEqual(m.entry.criterios[m.grupo].map(c => c.codigo));
  });

  it('solo se queda con lo que está en las listas, y las competencias salen de los criterios', async () => {
    const { m, acs } = await acsDePrueba();
    const [c1, , c3] = m.entry.criterios[m.grupo];
    const r = aplicarPropuesta(acs, m, {
      criterios: [c3.codigo, 'inventado', c1.codigo], saberes: ['Z', m.entry.saberes[m.grupo][1].bloque],
      estrategias: ['cooperativo', 'otra'], otras: '', calificacion: 'Se califica con los criterios elegidos.',
    })!;
    expect(r.criterios).toEqual([c1.codigo, c3.codigo]);
    expect(r.competencias).toEqual([...new Set([c1.competencia, c3.competencia])].sort((a, b) => a - b));
    expect(r.saberes).toEqual([m.entry.saberes[m.grupo][1].bloque]);
    expect(r.estrategias).toEqual(['cooperativo']);
    expect(r.calificacion).toBe('Se califica con los criterios elegidos.');
    // Lo que ya estaba y la IA no trae se conserva; el seguimiento, siempre
    expect(r.seguimiento).toEqual(acs.seguimiento);
    expect(aplicarPropuesta(acs, m, { criterios: ['nada'] })).toBeNull();
  });
});
