import { describe, it, expect } from 'vitest';
import { clonarSda, clonarSesionEF, mismoNivel } from './clonar';
import type { Class, LearningSituation } from '../types';
import type { SesionEF } from '../types/ef';

const clase = (id: string, name: string, etapa?: 'primaria' | 'eso', curso?: number) =>
  ({ id, name, subject: 'EF', subjects: ['EF'], etapa, curso }) as Class;

const sda = {
  id: 'a', at: '2026-10-01T10:00:00.000Z', date: '2026-10-01', class_id: 'c1', class_name: '4º A', title: 'Los juegos del mundo',
  request: { idea: 'x', numero: '1', temporalizacion: '', meses: '', areas: ['EF'], numSesiones: 6, nivel: '', contextoClase: '', metodologia: '', etapa: 'primaria', curso: 4 },
  content: { titulo: 'Los juegos del mundo', sesiones: [{ titulo: 'Uno', fase: 'inicio', descripcion: 'd' }] },
} as unknown as LearningSituation;

describe('copiar a otras clases', () => {
  it('lo completado no se copia: cada clase empieza sus sesiones desde cero', () => {
    const hecha = { ...sda, content: { ...sda.content, sesiones: [{ titulo: 'Uno', fase: 'inicio', descripcion: 'd', completada: true }] } } as unknown as LearningSituation;
    expect(clonarSda(hecha, clase('c2', '4º B'), 'n').content.sesiones[0]).toEqual({ titulo: 'Uno', fase: 'inicio', descripcion: 'd' });
    expect(hecha.content.sesiones[0].completada).toBe(true);
    const ses = { id: 's', titulo: 'x', completada: true } as unknown as SesionEF;
    expect(clonarSesionEF(ses, clase('c2', '4º B'), 'n2').completada).toBeUndefined();
  });

  it('la situación de aprendizaje copiada es de la otra clase y no comparte nada con la original', () => {
    const c = clonarSda(sda, clase('c2', '4º B', 'primaria', 4), 'nueva', new Date(2026, 9, 18));
    expect(c).toMatchObject({ id: 'nueva', class_id: 'c2', class_name: '4º B', title: 'Los juegos del mundo', date: '2026-10-18' });
    expect(c.request).toMatchObject({ etapa: 'primaria', curso: 4, areas: ['EF'] });
    expect(c.content).toEqual(sda.content);
    (c.content.sesiones[0] as { titulo: string }).titulo = 'Cambiada';
    expect(sda.content.sesiones[0].titulo).toBe('Uno');
    expect(sda.class_id).toBe('c1');
  });

  it('si la clase de destino dice su curso, la petición lo toma de ella; si no, conserva el suyo', () => {
    expect(clonarSda(sda, clase('c3', '5º A', 'primaria', 5), 'n').request.curso).toBe(5);
    expect(clonarSda(sda, clase('c4', 'Otra'), 'n').request).toMatchObject({ etapa: 'primaria', curso: 4 });
  });

  const ses: SesionEF = {
    id: 's1', titulo: '1. Calentamos', claseId: 'c1', fecha: '2026-10-20', instalacionId: 'pab', objetivo: 'o', calentamiento: 'c', principal: 'p', calma: 'k',
    material: 'm', inclusion: 'i', planB: 'b', ia: true, modalidad: 'cooperacion', criterios: [{ materia: 'EF', codigo: '1.1' }],
  };

  it('la sesión copiada va a la otra clase, sin fecha, con todo lo demás', () => {
    const c = clonarSesionEF(ses, clase('c2', '4º B'), 'n');
    expect(c).toMatchObject({ id: 'n', claseId: 'c2', titulo: '1. Calentamos', instalacionId: 'pab', ia: true, modalidad: 'cooperacion' });
    expect(c.fecha).toBeUndefined();
    expect(c.criterios).toEqual(ses.criterios);
    expect(c.criterios).not.toBe(ses.criterios);
  });

  it('se puede conservar la fecha', () => {
    expect(clonarSesionEF(ses, clase('c2', '4º B'), 'n', true).fecha).toBe('2026-10-20');
    expect('fecha' in clonarSesionEF({ ...ses, fecha: undefined }, clase('c2', 'x'), 'n', true)).toBe(false);
  });

  it('dos clases son del mismo nivel si los dos conocen su curso y es el mismo', () => {
    expect(mismoNivel(clase('a', 'A', 'primaria', 4), clase('b', 'B', 'primaria', 4))).toBe(true);
    expect(mismoNivel(clase('a', 'A', 'primaria', 4), clase('b', 'B', 'eso', 4))).toBe(false);
    expect(mismoNivel(clase('a', 'A'), clase('b', 'B'))).toBe(false);
  });
});
