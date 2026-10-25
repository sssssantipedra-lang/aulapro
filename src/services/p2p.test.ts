import { describe, it, expect } from 'vitest';
import { codeFromShareUrl, lanFromShareUrl, parseScannedCode, shareUrl } from './p2p';

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

  it('lleva la pista del canal local sin estropear el código', () => {
    const url = shareUrl('ab23c4', { ip: '192.168.1.20', port: 8100, code: 'XYZ789' });
    expect(url).toBe('aulapro://c/AB23C4?lan=192.168.1.20:8100:XYZ789');
    expect(codeFromShareUrl(url)).toBe('AB23C4');
    expect(lanFromShareUrl(url)).toEqual({ ip: '192.168.1.20', port: 8100, code: 'XYZ789' });
  });

  it('sin pista de canal local, no la inventa', () => {
    expect(lanFromShareUrl('aulapro://c/AB23C4')).toBeNull();
    expect(lanFromShareUrl('aulapro://c/AB23C4?lan=no-es-una-ip')).toBeNull();
    expect(lanFromShareUrl('aulapro://c/AB23C4?lan=10.0.0.1:99999:ABC')).toBeNull();
  });
});
