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
/** La respuesta de Google; puede depender de lo enviado (para usar los códigos de esa petición). */
let respuesta: string | ((enviado: string) => string) = '';

/** Los códigos de alumno que lleva un texto, en orden de aparición y sin repetir (sin el [ALU-3] de ejemplo de la instrucción). */
const codigos = (t: string) => [...new Set(t.match(/\[ALU-\d+\]/g) ?? [])].filter(c => c !== '[ALU-3]');

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
    return sse(typeof respuesta === 'function' ? respuesta(JSON.parse(init.body).contents.at(-1).parts[0].text + JSON.parse(init.body).system_instruction.parts[0].text) : respuesta);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  setPrivacyRoster([]);
});

describe('callGemini y la privacidad del alumnado', () => {
  it('no envía ningún nombre: ni en el sistema, ni en la pregunta, ni en el historial; cada alumno, un solo código en toda la petición', async () => {
    respuesta = 'ok';
    await callGemini(
      'Contexto: Lucía Pérez Navarro tiene media 8.',
      '¿Qué tal va Marco?',
      [],
      {},
      { history: [{ role: 'user', text: 'Háblame de Lucía' }, { role: 'model', text: 'Lucía Pérez va bien' }] },
    );
    expect(enviado).not.toMatch(/Lucía|Marco|Pérez|Rodríguez/);
    expect(enviado).toContain('PRIVACIDAD');
    // Dos alumnos, dos códigos: Lucía tiene el mismo en el sistema y en el historial
    const cuerpo = JSON.parse(enviado);
    const lucia = codigos(cuerpo.system_instruction.parts[0].text)[0];
    expect(codigos(enviado)).toHaveLength(2);
    expect(cuerpo.contents[0].parts[0].text).toContain(lucia);
    expect(cuerpo.contents[1].parts[0].text).toContain(lucia);
  });

  it('cada petición numera al alumnado de nuevo, al azar: no se puede juntar lo de un alumno de una petición a otra', async () => {
    respuesta = 'ok';
    const vistos = new Set<string>();
    for (let i = 0; i < 4; i++) {
      await callGemini('sistema', 'Lucía Pérez Navarro ha faltado tres días.');
      const [c] = codigos(enviado);
      expect(c).toMatch(/^\[ALU-\d{3,4}\]$/);
      vistos.add(c);
    }
    expect(vistos.size).toBeGreaterThan(1);
  });

  it('devuelve la respuesta con los nombres reales, también sin corchetes', async () => {
    // La IA contesta con los códigos de esta petición: el primero que vio es Lucía (sistema) y luego Marco
    respuesta = enviadoTexto => {
      const [marco, lucia] = codigos(enviadoTexto);
      return `${marco} necesita apoyo; ${lucia.slice(1, -1)} puede ayudarle.`;
    };
    const out = await callGemini('Lucía Pérez Navarro va bien.', '¿Qué hago con Marco Rodríguez Gil?');
    expect(out).toBe('Marco Rodríguez Gil necesita apoyo; Lucía Pérez Navarro puede ayudarle.');
  });

  it('un código que la IA se inventa no se convierte en ningún alumno', async () => {
    respuesta = '[ALU-1] y [ALU-2] van bien.';
    const out = await callGemini('sistema', '¿Qué tal Lucía Pérez Navarro?');
    expect(out).toBe('[ALU-1] y [ALU-2] van bien.');
  });

  it('nunca envía un correo electrónico', async () => {
    respuesta = 'ok';
    await callGemini('sistema', 'Escribe a la familia de Marco (familia.rodriguez@correo.es) para la tutoría.');
    expect(enviado).not.toContain('familia.rodriguez@correo.es');
    expect(enviado).toContain('[correo]');
  });

  it('sin nombres en el texto no añade la instrucción de privacidad', async () => {
    respuesta = 'ok';
    await callGemini('Genera una ficha de fracciones.', 'Para 5º de Primaria');
    expect(enviado).not.toContain('PRIVACIDAD');
  });
});
