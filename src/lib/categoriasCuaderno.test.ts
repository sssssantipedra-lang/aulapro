import { describe, it, expect } from 'vitest';
import { explicacionDePropuestas, propuestasDeCategorias, tiposDeAsignatura } from './categoriasCuaderno';

const ids = (asignatura: string, materia?: string | null) => propuestasDeCategorias(asignatura, 'es', materia).map(p => p.id);

describe('propuestas de categorías para empezar el cuaderno', () => {
  it('cualquier asignatura tiene la típica, y solo ella si no es de una materia con propuesta propia', () => {
    expect(ids('Matemáticas')).toEqual(['tipica']);
    expect(ids('Lengua Castellana y Literatura')).toEqual(['tipica']);
    expect(ids('Religión')).toEqual(['tipica']);
    expect(ids('')).toEqual(['tipica']);
  });

  it('Educación Física conserva sus tres componentes, 40, 30 y 30', () => {
    const [ef, tipica] = propuestasDeCategorias('Educación Física', 'es');
    expect(ef.id).toBe('ef');
    expect(ef.categorias).toEqual([
      { name: 'Componente motriz', weight: 40 },
      { name: 'Componente cognitivo', weight: 30 },
      { name: 'Componente social y relacional', weight: 30 },
    ]);
    expect(tipica.categorias.map(c => c.weight)).toEqual([60, 30, 10]);
    expect(ids('EF')).toEqual(['ef', 'tipica']);
  });

  it('una lengua extranjera se ofrece por destrezas, se llame como se llame', () => {
    for (const n of ['Inglés', 'INGLES', 'English', 'Anglès', 'Francés', 'Segunda Lengua Extranjera: Francés', 'Llengua Estrangera', 'Alemán', 'Lengua Inglesa', 'Llengua anglesa', 'Lengua francesa']) {
      expect(ids(n), n).toEqual(['lengua-extranjera', 'tipica']);
    }
    expect(propuestasDeCategorias('Inglés', 'es')[0].categorias.map(c => c.name))
      .toEqual(['Comprensión oral', 'Expresión oral', 'Comprensión escrita', 'Expresión escrita']);
  });

  it('las lenguas propias no son lenguas extranjeras', () => {
    expect(ids('Lengua Castellana')).toEqual(['tipica']);
    expect(ids('Valencià: Llengua i Literatura')).toEqual(['tipica']);
    expect(ids('Llengua Catalana i Literatura')).toEqual(['tipica']);
  });

  it('Música y Plástica tienen las suyas', () => {
    expect(ids('Música')).toEqual(['musica', 'tipica']);
    expect(ids('Música y Danza')).toEqual(['musica', 'tipica']);
    expect(ids('Music')).toEqual(['musica', 'tipica']);
    expect(ids('Plástica')).toEqual(['plastica', 'tipica']);
    expect(ids('Educación Plástica, Visual y Audiovisual')).toEqual(['plastica', 'tipica']);
    expect(ids('Educació Plàstica i Visual')).toEqual(['plastica', 'tipica']);
    expect(ids('Art')).toEqual(['plastica', 'tipica']);
    // «Artes escénicas» no es plástica
    expect(ids('Artes Escénicas')).toEqual(['tipica']);
    expect(ids('Arts Escèniques')).toEqual(['tipica']);
  });

  it('Educación Artística, que reúne las dos, ofrece las dos', () => {
    expect(ids('Educación Artística')).toEqual(['plastica', 'musica', 'tipica']);
    expect(ids('Educació Artística')).toEqual(['plastica', 'musica', 'tipica']);
  });

  it('si el nombre no lo dice, manda la materia oficial de la clase', () => {
    expect(ids('Idioma', 'lengua-extranjera')).toEqual(['lengua-extranjera', 'tipica']);
    expect(ids('Taller', 'musica-y-danza')).toEqual(['musica', 'tipica']);
    expect(ids('Artística', 'educacion-artistica')).toEqual(['plastica', 'musica', 'tipica']);
    expect(ids('Proyecto', 'educacion-fisica')).toEqual(['ef', 'tipica']);
    // Las clases de antes guardaban el nombre de la materia
    expect(ids('Taller', 'Música')).toEqual(['musica', 'tipica']);
    // En modo libre (null) o con una materia sin propuesta, la típica
    expect(ids('Taller', null)).toEqual(['tipica']);
    expect(ids('Taller', 'matematicas')).toEqual(['tipica']);
  });

  it('el nombre que puso el docente manda sobre la materia oficial', () => {
    // «Música» dentro del área de Educación Artística de Madrid o Andalucía
    expect(ids('Música', 'educacion-artistica')).toEqual(['musica', 'tipica']);
  });

  it('todas las propuestas suman 100 y salen en los tres idiomas', () => {
    for (const lang of ['es', 'ca', 'en'] as const) {
      for (const n of ['Educación Física', 'Inglés', 'Música', 'Plástica', 'Matemáticas']) {
        for (const p of propuestasDeCategorias(n, lang)) {
          expect(p.categorias.reduce((a, c) => a + c.weight, 0), `${n} ${p.id} ${lang}`).toBe(100);
          expect(p.categorias.every(c => c.name.trim() !== '')).toBe(true);
          // El botón dice los pesos que crea
          expect(p.boton).toContain(`(${p.categorias.map(c => c.weight).join('/')})`);
        }
      }
    }
    expect(propuestasDeCategorias('Inglés', 'en')[0].categorias.map(c => c.name)).toEqual(['Listening', 'Speaking', 'Reading', 'Writing']);
    expect(propuestasDeCategorias('Música', 'ca')[0].categorias.map(c => c.name)).toEqual(['Interpretació', 'Escolta', 'Creació']);
  });

  it('un idioma desconocido sale en castellano', () => {
    expect(propuestasDeCategorias('Música', 'fr' as never)[0].categorias[0].name).toBe('Interpretación');
  });

  it('la explicación dice por qué se propone lo que se propone', () => {
    expect(explicacionDePropuestas(tiposDeAsignatura('Inglés'))).toContain('es una lengua extranjera');
    expect(explicacionDePropuestas(tiposDeAsignatura('Música'))).toContain('es de música');
    expect(explicacionDePropuestas(tiposDeAsignatura('Plástica'))).toContain('es de plástica');
    expect(explicacionDePropuestas(tiposDeAsignatura('Educación Artística'))).toContain('reúne plástica y música');
    expect(explicacionDePropuestas(tiposDeAsignatura('Educación Física'))).toContain('En Educación Física');
    expect(explicacionDePropuestas(tiposDeAsignatura('Matemáticas'))).toContain('la configuración más habitual');
  });
});

describe('textos de las propuestas', () => {
  it('cada botón y cada explicación están en inglés y en catalán (no pasan por t() con el texto escrito)', async () => {
    const { EN_DICT } = await import('../i18n');
    const { CA } = await import('../i18n/ca');
    const claves = new Set<string>();
    for (const n of ['Educación Física', 'Inglés', 'Música', 'Plástica', 'Educación Artística', 'Matemáticas']) {
      for (const p of propuestasDeCategorias(n, 'es')) claves.add(p.boton);
      claves.add(explicacionDePropuestas(tiposDeAsignatura(n)));
    }
    for (const c of claves) {
      expect(EN_DICT[c], c).toBeTruthy();
      expect(CA[c], c).toBeTruthy();
    }
  });
});
