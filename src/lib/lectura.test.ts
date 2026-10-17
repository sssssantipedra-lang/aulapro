import { describe, expect, it } from 'vitest';
import { perfilDeCurso } from './escalera';
import { ILUSTRACIONES } from './ilustraciones';
import {
  GENEROS_LECTURA, NOMBRE_GENERO, contarPalabras, contarVersos, dibujosDeLaLectura, dibujosPorDefecto, esGenero, fraseMasLarga, frasesDe, limpiarLectura,
  listaDibujosDeLectura, longitudDeLectura, medirTexto, palabrasPorFrase, repartirDibujos, textoNumerado, type ContextoLectura, type FichaLectura,
} from './lectura';

const ctx = (nivel: string, facil = false): ContextoLectura => ({ perfil: perfilDeCurso(nivel), facil, tema: 'Un dragón', area: 'Lengua', nivel });
const palabras = (n: number) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(' ');
const IMG = ILUSTRACIONES.filter(i => i.fuente === 'img').map(i => i.id);

describe('cuánto mide el texto de cada curso', () => {
  it('crece con el curso y tiene los dibujos que caben', () => {
    const l = (n: string, facil = false) => longitudDeLectura(perfilDeCurso(n), facil);
    for (let c = 1; c < 6; c++) {
      expect(l(`${c + 1}º Primaria`).palabras[1]).toBeGreaterThan(l(`${c}º Primaria`).palabras[1]);
    }
    expect(l('1º Primaria').dibujos).toBe(3);
    expect(l('1º ESO').palabras[0]).toBeGreaterThanOrEqual(350);
    expect(l('3º ESO').dibujos).toBe(2);
    // Sin curso, un término medio
    expect(l('').palabras[0]).toBeGreaterThan(100);
  });

  it('en lectura fácil, un cuarto menos de palabras y algún párrafo más', () => {
    const normal = longitudDeLectura(perfilDeCurso('5º Primaria'));
    const facil = longitudDeLectura(perfilDeCurso('5º Primaria'), true);
    expect(facil.palabras[1]).toBeLessThan(normal.palabras[1] * 0.8);
    expect(facil.palabras[0]).toBeLessThan(normal.palabras[0]);
    expect(facil.parrafos[1]).toBe(normal.parrafos[1] + 1);
  });
});

describe('medir un texto', () => {
  it('cuenta palabras, versos y frases', () => {
    expect(contarPalabras(['Hola mundo.', 'Otra **frase** más.'])).toBe(5);
    expect(contarPalabras(['', '  ', '—'])).toBe(0);
    expect(contarVersos(['uno\ndos\n\ntres', 'cuatro'])).toBe(4);
    expect(frasesDe(['Hola. ¿Qué tal? Bien\nadiós'])).toHaveLength(4);
    expect(palabrasPorFrase(['Una dos tres. Cuatro cinco.'])).toBeCloseTo(2.5);
    expect(fraseMasLarga(['Una dos tres. Cuatro.'])).toBe(3);
  });

  it('un texto del largo del curso no da problemas', () => {
    const long = longitudDeLectura(perfilDeCurso('4º Primaria'));
    const texto = { genero: 'cuento' as const, parrafos: [`${palabras(100)}.`, `${palabras(100)}.`] };
    expect(medirTexto(texto, long, false).problemas).toEqual([]);
  });

  it('demasiado corto o demasiado largo: dice cuánto tiene que medir', () => {
    const long = longitudDeLectura(perfilDeCurso('4º Primaria'));
    const corto = medirTexto({ genero: 'cuento', parrafos: ['Hola mundo.'] }, long, false);
    expect(corto.problemas[0]).toContain(`entre ${long.palabras[0]} y ${long.palabras[1]}`);
    const largo = medirTexto({ genero: 'cuento', parrafos: [`${palabras(600)}.`] }, long, false);
    expect(largo.problemas[0]).toContain('demasiado largo');
  });

  it('un poema se mide en versos, no en palabras', () => {
    const long = longitudDeLectura(perfilDeCurso('3º Primaria'));
    const versos = Array.from({ length: 12 }, (_, i) => `verso ${i}`);
    expect(medirTexto({ genero: 'poema', parrafos: [versos.slice(0, 4).join('\n'), versos.slice(4, 8).join('\n'), versos.slice(8).join('\n')] }, long, false).problemas).toEqual([]);
    expect(medirTexto({ genero: 'poema', parrafos: ['uno\ndos'] }, long, false).problemas[0]).toContain('versos');
  });

  it('lectura fácil: frases cortas y palabras clave en negrita', () => {
    const long = longitudDeLectura(perfilDeCurso('4º Primaria'), true);
    const frase = `${palabras(30)}.`;
    const largas = medirTexto({ genero: 'cuento', parrafos: [`${frase} ${frase} ${frase}`] }, long, true);
    expect(largas.problemas.some(p => p.includes('frases miden'))).toBe(true);
    expect(largas.problemas.some(p => p.includes('negrita'))).toBe(true);
    const buena = `**Brasas** vive en un **monte**. Tiene **alas** pequeñas. Le gusta el **fuego**. `.repeat(6);
    expect(medirTexto({ genero: 'cuento', parrafos: [buena] }, long, true).problemas.filter(p => !p.includes('palabras'))).toEqual([]);
    // Sin lectura fácil, las negritas no se piden
    expect(medirTexto({ genero: 'cuento', parrafos: [`${palabras(100)}.`, `${palabras(100)}.`] }, longitudDeLectura(perfilDeCurso('4º Primaria')), false).problemas).toEqual([]);
  });
});

