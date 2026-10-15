import { describe, it, expect } from 'vitest';
import {
  bancoClasificar, cantidadesContar, contarDelHilo, dibujosRotulables, enunciadoRotular, esTipoConDibujos, etiquetarDelHilo, solucionDeDibujos,
} from './dibujosEjercicio';
import { hiloPorId, type Hilo } from './hilos';

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

describe('ejercicios con dibujos que monta el código', () => {
  const granja = hiloPorId('granja')!;

  it('«etiquetar»: los primeros dibujos rotulables del hilo, con su solución y el banco si se pide', () => {
    const e = etiquetarDelHilo(granja, 'es', { banco: true })!;
    expect(e.tipo).toBe('etiquetar');
    expect(e.dibujos.map(d => d.ilustracion)).toEqual(['ani-vaca', 'ani-cerdo', 'ani-gallina', 'ani-oveja']);
    expect(e.dibujos.every(d => d.cantidad === 1)).toBe(true);
    expect(e.banco).toBe(true);
    expect(e.enunciado).toBe('Escribe el nombre de cada dibujo en su línea. Usa las palabras del banco.');
    expect(e.solucion).toBe('1. vaca, 2. cerdo, 3. gallina, 4. oveja');
    expect(etiquetarDelHilo(granja, 'es', { n: 6 })!.dibujos).toHaveLength(6);
    expect(etiquetarDelHilo(granja, 'es')!.banco).toBeUndefined();
  });

  it('en catalán y en inglés, con los nombres de cada idioma', () => {
    expect(etiquetarDelHilo(granja, 'ca', { banco: true })!.solucion).toBe('1. vaca, 2. porc, 3. gallina, 4. ovella');
    expect(etiquetarDelHilo(granja, 'en')!.solucion).toBe('1. cow, 2. pig, 3. hen, 4. sheep');
    expect(enunciadoRotular(false, 'en')).toBe('Write the name of each picture on its line.');
    expect(enunciadoRotular(true, 'ca')).toContain('banc');
  });

  it('«contar»: dos dibujos contables con cantidades distintas y pequeñas, y la caja del total', () => {
    for (const r of [0, 0.3, 0.5, 0.99]) {
      const e = contarDelHilo(granja, 'es', () => r, 5)!;
      expect(e.tipo).toBe('contar');
      expect(e.dibujos.map(d => d.ilustracion)).toEqual(['ani-vaca', 'ani-cerdo']);
      const [a, b] = e.dibujos.map(d => d.cantidad);
      expect(a).not.toBe(b);
      for (const n of [a, b]) { expect(n).toBeGreaterThanOrEqual(2); expect(n).toBeLessThanOrEqual(5); }
      expect(e.total).toBe(true);
      expect(e.solucion).toBe(`vaca: ${a}; cerdo: ${b}; Total: ${a + b}`);
    }
  });

  it('los dibujos que no se pueden contar o rotular se saltan, y sin material suficiente no se monta nada', () => {
    const pocos: Hilo = { ...granja, dibujos: ['ani-vaca'] };
    expect(etiquetarDelHilo(pocos, 'es')).toBeUndefined();
    expect(contarDelHilo(pocos, 'es')).toBeUndefined();
    const sinContables: Hilo = { ...granja, dibujos: ['lug-granja', 'lug-colegio', 'lug-hospital'] };
    expect(contarDelHilo(sinContables, 'es')).toBeUndefined();
    expect(dibujosRotulables(granja, 'es', 3)).toHaveLength(3);
  });

  it('todos los hilos con dibujos de sobra dan un «etiquetar» que se puede hacer', () => {
    // Un hilo sin tres dibujos con nombre corto no da nada: mejor eso que un ejercicio roto
    for (const id of ['granja', 'cuerpo-humano', 'mercado-dinero', 'espacio']) {
      const h = hiloPorId(id)!;
      const e = etiquetarDelHilo(h, 'es');
      if (e) {
        expect(new Set(e.dibujos.map(d => d.ilustracion)).size).toBe(e.dibujos.length);
        expect(e.solucion.split(',').length).toBe(e.dibujos.length);
      }
    }
  });
});
