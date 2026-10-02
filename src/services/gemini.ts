/**
 * Servicio de IA (Google Gemini).
 *
 * La clave API la introduce el usuario en «Configuración» y se guarda en este
 * equipo: cifrada por el sistema en la aplicación de escritorio, en
 * localStorage en el navegador. Si un modelo no está disponible o se agota su cuota,
 * se prueba automáticamente con el siguiente de la lista.
 */

import { currentPseudonymizer, privacyInstruction } from './privacy';

const KEY_STORAGE = 'aulapro_gemini_key';

/**
 * El modelo bueno: el más capaz de la familia Flash. En el plan gratuito de
 * Google solo da para unas 20 peticiones al día (septiembre de 2026), así que
 * se reserva para lo que de verdad lo nota —situaciones de aprendizaje,
 * fichas, informes, rúbricas—; ver `modelsFor`.
 */
export const MAIN_MODEL = 'gemini-3.8-flash';

/**
 * Los ligeros: unas 500 peticiones al día gratis y bastante buenos para el
 * día a día (chat, transcribir un horario, retocar un ejercicio).
 */
const LITE_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'] as const;

/** Red de seguridad para que la IA nunca deje de funcionar. */
const LEGACY_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'] as const;

/**
 * Qué modelos probar, en orden. Las tareas grandes (razonamiento medio o alto,
 * o respuestas largas) empiezan por el modelo bueno; el resto, por los
 * ligeros, para no gastar su cupo diario en una pregunta del chat. Si el
 * primero no responde o se ha quedado sin cupo, se pasa al siguiente.
 */
export function modelsFor(options: Pick<GeminiOptions, 'thinkingLevel' | 'maxOutputTokens'> = {}): string[] {
  const heavy = options.thinkingLevel === 'high' || options.thinkingLevel === 'medium' || (options.maxOutputTokens ?? 0) >= 8192;
  return heavy
    ? [MAIN_MODEL, ...LITE_MODELS, ...LEGACY_MODELS]
    : [...LITE_MODELS, MAIN_MODEL, ...LEGACY_MODELS];
}

/* ── Idioma de las respuestas ── */

/**
 * Idioma de la interfaz. Muchas instrucciones a la IA están escritas en
 * castellano o en inglés; en catalán se añade una orden explícita para que
 * todo lo que redacta salga en catalán (ver `callGemini`).
 */
let outputLang: 'es' | 'en' | 'ca' = 'es';
export function setAiLanguage(lang: 'es' | 'en' | 'ca') {
  outputLang = lang;
}

const CATALAN_INSTRUCTION =
  '\n\nIDIOMA DE SALIDA: el docente usa la aplicación en CATALÁN. Todo el texto que redactes para ' +
  'personas (títulos, enunciados, explicaciones, informes, respuestas) debe estar en catalán correcto ' +
  '(català), aunque estas instrucciones estén en castellano. No traduzcas los nombres de campo ni los ' +
  'valores fijos de las listas del esquema JSON, ni los códigos de alumno como [ALU-3].';

/* ── Cupo agotado: no volver a llamar a un modelo hasta que se renueve ── */

const COOLDOWN_KEY = 'aulapro_model_cooldown';

function readCooldowns(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(COOLDOWN_KEY) ?? '{}') as Record<string, number>; } catch { return {}; }
}

function writeCooldowns(c: Record<string, number>) {
  try { localStorage.setItem(COOLDOWN_KEY, JSON.stringify(c)); } catch { /* sin almacenamiento: solo dura esta sesión */ }
}

/**
 * El cupo diario de Google se renueva a medianoche de la hora del Pacífico:
 * las 9:00 en la España peninsular, en verano y en invierno (los dos cambian
 * de hora, salvo un par de semanas al año en que la diferencia es de una hora).
 */
export function nextDailyReset(now: Date = new Date()): number {
  const pacific = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const offset = now.getTime() - pacific.getTime();
  const midnight = new Date(pacific);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() + offset;
}

/** Un 429 puede ser «demasiadas por minuto» o «se acabó el cupo de hoy». */
function markExhausted(model: string, apiMessage: string, now = Date.now()) {
  const daily = /per ?day|PerDay|daily/i.test(apiMessage);
  const c = readCooldowns();
  c[model] = daily ? nextDailyReset(new Date(now)) : now + 60_000;
  writeCooldowns(c);
}

function isCoolingDown(model: string, now = Date.now()): boolean {
  const until = readCooldowns()[model];
  return !!until && until > now;
}

/** Para Configuración: si el modelo bueno ya gastó su cupo de hoy, hasta cuándo. */
export function mainModelPausedUntil(): number | null {
  const until = readCooldowns()[MAIN_MODEL];
  return until && until > Date.now() + 60_000 ? until : null;
}

