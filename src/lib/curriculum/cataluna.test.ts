/**
 * El currículo de Cataluña que lleva la app: el Decret 175/2022, solo en
 * catalán, Primaria (annex 2) y ESO (annex 3), generado por
 * `scripts/curriculo/catalunya.py`. Los totales son los del texto oficial; si
 * cambian, es que la extracción o los datos han cambiado y hay que volver a
 * comprobarlos (`docs/COMUNIDADES.md`).
 */
import { describe, it, expect } from 'vitest';
import { cargarCurriculo } from './cargar';
import { citarNormas, normasDe } from './comunidades';
import { competenciasDe, resolverGrupo, separaMatematicasAB, type CurriculumEntry, type Etapa } from './index';
import { materiasDelCurso } from './materiasDeClase';
import { emparejarMateria } from './mapeoMaterias';

const abrir = (etapa: Etapa, idioma: 'es' | 'ca' | 'en' = 'ca') => cargarCurriculo('cataluna', etapa, idioma);
const materia = (materias: CurriculumEntry[], id: string) => materias.find(m => m.id === id)!;
const saberes = (m: CurriculumEntry, grupo: string) =>
  m.saberes[grupo].flatMap(b => b.epigrafes.flatMap(e => e.items));

// id, nombre, competencias, criterios por grupo de cursos y saberes por grupo
type Fila = [string, string, number, Record<string, number>, Record<string, number>];

const PRIMARIA: Fila[] = [
  ['aranes', 'Aranès i Literatura a l’Aran', 10, { 1: 23, 2: 23, 3: 23 }, { 1: 37, 2: 46, 3: 46 }],
  ['lengua-castellana', 'Llengua Castellana i Literatura', 10, { 1: 23, 2: 23, 3: 23 }, { 1: 37, 2: 46, 3: 46 }],
  ['catalan', 'Llengua Catalana i Literatura', 10, { 1: 23, 2: 23, 3: 23 }, { 1: 37, 2: 46, 3: 46 }],
  ['lengua-extranjera', 'Llengua Estrangera', 10, { 1: 23, 2: 25, 3: 25 }, { 1: 43, 2: 52, 3: 53 }],
  ['segunda-lengua-extranjera', 'Segona Llengua Estrangera', 10, { 1: 24, 2: 24, 3: 24 }, { 1: 39, 2: 39, 3: 39 }],
  ['conocimiento-del-medio', 'Coneixement del Medi Natural, Social i Cultural', 10, { 1: 32, 2: 32, 3: 33 }, { 1: 39, 2: 46, 3: 50 }],
  ['educacion-artistica', 'Educació Artística', 4, { 1: 11, 2: 11, 3: 11 }, { 1: 41, 2: 46, 3: 47 }],
  ['educacion-en-valores', 'Educació en Valors Cívics i Ètics', 4, { 3: 17 }, { 3: 28 }],
  ['educacion-fisica', 'Educació Física', 5, { 1: 15, 2: 15, 3: 15 }, { 1: 58, 2: 58, 3: 58 }],
  ['matematicas', 'Matemàtiques', 8, { 1: 19, 2: 20, 3: 21 }, { 1: 48, 2: 59, 3: 63 }],
];

