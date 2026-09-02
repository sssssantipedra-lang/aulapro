/**
 * El nivel de razonamiento se manda dentro de `generationConfig`, y un campo
 * mal escrito no da error: la API lo ignora y el ajuste no hace nada, en
 * silencio. Por eso aquí se inspecciona el cuerpo real de la petición.
 *
 * Lo otro que se vigila es que NO se mande a los modelos 2.x del respaldo:
 * no lo entienden, y un 400 corta la cascada entera dejando la aplicación sin
 * IA para quien no tenga acceso a los modelos 3.x.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGemini, setApiKey } from './gemini';

/** Cuerpos enviados, en orden, y qué modelo pedía cada uno. */
let enviados: { model: string; body: Record<string, never> }[] = [];

/** Respuesta con la que contesta el falso servidor a cada modelo. */
let responder: (model: string) => { ok: boolean; status?: number; message?: string };

beforeEach(() => {
  // Los tests corren en Node, sin navegador: la clave vive en localStorage.
  const guardado = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => guardado.get(k) ?? null,
    setItem: (k: string, v: string) => void guardado.set(k, v),
    removeItem: (k: string) => void guardado.delete(k),
  });

  setApiKey('AIzaClaveDePrueba');
  enviados = [];
  responder = () => ({ ok: true });

  vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
    const model = /models\/([^:]+):/.exec(url)?.[1] ?? '';
    const body = JSON.parse(init.body);
    enviados.push({ model, body });

    const r = responder(model);
    if (r.ok) {
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'listo' }] } }] }) };
    }
    return { ok: false, status: r.status ?? 400, json: async () => ({ error: { message: r.message ?? '' } }) };
  });
});

afterEach(() => vi.unstubAllGlobals());

const config = (i = 0) => enviados[i].body.generationConfig as unknown as Record<string, unknown>;

describe('nivel de razonamiento', () => {
  it('por defecto va en low, no en el minimal de fábrica de Flash-Lite', async () => {
    await callGemini('sistema', 'pregunta');
    expect(config().thinkingLevel).toBe('low');
  });

  it('respeta el high que piden informes, rúbricas y dianas', async () => {
    await callGemini('sistema', 'pregunta', [], {}, { thinkingLevel: 'high' });
    expect(config().thinkingLevel).toBe('high');
  });

  it('viaja dentro de generationConfig, junto al resto de ajustes', async () => {
    await callGemini('sistema', 'pregunta', [], {}, { thinkingLevel: 'high', maxOutputTokens: 999 });
    expect(config()).toMatchObject({ thinkingLevel: 'high', maxOutputTokens: 999 });
  });

  it('NO se manda a los modelos 2.x, que no lo entienden', async () => {
    // Los 3.x no están disponibles para esta clave: se cae al respaldo 2.x.
    responder = model => model.startsWith('gemini-3')
      ? { ok: false, status: 404, message: 'model not found' }
      : { ok: true };

    await callGemini('sistema', 'pregunta', [], {}, { thinkingLevel: 'high' });

    const porModelo = Object.fromEntries(
      enviados.map(e => [e.model, 'thinkingLevel' in (e.body.generationConfig as object)]),
    );
    expect(porModelo['gemini-3.5-flash-lite']).toBe(true);
    expect(porModelo['gemini-2.5-flash']).toBe(false);
  });

  it('si el modelo rechaza el nivel, reintenta sin él en vez de quedarse sin IA', async () => {
    let primera = true;
    responder = () => {
      if (primera) { primera = false; return { ok: false, status: 400, message: 'Invalid value for thinking_level' }; }
      return { ok: true };
    };

    const texto = await callGemini('sistema', 'pregunta', [], {}, { thinkingLevel: 'high' });

    expect(texto).toBe('listo');
    expect('thinkingLevel' in (enviados[0].body.generationConfig as object)).toBe(true);
    expect('thinkingLevel' in (enviados[1].body.generationConfig as object)).toBe(false);
  });

  it('un 400 que no sea del razonamiento sigue cortando la cascada', async () => {
    responder = () => ({ ok: false, status: 400, message: 'API key not valid' });
    const errores: string[] = [];

    await callGemini('sistema', 'pregunta', [], { onError: m => errores.push(m) }, { thinkingLevel: 'high' });

    expect(enviados).toHaveLength(1);
    expect(errores[0]).toMatch(/clave API no es válida/i);
  });
});
