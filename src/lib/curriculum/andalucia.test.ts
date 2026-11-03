/**
 * El currículo de Primaria de Andalucía que lleva la app: el anexo II de la
 * Orden de 30 de mayo de 2023, generado por `scripts/curriculo/andalucia_primaria.py`
 * y comprobado celda a celda contra el PDF (`scripts/curriculo/comprobar_celdas.py`).
 * Los totales son los del texto oficial; si cambian, es que la extracción o los
 * datos han cambiado y hay que volver a comprobarlos (`docs/COMUNIDADES.md`).
 */
import { describe, it, expect } from 'vitest';
import { cargarCurriculo } from './cargar';
import { citarNormas, normasDe } from './comunidades';
import { competenciasDe, resolverGrupo, type CurriculumEntry } from './index';
import { materiasDelCurso } from './materiasDeClase';

const abrir = () => cargarCurriculo('andalucia', 'primaria', 'es');
const materia = (materias: CurriculumEntry[], id: string) => materias.find(m => m.id === id)!;
const CURSOS = [1, 2, 3, 4, 5, 6];
const saberes = (m: CurriculumEntry, grupo: string) =>
  (m.saberes[grupo] ?? []).flatMap(b => b.epigrafes.flatMap(e => e.items));
/** Los saberes de un ciclo: los de cualquiera de sus dos cursos que tenga el área. */
const delCiclo = (m: CurriculumEntry, ciclo: number) => m.saberes[`${2 * ciclo - 1}º Primaria`] ?? m.saberes[`${2 * ciclo}º Primaria`] ?? [];

// id, nombre, competencias, criterios de cada curso (1.º a 6.º), saberes y bloques de cada ciclo
const AREAS: [string, string, number, number[], [number, number, number], [number, number, number]][] = [
  ['conocimiento-del-medio', 'Conocimiento del Medio Natural, Social y Cultural', 9, [22, 22, 22, 22, 23, 23], [44, 48, 49], [3, 3, 3]],
  ['educacion-artistica', 'Educación Artística', 4, [10, 10, 10, 10, 11, 11], [27, 34, 36], [4, 4, 4]],
  ['educacion-fisica', 'Educación Física', 5, [14, 14, 14, 14, 14, 14], [26, 27, 29], [6, 6, 6]],
  ['educacion-en-valores', 'Educación en Valores Cívicos y Éticos', 4, [0, 0, 0, 0, 0, 13], [0, 0, 25], [0, 0, 3]],
  ['lengua-castellana', 'Lengua Castellana y Literatura', 10, [22, 22, 22, 22, 22, 22], [28, 30, 32], [4, 4, 4]],
  ['lengua-extranjera', 'Primera Lengua Extranjera', 6, [13, 13, 15, 15, 15, 15], [16, 22, 24], [3, 3, 3]],
  ['matematicas', 'Matemáticas', 8, [17, 17, 16, 17, 17, 17], [56, 68, 69], [6, 6, 6]],
  ['segunda-lengua-extranjera', 'Segunda Lengua Extranjera', 6, [0, 0, 0, 0, 26, 26], [0, 0, 16], [0, 0, 3]],
];

