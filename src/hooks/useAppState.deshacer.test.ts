// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppState } from './useAppState';
import { isoDate } from '../lib/utils';
import type { SesionEF } from '../types/ef';
import type { AlumnoApoyo, ProgramaApoyo } from '../types/apoyo';

/** El estado con los datos de ejemplo del docente de aula (clases, alumnado, cuaderno, evaluaciones, anotaciones). */
function conEjemplo() {
  const h = renderHook(() => useAppState());
  act(() => h.result.current.loadDemoData('es'));
  return h;
}

/** Lo que se guarda del perfil, para comparar el antes y el después de deshacer. */
function foto(st: ReturnType<typeof useAppState>) {
  const { classes, students, gradeCategories, gradeItems, grades, evaluations, attendance, reports, classMarks, marksConfigs,
    dianaProfiles, seatingPlans, rubrics, dianas, tasks, scheduleBlocks, calEvents, fichas, learningSituations, workSessions, apoyo, ef } = st;
  return { classes, students, gradeCategories, gradeItems, grades, evaluations, attendance, reports, classMarks, marksConfigs,
    dianaProfiles, seatingPlans, rubrics, dianas, tasks, scheduleBlocks, calEvents, fichas, learningSituations, workSessions, apoyo, ef };
}

describe('deshacer un borrado', () => {
  it('eliminar una clase se lleva su alumnado, su cuaderno y sus evaluaciones, y deshacer lo devuelve todo como estaba', () => {
    const { result } = conEjemplo();
    const antes = foto(result.current);
    const clase = antes.classes[0];
    const suyos = antes.students.filter(s => s.class_id === clase.id).length;
    expect(suyos).toBeGreaterThan(0);

    act(() => result.current.deleteClass(clase.id));
    expect(result.current.classes.some(c => c.id === clase.id)).toBe(false);
    expect(result.current.students.length).toBe(antes.students.length - suyos);
    expect(result.current.gradeItems.some(i => i.class_id === clase.id)).toBe(false);
    expect(result.current.borradoPendiente?.borrados).toEqual([{ tipo: 'clase', nombre: clase.name }]);

    let hecho = false;
    act(() => { hecho = result.current.deshacerBorrado(); });
    expect(hecho).toBe(true);
    expect(result.current.borradoPendiente).toBeNull();
    const despues = foto(result.current);
    expect(despues).toEqual(antes);
    // No es una reconstrucción: son las mismas colecciones de antes
    expect(despues.classes).toBe(antes.classes);
    expect(despues.grades).toBe(antes.grades);
    expect(despues.evaluations).toBe(antes.evaluations);
    expect(despues.gradeItems).toBe(antes.gradeItems);
  });

  it('eliminar un alumno se lleva sus notas, evaluaciones y anotaciones, y deshacer las devuelve', () => {
    const { result } = conEjemplo();
    const antes = foto(result.current);
    const alumno = antes.students.find(s => antes.evaluations.some(e => e.student_id === s.id) && antes.classMarks.some(m => m.student_id === s.id))!;
    expect(alumno).toBeTruthy();

    act(() => result.current.deleteStudent(alumno.id));
    expect(result.current.evaluations.some(e => e.student_id === alumno.id)).toBe(false);
    expect(result.current.classMarks.some(m => m.student_id === alumno.id)).toBe(false);
    expect(Object.values(result.current.grades).some(fila => alumno.id in fila)).toBe(false);
    expect(result.current.borradoPendiente?.borrados[0]).toEqual({ tipo: 'alumno', nombre: alumno.name });

    act(() => { result.current.deshacerBorrado(); });
    expect(foto(result.current)).toEqual(antes);
  });

  it('una columna del cuaderno vuelve con sus notas, y una categoría, con sus columnas', () => {
    const { result } = conEjemplo();
    const antes = foto(result.current);
    const columna = antes.gradeItems.find(i => Object.keys(antes.grades[i.id] ?? {}).length > 0)!;

    act(() => result.current.deleteGradeItem(columna.id));
    expect(result.current.grades[columna.id]).toBeUndefined();
    expect(result.current.borradoPendiente?.borrados[0]).toEqual({ tipo: 'columna', nombre: columna.name });
    act(() => { result.current.deshacerBorrado(); });
    expect(result.current.grades[columna.id]).toBe(antes.grades[columna.id]);
    expect(foto(result.current)).toEqual(antes);

    const categoria = antes.gradeCategories.find(c => c.id === columna.category_id)!;
    act(() => result.current.deleteGradeCategory(categoria.id));
    expect(result.current.gradeItems.some(i => i.category_id === categoria.id)).toBe(false);
    expect(result.current.borradoPendiente?.borrados[0]).toEqual({ tipo: 'categoria', nombre: categoria.name });
    act(() => { result.current.deshacerBorrado(); });
    expect(foto(result.current)).toEqual(antes);
  });

  it('una rúbrica, una evaluación y una tarea', () => {
    const { result } = conEjemplo();
    act(() => result.current.addTask('Preparar la salida', 'high'));
    const antes = foto(result.current);

    act(() => result.current.deleteRubric(antes.rubrics[0].id));
    expect(result.current.borradoPendiente?.borrados[0].tipo).toBe('rubrica');
    act(() => { result.current.deshacerBorrado(); });
    expect(result.current.rubrics).toBe(antes.rubrics);

    const ev = antes.evaluations[0];
    act(() => result.current.deleteEvaluation(ev.id));
    expect(result.current.borradoPendiente?.borrados[0]).toEqual({ tipo: 'evaluacion', nombre: ev.student_name });
    act(() => { result.current.deshacerBorrado(); });
    expect(foto(result.current)).toEqual(antes);

    act(() => result.current.deleteTask(antes.tasks[0].id));
    expect(result.current.borradoPendiente?.borrados[0]).toEqual({ tipo: 'tarea', nombre: 'Preparar la salida' });
    act(() => { result.current.deshacerBorrado(); });
    expect(result.current.tasks).toBe(antes.tasks);
  });

  it('solo se puede deshacer el último borrado', () => {
    const { result } = conEjemplo();
    const antes = foto(result.current);
    act(() => result.current.deleteRubric(antes.rubrics[0].id));
    const id1 = result.current.borradoPendiente!.id;
    act(() => result.current.deleteClass(antes.classes[0].id));
    expect(result.current.borradoPendiente!.id).not.toBe(id1);
    expect(result.current.borradoPendiente!.borrados[0].tipo).toBe('clase');

    act(() => { result.current.deshacerBorrado(); });
    // Vuelve la clase; la rúbrica borrada antes sigue borrada
    expect(result.current.classes).toBe(antes.classes);
    expect(result.current.rubrics.length).toBe(antes.rubrics.length - 1);
    let otraVez = true;
    act(() => { otraVez = result.current.deshacerBorrado(); });
    expect(otraVez).toBe(false);
  });

  it('si después se cambia algo de lo que el borrado tocó, el aviso se retira (reponer lo de antes se llevaría el cambio)', () => {
    const { result } = conEjemplo();
    const antes = foto(result.current);
    const columna = antes.gradeItems[0];
    const otra = antes.gradeItems.find(i => i.id !== columna.id)!;
    act(() => result.current.deleteGradeItem(columna.id));
    expect(result.current.borradoPendiente).not.toBeNull();
    // Poner una nota en otra columna cambia las notas, que el borrado también cambió
    act(() => result.current.setGrade(otra.id, antes.students[0].id, 9));
    expect(result.current.borradoPendiente).toBeNull();
    let hecho = true;
    act(() => { hecho = result.current.deshacerBorrado(); });
    expect(hecho).toBe(false);
    expect(result.current.grades[otra.id][antes.students[0].id]).toBe(9);
  });

  it('un cambio en otra cosa no lo impide, y se conserva al deshacer', () => {
    const { result } = conEjemplo();
    const antes = foto(result.current);
    act(() => result.current.deleteRubric(antes.rubrics[0].id));
    act(() => result.current.addTask('Otra cosa', 'low'));
    expect(result.current.borradoPendiente).not.toBeNull();
    act(() => { result.current.deshacerBorrado(); });
    expect(result.current.rubrics).toBe(antes.rubrics);
    expect(result.current.tasks.some(t => t.text === 'Otra cosa')).toBe(true);
  });

  it('pasado el aviso ya no se puede deshacer', () => {
    const { result } = conEjemplo();
    act(() => result.current.deleteRubric(result.current.rubrics[0].id));
    act(() => result.current.olvidarBorrado());
    expect(result.current.borradoPendiente).toBeNull();
    let hecho = true;
    act(() => { hecho = result.current.deshacerBorrado(); });
    expect(hecho).toBe(false);
  });

  it('borrar algo que no existe no deja aviso', () => {
    const { result } = conEjemplo();
    act(() => result.current.deleteRubric('no-existe'));
    expect(result.current.borradoPendiente).toBeNull();
    act(() => result.current.deleteFicha('no-existe'));
    expect(result.current.borradoPendiente).toBeNull();
  });

  it('varios borrados en el mismo gesto se deshacen a la vez', () => {
    const { result } = conEjemplo();
    const antes = foto(result.current);
    act(() => { result.current.deleteRubric(antes.rubrics[0].id); result.current.deleteRubric(antes.rubrics[1].id); });
    expect(result.current.rubrics.length).toBe(antes.rubrics.length - 2);
    expect(result.current.borradoPendiente?.borrados.length).toBe(2);
    act(() => { result.current.deshacerBorrado(); });
    expect(result.current.rubrics).toBe(antes.rubrics);
  });

  it('queda anotado en el registro de cambios, que no vuelve atrás', () => {
    const { result } = conEjemplo();
    const clase = result.current.classes[0];
    act(() => result.current.deleteClass(clase.id));
    act(() => { result.current.deshacerBorrado(); });
    const [ultima, anterior] = result.current.auditLog;
    expect(ultima.what).toBe('Deshizo un borrado');
    expect(ultima.detail).toBe(`Has eliminado la clase «${clase.name}» y todo lo suyo.`);
    expect(anterior.action).toBe('delete');
  });

  it('quitar una anotación de hoy no lleva aviso (es corregir un toque); la de otro día, sí', () => {
    const { result } = conEjemplo();
    const alumno = result.current.students[0];
    act(() => result.current.addClassMark({ id: 'm-hoy', class_id: alumno.class_id, student_id: alumno.id, type: 'behavior-good', date: isoDate() }, 'Positivo'));
    act(() => result.current.addClassMark({ id: 'm-ayer', class_id: alumno.class_id, student_id: alumno.id, type: 'behavior-good', date: '2026-01-15' }, 'Positivo'));
    act(() => result.current.deleteClassMark('m-hoy', 'Positivo'));
    expect(result.current.classMarks.some(m => m.id === 'm-hoy')).toBe(false);
    expect(result.current.borradoPendiente).toBeNull();
    act(() => result.current.deleteClassMark('m-ayer', 'Positivo'));
    expect(result.current.borradoPendiente?.borrados[0]).toEqual({ tipo: 'anotacion', nombre: alumno.name });
    act(() => { result.current.deshacerBorrado(); });
    expect(result.current.classMarks.some(m => m.id === 'm-ayer')).toBe(true);
  });

  it('vaciar el horario entero se puede deshacer; sustituirlo por otro no avisa', () => {
    const { result } = conEjemplo();
    const antes = result.current.scheduleBlocks;
    expect(antes.length).toBeGreaterThan(1);
    act(() => result.current.replaceBlocks([antes[0]]));
    expect(result.current.borradoPendiente).toBeNull();
    act(() => result.current.replaceBlocks(antes));
    act(() => result.current.replaceBlocks([]));
    expect(result.current.borradoPendiente?.borrados).toEqual([{ tipo: 'horario' }]);
    act(() => { result.current.deshacerBorrado(); });
    expect(result.current.scheduleBlocks).toBe(antes);
  });
});

