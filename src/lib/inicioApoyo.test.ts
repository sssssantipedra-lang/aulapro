import { describe, it, expect } from 'vitest';
import { avisosApoyo, evolucionDelTrimestre, serieDe, sesionesDeHoy } from './inicioApoyo';
import { APOYO_VACIO, bloquesDeApoyo, especialidadTexto, normalizarApoyo } from './apoyo';
import { buildDemoApoyo } from './demoApoyo';
import type { AlumnoApoyo, ApoyoData, GrupoApoyo, Logro, ProgramaApoyo, SesionApoyo } from '../types/apoyo';

const alumno = (id: string): AlumnoApoyo => ({
  id, nombre: `Alumno ${id}`, claseOrigen: '2º B', categorias: [], diagnostico: '', necesidades: '', notas: '',
});
// Lunes y miércoles
const grupo = (id: string, alumnos: string[], extra: Partial<GrupoApoyo> = {}): GrupoApoyo => ({
  id, nombre: `Grupo ${id}`, especialidad: 'PT', modalidad: 'fuera', color: '#000', alumnos,
  horario: [{ dia: 0, inicio: '09:00', fin: '09:45' }, { dia: 2, inicio: '11:00', fin: '11:45' }], ...extra,
});
const programa = (alumnoId: string, objetivos: string[]): ProgramaApoyo => ({
  id: `p-${alumnoId}`, alumnoId, ambito: 'Lectura', especialidad: 'PT',
  objetivos: objetivos.map(o => ({ id: o, texto: `Objetivo ${o}`, trimestres: [1], criterios: [] })),
});
const sesion = (grupoId: string, fecha: string, alumnoId: string, objetivos: Record<string, Logro> = {}): SesionApoyo => ({
  id: `${grupoId}-${fecha}`, grupoId, fecha, temaClase: 'Un tema',
  alumnos: [{ alumnoId, objetivos, respuesta: { atencion: 3 }, nota: '' }],
});
const datos = (extra: Partial<ApoyoData>): ApoyoData => ({
  ...APOYO_VACIO, ...extra,
});

// Lunes 5 de octubre de 2026, 1.er trimestre
const HOY = '2026-10-05';

describe('sesiones de hoy', () => {
  it('son los grupos con franja hoy, por hora, y si ya tienen algo anotado', () => {
    const d = datos({
      alumnos: [alumno('a')],
      grupos: [
        grupo('tarde', ['a'], { horario: [{ dia: 0, inicio: '12:00', fin: '12:45' }] }),
        grupo('manana', ['a']),
        grupo('martes', ['a'], { horario: [{ dia: 1, inicio: '09:00', fin: '09:45' }] }),
      ],
      sesiones: [sesion('tarde', HOY, 'a')],
    });
    const hoy = sesionesDeHoy(d, HOY);
    expect(hoy.map(s => s.grupo.id)).toEqual(['manana', 'tarde']);
    expect(hoy.map(s => s.registrada)).toEqual([false, true]);
    expect(hoy[0].franjas).toEqual([{ dia: 0, inicio: '09:00', fin: '09:45' }]);
  });
});