describe('limpiarLectura: lo que devuelve la IA, comprobado', () => {
  const buenos = ['cue-dragon', 'cue-princesa', 'cue-mago'];
  const raw = (extra: Record<string, unknown> = {}) => ({
    titulo: '1. El dragón', genero: 'cuento', parrafos: ['Uno.', 'Dos.', 'Tres.', 'Cuatro.'],
    dibujos: [{ ilustracion: buenos[0], parrafo: 1 }, { ilustracion: buenos[1], parrafo: 3 }], pista: 'Fíjate en el dragón.', destrezas: ['Vocabulario'], ...extra,
  });

  it('título sin número, párrafos sin vacíos y dibujos en su párrafo (de 1 a 0)', () => {
    const r = limpiarLectura(raw({ parrafos: ['Uno.', '  ', 'Dos.', 'Tres.', 'Cuatro.'] }), ctx('4º Primaria'))!;
    expect(r.titulo).toBe('El dragón');
    expect(r.lectura.parrafos).toEqual(['Uno.', 'Dos.', 'Tres.', 'Cuatro.']);
    expect(r.lectura.dibujos).toEqual([{ ilustracion: 'cue-dragon', parrafo: 0 }, { ilustracion: 'cue-princesa', parrafo: 2 }]);
    expect(r.lectura.pista).toBe('Fíjate en el dragón.');
    expect(r.lectura.destrezas).toEqual(['Vocabulario']);
  });

  it('descarta dibujos inventados, repetidos, en párrafos que no existen o dos en el mismo párrafo', () => {
    const r = limpiarLectura(raw({
      dibujos: [
        { ilustracion: 'cue-dragon', parrafo: 1 }, { ilustracion: 'inventado', parrafo: 2 }, { ilustracion: 'cue-dragon', parrafo: 3 },
        { ilustracion: 'cue-princesa', parrafo: 1 }, { ilustracion: 'cue-mago', parrafo: 9 }, { ilustracion: 'cue-hada', parrafo: 0 }, { ilustracion: 'cue-rey', parrafo: 4 },
      ],
    }), ctx('4º Primaria'))!;
    expect(r.lectura.dibujos).toEqual([{ ilustracion: 'cue-dragon', parrafo: 0 }, { ilustracion: 'cue-rey', parrafo: 3 }]);
  });

  it('solo caben los dibujos del curso (2 en ESO)', () => {
    const muchos = { dibujos: ['cue-dragon', 'cue-princesa', 'cue-mago', 'cue-hada'].map((ilustracion, i) => ({ ilustracion, parrafo: i + 1 })) };
    expect(limpiarLectura(raw(muchos), ctx('4º Primaria'))!.lectura.dibujos).toHaveLength(3);
    expect(limpiarLectura(raw(muchos), ctx('1º ESO'))!.lectura.dibujos).toHaveLength(2);
  });

  it('sin dibujos válidos, los pone el código por el tema y repartidos por el texto', () => {
    const r = limpiarLectura(raw({ dibujos: [{ ilustracion: 'nada', parrafo: 1 }] }), ctx('4º Primaria'))!;
    expect(r.lectura.dibujos.length).toBeGreaterThan(0);
    expect(r.lectura.dibujos.every(d => IMG.includes(d.ilustracion) && d.parrafo >= 0 && d.parrafo < 4)).toBe(true);
    expect(new Set(r.lectura.dibujos.map(d => d.parrafo)).size).toBe(r.lectura.dibujos.length);
  });

  it('un género que no existe es un cuento; un poema conserva sus versos y la prosa no', () => {
    expect(limpiarLectura(raw({ genero: 'novela' }), ctx('4º Primaria'))!.lectura.genero).toBe('cuento');
    const poema = limpiarLectura(raw({ genero: 'poema', parrafos: ['a\nb\nc', 'd\ne'] }), ctx('4º Primaria'))!;
    expect(poema.lectura.parrafos).toEqual(['a\nb\nc', 'd\ne']);
    const prosa = limpiarLectura(raw({ parrafos: ['una\nfrase partida'] }), ctx('4º Primaria'))!;
    expect(prosa.lectura.parrafos).toEqual(['una frase partida']);
  });

  it('la pista se acorta y se queda sin negritas; las destrezas, como mucho dos y cortas', () => {
    const r = limpiarLectura(raw({ pista: `**Fíjate** ${palabras(60)}`, destrezas: ['Vocabulario.', 'Rimas', 'Una tercera', 'x'.repeat(60)] }), ctx('4º Primaria'))!;
    expect(r.lectura.pista!.length).toBeLessThanOrEqual(151);
    expect(r.lectura.pista).not.toContain('**');
    expect(r.lectura.destrezas).toEqual(['Vocabulario', 'Rimas']);
  });

  it('sin título o sin texto, nada', () => {
    expect(limpiarLectura(raw({ titulo: '  ' }), ctx('4º Primaria'))).toBeNull();
    expect(limpiarLectura(raw({ parrafos: ['', ' '] }), ctx('4º Primaria'))).toBeNull();
    expect(limpiarLectura(null, ctx('4º Primaria'))).toBeNull();
    expect(limpiarLectura('texto', ctx('4º Primaria'))).toBeNull();
  });
});

