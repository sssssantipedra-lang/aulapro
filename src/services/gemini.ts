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

/**
 * Para las peticiones que de verdad piensan, no solo redactan.
 *
 * Una situación de aprendizaje entera —justificación curricular, competencias,
 * saberes y todas las sesiones— es la petición más exigente de la aplicación, y
 * ahí un modelo ligero se nota. Empieza por el mejor y, si la clave gratuita del
 * docente no lo admite o agota su cuota, cae por la escalera de siempre: mejor
 * una SdA correcta de un modelo más sencillo que un error.
 *
 * No se usa en el resto de la aplicación: gasta bastante más por llamada y para
 * traducir una rúbrica o leer un horario los ligeros van sobrados.
 */
export const DEEP_MODELS = [
  'gemini-3.1-pro-preview',
  ...MODELS,
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
  return { text };
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
        // Clave inválida o sin permisos: probar otro modelo no ayuda.
        if (result.status === 400 || result.status === 403) break;
        // 404 (modelo no disponible) o 429 (cuota): probar el siguiente.
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
