/**
 * El currículo de Primaria de la Comunitat Valenciana que lleva la app, en
 * castellano y en valenciano: el Decreto 106/2022 con el 96/2026 aplicado,
 * generado por `scripts/curriculo/primaria_cv.py`. Los totales son los del texto oficial;
 * si cambian, es que la extracción o los datos han cambiado y hay que volver a
 * comprobarlos (`docs/COMUNIDADES.md`).
 */
import { describe, it, expect } from 'vitest';
import { cargarCurriculo } from './cargar';
import { citarNormas, normasDe } from './comunidades';
import { resolverGrupo, type CurriculumEntry } from './index';
import { materiasDelCurso } from './materiasDeClase';

const abrir = (idioma: 'es' | 'ca' = 'es') => cargarCurriculo('comunitat-valenciana', 'primaria', idioma);
const materia = (materias: CurriculumEntry[], id: string) => materias.find(m => m.id === id)!;
const saberes = (m: CurriculumEntry, grupo: string) =>
  m.saberes[grupo].flatMap(b => b.epigrafes.flatMap(e => e.items));

// id, nombre del artículo 9, competencias, criterios por ciclo, bloques y saberes
const AREAS: [string, string, number, [number, number, number], number, number][] = [
  ['conocimiento-del-medio', 'Conocimiento del Medio Natural, Social y Cultural', 8, [32, 32, 32], 3, 190],
  ['educacion-plastica-y-visual', 'Educación Plástica y Visual', 6, [19, 19, 19], 2, 68],
  ['musica-y-danza', 'Música y Danza', 4, [12, 12, 12], 2, 67],
  ['educacion-fisica', 'Educación Física', 6, [20, 20, 20], 6, 88],
  ['valenciano', 'Valenciano: Lengua y Literatura', 9, [36, 36, 36], 3, 68],
  ['lengua-castellana', 'Lengua Castellana y Literatura', 9, [36, 36, 36], 3, 68],
  ['lengua-extranjera', 'Lengua Extranjera', 7, [20, 20, 20], 3, 58],
  ['matematicas', 'Matemáticas', 8, [30, 30, 30], 6, 84],
  ['educacion-en-valores', 'Educación en Valores Cívicos y Éticos', 7, [0, 0, 18], 5, 33],
];

