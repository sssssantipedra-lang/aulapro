/**
 * El currículo de la ESO de la Comunitat Valenciana que lleva la app, en
 * castellano y en valenciano: el Decreto 107/2022 con el 66/2024 aplicado,
 * generado por `scripts/curriculo/eso_cv.py`. Los totales son los del texto
 * oficial; si cambian, es que la extracción o los datos han cambiado y hay
 * que volver a comprobarlos (`docs/COMUNIDADES.md`).
 */
import { describe, it, expect } from 'vitest';
import { cargarCurriculo } from './cargar';
import { citarNormas, normasDe } from './comunidades';
import { resolverGrupo, separaMatematicasAB, type CurriculumEntry } from './index';
import { materiasDelCurso } from './materiasDeClase';
import { emparejarMateria } from './mapeoMaterias';

const abrir = (idioma: 'es' | 'ca' = 'es') => cargarCurriculo('comunitat-valenciana', 'eso', idioma);
const materia = (materias: CurriculumEntry[], id: string) => materias.find(m => m.id === id)!;
const saberes = (m: CurriculumEntry, grupo: string) =>
  m.saberes[grupo].flatMap(b => b.epigrafes.flatMap(e => e.items));

// id, nombre, competencias, criterios por grupo de cursos, bloques y saberes comunes
const MATERIAS: [string, string, number, Record<string, number>, number, number][] = [
  ['biologia-y-geologia', 'Biología y Geología', 11, { '1º ESO': 38, '3º ESO': 40, '4º ESO': 40 }, 5, 50],
  ['digitalizacion', 'Digitalización', 5, { '4º ESO': 27 }, 4, 61],
  ['economia-y-emprendimiento', 'Economía y Emprendimiento', 7, { '4º ESO': 24 }, 3, 31],
  ['educacion-en-valores', 'Educación en Valores Cívicos y Éticos', 7, { '4º ESO': 23 }, 5, 39],
  ['educacion-fisica', 'Educación Física', 5, { 'Primero y segundo': 17, 'Tercero y cuarto': 17 }, 6, 105],
  ['educacion-plastica-visual-y-audiovisual', 'Educación Plástica, Visual y Audiovisual', 5, { '2º ESO': 21, '3º ESO': 21 }, 2, 50],
  ['expresion-artistica', 'Expresión Artística', 5, { '4º ESO': 17 }, 3, 27],
  ['fisica-y-quimica', 'Física y Química', 11, { '2º ESO': 41, '3º ESO': 49, '4º ESO': 56 }, 4, 116],
  ['formacion-y-orientacion', 'Formación y Orientación Personal y Profesional', 5, { '4º ESO': 23 }, 3, 53],
  ['geografia-e-historia', 'Geografía e Historia', 9, { 'Primero y segundo': 27, 'Tercero y cuarto': 27 }, 4, 91],
  ['latin', 'Latín', 5, { '4º ESO': 21 }, 4, 29],
  ['matematicas', 'Matemáticas', 8, { 'Primero y segundo': 28, '3º ESO': 29, '4º ESO': 29 }, 8, 118],
  ['musica', 'Música', 5, { 'Primero y segundo': 16, '3º ESO': 16 }, 2, 64],
  ['lengua-extranjera', 'Lengua Extranjera', 7, { 'Primero y segundo': 21, 'Tercero y cuarto': 21 }, 3, 43],
  ['tecnologia', 'Tecnología', 6, { '4º ESO': 28 }, 5, 67],
  ['tecnologia-y-digitalizacion', 'Tecnología y Digitalización', 7, { '1º ESO': 27, '3º ESO': 30 }, 7, 114],
  ['valenciano', 'Valenciano: Lengua y Literatura', 9, { 'Primero y segundo': 37, 'Tercero y cuarto': 37 }, 3, 84],
  ['lengua-castellana', 'Lengua Castellana y Literatura', 9, { 'Primero y segundo': 37, 'Tercero y cuarto': 37 }, 3, 84],
  ['artes-escenicas', 'Artes Escénicas', 5, { '4º ESO': 13 }, 3, 31],
  ['creatividad-musical', 'Creatividad Musical', 6, { '3º ESO': 16 }, 2, 27],
  ['cultura-clasica', 'Cultura Clásica', 5, { '3º ESO': 28 }, 6, 51],
  ['emprendimiento-social-y-sostenible', 'Emprendimiento Social y Sostenible', 6, { '2º ESO': 20 }, 3, 21],
  ['filosofia', 'Filosofía', 4, { '4º ESO': 13 }, 2, 13],
  ['programacion-ia-y-robotica', 'Inteligencia Artificial, Programación y Robótica', 4, { '2º ESO': 18, '3º ESO': 21 }, 3, 29],
  ['laboratorio-de-artes-escenicas', 'Laboratorio de Artes Escénicas', 4, { '1º ESO': 12 }, 3, 32],
  ['laboratorio-de-creacion-audiovisual', 'Laboratorio de Creación Audiovisual', 4, { '1º ESO': 15 }, 2, 23],
  ['segunda-lengua-extranjera', 'Segunda Lengua Extranjera', 7, { 'Perfil 1 (dos cursos)': 24, 'Perfil 2 (de primero a cuarto)': 24 }, 3, 44],
  ['taller-de-economia', 'Taller de Economía', 7, { '3º ESO': 23 }, 4, 33],
  ['taller-de-relaciones-digitales', 'Taller de Relaciones Digitales Responsables', 4, { '1º ESO': 21 }, 4, 28],
  ['finanzas-y-consumo-responsables', 'Finanzas y Consumo Responsables', 5, { '1º ESO': 18 }, 3, 45],
];

