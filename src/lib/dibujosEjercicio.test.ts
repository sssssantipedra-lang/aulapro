import { describe, it, expect } from 'vitest';
import { bancoClasificar, cantidadesContar, esTipoConDibujos, solucionDeDibujos } from './dibujosEjercicio';

const cats = [
  { nombre: 'Domésticos', dibujos: ['ani-vaca', 'ani-perro', 'ani-gato'] },
  { nombre: 'Salvajes', dibujos: ['ani-leon', 'ani-jirafa', 'ani-cebra'] },
];

describe('bancoClasificar', () => {
  it('reparte todos los dibujos, cada uno con su grupo', () => {
    const b = bancoClasificar(cats);
    expect(b).toHaveLength(6);
    expect(new Set(b.map(d => d.id)).size).toBe(6);
    for (const d of b) expect(cats[d.categoria].dibujos).toContain(d.id);
  });

  it('siempre es la misma mezcla para el mismo ejercicio, y distinta si cambian los dibujos', () => {
    expect(bancoClasificar(cats)).toEqual(bancoClasificar(JSON.parse(JSON.stringify(cats))));
    const otra = bancoClasificar([{ ...cats[0], dibujos: ['ani-vaca', 'ani-perro', 'ani-pato'] }, cats[1]]);
    expect(otra.map(d => d.id)).not.toEqual(bancoClasificar(cats).map(d => d.id));
  });

  it('nunca sale ya agrupado: es lo que hay que hacer a mano', () => {
    const agrupado = (l: { categoria: number }[]) => l.every((d, i) => i === 0 || d.categoria >= l[i - 1].categoria);
    for (const [a, b] of [['ani-vaca', 'ani-leon'], ['ani-pez', 'ani-rana'], ['com-pera', 'com-fresa'], ['mat-cubo', 'mat-cono']]) {
      const c = [{ nombre: 'A', dibujos: [a, 'ani-gato', 'ani-oso'] }, { nombre: 'B', dibujos: [b, 'ani-pato', 'ani-mono'] }];
      expect(agrupado(bancoClasificar(c)), `${a} ${b}`).toBe(false);
    }
  });

  it('sin grupos o con uno solo, no rompe', () => {
    expect(bancoClasificar(undefined)).toEqual([]);
    expect(bancoClasificar([{ nombre: 'A', dibujos: ['ani-vaca'] }])).toEqual([{ id: 'ani-vaca', categoria: 0 }]);
  });
});

describe('solucionDeDibujos', () => {
  it('«contar»: lo que hay de cada grupo y, si se pide, el total', () => {
    const dibujos = [{ ilustracion: 'ani-vaca', cantidad: 4 }, { ilustracion: 'com-manzana', cantidad: 3 }];
    expect(solucionDeDibujos({ tipo: 'contar', dibujos }, 'es')).toBe('vaca: 4; manzana: 3');
    expect(solucionDeDibujos({ tipo: 'contar', dibujos, total: true }, 'ca')).toBe('vaca: 4; poma: 3; Total: 7');
    expect(solucionDeDibujos({ tipo: 'contar', dibujos: [dibujos[0]], total: true }, 'en')).toBe('cow: 4');
    expect(cantidadesContar({ tipo: 'contar', dibujos: [{ ilustracion: 'x', cantidad: 0 }, { ilustracion: 'y' }] })).toEqual([1, 1]);
  });

  it('«etiquetar»: los nombres, numerados', () => {
    expect(solucionDeDibujos({ tipo: 'etiquetar', dibujos: [{ ilustracion: 'ani-perro' }, { ilustracion: 'ani-gato' }] }, 'en')).toBe('1. dog, 2. cat');
  });

  it('«clasificar»: qué números van en cada grupo, según la mezcla', () => {
    const sol = solucionDeDibujos({ tipo: 'clasificar', categorias: cats }, 'es');
    const banco = bancoClasificar(cats);
    const num = (k: number) => banco.flatMap((d, i) => (d.categoria === k ? [i + 1] : [])).join(', ');
    expect(sol).toBe(`Domésticos: ${num(0)}; Salvajes: ${num(1)}`);
  });

  it('en el resto de tipos no hay solución calculada', () => {
    expect(solucionDeDibujos({ tipo: 'abierta' }, 'es')).toBe('');
  });
});

describe('esTipoConDibujos', () => {
  it('solo los tres tipos que viven de los dibujos', () => {
    for (const t of ['contar', 'etiquetar', 'clasificar']) expect(esTipoConDibujos(t)).toBe(true);
    for (const t of ['abierta', 'relacionar', 'tabla_rellenar', '', undefined]) expect(esTipoConDibujos(t)).toBe(false);
  });
});
