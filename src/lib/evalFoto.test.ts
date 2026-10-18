import { describe, it, expect } from 'vitest';
import { calcularNota, cambiosDelDocente, leerPuntos, normalizarCorreccion, puntosValidos } from './evalFoto';

const p = (puntos: number, puntosMax: number) => ({ puntos, puntosMax });

describe('nota de un examen por foto', () => {
  it('la suma y la nota sobre 10 las hace el código', () => {
    expect(calcularNota([p(1.5, 2), p(2, 2), p(0, 1), p(3, 5)])).toEqual({ puntos: 6.5, max: 10, nota: 6.5 });
    // Con otro total, se pasa a sobre 10
    expect(calcularNota([p(7, 8), p(5, 12)])).toEqual({ puntos: 12, max: 20, nota: 6 });
  });

  it('ningún punto pasa del máximo de su pregunta ni baja de cero', () => {
    expect(puntosValidos(3, 2)).toBe(2);
    expect(puntosValidos(-1, 2)).toBe(0);
    expect(calcularNota([p(5, 2), p(-3, 2)])).toEqual({ puntos: 2, max: 4, nota: 5 });
  });

  it('sin puntos que repartir, no hay nota', () => {
    expect(calcularNota([])).toEqual({ puntos: 0, max: 0, nota: null });
  });

  it('redondea a décimas', () => {
    expect(calcularNota([p(1, 3)]).nota).toBe(3.3);
  });

  it('lee los puntos escritos con coma o con punto', () => {
    expect(leerPuntos('1,5')).toBe(1.5);
    expect(leerPuntos(' 2.25 ')).toBe(2.25);
    expect(leerPuntos('')).toBeNull();
    expect(leerPuntos('abc')).toBeNull();
  });
});

describe('lo que devuelve la IA, saneado', () => {
  const buena = {
    titulo: 'Examen de fracciones', comentarioGeneral: 'Buen trabajo.', puntosFuertes: ['Suma bien'], aMejorar: ['Simplificar'], avisos: [],
    preguntas: [
      { n: '1', enunciado: '1/2 + 1/4', respuesta: '3/4', puntosMax: 2, puntos: 2, estado: 'correcta', comentario: 'Bien', dudosa: false },
      { n: '2', enunciado: 'Simplifica 6/8', respuesta: '3/4', puntosMax: 3, puntos: 4, estado: 'inventado', comentario: '', dudosa: false },
      { n: '3', enunciado: 'Problema', respuesta: '', puntosMax: 5, puntos: 1, estado: 'ilegible', comentario: 'No se lee', dudosa: false },
    ],
  };

  it('deja los puntos dentro del máximo, el estado en la lista y marca como dudosa la que no se lee', () => {
    const c = normalizarCorreccion(buena)!;
    expect(c.preguntas.map(x => x.puntos)).toEqual([2, 3, 1]);
    expect(c.preguntas[1].estado).toBe('parcial');
    expect(c.preguntas[2].dudosa).toBe(true);
    expect(c.preguntas[0].dudosa).toBe(false);
    expect(c.titulo).toBe('Examen de fracciones');
  });

  it('una pregunta sin máximo recibe una parte de lo que falta hasta el total', () => {
    const c = normalizarCorreccion({ preguntas: [
      { enunciado: 'a', puntosMax: 4, puntos: 4 }, { enunciado: 'b', puntos: 1 }, { enunciado: 'c', puntos: 1 },
    ] }, 10)!;
    expect(c.preguntas.map(x => x.puntosMax)).toEqual([4, 3, 3]);
    expect(c.preguntas.map(x => x.n)).toEqual(['1', '2', '3']);
  });

  it('descarta las preguntas vacías y lo que no es una corrección', () => {
    expect(normalizarCorreccion({ preguntas: [{ puntosMax: 2, puntos: 1 }] })).toBeNull();
    expect(normalizarCorreccion({ preguntas: [] })).toBeNull();
    expect(normalizarCorreccion(null)).toBeNull();
    expect(normalizarCorreccion('hola')).toBeNull();
    expect(normalizarCorreccion({})).toBeNull();
  });

  it('cuenta lo que el docente cambia de lo que propuso la IA', () => {
    const c = normalizarCorreccion(buena)!;
    const mano = c.preguntas.map((q, i) => (i === 0 ? { ...q, puntos: 1 } : q));
    expect(cambiosDelDocente(c.preguntas, mano)).toBe(1);
    expect(cambiosDelDocente(c.preguntas, c.preguntas)).toBe(0);
  });
});