describe('Primaria de Andalucía', () => {
  it('se abre como currículo autonómico, en castellano, citando el Decreto 101/2023 y la orden que lo desarrolla', async () => {
    const c = await abrir();
    expect(c.origen).toBe('autonomico');
    expect(c.idioma).toBe('es');
    expect(c.normas).toBe(normasDe('andalucia', 'primaria'));
    expect(citarNormas(c.normas, 'es')).toBe(
      'Decreto 101/2023, de 9 de mayo (BOJA núm. 90, de 15 de mayo de 2023), '
      + 'desarrollado por la Orden de 30 de mayo de 2023 (BOJA núm. 104, de 2 de junio de 2023)',
    );
    expect((await cargarCurriculo('andalucia', 'primaria', 'ca')).idioma).toBe('es');
  });

  it('la ESO sigue con el estatal mientras no esté copiada', async () => {
    expect((await cargarCurriculo('andalucia', 'eso', 'es')).origen).toBe('estatal');
  });

  it('tiene las áreas del artículo 6 de la orden, en el orden del anexo II', async () => {
    const { materias } = await abrir();
    expect(materias.map(m => [m.id, m.nombre])).toEqual(AREAS.map(([id, nombre]) => [id, nombre]));
  });

  it('cada área tiene sus competencias, los criterios de cada curso y los saberes de cada ciclo, con los totales del texto oficial', async () => {
    const { materias } = await abrir();
    for (const [id, , competencias, criterios, nSaberes, bloques] of AREAS) {
      const m = materia(materias, id);
      expect(m.competencias.map(c => c.n), id).toEqual(Array.from({ length: competencias }, (_, i) => i + 1));
      expect(CURSOS.map(c => m.criterios[`${c}º Primaria`]?.length ?? 0), id).toEqual(criterios);
      expect([1, 2, 3].map(c => delCiclo(m, c).flatMap(b => b.epigrafes.flatMap(e => e.items)).length), id).toEqual(nSaberes);
      expect([1, 2, 3].map(c => delCiclo(m, c).length), id).toEqual(bloques);
      // Los dos cursos de un ciclo llevan los mismos saberes
      for (const c of [1, 3, 5]) {
        if (m.criterios[`${c}º Primaria`] && m.criterios[`${c + 1}º Primaria`]) {
          expect(saberes(m, `${c}º Primaria`), `${id} ${c}º`).toEqual(saberes(m, `${c + 1}º Primaria`));
        }
      }
    }
    const total = materias.reduce((s, m) => s + Object.values(m.criterios).flat().length, 0);
    expect(total).toBe(664);
  });

  it('los criterios son de cada curso: «a» en el primero del ciclo y «b» en el segundo', async () => {
    const { materias } = await abrir();
    for (const m of materias.filter(m => !['educacion-en-valores', 'segunda-lengua-extranjera'].includes(m.id))) {
      for (const curso of CURSOS) {
        const letra = curso % 2 === 1 ? 'a' : 'b';
        for (const c of m.criterios[`${curso}º Primaria`]) {
          expect(c.codigo, `${m.id} ${curso}º`).toMatch(new RegExp(`^${c.competencia}\\.\\d+\\.${letra}$`));
          expect(c.codigoLiteral).toBe(true);
        }
      }
    }
    // Educación en Valores, un solo curso: sin letra
    expect(materia(materias, 'educacion-en-valores').criterios['6º Primaria'][0].codigo).toBe('1.1');
  });

  it('una clase de un curso ve solo los criterios de su curso', async () => {
    const { materias } = await abrir();
    const r1 = resolverGrupo('primaria', 'Matemáticas', 1, undefined, materias)!;
    const r2 = resolverGrupo('primaria', 'Matemáticas', 2, undefined, materias)!;
    expect(r1.grupo).toBe('1º Primaria');
    expect(r2.grupo).toBe('2º Primaria');
    expect(r1.entry.criterios[r1.grupo][0].texto).toMatch(/^Comprender las preguntas planteadas/);
    expect(r2.entry.criterios[r2.grupo][0].codigo).toBe('1.1.b');
    // Los saberes son los del ciclo: los mismos en primero y en segundo
    expect(r1.entry.saberes[r1.grupo]).toBe(r2.entry.saberes[r2.grupo]);
    expect(r1.entry.saberes[r1.grupo][0].epigrafes[0]).toEqual(expect.objectContaining({ n: 1, titulo: 'Conteo' }));
    expect(r1.entry.saberes[r1.grupo][0].epigrafes[0].items[0]).toMatch(/^MAT\.1\.A\.1\.1\. Significado y utilidad/);
  });

  it('las competencias llevan los descriptores del perfil de salida que dice el anexo', async () => {
    const { materias } = await abrir();
    const mates = materia(materias, 'matematicas');
    expect(competenciasDe(mates, '3º Primaria')[0].descriptores).toEqual(['STEM1', 'STEM2', 'STEM4', 'CD2', 'CPSAA5', 'CE1', 'CE3', 'CCEC4']);
    for (const m of materias) for (const c of m.competencias) expect(c.descriptores?.length, `${m.id} CE${c.n}`).toBeGreaterThan(0);
  });

  it('Educación en Valores solo en sexto, y Segunda Lengua Extranjera en quinto y sexto', async () => {
    const { materias } = await abrir();
    const ctx = (curso: number) => ({ etapa: 'primaria' as const, curso });
    expect(materiasDelCurso(ctx(6), materias)).toContain('Educación en Valores Cívicos y Éticos');
    expect(materiasDelCurso(ctx(5), materias)).not.toContain('Educación en Valores Cívicos y Éticos');
    expect(materiasDelCurso(ctx(5), materias)).toContain('Segunda Lengua Extranjera');
    expect(materiasDelCurso(ctx(4), materias)).not.toContain('Segunda Lengua Extranjera');
    expect(materiasDelCurso(ctx(1), materias)).toHaveLength(6);
  });

  it('Segunda Lengua Extranjera parte del primer ciclo de Primera Lengua Extranjera, como dice el anexo', async () => {
    const { materias } = await abrir();
    const primera = materia(materias, 'lengua-extranjera');
    const segunda = materia(materias, 'segunda-lengua-extranjera');
    expect(segunda.criterios['5º Primaria'].map(c => c.codigo)).toEqual(
      [...primera.criterios['1º Primaria'], ...primera.criterios['2º Primaria']].map(c => c.codigo).sort((a, b) => a.localeCompare(b, 'es', { numeric: true })),
    );
    expect(segunda.saberes['5º Primaria']).toEqual(primera.saberes['1º Primaria']);
  });

  it('lo que el BOJA trae así se copia tal cual', async () => {
    const { materias } = await abrir();
    // Matemáticas, segundo ciclo: cuarto tiene el 2.3.b y tercero no tiene el 2.3.a
    const mates = materia(materias, 'matematicas');
    expect(mates.criterios['3º Primaria'].map(c => c.codigo)).not.toContain('2.3.a');
    expect(mates.criterios['4º Primaria'].map(c => c.codigo)).toContain('2.3.b');
    // «CMN.1.C4.», sin el punto tras la letra
    const medio = materia(materias, 'conocimiento-del-medio');
    expect(medio.saberes['1º Primaria'][2].epigrafes.map(e => e.titulo)).toContain('Conciencia ecosocial');
  });
});