describe('Primaria de la Comunitat Valenciana', () => {
  it('se abre como currículo autonómico, citando el 106/2022 modificado por el 96/2026', async () => {
    const c = await abrir();
    expect(c.origen).toBe('autonomico');
    expect(c.idioma).toBe('es');
    expect(c.normas).toBe(normasDe('comunitat-valenciana', 'primaria'));
    expect(c.normas.map(n => n.corto.es)).toEqual(['Decreto 106/2022, de 5 de agosto', 'Decreto 96/2026, de 19 de junio']);
  });

  it('con la app en valenciano sirve el texto en valenciano, y en inglés el castellano', async () => {
    const ca = await abrir('ca');
    expect(ca.origen).toBe('autonomico');
    expect(ca.idioma).toBe('ca');
    expect(ca.materias.map(m => m.nombre)).toEqual([
      'Coneixement del Medi Natural, Social i Cultural', 'Educació Plàstica i Visual', 'Música i Dansa',
      'Educació Física', 'Valencià: Llengua i Literatura', 'Llengua Castellana i Literatura',
      'Llengua Estrangera', 'Matemàtiques', 'Educació en Valors Cívics i Ètics',
    ]);
    expect(citarNormas(ca.normas, 'ca')).toBe(
      'Decret 106/2022, de 5 d\'agost (DOGV núm. 9402, de 10 d\'agost de 2022), '
      + 'modificat per Decret 96/2026, de 19 de juny (DOGV núm. 10391, de 25 de juny de 2026)',
    );
    expect((await cargarCurriculo('comunitat-valenciana', 'primaria', 'en')).idioma).toBe('es');
  });

  it('las dos lenguas tienen exactamente la misma forma: áreas, competencias, códigos de criterio y saberes', async () => {
    const forma = (materias: CurriculumEntry[]) => materias.map(m => ({
      id: m.id,
      competencias: m.competencias.map(c => c.n),
      criterios: Object.fromEntries(Object.entries(m.criterios).map(([g, l]) => [g, l.map(c => c.codigo)])),
      saberes: m.saberes['3'].map(b => [b.bloque, b.epigrafes.map(e => [e.n, e.items.length])]),
    }));
    expect(forma((await abrir('ca')).materias)).toEqual(forma((await abrir('es')).materias));
  });

  it('tiene las áreas del artículo 9, en su orden y con sus nombres (Religión no tiene currículo)', async () => {
    const { materias } = await abrir();
    expect(materias.map(m => [m.id, m.nombre])).toEqual(AREAS.map(([id, nombre]) => [id, nombre]));
  });

  it('cada área tiene sus competencias, criterios y saberes, con los totales del texto oficial', async () => {
    const { materias } = await abrir();
    for (const [id, , competencias, criterios, bloques, nSaberes] of AREAS) {
      const m = materia(materias, id);
      expect(m.competencias.map(c => c.n), id).toEqual(Array.from({ length: competencias }, (_, i) => i + 1));
      expect(['1', '2', '3'].map(g => m.criterios[g].length), id).toEqual(criterios);
      expect(m.saberes['3'], id).toHaveLength(bloques);
      expect(saberes(m, '3'), id).toHaveLength(nSaberes);
    }
    // Los 507 criterios del 96/2026 (las dos lenguas oficiales comparten los
    // suyos) y los 18 de Educación en Valores, que siguen siendo del 106/2022
    const delDecreto = materias.filter(m => m.id !== 'lengua-castellana');
    const total = delDecreto.reduce((s, m) => s + Object.values(m.criterios).flat().length, 0);
    expect(total).toBe(507 + 18);
  });

  it('cada criterio pertenece a una competencia del área y su código empieza por ella, sin repetirse', async () => {
    const { materias } = await abrir();
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

  it('los saberes de cada bloque son los mismos en los tres ciclos', async () => {
    const { materias } = await abrir();
    for (const m of materias) {
      expect(m.saberes['1'], m.id).toEqual(m.saberes['3']);
      expect(m.saberes['2'], m.id).toEqual(m.saberes['3']);
    }
  });

  it('Educación en Valores solo está en el tercer ciclo', async () => {
    const { materias } = await abrir();
    const ctx = (curso: number) => ({ etapa: 'primaria' as const, curso });
    expect(materiasDelCurso(ctx(2), materias)).not.toContain('Educación en Valores Cívicos y Éticos');
    expect(materiasDelCurso(ctx(4), materias)).toHaveLength(8);
    expect(materiasDelCurso(ctx(6), materias)).toContain('Educación en Valores Cívicos y Éticos');
    expect(resolverGrupo('primaria', 'Educación en Valores Cívicos y Éticos', 6, undefined, materias)?.grupo).toBe('3');
    expect(resolverGrupo('primaria', 'Educación en Valores Cívicos y Éticos', 4, undefined, materias)).toBeNull();
  });

  it('ante diferencias con el 106/2022 manda el 96/2026', async () => {
    const { materias } = await abrir();
    // Música y Danza: 5 competencias en el 106/2022, 4 en el 96/2026
    expect(materia(materias, 'musica-y-danza').competencias).toHaveLength(4);
    expect(materia(materias, 'conocimiento-del-medio').competencias[6].texto).toContain('de la Comunitat Valenciana');
    expect(materia(materias, 'lengua-extranjera').competencias[6].texto)
      .toContain('Mediar entre el grupo de interlocutores o interlocutoras');
  });

  it('los títulos de bloque y de epígrafe van sin códigos ni competencias vinculadas', async () => {
    const { materias } = await abrir();
    const medio = materia(materias, 'conocimiento-del-medio').saberes['1'];
    expect(medio.map(b => `${b.bloque}. ${b.tituloBloque}`)).toEqual([
      '1. Cultura científica', '2. Tecnología y digitalización', '3. Sociedades y territorios',
    ]);
    expect(medio[0].epigrafes.map(e => e.titulo)).toEqual([
      'Iniciación a la actividad científica', 'La vida en nuestro planeta', 'Materias, fuerza y energía',
    ]);
    expect(materia(materias, 'matematicas').saberes['1'].map(b => b.tituloBloque)[0]).toBe('Sentido numérico y de las operaciones');
    for (const m of materias) {
      for (const b of m.saberes['3']) {
        for (const t of [b.tituloBloque, ...b.epigrafes.map(e => e.titulo!)]) {
          expect(t, m.id).not.toMatch(/\bCE ?\d|^(?:SB|B\.?\d|G\d|\d+\.)|ciclo|\.$/);
        }
      }
    }
  });

  it.each(['es', 'ca'] as const)('no quedan restos de la extracción en ningún texto (%s)', async idioma => {
    const { materias } = await abrir(idioma);
    for (const m of materias) {
      const textos = [
        ...m.competencias.map(c => c.texto),
        ...Object.values(m.criterios).flat().map(c => c.texto),
        ...saberes(m, '3'),
      ];
      for (const t of textos) {
        expect(t, m.id).not.toMatch(/\u00ad| {2}|^\s|\s$|•|(?:^|\s)[xX](?:\s|$)|\w- \w/);
        expect(t.length, m.id).toBeGreaterThan(3);
      }
    }
  });

  it('conserva lo que dice el decreto, aunque parezca una errata', async () => {
    const { materias } = await abrir();
    const mates = materia(materias, 'matematicas').criterios['1'].find(c => c.codigo === '4.3')!;
    expect(mates.texto).toContain('del aula en mediante el uso');
    expect(saberes(materia(materias, 'conocimiento-del-medio'), '1')).toContain('Identificación de los estados del agua .');
    // Palabra compuesta partida al final de línea: conserva el guion
    expect(saberes(materia(materias, 'educacion-plastica-y-visual'), '1').join(' ')).toContain('figura-fondo');
    // En valenciano, las palabras partidas al final de línea se unen, y los
    // pronombres enclíticos conservan el guion
    const ca = (await abrir('ca')).materias;
    expect(saberes(materia(ca, 'conocimiento-del-medio'), '1'))
      .toContain('Ús del temps i de les formes convencionals per a mesurar-lo.');
    expect(saberes(materia(ca, 'musica-y-danza'), '1')).toContain('Formes simples. .');
  });
});
