/**
 * Grupos cooperativos equilibrados (multinivel), generados por la IA a
 * partir de datos reales del alumnado — no de una lista al azar.
 *
 * El mismo principio que el resto de la aplicación: nada de inventar. La IA
 * no ve nombres sueltos, ve la media ponderada real, la asistencia real, los
 * avisos y las anotaciones del docente — los mismos datos que ya arma
 * `aiContext.ts` para el asistente del cuaderno — y elige por id de una lista
 * cerrada (`enum` en el esquema), igual que ya hace `learningSituations.ts`
 * con las competencias específicas: la IA no puede devolver un id que no
 * exista, porque el esquema se lo impide antes de intentarlo siquiera.
 *
 * Aun así, `repararGrupos()` no se fía a ciegas: si el modelo repite un id,
 * se salta a alguien o deja huecos, se corrige en vez de dejar que un alumno
 * desaparezca del aula o aparezca sentado en dos mesas a la vez.
 */

import { callGemini, parseGeminiJson } from './gemini';
import type { Lang } from '../i18n';

const idioma = (lang: Lang) => (lang === 'en' ? 'INGLÉS' : 'ESPAÑOL');
const S = (d: string) => ({ type: 'STRING', description: d });

/** Lo que se sabe de un alumno a la hora de repartir grupos. */
export interface StudentForGrouping {
  id: string;
  name: string;
  /** Media ponderada real (`weightedAverage` de aiContext.ts), o null si no hay notas. */
  media: number | null;
  /** Porcentaje de asistencia real, o null si no hay datos. */
  asistenciaPct: number | null;
  /** Texto de sus avisos (`Student.alerts`). */
  avisos: string[];
  /** Anotación libre del docente (`Student.notes`). */
  notas: string;
}

export interface GroupingRequest {
  students: StudentForGrouping[];
  numGroups: number;
  groupSize: number;
  /** Lo que el docente quiera que se tenga en cuenta: conflictos, afinidades, idioma… */
  notasDocente?: string;
}

/** Un grupo tal y como lo devuelve la IA — el nombre del campo es el literal del esquema. */
export interface GeneratedGroup {
  estudiantes: string[];
  justificacion: string;
}

export interface GroupingResult {
  grupos: GeneratedGroup[];
}

/**
 * Corrige la respuesta antes de fiarse de ella: cada alumno de la lista real
 * debe aparecer EXACTAMENTE una vez en el resultado final.
 *
 * - Un id repetido, inventado o de más allá del tamaño del grupo se descarta.
 * - Quien se quede fuera (porque la IA lo omitió, o porque un grupo llegó ya
 *   completo antes de llegarle el turno) se reparte en el primer grupo con
 *   hueco, en el mismo orden en que aparece en la lista original.
 *
 * Con más alumnos que asientos (`numGroups × groupSize < total`), algunos se
 * quedan sin mesa: se devuelven aparte en `sinAsignar`, nunca se descartan en
 * silencio — es la pantalla quien decide qué enseñar de eso.
 */
export function repararGrupos(
  grupos: { estudiantes?: string[]; justificacion?: string }[],
  idsValidos: string[],
  numGroups: number,
  groupSize: number,
): { grupos: GeneratedGroup[]; sinAsignar: string[] } {
  const validos = new Set(idsValidos);
  const usados = new Set<string>();
  const limpios: GeneratedGroup[] = [];

  for (let i = 0; i < numGroups; i++) {
    const g = grupos[i];
    const propios: string[] = [];
    for (const id of g?.estudiantes ?? []) {
      if (validos.has(id) && !usados.has(id) && propios.length < groupSize) {
        propios.push(id);
        usados.add(id);
      }
    }
    limpios.push({ estudiantes: propios, justificacion: g?.justificacion?.trim() ?? '' });
  }

  const huerfanos = idsValidos.filter(id => !usados.has(id));
  const sinAsignar: string[] = [];
  for (const id of huerfanos) {
    const conHueco = limpios.find(g => g.estudiantes.length < groupSize);
    if (conHueco) { conHueco.estudiantes.push(id); usados.add(id); }
    else sinAsignar.push(id);
  }

  return { grupos: limpios, sinAsignar };
}

