/**
 * El currículo de Primaria de la Comunidad de Madrid que lleva la app: el
 * anexo II del Decreto 61/2022, generado por `scripts/curriculo/madrid_primaria.py`.
 * Los totales son los del texto oficial (los criterios, contados también con
 * `pdftotext` por otro camino); si cambian, es que la extracción o los datos
 * han cambiado y hay que volver a comprobarlos (`docs/COMUNIDADES.md`).
 */
import { describe, it, expect } from 'vitest';
import { cargarCurriculo } from './cargar';
import { citarNormas, normasDe } from './comunidades';
import { competenciasDe, resolverGrupo, type CurriculumEntry } from './index';
import { materiasDelCurso } from './materiasDeClase';

const abrir = () => cargarCurriculo('madrid', 'primaria', 'es');
const materia = (materias: CurriculumEntry[], id: string) => materias.find(m => m.id === id)!;
const contenidos = (m: CurriculumEntry, grupo: string) =>
  (m.saberes[grupo] ?? []).flatMap(b => b.epigrafes.flatMap(e => e.items));

// id, nombre del anexo II, competencias, criterios y conocimientos por ciclo, bloques
const AREAS: [string, string, number, [number, number, number], [number, number, number], number][] = [
  ['ciencias-de-la-naturaleza', 'Ciencias de la Naturaleza', 6, [17, 18, 17], [42, 37, 34], 2],
  ['ciencias-sociales', 'Ciencias Sociales', 5, [11, 11, 11], [21, 32, 38], 1],
  ['educacion-artistica', 'Educación Artística', 4, [11, 11, 12], [33, 41, 45], 2],
  ['educacion-fisica', 'Educación Física', 5, [14, 16, 16], [28, 28, 31], 6],
  ['lengua-castellana', 'Lengua Castellana y Literatura', 10, [19, 20, 21], [29, 36, 34], 4],
  ['lengua-extranjera', 'Lengua Extranjera: Inglés', 6, [13, 15, 15], [31, 36, 39], 4],
  ['matematicas', 'Matemáticas', 8, [17, 17, 17], [38, 63, 57], 6],
  ['educacion-en-valores', 'Educación en Valores Cívicos y Éticos', 4, [0, 0, 11], [0, 0, 25], 3],
  ['segunda-lengua-extranjera', 'Segunda Lengua Extranjera', 6, [16, 16, 16], [75, 75, 75], 4],
  ['tecnologia-y-robotica', 'Tecnología y Robótica', 6, [15, 15, 15], [27, 27, 27], 6],
];

