/**
 * Servicio de IA (Google Gemini).
 *
 * La clave API la introduce el usuario en «Mi Perfil» y se guarda en este
 * equipo (localStorage). Si un modelo no está disponible o se agota su cuota,
 * se prueba automáticamente con el siguiente de la lista.
 */

const KEY_STORAGE = 'aulapro_gemini_key';

/**
 * Modelos en orden de preferencia. Se prueban de arriba abajo: si uno no está
 * disponible con la clave del usuario o agota su cuota, se pasa al siguiente.
 * Los 2.x del final son la red de seguridad para que la IA nunca deje de funcionar.
 */
const MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
] as const;

export function getApiKey(): string {
  try { return (localStorage.getItem(KEY_STORAGE) ?? '').trim(); } catch { return ''; }
}

export function setApiKey(key: string) {
  const k = key.trim();
  if (k) localStorage.setItem(KEY_STORAGE, k);
  else localStorage.removeItem(KEY_STORAGE);
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

export interface InlineFile {
  name: string;
  mimeType: string;
  base64: string;
}

interface GeminiCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  /** Recibe un mensaje de error legible para mostrar al usuario. */
  onError?: (message: string) => void;
}

function friendlyError(status: number, apiMessage: string): string {
  if (status === 400 && /api key/i.test(apiMessage)) return 'La clave API no es válida. Revísala en Mi Perfil.';
  if (status === 403) return 'La clave API no tiene permiso para usar Gemini. Genera una nueva en Google AI Studio.';
  if (status === 429) return 'Se ha alcanzado el límite gratuito de peticiones. Espera un minuto y vuelve a intentarlo.';
  if (status >= 500) return 'El servicio de Google no responde ahora mismo. Inténtalo en unos minutos.';
  return apiMessage || `Error ${status} al llamar a la IA.`;
}

/** Ajustes opcionales de una llamada. Sin ellos, todo sigue como siempre. */
export interface GeminiOptions {
  /** Modelos a probar en orden. Por defecto, los ligeros de `MODELS`. */
  models?: readonly string[];
  /**
   * Tope de la respuesta. El de por defecto vale para lo que escribe la IA en
   * casi toda la aplicación, pero una situación de aprendizaje entera no cabe:
   * se cortaría a media frase y el JSON llegaría roto.
   */
  maxOutputTokens?: number;
  /**
   * Forma exacta del JSON que debe devolver. Es mucho más fiable que pedirlo
   * por escrito en el prompt y confiar en que lo respete.
   */
  responseSchema?: object;
}

const DEFAULT_MAX_TOKENS = 4096;

async function callModel(
  model: string,
  key: string,
  systemPrompt: string,
  userParts: object[],
  options: GeminiOptions = {},
): Promise<{ text: string } | { status: number; message: string }> {
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
  };
  if (options.responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = options.responseSchema;
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: userParts }],
        generationConfig,
      }),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    return { status: res.status, message: err?.error?.message ?? '' };
  }

  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { status: 0, message: 'La IA devolvió una respuesta vacía.' };
  return { text: fixStrayPercentU(text) };
}

/**
 * A veces el modelo devuelve alguna letra acentuada como «%u00e1» en vez de
 * «á»: una secuencia de escape que nadie pidió, que no es válida en ningún
 * sitio del JSON (así que `JSON.parse` la deja pasar tal cual, como texto
 * suelto) y que se nota sobre todo con `responseSchema` en peticiones largas.
 * Se repara aquí, en el único punto por el que pasa todo el texto que
 * devuelve la IA, en vez de en cada pantalla que luego lo muestra.
 */
