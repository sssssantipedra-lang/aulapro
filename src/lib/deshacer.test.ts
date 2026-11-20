import { describe, it, expect } from 'vitest';
import {
  anotarBorrado, borradoAlPintar, borradoDeApoyo, borradoDeEF, clavesDeDeshacer, coleccionesTocadas, loQueVuelve,
  mismoContenido, textoDeBorrados, DICHO, type BorradoPendiente,
} from './deshacer';
import { translate, EN_DICT } from '../i18n';
import { CA } from '../i18n/ca';
import { APOYO_VACIO } from './apoyo';
import { EF_VACIO } from './ef';
import type { ApoyoData } from '../types/apoyo';
import type { EfData } from '../types/ef';

const es = (k: string, v?: Record<string, string | number>) => translate('es', k, v);
const en = (k: string, v?: Record<string, string | number>) => translate('en', k, v);
const ca = (k: string, v?: Record<string, string | number>) => translate('ca', k, v);

describe('lo que dice el aviso', () => {
  it('nombra lo borrado y lo que se va con ello', () => {
    expect(textoDeBorrados([{ tipo: 'clase', nombre: '3.º A' }], es)).toBe('Has eliminado la clase «3.º A» y todo lo suyo.');
    expect(textoDeBorrados([{ tipo: 'alumno', nombre: 'Alumno 3' }], es)).toBe('Has eliminado a Alumno 3 y todo lo suyo.');
    expect(textoDeBorrados([{ tipo: 'columna', nombre: 'Examen T1' }], es)).toBe('Has eliminado la columna «Examen T1» y sus notas.');
    expect(textoDeBorrados([{ tipo: 'rubrica', nombre: 'Exposición oral' }], es)).toBe('Has eliminado la rúbrica «Exposición oral».');
  });

  it('sin nombre, lo dice sin él (nunca unas comillas vacías)', () => {
    expect(textoDeBorrados([{ tipo: 'ficha', nombre: '  ' }], es)).toBe('Has eliminado una ficha.');
    expect(textoDeBorrados([{ tipo: 'coordinacion' }], es)).toBe('Has eliminado una coordinación.');
    expect(textoDeBorrados([{ tipo: 'horario' }], es)).toBe('Has eliminado el horario entero.');
  });

  it('la lista de asistencia lleva la clase y el día, en el idioma de la app', () => {
    expect(textoDeBorrados([{ tipo: 'lista', nombre: '3.º A', fecha: '2026-11-18' }], es, 'es-ES'))
      .toBe('Has eliminado la lista de asistencia de 3.º A del 18 de noviembre.');
    expect(textoDeBorrados([{ tipo: 'lista', nombre: '3.º A', fecha: '2026-11-18' }], en, 'en-GB'))
      .toBe('You deleted the attendance register for 3.º A on 18 November.');
    expect(textoDeBorrados([{ tipo: 'lista', nombre: '3.º A' }], es)).toBe('Has eliminado la lista de asistencia de un día.');
  });

  it('varias del mismo tipo se cuentan; de tipos distintos, se dice cuántas son', () => {
    expect(textoDeBorrados([{ tipo: 'sesion', cuantos: 3 }], es)).toBe('Has eliminado 3 sesiones.');
    expect(textoDeBorrados([{ tipo: 'ficha', nombre: 'A' }, { tipo: 'ficha', nombre: 'B' }], es)).toBe('Has eliminado 2 fichas.');
    expect(textoDeBorrados([{ tipo: 'ficha', nombre: 'A' }, { tipo: 'rubrica', nombre: 'B' }], es)).toBe('Has eliminado 2 elementos.');
  });

  it('un nombre muy largo se corta', () => {
    const texto = textoDeBorrados([{ tipo: 'tarea', nombre: 'Preparar la reunión de coordinación del segundo ciclo y llevar las actas firmadas' }], es);
    expect(texto.length).toBeLessThan(85);
    expect(texto).toContain('…»');
  });

  it('en inglés y en catalán', () => {
    expect(textoDeBorrados([{ tipo: 'clase', nombre: '3.º A' }], en)).toBe('You deleted the class «3.º A» and everything in it.');
    expect(textoDeBorrados([{ tipo: 'alumno', nombre: 'Alumne 3' }], ca)).toBe('Has eliminat Alumne 3 i tot el que tenia.');
  });

  it('todas las formas de decirlo están en inglés y en catalán, con las mismas variables', () => {
    const vars = (s: string) => (s.match(/\{[a-z_]+\}/gi) ?? []).sort().join(',');
    const faltan = clavesDeDeshacer().filter(k => !(k in EN_DICT) || !(k in CA));
    expect(faltan).toEqual([]);
    const malas = clavesDeDeshacer().filter(k => vars(EN_DICT[k]) !== vars(k) || vars(CA[k]) !== vars(k));
    expect(malas).toEqual([]);
  });

  it('ninguna lleva raya larga ni dice «profes»', () => {
    for (const k of clavesDeDeshacer()) {
      for (const texto of [k, EN_DICT[k], CA[k]]) expect(texto).not.toMatch(/—|profes\b/i);
    }
    expect(Object.keys(DICHO).length).toBeGreaterThan(30);
  });
});