const P12 = 'Primero y segundo', P34 = 'Tercero y cuarto', P13 = 'Cursos de primero a tercero', P4 = 'Cuarto curso';
const TODOS = 'Curso no especificado';
const ESO: Fila[] = [
  ['aranes', 'Aranès i Literatura a l’Aran', 10, { [P12]: 23, [P34]: 23 }, { [P12]: 39, [P34]: 41 }],
  ['lengua-castellana', 'Llengua Castellana i Literatura', 10, { [P12]: 23, [P34]: 23 }, { [P12]: 39, [P34]: 41 }],
  ['catalan', 'Llengua Catalana i Literatura', 10, { [P12]: 23, [P34]: 23 }, { [P12]: 39, [P34]: 41 }],
  ['lengua-extranjera', 'Llengua Estrangera', 10, { [P12]: 25, [P34]: 26 }, { [P12]: 31, [P34]: 31 }],
  ['segunda-lengua-extranjera', 'Segona Llengua Estrangera', 10, { [TODOS]: 23 }, { [TODOS]: 31 }],
  ['artes-escenicas', 'Arts Escèniques i Dansa', 4, { [P4]: 10 }, { [P4]: 13 }],
  ['biologia-y-geologia', 'Biologia i Geologia', 6, { [P13]: 22, [P4]: 24 }, { [P13]: 42, [P4]: 22 }],
  ['geografia-e-historia', 'Ciències Socials: Geografia i Història', 9, { [P12]: 38, [P34]: 34 }, { [P12]: 73, [P34]: 95 }],
  ['cultura-clasica', 'Cultura Clàssica', 4, { [TODOS]: 13 }, { [TODOS]: 22 }],
  ['digitalizacion', 'Digitalització', 5, { [P4]: 21 }, { [P4]: 32 }],
  ['economia-basica', 'Economia Bàsica', 5, { [P4]: 15 }, { [P4]: 27 }],
  ['educacion-en-valores', 'Educació en Valors Cívics i Ètics', 4, { [TODOS]: 18 }, { [TODOS]: 44 }],
  ['educacion-fisica', 'Educació Física', 5, { [P12]: 17, [P34]: 18 }, { [P12]: 47, [P34]: 50 }],
  ['educacion-plastica-visual-y-audiovisual', 'Educació Plàstica, Visual i Audiovisual', 6, { [P13]: 20 }, { [P13]: 12 }],
  ['expresion-artistica', 'Expressió Artística', 6, { [P4]: 20 }, { [P4]: 12 }],
  ['emprendimiento', 'Emprenedoria', 5, { [P13]: 15, [P4]: 30 }, { [P13]: 18, [P4]: 25 }],
  ['filosofia', 'Filosofia', 4, { [P4]: 11 }, { [P4]: 23 }],
  ['fisica-y-quimica', 'Física i Química', 6, { [P13]: 21, [P4]: 21 }, { [P13]: 35, [P4]: 24 }],
  ['formacion-y-orientacion', 'Formació i Orientació Personal i Professional', 5, { [P4]: 15 }, { [P4]: 33 }],
  ['latin', 'Llatí: Llengua i Cultura', 5, { [P4]: 17 }, { [P4]: 39 }],
  ['matematicas', 'Matemàtiques', 9, { [P13]: 31, [P4]: 31 }, { [P13]: 80, [P4]: 46 }],
  ['musica', 'Música', 4, { [P13]: 10, [P4]: 10 }, { [P13]: 18, [P4]: 15 }],
  ['robotica-y-programacion', 'Robòtica i Programació', 4, { [P13]: 16 }, { [P13]: 13 }],
  ['tecnologia', 'Tecnologia', 6, { [P4]: 17 }, { [P4]: 25 }],
  ['tecnologia-y-digitalizacion', 'Tecnologia i Digitalització', 7, { [P13]: 19 }, { [P13]: 26 }],
];

