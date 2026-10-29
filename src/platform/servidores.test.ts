import { describe, it, expect, vi } from 'vitest';
import { pedirApi, servidores, RESPALDO, PRINCIPAL } from './servidores';

describe('servidores de la versión web', () => {
  it('primero el sitio desde el que se abrió y luego el respaldo', () => {
    expect(servidores(PRINCIPAL)).toEqual([PRINCIPAL, RESPALDO]);
    expect(servidores(RESPALDO)).toEqual([RESPALDO, PRINCIPAL]);
  });
  it('si el principal no responde, pide al respaldo', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('{"ok":1}'));
    const r = await pedirApi('/api/licencia/validate', { method: 'POST' }, { origenes: [PRINCIPAL, RESPALDO], fetcher });
    expect(await r.json()).toEqual({ ok: 1 });
    expect(fetcher.mock.calls.map(c => c[0])).toEqual([`${PRINCIPAL}/api/licencia/validate`, `${RESPALDO}/api/licencia/validate`]);
  });
  it('una respuesta de error no hace cambiar de servidor', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('no', { status: 404 }));
    const r = await pedirApi('/api/x', {}, { origenes: [PRINCIPAL, RESPALDO], fetcher });
    expect(r.status).toBe(404);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
