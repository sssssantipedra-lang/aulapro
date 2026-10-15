import { describe, expect, it } from 'vitest';
import {
  avisoDeSubida, dificultadesPorPosicion, esAreaNumerica, estrellas, expectativas, normalizarEscalera, perfilDeCurso, planDeBloques, planParaPrompt,
  rangoNumerico, vaDeMenosAMas,
} from './escalera';

describe('perfilDeCurso', () => {
  it.each([
    ['5º de Primaria', 'primaria', 5, 'ciclo3'],
    ['6º Primaria', 'primaria', 6, 'ciclo3'],
    ['2.º Primaria', 'primaria', 2, 'ciclo1'],
    ['4º de primaria', 'primaria', 4, 'ciclo2'],
    ['3r de Primària', 'primaria', 3, 'ciclo2'],
    ['1º ESO', 'eso', 1, 'eso'],
    ['3r d\'ESO', 'eso', 3, 'eso'],
    ['1º Bachillerato', 'bachillerato', 1, 'bachillerato'],
    ['Year 5 Primary', 'primaria', 5, 'ciclo3'],
    ['Quinto', 'primaria', 5, 'ciclo3'],
    ['Sexto de primaria', 'primaria', 6, 'ciclo3'],
    ['Cinquè de primària', 'primaria', 5, 'ciclo3'],
    ['Grupo A', 'otra', 0, 'otra'],
  ])('%s', (texto, etapa, curso, banda) => {
    const p = perfilDeCurso(texto);
    expect(p.etapa).toBe(etapa);
    expect(p.curso).toBe(curso);
    expect(p.banda).toBe(banda);
  });

  it('sin curso no se sabe nada, y con 1 a 4 sin etapa tampoco', () => {
    expect(perfilDeCurso('').banda).toBe('otra');
    expect(perfilDeCurso(undefined).banda).toBe('otra');
    expect(perfilDeCurso('3º').banda).toBe('otra');
  });

  it('un año suelto no se toma por un curso', () => {
    expect(perfilDeCurso('curso 2026').curso).toBe(0);
  });

  it('solo 5.º y 6.º de Primaria suben de nivel', () => {
    expect(perfilDeCurso('5º Primaria').sube).toBe(true);
    expect(perfilDeCurso('6º Primaria').sube).toBe(true);
    expect(perfilDeCurso('4º Primaria').sube).toBe(false);
    expect(perfilDeCurso('1º ESO').sube).toBe(false);
  });
});

describe('expectativas y subida', () => {
  it('cada peldaño dice algo distinto en cada banda', () => {
    for (const nivel of ['2º Primaria', '4º Primaria', '6º Primaria', '2º ESO', '']) {
      const e = expectativas(perfilDeCurso(nivel));
      expect(new Set([e[1], e[2], e[3]]).size).toBe(3);
    }
  });

  it('5.º y 6.º piden más que 4.º: números grandes, decimales y varios pasos', () => {
    const alto = expectativas(perfilDeCurso('6º Primaria'));
    const medio = expectativas(perfilDeCurso('4º Primaria'));
    expect(alto[1]).toMatch(/decimales/);
    expect(alto[1]).toMatch(/seis cifras/);
    expect(medio[1]).not.toMatch(/decimales/);
    expect(alto[3]).toMatch(/tres pasos/);
  });

  it('el aviso de subida solo sale en 5.º y 6.º', () => {
    expect(avisoDeSubida(perfilDeCurso('5º Primaria'))).toMatch(/5\.º de Primaria/);
    expect(avisoDeSubida(perfilDeCurso('6º Primaria'))).toMatch(/sube un punto/);
    expect(avisoDeSubida(perfilDeCurso('4º Primaria'))).toBe('');
    expect(avisoDeSubida(perfilDeCurso('2º ESO'))).toBe('');
  });
});

