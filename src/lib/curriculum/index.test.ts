/**
 * Estos datos son la transcripción literal de dos Reales Decretos: un fallo
 * aquí no es un bug de lógica, es dar por buena una cifra o un texto que no
 * es el oficial. Se comprueban los totales que anuncia la portada de cada
 * documento (298/622 en Primaria, 445/812 en la ESO) y los casos donde el
 * texto real no es uniforme —Educación en Valores solo en 3er ciclo,
 * Matemáticas A/B en 4º de la ESO—, no solo que las funciones no exploten.
 */
import { describe, it, expect } from 'vitest';
import {
  materiasDe, buscarMateria, cicloDePrimaria, cursosDelGrupoEso, grupoDeEso, resolverGrupo,
} from './index';

describe('Primaria (RD 157/2022)', () => {
  const areas = materiasDe('primaria');

  it('tiene las 7 áreas, ni una de más ni de menos', () => {
    expect(areas).toHaveLength(7);
  });

  it('suma 298 criterios y 622 ítems de saberes, como anuncia el propio documento', () => {
    let criterios = 0, items = 0;
    for (const a of areas) {
      for (const ciclo of [1, 2, 3]) {
        criterios += (a.criterios[ciclo] ?? []).length;
        for (const b of a.saberes[ciclo] ?? []) {
          for (const e of b.epigrafes) items += e.items.length;
        }
      }
    }
    expect(criterios).toBe(298);
    expect(items).toBe(622);
  });

  it('cicloDePrimaria reparte los 6 cursos en 3 ciclos de dos', () => {
    expect([1, 2, 3, 4, 5, 6].map(cicloDePrimaria)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('Educación en Valores solo tiene criterios en el 3er ciclo', () => {
    const valores = buscarMateria('primaria', 'Educación en Valores Cívicos y Éticos')!;
    expect(valores.criterios['1']).toHaveLength(0);
    expect(valores.criterios['2']).toHaveLength(0);
    expect(valores.criterios['3'].length).toBeGreaterThan(0);
  });

  it('resolverGrupo con 5º devuelve el 3er ciclo de Matemáticas', () => {
    const r = resolverGrupo('primaria', 'Matemáticas', 5);
    expect(r?.grupo).toBe('3');
    expect(r?.entry.competencias).toHaveLength(8);
  });

  it('una materia inexistente no revienta: devuelve null', () => {
    expect(resolverGrupo('primaria', 'Filosofía', 5)).toBeNull();
  });
});

describe('ESO (RD 217/2022)', () => {
  const materias = materiasDe('eso');

  it('tiene las 17 materias', () => {
    expect(materias).toHaveLength(17);
  });

  it('suma 445 criterios y 812 ítems de saberes', () => {
    let criterios = 0, items = 0;
    for (const m of materias) {
      for (const grupo of Object.keys(m.criterios)) criterios += m.criterios[grupo].length;
      for (const grupo of Object.keys(m.saberes)) {
        for (const b of m.saberes[grupo]) for (const e of b.epigrafes) items += e.items.length;
      }
    }
    expect(criterios).toBe(445);
    expect(items).toBe(812);
  });

  it('cursosDelGrupoEso interpreta los rangos reales del decreto', () => {
    expect(cursosDelGrupoEso('Cursos de primero a tercero')).toEqual([1, 2, 3]);
    expect(cursosDelGrupoEso('Cursos primero y segundo')).toEqual([1, 2]);
    expect(cursosDelGrupoEso('Cursos tercero y cuarto')).toEqual([3, 4]);
    expect(cursosDelGrupoEso('Cuarto curso')).toEqual([4]);
    expect(cursosDelGrupoEso('Curso no especificado')).toEqual([1, 2, 3, 4]);
  });

  it('Matemáticas A y B no son un rango de curso: cursosDelGrupoEso no les asigna uno', () => {
    expect(cursosDelGrupoEso('Matemáticas A')).toBeNull();
    expect(cursosDelGrupoEso('Matemáticas B')).toBeNull();
  });

  it('cada materia agrupa sus propios cursos, no un ciclo uniforme', () => {
    const bio = buscarMateria('eso', 'Biología y Geología')!;
    expect(grupoDeEso(bio, 1)).toBe('Cursos de primero a tercero');
    expect(grupoDeEso(bio, 4)).toBe('Cuarto curso');

    const geo = buscarMateria('eso', 'Geografía e Historia')!;
    expect(grupoDeEso(geo, 2)).toBe('Cursos primero y segundo');
    expect(grupoDeEso(geo, 3)).toBe('Cursos tercero y cuarto');
  });

  it('Matemáticas de 4º exige la opción A o B explícita', () => {
    expect(resolverGrupo('eso', 'Matemáticas', 4)).toBeNull();
    expect(resolverGrupo('eso', 'Matemáticas', 4, 'A')?.grupo).toBe('Matemáticas A');
    expect(resolverGrupo('eso', 'Matemáticas', 4, 'B')?.grupo).toBe('Matemáticas B');
  });

  it('Matemáticas A y B comparten las mismas competencias específicas', () => {
    const mat = buscarMateria('eso', 'Matemáticas')!;
    expect(mat.competencias).toHaveLength(10);
  });
});

describe('fidelidad de los códigos', () => {
  it('un criterio sin subíndice en el original queda marcado codigoLiteral:false', () => {
    // Educación Física, competencia 5: el BOE la redacta sin subíndice porque
    // es la única de ese ciclo. Ver el comentario en lib/curriculum/index.ts.
    const ef = buscarMateria('primaria', 'Educación Física')!;
    const c = ef.criterios['1'].find(c => c.competencia === 5);
    expect(c?.codigo).toBe('5.1');
    expect(c?.codigoLiteral).toBe(false);
  });

  it('un criterio numerado en el original queda marcado codigoLiteral:true', () => {
    const mat = buscarMateria('primaria', 'Matemáticas')!;
    const c = mat.criterios['1'].find(c => c.codigo === '1.1');
    expect(c?.codigoLiteral).toBe(true);
  });
});
