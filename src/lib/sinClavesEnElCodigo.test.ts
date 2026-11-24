/**
 * Ningún archivo del repositorio lleva escrita una cadena con la forma de una clave de verdad (24-11-2026). El detector
 * de secretos de Netlify revisa el repositorio y lo que se publica, y una clave de prueba escrita entera en una prueba
 * («AIza» y 35 caracteres más) bastó para que no publicara aulapro.app. Las claves de prueba se escriben por trozos.
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Las formas que se buscan, escritas también por trozos para que este archivo no las contenga
const FORMAS: [string, RegExp][] = [
  ['clave de Google', new RegExp(['AI', 'za', '[0-9A-Za-z_-]{35}'].join(''))],
  ['clave de AWS', new RegExp(['AK', 'IA', '[0-9A-Z]{16}'].join(''))],
  ['token de GitHub', new RegExp(['gh', 'p_', '[A-Za-z0-9]{36}'].join(''))],
  ['clave privada', new RegExp(['-----BEGIN ', '[A-Z ]*PRIVATE KEY'].join(''))],
];

describe('sin claves escritas en el código', () => {
  it('ningún archivo del repositorio lleva una cadena con forma de clave', () => {
    const archivos = execSync('git ls-files', { encoding: 'utf8' }).split('\n')
      .filter(f => /\.(m?[jt]sx?|c?js|json|html|css|md|toml|ya?ml|txt|py)$/.test(f));
    const encontradas: string[] = [];
    for (const f of archivos) {
      let texto: string;
      try { texto = readFileSync(f, 'utf8'); } catch { continue; }
      for (const [nombre, forma] of FORMAS) if (forma.test(texto)) encontradas.push(`${f}: ${nombre}`);
    }
    expect(encontradas).toEqual([]);
  });
});
