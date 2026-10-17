/**
 * Pizarra de circuitos: el banco de material, el reconocimiento de lo que se
 * dibuja a mano y que lo guardado se carga bien.
 */
import { describe, it, expect } from 'vitest';
import {
  analizarTrazo, cajaDeElementos, copiarElementos, elementosEnCaja, elementoDeTrazo, elementoNuevo, IDS_MATERIAL_PIZARRA, materialDeLaPizarra, MATERIALES_PIZARRA, pizarraSvg, siguienteEstacion,
} from './pizarraEF';
import { EF_VACIO, efParaOtroCurso, normalizarEF } from './ef';

type P = [number, number];
/** Un polígono dibujado con puntos intermedios en cada lado, como lo haría una mano. */
const poligono = (v: P[]): P[] => {
  const out: P[] = [];
  v.forEach((a, i) => {
    const b = v[(i + 1) % v.length];
    for (let k = 0; k < 8; k++) out.push([a[0] + (b[0] - a[0]) * k / 8, a[1] + (b[1] - a[1]) * k / 8]);
  });
  out.push(v[0]);
  return out;
};
const circulo = (cx: number, cy: number, r: number): P[] =>
  Array.from({ length: 41 }, (_, i) => [cx + r * Math.cos(i / 40 * 2 * Math.PI), cy + r * Math.sin(i / 40 * 2 * Math.PI)] as P);

describe('banco de material', () => {
  it('cada pieza tiene dibujo, descripción y tamaño', () => {
    expect(MATERIALES_PIZARRA.length).toBeGreaterThanOrEqual(15);
    for (const m of MATERIALES_PIZARRA) {
      expect(m.svg('1')).toContain('<');
      expect(m.descripcion.length).toBeGreaterThan(10);
      expect(m.ancho).toBeGreaterThan(0);
      expect(m.alto).toBeGreaterThan(0);
    }
    expect(new Set(IDS_MATERIAL_PIZARRA).size).toBe(MATERIALES_PIZARRA.length);
  });

  it('el número de una estación se escribe sin poder colar marcas', () => {
    const m = MATERIALES_PIZARRA.find(x => x.id === 'estacion')!;
    expect(m.svg('<b>')).not.toContain('<b>');
  });

  it('cuenta el material sin las estaciones y numera la siguiente estación', () => {
    const els = [
      elementoNuevo('1', 'cono', 10, 10), elementoNuevo('2', 'cono', 20, 20), elementoNuevo('3', 'aro', 30, 30),
      elementoNuevo('4', 'estacion', 40, 40, '1'), elementoNuevo('5', 'estacion', 50, 50, '2'),
    ];
    expect(materialDeLaPizarra(els)).toEqual([{ material: 'cono', n: 2 }, { material: 'aro', n: 1 }]);
    expect(siguienteEstacion(els)).toBe('3');
    expect(siguienteEstacion([])).toBe('1');
  });
});

describe('reconocer lo que se dibuja', () => {
  it('un triángulo es un cono', () => {
    const a = analizarTrazo(poligono([[100, 200], [140, 120], [180, 200]]));
    expect(a?.forma).toBe('triangulo');
    expect(a?.candidatos[0]).toBe('cono');
  });

  it('un círculo propone aro, balón o seta según su tamaño', () => {
    expect(analizarTrazo(circulo(100, 100, 40))?.candidatos[0]).toBe('aro');
    expect(analizarTrazo(circulo(100, 100, 22))?.candidatos[0]).toBe('balon');
    expect(analizarTrazo(circulo(100, 100, 10))?.candidatos[0]).toBe('seta');
    expect(analizarTrazo(circulo(100, 100, 40))?.candidatos).toContain('balon');
  });

  it('un rectángulo muy alargado es un banco y uno ancho, una colchoneta', () => {
    const banco = analizarTrazo(poligono([[50, 100], [370, 100], [370, 130], [50, 130]]));
    expect(banco?.forma).toBe('rectangulo');
    expect(banco?.candidatos[0]).toBe('banco');
    const colchoneta = analizarTrazo(poligono([[50, 100], [230, 100], [230, 160], [50, 160]]));
    expect(colchoneta?.candidatos[0]).toBe('colchoneta');
  });

  it('una raya corta es una pica', () => {
    const raya: P[] = Array.from({ length: 12 }, (_, i) => [100, 100 + i * 8]);
    const a = analizarTrazo(raya);
    expect(a?.forma).toBe('linea');
    expect(a?.candidatos[0]).toBe('pica');
  });

  it('un garabato demasiado pequeño no se reconoce', () => {
    expect(analizarTrazo([[10, 10], [11, 11], [12, 10]])).toBeNull();
    expect(analizarTrazo(circulo(100, 100, 2))).toBeNull();
  });

  it('la pieza que sustituye al dibujo toma su centro y su tamaño, y se gira si está tumbada al revés', () => {
    const e = elementoDeTrazo('x', 'banco', { x: 100, y: 100, w: 320, h: 30 });
    expect(e).toMatchObject({ material: 'banco', x: 260, y: 115, giro: 0 });
    expect(e.escala).toBe(2);
    expect(elementoDeTrazo('y', 'banco', { x: 100, y: 100, w: 30, h: 160 }).giro).toBe(90);
    expect(elementoDeTrazo('z', 'pica', { x: 100, y: 100, w: 90, h: 10 }).giro).toBe(90);
    expect(elementoDeTrazo('w', 'aro', { x: 100, y: 100, w: 60, h: 60 }).giro).toBe(0);
  });
});

