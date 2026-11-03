/**
 * La adaptación curricular significativa en la Comunitat Valenciana (ACIS del PAP), Cataluña (PI) y Madrid (ACS de
 * Raíces), con el currículo de cada una: los apartados de su modelo, sus campos, sus avisos y sus firmas.
 */
import { describe, it, expect } from 'vitest';
import { contenidoAcs, docxAcs, firmasAcs, htmlAcs, tituloAcs } from './acsDocumento';
import { promptAcs } from './acsIA';
import { alternarCriterio, alternarSaber, avisosAcs, conCamposDelModelo, nuevaAcs, normalizarAcs, textoAviso } from '../lib/acs';
import { MODELOS_ACS, modeloAcs, notaConMarca, type ModeloAcsId } from '../lib/acsModelos';
import { APOYO_VACIO } from '../lib/apoyo';
import { cargarCurriculo } from '../lib/curriculum/cargar';
import { materiasDeCurriculo } from '../lib/curriculum/materiasDeNivel';
import { translate } from '../i18n';
import type { AlumnoApoyo, CursoDe } from '../types/apoyo';

const nombreCurso = (c: CursoDe) => `${c.curso}º ${c.etapa === 'primaria' ? 'Primaria' : 'ESO'}`;
const alumno: AlumnoApoyo = {
  id: 'a1', nombre: 'Alumno 1', claseOrigen: '6º A', matricula: { etapa: 'primaria', curso: 6 }, nivel: { etapa: 'primaria', curso: 3 },
  categorias: ['Discapacidad intelectual'], diagnostico: 'Dato de salud', necesidades: 'Le cuesta seguir las explicaciones orales largas.', notas: '',
  informe: { fecha: '2026-09-20', fortalezas: 'Muy constante con el material manipulativo.', orientaciones: '', ambitos: [] },
};
const docente = { nombre: 'Profesor', centro: 'Centro de prueba', curso: '2026-2027' };
const nivel: CursoDe = { etapa: 'primaria', curso: 3 };

async function preparar(id: Exclude<ModeloAcsId, 'andalucia'>) {
  const modelo = MODELOS_ACS[id];
  const materias = materiasDeCurriculo(await cargarCurriculo(id, 'primaria'), nivel);
  const m = materias.find(x => /matem/i.test(x.entry.nombre));
  if (!m) throw new Error(`Sin matemáticas de 3º en ${id}`);
  const [c1, c2] = m.entry.criterios[m.grupo];
  let acs = conCamposDelModelo(nuevaAcs(alumno, m.entry.nombre, nivel, '2026-11-03'), modelo, alumno);
  acs = alternarCriterio(alternarCriterio(acs, m.entry, m.grupo, c1.codigo), m.entry, m.grupo, c2.codigo);
  acs = alternarSaber(acs, m.entry, m.grupo, m.entry.saberes[m.grupo][0].bloque);
  return { modelo, m, acs, c1 };
}

describe('el modelo de cada comunidad', () => {
  it('solo las cuatro comunidades tienen modelo propio', () => {
    expect(modeloAcs('andalucia')?.sigla).toBe('ACS');
    expect(modeloAcs('comunitat-valenciana')?.sigla).toBe('ACIS');
    expect(modeloAcs('cataluna')?.sigla).toBe('PI');
    expect(modeloAcs('madrid')?.sigla).toBe('ACS');
    expect(modeloAcs('galicia')).toBeNull();
    expect(modeloAcs(undefined)).toBeNull();
  });

  it('cada apartado y cada etiqueta está en los tres idiomas', () => {
    for (const m of Object.values(MODELOS_ACS)) {
      const claves = [m.nombre, m.tarjeta, m.explicacion, m.informe, m.nuevo, m.cursoReferencia, ...m.apartados.map(a => a.titulo), ...m.fechas.map(f => f.texto),
        ...(m.nota ? [m.nota.ayuda] : []), ...(m.apoyos ? [m.apoyos.pt, m.apoyos.al] : [])];
      for (const k of claves) {
        expect(translate('en', k), k).not.toBe(k);
        expect(translate('ca', k), k).not.toBe(k);
      }
    }
  });

  it('la nota lleva la marca de su comunidad', () => {
    expect(notaConMarca(MODELOS_ACS['comunitat-valenciana'], '6')).toBe('6 (ACIS)');
    expect(notaConMarca(MODELOS_ACS.madrid, ' 7 ')).toBe('7*');
    expect(notaConMarca(MODELOS_ACS.madrid, '')).toBe('');
  });
});

