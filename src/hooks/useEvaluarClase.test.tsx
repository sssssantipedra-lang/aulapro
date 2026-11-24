// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEvaluarClase } from './useEvaluarClase';
import type { Class, Evaluation, Student } from '../types';
import type { Marcado } from '../lib/evaluarClase';
import { isoDate } from '../lib/utils';

const hoy = isoDate();
const classes = [{ id: 'c1', name: '1º A', subject: 'Lengua' }, { id: 'c2', name: '1º B', subject: 'Lengua' }] as Class[];
// Fuera de orden a propósito: la lista va en orden de lista
const students = [
  { id: 's3', name: 'Alumno 3', class_id: 'c1' }, { id: 's1', name: 'Alumno 1', class_id: 'c1' },
  { id: 's2', name: 'Alumno 2', class_id: 'c1' }, { id: 's9', name: 'Alumno 9', class_id: 'c2' },
] as Student[];
const rubrica = { id: 'r1', name: 'Exposición oral', class_id: 'c1' };
const ids = ['a', 'b'];
const ev = (p: Partial<Evaluation>): Evaluation => ({
  id: 'e1', rubric_id: 'r1', rubric_name: 'Exposición oral', student_id: 's1', student_name: 'Alumno 1',
  class_id: 'c1', date: hoy, scores: { a: 3, b: 3 }, notes: '', instrument: 'rubric', grade: 7.5, ...p,
});

function montar(evaluations: Evaluation[] = [], mas: { corrigiendo?: Evaluation; sinUpdate?: boolean } = {}) {
  const onSave = vi.fn(), onUpdate = vi.fn(), onClose = vi.fn();
  let n = 0;
  const construir = (alumno: { id: string; name: string }, clase: string, m: Marcado): Evaluation => ({
    id: 'nueva' + (++n), rubric_id: 'r1', rubric_name: 'Exposición oral', student_id: alumno.id, student_name: alumno.name,
    class_id: clase, date: hoy, scores: m.scores, notes: m.notes, instrument: 'rubric', grade: Object.values(m.scores).reduce((a, b) => a + b, 0),
  });
  const h = renderHook(({ evs }) => useEvaluarClase({
    open: true, instrumento: rubrica, tipo: 'rubric', ids, classes, students, evaluations: evs, corrigiendo: mas.corrigiendo,
    construir, onSave, onUpdate: mas.sinUpdate ? undefined : onUpdate, onClose,
  }), { initialProps: { evs: evaluations } });
  return { h, onSave, onUpdate, onClose };
}

afterEach(() => vi.restoreAllMocks());

