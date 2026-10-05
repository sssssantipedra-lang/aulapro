import { describe, it, expect } from 'vitest';
import {
  ambitosDe, trimestreDe, diaDeLaSemana, gruposDelDia, tieneDesfase, nivelDe,
  objetivosDelTrimestre, sesionDe, sesionConDatos, resumenObjetivo,
  normalizarApoyo, sinAlumno, sinGrupo, especialidadesDePerfil, APOYO_VACIO,
} from './apoyo';
import type { AlumnoApoyo, ApoyoData, GrupoApoyo, ProgramaApoyo, SesionApoyo } from '../types/apoyo';

const alumno = (id: string, extra: Partial<AlumnoApoyo> = {}): AlumnoApoyo => ({
  id, nombre: `Alumno ${id}`, claseOrigen: '2º B', categoria: '', diagnostico: '', necesidades: '', notas: '', ...extra,
});
const grupo = (id: string, extra: Partial<GrupoApoyo> = {}): GrupoApoyo => ({
  id, nombre: `Grupo ${id}`, especialidad: 'PT', modalidad: 'fuera', horario: [], alumnos: [], color: '#000', ...extra,
});

describe('ámbitos', () => {
  it('en la Comunitat Valenciana son los programas del PAP, literales, en su lengua', () => {
    const es = ambitosDe('comunitat-valenciana', 'es');
    expect(es.oficial).toBe(true);
    expect(es.ambitos.map(a => a.nombre)).toContain('Programa personalizado para el aprendizaje de la lectura y la escritura');
    // La errata del modelo castellano se conserva
    expect(es.ambitos.map(a => a.nombre)).toContain('Programa personalitzat para el desarrollo de la autonomía personal');
    const va = ambitosDe('comunitat-valenciana', 'ca');
    expect(va.ambitos[0]).toEqual({
      nombre: 'Programa personalitzat per a l’adquisició i ús funcional de la comunicació, el llenguatge i la parla',
      especialidad: 'AL',
    });
  });

  it('en el resto, los ámbitos de partida de PT y de AL', () => {
    const m = ambitosDe('madrid', 'es');
    expect(m.oficial).toBe(false);
    expect(m.ambitos.some(a => a.especialidad === 'PT')).toBe(true);
    expect(m.ambitos.some(a => a.especialidad === 'AL')).toBe(true);
    expect(ambitosDe(undefined, 'en')).toEqual(m);
  });
});

describe('fechas', () => {
  it('reparte el curso en tres trimestres', () => {
    expect(trimestreDe('2026-09-14')).toBe(1);
    expect(trimestreDe('2026-12-18')).toBe(1);
    expect(trimestreDe('2027-01-08')).toBe(2);
    expect(trimestreDe('2027-03-26')).toBe(2);
    expect(trimestreDe('2027-04-12')).toBe(3);
    expect(trimestreDe('2027-06-22')).toBe(3);
  });

  it('cuenta los días desde el lunes', () => {
    expect(diaDeLaSemana('2026-10-05')).toBe(0); // lunes
    expect(diaDeLaSemana('2026-10-09')).toBe(4); // viernes
    expect(diaDeLaSemana('2026-10-04')).toBe(6); // domingo
  });

  it('da los grupos del día por orden de hora', () => {
    const g = [
      grupo('a', { horario: [{ dia: 0, inicio: '11:00', fin: '11:45' }] }),
      grupo('b', { horario: [{ dia: 0, inicio: '09:00', fin: '09:45' }, { dia: 2, inicio: '08:00', fin: '09:00' }] }),
      grupo('c', { horario: [{ dia: 1, inicio: '09:00', fin: '09:45' }] }),
    ];
    expect(gruposDelDia(g, '2026-10-05').map(x => x.id)).toEqual(['b', 'a']);
    expect(gruposDelDia(g, '2026-10-04')).toEqual([]);
  });
});