describe('Primaria de la Comunidad de Madrid', () => {
  it('se abre como currículo autonómico, en castellano, citando el 61/2022 modificado por el 59/2024', async () => {
    const c = await abrir();
    expect(c.origen).toBe('autonomico');
    expect(c.idioma).toBe('es');
    expect(c.normas).toBe(normasDe('madrid', 'primaria'));
    expect(citarNormas(c.normas, 'es')).toBe(
      'Decreto 61/2022, de 13 de julio (BOCM núm. 169, de 18 de julio de 2022), '
      + 'modificado por Decreto 59/2024, de 12 de junio (BOCM núm. 140, de 13 de junio de 2024)',
    );
    // Solo se publica en castellano: con la app en catalán o en inglés, el mismo texto
    expect((await cargarCurriculo('madrid', 'primaria', 'ca')).idioma).toBe('es');
  });

  it('tiene las áreas del artículo 7 y las dos que puede añadir el centro, en el orden del anexo II', async () => {
    const { materias } = await abrir();
    expect(materias.map(m => [m.id, m.nombre])).toEqual(AREAS.map(([id, nombre]) => [id, nombre]));
  });

  it('cada área tiene sus competencias, criterios y contenidos, con los totales del texto oficial', async () => {
    const { materias } = await abrir();
    for (const [id, , competencias, criterios, nContenidos, bloques] of AREAS) {
      const m = materia(materias, id);
      expect(m.competencias.map(c => c.n), id).toEqual(Array.from({ length: competencias }, (_, i) => i + 1));
      expect(['1', '2', '3'].map(g => m.criterios[g]?.length ?? 0), id).toEqual(criterios);
      expect(['1', '2', '3'].map(g => contenidos(m, g).length), id).toEqual(nContenidos);
      expect(m.saberes['3'], id).toHaveLength(bloques);
    }
    const total = materias.reduce((s, m) => s + Object.values(m.criterios).flat().length, 0);
    expect(total).toBe(423);
  });

  it('cada criterio pertenece a una competencia del área y su código empieza por ella, sin repetirse', async () => {
    const { materias } = await abrir();
    for (const m of materias) {
      for (const [grupo, lista] of Object.entries(m.criterios)) {
        const ns = new Set(competenciasDe(m, grupo).map(c => c.n));
        expect(new Set(lista.map(c => c.codigo)).size, `${m.id} ${grupo}`).toBe(lista.length);
        for (const c of lista) {
          expect(ns.has(c.competencia), `${m.id} ${c.codigo}`).toBe(true);
          expect(c.codigo.split('.')[0], `${m.id} ${c.codigo}`).toBe(String(c.competencia));
        }
      }
    }
  });

  it('las competencias van con el texto de cada ciclo, que el decreto cambia a veces', async () => {
    const { materias } = await abrir();
    const sociales = materia(materias, 'ciencias-sociales');
    expect(competenciasDe(sociales, '1')[0].texto).toContain('elementos o sistemas del medio, analizando');
    expect(competenciasDe(sociales, '3')[0].texto).toContain('elementos o sistemas del medio analizando');
    const lengua = materia(materias, 'lengua-castellana');
    expect(competenciasDe(lengua, '1')[8].texto).toMatch(/^Reflexionar de forma guiada sobre el lenguaje/);
    expect(competenciasDe(lengua, '3')[8].texto).toMatch(/^Reflexionar sobre el lenguaje/);
    // Donde el decreto no cambia nada, una sola lista para los tres ciclos
    const artistica = materia(materias, 'educacion-artistica');
    expect(artistica.competenciasPorGrupo).toBeUndefined();
    expect(competenciasDe(artistica, '2')).toBe(artistica.competencias);
  });

  it('los contenidos cambian de un ciclo a otro', async () => {
    const { materias } = await abrir();
    const mates = materia(materias, 'matematicas');
    expect(contenidos(mates, '1')).not.toEqual(contenidos(mates, '3'));
    expect(mates.saberes['1'].map(b => `${b.bloque}. ${b.tituloBloque}`)).toEqual([
      'A. Números y operaciones', 'B. Medida', 'C. Geometría', 'D. Álgebra', 'E. Estadística y probabilidad',
      'F. Actitudes y aprendizaje',
    ]);
    // El apartado partido entre dos páginas, entero
    expect(mates.saberes['3'][2].epigrafes.map(e => e.titulo)).toContain('Localización y sistemas de representación');
  });

  it('Educación Artística: bloque I, Música y danza, y bloque II, Educación plástica y visual', async () => {
    const { materias } = await abrir();
    const bloques = materia(materias, 'educacion-artistica').saberes['2'];
    expect(bloques.map(b => [b.bloque, b.tituloBloque, b.epigrafes.map(e => e.titulo)])).toEqual([
      ['I', 'Música y danza', ['A. Recepción y análisis', 'B. Creación e interpretación', 'C. Música y artes escénicas']],
      ['II', 'Educación plástica y visual',
        ['A. Recepción y análisis', 'B. Creación e interpretación', 'C. Artes plásticas, visuales y audiovisuales']],
    ]);
  });

  it('Lengua: los bloques sin apartados no se confunden con el anterior', async () => {
    const { materias } = await abrir();
    const bloques = materia(materias, 'lengua-castellana').saberes['1'];
    expect(bloques.map(b => [b.tituloBloque, b.epigrafes.map(e => e.titulo)])).toEqual([
      ['Las lenguas y sus hablantes', [null]],
      ['Comunicación', ['Contexto', 'Géneros discursivos', 'Procesos']],
      ['Educación literaria', [null]],
      ['Reflexión sobre la lengua y sus usos en el marco de propuestas de producción y comprensión de textos orales, escritos o multimodales', [null]],
    ]);
  });

  it('Segunda Lengua Extranjera: la misma tabla en toda la etapa, con la gramática de cada lengua', async () => {
    const { materias } = await abrir();
    const m = materia(materias, 'segunda-lengua-extranjera');
    expect(m.saberes['1']).toEqual(m.saberes['3']);
    expect(m.saberes['1'][3].tituloBloque).toBe('Contenidos sintáctico-discursivos');
    expect(m.saberes['1'][3].epigrafes.map(e => e.titulo)).toEqual(['Francés', 'Alemán', 'Italiano', 'Portugués']);
  });

  it('Educación en Valores solo está en quinto', async () => {
    const { materias } = await abrir();
    const valores = 'Educación en Valores Cívicos y Éticos';
    const ctx = (curso: number) => ({ etapa: 'primaria' as const, curso });
    expect(materiasDelCurso(ctx(5), materias)).toContain(valores);
    expect(materiasDelCurso(ctx(6), materias)).not.toContain(valores);
    expect(materiasDelCurso(ctx(3), materias)).toHaveLength(9);
    expect(resolverGrupo('primaria', valores, 5, undefined, materias)?.grupo).toBe('3');
    expect(resolverGrupo('primaria', valores, 6, undefined, materias)).toBeNull();
  });

  it('no quedan restos de la extracción en ningún texto', async () => {
    const { materias } = await abrir();
    for (const m of materias) {
      for (const grupo of Object.keys(m.criterios)) {
        const textos = [
          ...competenciasDe(m, grupo).map(c => c.texto),
          ...m.criterios[grupo].map(c => c.texto),
          ...m.saberes[grupo].flatMap(b => [b.tituloBloque, ...b.epigrafes.map(e => e.titulo ?? 'sin título')]),
          ...contenidos(m, grupo),
        ];
        for (const t of textos) {
          // Sin buscar «palabra- palabra»: el guion de final de línea se une sin
          // espacio, y los que quedan («Wh- questions», «verb- ing») son del decreto
          expect(t, m.id).not.toMatch(/\u00ad| {2}|^\s|\s$|^[-•–]|\(cid:|CICLO|CONOCIMIENTOS/);
          expect(t.length, m.id).toBeGreaterThan(3);
        }
      }
    }
  });

  it('conserva lo que dice el decreto, aunque parezca una errata', async () => {
    const { materias } = await abrir();
    const mates = materia(materias, 'matematicas');
    expect(mates.saberes['1'][5].epigrafes[0].titulo).toBe('Creencias, actitudes valoración personal');
    expect(competenciasDe(materia(materias, 'educacion-fisica'), '3')[2].texto).toContain('actitudes de, respeto');
    // Palabras compuestas partidas al final de línea: conservan el guion
    expect(contenidos(mates, '2').join(' ')).toContain('aditivo-multiplicativa');
    // En el francés falta el apóstrofo («cest»)
    expect(contenidos(materia(materias, 'segunda-lengua-extranjera'), '1').join(' ')).toContain('(cest, ce sont)');
  });
});
