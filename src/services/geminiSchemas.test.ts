/**
 * Gemini solo admite listas cerradas (`enum`) de texto en el esquema de la
 * respuesta: con números rechaza la petición entera («Invalid value at
 * generation_config.response_schema…»). Pasó con los trimestres de los
 * objetivos de PT y AL. Esto lo vigila en todo el código.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return archivos(p);
    return /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

describe('esquemas de Gemini', () => {
  it('ninguna lista cerrada es de números', () => {
    const mal = archivos(join(__dirname, '..'))
      .flatMap(f => readFileSync(f, 'utf8').split('\n').map((l, i) => ({ f, i: i + 1, l })))
      .filter(({ l }) => /enum:\s*\[\s*-?\d/.test(l) || /type:\s*'(INTEGER|NUMBER)'[^}]*enum:/.test(l));
    expect(mal.map(({ f, i }) => `${f}:${i}`)).toEqual([]);
  });
});
