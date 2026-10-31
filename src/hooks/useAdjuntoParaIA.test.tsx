// @vitest-environment jsdom
/**
 * Un archivo adjunto para la IA (rúbrica, asistente del cuaderno): un documento se convierte en texto sin datos que
 * identifiquen y nunca va como archivo; una foto espera a que se tape el nombre. Ver `useAdjuntoParaIA`.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdjuntoParaIA } from './useAdjuntoParaIA';

vi.mock('../lib/fotos', async importOriginal => {
  const real = await importOriginal<typeof import('../lib/fotos')>();
  return { ...real, fotoParaIA: async () => ({ name: 'foto.jpg', mimeType: 'image/jpeg', base64: 'QUJD' }) };
});

describe('useAdjuntoParaIA', () => {
  it('un documento queda como texto, sin teléfonos ni correos, y no se adjunta ningún archivo', async () => {
    const errores: string[] = [];
    const { result } = renderHook(() => useAdjuntoParaIA(m => errores.push(m)));
    await act(() => result.current.elegir(new File(['Redacción de un alumno. Contacto: 612345678, familia@correo.es'], 'trabajo.txt', { type: 'text/plain' })));
    expect(errores).toEqual([]);
    expect(result.current.adjunto?.nombre).toBe('trabajo.txt');
    expect(result.current.adjunto?.texto).toContain('Redacción de un alumno');
    expect(result.current.adjunto?.texto).not.toMatch(/612345678|familia@correo/);
    expect(result.current.archivos).toEqual([]);
  });

  it('una foto no se adjunta hasta tapar el nombre; un Word antiguo o un archivo raro se rechazan con su aviso', async () => {
    const errores: string[] = [];
    const { result } = renderHook(() => useAdjuntoParaIA(m => errores.push(m)));
    await act(() => result.current.elegir(new File(['x'], 'foto.jpg', { type: 'image/jpeg' })));
    expect(result.current.adjunto).toBeNull();
    await act(() => result.current.elegir(new File(['x'], 'viejo.doc')));
    await act(() => result.current.elegir(new File(['x'], 'datos.zip', { type: 'application/zip' })));
    expect(errores).toEqual([
      'Los Word antiguos (.doc) no se pueden leer aquí. Ábrelo y guárdalo como .docx o como PDF.',
      'Adjunta una foto, un PDF, un Word (.docx) o un texto.',
    ]);
  });
});
