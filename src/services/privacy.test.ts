import { describe, it, expect } from 'vitest';
import { buildPseudonymizer } from './privacy';

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

  it('no tapa un nombre de pila compartido por dos alumnas (sería ambiguo)', () => {
    expect(p.mask('Ana ha faltado.')).toBe('Ana ha faltado.');
    expect(p.mask('Ana López ha faltado.')).toBe('[ALU-4] ha faltado.');
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
