import { describe, expect, it, vi } from 'vitest';
import { crearMedidaDeUso, INACTIVO_TRAS, MAX_PENDIENTES, MINUTO } from './usoWeb';

function reloj() {
  let t = 1_000_000;
  return { ahora: () => t, pasar: (ms: number) => { t += ms; } };
}

describe('la medida del uso activo (registro de usuarios, 9-11-2026)', () => {
  it('solo cuenta los minutos con la app a la vista y tocada en los últimos 5 minutos', () => {
    const r = reloj();
    let visible = true;
    const m = crearMedidaDeUso({ enviar: async () => true, visible: () => visible, ahora: r.ahora });
    for (let i = 0; i < 4; i++) { r.pasar(MINUTO); m.tic(); }
    expect(m.pendientes()).toBe(4);
    r.pasar(INACTIVO_TRAS); m.tic();                // nadie la toca: no cuenta
    expect(m.pendientes()).toBe(4);
    m.interaccion(); r.pasar(MINUTO); m.tic();
    expect(m.pendientes()).toBe(5);
    visible = false; m.interaccion(); r.pasar(MINUTO); m.tic();   // pestaña en segundo plano: no cuenta
    expect(m.pendientes()).toBe(5);
  });

  it('manda lo pendiente y, si no puede, lo guarda para el siguiente aviso (como mucho 30 minutos)', async () => {
    const r = reloj();
    const enviar = vi.fn(async () => false);
    const m = crearMedidaDeUso({ enviar, visible: () => true, ahora: r.ahora });
    for (let i = 0; i < 40; i++) { m.interaccion(); r.pasar(MINUTO); m.tic(); }
    await m.avisar();
    expect(enviar).toHaveBeenCalledWith(MAX_PENDIENTES);
    expect(m.pendientes()).toBe(MAX_PENDIENTES);
    enviar.mockResolvedValue(true);
    await m.avisar();
    expect(m.pendientes()).toBe(0);
    await m.avisar();
    expect(enviar).toHaveBeenCalledTimes(2);   // sin minutos no se manda nada
  });
});
