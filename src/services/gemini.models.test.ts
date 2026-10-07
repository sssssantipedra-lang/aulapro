/**
 * Qué modelo contesta cada tarea: el bueno (Gemini 3.8 Flash, pocas
 * peticiones gratis al día) para lo grande y los ligeros para el resto; y,
 * cuando uno agota su cupo, no se le vuelve a llamar hasta que se renueva.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGemini, setApiKey, modelsFor, nextDailyReset, mainModelPausedUntil, MAIN_MODEL } from './gemini';

/** Lo que contesta Google cuando se pide la respuesta por partes (`alt=sse`). */
const sse = (text: string) => new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`, { status: 200 });

let pedidos: string[] = [];
let responder: (model: string) => { ok: boolean; status?: number; message?: string };

beforeEach(() => {
  const guardado = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => guardado.get(k) ?? null,
    setItem: (k: string, v: string) => void guardado.set(k, v),
    removeItem: (k: string) => void guardado.delete(k),
  });
  setApiKey('AIzaClaveDePrueba');
  pedidos = [];
  responder = () => ({ ok: true });
  vi.stubGlobal('fetch', async (url: string) => {
    const model = /models\/([^:]+):/.exec(url)?.[1] ?? '';
    pedidos.push(model);
    const r = responder(model);
    if (r.ok) return sse('listo');
    return { ok: false, status: r.status ?? 400, json: async () => ({ error: { message: r.message ?? '' } }) };
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('reparto de modelos', () => {
  it('las tareas grandes empiezan por Gemini 3.8 Flash', () => {
    expect(modelsFor({ thinkingLevel: 'high' })[0]).toBe(MAIN_MODEL);
    expect(modelsFor({ maxOutputTokens: 16384 })[0]).toBe(MAIN_MODEL);
  });

  it('las pequeñas empiezan por Flash-Lite y dejan el 3.8 de respaldo', () => {
    const order = modelsFor({ thinkingLevel: 'low' });
    expect(order[0]).toBe('gemini-3.5-flash-lite');
    expect(order).toContain(MAIN_MODEL);
  });

  it('al agotar el cupo diario del 3.8, las siguientes peticiones van directas a Flash-Lite', async () => {
    responder = m => (m === MAIN_MODEL ? { ok: false, status: 429, message: 'Quota exceeded for metric: generate_content_free_tier_requests, limit: 20, GenerateRequestsPerDayPerProjectPerModel' } : { ok: true });
    await callGemini('s', 'u', [], {}, { thinkingLevel: 'high' });
    expect(pedidos).toEqual([MAIN_MODEL, 'gemini-3.5-flash-lite']);
    expect(mainModelPausedUntil()).not.toBeNull();

    pedidos = [];
    await callGemini('s', 'u', [], {}, { thinkingLevel: 'high' });
    expect(pedidos).toEqual(['gemini-3.5-flash-lite']);
  });

  it('un límite por minuto solo lo aparta un minuto', async () => {
    responder = m => (m === MAIN_MODEL ? { ok: false, status: 429, message: 'Resource exhausted: requests per minute' } : { ok: true });
    await callGemini('s', 'u', [], {}, { thinkingLevel: 'high' });
    expect(mainModelPausedUntil()).toBeNull();
  });

  it('el cupo se renueva a medianoche de la hora del Pacífico (las 9:00 en España)', () => {
    // 29 sep 2026, 20:00 en Madrid (18:00 UTC) → siguiente renovación 30 sep a las 07:00 UTC
    const reset = new Date(nextDailyReset(new Date('2026-09-29T18:00:00Z')));
    expect(reset.toISOString()).toBe('2026-09-30T07:00:00.000Z');
    // En invierno (hora estándar del Pacífico) es a las 08:00 UTC, que también son las 9:00 en Madrid
    expect(new Date(nextDailyReset(new Date('2026-12-01T12:00:00Z'))).toISOString()).toBe('2026-12-02T08:00:00.000Z');
  });
});
