import { describe, expect, it } from 'vitest';
import { DENSIDADES, ESCALA_DENSIDAD, NOMBRE_DENSIDAD, elegirDensidad, esDensidad, puntosDeMedida, type Densidad, type MedidaPaginas } from './densidad';

const m = (...huecos: number[]): MedidaPaginas => ({ paginas: huecos.length, huecos });
const medidas = (o: Partial<Record<Densidad, MedidaPaginas>>) => o;

describe('las densidades', () => {
  it('cuatro, de más apretada a más holgada, cada una con su nombre y su factor', () => {
    expect(DENSIDADES).toEqual(['apretada', 'compacta', 'normal', 'holgada']);
    for (const d of DENSIDADES) expect(NOMBRE_DENSIDAD[d].trim()).not.toBe('');
    const f = DENSIDADES.map(d => ESCALA_DENSIDAD[d]);
    expect([...f].sort((a, b) => a - b)).toEqual(f);
    expect(ESCALA_DENSIDAD.normal).toBe(1);
  });

  it('esDensidad solo acepta las cuatro', () => {
    for (const d of DENSIDADES) expect(esDensidad(d)).toBe(true);
    for (const x of ['', 'media', undefined, null, 3, {}]) expect(esDensidad(x)).toBe(false);
  });
});

describe('puntosDeMedida', () => {
  it('una página menos pesa más que cualquier hueco', () => {
    expect(puntosDeMedida('apretada', m(0))).toBeLessThan(puntosDeMedida('normal', m(0, 1000)));
  });

  it('el hueco al pie de la última página pesa menos que el de una intermedia', () => {
    expect(puntosDeMedida('normal', m(0, 400))).toBeLessThan(puntosDeMedida('normal', m(400, 0)));
  });

  it('alejarse de la normal cuesta algo', () => {
    expect(puntosDeMedida('normal', m(100, 100))).toBeLessThan(puntosDeMedida('holgada', m(100, 100)));
    expect(puntosDeMedida('compacta', m(100, 100))).toBeLessThan(puntosDeMedida('apretada', m(100, 100)));
  });
});

describe('elegirDensidad', () => {
  it('sin medidas, la normal', () => {
    expect(elegirDensidad({})).toBe('normal');
    expect(elegirDensidad(medidas({ normal: { paginas: 0, huecos: [] } }))).toBe('normal');
  });

  it('si cabe en una página menos con otra densidad, esa (la hoja que se pasaba por unos milímetros)', () => {
    // normal: tres hojas con la última casi vacía; compacta: dos
    expect(elegirDensidad(medidas({
      apretada: m(120, 300), compacta: m(40, 250), normal: m(10, 20, 900), holgada: m(10, 20, 940),
    }))).toBe('compacta');
    // solo la apretada lo consigue
    expect(elegirDensidad(medidas({ apretada: m(2, 400), compacta: m(5, 6, 800), normal: m(5, 6, 800), holgada: m(5, 6, 900) }))).toBe('apretada');
  });

  it('con las mismas páginas, la que deja menos hueco en las intermedias', () => {
    // la holgada llena mejor la primera página y la última
    expect(elegirDensidad(medidas({
      apretada: m(600, 500), compacta: m(500, 480), normal: m(300, 400), holgada: m(20, 380),
    }))).toBe('holgada');
  });

  it('la normal se queda si el cambio apenas gana nada', () => {
    expect(elegirDensidad(medidas({
      apretada: m(60, 300), compacta: m(55, 300), normal: m(50, 300), holgada: m(48, 300),
    }))).toBe('normal');
  });

  it('una hoja de una página con muchísimo hueco no se estira', () => {
    expect(elegirDensidad(medidas({ apretada: m(700), compacta: m(650), normal: m(600), holgada: m(550) }))).toBe('normal');
  });

  it('la normal gana si es la única medida', () => {
    expect(elegirDensidad(medidas({ normal: m(10, 20) }))).toBe('normal');
  });
});
