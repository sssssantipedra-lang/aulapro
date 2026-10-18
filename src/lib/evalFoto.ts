/**
 * Evaluar por foto (petición del dueño, 18-10-2026, para el profesorado de
 * aula): se fotografía un examen o un trabajo y la IA propone, pregunta por
 * pregunta, qué puntos merece y un comentario; el docente lo revisa y la nota
 * pasa al cuaderno.
 *
 * La IA lee y puntúa cada pregunta, pero la cuenta la hace el código: la nota
 * sale de los puntos que el docente deja en cada pregunta, no de la que la IA
 * diga que sale (los modelos se equivocan sumando), y ningún punto pasa del
 * máximo de su pregunta. Ver `services/evaluarFoto.ts`.
 */

export type EstadoPregunta = 'correcta' | 'parcial' | 'incorrecta' | 'en_blanco' | 'ilegible';

export const ESTADOS_PREGUNTA: readonly { id: EstadoPregunta; label: string }[] = [
  { id: 'correcta', label: 'Correcta' },
  { id: 'parcial', label: 'En parte' },
  { id: 'incorrecta', label: 'Incorrecta' },
  { id: 'en_blanco', label: 'En blanco' },
  { id: 'ilegible', label: 'No se lee' },
];

export interface PreguntaFoto {
  /** «1», «2a»… tal como sale en el examen. */
  n: string;
  enunciado: string;
  /** Lo que el alumno ha escrito, resumido, para que el docente compruebe que la IA lo leyó bien. */
  respuesta: string;
  puntosMax: number;
  puntos: number;
  estado: EstadoPregunta;
  comentario: string;
  /** La IA no está segura de su lectura o de su puntuación: el docente debería mirarla. */
  dudosa: boolean;
}

export interface CorreccionFoto {
  /** Qué ha reconocido: «Examen de fracciones», «Redacción sobre el otoño»… */
  titulo: string;
  preguntas: PreguntaFoto[];
  /** Para el alumno o su familia, en positivo y concreto. */
  comentarioGeneral: string;
  puntosFuertes: string[];
  aMejorar: string[];
  /** Lo que no ha podido leer o ver (una foto borrosa, una página que falta…). */
  avisos: string[];
}

/** Identificador de la columna del cuaderno que crea una corrección por foto. */
export function idColumnaFoto(): string {
  return 'gf' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

/** Redondea a décimas, que es como se ponen las notas. */
export const aDecimas = (n: number) => Math.round(n * 10) / 10;

/** Un número escrito a mano en un cuadro («1,5» o «1.5»); `null` si no lo es. */
export function leerPuntos(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Los puntos dentro de lo posible: ni negativos ni más que el máximo de la pregunta. */
export function puntosValidos(puntos: number, max: number): number {
  return aDecimas(Math.min(Math.max(puntos, 0), max));
}

export interface ResultadoNota {
  puntos: number;
  max: number;
  /** Sobre 10; `null` si no hay puntos que repartir. */
  nota: number | null;
}

/** Lo que suman las preguntas y la nota sobre 10 que sale de ahí. */
export function calcularNota(preguntas: readonly Pick<PreguntaFoto, 'puntos' | 'puntosMax'>[]): ResultadoNota {
  const max = aDecimas(preguntas.reduce((s, p) => s + p.puntosMax, 0));
  const puntos = aDecimas(preguntas.reduce((s, p) => s + puntosValidos(p.puntos, p.puntosMax), 0));
  return { puntos, max, nota: max > 0 ? aDecimas((puntos / max) * 10) : null };
}

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const lista = (v: unknown) => (Array.isArray(v) ? v.map(texto).filter(Boolean) : []);

/**
 * Lo que devuelve la IA, saneado: estados de la lista, máximos positivos,
 * puntos dentro del máximo y sin preguntas vacías. Una pregunta que la IA
 * deja sin máximo recibe uno repartido a partes iguales hasta `total` puntos.
 */
export function normalizarCorreccion(raw: unknown, total = 10): CorreccionFoto | null {
  const o = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
  if (!o || !Array.isArray(o.preguntas)) return null;
  const crudas = o.preguntas.filter((p): p is Record<string, unknown> => !!p && typeof p === 'object');
  const sinMax = crudas.filter(p => !((numero(p.puntosMax) ?? 0) > 0)).length;
  const conMax = crudas.reduce((s, p) => s + Math.max(0, numero(p.puntosMax) ?? 0), 0);
  const parte = sinMax > 0 ? aDecimas(Math.max(total - conMax, sinMax * 0.1) / sinMax) : 0;
  const preguntas: PreguntaFoto[] = crudas
    .map((p, i) => {
      const max = (numero(p.puntosMax) ?? 0) > 0 ? aDecimas(numero(p.puntosMax)!) : parte;
      const estado = ESTADOS_PREGUNTA.find(e => e.id === p.estado)?.id ?? 'parcial';
      return {
        n: texto(p.n) || String(i + 1), enunciado: texto(p.enunciado), respuesta: texto(p.respuesta), puntosMax: max,
        puntos: puntosValidos(numero(p.puntos) ?? 0, max), estado, comentario: texto(p.comentario),
        // Ilegible, o sin leer, siempre merece un vistazo
        dudosa: p.dudosa === true || estado === 'ilegible',
      };
    })
    .filter(p => p.puntosMax > 0 && (p.enunciado || p.respuesta || p.comentario));
  if (!preguntas.length) return null;
  return {
    titulo: texto(o.titulo), preguntas, comentarioGeneral: texto(o.comentarioGeneral),
    puntosFuertes: lista(o.puntosFuertes), aMejorar: lista(o.aMejorar), avisos: lista(o.avisos),
  };
}

/** Si el docente ha corregido a mano algo de lo que propuso la IA (para decirlo en el resumen). */
export function cambiosDelDocente(original: readonly PreguntaFoto[], actual: readonly PreguntaFoto[]): number {
  return actual.filter((p, i) => original[i] && p.puntos !== original[i].puntos).length;
}