describe('Comunitat Valenciana: ACIS del PAP', () => {
  it('cinco apartados, barreras y fortalezas de partida, nota con ACIS y decisión de promoción', async () => {
    const { modelo, m, acs } = await preparar('comunitat-valenciana');
    expect(acs.barreras).toBe(alumno.necesidades);
    expect(acs.fortalezas).toBe('Muy constante con el material manipulativo.');
    const lleno = {
      ...acs, fechaInforme: '2026-09-15', fechas: { resolucion: '2026-10-01' }, notas: { 1: '6' }, promocion: 'Promociona con la ACIS.',
      responsables: { ...acs.responsables, orientador: 'Orientadora del centro' },
      apoyos: { ptDentro: 2, ptFuera: 1.5, alDentro: 0, alFuera: 1, organizacion: 'Lunes y miércoles en el aula.' },
    };
    const c = contenidoAcs(lleno, alumno, m, docente, nombreCurso, 'es', modelo);
    expect(c.titulo).toBe(`Adaptación curricular individual significativa · ${m.entry.nombre}`);
    expect(c.secciones.map(s => s.titulo)).toEqual([
      '1. Datos identificativos y agentes implicados', '2. Barreras y fortalezas para el aprendizaje y la participación',
      '3. Propuesta curricular por área o materia (ACIS)', '4. Medidas de acceso y apoyos personales', '5. Seguimiento y evaluación trimestral',
    ]);
    const html = htmlAcs(c, 'es', firmasAcs('es', modelo));
    for (const x of ['01/10/2026', 'Orientadora del centro', '6 (ACIS)', 'Promociona con la ACIS.', '1,5 horas', 'Visto bueno de la dirección', 'Le cuesta seguir']) {
      expect(html).toContain(x);
    }
    expect(html).not.toContain('Dato de salud');
    expect(avisosAcs(lleno, alumno, modelo)).toEqual([]);
    expect(avisosAcs({ ...lleno, fechas: {} }, alumno, modelo).map(a => textoAviso(a, (k, v) => translate('es', k, v)))).toEqual(['Falta la «Fecha de la resolución de la dirección del centro».']);
  });

  it('en valenciano, con sus nombres', async () => {
    const { modelo, m, acs } = await preparar('comunitat-valenciana');
    const html = htmlAcs(contenidoAcs(acs, alumno, m, docente, nombreCurso, 'ca', modelo), 'ca', firmasAcs('ca', modelo));
    expect(html).toContain('Dades identificatives i agents implicats');
    expect(html).toContain('Proposta curricular per àrea o matèria (ACIS)');
  });
});

describe('Cataluña: PI', () => {
  it('sin aviso de NEE ni de desfase, con la CAD, la familia y cada criterio priorizado o modificado', async () => {
    const { modelo, m, acs, c1 } = await preparar('cataluna');
    const otro = { ...alumno, categorias: ['Dificultades específicas de aprendizaje'], matricula: { etapa: 'primaria' as const, curso: 4 } };
    const textos = avisosAcs({ ...acs, fechaInforme: '2026-09-15' }, otro, modelo).map(a => textoAviso(a, (k, v) => translate('es', k, v)));
    expect(textos).toEqual([
      'Falta la «Fecha de inicio del PI».', 'Falta la «Fecha de aprobación en la CAD».', 'Falta recoger la conformidad de la familia con el PI.',
    ]);
    const lleno = {
      ...acs, fechaInforme: '2026-09-15', fechas: { inicio: '2026-10-01', vigencia: '2027-06-30', cad: '2026-10-08' }, familiaConforme: true,
      acuerdos: 'Repasar en casa con el material del aula.', responsables: { ...acs.responsables, referente: 'Referente de prueba' },
      ajusteCriterios: { [c1.codigo]: { tipo: 'priorizado' as const, aula: 'Hace la misma tarea con menos ejercicios.' } },
      apoyos: { ptDentro: 3, ptFuera: 0, alDentro: 0, alFuera: 0, siei: true, organizacion: '' },
    };
    expect(avisosAcs(lleno, otro, modelo)).toEqual([]);
    const c = contenidoAcs(lleno, alumno, m, docente, nombreCurso, 'ca', modelo);
    expect(c.secciones).toHaveLength(5);
    const html = htmlAcs(c, 'ca', firmasAcs('ca', modelo));
    for (const x of ['Pla individualitzat', 'Referent del PI', 'Prioritzat', 'Hace la misma tarea', 'SIEI', 'La família està conforme amb el PI', 'Vistiplau de la direcció', 'Conformitat de la família', '08/10/2026']) {
      expect(html).toContain(x);
    }
    expect(tituloAcs(lleno, k => translate('ca', k), modelo)).toBe(`Pla individualitzat · ${m.entry.nombre}`);
    expect((await docxAcs(c, 'ca', firmasAcs('ca', modelo))).size).toBeGreaterThan(5000);
  });
});

