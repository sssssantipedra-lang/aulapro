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
import { competenciasDe, materiasDe, resolverGrupo, type CurriculumEntry } from './index';
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

/**
 * La ESO: el anexo II del Decreto 65/2022 con el 59/2024 aplicado, generado por
 * `scripts/curriculo/madrid_eso.py`. Los criterios se contaron también con
 * `pdftotext` por otro camino.
 */
describe('ESO de la Comunidad de Madrid', () => {
  const abrirEso = () => cargarCurriculo('madrid', 'eso', 'es');

  // id, nombre, competencias y criterios por grupo de cursos
  const MATERIAS: [string, string, number, Record<string, number>][] = [
    ['biologia-y-geologia', 'Biología y Geología', 6, { '1º ESO': 17, '3º ESO': 19, '4º ESO': 16 }],
    ['ciencias-de-la-computacion', 'Ciencias de la Computación', 4, { '1º ESO': 17, '2º ESO': 15 }],
    ['cultura-clasica', 'Cultura Clásica', 5, { '3º ESO': 24, '4º ESO': 32 }],
    ['digitalizacion', 'Digitalización', 4, { '4º ESO': 16 }],
    ['economia-y-emprendimiento', 'Economía y Emprendimiento', 7, { '4º ESO': 21 }],
    ['educacion-fisica', 'Educación Física', 5, { '1º ESO': 17, '2º ESO': 17, '3º ESO': 17, '4º ESO': 17 }],
    ['educacion-plastica-visual-y-audiovisual', 'Educación Plástica, Visual y Audiovisual', 8, { '1º ESO': 27, '2º ESO': 25 }],
    ['educacion-en-valores', 'Educación en Valores Cívicos y Éticos', 4, { '2º ESO': 13 }],
    ['expresion-artistica', 'Expresión Artística', 4, { '4º ESO': 9 }],
    ['filosofia', 'Filosofía', 5, { '4º ESO': 15 }],
    ['fisica-y-quimica', 'Física y Química', 6, { '2º ESO': 14, '3º ESO': 15, '4º ESO': 15 }],
    ['formacion-y-orientacion', 'Formación y Orientación Personal y Profesional', 5, { '4º ESO': 17 }],
    ['geografia-e-historia', 'Geografía e Historia', 9, { '1º ESO': 27, '2º ESO': 32, '3º ESO': 16, '4º ESO': 16 }],
    ['latin', 'Latín', 5, { '4º ESO': 34 }],
    ['lengua-castellana', 'Lengua Castellana y Literatura', 10, { '1º ESO': 26, '2º ESO': 31, '3º ESO': 31, '4º ESO': 29 }],
    ['lengua-extranjera', 'Lengua Extranjera', 6, { '1º ESO': 15, '2º ESO': 15, '3º ESO': 16, '4º ESO': 16 }],
    ['matematicas', 'Matemáticas', 10,
      { '1º ESO': 11, '2º ESO': 17, '3º ESO': 23, 'Matemáticas A': 23, 'Matemáticas B': 23 }],
    ['musica', 'Música', 4, { '1º ESO': 6, '3º ESO': 7, '4º ESO': 9 }],
    ['segunda-lengua-extranjera', 'Segunda Lengua Extranjera', 6, { '1º ESO': 10, '2º ESO': 10, '3º ESO': 11, '4º ESO': 11 }],
    ['tecnologia-y-digitalizacion', 'Tecnología y Digitalización', 7, { '2º ESO': 15, '3º ESO': 15 }],
    ['tecnologia', 'Tecnología', 6, { '4º ESO': 17 }],
  ];

  it('se abre como currículo autonómico, citando el 65/2022 modificado por el 59/2024', async () => {
    const c = await abrirEso();
    expect(c.origen).toBe('autonomico');
    expect(citarNormas(c.normas, 'es')).toBe(
      'Decreto 65/2022, de 20 de julio (BOCM núm. 176, de 26 de julio de 2022), '
      + 'modificado por Decreto 59/2024, de 12 de junio (BOCM núm. 140, de 13 de junio de 2024)',
    );
  });

  it('tiene las materias del anexo II, con sus competencias y sus criterios en cada curso', async () => {
    const { materias } = await abrirEso();
    expect(materias.map(m => [m.id, m.nombre])).toEqual(MATERIAS.map(([id, nombre]) => [id, nombre]));
    for (const [id, , competencias, criterios] of MATERIAS) {
      const m = materia(materias, id);
      expect(m.competencias.map(c => c.n), id).toEqual(Array.from({ length: competencias }, (_, i) => i + 1));
      expect(Object.fromEntries(Object.entries(m.criterios).map(([g, l]) => [g, l.length])), id).toEqual(criterios);
      expect(Object.keys(m.saberes), id).toEqual(Object.keys(criterios));
    }
    // 894 del anexo II y los 13 de Educación en Valores, del Real Decreto
    expect(materias.reduce((s, m) => s + Object.values(m.criterios).flat().length, 0)).toBe(907);
  });

  it('cada curso tiene sus materias, y Matemáticas de cuarto, sus opciones A y B', async () => {
    const { materias } = await abrirEso();
    const curso = (n: number) => materiasDelCurso({ etapa: 'eso', curso: n }, materias);
    expect(curso(1)).toEqual([
      'Biología y Geología', 'Ciencias de la Computación', 'Educación Física', 'Educación Plástica, Visual y Audiovisual',
      'Geografía e Historia', 'Lengua Castellana y Literatura', 'Lengua Extranjera', 'Matemáticas', 'Música',
      'Segunda Lengua Extranjera',
    ]);
    expect(curso(2)).toContain('Educación en Valores Cívicos y Éticos');
    expect(curso(3)).not.toContain('Educación en Valores Cívicos y Éticos');
    expect(curso(4)).toContain('Filosofía');
    expect(resolverGrupo('eso', 'Matemáticas', 4, 'B', materias)?.grupo).toBe('Matemáticas B');
    expect(resolverGrupo('eso', 'Matemáticas', 4, undefined, materias)).toBeNull();
    expect(resolverGrupo('eso', 'Tecnología', 4, undefined, materias)?.grupo).toBe('4º ESO');
    expect(resolverGrupo('eso', 'Tecnología', 2, undefined, materias)).toBeNull();
  });

  it('cada criterio pertenece a una competencia de la materia y su código empieza por ella, sin repetirse', async () => {
    const { materias } = await abrirEso();
    for (const m of materias) {
      const ns = new Set(m.competencias.map(c => c.n));
      for (const [grupo, lista] of Object.entries(m.criterios)) {
        expect(new Set(lista.map(c => c.codigo)).size, `${m.id} ${grupo}`).toBe(lista.length);
        for (const c of lista) {
          expect(ns.has(c.competencia), `${m.id} ${c.codigo}`).toBe(true);
          expect(c.codigo.split('.')[0], `${m.id} ${c.codigo}`).toBe(String(c.competencia));
        }
      }
    }
  });

  it('una errata de numeración: manda «Competencia específica 2.», y el código queda marcado como no literal', async () => {
    const { materias } = await abrirEso();
    const plastica = materia(materias, 'educacion-plastica-visual-y-audiovisual').criterios['1º ESO'];
    const ce2 = plastica.filter(c => c.competencia === 2);
    expect(ce2.map(c => [c.codigo, c.codigoLiteral])).toEqual([
      ['2.1', false], ['2.2', false], ['2.3', false], ['2.4', false], ['2.5', false],
    ]);
    expect(plastica.filter(c => !c.codigoLiteral)).toHaveLength(5);
  });

  it('los apartados numerados son epígrafes, y Lengua Extranjera trae los de cada idioma', async () => {
    const { materias } = await abrirEso();
    const comunicacion = materia(materias, 'lengua-castellana').saberes['1º ESO'][1];
    expect(comunicacion.epigrafes.map(e => [e.n, e.titulo])).toEqual([
      [null, null], [1, 'Contexto'], [2, 'Géneros discursivos'],
      [3, 'Procesos comunicativos: hablar, escuchar, leer, escribir'],
      [null, '3.1. Hablar y escuchar'], [null, '3.2. Leer y escribir'],
      [4, 'Reconocimiento y uso discursivo de los elementos lingüísticos'],
    ]);
    const lenguas = materia(materias, 'lengua-extranjera').saberes['3º ESO'][2];
    expect(lenguas.tituloBloque).toBe('Comunicación');
    expect(lenguas.epigrafes.map(e => e.titulo)).toEqual([null, 'Alemán', 'Francés', 'Inglés', 'Italiano', 'Portugués']);
  });

  it('el Decreto 59/2024 añade su último guion a Geografía e Historia', async () => {
    const { materias } = await abrirEso();
    const historia = materia(materias, 'geografia-e-historia');
    // Curso, bloque y la última viñeta de lo añadido (sin punto: así acaba la cita en el 59/2024)
    for (const [grupo, letra, ultima] of [
      ['1º ESO', 'B', /Fuerzas y Cuerpos de Seguridad$/],
      ['2º ESO', 'B', /^Los delitos en las redes$/],
      ['3º ESO', 'B', /Misiones de Salvamento$/],
      ['4º ESO', 'D', /Misiones internacionales de Paz$/],
    ] as const) {
      const bloque = historia.saberes[grupo].find(b => b.bloque === letra)!;
      expect(bloque.tituloBloque, grupo).toBe('Retos del mundo actual');
      const items = bloque.epigrafes.at(-1)!.items;
      expect(items.indexOf('La violencia contra los demás y contra uno mismo:'), grupo).toBeGreaterThan(0);
      expect(items.at(-1), grupo).toMatch(ultima);
    }
  });

  it('Educación en Valores es la del Real Decreto 217/2022, en segundo, con lo que añade Madrid al bloque B', async () => {
    const { materias } = await abrirEso();
    const valores = materia(materias, 'educacion-en-valores');
    const estatal = materiasDe('eso').find(m => m.nombre === 'Educación en Valores Cívicos y Éticos')!;
    expect(valores.competencias).toEqual(estatal.competencias);
    expect(valores.criterios['2º ESO']).toEqual(Object.values(estatal.criterios)[0]);
    const b = valores.saberes['2º ESO'].find(x => x.bloque === 'B')!;
    expect(b.epigrafes.at(-1)!.items.at(-1)).toBe(
      'La Constitución española de 1978 y sus valores como norma fundamental de todos los españoles. '
      + 'Principios. Derechos y deberes fundamentales y sus implicaciones.',
    );
  });

  it('no quedan restos de la extracción en ningún texto', async () => {
    const { materias } = await abrirEso();
    for (const m of materias) {
      for (const grupo of Object.keys(m.criterios)) {
        const textos = [
          ...m.competencias.map(c => c.texto),
          ...m.criterios[grupo].map(c => c.texto),
          ...m.saberes[grupo].flatMap(b => [b.tituloBloque, ...b.epigrafes.map(e => e.titulo ?? 'sin título')]),
          ...contenidos(m, grupo),
        ];
        for (const t of textos) {
          expect(t, m.id).not.toMatch(/­| {2}|^\s|\s$|^[-•–−‒]|\(cid:|BOCM|Competencia específica \d/);
          expect(t.length, m.id).toBeGreaterThan(2);
        }
      }
    }
  });
});