function fichaAlumno(s: StudentForGrouping): string {
  const partes = [
    `${s.id} · ${s.name}`,
    `media ${s.media !== null ? s.media.toFixed(1) : 'sin notas'}`,
    `asistencia ${s.asistenciaPct !== null ? `${s.asistenciaPct}%` : 'sin datos'}`,
  ];
  if (s.avisos.length) partes.push(`avisos: ${s.avisos.join('; ')}`);
  if (s.notas.trim()) partes.push(`nota del docente: ${s.notas.trim()}`);
  return `- ${partes.join(' · ')}`;
}

/**
 * Genera `numGroups` grupos de hasta `groupSize` alumnos, equilibrados y
 * multinivel: cada grupo debe mezclar niveles en vez de juntar a todos los de
 * media alta en uno y a todos los de media baja en otro.
 *
 * Ya viene reparado (ver `repararGrupos`): quien llame no tiene que volver a
 * comprobar duplicados ni ids inventados, solo puede encontrarse con
 * `sinAsignar` no vacío si hay más alumnos que asientos.
 */
export async function generateBalancedGroups(
  req: GroupingRequest,
  lang: Lang,
  callbacks: { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void } = {},
): Promise<{ grupos: GeneratedGroup[]; sinAsignar: string[] } | null> {
  const ids = req.students.map(s => s.id);
  if (ids.length === 0) return { grupos: [], sinAsignar: [] };

  const GROUP_SCHEMA = {
    type: 'OBJECT',
    properties: {
      estudiantes: {
        type: 'ARRAY',
        description:
          `Hasta ${req.groupSize} alumnos para esta mesa. Cada uno es un id EXACTO de esta lista ` +
          `cerrada, sin repetir ninguno entre mesas: ${ids.join(', ')}.`,
        items: { type: 'STRING', enum: ids },
      },
      justificacion: S('Por qué este grupo queda equilibrado y multinivel, en 1 o 2 frases'),
    },
    required: ['estudiantes', 'justificacion'],
    propertyOrdering: ['estudiantes', 'justificacion'],
  } as const;

  const SCHEMA = {
    type: 'OBJECT',
    properties: {
      grupos: { type: 'ARRAY', items: GROUP_SCHEMA },
    },
    required: ['grupos'],
  } as const;

  const systemPrompt =
    `Eres un experto en aprendizaje cooperativo y agrupamientos heterogéneos (multinivel). ` +
    `Formas grupos EQUILIBRADOS: cada mesa mezcla niveles —nunca todos los de media alta en una ` +
    `mesa y todos los de media baja en otra—, y el nivel medio de cada mesa queda lo más parecido ` +
    `posible al de las demás. La asistencia, los avisos y las anotaciones del docente pesan tanto ` +
    `como la media: dos alumnos con avisos de conflicto entre ellos no van juntos aunque el reparto ` +
    `numérico saliera más limpio. Si el docente da instrucciones concretas, van por encima de todo ` +
    `lo demás.\n` +
    `USA EXCLUSIVAMENTE los ids de la lista cerrada que se te da, cada uno como mucho una vez. ` +
    `No hace falta que cuadre exacto: si un alumno encaja mejor solo por avisos o afinidad, prioriza ` +
    `eso sobre dejar las mesas con el mismo número de personas.\n` +
    `Crea EXACTAMENTE ${req.numGroups} mesas.\n` +
    `El idioma de salida DEBE SER ${idioma(lang)}.`;

  const userPrompt =
    `ALUMNADO (id · nombre · media · asistencia · avisos · nota del docente):\n` +
    req.students.map(fichaAlumno).join('\n') +
    (req.notasDocente?.trim() ? `\n\nASPECTOS A TENER EN CUENTA DEL DOCENTE: ${req.notasDocente.trim()}` : '') +
    `\n\nGenera las ${req.numGroups} mesas.`;

  const raw = await callGemini(systemPrompt, userPrompt, [], callbacks, {
    maxOutputTokens: 4096,
    responseSchema: SCHEMA,
    thinkingLevel: 'medium',
  });
  if (!raw) return null;

  const parsed = parseGeminiJson<GroupingResult>(raw);
  if (!parsed?.grupos) return null;

  return repararGrupos(parsed.grupos, ids, req.numGroups, req.groupSize);
}