describe('Madrid: ACS de Raíces', () => {
  it('pide ACNEE y dictamen, y la nota sale con asterisco', async () => {
    const { modelo, m, acs } = await preparar('madrid');
    expect(acs.organismo).toBe('eoep');
    const sinNee = { ...alumno, categorias: ['Trastorno por déficit de atención e hiperactividad (TDAH)'] };
    const textos = avisosAcs(acs, sinNee, modelo).map(a => textoAviso(a, (k, v) => translate('es', k, v)));
    expect(textos[0]).toMatch(/^La ACS es para el alumnado con necesidades educativas especiales/);
    expect(textos).toContain('Falta la «Fecha del dictamen de escolarización».');
    const lleno = { ...acs, fechaInforme: '2026-06-10', fechas: { dictamen: '2026-06-20' }, notas: { 1: '5' } };
    const html = htmlAcs(contenidoAcs(lleno, alumno, m, docente, nombreCurso, 'es', modelo), 'es', firmasAcs('es', modelo));
    for (const x of ['Datos del alumno y del dictamen de escolarización', 'Nivel de competencia curricular de referencia', 'Equipo de orientación educativa y psicopedagógica (EOEP)', '5*', '20/06/2026']) {
      expect(html).toContain(x);
    }
  });

  it('a la IA no llegan ni el profesorado, ni las fechas, ni las barreras', async () => {
    const { modelo, m, acs } = await preparar('madrid');
    const { prompt } = promptAcs({
      acs: { ...acs, responsables: { ...acs.responsables, tutor: 'Tutora Secreta' }, fechaInforme: '2026-06-10', fechas: { dictamen: '2026-06-20' } },
      alumno, materia: m, data: { ...APOYO_VACIO, alumnos: [alumno] }, lang: 'es', nombreCurso, modelo,
    });
    expect(prompt).toContain('Adaptación curricular significativa (ACS)');
    expect(prompt).not.toMatch(/Tutora Secreta|2026-06|Dato de salud/);
  });
});

describe('guardado de los campos de otras comunidades', () => {
  it('se conservan los que se entienden y se descarta lo demás', () => {
    const base = nuevaAcs(alumno, 'Matemáticas', nivel, '2026-11-03');
    const raro = {
      ...base, fechas: { cad: '2026-10-08', inicio: 'mañana', otra: '2026-01-01' }, organismo: 'otro', familiaConforme: 'sí',
      apoyos: { ptDentro: 99, ptFuera: '2', alDentro: -1, alFuera: 1.25, organizacion: 7 },
      ajusteCriterios: { '1.1': { tipo: 'raro', aula: 'Algo' }, '1.2': { aula: ' ' } }, notas: { 1: '6', 4: '9' },
      responsables: { ...base.responsables, referente: 'Referente' },
    };
    const r = normalizarAcs(JSON.parse(JSON.stringify(raro)), new Set(['a1']), v => v as CursoDe)!;
    expect(r.fechas).toEqual({ cad: '2026-10-08' });
    expect(r.organismo).toBeUndefined();
    expect(r.familiaConforme).toBeUndefined();
    expect(r.apoyos).toEqual({ ptDentro: 40, ptFuera: 2, alDentro: 0, alFuera: 1.5, organizacion: '' });
    expect(r.ajusteCriterios).toEqual({ '1.1': { aula: 'Algo' } });
    expect(r.notas).toEqual({ 1: '6' });
    expect(r.responsables.referente).toBe('Referente');
  });
});
