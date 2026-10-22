import { describe, it, expect } from 'vitest';
import { codeFromShareUrl, parseScannedCode, shareUrl } from './p2p';

describe('enlace de la sesión compartida', () => {
  it('construye un enlace aulapro://c/<código>', () => {
    expect(shareUrl('ab23c4')).toBe('aulapro://c/AB23C4');
  });

  it('lee el código en texto plano', () => {
    expect(codeFromShareUrl('AB23C4')).toBe('AB23C4');
    expect(codeFromShareUrl('  ab23c4 ')).toBe('AB23C4');
  });

  it('lee el código desde el enlace aulapro://c/', () => {
    expect(codeFromShareUrl('aulapro://c/AB23C4')).toBe('AB23C4');
  });

  it('lee el código desde un enlace web /r/', () => {
    expect(codeFromShareUrl('https://aulapro.app/r/AB23C4')).toBe('AB23C4');
  });

  it('descarta lo que no es un código ni un enlace nuestro', () => {
    expect(codeFromShareUrl('https://ejemplo.com/x/AB23C4')).toBeNull();
    expect(codeFromShareUrl('hola mundo')).toBeNull();
    expect(codeFromShareUrl('aulapro://c/AB23C')).toBeNull(); // demasiado corto
    expect(codeFromShareUrl('aulapro://c/AB12C4')).toBeNull(); // 1 no está en el alfabeto
  });

  it('parseScannedCode solo acepta lo válido', () => {
    expect(parseScannedCode('aulapro://c/AB23C4')).toBe('AB23C4');
    expect(parseScannedCode('xyz')).toBeNull();
  });
});