describe('ESO de la Comunitat Valenciana', () => {
  it('se abre como currículo autonómico, citando el 107/2022 modificado por el 66/2024', async () => {
    const c = await abrir();
    expect(c.origen).toBe('autonomico');
    expect(c.idioma).toBe('es');
    expect(c.normas).toBe(normasDe('comunitat-valenciana', 'eso'));
    expect(c.normas.map(n => n.corto.es)).toEqual(['Decreto 107/2022, de 5 de agosto', 'Decreto 66/2024, de 21 de junio']);
    expect(c.normas.every(n => n.verificada)).toBe(true);
  });

  it('con la app en valenciano sirve el texto en valenciano, y en inglés el castellano', async () => {
    const ca = await abrir('ca');
    expect(ca.idioma).toBe('ca');
    expect(materia(ca.materias, 'matematicas').nombre).toBe('Matemàtiques');
    expect(materia(ca.materias, 'valenciano').nombre).toBe('Valencià: Llengua i Literatura');
    expect(citarNormas(ca.normas, 'ca')).toBe(
      'Decret 107/2022, de 5 d\'agost (DOGV núm. 9403, d\'11 d\'agost de 2022), '
      + 'modificat per Decret 66/2024, de 21 de juny (DOGV núm. 9878, de 26 de juny de 2024)',
    );
    expect((await cargarCurriculo('comunitat-valenciana', 'eso', 'en')).idioma).toBe('es');
  });

  it('tiene las materias de los anexos III y IV, sin Religión, con los totales del texto oficial', async () => {
    const { materias } = await abrir();
    expect(materias.map(m => [m.id, m.nombre])).toEqual(MATERIAS.map(([id, nombre]) => [id, nombre]));
    for (const [id, , competencias, criterios, bloques, nSaberes] of MATERIAS) {
      const m = materia(materias, id);
      const grupo = Object.keys(criterios)[0];
      expect(m.competencias.map(c => c.n), id).toEqual(Array.from({ length: competencias }, (_, i) => i + 1));
      expect(Object.fromEntries(Object.entries(m.criterios).map(([g, l]) => [g, l.length])), id).toEqual(criterios);
      expect(m.saberes[grupo], id).toHaveLength(bloques);
      expect(saberes(m, grupo), id).toHaveLength(nSaberes);
    }
  });

  it('las dos lenguas tienen la misma forma, salvo las diferencias del propio decreto', async () => {
    const forma = (materias: CurriculumEntry[]) => materias.map(m => ({
      id: m.id,
      competencias: m.competencias.map(c => c.n),
      criterios: Object.fromEntries(Object.entries(m.criterios).map(([g, l]) => [g, l.map(c => c.codigo).sort()])),
      saberes: Object.fromEntries(Object.entries(m.saberes).map(([g, bs]) =>
        [g, bs.map(b => [b.bloque, b.epigrafes.map(e => e.items.length)])])),
    }));
    const es = forma((await abrir('es')).materias);
    const ca = forma((await abrir('ca')).materias);
    // Expresión Artística: el 5.3 se corta en el PDF en castellano. Física y
    // Química: en tercero, el valenciano trae un criterio más; en cuarto, dos
    // menos y dos juntos en uno (ver COMUNIDADES.md).
    const exp = ca.find(m => m.id === 'expresion-artistica')!;
    exp.criterios['4º ESO'] = exp.criterios['4º ESO'].filter(c => c !== '5.3');
    const fq = ca.find(m => m.id === 'fisica-y-quimica')!;
    fq.criterios['3º ESO'] = fq.criterios['3º ESO'].filter(c => c !== '11.5');
    fq.criterios['4º ESO'] = [...fq.criterios['4º ESO'], '1.2', '3.3', '8.2'].sort();
    expect(ca).toEqual(es);
  });

  it('un mismo código es el mismo criterio en las dos lenguas, también en Física y Química', async () => {
    const es = materia((await abrir('es')).materias, 'fisica-y-quimica').criterios['4º ESO'];
    const ca = materia((await abrir('ca')).materias, 'fisica-y-quimica').criterios['4º ESO'];
    const texto = (l: typeof es, codigo: string) => l.find(c => c.codigo === codigo)!.texto;
    expect(texto(es, '1.3')).toBe('Realizar en el laboratorio síntesis de polímeros.');
    expect(texto(ca, '1.3')).toBe('Realitzar en el laboratori síntesi de polímers.');
    expect(texto(es, '8.3')).toMatch(/^Relacionar la variación de energía mecánica/);
    expect(texto(ca, '8.3')).toMatch(/^Relacionar la variació d’energia mecànica/);
    expect(ca.some(c => c.codigo === '1.2')).toBe(false);
  });

  it('cada criterio pertenece a una competencia de la materia y su código empieza por ella, sin repetirse', async () => {
    for (const idioma of ['es', 'ca'] as const) {
      for (const m of (await abrir(idioma)).materias) {
        const ns = new Set(m.competencias.map(c => c.n));
        for (const [grupo, lista] of Object.entries(m.criterios)) {
          expect(new Set(lista.map(c => c.codigo)).size, `${m.id} ${grupo}`).toBe(lista.length);
          for (const c of lista) {
            expect(ns.has(c.competencia), `${m.id} ${c.codigo}`).toBe(true);
            expect(c.codigo.split('.')[0], `${m.id} ${c.codigo}`).toBe(String(c.competencia));
          }
        }
      }
    }
  });

  it('una errata de numeración: los criterios de la competencia 1 de tercero y cuarto se numeran 3.1 a 3.3', async () => {
    const { materias } = await abrir();
    const geh = materia(materias, 'geografia-e-historia').criterios['Tercero y cuarto'];
    expect(geh.filter(c => c.competencia === 1).map(c => [c.codigo, c.codigoLiteral])).toEqual([
      ['1.1', false], ['1.2', false], ['1.3', false],
    ]);
    expect(geh.find(c => c.codigo === '3.1')!.codigoLiteral).toBe(true);
    // Sin código en el texto, también en Economía en castellano (que numera 1., 2.…)
    expect(materia(materias, 'fisica-y-quimica').criterios['2º ESO'].every(c => !c.codigoLiteral)).toBe(true);
    expect(materia(materias, 'economia-y-emprendimiento').criterios['4º ESO'].every(c => !c.codigoLiteral)).toBe(true);
    const ca = (await abrir('ca')).materias;
    expect(materia(ca, 'economia-y-emprendimiento').criterios['4º ESO'].every(c => c.codigoLiteral)).toBe(true);
  });

  it('los saberes valen para todos los cursos, salvo la adenda de cuarto de Biología y de Física y Química', async () => {
    const { materias } = await abrir();
    for (const m of materias) {
      const [primero, ...resto] = Object.keys(m.criterios);
      for (const g of resto) {
        if (g === '4º ESO' && ['biologia-y-geologia', 'fisica-y-quimica'].includes(m.id)) continue;
        expect(m.saberes[g], `${m.id} ${g}`).toEqual(m.saberes[primero]);
      }
    }
    const bio = materia(materias, 'biologia-y-geologia').saberes['4º ESO'];
    expect(bio.map(b => `${b.bloque}. ${b.tituloBloque}`)).toEqual([
      'A. Proyecto científico', 'B. La célula', 'C. Genética', 'D. Origen y evolución de la vida', 'E. Ecosistemas', 'F. Geología',
    ]);
    const fq = materia(materias, 'fisica-y-quimica').saberes['4º ESO'];
    expect(fq[1].epigrafes.map(e => e.titulo)).toEqual([
      'Modelos atómicos, sistema periódico y enlace químico', 'La reacción química', 'Iniciación a la química del carbono',
    ]);
  });

  it('cada curso tiene sus materias; Matemáticas de cuarto no pide opción A o B', async () => {
    const { materias } = await abrir();
    const ctx = (curso: number) => ({ etapa: 'eso' as const, curso });
    expect(materiasDelCurso(ctx(1), materias)).toEqual(expect.arrayContaining([
      'Biología y Geología', 'Matemáticas', 'Música', 'Tecnología y Digitalización', 'Taller de Relaciones Digitales Responsables',
    ]));
    expect(materiasDelCurso(ctx(1), materias)).not.toContain('Física y Química');
    expect(materiasDelCurso(ctx(4), materias)).not.toContain('Música');
    expect(resolverGrupo('eso', 'Matemáticas', 2, undefined, materias)?.grupo).toBe('Primero y segundo');
    expect(resolverGrupo('eso', 'Matemáticas', 4, undefined, materias)?.grupo).toBe('4º ESO');
    expect(separaMatematicasAB('Matemáticas', materias)).toBe(false);
    expect(separaMatematicasAB('Matemáticas')).toBe(true);     // el estatal
    expect(resolverGrupo('eso', 'Geografía e Historia', 3, undefined, materias)?.grupo).toBe('Tercero y cuarto');
    // Segunda Lengua Extranjera: el perfil 2, el de quien la cursa de primero a cuarto
    for (const curso of [1, 2, 3, 4]) {
      expect(resolverGrupo('eso', 'Segunda Lengua Extranjera', curso, undefined, materias)?.grupo)
        .toBe('Perfil 2 (de primero a cuarto)');
    }
  });

  it('las asignaturas escritas a mano emparejan con su materia, en las dos lenguas', async () => {
    const es = (await abrir('es')).materias;
    const ca = (await abrir('ca')).materias;
    expect(emparejarMateria('Valenciano', 'eso', es)).toBe('Valenciano: Lengua y Literatura');
    expect(emparejarMateria('Lengua', 'eso', es)).toBe('Lengua Castellana y Literatura');
    expect(emparejarMateria('Lengua y Literatura', 'eso', es)).toBeNull();
    expect(emparejarMateria('Tecnología', 'eso', es)).toBe('Tecnología');
    expect(emparejarMateria('Robótica', 'eso', es)).toBe('Inteligencia Artificial, Programación y Robótica');
    expect(emparejarMateria('Finanzas', 'eso', es)).toBe('Finanzas y Consumo Responsables');
    expect(emparejarMateria('Matemàtiques', 'eso', ca)).toBe('Matemàtiques');
    expect(emparejarMateria('Física i Química', 'eso', ca)).toBe('Física i Química');
    expect(emparejarMateria('Anglès', 'eso', ca)).toBe('Llengua Estrangera');
    expect(emparejarMateria('Francés', 'eso', es)).toBeNull();
  });

  it.each(['es', 'ca'] as const)('no quedan restos de la extracción en ningún texto (%s)', async idioma => {
    const { materias } = await abrir(idioma);
    for (const m of materias) {
      const textos = [
        ...m.competencias.map(c => c.texto),
        ...Object.values(m.criterios).flat().map(c => c.texto),
        ...Object.values(m.saberes).flat().flatMap(b => [
          b.tituloBloque, ...b.epigrafes.flatMap(e => [...(e.titulo ? [e.titulo] : []), ...e.items]),
        ]).filter(Boolean),
      ];
      for (const t of textos) {
        expect(t, m.id).not.toMatch(/­|⁣| {2}|^\s|\s$|[•●▪]|\(cid:|(?:^|\s)[xX](?:\s|$)|\w- \w|llevem negret/);
        expect(t.length, `${m.id}: «${t}»`).toBeGreaterThanOrEqual(3);     // «Paz»
      }
      for (const c of m.competencias) expect(c.texto, `${m.id} CE${c.n}`).toMatch(/^[A-ZÁÉÍÓÚÀÈÒ¿]/);
      for (const b of Object.values(m.saberes).flat()) {
        for (const t of [b.tituloBloque, ...b.epigrafes.map(e => e.titulo ?? '')]) {
          expect(t, m.id).not.toMatch(/\bCE ?\d|\(CE|\bC\d,|\.$/);
        }
      }
    }
  });

  it('conserva lo que dice el decreto, aunque parezca una errata', async () => {
    const es = (await abrir('es')).materias;
    const ca = (await abrir('ca')).materias;
    // En castellano, Cultura Clásica lleva un epígrafe en valenciano
    expect(materia(es, 'cultura-clasica').saberes['3º ESO'][4].epigrafes.map(e => e.titulo)).toEqual(['Arte', 'Ciència']);
    expect(saberes(materia(ca, 'geografia-e-historia'), 'Primero y segundo'))
      .toContain('La Transició. L’Espanya de la democràcia. La memòria democràtica.++');
    // Palabras compuestas partidas al final de línea: conservan el guion
    expect(Object.values(materia(es, 'fisica-y-quimica').criterios).flat().map(c => c.texto).join(' '))
      .toContain('presión-volumen-temperatura');
    // Bloques sin título en el decreto
    expect(materia(es, 'filosofia').saberes['4º ESO'][0].tituloBloque).toBe('');
  });
});
