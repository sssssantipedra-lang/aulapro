/**
 * Documentos de PT y AL: los datos los pone la app (objetivos, recuentos,
 * asistencia), la IA solo redacta; el PAP lleva los textos literales del
 * Documento 7 y se rellena trimestre a trimestre sin perder lo anterior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generarDocumento, datosParaIA, objetivosTexto, buildDocumentoHtml, buildDocumentoDocxBlob, tiposDe, cabecera, PAP,
} from './apoyoDocumentos';
import { datosDelTrimestre } from '../lib/apoyo';
import { translate } from '../i18n';
import type { ApoyoData, CursoDe, DocumentoApoyo } from '../types/apoyo';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

const t = (k: string, v?: Record<string, string | number>) => translate('es', k, v);
const nombreCurso = (c: CursoDe) => `${c.curso}º ${c.etapa === 'primaria' ? 'Primaria' : 'ESO'}`;
const reg = (alumnoId: string, objetivos: Record<string, 'si' | 'proceso' | 'no'>, extra = {}) =>
  ({ alumnoId, objetivos, respuesta: {}, nota: '', ...extra });

const data: ApoyoData = {
  alumnos: [{ id: 'a1', nombre: 'Marta Gil', claseOrigen: '4º B', matricula: { etapa: 'primaria', curso: 4 },
    nivel: { etapa: 'primaria', curso: 2 }, categorias: ['NEE'], diagnostico: 'Discapacidad intelectual leve', necesidades: '', notas: '' }],
  grupos: [{ id: 'g1', nombre: 'Lectoescritura', especialidad: 'PT', modalidad: 'fuera', color: '#000', alumnos: ['a1'],
    horario: [{ dia: 0, inicio: '09:00', fin: '09:45' }] }],
  programas: [
    { id: 'p1', alumnoId: 'a1', ambito: 'Programa personalizado para el aprendizaje de la lectura y la escritura', especialidad: 'PT', intensidad: 'alta', objetivos: [
      { id: 'o1', texto: 'Leer sílabas directas', trimestres: [1], criterios: [] },
      { id: 'o2', texto: 'Leer frases sencillas', trimestres: [2], criterios: [] },
    ] },
    { id: 'p2', alumnoId: 'a1', ambito: 'Programa específico de conducta o plan terapéutico', especialidad: 'PT', objetivos: [
      { id: 'o3', texto: 'Esperar su turno', trimestres: [1, 2, 3], criterios: [] },
    ] },
  ],
  sesiones: [
    { id: 's1', grupoId: 'g1', fecha: '2026-10-05', temaClase: 'Fracciones', alumnos: [reg('a1', { o1: 'no' }, { respuesta: { atencion: 2 }, nota: 'Se cansa pronto' })] },
    { id: 's2', grupoId: 'g1', fecha: '2026-10-07', temaClase: '', alumnos: [reg('a1', { o1: 'si', o3: 'proceso' }, { respuesta: { atencion: 3 } })] },
    { id: 's3', grupoId: 'g1', fecha: '2026-10-14', temaClase: '', alumnos: [reg('a1', {}, { ausente: true })] },
    { id: 's4', grupoId: 'g1', fecha: '2027-01-11', temaClase: '', alumnos: [reg('a1', { o2: 'proceso' })] },
  ],
  documentos: [],
  coordinaciones: [],
  agendas: [],
  fotos: [],
};

describe('datos que pone la app', () => {
  it('cuenta sesiones, ausencias, logros y medias del trimestre, sin mezclar trimestres', () => {
    const d = datosDelTrimestre(data, 'a1', 1);
    expect(d.sesiones).toBe(3);
    expect(d.ausencias).toBe(1);
    expect(d.objetivos.map(o => o.objetivo.id)).toEqual(['o1', 'o3']);
    expect(d.objetivos[0].resumen).toEqual({ si: 1, proceso: 0, no: 1, ultimo: 'si' });
    expect(d.respuesta.atencion).toEqual({ media: 2.5, veces: 2 });
    expect(d.respuesta.conducta).toEqual({ media: null, veces: 0 });
    expect(d.notas).toEqual([{ fecha: '2026-10-05', texto: 'Se cansa pronto' }]);
    expect(d.temas).toEqual([{ fecha: '2026-10-05', texto: 'Fracciones' }]);

    const txt = datosParaIA(d, 1);
    expect(txt).toContain('Sesiones registradas: 3; ausencias: 1');
    expect(txt).toContain('Leer sílabas directas: conseguido 1, en proceso 0, no conseguido 1; último registro: conseguido');
    expect(txt).toContain('atención: 2,5 en 2 sesiones');
    expect(txt).toContain('conducta: sin datos');
  });

  it('las coordinaciones del trimestre llegan a la IA con los acuerdos, sin quiénes estuvieron', () => {
    const con = {
      ...data,
      coordinaciones: [
        { id: 'c1', alumnoId: 'a1', fecha: '2026-10-20', con: 'familia' as const, asistentes: 'Rosa Pérez, la madre', temas: 'Lectura en casa', acuerdos: 'Leer diez minutos al día' },
        { id: 'c2', alumnoId: 'a1', fecha: '2027-01-15', con: 'tutoria' as const, asistentes: '', temas: 'Otro trimestre', acuerdos: '' },
      ],
    };
    const d = datosDelTrimestre(con, 'a1', 1);
    expect(d.coordinaciones.map(c => c.id)).toEqual(['c1']);
    const txt = datosParaIA(d, 1);
    expect(txt).toContain('Coordinaciones de este trimestre:\n- 2026-10-20, con familia: Lectura en casa. Acuerdos: Leer diez minutos al día');
    expect(txt).not.toContain('Rosa');
    expect(txt).not.toContain('Otro trimestre');
  });

  it('los objetivos van por ámbito y trimestre, con la intensidad', () => {
    const txt = objetivosTexto(data, 'a1', [], t);
    expect(txt).toContain('Programa personalizado para el aprendizaje de la lectura y la escritura (intensidad alta)');
    expect(txt).toContain('1º trimestre:\n- Leer sílabas directas');
    expect(txt).toContain('2º trimestre:\n- Leer frases sencillas');
  });

  it('el PAP solo se ofrece en la Comunitat Valenciana', () => {
    expect(tiposDe('comunitat-valenciana')).toContain('pap');
    expect(tiposDe('madrid')).not.toContain('pap');
  });

  it('la cabecera de la familia no lleva la necesidad ni el nivel', () => {
    const docente = { nombre: 'Laura Martí', centro: 'CEIP Prova', curso: '2026-2027' };
    const base = { id: 'd', alumnoId: 'a1', fecha: '', titulo: '', apartados: [], trimestre: 1 as const };
    const familia = cabecera({ ...base, tipo: 'familia' }, data.alumnos[0], data, docente, nombreCurso, t, 'es').map(f => f[0]);
    expect(familia).not.toContain('Necesidades específicas de apoyo educativo');
    expect(familia).toContain('Trimestre');
    const prog = cabecera({ ...base, tipo: 'programacion' }, data.alumnos[0], data, docente, nombreCurso, t, 'es');
    expect(prog.find(f => f[0] === 'Horario de apoyo')?.[1]).toBe('Lectoescritura: Lun 09:00–09:45');
  });
});

describe('generarDocumento', () => {
  beforeEach(() => callGemini.mockReset());
  const comun = { alumno: data.alumnos[0], data, materias: [], comunidad: 'comunitat-valenciana' as const, lang: 'es' as const, nombreCurso, hoy: '2026-12-15' };

  it('informe a la familia: la IA redacta sus cuatro apartados con los datos del trimestre', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({ apartados: [
      { id: 'trabajado', texto: 'Ha trabajado la lectura.' }, { id: 'respuesta', texto: 'Ha estado atenta.' },
      { id: 'casa', texto: '- Leer juntos' }, { id: 'proximo', texto: '- Leer frases' },
    ] }));
    const doc = await generarDocumento({ ...comun, tipo: 'familia', trimestre: 1 });
    expect(doc?.apartados.map(a => a.id)).toEqual(['trabajado', 'respuesta', 'casa', 'proximo']);
    expect(doc?.titulo).toBe('Informe trimestral a la familia · 1º trimestre');
    expect(doc?.trimestre).toBe(1);
    const [sistema, usuario] = callGemini.mock.calls[0];
    expect(sistema).toContain('Orden 20/2019');
    expect(usuario).toContain('Sesiones registradas: 3; ausencias: 1');
    expect(usuario).toContain('Objetivos del próximo trimestre:\n- [Programa personalizado para el aprendizaje de la lectura y la escritura] Leer frases sencillas');
    expect(usuario).toContain('no inventes logros');
  });

  it('informe al equipo: la asistencia la cuenta la app, no la IA', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({ apartados: [{ id: 'evolucion', texto: 'Evoluciona.' }] }));
    const doc = await generarDocumento({ ...comun, tipo: 'equipo', trimestre: 1 });
    expect(doc?.apartados.find(a => a.id === 'asistencia')?.texto).toBe('Ha asistido a 2 de 3 sesiones registradas este trimestre.');
    const enumIds = callGemini.mock.calls[0][4].responseSchema.properties.apartados.items.properties.id.enum;
    expect(enumIds).not.toContain('asistencia');
  });

  it('programación: los objetivos salen tal cual de sus programas', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({ apartados: [{ id: 'justificacion', texto: 'Según la Orden 20/2019…' }] }));
    const doc = await generarDocumento({ ...comun, tipo: 'programacion', trimestre: 1 });
    expect(doc?.trimestre).toBeUndefined();
    expect(doc?.apartados.find(a => a.id === 'objetivos')?.texto).toContain('- Esperar su turno');
    expect(callGemini.mock.calls[0][1]).not.toContain('Sesiones registradas');
  });

  it('PAP: rellena la columna del trimestre y conserva las anteriores', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({ medidas: [{ id: 'p1', seguimiento: 'Avanza en la lectura.' }], progreso: 'Progreso adecuado.' }));
    const primero = await generarDocumento({ ...comun, tipo: 'pap', trimestre: 1 });
    expect(primero?.tabla).toEqual([
      ['Programa personalizado para el aprendizaje de la lectura y la escritura', 'Avanza en la lectura.', '', '', ''],
      ['Programa específico de conducta o plan terapéutico', '', '', '', ''],
    ]);
    expect(primero?.apartados[0]).toEqual({ id: 'progreso', titulo: 'Progreso global del alumnado', texto: 'Progreso adecuado.' });
    // El tercero añade la propuesta y las nuevas medidas
    callGemini.mockResolvedValueOnce(JSON.stringify({
      medidas: [{ id: 'p1', seguimiento: 'Lee frases.', propuesta: 'Continúa el curso siguiente.' }], progreso: 'Bien.', nuevas: 'Ninguna.',
    }));
    const tercero = await generarDocumento({ ...comun, tipo: 'pap', trimestre: 3, anterior: primero! });
    expect(tercero?.id).toBe(primero?.id);
    expect(tercero?.tabla?.[0]).toEqual(['Programa personalizado para el aprendizaje de la lectura y la escritura', 'Avanza en la lectura.', '', 'Lee frases.', 'Continúa el curso siguiente.']);
    expect(tercero?.apartados[1].texto).toBe('Ninguna.');
  });

  it('si la IA falla, no hay documento', async () => {
    callGemini.mockResolvedValueOnce(null);
    expect(await generarDocumento({ ...comun, tipo: 'familia', trimestre: 1 })).toBeNull();
  });
});

describe('exportar', () => {
  const pap: DocumentoApoyo = {
    id: 'd', alumnoId: 'a1', tipo: 'pap', trimestre: 1, fecha: '2026-12-15', titulo: 'Seguimiento del PAP de Marta Gil',
    tabla: [['Programa X', 'Avanza <bien>', '', '', '']],
    apartados: [{ id: 'progreso', titulo: PAP.es.progreso, texto: 'Progreso.' }, { id: 'nuevas', titulo: PAP.es.nuevas, texto: '' }],
  };

  it('el PAP lleva las columnas literales del Documento 7, el cuadro de firma y escapa el texto', () => {
    const html = buildDocumentoHtml(pap, [['Alumno o alumna', 'Marta Gil']], 'es', { nombre: 'Laura Martí', como: 'Profesorado especializado de apoyo (PT)' });
    expect(html).toContain('SEGUIMIENTO Y EVALUACIÓN');
    expect(html).toContain('Propuesta para el curso siguiente (finaliza o continúa el curso siguiente)');
    expect(html).toContain('Avanza &lt;bien&gt;');
    expect(html).toContain('NOMBRE Y APELLIDOS');
    // Un apartado vacío no se imprime
    expect(html).not.toContain('incluir solo las que sean diferents');
    const va = buildDocumentoHtml(pap, [], 'ca');
    expect(va).toContain('SEGUIMENT I AVALUACIÓ');
  });

  it('el Word se genera', async () => {
    const blob = await buildDocumentoDocxBlob(pap, [['Alumno o alumna', 'Marta Gil']], 'es', { nombre: 'Laura', como: 'PT' });
    expect(blob.size).toBeGreaterThan(1000);
  });
});