describe('fichas de cálculo y fichas que no lo son', () => {
  it('se reconocen por el área o por el tema', () => {
    expect(esAreaNumerica('Matemáticas', 'Los decimales')).toBe(true);
    expect(esAreaNumerica('Matemàtiques', '')).toBe(true);
    expect(esAreaNumerica('Física y Química', 'La energía')).toBe(true);
    expect(esAreaNumerica('', 'Las fracciones')).toBe(true);
    expect(esAreaNumerica('', 'Porcentajes y descuentos')).toBe(true);
    expect(esAreaNumerica('Ciencias Naturales', 'El cuerpo humano: los órganos y sus funciones')).toBe(false);
    expect(esAreaNumerica('Geografía e Historia', 'La Edad Media')).toBe(false);
    expect(esAreaNumerica('Lengua', 'El sustantivo')).toBe(false);
    expect(esAreaNumerica(undefined, undefined)).toBe(false);
  });

  it('sin área ni tema se supone de cálculo; con ellos, lo que digan', () => {
    expect(perfilDeCurso('6º Primaria').numerica).toBe(true);
    expect(perfilDeCurso('6º Primaria', { area: 'Ciencias Naturales', tema: 'El cuerpo humano' }).numerica).toBe(false);
    expect(perfilDeCurso('6º Primaria', { area: 'Matemáticas', tema: 'Decimales' }).numerica).toBe(true);
  });

  it('en ciencias, 5.º y 6.º suben sin pedir cifras ni decimales; en matemáticas, con ellos', () => {
    const ciencias = perfilDeCurso('6º Primaria', { area: 'Ciencias Naturales', tema: 'El cuerpo humano' });
    const e = expectativas(ciencias);
    for (const d of [1, 2, 3] as const) expect(e[d]).not.toMatch(/cifras|decimales|fracciones|porcentajes/);
    expect(e[1]).toMatch(/vocabulario técnico/);
    expect(e[3]).toMatch(/situación nueva/);
    expect(avisoDeSubida(ciencias)).toMatch(/sube un punto/);
    expect(avisoDeSubida(ciencias)).not.toMatch(/números del curso/);
    const mates = perfilDeCurso('6º Primaria', { area: 'Matemáticas', tema: 'Decimales' });
    expect(expectativas(mates)[1]).toMatch(/seis cifras/);
    expect(avisoDeSubida(mates)).toMatch(/números del curso/);
  });

  it('los otros ciclos no hablan de números en las fichas que no son de cálculo', () => {
    for (const nivel of ['1º Primaria', '4º Primaria']) {
      const e = expectativas(perfilDeCurso(nivel, { area: 'Ciencias Naturales', tema: 'Los animales' }));
      for (const d of [1, 2, 3] as const) expect(e[d]).not.toMatch(/problema|operaci|números/);
    }
  });
});

describe('rangoNumerico', () => {
  const siempre = (v: number) => () => v;
  it('1.º no pasa de 20 y 6.º llega a decenas de miles', () => {
    for (const r of [0, 0.5, 0.999]) {
      expect(rangoNumerico(perfilDeCurso('1º Primaria'), siempre(r)).hi).toBeLessThanOrEqual(20);
      expect(rangoNumerico(perfilDeCurso('6º Primaria'), siempre(r)).hi).toBeGreaterThanOrEqual(20000);
    }
  });

  it('los cursos altos piden decimales y fracciones', () => {
    expect(rangoNumerico(perfilDeCurso('5º Primaria'), siempre(0.3)).nota).toMatch(/decimales/);
    expect(rangoNumerico(perfilDeCurso('2º Primaria'), siempre(0.3)).nota).toBe('');
  });

  it('sin curso, el rango pequeño de siempre', () => {
    const r = rangoNumerico(perfilDeCurso(''), siempre(0.5));
    expect(r.lo).toBeGreaterThanOrEqual(2);
    expect(r.hi).toBeLessThanOrEqual(30);
  });
});

describe('planDeBloques', () => {
  it('con tres ejercicios o más, tres bloques de nivel 1, 2 y 3 que suman n', () => {
    for (let n = 3; n <= 12; n++) {
      const p = planDeBloques(n);
      expect(p.map(b => b.dificultad)).toEqual([1, 2, 3]);
      expect(p.reduce((s, b) => s + b.ejercicios, 0)).toBe(n);
      expect(p.every(b => b.ejercicios >= 1)).toBe(true);
    }
  });

  it('los que sobran van al bloque del medio primero', () => {
    expect(planDeBloques(4).map(b => b.ejercicios)).toEqual([1, 2, 1]);
    expect(planDeBloques(5).map(b => b.ejercicios)).toEqual([2, 2, 1]);
    expect(planDeBloques(6).map(b => b.ejercicios)).toEqual([2, 2, 2]);
    expect(planDeBloques(8).map(b => b.ejercicios)).toEqual([3, 3, 2]);
  });

  it('con muchos ejercicios, cuatro bloques', () => {
    const p = planDeBloques(14);
    expect(p.map(b => b.dificultad)).toEqual([1, 2, 2, 3]);
    expect(p.reduce((s, b) => s + b.ejercicios, 0)).toBe(14);
  });

  it('con uno o dos ejercicios', () => {
    expect(planDeBloques(0)).toEqual([]);
    expect(planDeBloques(1)).toEqual([{ dificultad: 2, ejercicios: 1 }]);
    expect(planDeBloques(2).map(b => b.dificultad)).toEqual([1, 3]);
  });

  it('el prompt lleva cada bloque con lo que se pide', () => {
    const txt = planParaPrompt(planDeBloques(6), perfilDeCurso('6º Primaria'));
    expect(txt).toMatch(/Bloque 1 · "dificultad": 1/);
    expect(txt).toMatch(/Bloque 3 · "dificultad": 3/);
    expect(txt).toMatch(/2 ejercicios/);
    expect(txt).toMatch(/decimales/);
  });
});

