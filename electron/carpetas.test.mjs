import { describe, it, expect } from 'vitest';
import path from 'node:path';
import c from './carpetas.cjs';

const docs = path.join('C:', 'Usuarios', 'Docente', 'Documentos');

describe('carpetas de AulaPro en el ordenador', () => {
  it('la raíz es Documentos › AulaPro y cada tipo va dentro', () => {
    expect(c.carpetaDeAulaPro(docs)).toBe(path.join(docs, 'AulaPro'));
    expect(c.carpetaDeAulaPro(docs, 'Fichas')).toBe(path.join(docs, 'AulaPro', 'Fichas'));
  });
  it('limpia lo que Windows no admite y no deja salir de AulaPro', () => {
    expect(c.carpetaDeAulaPro(docs, 'Actas/2026: 1º')).toBe(path.join(docs, 'AulaPro', 'Actas 2026 1º'));
    expect(c.carpetaDeAulaPro(docs, '../..')).toBe(path.join(docs, 'AulaPro', 'Otros'));
    expect(c.nombreDeCarpeta(undefined)).toBe('Otros');
  });
  it('limpia el nombre del archivo', () => {
    expect(c.nombreDeArchivo('acta: 1º/2º?.docx')).toBe('acta- 1º-2º-.docx');
    expect(c.nombreDeArchivo('')).toBe('documento');
  });
});
