/**
 * El currículo de Andalucía que lleva la app: Primaria, el anexo II de su Orden
 * de 30 de mayo de 2023 (`scripts/curriculo/andalucia_primaria.py`), y ESO, los
 * anexos II y III de la suya (`scripts/curriculo/andalucia_eso.py`), comprobados
 * celda a celda contra los PDF (`scripts/curriculo/comprobar_celdas.py`).
 * Los totales son los del texto oficial; si cambian, es que la extracción o los
 * datos han cambiado y hay que volver a comprobarlos (`docs/COMUNIDADES.md`).
 */
import { describe, it, expect } from 'vitest';
import { cargarCurriculo } from './cargar';
import { citarNormas, normasDe } from './comunidades';
import { competenciasDe, resolverGrupo, type CurriculumEntry } from './index';
import { emparejarMateria } from './mapeoMaterias';
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

// id, nombre, competencias, criterios y saberes de cada grupo (cursos, y Matemáticas A y B en cuarto)
const MATERIAS_ESO: [string, string, number, Record<string, number>, Record<string, number>][] = [
  ['biologia-y-geologia', 'Biología y Geología', 6, {'1º ESO': 19, '3º ESO': 19, '4º ESO': 16}, {'1º ESO': 34, '3º ESO': 29, '4º ESO': 33}],
  ['digitalizacion', 'Digitalización', 4, {'4º ESO': 14}, {'4º ESO': 17}],
  ['economia-y-emprendimiento', 'Economía y Emprendimiento', 7, {'4º ESO': 21}, {'4º ESO': 21}],
  ['educacion-fisica', 'Educación Física', 5, {'1º ESO': 17, '2º ESO': 17, '3º ESO': 17, '4º ESO': 17}, {'1º ESO': 43, '2º ESO': 44, '3º ESO': 43, '4º ESO': 49}],
  ['educacion-plastica-visual-y-audiovisual', 'Educación Plástica, Visual y Audiovisual', 8, {'1º ESO': 20, '3º ESO': 22}, {'1º ESO': 13, '3º ESO': 15}],
  ['educacion-en-valores', 'Educación en Valores Cívicos y Éticos', 4, {'2º ESO': 13}, {'2º ESO': 23}],
  ['expresion-artistica', 'Expresión Artística', 4, {'4º ESO': 9}, {'4º ESO': 21}],
  ['fisica-y-quimica', 'Física y Química', 6, {'2º ESO': 15, '3º ESO': 14, '4º ESO': 15}, {'2º ESO': 16, '3º ESO': 18, '4º ESO': 27}],
  ['formacion-y-orientacion', 'Formación y Orientación Personal y Profesional', 5, {'4º ESO': 14}, {'4º ESO': 20}],
  ['geografia-e-historia', 'Geografía e Historia', 9, {'1º ESO': 30, '2º ESO': 30, '3º ESO': 21, '4º ESO': 21}, {'1º ESO': 30, '2º ESO': 38, '3º ESO': 31, '4º ESO': 33}],
  ['latin', 'Latín', 5, {'4º ESO': 21}, {'4º ESO': 39}],
  ['lengua-castellana', 'Lengua Castellana y Literatura', 10, {'1º ESO': 23, '2º ESO': 23, '3º ESO': 23, '4º ESO': 23}, {'1º ESO': 33, '2º ESO': 46, '3º ESO': 44, '4º ESO': 48}],
  ['lengua-extranjera', 'Lengua Extranjera', 6, {'1º ESO': 16, '2º ESO': 16, '3º ESO': 16, '4º ESO': 16}, {'1º ESO': 23, '2º ESO': 23, '3º ESO': 23, '4º ESO': 23}],
  ['matematicas', 'Matemáticas', 10, {'1º ESO': 23, '2º ESO': 23, '3º ESO': 22, 'Matemáticas A': 23, 'Matemáticas B': 22}, {'1º ESO': 41, '2º ESO': 52, '3º ESO': 71, 'Matemáticas A': 51, 'Matemáticas B': 51}],
  ['musica', 'Música', 4, {'1º ESO': 9, '2º ESO': 10, '4º ESO': 9}, {'1º ESO': 21, '2º ESO': 20, '4º ESO': 24}],
  ['tecnologia', 'Tecnología', 6, {'4º ESO': 13}, {'4º ESO': 22}],
  ['tecnologia-y-digitalizacion', 'Tecnología y Digitalización', 7, {'2º ESO': 15, '3º ESO': 15}, {'2º ESO': 21, '3º ESO': 17}],
  ['ampliacion-de-cultura-clasica', 'Ampliación de Cultura Clásica', 7, {'4º ESO': 28}, {'4º ESO': 35}],
  ['aprendizaje-social-y-emocional', 'Aprendizaje Social y Emocional', 5, {'4º ESO': 22}, {'4º ESO': 26}],
  ['artes-escenicas-y-danza', 'Artes Escénicas y Danza', 7, {'4º ESO': 17}, {'4º ESO': 21}],
  ['computacion-y-robotica', 'Computación y Robótica', 6, {'1º ESO': 15, '2º ESO': 16, '3º ESO': 17}, {'1º ESO': 41, '2º ESO': 41, '3º ESO': 41}],
  ['cultura-cientifica', 'Cultura Científica', 5, {'4º ESO': 22}, {'4º ESO': 24}],
  ['cultura-clasica', 'Cultura Clásica', 6, {'3º ESO': 26}, {'3º ESO': 35}],
  ['cultura-del-flamenco', 'Cultura del Flamenco', 4, {'3º ESO': 9}, {'3º ESO': 18}],
  ['dibujo-tecnico', 'Dibujo Técnico', 5, {'4º ESO': 15}, {'4º ESO': 23}],
  ['filosofia', 'Filosofía', 9, {'4º ESO': 24}, {'4º ESO': 27}],
  ['filosofia-y-argumentacion', 'Filosofía y Argumentación', 8, {'3º ESO': 21}, {'3º ESO': 10}],
  ['iniciacion-actividad-emprendedora', 'Iniciación a la Actividad Emprendedora y Empresarial', 6, {'3º ESO': 20}, {'3º ESO': 17}],
  ['oratoria-y-debate', 'Oratoria y Debate', 5, {'1º ESO': 20, '2º ESO': 20, '3º ESO': 20}, {'1º ESO': 21, '2º ESO': 21, '3º ESO': 21}],
  ['proyecto-educacion-plastica', 'Proyecto de Educación Plástica y Audiovisual', 4, {'2º ESO': 9}, {'2º ESO': 24}],
];