describe('Cataluña', () => {
  it('se abre como currículo autonómico, en catalán aunque la app esté en otro idioma, citando el 175/2022', async () => {
    for (const etapa of ['primaria', 'eso'] as const) {
      for (const idioma of ['ca', 'es', 'en'] as const) {
        const c = await abrir(etapa, idioma);
        expect(c.origen).toBe('autonomico');
        expect(c.idioma).toBe('ca');
      }
      const c = await abrir(etapa);
      expect(c.normas).toBe(normasDe('cataluna', etapa));
      expect(c.normas.every(n => n.verificada)).toBe(true);
      expect(citarNormas(c.normas, 'ca')).toBe('Decret 175/2022, de 27 de setembre (DOGC núm. 8762, de 29 de setembre de 2022)');
    }
  });

  it.each([['primaria', PRIMARIA], ['eso', ESO]] as const)('%s: las materias del annex, con los totales del texto oficial', async (etapa, filas) => {
    const { materias } = await abrir(etapa);
    expect(materias.map(m => [m.id, m.nombre])).toEqual(filas.map(([id, nombre]) => [id, nombre]));
    for (const [id, , competencias, criterios, nSaberes] of filas) {
      const m = materia(materias, id);
      expect(m.competencias.map(c => c.n), id).toEqual(Array.from({ length: competencias }, (_, i) => i + 1));
      expect(Object.fromEntries(Object.entries(m.criterios).map(([g, l]) => [g, l.length])), id)
        .toEqual(Object.fromEntries(Object.entries(criterios).map(([g, n]) => [String(g), n])));
      expect(Object.fromEntries(Object.keys(m.criterios).map(g => [g, saberes(m, g).length])), id)
        .toEqual(Object.fromEntries(Object.entries(nSaberes).map(([g, n]) => [String(g), n])));
    }
  });

  it('cada criterio pertenece a una competencia de la materia, su código empieza por ella y van seguidos', async () => {
    for (const etapa of ['primaria', 'eso'] as const) {
      for (const m of (await abrir(etapa)).materias) {
        for (const [grupo, lista] of Object.entries(m.criterios)) {
          const ns = new Set(competenciasDe(m, grupo).map(c => c.n));
          expect(new Set(lista.map(c => c.codigo)).size, `${m.id} ${grupo}`).toBe(lista.length);
          for (const c of lista) {
            expect(ns.has(c.competencia), `${m.id} ${c.codigo}`).toBe(true);
            expect(c.codigo.split('.')[0], `${m.id} ${c.codigo}`).toBe(String(c.competencia));
            expect(c.codigoLiteral).toBe(true);
          }
          for (const n of ns) {
            const subs = lista.filter(c => c.competencia === n).map(c => Number(c.codigo.split('.')[1]));
            expect(subs, `${m.id} ${grupo} CE${n}`).toEqual(subs.map((_, i) => i + 1));
          }
        }
      }
    }
  });

  it('Emprenedoria de primero a tercero y la de cuarto tienen cada una sus competencias', async () => {
    const { materias } = await abrir('eso');
    const e = materia(materias, 'emprendimiento');
    expect(competenciasDe(e, P13)).toHaveLength(5);
    expect(competenciasDe(e, P4)).toHaveLength(10);
    expect(resolverGrupo('eso', 'Emprenedoria', 2, undefined, materias)?.grupo).toBe(P13);
    expect(resolverGrupo('eso', 'Emprenedoria', 4, undefined, materias)?.grupo).toBe(P4);
  });

  it('cada curso tiene sus materias y sus saberes; Matemàtiques de cuarto no pide opción A o B', async () => {
    const primaria = (await abrir('primaria')).materias;
    expect(materiasDelCurso({ etapa: 'primaria', curso: 3 }, primaria)).not.toContain('Educació en Valors Cívics i Ètics');
    expect(materiasDelCurso({ etapa: 'primaria', curso: 6 }, primaria)).toContain('Educació en Valors Cívics i Ètics');
    const mat = materia(primaria, 'matematicas');
    expect(mat.saberes['1']).not.toEqual(mat.saberes['3']);
    expect(mat.saberes['1'].map(b => b.tituloBloque)[0]).toBe('Sentit numèric');

    const eso = (await abrir('eso')).materias;
    expect(materiasDelCurso({ etapa: 'eso', curso: 2 }, eso)).not.toContain('Filosofia');
    expect(materiasDelCurso({ etapa: 'eso', curso: 4 }, eso)).toEqual(expect.arrayContaining(['Filosofia', 'Expressió Artística']));
    expect(materiasDelCurso({ etapa: 'eso', curso: 4 }, eso)).not.toContain('Educació Plàstica, Visual i Audiovisual');
    expect(resolverGrupo('eso', 'Matemàtiques', 4, undefined, eso)?.grupo).toBe(P4);
    expect(separaMatematicasAB('Matemàtiques', eso)).toBe(false);
    // Educació en Valors y Cultura Clàssica: el centro decide el curso
    for (const curso of [1, 2, 3, 4]) {
      expect(resolverGrupo('eso', 'Educació en Valors Cívics i Ètics', curso, undefined, eso)?.grupo).toBe(TODOS);
    }
    const geh = materia(eso, 'geografia-e-historia').saberes[P12];
    expect(geh.map(b => `${b.bloque}. ${b.tituloBloque}`)[0]).toBe('A. Reptes del món actual');
  });

  it('las asignaturas escritas a mano emparejan con su materia', async () => {
    const primaria = (await abrir('primaria')).materias;
    const eso = (await abrir('eso')).materias;
    expect(emparejarMateria('Català', 'primaria', primaria)).toBe('Llengua Catalana i Literatura');
    expect(emparejarMateria('Castellano', 'primaria', primaria)).toBe('Llengua Castellana i Literatura');
    expect(emparejarMateria('Música', 'primaria', primaria)).toBe('Educació Artística');
    expect(emparejarMateria('Medi', 'primaria', primaria)).toBe('Coneixement del Medi Natural, Social i Cultural');
    expect(emparejarMateria('Emprenedoria', 'eso', eso)).toBe('Emprenedoria');
    expect(emparejarMateria('Economía', 'eso', eso)).toBe('Economia Bàsica');
    expect(emparejarMateria('Robòtica', 'eso', eso)).toBe('Robòtica i Programació');
    expect(emparejarMateria('Valenciano', 'eso', eso)).toBeNull();
  });

  it.each(['primaria', 'eso'] as const)('no quedan restos de la extracción en ningún texto (%s)', async etapa => {
    const { materias } = await abrir(etapa);
    for (const m of materias) {
      const textos = [
        ...m.competencias.map(c => c.texto),
        ...Object.values(m.competenciasPorGrupo ?? {}).flat().map(c => c.texto),
        ...Object.values(m.criterios).flat().map(c => c.texto),
        ...Object.values(m.saberes).flat().flatMap(b => [
          b.tituloBloque, ...b.epigrafes.flatMap(e => [...(e.titulo ? [e.titulo] : []), ...e.items]),
        ]),
      ];
      for (const t of textos) {
        expect(t, m.id).not.toMatch(/\(cid:|­| {2}|^\s|\s$|[●•]|^- |(?:^|\s)\d{1,2}\.\d{1,2}\s+[A-ZÀ-Ú]| ’\w/);
        expect(t.length, `${m.id}: «${t}»`).toBeGreaterThanOrEqual(3);     // «Joc»
      }
      for (const c of m.competencias) {
        expect(c.texto, `${m.id} CE${c.n}`).toMatch(/^[A-ZÀ-Ú].*\.$/);
        // La negrita del PDF pierde letras («di ersitat»): aquí tienen que estar
        expect(c.texto, `${m.id} CE${c.n}`).not.toMatch(/\b(?:di ersitat|alorar|rebut ar|afa orir|pre udicis)\b/);
      }
    }
  });
});
