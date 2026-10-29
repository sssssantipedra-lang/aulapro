// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const memoria = new Map<string, unknown>();
vi.mock('./webFs', () => ({
  idbKv: {
    get: async (k: string) => memoria.get(k),
    set: async (k: string, v: unknown) => { memoria.set(k, v); },
    del: async (k: string) => { memoria.delete(k); },
  },
}));

const respuesta = () => new Response(JSON.stringify({ access_token: 'ACCESO', expires_in: 3600, id_token: 'IDENTIDAD' }), { status: 200 });

describe('el acceso a Drive de la versión web', () => {
  const fetchFalso = vi.fn(async () => respuesta());
  beforeEach(() => {
    memoria.clear(); sessionStorage.clear(); fetchFalso.mockClear();
    memoria.set('drive', { email: 'profesor@example.com', refresh: 'R' });
    vi.stubGlobal('fetch', fetchFalso);
    vi.resetModules();
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('la licencia y Drive piden el acceso a la vez y la función se llama una sola vez', async () => {
    const { tokenDrive, tokenDeIdentidad } = await import('./googleDrive');
    const [acceso, identidad] = await Promise.all([tokenDrive(), tokenDeIdentidad()]);
    expect(acceso).toBe('ACCESO');
    expect(identidad).toBe('IDENTIDAD');
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(await tokenDrive()).toBe('ACCESO');
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('al recargar la página en la misma pestaña, no vuelve a pedirlo', async () => {
    const primera = await import('./googleDrive');
    await primera.tokenDrive();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    vi.resetModules(); // la página se recarga: la memoria se pierde, `sessionStorage` no
    const segunda = await import('./googleDrive');
    expect(await segunda.tokenDrive()).toBe('ACCESO');
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('al quitar el permiso, se olvida también el acceso recordado', async () => {
    const { tokenDrive, quitarPermisoDrive } = await import('./googleDrive');
    await tokenDrive();
    await quitarPermisoDrive();
    expect(sessionStorage.getItem('aulapro_acceso_drive')).toBeNull();
    await expect(tokenDrive()).rejects.toMatchObject({ name: 'NotAllowedError' });
  });
});
