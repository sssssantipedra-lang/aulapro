// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadFile } from './download';

afterEach(() => { delete window.electronAPI; vi.restoreAllMocks(); });

describe('downloadFile', () => {
  it('en Android pasa el archivo al menú de compartir', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    window.electronAPI = { isDesktop: false, platform: 'android', version: '', files: { save } };
    const blob = new Blob(['hola']);
    await downloadFile(blob, 'notas.csv');
    expect(save).toHaveBeenCalledWith(blob, 'notas.csv');
  });

  it('en el ordenador, la descarga de siempre', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    await downloadFile(new Blob(['hola']), 'notas.csv');
    expect(click).toHaveBeenCalledTimes(1);
  });
});
