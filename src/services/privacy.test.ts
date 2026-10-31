import { describe, it, expect } from 'vitest';
import { buildPseudonymizer, codigoValido, codigosDePeticion, digitoDamm } from './privacy';

const roster = [
  { id: 'a', name: 'Lucía Pérez Navarro' },
  { id: 'b', name: 'Marco Rodríguez Gil' },
  { id: 'c', name: 'Rosa Martín' },
  { id: 'd', name: 'Ana López' },
  { id: 'e', name: 'Ana Ruiz' },
];

describe('buildPseudonymizer', () => {
  const p = buildPseudonymizer(roster);

  it('cambia nombres completos y parciales por códigos, sin dejar rastro del nombre', () => {
    const txt = 'Lucía Pérez Navarro y Marco Rodríguez no deben ir juntos; lucía pérez falta mucho.';
    const masked = p.mask(txt);
    expect(masked).not.toMatch(/Lucía|Marco|Pérez|Rodríguez/i);
    expect(masked).toContain('[ALU-1]');
    expect(masked).toContain('[ALU-2]');
  });

  it('tapa el nombre de pila suelto cuando es único y va con mayúscula', () => {
    expect(p.mask('¿Cómo va Lucía?')).toBe('¿Cómo va [ALU-1]?');
  });

  it('no confunde palabras corrientes con nombres («rosa» el color)', () => {
    expect(p.mask('Lleva una falda rosa.')).toBe('Lleva una falda rosa.');
    expect(p.mask('Rosa ha mejorado.')).toBe('[ALU-3] ha mejorado.');
  });

  it('un nombre de pila que comparten dos alumnas también se tapa, con su propio código, y vuelve como estaba', () => {
    const t = p.mask('Ana ha faltado y Ana López también.');
    expect(t).not.toContain('Ana');
    expect(t).toContain('[ALU-4] también');
    const [suelto] = t.match(/\[ALU-\d+\]/)!;
    expect(suelto).not.toBe('[ALU-4]');
    expect(suelto).not.toBe('[ALU-5]');
    expect(p.unmask(t)).toBe('Ana ha faltado y Ana López también.');
    // En minúscula no es un nombre: «ana» se queda
    expect(p.mask('la palabra ana')).toBe('la palabra ana');
  });

  it('respeta los límites de palabra con acentos', () => {
    expect(p.mask('Rosalía llegó tarde.')).toBe('Rosalía llegó tarde.');
  });

  it('devuelve los nombres reales en la respuesta, también si la IA quita los corchetes', () => {
    expect(p.unmask('[ALU-1] y ALU-2 trabajan bien.')).toBe('Lucía Pérez Navarro y Marco Rodríguez Gil trabajan bien.');
  });

  it('ida y vuelta: lo que se enmascara vuelve a leerse con el nombre completo', () => {
    expect(p.unmask(p.mask('Informe de Marco Rodríguez Gil'))).toBe('Informe de Marco Rodríguez Gil');
  });

  it('funciona dentro de un JSON devuelto por la IA', () => {
    const raw = '{"grupos":[{"justificacion":"[ALU-1] apoya a [ALU-2]"}]}';
    expect(JSON.parse(p.unmask(raw)).grupos[0].justificacion).toBe('Lucía Pérez Navarro apoya a Marco Rodríguez Gil');
  });

  it('sin alumnado no toca nada', () => {
    const empty = buildPseudonymizer([]);
    expect(empty.mask('Hola Lucía')).toBe('Hola Lucía');
    expect(empty.unmask('ALU-9')).toBe('ALU-9');
  });

  it('un código desconocido se deja como está', () => {
    expect(p.unmask('[ALU-99]')).toBe('[ALU-99]');
  });
});