describe('useEvaluarClase', () => {
  it('abre con la clase del instrumento, el alumnado en orden de lista y el primero que falta elegido', () => {
    const { h } = montar([ev({ student_id: 's1', date: '2026-01-10' })]);
    const c = h.result.current;
    expect(c.classId).toBe('c1');
    expect(c.filas.map(f => f.id)).toEqual(['s1', 's2', 's3']);
    expect(c.filas.map(f => f.estado)).toEqual(['antes', 'pendiente', 'pendiente']);
    expect(c.hechos).toBe(1);
    expect(c.studentId).toBe('s2');
  });

  it('«Guardar y siguiente» guarda una evaluación nueva y pasa al siguiente sin cerrar', () => {
    const { h, onSave, onClose } = montar();
    act(() => h.result.current.setScores({ a: 4, b: 2 }));
    expect(h.result.current.hayQueGuardar).toBe(true);
    act(() => { h.result.current.guardarYSeguir(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ student_id: 's1', class_id: 'c1', scores: { a: 4, b: 2 } });
    expect(onSave.mock.calls[0][1]).toBeUndefined();
    expect(onClose).not.toHaveBeenCalled();
    expect(h.result.current.studentId).toBe('s2');
  });

  it('lo marcado a un alumno se conserva al pasar a otro, aunque no esté guardado', () => {
    const { h } = montar();
    act(() => h.result.current.setScores({ a: 2 }));
    act(() => h.result.current.elegirAlumno('s3'));
    expect(h.result.current.scores).toEqual({});
    expect(h.result.current.sinGuardar).toEqual(['s1']);
    act(() => h.result.current.elegirAlumno('s1'));
    expect(h.result.current.scores).toEqual({ a: 2 });
  });

  it('al entrar en un alumno evaluado hoy carga lo marcado y, al guardar, corrige esa evaluación sin crear otra', () => {
    const { h, onSave, onUpdate } = montar([ev({ id: 'deHoy', student_id: 's1', scores: { a: 3, b: 3 }, notes: 'Bien' })]);
    act(() => h.result.current.elegirAlumno('s1'));
    expect(h.result.current.scores).toEqual({ a: 3, b: 3 });
    expect(h.result.current.notes).toBe('Bien');
    expect(h.result.current.corrige?.id).toBe('deHoy');
    // Sin cambios no hay nada que guardar
    expect(h.result.current.hayQueGuardar).toBe(false);
    act(() => h.result.current.setScores(p => ({ ...p, a: 1 })));
    act(() => { h.result.current.guardarYSeguir(); });
    expect(onSave).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0]).toMatchObject({ id: 'deHoy', date: hoy, student_id: 's1', scores: { a: 1, b: 3 }, notes: 'Bien' });
  });

  it('«Es otro trabajo» empieza en blanco y guarda una evaluación nueva diciendo que no es una corrección', () => {
    const { h, onSave, onUpdate } = montar([ev({ id: 'deHoy', student_id: 's1' })]);
    act(() => h.result.current.elegirAlumno('s1'));
    act(() => { h.result.current.otroTrabajo(); });
    expect(h.result.current.scores).toEqual({});
    expect(h.result.current.esOtroTrabajo).toBe(true);
    act(() => h.result.current.setScores({ a: 2, b: 2 }));
    act(() => { h.result.current.guardarYSeguir(); });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onSave.mock.calls[0][1]).toEqual({ otroTrabajo: true });
  });

  it('una evaluación de otro día no se toca: se guarda una nueva, salvo que se elija corregirla', () => {
    const vieja = ev({ id: 'vieja', student_id: 's1', date: '2026-01-10', scores: { a: 1, b: 1 } });
    const { h, onSave, onUpdate } = montar([vieja]);
    act(() => h.result.current.elegirAlumno('s1'));
    expect(h.result.current.scores).toEqual({});
    expect(h.result.current.corrige).toBeUndefined();
    act(() => { h.result.current.corregirAnterior(); });
    expect(h.result.current.scores).toEqual({ a: 1, b: 1 });
    act(() => h.result.current.setScores({ a: 4, b: 4 }));
    act(() => { h.result.current.guardarYSeguir(); });
    expect(onSave).not.toHaveBeenCalled();
    // Conserva su fecha: es la misma evaluación, corregida
    expect(onUpdate.mock.calls[0][0]).toMatchObject({ id: 'vieja', date: '2026-01-10', scores: { a: 4, b: 4 } });
  });

  it('al volver a evaluar a una clase ya evaluada otro día, cuentan las de hoy y «Guardar y siguiente» recorre a quien no está evaluado hoy', () => {
    const antes = ['s1', 's2', 's3'].map(id => ev({ id: 'v' + id, student_id: id, date: '2026-01-10' }));
    const { h, onSave } = montar(antes);
    // Nadie está hecho en esta vuelta: se empieza por el primero de la lista, con evaluación nueva
    expect(h.result.current.rondaNueva).toBe(true);
    expect(h.result.current.hechos).toBe(0);
    expect(h.result.current.filas.map(f => f.hecho)).toEqual([false, false, false]);
    expect(h.result.current.studentId).toBe('s1');
    expect(h.result.current.corrige).toBeUndefined();
    expect(h.result.current.siguienteId).toBe('s2');
    act(() => h.result.current.setScores({ a: 2, b: 2 }));
    act(() => { h.result.current.guardarYSeguir(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(h.result.current.studentId).toBe('s2');
    // Quien ya está evaluado hoy se salta y cuenta
    h.rerender({ evs: [ev({ id: 'hoy1', student_id: 's1' }), ev({ id: 'hoy3', student_id: 's3' }), ...antes] });
    expect(h.result.current.siguienteId).toBeUndefined();
    expect(h.result.current.hechos).toBe(2);
    expect(h.result.current.rondaNueva).toBe(true);
  });

  it('al volver a evaluar a la clase, «Poner a todos este nivel» alcanza a quien no está evaluado hoy y crea evaluaciones nuevas', () => {
    const antes = ['s1', 's2', 's3'].map(id => ev({ id: 'v' + id, student_id: id, date: '2026-01-10' }));
    const { h, onSave, onUpdate } = montar([ev({ id: 'hoy2', student_id: 's2' }), ...antes]);
    expect(h.result.current.rondaNueva).toBe(true);
    expect(h.result.current.hechos).toBe(1);
    expect(h.result.current.paraTodos).toBe(2);
    act(() => h.result.current.ponerATodos(3));
    expect(h.result.current.sinGuardar).toEqual(['s1', 's3']);
    act(() => { h.result.current.guardarTodos(); });
    // Las de otro día no se tocan: son dos evaluaciones más
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onSave.mock.calls.map(c => c[0].student_id)).toEqual(['s1', 's3']);
  });

  it('con toda la clase evaluada hoy no es una vuelta nueva: no se elige a nadie y no hay a quién poner un nivel', () => {
    const { h } = montar(['s1', 's2', 's3'].map(id => ev({ id: 'h' + id, student_id: id })));
    expect(h.result.current.rondaNueva).toBe(false);
    expect(h.result.current.hechos).toBe(3);
    expect(h.result.current.studentId).toBe('');
    expect(h.result.current.paraTodos).toBe(0);
  });

  it('con alguien sin evaluar se sigue en la primera vuelta: quien se evaluó otro día cuenta como hecho', () => {
    const { h } = montar([ev({ id: 'v1', student_id: 's1', date: '2026-01-10' }), ev({ id: 'v2', student_id: 's2', date: '2026-01-11' })]);
    expect(h.result.current.rondaNueva).toBe(false);
    expect(h.result.current.hechos).toBe(2);
    expect(h.result.current.studentId).toBe('s3');
    expect(h.result.current.paraTodos).toBe(1);
  });

  it('al corregir una evaluación hecha con otra escala o con criterios que ya no están, lo que no vale se queda sin marcar', () => {
    // Se evaluó con cinco niveles y un criterio «z» que la rúbrica ya no tiene; ahora la escala llega a 4
    const vieja = ev({ id: 'vieja', scores: { a: 5, b: 3, z: 2 }, date: '2026-01-10' });
    const onUpdate = vi.fn();
    const h = renderHook(() => useEvaluarClase({
      open: true, instrumento: rubrica, tipo: 'rubric', ids, niveles: [1, 2, 3, 4], classes, students, evaluations: [vieja], corrigiendo: vieja,
      construir: (alumno, clase, m) => ev({ id: 'x', student_id: alumno.id, class_id: clase, scores: m.scores }),
      onSave: vi.fn(), onUpdate, onClose: vi.fn(),
    }));
    expect(h.result.current.scores).toEqual({ b: 3 });
    expect(h.result.current.hayQueGuardar).toBe(false);
    act(() => h.result.current.setScores(p => ({ ...p, a: 4 })));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    act(() => { h.result.current.guardarYSeguir(); });
    expect(onUpdate.mock.calls[0][0]).toMatchObject({ id: 'vieja', date: '2026-01-10', scores: { a: 4, b: 3 } });
  });

  it('«Poner a todos este nivel» deja un punto de partida a quien falta y «Guardar todo» los guarda de una vez', () => {
    const { h, onSave } = montar([ev({ student_id: 's1', date: '2026-01-10' })]);
    // s2 ya tiene lo suyo marcado: es una excepción y no se pisa
    act(() => h.result.current.setScores({ a: 1 }));
    expect(h.result.current.paraTodos).toBe(1);
    act(() => h.result.current.ponerATodos(3));
    expect(h.result.current.nivelDeTodos).toBe(3);
    expect(h.result.current.sinGuardar).toEqual(['s2', 's3']);
    act(() => h.result.current.elegirAlumno('s3'));
    expect(h.result.current.scores).toEqual({ a: 3, b: 3 });
    // Cambiar de nivel solo cambia lo puesto a todos y aún sin tocar
    act(() => h.result.current.ponerATodos(4));
    expect(h.result.current.scores).toEqual({ a: 4, b: 4 });
    vi.spyOn(window, 'confirm').mockReturnValue(true);   // s2 tiene un criterio sin marcar
    act(() => { h.result.current.guardarTodos(); });
    expect(onSave.mock.calls.map(c => [c[0].student_id, c[0].scores])).toEqual([['s2', { a: 1 }], ['s3', { a: 4, b: 4 }]]);
    expect(h.result.current.sinGuardar).toEqual([]);
  });

  it('«Quitar el nivel puesto a todos» respeta a quien ya se ha retocado', () => {
    const { h } = montar();
    act(() => h.result.current.ponerATodos(2));
    act(() => h.result.current.elegirAlumno('s2'));
    act(() => h.result.current.setScores(p => ({ ...p, a: 4 })));
    act(() => h.result.current.quitarDeTodos());
    expect(h.result.current.sinGuardar).toEqual(['s2']);
    expect(h.result.current.nivelDeTodos).toBeNull();
  });

  it('con criterios sin marcar pregunta antes de guardar, y no guarda si el docente prefiere seguir', () => {
    const { h, onSave } = montar();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    act(() => h.result.current.setScores({ a: 2 }));
    act(() => { h.result.current.guardarYSeguir(); });
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    expect(h.result.current.studentId).toBe('s1');
  });

  it('al cerrar o cambiar de clase con marcas sin guardar pregunta antes de perderlas', () => {
    const { h, onClose } = montar();
    act(() => h.result.current.setScores({ a: 2, b: 2 }));
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    act(() => h.result.current.cerrar());
    expect(onClose).not.toHaveBeenCalled();
    confirmar.mockReturnValue(true);
    act(() => h.result.current.cerrar());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('corrigiendo desde el Historial abre esa evaluación, sin lista, y al guardar la actualiza y cierra', () => {
    const vieja = ev({ id: 'vieja', student_id: 's3', student_name: 'Alumno 3', date: '2026-01-10', scores: { a: 2, b: 2 } });
    const { h, onSave, onUpdate, onClose } = montar([vieja, ev({ id: 'otra', student_id: 's3', date: '2026-02-01' })], { corrigiendo: vieja });
    const c = h.result.current;
    expect(c.enClase).toBe(false);
    expect(c.studentId).toBe('s3');
    expect(c.scores).toEqual({ a: 2, b: 2 });
    expect(c.hayQueGuardar).toBe(false);
    act(() => h.result.current.setNotes('Corregida'));
    act(() => { h.result.current.guardarYSeguir(); });
    expect(onSave).not.toHaveBeenCalled();
    expect(onUpdate.mock.calls[0][0]).toMatchObject({ id: 'vieja', date: '2026-01-10', notes: 'Corregida', scores: { a: 2, b: 2 } });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sin forma de actualizar, una corrección va por el guardado de siempre (y la pantalla pregunta si sustituye)', () => {
    const { h, onSave } = montar([ev({ id: 'deHoy', student_id: 's1' })], { sinUpdate: true });
    act(() => h.result.current.elegirAlumno('s1'));
    act(() => h.result.current.setScores({ a: 1, b: 1 }));
    act(() => { h.result.current.guardarYSeguir(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][1]).toBeUndefined();
  });
});
