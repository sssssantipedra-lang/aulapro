/**
 * Un modelo que no contesta no deja la pantalla en «Creando…» para siempre
 * (decisión del dueño, 7-10-2026): a los 30 segundos sin recibir nada se pasa
 * al siguiente de la lista, y un rato no se le vuelve a llamar. Una respuesta
 * larga que va llegando no se corta, aunque tarde más en total.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Gemini = typeof import('./gemini');
let g: Gemini;
let pedidos: string[] = [];
/** Los modelos que no contestan. */
let mudos = new Set<string>();

const enc = new TextEncoder();
const evento = (text: string) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`;

beforeEach(async () => {
  // Cada prueba con el módulo recién cargado: la pausa de los modelos callados vive en memoria
  vi.resetModules();
  vi.useFakeTimers();
  const guardado = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => guardado.get(k) ?? null,
    setItem: (k: string, v: string) => void guardado.set(k, v),
    removeItem: (k: string) => void guardado.delete(k),
  });
  g = await import('./gemini');
  g.setApiKey('AIzaClaveDePrueba');
  pedidos = [];
  mudos = new Set();
  vi.stubGlobal('fetch', (url: string, init: { signal: AbortSignal }) => {
    const model = /models\/([^:]+):/.exec(url)?.[1] ?? '';
    pedidos.push(model);
    if (mudos.has(model)) {
      return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    }
    return Promise.resolve(new Response(evento('listo'), { status: 200 }));
  });
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const grande = { thinkingLevel: 'high' as const };

describe('espera a la IA', () => {
  it('si el modelo grande no responde en 30 segundos, contesta Flash-Lite y un rato no se le vuelve a llamar', async () => {
    mudos.add(g.MAIN_MODEL);
    const errores: string[] = [];
    const p = g.callGemini('s', 'u', [], { onError: m => errores.push(m) }, grande);
    await vi.advanceTimersByTimeAsync(g.ESPERA_RESPUESTA_MS - 1000);
    expect(pedidos).toEqual([g.MAIN_MODEL]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p).toBe('listo');
    expect(pedidos).toEqual([g.MAIN_MODEL, 'gemini-3.5-flash-lite']);
    expect(errores).toEqual([]);
    // No es cupo gastado: Configuración no dice que se acabaron las de hoy
    expect(g.mainModelPausedUntil()).toBeNull();

    // La siguiente tarea grande va directa a Flash-Lite, sin volver a esperar
    pedidos = [];
    expect(await g.callGemini('s', 'u', [], {}, grande)).toBe('listo');
    expect(pedidos).toEqual(['gemini-3.5-flash-lite']);

    // Pasados diez minutos, se vuelve a probar el grande
    mudos.clear();
    await vi.advanceTimersByTimeAsync(10 * 60_000 + 1);
    pedidos = [];
    expect(await g.callGemini('s', 'u', [], {}, grande)).toBe('listo');
    expect(pedidos).toEqual([g.MAIN_MODEL]);
  });

  it('una respuesta larga que va llegando no se corta aunque tarde más de 30 segundos en total', async () => {
    vi.stubGlobal('fetch', (url: string) => {
      pedidos.push(/models\/([^:]+):/.exec(url)?.[1] ?? '');
      const cuerpo = new ReadableStream<Uint8Array>({
        async start(c) {
          for (const trozo of ['{"a":', '1', '}']) {
            await new Promise(r => setTimeout(r, 20_000));
            c.enqueue(enc.encode(evento(trozo)));
          }
          c.close();
        },
      });
      return Promise.resolve(new Response(cuerpo, { status: 200 }));
    });
    const p = g.callGemini('s', 'u', [], {}, grande);
    await vi.advanceTimersByTimeAsync(61_000);
    expect(await p).toBe('{"a":1}');
    expect(pedidos).toEqual([g.MAIN_MODEL]);
  });

  it('si no responde ninguno, avisa de que el servicio de Google no responde', async () => {
    mudos = new Set(g.modelsFor(grande));
    const errores: string[] = [];
    const p = g.callGemini('s', 'u', [], { onError: m => errores.push(m) }, grande);
    await vi.advanceTimersByTimeAsync(g.modelsFor(grande).length * g.ESPERA_RESPUESTA_MS + 1000);
    expect(await p).toBeNull();
    expect(errores).toEqual(['El servicio de Google no responde ahora mismo. Inténtalo en unos minutos.']);
  });

  it('junta los trozos de la respuesta, sin los razonamientos, y lee un error que llega dentro', () => {
    const raw = `${evento('Hola, ')}data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'pensando…', thought: true }, { text: 'mundo' }] } }] })}\n\n`;
    expect(g.textoDeSse(raw)).toEqual({ text: 'Hola, mundo' });
    expect(g.textoDeSse(`data: ${JSON.stringify({ error: { code: 503, message: 'overloaded' } })}\n\n`)).toEqual({ status: 503, message: 'overloaded' });
  });
});