describe('deshacer en Educación Física y en PT y AL', () => {
  const sesion = (id: string, titulo: string) => ({ id, titulo }) as unknown as SesionEF;

  it('borrar una sesión desde su pantalla (con setEf) deja el aviso y se deshace', () => {
    const { result } = conEjemplo();
    act(() => result.current.setEf(d => ({ ...d, sesiones: [sesion('s1', 'Saltos'), sesion('s2', 'Giros')] })));
    expect(result.current.borradoPendiente).toBeNull();
    const antes = result.current.ef;

    act(() => result.current.setEf(d => ({ ...d, sesiones: d.sesiones.filter(s => s.id !== 's1') })));
    expect(result.current.ef.sesiones.map(s => s.id)).toEqual(['s2']);
    expect(result.current.borradoPendiente?.borrados).toEqual([{ tipo: 'sesion', nombre: 'Saltos' }]);
    act(() => { result.current.deshacerBorrado(); });
    expect(result.current.ef).toBe(antes);
  });

  it('guardar o marcar como dada una sesión no deja aviso', () => {
    const { result } = conEjemplo();
    act(() => result.current.setEf(d => ({ ...d, sesiones: [sesion('s1', 'Saltos')] })));
    act(() => result.current.setEf(d => ({ ...d, sesiones: d.sesiones.map(s => ({ ...s, completada: true })) })));
    expect(result.current.borradoPendiente).toBeNull();
  });

  it('borrar varias sesiones de una vez', () => {
    const { result } = conEjemplo();
    act(() => result.current.setEf(d => ({ ...d, sesiones: [sesion('s1', 'A'), sesion('s2', 'B'), sesion('s3', 'C')] })));
    act(() => result.current.setEf(d => ({ ...d, sesiones: d.sesiones.filter(s => s.id === 's3') })));
    expect(result.current.borradoPendiente?.borrados).toEqual([{ tipo: 'sesion', cuantos: 2 }]);
    act(() => { result.current.deshacerBorrado(); });
    expect(result.current.ef.sesiones.length).toBe(3);
  });

  it('PT y AL: un alumno de apoyo vuelve con sus programas', () => {
    const { result } = conEjemplo();
    const alumno = { id: 'x1', nombre: 'Alumno 1' } as unknown as AlumnoApoyo;
    const programa = { id: 'pr1', alumnoId: 'x1', ambito: 'Lectoescritura', objetivos: [] } as unknown as ProgramaApoyo;
    act(() => result.current.setApoyo(d => ({ ...d, alumnos: [alumno], programas: [programa] })));
    const antes = result.current.apoyo;

    act(() => result.current.setApoyo(d => ({ ...d, alumnos: [], programas: [] })));
    expect(result.current.borradoPendiente?.borrados).toEqual([{ tipo: 'alumno', nombre: 'Alumno 1' }]);
    act(() => { result.current.deshacerBorrado(); });
    expect(result.current.apoyo).toBe(antes);
    expect(result.current.apoyo.programas[0].ambito).toBe('Lectoescritura');
  });
});