describe('avisos de seguimiento', () => {
  it('reclama las sesiones de la última semana sin registrar, pero no las de antes de empezar con el grupo', () => {
    // Registrado el lunes 28; el miércoles 30 se quedó sin registrar
    const d = datos({
      alumnos: [alumno('a')],
      grupos: [grupo('g', ['a']), grupo('nuevo', ['a'])],
      programas: [programa('a', ['o1'])],
      sesiones: [sesion('g', '2026-09-28', 'a', { o1: 'si' })],
    });
    const sin = avisosApoyo(d, HOY).filter(a => a.tipo === 'sin-registrar');
    expect(sin).toEqual([{ tipo: 'sin-registrar', grupo: d.grupos[0], fecha: '2026-09-30' }]);
  });

  it('avisa de un objetivo que lleva tres veces seguidas sin conseguirse', () => {
    const d = datos({
      alumnos: [alumno('a')],
      grupos: [grupo('g', ['a'])],
      programas: [programa('a', ['o1'])],
      sesiones: [
        sesion('g', '2026-09-21', 'a', { o1: 'no' }),
        sesion('g', '2026-09-23', 'a', { o1: 'no' }),
        sesion('g', '2026-09-28', 'a', { o1: 'no' }),
        sesion('g', '2026-09-30', 'a', { o1: 'no' }),
      ],
    });
    const atascado = avisosApoyo(d, HOY).find(a => a.tipo === 'atascado');
    expect(atascado).toMatchObject({ alumno: { id: 'a' }, objetivo: { id: 'o1' }, veces: 3 });
    // Con un «en proceso» en medio ya no
    d.sesiones[2].alumnos[0].objetivos.o1 = 'proceso';
    expect(avisosApoyo(d, HOY).some(a => a.tipo === 'atascado')).toBe(false);
  });

  it('avisa de un objetivo del trimestre sin trabajar tras tres sesiones, no antes', () => {
    const d = datos({
      alumnos: [alumno('a')],
      grupos: [grupo('g', ['a'])],
      programas: [programa('a', ['o1', 'o2'])],
      sesiones: [
        sesion('g', '2026-09-23', 'a', { o1: 'si' }),
        sesion('g', '2026-09-28', 'a', { o1: 'proceso' }),
      ],
    });
    expect(avisosApoyo(d, HOY).some(a => a.tipo === 'sin-trabajar')).toBe(false);
    d.sesiones.push(sesion('g', '2026-09-30', 'a', { o1: 'si' }));
    const sin = avisosApoyo(d, HOY).filter(a => a.tipo === 'sin-trabajar');
    expect(sin).toEqual([expect.objectContaining({ objetivo: expect.objectContaining({ id: 'o2' }), sesiones: 3 })]);
  });

  it('avisa del alumnado sin grupo y sin objetivos en el trimestre', () => {
    const d = datos({
      alumnos: [alumno('a'), alumno('b')],
      grupos: [grupo('g', ['a'])],
    });
    const tipos = avisosApoyo(d, HOY).map(a => [a.tipo, 'alumno' in a ? a.alumno.id : '']);
    expect(tipos).toEqual([['sin-objetivos', 'a'], ['sin-grupo', 'b']]);
  });

  it('al final del trimestre, los informes que faltan', () => {
    const d = datos({
      alumnos: [alumno('a'), alumno('b')],
      documentos: [{ id: 'd', alumnoId: 'a', tipo: 'familia', trimestre: 1, fecha: '2026-12-10', titulo: '', apartados: [] }],
    });
    expect(avisosApoyo(d, HOY).some(a => a.tipo === 'informes')).toBe(false);
    const fin = avisosApoyo(d, '2026-12-14').find(a => a.tipo === 'informes');
    expect(fin).toMatchObject({ trimestre: 1, alumnos: [{ id: 'b' }] });
  });
});

describe('evolución del alumnado', () => {
  it('cada objetivo del trimestre, con lo último registrado o sin trabajar', () => {
    const d = datos({
      alumnos: [alumno('a')],
      grupos: [grupo('g', ['a'])],
      programas: [programa('a', ['o1', 'o2', 'o3'])],
      sesiones: [
        sesion('g', '2026-09-28', 'a', { o1: 'no', o2: 'proceso' }),
        sesion('g', '2026-09-30', 'a', { o1: 'si' }),
        // Del curso anterior: no cuenta
        sesion('g', '2026-05-04', 'a', { o3: 'si' }),
      ],
    });
    const [ev] = evolucionDelTrimestre(d, 1);
    expect(ev.cuenta).toEqual({ si: 1, proceso: 1, no: 0, sin: 1 });
    expect(ev.sesiones).toBe(2);
    expect(ev.objetivos.find(o => o.objetivo.id === 'o1')?.serie).toEqual(['no', 'si']);
    expect(serieDe(d, 'a', 'o3')).toEqual(['si']);
  });
});

describe('perfil de PT y AL', () => {
  it('escribe su especialidad sola', () => {
    expect(especialidadTexto(['PT'])).toBe('Pedagogía Terapéutica');
    expect(especialidadTexto(['AL'])).toBe('Audición y Lenguaje');
    expect(especialidadTexto(['AL', 'PT'])).toBe('Pedagogía Terapéutica y Audición y Lenguaje');
  });

  it('el horario de los grupos pasa a la Agenda, de lunes (1) a viernes (5)', () => {
    const b = bloquesDeApoyo([grupo('g', [])]);
    expect(b.map(x => [x.day, x.time_start, x.time_end, x.subject])).toEqual([
      [1, '09:00', '09:45', 'Grupo g'], [3, '11:00', '11:45', 'Grupo g'],
    ]);
    expect(new Set(b.map(x => x.id)).size).toBe(2);
  });

  it('los datos de ejemplo son válidos y tienen sesiones recientes del trimestre en curso', () => {
    const demo = buildDemoApoyo(new Date(2026, 9, 5));
    expect(normalizarApoyo(JSON.parse(JSON.stringify(demo)))).toEqual(demo);
    expect(demo.alumnos.some(a => a.categorias.includes('Discapacidad motora'))).toBe(true);
    expect(demo.sesiones.length).toBeGreaterThan(5);
    expect(demo.sesiones.every(s => s.fecha < HOY && s.fecha >= '2026-09-01')).toBe(true);
    const ev = evolucionDelTrimestre(demo, 1);
    expect(ev.every(e => e.objetivos.length > 0)).toBe(true);
    expect(ev.some(e => e.cuenta.si > 0)).toBe(true);
  });
});
