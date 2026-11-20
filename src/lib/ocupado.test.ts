import { describe, expect, it } from 'vitest';
import { ocupado, ocupar } from './ocupado';

describe('lo que está en marcha', () => {
  it('cuenta por motivo y soltar dos veces no resta de más', () => {
    expect(ocupado()).toBe(false);
    const a = ocupar('ia');
    const b = ocupar('ia');
    expect(ocupado('ia')).toBe(true);
    expect(ocupado('temporizador')).toBe(false);
    a(); a();
    expect(ocupado('ia')).toBe(true);
    b();
    expect(ocupado()).toBe(false);
  });
});
