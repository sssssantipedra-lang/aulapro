// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadFile } from './download';

afterEach(() => { delete window.electronAPI; vi.restoreAllMocks(); });

describe('downloadFile', () => {
  it('en Android pasa el archivo al puente, que lo guarda en su carpeta de AulaPro', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    window.electronAPI = { isDesktop: false, platform: 'android', version: '', files: { save } };
    const blob = new Blob(['hola']);
    await downloadFile(blob, 'notas.csv', 'Cuaderno');
    expect(save).toHaveBeenCalledWith(blob, 'notas.csv', 'Cuaderno');
    await downloadFile(blob, 'suelto.csv');
    expect(save).toHaveBeenLastCalledWith(blob, 'suelto.csv', undefined);
  });

  it('en el ordenador, la descarga de siempre', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    await downloadFile(new Blob(['hola']), 'notas.csv');
    expect(click).toHaveBeenCalledTimes(1);
  });
});
