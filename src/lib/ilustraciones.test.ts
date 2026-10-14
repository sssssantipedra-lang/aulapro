import { describe, it, expect } from 'vitest';
import { ILUSTRACIONES, elegirIlustraciones, ilustracionPorId, listaIlustracionesParaIA, puntuarIlustracion } from './ilustraciones';
import { ILUSTRACIONES_PROPIAS } from '../services/fichaCuaderno';
import { empiezaPalabra, pickMotifKey } from '../services/fichaMotifs';

describe('catálogo de ilustraciones', () => {
  it('cada una lleva identificador único, descripción en los tres idiomas y temas', () => {
    const ids = ILUSTRACIONES.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of ILUSTRACIONES) {
      for (const lang of ['es', 'ca', 'en'] as const) expect(i.descripcion[lang].trim(), `${i.id} sin descripción en ${lang}`).not.toBe('');
      expect(i.temas.length, `${i.id} sin temas`).toBeGreaterThan(0);
      expect(i.areas.length, `${i.id} sin áreas`).toBeGreaterThan(0);
    }
  });

  it('los temas son palabras en minúscula y sin tildes, para poder buscarlas', () => {
    for (const i of ILUSTRACIONES) {
      for (const t of i.temas) expect(t, `${i.id}: «${t}»`).toBe(t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim());
    }
  });

  it('cada dibujo propio está en el catálogo, y cada entrada `svg` tiene su dibujo', () => {
    for (const id of ILUSTRACIONES_PROPIAS) expect(ilustracionPorId(id), id).toBeTruthy();
    const svg = ILUSTRACIONES.filter(i => i.fuente === 'svg').map(i => i.id).sort();
    expect(svg).toEqual([...ILUSTRACIONES_PROPIAS].sort());
  });
});

describe('elegirIlustraciones', () => {
  const cab = (tema: string, area: string, nivel?: string) => elegirIlustraciones({ tema, area, nivel }, { uso: 'cabecera', max: 1 })[0].id;

  it('relaciona el tema y el área con la ilustración que encaja', () => {
    expect(cab('Números hasta el millón', 'Matemáticas', '5º Primaria')).toBe('cab-base10');
    expect(cab('Las fracciones', 'Matemáticas')).toBe('cab-fracciones');
    expect(cab('Perímetro de figuras planas', 'Matemáticas')).toBe('cab-geometria');
    expect(cab('Los seres vivos', 'Ciencias Naturales')).toBe('cab-naturales');
    expect(cab('La Edad Media', 'Ciencias Sociales')).toBe('cab-sociales');
    expect(cab('Greetings', 'Inglés')).toBe('cab-ingles');
    expect(cab('La amistad', 'Valores')).toBe('cab-valores');
  });

  it('una palabra que solo contiene la clave por dentro no cuenta («partes» no es «arte»)', () => {
    expect(cab('El cuento y sus partes', 'Lengua Castellana')).toBe('cab-lengua');
    expect(pickMotifKey('El cuento y sus partes', 'Lengua Castellana')).toBe('lengua');
    expect(empiezaPalabra('las partes del cuento', 'arte')).toBe(false);
    expect(empiezaPalabra('arte y artesania', 'arte')).toBe(true);
    expect(empiezaPalabra('las fracciones', 'fraccion')).toBe(true);
  });

  it('sin coincidencia, una general: nunca se queda sin cabecera', () => {
    const r = elegirIlustraciones({ tema: 'xyzzy', area: '' }, { uso: 'cabecera', max: 2 });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].areas).toContain('general');
  });

  it('solo devuelve ilustraciones del uso pedido', () => {
    const r = elegirIlustraciones({ tema: 'un consejo para recordar', area: '' }, { uso: 'mascota', max: 5 });
    expect(r.every(i => i.uso === 'mascota')).toBe(true);
  });

  it('una etapa que no es la suya resta puntos', () => {
    const base = ilustracionPorId('cab-base10')!;
    const ctx = { tema: 'Números hasta el millón', area: 'Matemáticas' };
    expect(puntuarIlustracion(base, { ...ctx, nivel: '3º Primaria' })).toBeGreaterThan(puntuarIlustracion(base, { ...ctx, nivel: '2º ESO' }));
  });

  it('la lista para la IA lleva identificador y descripción', () => {
    expect(listaIlustracionesParaIA('mascota', 'es')).toContain('mascota-chincheta (Chincheta roja');
    expect(listaIlustracionesParaIA('mascota', 'en')).toContain('(Red pin');
  });
});