/**
 * La clave, ya descifrada, en memoria. En la aplicación de escritorio vive
 * cifrada por el sistema operativo (electron/secrets.cjs) y se lee una vez al
 * arrancar con `initApiKey`; así `getApiKey` sigue siendo síncrona para las
 * pantallas. En el navegador no hay cifrado posible y se usa localStorage.
 */
let cachedKey: string | null = null;

const secretsBridge = () => (typeof window !== 'undefined' ? window.electronAPI?.secrets : undefined);

function readLocal(): string {
  try { return (localStorage.getItem(KEY_STORAGE) ?? '').trim(); } catch { return ''; }
}

function writeLocal(k: string) {
  try {
    if (k) localStorage.setItem(KEY_STORAGE, k);
    else localStorage.removeItem(KEY_STORAGE);
  } catch { /* almacenamiento no disponible */ }
}

/**
 * Carga la clave antes de pintar la aplicación. Si venía de una versión
 * anterior (en claro, en localStorage), la pasa al almacén cifrado y borra la
 * copia en claro.
 */
export async function initApiKey(): Promise<void> {
  const bridge = secretsBridge();
  if (!bridge) { cachedKey = readLocal(); return; }
  try {
    const stored = (await bridge.get('gemini')).trim();
    const legacy = readLocal();
    if (stored) {
      cachedKey = stored;
      if (legacy) writeLocal('');
    } else if (legacy) {
      cachedKey = legacy;
      if (await bridge.set('gemini', legacy)) writeLocal('');
    } else {
      cachedKey = '';
    }
  } catch {
    cachedKey = readLocal();
  }
}

export function getApiKey(): string {
  return cachedKey ?? readLocal();
}

export function setApiKey(key: string) {
  const k = key.trim();
  cachedKey = k;
  const bridge = secretsBridge();
  if (!bridge) { writeLocal(k); return; }
  // Cifrada si el sistema lo permite; si no, como hasta ahora.
  bridge.set('gemini', k)
    .then(ok => writeLocal(ok ? '' : k))
    .catch(() => writeLocal(k));
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

export interface InlineFile {
  name: string;
  mimeType: string;
  base64: string;
}

/**
 * Un turno de conversación ya cerrado. Se manda entero en cada pregunta
 * nueva: la API de Gemini no guarda nada entre llamadas, así que la «memoria»
 * del chat consiste literalmente en volver a enviarle lo anterior.
 */
export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

interface GeminiCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  /** Recibe un mensaje de error legible para mostrar al usuario. */
  onError?: (message: string) => void;
}

function friendlyError(status: number, apiMessage: string): string {
  if (status === 401 || (status === 400 && /api key/i.test(apiMessage))) return 'La clave API no es válida. Revísala en Configuración.';
  if (status === 403) return 'La clave API no tiene permiso para usar Gemini. Genera una nueva en Google AI Studio.';
  if (status === 429) {
    return /per ?day|PerDay|daily/i.test(apiMessage)
      ? 'Se ha agotado el cupo gratuito de hoy de la IA de Google. Se renueva cada día a las 9:00.'
      : 'Se ha alcanzado el límite gratuito de peticiones. Espera un minuto y vuelve a intentarlo.';
  }
  if (status >= 500) return 'El servicio de Google no responde ahora mismo. Inténtalo en unos minutos.';
  return apiMessage || `Error ${status} al llamar a la IA.`;
}

/**
 * Cuánto razona el modelo antes de responder. Solo lo entiende la familia
 * Gemini 3; en los modelos 2.x del respaldo no se manda (ver `callModel`).
 */
export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

/**
 * Nivel por defecto. Se pone explícitamente en vez de dejar el de fábrica
 * porque el de `gemini-3.5-flash-lite` es `minimal`, que se queda corto en
 * cuanto hay que razonar un poco; `low` cuesta apenas nada más.
 */
const DEFAULT_THINKING: ThinkingLevel = 'low';

/** `thinking_level` es de la familia Gemini 3; los 2.x usan otro mecanismo. */
function supportsThinkingLevel(model: string): boolean {
  return /^gemini-3/.test(model);
}

