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
import { soloDatosDeSalud, textoLibreParaIA } from '../lib/documentoParaIA';
import type { Lang } from '../i18n';

const idioma = (lang: Lang) => (lang === 'en' ? 'INGLÉS' : lang === 'ca' ? 'CATALÁN (català)' : 'ESPAÑOL');
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
  /** El alumnado que hay que sentar (todo él tiene que quedar en una mesa si caben). */
  students: StudentForGrouping[];
  numGroups: number;
  groupSize: number;
  /** Lo que el docente quiera que se tenga en cuenta: conflictos, afinidades, idioma… */
  notasDocente?: string;
  /**
   * Las mesas tal como están (24-11-2026): su nombre, quién se queda sentado en ella y los roles de sus asientos
   * libres, en orden. Sin esto, todas las mesas vacías y con todos los roles. Con alguien sentado, la IA solo
   * reparte a `students` en los asientos libres.
   */
  mesas?: { label: string; sentados: string[]; rolesLibres: (string | null)[] }[];
  /** Los que ya están sentados y se quedan, para que la IA equilibre las mesas contando con ellos. */
  yaSentados?: StudentForGrouping[];
  /** Los roles cooperativos, en orden de asiento, con su responsabilidad. */
  roles?: { name: string; description: string }[];
  /** La forma de las mesas, dicha con palabras («Mesas cooperativas: piezas curvas alrededor de un centro»). */
  forma?: string;
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
  /** Asientos por mesa, o los asientos libres de cada mesa (cuando hay gente que ya estaba sentada y se queda). */
  capacidad: number | number[],
): { grupos: GeneratedGroup[]; sinAsignar: string[] } {
  const validos = new Set(idsValidos);
  const usados = new Set<string>();
  const limpios: GeneratedGroup[] = [];
  const cabe = (i: number) => (Array.isArray(capacidad) ? capacidad[i] ?? 0 : capacidad);

  for (let i = 0; i < numGroups; i++) {
    const g = grupos[i];
    const propios: string[] = [];
    for (const id of g?.estudiantes ?? []) {
      if (validos.has(id) && !usados.has(id) && propios.length < cabe(i)) {
        propios.push(id);
        usados.add(id);
      }
    }
    limpios.push({ estudiantes: propios, justificacion: g?.justificacion?.trim() ?? '' });
  }

  // Quien la IA se dejó fuera va a la mesa con más asientos libres (la primera, si empatan): así no se llena una
  // mesa mientras otra se queda medio vacía
  const huerfanos = idsValidos.filter(id => !usados.has(id));
  const sinAsignar: string[] = [];
  for (const id of huerfanos) {
    let mejor = -1;
    limpios.forEach((g, i) => {
      const libres = cabe(i) - g.estudiantes.length;
      if (libres > 0 && (mejor < 0 || libres > cabe(mejor) - limpios[mejor].estudiantes.length)) mejor = i;
    });
    if (mejor >= 0) { limpios[mejor].estudiantes.push(id); usados.add(id); }
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
  // Avisos y anotaciones son texto libre del docente: sin datos de contacto ni de salud (auditoría del 5-11-2026)
  const avisos = s.avisos.map(textoLibreParaIA).filter(a => a.trim() && !soloDatosDeSalud(a));
  if (avisos.length) partes.push(`avisos: ${avisos.join('; ')}`);
  const notas = textoLibreParaIA(s.notas.trim());
  if (notas) partes.push(`nota del docente: ${notas}`);
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

  // Cada mesa: quién se queda y qué asientos (con su rol) tiene libres. Sin `mesas`, todas vacías.
  const roles = req.roles ?? [];
  const mesas = req.mesas ?? Array.from({ length: req.numGroups }, (_, i) => ({
    label: `${i + 1}`, sentados: [] as string[], rolesLibres: Array.from({ length: req.groupSize }, (_, k) => roles[k]?.name ?? null),
  }));
  const capacidades = mesas.map(m => m.rolesLibres.length);
  const libresTotales = capacidades.reduce((a, b) => a + b, 0);
  const hayRoles = roles.length > 0;
  const conGente = mesas.some(m => m.sentados.length > 0);

  const GROUP_SCHEMA = {
    type: 'OBJECT',
    properties: {
      estudiantes: {
        type: 'ARRAY',
        description:
          `Los alumnos que se sientan en esta mesa, como mucho tantos como asientos libres tenga` +
          (hayRoles ? ', EN EL ORDEN de sus asientos libres (el primero ocupa el primer asiento libre y se queda con su rol)' : '') +
          `. Cada uno es un id EXACTO de esta lista cerrada, sin repetir ninguno entre mesas: ${ids.join(', ')}.`,
        items: { type: 'STRING', enum: ids },
      },
      justificacion: S('Por qué esta mesa queda equilibrada y multinivel' + (hayRoles ? ' y por qué cada rol encaja con quien lo tiene' : '') + ', en 1 o 2 frases'),
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
    `Formas grupos EQUILIBRADOS: cada mesa mezcla niveles, nunca todos los de media alta en una ` +
    `mesa y todos los de media baja en otra, y el nivel medio de cada mesa queda lo más parecido ` +
    `posible al de las demás. La asistencia, los avisos y las anotaciones del docente pesan tanto ` +
    `como la media: dos alumnos con avisos de conflicto entre ellos no van juntos aunque el reparto ` +
    `numérico saliera más limpio. Si el docente da instrucciones concretas, van por encima de todo ` +
    `lo demás.\n` +
    `USA EXCLUSIVAMENTE los ids de la lista cerrada que se te da, cada uno exactamente una vez: ` +
    `TODOS los alumnos de la lista tienen que quedar sentados en alguna mesa` +
    (ids.length > libresTotales ? ` (hay más alumnos que asientos libres: sienta a todos los que quepan)` : '') + `.\n` +
    `Respeta los asientos libres de cada mesa: nunca pongas en una mesa más alumnos que asientos libres tiene. ` +
    `Reparte de modo que las mesas queden con un número de personas lo más parecido posible (una de diferencia como ` +
    `mucho, contando a quien ya está sentado), salvo que las instrucciones del docente pidan otra cosa.\n` +
    (hayRoles
      ? `Cada asiento tiene un rol cooperativo. Devuelve los alumnos de cada mesa en el orden de sus asientos libres, ` +
        `de modo que cada uno se quede con el rol que mejor le encaje por lo que se sabe de él, y que ninguna mesa se ` +
        `quede sin quien pueda llevar bien su rol.\n`
      : '') +
    `Devuelve EXACTAMENTE ${mesas.length} mesas, en el mismo orden en que se te dan.\n` +
    `El idioma de salida DEBE SER ${idioma(lang)}.`;

  const lineaMesa = (m: typeof mesas[number], i: number) =>
    `- Mesa ${i + 1} («${m.label}»): ${m.rolesLibres.length} asientos libres` +
    (hayRoles && m.rolesLibres.length ? `, en este orden: ${m.rolesLibres.map(r => r ?? 'sin rol').join(', ')}` : '') +
    (m.sentados.length ? `; ya sentados y se quedan: ${m.sentados.join(', ')}` : '');

  const userPrompt =
    `CÓMO SON LAS MESAS (lo ha elegido el docente):\n` +
    `- ${mesas.length} mesas de ${req.groupSize} asientos` + (req.forma ? `. ${req.forma}` : '') + `.\n` +
    `- Alumnado por sentar: ${ids.length}. Asientos libres en total: ${libresTotales}.\n` +
    (hayRoles ? `- Roles de cada mesa, en orden de asiento: ${roles.map((r, k) => `${k + 1}. ${r.name}${r.description.trim() ? ` (${r.description.trim()})` : ''}`).join('; ')}.\n` : '') +
    `\nMESAS:\n${mesas.map(lineaMesa).join('\n')}\n` +
    `\nALUMNADO POR SENTAR (id · nombre · media · asistencia · avisos · nota del docente):\n` +
    req.students.map(fichaAlumno).join('\n') +
    (conGente && req.yaSentados?.length
      ? `\n\nYA SENTADOS, QUE SE QUEDAN EN SU MESA (solo para equilibrar; no los devuelvas):\n${req.yaSentados.map(fichaAlumno).join('\n')}`
      : '') +
    (req.notasDocente?.trim() ? `\n\nASPECTOS A TENER EN CUENTA DEL DOCENTE: ${textoLibreParaIA(req.notasDocente.trim())}` : '') +
    `\n\nReparte a todo el alumnado por sentar en las ${mesas.length} mesas.`;

  const raw = await callGemini(systemPrompt, userPrompt, [], callbacks, {
    maxOutputTokens: 4096,
    responseSchema: SCHEMA,
    thinkingLevel: 'medium',
  });
  if (!raw) return null;

  const parsed = parseGeminiJson<GroupingResult>(raw);
  if (!parsed?.grupos) return null;

  return repararGrupos(parsed.grupos, ids, mesas.length, capacidades);
}