describe('alumnado', () => {
  it('su nivel es el de su matrícula si no se indica otro', () => {
    expect(nivelDe(alumno('1', { matricula: { etapa: 'primaria', curso: 4 } }))).toEqual({ etapa: 'primaria', curso: 4 });
    expect(nivelDe(alumno('1', { matricula: { etapa: 'primaria', curso: 4 }, nivel: { etapa: 'primaria', curso: 2 } })))
      .toEqual({ etapa: 'primaria', curso: 2 });
  });

  it('marca el desfase cuando su nivel está por debajo de su curso, también entre etapas', () => {
    expect(tieneDesfase(alumno('1', { matricula: { etapa: 'primaria', curso: 4 }, nivel: { etapa: 'primaria', curso: 2 } }))).toBe(true);
    expect(tieneDesfase(alumno('1', { matricula: { etapa: 'eso', curso: 1 }, nivel: { etapa: 'primaria', curso: 5 } }))).toBe(true);
    expect(tieneDesfase(alumno('1', { matricula: { etapa: 'eso', curso: 1 }, nivel: { etapa: 'eso', curso: 1 } }))).toBe(false);
    expect(tieneDesfase(alumno('1', { nivel: { etapa: 'primaria', curso: 2 } }))).toBe(false);
  });

  it('lee las especialidades del perfil sin fiarse de lo guardado', () => {
    expect(especialidadesDePerfil(['AL', 'PT'])).toEqual(['PT', 'AL']);
    expect(especialidadesDePerfil(['AL', 'X'])).toEqual(['AL']);
    expect(especialidadesDePerfil('PT')).toEqual([]);
    expect(especialidadesDePerfil(undefined)).toEqual([]);
  });
});

describe('programas y sesiones', () => {
  const programas: ProgramaApoyo[] = [
    { id: 'p1', alumnoId: 'a', ambito: 'Lectoescritura', especialidad: 'PT', objetivos: [
      { id: 'o1', texto: 'Lee sílabas directas', trimestres: [1], criterios: [] },
      { id: 'o2', texto: 'Segmenta palabras', trimestres: [1, 2], criterios: [] },
    ] },
    { id: 'p2', alumnoId: 'a', ambito: 'Pragmática', especialidad: 'AL', objetivos: [
      { id: 'o3', texto: 'Respeta el turno', trimestres: [1], criterios: [] },
    ] },
  ];

  it('da los objetivos del trimestre de su especialidad', () => {
    expect(objetivosDelTrimestre(programas, 'a', 'PT', 1).map(x => x.objetivo.id)).toEqual(['o1', 'o2']);
    expect(objetivosDelTrimestre(programas, 'a', 'PT', 2).map(x => x.objetivo.id)).toEqual(['o2']);
    expect(objetivosDelTrimestre(programas, 'a', 'AL', 1).map(x => x.objetivo.id)).toEqual(['o3']);
    expect(objetivosDelTrimestre(programas, 'b', 'PT', 1)).toEqual([]);
  });

  it('abre la sesión del día, o una nueva con el alumnado del grupo', () => {
    const g = grupo('g', { alumnos: ['a', 'b'] });
    const nueva = sesionDe([], g, '2026-10-05');
    expect(nueva.alumnos.map(r => r.alumnoId)).toEqual(['a', 'b']);
    expect(sesionConDatos(nueva)).toBe(false);
    const hecha: SesionApoyo = { ...nueva, alumnos: [{ ...nueva.alumnos[0], objetivos: { o1: 'si' } }] };
    // Un alumno añadido al grupo después también sale
    const abierta = sesionDe([hecha], g, '2026-10-05');
    expect(abierta.id).toBe(hecha.id);
    expect(abierta.alumnos.map(r => r.alumnoId)).toEqual(['a', 'b']);
    expect(sesionConDatos(abierta)).toBe(true);
    // Una propuesta de la IA también cuenta como algo anotado
    expect(sesionConDatos({ ...nueva, adaptaciones: { a: 'Contar con fichas' } })).toBe(true);
    expect(sesionConDatos({ ...nueva, adaptaciones: { a: '  ' } })).toBe(false);
  });

  it('resume cómo va cada objetivo, con el último registro', () => {
    const s = (fecha: string, logro: 'si' | 'proceso' | 'no'): SesionApoyo => ({
      id: fecha, grupoId: 'g', fecha, temaClase: '',
      alumnos: [{ alumnoId: 'a', objetivos: { o1: logro }, respuesta: {}, nota: '' }],
    });
    const sesiones = [s('2026-10-07', 'si'), s('2026-10-05', 'no'), s('2027-01-11', 'proceso')];
    expect(resumenObjetivo(sesiones, 'a', 'o1')).toEqual({ si: 1, proceso: 1, no: 1, ultimo: 'proceso' });
    expect(resumenObjetivo(sesiones, 'a', 'o1', 1)).toEqual({ si: 1, proceso: 0, no: 1, ultimo: 'si' });
    expect(resumenObjetivo(sesiones, 'b', 'o1')).toEqual({ si: 0, proceso: 0, no: 0 });
  });
});