const abrirEso = () => cargarCurriculo('andalucia', 'eso', 'es');

describe('ESO de Andalucía', () => {
  it('se abre como currículo autonómico, citando el Decreto 102/2023 y la orden que lo desarrolla', async () => {
    const c = await abrirEso();
    expect(c.origen).toBe('autonomico');
    expect(c.idioma).toBe('es');
    expect(citarNormas(c.normas, 'es')).toBe(
      'Decreto 102/2023, de 9 de mayo (BOJA núm. 90, de 15 de mayo de 2023), '
      + 'desarrollado por la Orden de 30 de mayo de 2023 (BOJA núm. 104, de 2 de junio de 2023)',
    );
  });

  it('tiene las materias de los anexos II y III, en su orden', async () => {
    const { materias } = await abrirEso();
    expect(materias.map(m => [m.id, m.nombre])).toEqual(MATERIAS_ESO.map(([id, nombre]) => [id, nombre]));
  });

  it('cada materia tiene sus competencias, criterios y saberes de cada curso, con los totales del texto oficial', async () => {
    const { materias } = await abrirEso();
    for (const [id, , competencias, criterios, nSaberes] of MATERIAS_ESO) {
      const m = materia(materias, id);
      expect(m.competencias.map(c => c.n), id).toEqual(Array.from({ length: competencias }, (_, i) => i + 1));
      expect(Object.fromEntries(Object.entries(m.criterios).map(([g, l]) => [g, l.length])), id).toEqual(criterios);
      expect(Object.fromEntries(Object.keys(m.saberes).map(g => [g, saberes(m, g).length])), id).toEqual(nSaberes);
      for (const c of m.competencias) expect(c.descriptores?.length, `${id} CE${c.n}`).toBeGreaterThan(0);
    }
    const total = materias.reduce((s, m) => s + Object.values(m.criterios).flat().length, 0);
    expect(total).toBe(1063);
  });

  it('cada criterio pertenece a una competencia de la materia, sin repetirse en su curso', async () => {
    const { materias } = await abrirEso();
    for (const m of materias) {
      for (const [grupo, lista] of Object.entries(m.criterios)) {
        const ns = new Set(competenciasDe(m, grupo).map(c => c.n));
        expect(new Set(lista.map(c => c.codigo)).size, `${m.id} ${grupo}`).toBe(lista.length);
        for (const c of lista) {
          expect(ns.has(c.competencia), `${m.id} ${grupo} ${c.codigo}`).toBe(true);
          expect(c.codigo).toMatch(new RegExp(`^${c.competencia}\\.\\d+$`));
        }
      }
    }
  });

  it('una clase de un curso ve los criterios y saberes de su curso; en cuarto, Matemáticas A o B', async () => {
    const { materias } = await abrirEso();
    const r = resolverGrupo('eso', 'Biología y Geología', 3, undefined, materias)!;
    expect(r.grupo).toBe('3º ESO');
    expect(r.entry.saberes[r.grupo][0].epigrafes[0].items[0]).toMatch(/^BYG\.3\.A\.1\./);
    expect(resolverGrupo('eso', 'Matemáticas', 4, undefined, materias)).toBeNull();
    expect(resolverGrupo('eso', 'Matemáticas', 4, 'B', materias)!.grupo).toBe('Matemáticas B');
    // Matemáticas A y B no tienen apartado de competencias propio: las de Matemáticas
    const mates = materia(materias, 'matematicas');
    expect(competenciasDe(mates, 'Matemáticas A')).toEqual(competenciasDe(mates, '1º ESO'));
  });

  it('una sola Lengua Extranjera, para la primera y la segunda', async () => {
    const { materias } = await abrirEso();
    expect(materias.filter(m => /Lengua Extranjera/.test(m.nombre)).map(m => m.id)).toEqual(['lengua-extranjera']);
    // «Segunda Lengua Extranjera» no se adivina (en Madrid son dos materias): la app pregunta
    expect(emparejarMateria('Segunda Lengua Extranjera', 'eso', materias)).toBeNull();
    expect(emparejarMateria('Inglés', 'eso', materias)).toBe('Lengua Extranjera');
    expect(emparejarMateria('Flamenco', 'eso', materias)).toBe('Cultura del Flamenco');
  });

  it('lo que el BOJA trae así se copia tal cual, y las palabras partidas por la maquetación se juntan', async () => {
    const { materias } = await abrirEso();
    // Geografía e Historia, tercero: un saber con el código de cuarto
    expect(saberes(materia(materias, 'geografia-e-historia'), '3º ESO').some(s => s.startsWith('GEH.4.B.2. Tiempo histórico'))).toBe(true);
    // Matemáticas de primero, a siete columnas: «comprendien» + «do»
    const mates = materia(materias, 'matematicas');
    expect(mates.criterios['1º ESO'][0].texto).toContain('comprendiendo las preguntas formuladas');
    // Lo de los anexos III y siguientes no se cuela en la última materia del anexo II
    const tyd = materia(materias, 'tecnologia-y-digitalizacion');
    expect(tyd.criterios['2º ESO'].at(-1)!.texto).toMatch(/en el entorno más cercano\.$/);
  });
});
