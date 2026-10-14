import { describe, expect, it } from 'vitest';
import { EJEMPLOS_FICHA, ejemploParaCurso, ejemploParaPrompt } from './fichaEjemplos';
import { perfilDeCurso, vaDeMenosAMas } from '../lib/escalera';
import { TIPOS, problemaDeEjercicio } from './resources';

const todos = Object.entries(EJEMPLOS_FICHA);

describe('las fichas de ejemplo que se enseñan a la IA', () => {
  it.each(todos)('%s: tres bloques de nivel 1, 2 y 3 que suben de menos a más', (_n, e) => {
    expect(e.actividades).toHaveLength(3);
    expect(e.actividades.map(a => a.dificultad)).toEqual([1, 2, 3]);
    expect(vaDeMenosAMas(e.actividades.map(a => a.dificultad))).toBe(true);
    expect(e.explicacion.length).toBeGreaterThan(80);
  });

  it.each(todos)('%s: sin números delante de los títulos y con la solución de cada ejercicio', (_n, e) => {
    for (const a of e.actividades) {
      expect(a.titulo).not.toMatch(/^\s*\d/);
      expect(a.titulo).not.toMatch(/nivel/i);
      expect(a.ejercicios.length).toBeGreaterThanOrEqual(2);
      for (const x of a.ejercicios) {
        expect(TIPOS).toContain(x.tipo);
        expect(x.solucion.trim()).not.toBe('');
        // Ninguno está roto según las reglas con las que la app repara lo que sale de la IA
        expect(problemaDeEjercicio(x, false)).toBeUndefined();
      }
    }
  });

  it.each(todos)('%s: el último bloque no es solo reconocer', (_n, e) => {
    const ultimo = e.actividades[2].ejercicios.map(x => x.tipo);
    expect(ultimo).not.toContain('verdadero_falso');
    expect(ultimo.some(t => t === 'problema' || t === 'abierta')).toBe(true);
  });

  it.each(todos)('%s: varios tipos de ejercicio', (_n, e) => {
    expect(new Set(e.actividades.flatMap(a => a.ejercicios.map(x => x.tipo))).size).toBeGreaterThanOrEqual(4);
  });

  it.each(todos)('%s: las tablas y los pares encajan', (_n, e) => {
    for (const x of e.actividades.flatMap(a => a.ejercicios)) {
      if (x.tipo === 'tabla_rellenar') {
        expect(x.filas!.every(f => f.length === x.columnas!.length)).toBe(true);
        expect(x.filas!.some(f => f.includes(''))).toBe(true);
      }
      if (x.tipo === 'relacionar') {
        expect(x.izquierda).toHaveLength(x.derecha!.length);
        expect(x.derecha).not.toEqual(x.izquierda);
      }
      if (x.tipo === 'completar') expect(x.enunciado).toMatch(/_{3,}/);
    }
  });
});

describe('las cuentas de los ejemplos', () => {
  const sol = (e: keyof typeof EJEMPLOS_FICHA, a: number, i: number) => EJEMPLOS_FICHA[e].actividades[a].ejercicios[i].solucion;

  it('sumas y restas', () => {
    expect(sol('sumas', 0, 0)).toBe([12 + 5, 20 + 7, 18 - 6, 30 - 10].join(', '));
    expect(sol('sumas', 1, 1)).toContain(`${45 - 20}`);
    expect(sol('sumas', 2, 0)).toContain(`${36 - (12 + 8)}`);
    expect(EJEMPLOS_FICHA.sumas.explicacion).toContain(`${24 + 10}`);
    expect(EJEMPLOS_FICHA.sumas.explicacion).toContain(`${24 + 10 - 5}`);
  });

  it('el ciclo del agua', () => {
    expect(sol('agua', 2, 0)).toContain(`${120 - 15 * 4}`);
    expect(sol('agua', 2, 0)).toContain(`${120 - 15 * 4 + 40}`);
  });

  it('rebajas y porcentajes', () => {
    expect(sol('rebajas', 0, 0)).toBe('25; 20; 18,30; 0,45');
    const tabla = EJEMPLOS_FICHA.rebajas.actividades[1].ejercicios[0].solucion;
    for (const [precio, desc, final] of [[48, 12, 36], [64, 16, 48], [18, 4.5, 13.5]]) {
      expect(precio * 0.25).toBe(desc);
      expect(precio - desc).toBe(final);
    }
    expect(tabla).toContain('4,50 €');
    expect(tabla).toContain('13,50 €');
    expect(100 - (36 + 48)).toBe(16);
    // Dos rebajas del 10 %: 80 → 72 → 64,80
    expect(80 * 0.9).toBeCloseTo(72);
    expect(72 * 0.9).toBeCloseTo(64.8);
    expect(sol('rebajas', 2, 0)).toContain('64,80');
    expect(40 * 0.75).toBe(30);
    expect(100 * 0.8 * 1.2).toBeCloseTo(96);
  });

  it('el ejemplo de 5.º y 6.º pide más que el de 4.º: decimales y varios pasos', () => {
    const texto = JSON.stringify(EJEMPLOS_FICHA.rebajas);
    expect(texto).toMatch(/\d,\d/);
    expect(texto).toContain('%');
    expect(JSON.stringify(EJEMPLOS_FICHA.sumas)).not.toMatch(/\d,\d/);
  });
});

describe('qué ejemplo recibe cada curso', () => {
  it('por tramos', () => {
    expect(ejemploParaCurso(perfilDeCurso('1º Primaria'))).toBe(EJEMPLOS_FICHA.sumas);
    expect(ejemploParaCurso(perfilDeCurso('3º Primaria'))).toBe(EJEMPLOS_FICHA.sumas);
    expect(ejemploParaCurso(perfilDeCurso('4º Primaria'))).toBe(EJEMPLOS_FICHA.agua);
    expect(ejemploParaCurso(perfilDeCurso('5º Primaria'))).toBe(EJEMPLOS_FICHA.rebajas);
    expect(ejemploParaCurso(perfilDeCurso('1º ESO'))).toBe(EJEMPLOS_FICHA.rebajas);
    expect(ejemploParaCurso(perfilDeCurso(''))).toBe(EJEMPLOS_FICHA.rebajas);
  });

  it('en el prompt: JSON válido, sin recuadros si el diseño no los lleva y con ellos si sí', () => {
    const con = JSON.parse(ejemploParaPrompt(perfilDeCurso('6º Primaria'), { cuaderno: true }));
    const sin = JSON.parse(ejemploParaPrompt(perfilDeCurso('6º Primaria'), { cuaderno: false }));
    expect(con.actividades[0].recuadro.tipo).toBe('recuerda');
    expect(con.actividades[2].recuadro.tipo).toBe('reto');
    expect(sin.actividades.every((a: { recuadro?: unknown }) => a.recuadro === undefined)).toBe(true);
    expect(con.actividades.map((a: { dificultad: number }) => a.dificultad)).toEqual([1, 2, 3]);
  });
});
