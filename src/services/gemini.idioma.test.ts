/**
 * El idioma de lo que redacta la IA: en castellano se le pide con todas sus
 * tildes y eñes (Flash-Lite las quitaba a menudo, o escribía «&aacute;»), en
 * catalán, en catalán. Y lo que aun así llegue escrito como entidad HTML se
 * repara en el único punto por el que pasa toda respuesta.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGemini, fixStrayEscapes, pareceSinTildes, setAiLanguage, setApiKey } from './gemini';

/** Lo que contesta Google cuando se pide la respuesta por partes (`alt=sse`). */
const sse = (text: string) => new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`, { status: 200 });

let enviados: { system: string }[] = [];
let respuesta = '';
/** Si se da, cada llamada contesta con la siguiente de la lista. */
let respuestas: string[] = [];

beforeEach(() => {
  const guardado = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => guardado.get(k) ?? null,
    setItem: (k: string, v: string) => void guardado.set(k, v),
    removeItem: (k: string) => void guardado.delete(k),
  });
  setApiKey('AIzaClaveDePrueba');
  enviados = [];
  respuestas = [];
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    enviados.push({ system: JSON.parse(init.body).system_instruction.parts[0].text });
    const text = respuestas.length ? respuestas.shift()! : respuesta;
    return sse(text);
  });
});

afterEach(() => { vi.unstubAllGlobals(); setAiLanguage('es'); });

describe('idioma de lo que redacta la IA', () => {
  it('en castellano pide todas las tildes y eñes; en catalán, catalán; en inglés, nada más', async () => {
    respuesta = 'listo';
    setAiLanguage('es');
    await callGemini('sistema', 'pregunta');
    expect(enviados[0].system).toMatch(/IDIOMA DE SALIDA: castellano de España/);
    expect(enviados[0].system).toMatch(/tildes y eñes/);
    setAiLanguage('ca');
    await callGemini('sistema', 'pregunta');
    expect(enviados[1].system).toMatch(/CATALÁN/);
    expect(enviados[1].system).not.toMatch(/castellano de España/);
    setAiLanguage('en');
    await callGemini('sistema', 'pregunta');
    expect(enviados[2].system).toBe('sistema');
  });

  it('repara las letras que llegan como entidad HTML, y nada más', async () => {
    respuesta = '{"titulo":"Minib&aacute;dminton en el pabell&oacute;n","nota":"&iquest;Ni&ntilde;os? s&#237; &#xF1;"}';
    expect(JSON.parse((await callGemini('s', 'p'))!)).toEqual({ titulo: 'Minibádminton en el pabellón', nota: '¿Niños? sí ñ' });
    expect(fixStrayEscapes('a &lt;b&gt; &amp; c &#60; &copy; l&middot;l')).toBe('a &lt;b&gt; &amp; c &#60; &copy; l·l');
    expect(fixStrayEscapes('m%u00f3vil')).toBe('móvil');
  });

  it('una respuesta larga sin ninguna tilde se pide otra vez, una sola, y se queda la buena', async () => {
    const sin = 'El balon pasa por encima de la red y el equipo contrario lo devuelve. '.repeat(10);
    const con = 'El balón pasa por encima de la red y el equipo contrario lo devuelve. '.repeat(10);
    expect(pareceSinTildes(sin)).toBe(true);
    expect(pareceSinTildes(con)).toBe(false);
    expect(pareceSinTildes('Mates, 3 A')).toBe(false);

    respuestas = [sin, con];
    expect(await callGemini('s', 'p')).toBe(con.trim());
    expect(enviados).toHaveLength(2);

    // Si la segunda tampoco las trae, se queda la primera: no se insiste más
    enviados = [];
    respuestas = [sin, sin + 'otra'];
    expect(await callGemini('s', 'p')).toBe(sin.trim());
    expect(enviados).toHaveLength(2);

    // En inglés no se mira
    enviados = [];
    setAiLanguage('en');
    respuestas = [sin];
    await callGemini('s', 'p');
    expect(enviados).toHaveLength(1);
  });
});
