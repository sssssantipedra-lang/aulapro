import { describe, it, expect } from 'vitest';
import { semanaConAlgo, semanaDe } from './semana';
import type { CalEvent, Class } from '../types';
import type { SesionEF } from '../types/ef';

const clases = [{ id: 'c1', name: '5º A', color: '#f00' }] as Class[];
const sesion = (id: string, fecha: string | undefined, extra: Partial<SesionEF> = {}): SesionEF =>
  ({ id, titulo: `Sesión ${id}`, claseId: 'c1', fecha, objetivo: '', calentamiento: '', principal: '', calma: '', material: '', inclusion: '', planB: '', ...extra }) as SesionEF;
const evento = (id: string, date: string, time = ''): CalEvent => ({ id, name: id, date, time, type: 'meeting', urgency: 'media', color: '', desc: '' });

const sesiones = [
  sesion('pasada-hecha', '2026-11-10', { completada: true }), sesion('pasada', '2026-11-12'), sesion('archivada', '2026-11-11', { archivada: true }),
  sesion('lunes', '2026-11-16'), sesion('viernes', '2026-11-20'), sesion('otra-semana', '2026-11-25'), sesion('sin-fecha', undefined),
];
const calEvents = [evento('claustro', '2026-11-19', '17:00'), evento('entrega', '2026-11-19', '09:00'), evento('lejos', '2026-12-02')];

describe('Tu semana', () => {
  it('de lunes a viernes, la semana en curso: sus sesiones, sus eventos y lo que quedó de la anterior', () => {
    const s = semanaDe({ sesiones, calEvents, classes: clases, hoy: '2026-11-18' });   // miércoles
    expect(s).toMatchObject({ desde: '2026-11-16', hasta: '2026-11-22', proxima: false });
    expect(s.sesiones.map(x => x.id)).toEqual(['lunes', 'viernes']);
    expect(s.sesiones[0]).toMatchObject({ clase: '5º A', color: '#f00', completada: false });
    expect(s.eventos.map(e => e.id)).toEqual(['entrega', 'claustro']);
    // De la semana anterior, lo no completado; lo archivado no cuenta
    expect(s.pendientes.map(x => x.id)).toEqual(['pasada']);
  });

  it('el sábado y el domingo, la semana que viene; lo pendiente es lo de la que acaba', () => {
    const s = semanaDe({ sesiones, calEvents, classes: clases, hoy: '2026-11-21' });   // sábado
    expect(s).toMatchObject({ desde: '2026-11-23', hasta: '2026-11-29', proxima: true });
    expect(s.sesiones.map(x => x.id)).toEqual(['otra-semana']);
    expect(s.pendientes.map(x => x.id)).toEqual(['lunes', 'viernes']);
    expect(semanaDe({ sesiones, calEvents, classes: clases, hoy: '2026-11-22' }).desde).toBe('2026-11-23');   // domingo
  });

  it('el lunes empieza la semana; sin nada, se sabe', () => {
    expect(semanaDe({ sesiones: [], calEvents: [], classes: clases, hoy: '2026-11-16' })).toMatchObject({ desde: '2026-11-16', proxima: false });
    expect(semanaConAlgo(semanaDe({ sesiones: [], calEvents: [], classes: clases, hoy: '2026-11-16' }))).toBe(false);
    expect(semanaConAlgo(semanaDe({ sesiones, calEvents, classes: clases, hoy: '2026-11-18' }))).toBe(true);
  });
});