/** Ajustes opcionales de una llamada. Sin ellos, todo sigue como siempre. */
export interface GeminiOptions {
  /** Modelos a probar en orden. Por defecto, los que elige `modelsFor`. */
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
  /**
   * 0-2, cuánto varía la respuesta entre llamadas idénticas. Sin especificar,
   * la API usa su propio valor por defecto (en torno a 1). Subirlo un poco
   * ayuda cuando la salida tiende a repetirse (p. ej. las mismas medidas de
   * siempre en las figuras geométricas de las fichas): con `responseSchema`
   * puesto, el modelo ya tiende a converger en respuestas "típicas" incluso
   * a temperatura normal.
   */
  temperature?: number;
  /**
   * Turnos anteriores de la conversación, del más antiguo al más reciente.
   * Sin esto cada pregunta llega como si fuera la primera y no se puede
   * repreguntar («¿y para 2ºB?»), que es justo lo que se espera de un chat.
   */
  history?: readonly ChatTurn[];
  /**
   * Cuánto debe razonar antes de responder. Por defecto `low`, que vale para
   * generar una ficha o transcribir un horario. Las tareas que cruzan datos de
   * verdad —informes, rúbricas, dianas, el asistente del cuaderno— piden
   * `high`: tardan más, pero es donde se nota el razonamiento pedagógico.
   */
  thinkingLevel?: ThinkingLevel;
}

const DEFAULT_MAX_TOKENS = 4096;

async function callModel(
  model: string,
  key: string,
  systemPrompt: string,
  userParts: object[],
  options: GeminiOptions = {},
  /**
   * Reintento sin tocar el razonamiento. No basta con quitar `thinkingLevel`
   * de las opciones: entonces se aplicaría el valor por defecto y el campo
   * seguiría viajando, que es justo lo que el reintento quiere evitar.
   */
  omitirRazonamiento = false,
): Promise<{ text: string } | { status: number; message: string }> {
  const contents = [
    ...(options.history ?? []).map(turn => ({ role: turn.role, parts: [{ text: turn.text }] })),
    { role: 'user', parts: userParts },
  ];

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
  };
  if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
  if (!omitirRazonamiento && supportsThinkingLevel(model)) {
    generationConfig.thinkingLevel = options.thinkingLevel ?? DEFAULT_THINKING;
  }
  if (options.responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = options.responseSchema;
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig,
      }),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    return { status: res.status, message: err?.error?.message ?? '' };
  }

  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  // Todas las partes, no solo la primera: una respuesta larga puede llegar
  // repartida en varias y quedarse a medias si se lee únicamente `parts[0]`.
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map(p => p.text ?? '')
    .join('')
    .trim();
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
      callbacks.onError?.('Configura tu clave API gratuita de Google en Configuración para usar la IA.');
      return null;
    }

    // Ningún nombre del alumnado sale del equipo: ver services/privacy.ts.
    const privacy = currentPseudonymizer();
    const maskedUser = privacy.mask(userPrompt);
    const maskedHistory = options.history?.map(turn => ({ ...turn, text: privacy.mask(turn.text) }));
    let maskedSystem = privacy.mask(systemPrompt);
    if ([maskedSystem, maskedUser, ...(maskedHistory ?? []).map(h => h.text)].some(t => privacy.hasCodes(t))) {
      maskedSystem += privacyInstruction();
    }
    if (outputLang === 'ca') maskedSystem += CATALAN_INSTRUCTION;
    const callOptions: GeminiOptions = maskedHistory ? { ...options, history: maskedHistory } : options;

    const userParts: object[] = [{ text: maskedUser }];
    files.forEach(f => {
      if (f?.base64 && f?.mimeType) {
        userParts.push({ inline_data: { mime_type: f.mimeType, data: f.base64 } });
      }
    });

    let lastError = '';
    const order = options.models ?? modelsFor(options);
    // Los que se quedaron sin cupo se saltan; si todos lo están, se prueban igualmente
    const ready = order.filter(m => !isCoolingDown(m));
    for (const model of ready.length ? ready : order) {
      try {
        let result = await callModel(model, key, maskedSystem, userParts, callOptions);

        /**
         * Si el modelo rechaza el nivel de razonamiento —porque no acepta ese
         * valor concreto, o porque Google renombra el campo algún día— se
         * reintenta sin él antes que dejar al docente sin IA. Un 400 corta la
         * cascada entera (ver abajo), así que sin este reintento un detalle de
         * la API tumbaría todas las funciones de golpe.
         */
        if ('status' in result && result.status === 400 && /thinking/i.test(result.message)) {
          result = await callModel(model, key, maskedSystem, userParts, callOptions, true);
        }

        if ('text' in result) return privacy.unmask(result.text);

        lastError = friendlyError(result.status, result.message);
        if (result.status === 429) markExhausted(model, result.message);
        // Solo un 400 o un 401 (clave no válida) detiene toda la cadena: eso
        // fallaría igual en cualquier modelo. Un 403 aquí no tiene por qué
        // significar que la clave esté mal en general, solo que le falta
        // acceso a ese modelo concreto — se prueba con el siguiente.
        if (result.status === 400 || result.status === 401) break;
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

/** Extrae JSON de una respuesta de Gemini (elimina las vallas markdown). */
export function parseGeminiJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw.replace(/```json?|```/g, '').trim()) as T;
  } catch {
    return null;
  }
}