/* Un perfil de mentira: lo que importa son las referencias. */
interface Perfil { clases: string[]; alumnos: string[]; notas: Record<string, number>; fichas: string[] }
const CLAVES = ['clases', 'alumnos', 'notas', 'fichas'] as const;
const perfil = (): Perfil => ({ clases: ['1A', '2B'], alumnos: ['a1', 'a2', 'b1'], notas: { a1: 7, b1: 5 }, fichas: ['f1'] });

/** Lo que hace el estado: apunta el borrado, borra y pinta. */
function borrar(antes: Perfil, despues: Perfil, prev: BorradoPendiente<Perfil> | null = null, id = 1) {
  const apuntado = anotarBorrado(prev, { id, perfil: 'p1', borrados: [{ tipo: 'clase', nombre: '1A' }], antes });
  return borradoAlPintar(apuntado, 'p1', despues, CLAVES);
}

describe('el borrado pendiente', () => {
  it('tras el primer pintado sabe qué colecciones cambió y deshacer las repone como estaban', () => {
    const antes = perfil();
    const despues: Perfil = { ...antes, clases: ['2B'], alumnos: ['b1'], notas: { b1: 5 } };
    const p = borrar(antes, despues)!;
    expect(p.despues).toBe(despues);
    expect(coleccionesTocadas(p, CLAVES)).toEqual(['clases', 'alumnos', 'notas']);
    const vuelve = loQueVuelve(p, CLAVES);
    // Vuelven las mismas referencias de antes, con todo lo que se fue; lo que no cambió no se toca
    expect(vuelve.clases).toBe(antes.clases);
    expect(vuelve.alumnos).toBe(antes.alumnos);
    expect(vuelve.notas).toBe(antes.notas);
    expect('fichas' in vuelve).toBe(false);
    expect({ ...despues, ...vuelve }).toEqual(antes);
  });

  it('sigue valiendo mientras lo que tocó no cambie, aunque cambie otra cosa', () => {
    const antes = perfil();
    const despues: Perfil = { ...antes, clases: ['2B'] };
    const p = borrar(antes, despues)!;
    expect(borradoAlPintar(p, 'p1', despues, CLAVES)).toBe(p);
    // Guardar una ficha no afecta a las clases: se puede seguir deshaciendo, y la ficha nueva se conserva
    const conFicha: Perfil = { ...despues, fichas: ['f1', 'f2'] };
    expect(borradoAlPintar(p, 'p1', conFicha, CLAVES)).toBe(p);
    expect({ ...conFicha, ...loQueVuelve(p, CLAVES) }).toEqual({ ...antes, fichas: ['f1', 'f2'] });
  });

  it('deja de valer si después se toca algo de lo que el borrado cambió: reponer lo de antes se llevaría ese cambio', () => {
    const antes = perfil();
    const despues: Perfil = { ...antes, clases: ['2B'] };
    const p = borrar(antes, despues)!;
    expect(borradoAlPintar(p, 'p1', { ...despues, clases: ['2B', '3C'] }, CLAVES)).toBeNull();
  });

  it('un borrado que no borra nada no deja aviso, aunque devuelva listas nuevas con lo mismo', () => {
    const antes = perfil();
    expect(borrar(antes, { ...antes })).toBeNull();
    expect(borrar(antes, { ...antes, clases: antes.clases.filter(c => c !== 'no-existe'), notas: { ...antes.notas } })).toBeNull();
  });

  it('un cambio posterior que deja lo tocado como estaba no retira el aviso', () => {
    const antes = perfil();
    const despues: Perfil = { ...antes, clases: ['2B'] };
    const p = borrar(antes, despues)!;
    expect(borradoAlPintar(p, 'p1', { ...despues, clases: [...despues.clases] }, CLAVES)).toBe(p);
  });

  it('mismoContenido mira dentro, hasta tres niveles', () => {
    const fila = { a1: 'present' };
    expect(mismoContenido([1, 2], [1, 2])).toBe(true);
    expect(mismoContenido([1, 2], [2, 1])).toBe(false);
    expect(mismoContenido([1, 2], [1])).toBe(false);
    expect(mismoContenido({ c1: { d1: fila } }, { c1: { d1: { ...fila } } })).toBe(true);
    expect(mismoContenido({ c1: { d1: fila } }, { c1: { d1: { a1: 'absent' } } })).toBe(false);
    expect(mismoContenido({ c1: { d1: fila } }, { c1: {} })).toBe(false);
    expect(mismoContenido({ a: 1 }, { b: 1 })).toBe(false);
    expect(mismoContenido([], {})).toBe(false);
    expect(mismoContenido(null, {})).toBe(false);
  });

  it('en otro perfil no vale', () => {
    const antes = perfil();
    const despues: Perfil = { ...antes, clases: ['2B'] };
    const p = borrar(antes, despues)!;
    expect(borradoAlPintar(p, 'p2', despues, CLAVES)).toBeNull();
    expect(borradoAlPintar(p, null, despues, CLAVES)).toBeNull();
  });

  it('varios borrados en el mismo gesto son uno: se deshacen todos a la vez', () => {
    const antes = perfil();
    const uno = anotarBorrado<Perfil>(null, { id: 1, perfil: 'p1', borrados: [{ tipo: 'ficha', nombre: 'A' }], antes });
    // El segundo se apunta antes de pintar: su «antes» ya no cuenta, manda el del primero
    const dos = anotarBorrado(uno, { id: 2, perfil: 'p1', borrados: [{ tipo: 'ficha', nombre: 'B' }], antes: { ...antes, fichas: [] } });
    expect(dos.id).toBe(1);
    expect(dos.antes).toBe(antes);
    expect(dos.borrados.map(b => b.nombre)).toEqual(['A', 'B']);
  });

  it('solo se puede deshacer el último: un borrado nuevo sustituye al que ya se había pintado', () => {
    const antes = perfil();
    const despues: Perfil = { ...antes, clases: ['2B'] };
    const primero = borrar(antes, despues)!;
    const segundo = anotarBorrado(primero, { id: 2, perfil: 'p1', borrados: [{ tipo: 'ficha', nombre: 'f1' }], antes: despues });
    expect(segundo.id).toBe(2);
    expect(segundo.antes).toBe(despues);
    expect(segundo.despues).toBeNull();
    const pintado = borradoAlPintar(segundo, 'p1', { ...despues, fichas: [] }, CLAVES)!;
    // Deshacerlo devuelve la ficha, no la clase del borrado anterior
    expect(loQueVuelve(pintado, CLAVES)).toEqual({ fichas: ['f1'] });
  });
});

