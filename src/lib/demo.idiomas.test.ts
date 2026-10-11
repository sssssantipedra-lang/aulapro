/**
 * Los datos de ejemplo salen en el idioma de la aplicación: en inglés y en
 * catalán no queda ningún texto suyo en castellano, el alumnado se llama
 * «Student 1» o «Alumne 1», y los programas de PT y AL llevan el nombre
 * oficial del PAP en esa lengua.
 */
import { describe, it, expect } from 'vitest';
import { buildDemoData } from './demoData';
import { buildDemoEF } from './demoEF';
import { buildDemoApoyo } from './demoApoyo';
import { ambitosDe } from './apoyo';
import { DEMO_CA, DEMO_EN } from '../i18n/demo';
import { translate, type Lang } from '../i18n/core';

/** Todos los textos de un objeto, a cualquier profundidad. */
function textos(x: unknown, out: string[] = []): string[] {
  if (typeof x === 'string') out.push(x);
  else if (Array.isArray(x)) x.forEach(v => textos(v, out));
  else if (x && typeof x === 'object') Object.values(x).forEach(v => textos(v, out));
  return out;
}

const hoy = new Date(2026, 9, 5);
const todos = (lang: Lang) => textos([buildDemoData(lang), buildDemoEF(hoy, lang), buildDemoApoyo(hoy, lang)]);

describe('datos de ejemplo en cada idioma', () => {
  for (const [lang, dict] of [['en', DEMO_EN], ['ca', DEMO_CA]] as const) {
    it(`en ${lang}, ningún texto se queda en castellano`, () => {
      // Sin el nombre oficial de cada materia, que es el del currículo y va en castellano a propósito
      const oficiales = new Set([...buildDemoData(lang).classes, ...buildDemoEF(hoy, lang).classes]
        .flatMap(c => Object.values(c.materiasOficiales ?? {})).filter((m): m is string => !!m));
      const salen = new Set(todos(lang).filter(s => !oficiales.has(s)));
      // Las claves con {variables} se comprueban por su forma ya rellenada más abajo
      const sinTraducir = Object.keys(dict).filter(k => dict[k] !== k && !k.includes('{') && salen.has(k));
      expect(sinTraducir).toEqual([]);
      expect([...salen].filter(s => /^Alumno \d+$/.test(s))).toEqual([]);
      expect([...salen].some(s => /^Llamar a la familia/.test(s))).toBe(false);
    });
  }

  it('las asignaturas se traducen, pero su materia oficial sigue siendo la del currículo', () => {
    const [c1] = buildDemoData('en').classes;
    expect(c1.subjects).toEqual(['Mathematics', 'Biology and Geology', translate('en', 'Tutoría')]);
    expect(buildDemoData('ca').classes[0].subjects.slice(0, 2)).toEqual(['Matemàtiques', 'Biologia i Geologia']);
    expect(Object.values(c1.materiasOficiales ?? {})).toEqual(['Matemáticas', 'Biología y Geología', null]);
    const ef = buildDemoEF(hoy, 'ca').classes[0];
    expect(ef.subject).toBe('Educació Física');
    expect(ef.materiasOficiales).toEqual({ 'Educació Física': 'Educación Física' });
  });

  it('el alumnado y los programas de PT y AL, en su idioma', () => {
    const ca = buildDemoApoyo(hoy, 'ca');
    expect(ca.alumnos.map(a => a.nombre)).toEqual(['Alumne 1', 'Alumne 2', 'Alumne 3', 'Alumne 4']);
    const oficiales = new Set(ambitosDe('comunitat-valenciana', 'ca').ambitos.map(a => a.nombre));
    expect(ca.programas.every(p => oficiales.has(p.ambito))).toBe(true);
    expect(buildDemoApoyo(hoy, 'en').alumnos[0].nombre).toBe('Student 1');
    // En castellano, como siempre
    expect(buildDemoApoyo(hoy).grupos[0].nombre).toBe('Lectoescritura, 2º ciclo');
  });
});