function fixStrayPercentU(text: string): string {
  return text.replace(/%u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Llama a Gemini probando los modelos en orden hasta que uno responda.
 * Devuelve el texto de la respuesta, o null si falló (el mensaje de error
 * legible llega por callbacks.onError).
 */
export async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  files: InlineFile[] = [],
  callbacks: GeminiCallbacks = {},
  options: GeminiOptions = {},
): Promise<string | null> {
  callbacks.onStart?.();
  try {
    const key = getApiKey();
    if (!key) {
      callbacks.onError?.('Configura tu clave API gratuita de Google en Mi Perfil para usar la IA.');
      return null;
    }

    const userParts: object[] = [{ text: userPrompt }];
    files.forEach(f => {
      if (f?.base64 && f?.mimeType) {
        userParts.push({ inline_data: { mime_type: f.mimeType, data: f.base64 } });
      }
    });

    let lastError = '';
    for (const model of options.models ?? MODELS) {
      try {
        const result = await callModel(model, key, systemPrompt, userParts, options);
        if ('text' in result) return result.text;

        lastError = friendlyError(result.status, result.message);
        // Solo un 400 (clave con formato inválido) detiene toda la cadena: eso
        // fallaría igual en cualquier modelo. Un 403 aquí no tiene por qué
        // significar que la clave esté mal en general, solo que le falta
        // acceso a ese modelo concreto — se prueba con el siguiente.
        if (result.status === 400) break;
        // 403 (sin acceso a ESTE modelo), 404 (no disponible) o 429 (cuota):
        // probar el siguiente.
      } catch {
        lastError = 'No hay conexión a internet o el servicio no responde.';
      }
    }

    callbacks.onError?.(lastError || 'No se pudo obtener respuesta de la IA.');
    return null;
  } finally {
    callbacks.onEnd?.();
  }
}

/** Prueba una clave API con una petición mínima. */
export async function testApiKey(key: string): Promise<{ ok: boolean; model?: string; error?: string }> {
  const k = key.trim();
  if (!k) return { ok: false, error: 'Introduce una clave antes de probar.' };

  let lastError = '';
  for (const model of MODELS) {
    try {
      const result = await callModel(model, k, 'Responde únicamente la palabra: OK', [{ text: 'OK' }]);
      if ('text' in result) return { ok: true, model };
      lastError = friendlyError(result.status, result.message);
      if (result.status === 400 || result.status === 403) break;
    } catch {
      lastError = 'No hay conexión a internet o el servicio no responde.';
    }
  }
  return { ok: false, error: lastError };
}

/** Extrae JSON de una respuesta de Gemini (elimina las vallas markdown). */
export function parseGeminiJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw.replace(/```json?|```/g, '').trim()) as T;
  } catch {
    return null;
  }
}

/* ── Generación de imagen ── */

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

/**
 * Modelo aparte de `MODELS`: esos son de texto, este genera imagen de
 * verdad, con su propia cuota gratuita y su propio formato de
 * petición/respuesta — no tiene sentido meterlo en la cadena de
 * `callModel`, que da por hecho que la respuesta es texto.
 *
 * La "lite" es la variante barata y rápida, pensada precisamente para esto
 * —una ilustración decorativa, no crítica—, igual que `MODELS` ya prioriza
 * los "-flash-lite" de texto sobre los más caros. La primera prueba de
 * verdad con `gemini-2.5-flash-image` agotó enseguida el límite gratuito
 * (HTTP 429); con la "lite" el margen debería dar más de sí.
 */
const IMAGE_MODEL = 'gemini-3.1-flash-lite-image';

/**
 * Genera una ilustración con IA a partir de una descripción. Pensada para un
 * uso decorativo, no crítico (una imagen de cabecera en una ficha, por
 * ejemplo): pase lo que pase, quien la llama sigue funcionando
 * perfectamente sin imagen — nunca debe depender de que esto funcione, así
 * que un fallo nunca lanza ni bloquea nada, solo devuelve `null`.
 *
 * Eso sí, el motivo del fallo SÍ se avisa por `onError` (a diferencia de un
 * primer intento que lo tragaba en silencio): sin eso, un fallo real contra
 * el servicio —cuota, el modelo no disponible con esta clave, la forma de
 * la respuesta cambia— era indistinguible de "no lo pediste", y no había
 * forma de saber qué ajustar.
 *
 * Implementada a partir de la documentación pública de la API; la primera
 * vez que se usó de verdad (fuera de este equipo, donde no hay clave para
 * probarla) no llegó a generar ninguna imagen — con este aviso puesto ya se
 * puede ver el motivo exacto en vez de tener que adivinarlo.
 */
export async function generateImage(prompt: string, onError?: (message: string) => void): Promise<GeneratedImage | null> {
  try {
    const key = getApiKey();
    if (!key) { onError?.('Configura tu clave API gratuita de Google en Mi Perfil para generar ilustraciones.'); return null; }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      onError?.(friendlyError(res.status, err?.error?.message ?? ''));
      return null;
    }

    const data = await res.json() as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
    };
    const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
    const inline = part?.inlineData;
    if (!inline?.data || !inline?.mimeType) {
      onError?.('El modelo de imagen no devolvió ninguna ilustración.');
      return null;
    }

    return { base64: inline.data, mimeType: inline.mimeType };
  } catch {
    onError?.('No se pudo generar la ilustración: sin conexión o el servicio no responde.');
    return null;
  }
}