describe('dibujos junto a los párrafos', () => {
  it('repartirDibujos: uno por párrafo, empezando por el primero y a la misma distancia', () => {
    expect(repartirDibujos(['a', 'b', 'c'], 6)).toEqual([{ ilustracion: 'a', parrafo: 0 }, { ilustracion: 'b', parrafo: 2 }, { ilustracion: 'c', parrafo: 4 }]);
    expect(repartirDibujos(['a', 'b', 'c'], 2)).toEqual([{ ilustracion: 'a', parrafo: 0 }, { ilustracion: 'b', parrafo: 1 }]);
    expect(repartirDibujos([], 5)).toEqual([]);
    expect(repartirDibujos(['a'], 0)).toEqual([]);
  });

  it('dibujosPorDefecto sale del catálogo, con el tema del texto', () => {
    const d = dibujosPorDefecto(ctx('4º Primaria'), 'El dragón y la princesa', ['Un dragón y una princesa en un castillo.']);
    expect(d.length).toBeGreaterThan(0);
    expect(d.every(x => IMG.includes(x.ilustracion))).toBe(true);
  });

  it('dibujosDeLaLectura: sin repetir y sin lectura, nada', () => {
    expect(dibujosDeLaLectura({ dibujos: [{ ilustracion: 'a', parrafo: 0 }, { ilustracion: 'a', parrafo: 1 }, { ilustracion: 'b', parrafo: 2 }] })).toEqual(['a', 'b']);
    expect(dibujosDeLaLectura(undefined)).toEqual([]);
  });
});

describe('para los prompts', () => {
  const l: FichaLectura = { genero: 'cuento', parrafos: ['Uno.', 'Dos.'], dibujos: [] };
  it('textoNumerado: los párrafos entre corchetes y los versos con barras', () => {
    expect(textoNumerado(l)).toBe('[1] Uno.\n[2] Dos.');
    expect(textoNumerado({ genero: 'poema', parrafos: ['a\nb'] })).toBe('[1] a / b');
  });

  it('la lista de dibujos para la IA trae solo imágenes del catálogo, una por línea y con lo que se ve', () => {
    const lista = listaDibujosDeLectura('es').split('\n');
    expect(lista.length).toBeGreaterThan(250);
    expect(lista).toContain(lista.find(x => x.startsWith('cue-dragon:'))!);
    expect(lista.every(x => /^[a-z0-9-]+: .+/.test(x))).toBe(true);
    expect(lista.some(x => x.startsWith('cab-'))).toBe(false);
  });

  it('los géneros y sus nombres', () => {
    expect(GENEROS_LECTURA).toHaveLength(7);
    for (const g of GENEROS_LECTURA) { expect(esGenero(g)).toBe(true); expect(NOMBRE_GENERO[g]).toBeTruthy(); }
    expect(esGenero('novela')).toBe(false);
  });
});
