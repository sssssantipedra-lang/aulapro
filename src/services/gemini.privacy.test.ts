/**
 * Lo que sale hacia Google no puede llevar el nombre de ningún alumno: se
 * inspecciona el cuerpo real de la petición, no una función intermedia.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGemini, setApiKey } from './gemini';
import { setPrivacyRoster } from './privacy';

/** Lo que contesta Google cuando se pide la respuesta por partes (`alt=sse`). */
const sse = (text: string) => new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`, { status: 200 });

let enviado = '';
let respuesta = '';

beforeEach(() => {
  const guardado = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => guardado.get(k) ?? null,
    setItem: (k: string, v: string) => void guardado.set(k, v),
    removeItem: (k: string) => void guardado.delete(k),
  });
  setApiKey('AIzaClaveDePrueba');
  setPrivacyRoster([
    { id: '1', name: 'Lucía Pérez Navarro' },
    { id: '2', name: 'Marco Rodríguez Gil' },
  ]);
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    enviado = init.body;
    return sse(respuesta);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  setPrivacyRoster([]);
});

describe('callGemini y la privacidad del alumnado', () => {
  it('no envía ningún nombre: ni en el sistema, ni en la pregunta, ni en el historial', async () => {
    respuesta = 'ok';
    await callGemini(
      'Contexto: Lucía Pérez Navarro tiene media 8.',
      '¿Qué tal va Marco?',
      [],
      {},
      { history: [{ role: 'user', text: 'Háblame de Lucía' }, { role: 'model', text: 'Lucía Pérez va bien' }] },
    );
    expect(enviado).not.toMatch(/Lucía|Marco|Pérez|Rodríguez/);
    expect(enviado).toContain('[ALU-1]');
    expect(enviado).toContain('[ALU-2]');
    expect(enviado).toContain('PRIVACIDAD');
  });

  it('devuelve la respuesta con los nombres reales', async () => {
    respuesta = '[ALU-2] necesita apoyo; ALU-1 puede ayudarle.';
    const out = await callGemini('sistema', '¿Qué hago con Marco Rodríguez Gil?');
    expect(out).toBe('Marco Rodríguez Gil necesita apoyo; Lucía Pérez Navarro puede ayudarle.');
  });

  it('sin nombres en el texto no añade la instrucción de privacidad', async () => {
    respuesta = 'ok';
    await callGemini('Genera una ficha de fracciones.', 'Para 5º de Primaria');
    expect(enviado).not.toContain('PRIVACIDAD');
  });
});
