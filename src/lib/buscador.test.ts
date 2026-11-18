import { describe, it, expect } from 'vitest';
import { buscar, encaje, normalizar, pantallasDe, MAX_POR_TIPO, type DatosDelBuscador } from './buscador';
import { navGroupsFor } from './navigation';
import type { Class, EvalDiana, Ficha, LearningSituation, Rubric, Student } from '../types';

const t = (k: string) => k;
const clase = (id: string, name: string): Class => ({ id, name, subject: 'Matemáticas', subjects: ['Matemáticas'], isTutoria: false, room: '', color: '#000' } as Class);
const alumno = (id: string, name: string, class_id = 'c1'): Student => ({ id, class_id, name, email: '', photo: null, alerts: [], notes: '' });

const datos: DatosDelBuscador = {
  menu: navGroupsFor('aula'),
  classes: [clase('c1', '5º Primaria A'), clase('c2', '1º ESO B')],
  students: [alumno('a1', 'Alumno 1'), alumno('a2', 'Alumno 12'), alumno('a3', 'Rubén Díaz', 'c2')],
  rubrics: [{ id: 'r1', name: 'Exposición oral', class_id: 'c1', criteria: [] } as Rubric],
  dianas: [
    { id: 'd1', name: 'Trabajo en equipo', items: [] } as unknown as EvalDiana,
    { id: 'd2', name: 'Trae el material', tipo: 'registro', items: [] } as unknown as EvalDiana,
  ],
  learningSituations: [{ id: 's1', title: 'Un mercado sostenible', class_name: '5º Primaria A' } as LearningSituation],
  fichas: [{ id: 'f1', title: 'El ciclo del agua', class_name: '5º Primaria A' } as Ficha],
  conAula: true, ef: false,
};
const ids = (q: string, d = datos) => buscar(q, d, t).map(r => `${r.tipo}:${r.id}`);

describe('el buscador general', () => {
  it('sin tildes ni mayúsculas', () => {
    expect(normalizar('  RÚBRICAS  ')).toBe('rubricas');
    expect(ids('rubricas')).toContain('pantalla:rubrics');
    expect(ids('ruben')).toEqual(['alumno:a3']);
  });

  it('encuentra pantallas (también las pestañas de un apartado), clases, alumnado, instrumentos, SdA y fichas', () => {
    expect(ids('asist')).toEqual(['pantalla:attendance']);
    expect(buscar('actas', datos, t)[0]).toMatchObject({ tipo: 'pantalla', id: 'records', detalle: 'Documentos', section: 'records' });
    expect(ids('eso')).toContain('clase:c2');
    expect(ids('exposi')).toEqual(['rubrica:r1']);
    expect(ids('equipo')).toContain('diana:d1');
    expect(buscar('material', datos, t).find(r => r.id === 'd2')).toMatchObject({ tipo: 'escala', section: 'registros' });
    expect(buscar('mercado', datos, t)[0]).toMatchObject({ tipo: 'sda', section: 'learning-situations' });
    expect(buscar('agua', datos, t)[0]).toMatchObject({ tipo: 'ficha', section: 'resources' });
  });

  it('con varias palabras, todas tienen que estar; la clase del alumno también cuenta', () => {
    expect(ids('alumno eso')).toEqual([]);
    expect(ids('ruben eso')).toEqual(['alumno:a3']);
  });

  it('lo que empieza por lo escrito va antes que lo que solo lo contiene', () => {
    expect(encaje('Rúbricas', '', ['rub'])).toBe(3);
    expect(encaje('Evaluar por rúbricas', '', ['rub'])).toBe(2);
    expect(encaje('Subrubro', '', ['rub'])).toBe(1);
    expect(encaje('Otra cosa', '', ['rub'])).toBe(0);
  });

  it('como mucho cinco de cada tipo', () => {
    const muchos = { ...datos, students: Array.from({ length: 30 }, (_, i) => alumno(`x${i}`, `Alumno ${i}`)) };
    expect(buscar('alumno', muchos, t).filter(r => r.tipo === 'alumno')).toHaveLength(MAX_POR_TIPO);
  });

  it('sin escribir nada, las pantallas del menú; la portada de un apartado lleva su nombre', () => {
    const r = buscar('', datos, t);
    expect(r.every(x => x.tipo === 'pantalla')).toBe(true);
    expect(pantallasDe(datos.menu, t).find(p => p.id === 'evaluar')).toMatchObject({ titulo: 'Evaluar', detalle: '' });
  });

  it('el docente de PT y AL no tiene clases ni evaluación: no salen; en EF las SdA van a su apartado', () => {
    const apoyo = { ...datos, menu: navGroupsFor('apoyo'), conAula: false };
    expect(ids('alumno', apoyo).filter(x => x.startsWith('alumno:'))).toEqual([]);
    expect(buscar('mercado', { ...datos, ef: true }, t)[0].section).toBe('ef-sda');
  });
});