describe('imagen y datos', () => {
  it('la imagen de la pizarra lleva el material y los trazos', () => {
    const svg = pizarraSvg({ elementos: [elementoNuevo('1', 'cono', 100, 100)], trazos: [{ id: 't', tipo: 'flecha', puntos: [[0, 0], [100, 100]], color: '#dc2626' }] });
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('#f97316');
    expect(svg).toContain('#dc2626');
  });

  it('se guarda y se carga, y lo raro se descarta', () => {
    const ef = {
      ...EF_VACIO,
      pizarras: [{
        id: 'p1', nombre: 'Circuito 1',
        elementos: [elementoNuevo('a', 'cono', 10, 20), { ...elementoNuevo('b', 'estacion', 5000, -5, '12345'), escala: 99 }],
        trazos: [{ id: 't1', tipo: 'flecha' as const, puntos: [[0, 0], [50, 50]] as [number, number][], color: '#2563eb' }],
      }],
    };
    const sucio = JSON.parse(JSON.stringify(ef));
    sucio.pizarras[0].elementos.push({ id: 'c', material: 'platillo-volante', x: 1, y: 1, giro: 0, escala: 1 });
    sucio.pizarras[0].trazos.push({ id: 't2', tipo: 'libre', puntos: [[1, 1]], color: '#2563eb' });
    sucio.pizarras[0].trazos[0].color = 'javascript:alert(1)';
    const r = normalizarEF(sucio).pizarras[0];
    expect(r.elementos.map(e => e.id)).toEqual(['a', 'b']);
    expect(r.elementos[1]).toMatchObject({ x: 1000, y: 0, escala: 4, texto: '123' });
    expect(r.trazos.map(t => t.id)).toEqual(['t1']);
    expect(r.trazos[0].color).toBe('#1e293b');
    expect(normalizarEF({}).pizarras).toEqual([]);
  });

  it('las pizarras son material del docente: se quedan al vaciar el curso', () => {
    const ef = { ...EF_VACIO, pizarras: [{ id: 'p', nombre: 'A', elementos: [], trazos: [] }] };
    expect(efParaOtroCurso(ef).pizarras).toEqual(ef.pizarras);
  });
});

describe('duplicar y elegir, como en Canva', () => {
  let n = 0;
  const id = () => `c${n++}`;
  const base = [
    elementoNuevo('a', 'cono', 100, 100), elementoNuevo('b', 'aro', 200, 100), elementoNuevo('e', 'estacion', 300, 100, '1'),
  ];

  it('copia lo elegido, desplazado, sin tocar el resto', () => {
    const c = copiarElementos(base, ['a', 'b'], 30, 20, id);
    expect(c.map(e => [e.material, e.x, e.y])).toEqual([['cono', 130, 120], ['aro', 230, 120]]);
    expect(c.every(e => !base.some(o => o.id === e.id))).toBe(true);
  });

  it('la copia de una estación sigue la numeración', () => {
    const c = copiarElementos(base, ['e'], 50, 0, id);
    expect(c[0].texto).toBe('2');
    const dos = copiarElementos([...base, ...c], ['e'], 50, 0, id);
    expect(dos[0].texto).toBe('3');
  });

  it('si la copia se saldría de la pizarra, rebota hacia el otro lado; el grupo no se parte', () => {
    const borde = [elementoNuevo('x', 'cono', 990, 100), elementoNuevo('y', 'cono', 900, 100)];
    const c = copiarElementos(borde, ['x', 'y'], 30, 0, id);
    expect(c.map(e => e.x)).toEqual([960, 870]);
    // Sin rebotar, se queda en el borde
    expect(copiarElementos(borde, ['x'], 30, 0, id, false)[0].x).toBe(1000);
  });

  it('el recuadro elige las piezas cuyo centro cae dentro', () => {
    expect(elementosEnCaja(base, { x: 50, y: 50, w: 200, h: 100 })).toEqual(['a', 'b']);
    expect(elementosEnCaja(base, { x: 0, y: 0, w: 10, h: 10 })).toEqual([]);
  });

  it('el recuadro de las piezas tiene en cuenta su giro y su tamaño', () => {
    expect(cajaDeElementos([])).toBeNull();
    const horizontal = cajaDeElementos([elementoNuevo('b', 'banco', 500, 300)])!;
    const girado = cajaDeElementos([{ ...elementoNuevo('b', 'banco', 500, 300), giro: 90 }])!;
    expect(horizontal.w).toBeGreaterThan(horizontal.h);
    expect(girado.h).toBeCloseTo(horizontal.w, 5);
    expect(girado.w).toBeCloseTo(horizontal.h, 5);
    expect(cajaDeElementos([{ ...elementoNuevo('b', 'banco', 500, 300), escala: 2 }])!.w).toBeCloseTo(horizontal.w * 2, 5);
  });
});
