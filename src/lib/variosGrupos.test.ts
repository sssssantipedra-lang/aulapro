import { describe, it, expect } from 'vitest';
import { materiasDe } from './curriculum';
import {
  claseDeGrupo, claveDeGrupo, esOficialEnCurso, gruposACrear, gruposPrevistos, leerLetras, nombreDeGrupo, ordinalDe, MAX_GRUPOS,
} from './variosGrupos';

describe('letras de los grupos', () => {
  it('lee «A, B, C» con comas, espacios o punto y coma', () => {
    expect(leerLetras('A, B, C')).toEqual(['A', 'B', 'C']);
    expect(leerLetras('a b c')).toEqual(['A', 'B', 'C']);
    expect(leerLetras(' A;B ,, C ')).toEqual(['A', 'B', 'C']);
  });
  it('un rango «A-D» son sus letras', () => {
    expect(leerLetras('A-D')).toEqual(['A', 'B', 'C', 'D']);
    expect(leerLetras('a-c, E')).toEqual(['A', 'B', 'C', 'E']);
  });
  it('no repite y respeta lo que no es una letra sola', () => {
    expect(leerLetras('A, a, B, B')).toEqual(['A', 'B']);
    expect(leerLetras('Bilingüe, 1')).toEqual(['Bilingüe', '1']);
  });
  it('vacío, ninguna', () => {
    expect(leerLetras('')).toEqual([]);
    expect(leerLetras(' , ')).toEqual([]);
  });
});

describe('nombre y clave de un grupo', () => {
  it('«3.º A», con la etapa si hace falta y sin letra si no hay', () => {
    expect(nombreDeGrupo(3, 'A')).toBe('3.º A');
    expect(nombreDeGrupo(3, 'A', 'eso')).toBe('3.º ESO A');
    expect(nombreDeGrupo(5, '', 'primaria')).toBe('5.º Primaria');
    expect(nombreDeGrupo(5, '')).toBe('5.º');
  });
  it('el mismo grupo escrito de varias maneras tiene la misma clave', () => {
    for (const n of ['3.º A', '3º A', '3ºA', '3 a', '3º ESO A', '3º de Primaria A', '3.º Primària A']) {
      expect(claveDeGrupo(n), n).toBe('3a');
    }
    // Con el ordinal en catalán, en inglés o en largo
    for (const n of ['3r A', '3r ESO A', '3r de Primària A', '3rd A', '3ro A', '3er A', 'Year 3 A']) {
      expect(claveDeGrupo(n), n).toBe('3a');
    }
    expect(claveDeGrupo('5è B')).toBe('5b');
    expect(claveDeGrupo('5é B')).toBe('5b');
    expect(claveDeGrupo('5e\u0301 B')).toBe('5b');
    expect(claveDeGrupo('4t')).toBe('4');
    // Una letra pegada al número es el grupo: «3ºE» y «5e» son el grupo E, y «4T», el T
    expect(claveDeGrupo('5e')).toBe('5e');
    expect(claveDeGrupo('4T')).toBe('4t');
    expect(claveDeGrupo('3.º B')).not.toBe(claveDeGrupo('3.º A'));
    expect(claveDeGrupo('13.º A')).not.toBe(claveDeGrupo('3.º A'));
  });
});

describe('el ordinal sigue a las clases que ya hay', () => {
  it('«3.º» de partida, y «3º» si el docente ya las escribe así', () => {
    expect(ordinalDe([])).toBe('.º');
    expect(ordinalDe([{ name: 'Tutoría' }])).toBe('.º');
    expect(ordinalDe([{ name: '5º Primaria A' }, { name: 'Refuerzo' }])).toBe('º');
    expect(ordinalDe([{ name: '5.º A' }])).toBe('.º');
    // Mezclados: la forma de la norma
    expect(ordinalDe([{ name: '5.º A' }, { name: '6º B' }])).toBe('.º');
  });
});

