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

describe('situaciones de aprendizaje (16-11-2026)', () => {
  it('Gemini 4 Hydrogen primero; si se le acaba el cupo, 3.8 Flash; y 3.5 Flash-Lite en último lugar', async () => {
    const { SDA_MODELS } = await import('./gemini');
    expect([...SDA_MODELS]).toEqual(['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-3.5-flash-lite']);
    responder = m => (m === 'gemini-4-hydrogen' ? { ok: false, status: 429, message: 'Quota exceeded per day' } : { ok: true });
    expect(await callGemini('s', 'u', [], {}, { models: SDA_MODELS, thinkingLevel: 'medium' })).toBe('listo');
    expect(pedidos).toEqual(['gemini-4-hydrogen', 'gemini-3.8-flash']);
    // Al día siguiente de agotarlo, hasta que se renueva, ya no se le llama
    pedidos = [];
    responder = m => (m === 'gemini-3.8-flash' ? { ok: false, status: 429, message: 'Quota exceeded per day' } : { ok: true });
    expect(await callGemini('s', 'u', [], {}, { models: SDA_MODELS, thinkingLevel: 'medium' })).toBe('listo');
    expect(pedidos).toEqual(['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
  });

  it('a Gemini 4 se le manda el nivel de razonamiento (sin él, Hydrogen iría en «high»)', async () => {
    const { supportsThinkingLevel } = await import('./gemini');
    expect(supportsThinkingLevel('gemini-4-hydrogen')).toBe(true);
    expect(supportsThinkingLevel('gemini-3.8-flash')).toBe(true);
    expect(supportsThinkingLevel('gemini-2.5-flash')).toBe(false);
  });
});

describe('elegir el modelo de la SdA y saber cuál contestó (16-11-2026)', () => {
  it('el elegido va primero y, si se le acaba el cupo, los demás en su orden; uno que no está en la lista no cuenta', async () => {
    const { modelosParaSda } = await import('./gemini');
    expect(modelosParaSda()).toEqual(['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-3.5-flash-lite']);
    expect(modelosParaSda('gemini-3.8-flash')).toEqual(['gemini-3.8-flash', 'gemini-4-hydrogen', 'gemini-3.5-flash-lite']);
    expect(modelosParaSda('gemini-99-ultra')).toEqual(['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-3.5-flash-lite']);
  });

  it('el nombre que ve el docente', async () => {
    const { nombreModelo } = await import('./gemini');
    expect(nombreModelo('gemini-4-hydrogen')).toBe('Gemini 4 Hydrogen');
    expect(nombreModelo('gemini-3.8-flash')).toBe('Gemini 3.8 Flash');
    expect(nombreModelo('gemini-3.5-flash-lite')).toBe('Gemini 3.5 Flash-Lite');
  });

  it('avisa del modelo que contestó, también cuando fue el de reserva', async () => {
    const vistos: string[] = [];
    responder = m => (m === 'gemini-4-hydrogen' ? { ok: false, status: 429, message: 'per minute' } : { ok: true });
    await callGemini('s', 'u', [], { onModel: m => vistos.push(m) }, { models: ['gemini-4-hydrogen', 'gemini-3.8-flash'] });
    expect(vistos).toEqual(['gemini-3.8-flash']);
  });
});