describe('carga y borrado', () => {
  const datos: ApoyoData = {
    alumnos: [alumno('a', { nivel: { etapa: 'primaria', curso: 2 } }), alumno('b')],
    grupos: [grupo('g', { alumnos: ['a', 'b'], horario: [{ dia: 0, inicio: '09:00', fin: '09:45' }] })],
    programas: [{ id: 'p', alumnoId: 'a', ambito: 'X', especialidad: 'PT', intensidad: 'alta', objetivos: [{ id: 'o', texto: 'T', trimestres: [2, 1], criterios: [{ materia: 'm', codigo: '1.1' }] }] }],
    sesiones: [{ id: 's', grupoId: 'g', fecha: '2026-10-05', temaClase: 'Fracciones', adaptaciones: { a: 'Fracciones con fichas' }, alumnos: [
      { alumnoId: 'a', objetivos: { o: 'si' }, respuesta: { atencion: 3 }, nota: 'Bien' },
      { alumnoId: 'b', ausente: true, objetivos: {}, respuesta: {}, nota: '' },
    ] }],
    documentos: [{ id: 'd', alumnoId: 'a', tipo: 'familia', trimestre: 1, fecha: '2026-12-15', titulo: 'Informe',
      apartados: [{ id: 'trabajado', titulo: 'Lo trabajado', texto: 'Texto' }] }],
  };

  it('lo guardado vuelve igual', () => {
    const vuelta = normalizarApoyo(JSON.parse(JSON.stringify(datos)));
    expect(vuelta.alumnos).toEqual(datos.alumnos);
    expect(vuelta.grupos).toEqual(datos.grupos);
    expect(vuelta.programas[0].objetivos[0].trimestres).toEqual([1, 2]);
    expect(vuelta.sesiones).toEqual(datos.sesiones);
    expect(vuelta.documentos).toEqual(datos.documentos);
  });

  it('descarta lo que no entiende en vez de romper', () => {
    expect(normalizarApoyo(undefined)).toEqual(APOYO_VACIO);
    expect(normalizarApoyo('basura')).toEqual(APOYO_VACIO);
    const raro = normalizarApoyo({
      alumnos: [{ id: 'a', nombre: 'Ana', nivel: { etapa: 'eso', curso: 9 } }, { nombre: 'sin id' }],
      grupos: [{ id: 'g', nombre: 'G', alumnos: ['a', 'fantasma'], horario: [{ dia: 6, inicio: '9', fin: '10' }] }],
      programas: [{ id: 'p', alumnoId: 'nadie', ambito: 'X' }],
      sesiones: [{ id: 's', grupoId: 'g', fecha: 'ayer', alumnos: [] }],
    });
    expect(raro.alumnos).toHaveLength(1);
    expect(raro.alumnos[0].nivel).toBeUndefined();
    expect(raro.grupos[0].alumnos).toEqual(['a']);
    expect(raro.grupos[0].horario).toEqual([]);
    expect(raro.programas).toEqual([]);
    expect(raro.sesiones).toEqual([]);
  });

  it('eliminar un alumno lo quita de grupos, programas y registros', () => {
    const d = sinAlumno(datos, 'a');
    expect(d.alumnos.map(a => a.id)).toEqual(['b']);
    expect(d.grupos[0].alumnos).toEqual(['b']);
    expect(d.programas).toEqual([]);
    expect(d.sesiones[0].alumnos.map(r => r.alumnoId)).toEqual(['b']);
    expect(d.documentos).toEqual([]);
    // Una sesión sin nadie desaparece
    expect(sinAlumno(d, 'b').sesiones).toEqual([]);
  });

  it('eliminar un grupo borra sus sesiones y deja al alumnado', () => {
    const d = sinGrupo(datos, 'g');
    expect(d.grupos).toEqual([]);
    expect(d.sesiones).toEqual([]);
    expect(d.alumnos).toHaveLength(2);
    expect(d.programas).toHaveLength(1);
  });
});