describe('PT y AL y Educación Física: qué se ha borrado', () => {
  const apoyo = (d: Partial<ApoyoData>): ApoyoData => ({ ...APOYO_VACIO, ...d });
  const ef = (d: Partial<EfData>): EfData => ({ ...EF_VACIO, ...d });
  const item = <T,>(x: object) => x as unknown as T;

  it('quitar un elemento de una lista es un borrado, con su nombre', () => {
    const antes = ef({ sesiones: [item({ id: 's1', titulo: 'Saltos' }), item({ id: 's2', titulo: 'Lanzamientos' })] });
    const despues = { ...antes, sesiones: antes.sesiones.filter(s => s.id !== 's1') };
    expect(borradoDeEF(antes, despues)).toEqual([{ tipo: 'sesion', nombre: 'Saltos' }]);
  });

  it('varios a la vez se cuentan', () => {
    const antes = ef({ sesiones: [item({ id: 's1', titulo: 'A' }), item({ id: 's2', titulo: 'B' }), item({ id: 's3', titulo: 'C' })] });
    expect(borradoDeEF(antes, { ...antes, sesiones: [antes.sesiones[2]] })).toEqual([{ tipo: 'sesion', cuantos: 2 }]);
  });

  it('guardar, añadir, reordenar o sustituir no es borrar', () => {
    const antes = ef({ sesiones: [item({ id: 's1', titulo: 'A' }), item({ id: 's2', titulo: 'B' })] });
    expect(borradoDeEF(antes, antes)).toEqual([]);
    expect(borradoDeEF(antes, { ...antes, sesiones: [...antes.sesiones, item({ id: 's3', titulo: 'C' })] })).toEqual([]);
    expect(borradoDeEF(antes, { ...antes, sesiones: [antes.sesiones[1], antes.sesiones[0]] })).toEqual([]);
    expect(borradoDeEF(antes, { ...antes, sesiones: antes.sesiones.map(s => (s.id === 's1' ? { ...s, titulo: 'Otra' } : s)) })).toEqual([]);
    // Sale uno y entra otro con otro id (los datos de ejemplo, un nivel de apoyo que sustituye al del mismo alumno)
    expect(borradoDeEF(antes, { ...antes, sesiones: [antes.sesiones[1], item({ id: 's9', titulo: 'Nueva' })] })).toEqual([]);
  });

  it('una prueba se va con sus marcas y sus baremos: se nombra la prueba', () => {
    const antes = ef({
      pruebas: [item({ id: 'p1', nombre: 'Course Navette' })],
      marcas: [item({ id: 'm1', pruebaId: 'p1', alumnoId: 'a1' })],
      baremos: [item({ id: 'b1', pruebaId: 'p1' })],
    });
    expect(borradoDeEF(antes, { ...antes, pruebas: [], marcas: [], baremos: [] })).toEqual([{ tipo: 'prueba', nombre: 'Course Navette' }]);
  });

  it('lo que se marca y se desmarca (una marca suelta, una pareja) no lleva aviso', () => {
    const antes = ef({ marcas: [item({ id: 'm1', pruebaId: 'p1', alumnoId: 'a1' })], separar: [{ a: 'a1', b: 'a2' }] });
    expect(borradoDeEF(antes, { ...antes, marcas: [], separar: [] })).toEqual([]);
  });

  it('un exento se dice con el nombre del alumno', () => {
    const antes = ef({ exentos: [item({ id: 'e1', alumnoId: 'a1' })] });
    expect(borradoDeEF(antes, { ...antes, exentos: [] }, id => (id === 'a1' ? 'Alumno 1' : undefined))).toEqual([{ tipo: 'exento', nombre: 'Alumno 1' }]);
    expect(textoDeBorrados(borradoDeEF(antes, { ...antes, exentos: [] }), es)).toBe('Has eliminado una exención o lesión.');
  });

  it('PT y AL: el alumno se va con sus programas y registros, y se nombra a él', () => {
    const antes = apoyo({
      alumnos: [item({ id: 'x1', nombre: 'Alumno 1' }), item({ id: 'x2', nombre: 'Alumno 2' })],
      programas: [item({ id: 'pr1', alumnoId: 'x1', ambito: 'Lectoescritura' })],
      sesiones: [item({ id: 'se1', fecha: '2026-11-10' })],
    });
    const despues = { ...antes, alumnos: [antes.alumnos[1]], programas: [], sesiones: [] };
    expect(borradoDeApoyo(antes, despues)).toEqual([{ tipo: 'alumno', nombre: 'Alumno 1' }]);
  });

  it('PT y AL: un programa, un documento, una agenda y una adaptación', () => {
    const antes = apoyo({
      alumnos: [item({ id: 'x1', nombre: 'Alumno 1' })],
      programas: [item({ id: 'pr1', alumnoId: 'x1', ambito: 'Lectoescritura' })],
      documentos: [item({ id: 'd1', titulo: 'Informe del primer trimestre' })],
      agendas: [item({ id: 'ag1', titulo: 'Mi mañana' })],
      acs: [item({ id: 'ac1', alumnoId: 'x1' })],
      evaluaciones: [item({ id: 'ev1' })],
    });
    expect(borradoDeApoyo(antes, { ...antes, programas: [] })).toEqual([{ tipo: 'programa', nombre: 'Lectoescritura' }]);
    expect(borradoDeApoyo(antes, { ...antes, documentos: [] })).toEqual([{ tipo: 'documento', nombre: 'Informe del primer trimestre' }]);
    expect(borradoDeApoyo(antes, { ...antes, agendas: [] })).toEqual([{ tipo: 'agenda', nombre: 'Mi mañana' }]);
    expect(borradoDeApoyo(antes, { ...antes, acs: [] })).toEqual([{ tipo: 'adaptacion', nombre: 'Alumno 1' }]);
    // El cierre del trimestre se marca y se desmarca: no es un borrado
    expect(borradoDeApoyo(antes, { ...antes, evaluaciones: [] })).toEqual([]);
  });
});