describe('normalizarEscalera', () => {
  const act = (titulo: string, dificultad?: number) => ({ titulo, dificultad });

  it('ordena de menos a más sin perder ninguno y respeta el orden entre iguales', () => {
    const out = normalizarEscalera([act('c', 3), act('a1', 1), act('b', 2), act('a2', 1)]);
    expect(out.map(a => a.titulo)).toEqual(['a1', 'a2', 'b', 'c']);
    expect(out.map(a => a.dificultad)).toEqual([1, 1, 2, 3]);
  });

  it('si faltan los niveles, los reparte por posición', () => {
    expect(normalizarEscalera([act('a'), act('b'), act('c')]).map(a => a.dificultad)).toEqual([1, 2, 3]);
    expect(normalizarEscalera([act('a', 1), act('b'), act('c', 3)]).map(a => a.dificultad)).toEqual([1, 2, 3]);
  });

  it('si todos valen lo mismo, tampoco es una escalera: la reparte', () => {
    expect(normalizarEscalera([act('a', 2), act('b', 2), act('c', 2)]).map(a => a.dificultad)).toEqual([1, 2, 3]);
  });

  it('un valor fuera de rango no vale', () => {
    expect(normalizarEscalera([act('a', 0), act('b', 7)]).map(a => a.dificultad)).toEqual([1, 3]);
  });

  it('un solo bloque queda como está, o en el 2', () => {
    expect(normalizarEscalera([act('a', 3)]).map(a => a.dificultad)).toEqual([3]);
    expect(normalizarEscalera([act('a')]).map(a => a.dificultad)).toEqual([2]);
  });

  it('con el reparto que decidió el código, cada bloque recibe el nivel que le tocaba', () => {
    // La IA repitió un nivel (1, 1, 2): la escalera tiene que salir completa
    expect(normalizarEscalera([act('a', 1), act('b', 1), act('c', 2)], [1, 2, 3]).map(a => a.dificultad)).toEqual([1, 2, 3]);
    // Y desordenada y con huecos también
    expect(normalizarEscalera([act('c', 3), act('a'), act('b', 2)], [1, 2, 3]).map(a => a.dificultad)).toEqual([1, 2, 3]);
    expect(normalizarEscalera([act('a', 3), act('b', 1)], [1, 3]).map(a => a.titulo)).toEqual(['b', 'a']);
  });

  it('si el número de bloques no coincide con el reparto, no se fuerza', () => {
    expect(normalizarEscalera([act('a', 1), act('b', 1), act('c', 2)], [1, 3]).map(a => a.dificultad)).toEqual([1, 1, 2]);
  });

  it('vacío', () => {
    expect(normalizarEscalera([])).toEqual([]);
  });
});

describe('utilidades', () => {
  it('las estrellas', () => {
    expect([1, 2, 3].map(n => estrellas(n as 1 | 2 | 3))).toEqual(['★☆☆', '★★☆', '★★★']);
  });
  it('dificultadesPorPosicion', () => {
    expect(dificultadesPorPosicion(5)).toEqual([1, 1, 2, 2, 3]);
    expect(dificultadesPorPosicion(7)).toEqual([1, 1, 1, 2, 2, 3, 3]);
  });
  it('vaDeMenosAMas', () => {
    expect(vaDeMenosAMas([1, 2, 3])).toBe(true);
    expect(vaDeMenosAMas([1, 1, 2])).toBe(true);
    expect(vaDeMenosAMas([3, 1, 2])).toBe(false);
    expect(vaDeMenosAMas([2, 2, 2])).toBe(false);
    expect(vaDeMenosAMas([undefined, 1])).toBe(false);
    expect(vaDeMenosAMas([2])).toBe(true);
  });
});