describe('codigosDePeticion (códigos nuevos al azar en cada petición)', () => {
  const base = buildPseudonymizer([
    { id: '1', name: 'Lucía Pérez Navarro' },
    { id: '2', name: 'Marco Rodríguez Gil' },
  ]);
  /** Un «azar» que se repite, para que la prueba sea siempre igual. */
  const secuencia = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };

  it('cambia los nombres por códigos de esta petición, el mismo código para el mismo alumno', () => {
    const p = codigosDePeticion(base, secuencia(0.5, 0.1));
    const t = p.mask('Lucía Pérez Navarro y Marco Rodríguez Gil. Lucía Pérez lee bien.');
    const [lucia, marco] = t.match(/\[ALU-\d+\]/g)!;
    expect(t).not.toMatch(/Lucía|Marco/);
    expect(lucia).not.toBe(marco);
    expect(t.split(lucia)).toHaveLength(3);
    expect(lucia).toMatch(/^\[ALU-\d{5}\]$/);
    expect(codigoValido(lucia.slice(5, -1))).toBe(true);
  });

  it('dos peticiones dan códigos distintos al mismo alumno, y cada una deshace solo los suyos', () => {
    const a = codigosDePeticion(base, secuencia(0.2));
    const b = codigosDePeticion(base, secuencia(0.7));
    const ca = a.mask('Marco Rodríguez Gil');
    const cb = b.mask('Marco Rodríguez Gil');
    expect(ca).not.toBe(cb);
    expect(a.unmask(ca)).toBe('Marco Rodríguez Gil');
    expect(b.unmask(cb)).toBe('Marco Rodríguez Gil');
    // El código de otra petición, o uno inventado, no es nadie aquí
    expect(a.unmask(cb)).toBe(cb);
    expect(a.unmask('[ALU-1] y [ALU-2]')).toBe('[ALU-1] y [ALU-2]');
  });

  it('el texto que el docente revisó (con los códigos fijos) también sale con los de la petición', () => {
    const revisado = base.mask('Informe de Lucía Pérez Navarro');
    expect(revisado).toBe('Informe de [ALU-1]');
    const p = codigosDePeticion(base, secuencia(0.9));
    const enviado = p.mask(revisado);
    expect(enviado).not.toContain('[ALU-1]');
    expect(p.unmask(enviado)).toBe('Informe de Lucía Pérez Navarro');
  });

  it('nunca repite número dentro de una petición, aunque el azar se repita', () => {
    const muchos = buildPseudonymizer(Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: `Nombre${i} Apellido${i}` })));
    const p = codigosDePeticion(muchos, secuencia(0.3));
    const t = p.mask(Array.from({ length: 30 }, (_, i) => `Nombre${i} Apellido${i}`).join(', '));
    expect(new Set(t.match(/\[ALU-\d+\]/g)).size).toBe(30);
  });
});

describe('dígito de control de los códigos (Damm)', () => {
  it('es el de Damm: 572 lleva un 4', () => {
    expect(digitoDamm('572')).toBe(4);
    expect(codigoValido('57244')).toBe(false);
    expect(digitoDamm('5724')).toBe(0);
  });

  it('un código mal copiado por la IA no se convierte en ningún alumno: cifra cambiada, dos vecinas al revés, una de más o de menos', () => {
    const base = buildPseudonymizer(Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: `Nombre${i} Apellido${i}` })));
    for (let vuelta = 0; vuelta < 20; vuelta++) {
      const p = codigosDePeticion(base);
      const enviados = p.mask(Array.from({ length: 30 }, (_, i) => `Nombre${i} Apellido${i}`).join(', ')).match(/\d{5}/g)!;
      expect(enviados).toHaveLength(30);
      for (const c of enviados) {
        expect(p.unmask(`[ALU-${c}]`)).toMatch(/^Nombre\d+ Apellido\d+$/);
        const erratas = new Set<string>();
        for (let i = 0; i < 5; i++) {
          for (let d = 0; d < 10; d++) if (String(d) !== c[i]) erratas.add(c.slice(0, i) + d + c.slice(i + 1));
          if (i < 4 && c[i] !== c[i + 1]) erratas.add(c.slice(0, i) + c[i + 1] + c[i] + c.slice(i + 2));
          erratas.add(c.slice(0, i) + c.slice(i + 1));
        }
        erratas.add(c + '0');
        for (const e of erratas) expect(p.unmask(`[ALU-${e}]`)).toBe(`[ALU-${e}]`);
      }
    }
  });
});
