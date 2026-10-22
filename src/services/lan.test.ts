import { describe, it, expect } from 'vitest';
import { buildLanUrl, parseLanUrl } from './lan';

describe('canal local de «Trabajo compartido»', () => {
  it('construye la URL de la sesión', () => {
    expect(buildLanUrl('192.168.1.20', 8100, 'ABC234')).toBe('http://192.168.1.20:8100/share?c=ABC234');
  });

  it('lee la URL de la sesión', () => {
    expect(parseLanUrl('http://192.168.1.20:8100/share?c=ABC234')).toEqual({ ip: '192.168.1.20', port: 8100, code: 'ABC234' });
  });

  it('normaliza el código y acepta el puerto por defecto', () => {
    expect(parseLanUrl('http://10.0.0.5/share?c=abc234')).toEqual({ ip: '10.0.0.5', port: 80, code: 'ABC234' });
    expect(parseLanUrl('https://172.16.0.3/share?c=ABC234')).toEqual({ ip: '172.16.0.3', port: 443, code: 'ABC234' });
  });

  it('descarta lo que no es una sesión local de Aula Pro', () => {
    expect(parseLanUrl('aulapro://c/ABC234')).toBeNull();
    expect(parseLanUrl('http://192.168.1.20:8100/otro?c=ABC234')).toBeNull();
    expect(parseLanUrl('http://192.168.1.20:8100/share')).toBeNull(); // sin código
    expect(parseLanUrl('no es una url')).toBeNull();
  });
});