describe('grupos previstos', () => {
  it('no duplica un grupo que ya existe con el ordinal escrito en catalán o en inglés', () => {
    const hay = [
      { name: '3r A', etapa: 'primaria' as const, curso: 3 }, { name: '5è B', etapa: 'primaria' as const, curso: 5 },
      { name: '4th A', etapa: 'primaria' as const, curso: 4 },
    ];
    const g = gruposPrevistos('primaria', [3, 4, 5], ['A', 'B'], hay);
    expect(g.filter(x => x.existe).map(x => `${x.curso}${x.letra}`)).toEqual(['3A', '4A', '5B']);
    expect(gruposACrear(g).map(x => `${x.curso}${x.letra}`)).toEqual(['3B', '4B', '5A']);
  });
  it('un grupo por curso y letra, en orden', () => {
    const g = gruposPrevistos('primaria', [4, 3], ['A', 'B'], []);
    expect(g.map(x => x.nombre)).toEqual(['3.º A', '3.º B', '4.º A', '4.º B']);
    expect(g.every(x => !x.existe)).toBe(true);
  });
  it('sin letras, un grupo por curso', () => {
    expect(gruposPrevistos('eso', [1, 2], [], []).map(x => x.nombre)).toEqual(['1.º', '2.º']);
  });
  it('no cuenta cursos que la etapa no tiene ni repetidos', () => {
    expect(gruposPrevistos('eso', [1, 1, 5, 0, 2.5], ['A'], []).map(x => x.nombre)).toEqual(['1.º A']);
    expect(gruposPrevistos('primaria', [6], ['A'], []).map(x => x.nombre)).toEqual(['6.º A']);
  });
  it('lo que ya existe se marca y no se crea, se escribiera como se escribiera', () => {
    const hay = [
      { name: '3º Primaria A', etapa: 'primaria' as const, curso: 3 },
      { name: '4ºb', etapa: 'primaria' as const, curso: 4 },
    ];
    const g = gruposPrevistos('primaria', [3, 4], ['A', 'B'], hay);
    // Las clases que hay escriben «3º», sin punto: las nuevas, igual
    expect(g.map(x => [x.nombre, x.existe])).toEqual([['3º A', true], ['3º B', false], ['4º A', false], ['4º B', true]]);
    expect(gruposACrear(g).map(x => x.nombre)).toEqual(['3º B', '4º A']);
  });
  it('una clase de la otra etapa con el mismo nombre no es el mismo grupo, y entonces el nombre lleva la etapa', () => {
    const hay = [{ name: '3º A', etapa: 'eso' as const, curso: 3 }];
    const g = gruposPrevistos('primaria', [3], ['A'], hay);
    expect(g).toEqual([{ nombre: '3º Primaria A', curso: 3, letra: 'A', existe: false }]);
  });
  it('una clase sin etapa puesta con ese nombre sí cuenta como existente', () => {
    expect(gruposPrevistos('eso', [2], ['A'], [{ name: '2º A' }])[0].existe).toBe(true);
  });
  it('como mucho se crean ' + MAX_GRUPOS, () => {
    const g = gruposPrevistos('primaria', [1, 2, 3, 4, 5, 6], leerLetras('A-J'), []);
    expect(g).toHaveLength(60);
    expect(gruposACrear(g)).toHaveLength(MAX_GRUPOS);
  });
});

describe('la clase de un grupo', () => {
  const primaria = materiasDe('primaria');
  const oficial = primaria.find(m => /Matem/.test(m.nombre))!;

  it('lleva etapa, curso, la asignatura y su materia oficial', () => {
    const [g] = gruposPrevistos('primaria', [3], ['A'], []);
    const c = claseDeGrupo(g, 'primaria', ` ${oficial.nombre} `, primaria, { id: 'x1', color: '#123456' });
    expect(c).toMatchObject({
      id: 'x1', name: '3.º A', color: '#123456', room: '', etapa: 'primaria', curso: 3,
      subject: oficial.nombre, subjects: [oficial.nombre],
    });
    expect(c.materiasOficiales).toEqual({ [oficial.nombre]: oficial.id });
    expect(esOficialEnCurso(oficial.nombre, 'primaria', 3, primaria)).toBe(true);
  });
  it('una asignatura que no está en el currículo queda en modo libre', () => {
    const [g] = gruposPrevistos('primaria', [3], ['A'], []);
    const c = claseDeGrupo(g, 'primaria', 'Ajedrez', primaria, { id: 'x2', color: '#000000' });
    expect(c.materiasOficiales).toEqual({ Ajedrez: null });
    expect(esOficialEnCurso('Ajedrez', 'primaria', 3, primaria)).toBe(false);
  });
});
