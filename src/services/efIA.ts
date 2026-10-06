/**
 * La IA de Educación Física: actividades para el banco y sesiones completas.
 * Ver `docs/EF.md`.
 *
 * Todo se apoya en el currículo LOMLOE de la comunidad del docente, en el
 * DUA-A y en los autores de referencia que eligió el dueño (5-10-2026).
 *
 * Datos (decisión del dueño, 5-10-2026): de quien está exento o lesionado, a
 * la IA solo le llega lo que no puede hacer, sin nombre y sin el motivo, que
 * es un dato de salud y se queda en el equipo (ver `limitacionesParaIA`).
 */
import { callGemini, parseGeminiJson, type InlineFile } from './gemini';
import { normativaInclusion } from './apoyoIA';
import { catalogoCriterios, refsDesdeIA, type MateriaDeClase } from '../lib/curriculum/criteriosParaIA';
import { citarNormas, normasDe, NORMAS_ESTATALES, type ComunidadId } from '../lib/curriculum/comunidades';
import type { Etapa } from '../lib/curriculum';
import { IDS_MODALIDADES, MODALIDADES_EF, modalidadParaIA, NIVELES_PARA_IA, recursosParaIA, TIPOS_ACTIVIDAD } from '../lib/ef';
import type { ActividadEF, EfData, InstalacionEF, ModalidadEF, SesionEF, TipoActividadEF } from '../types/ef';
import type { OfficialCriterionRef } from '../types';

type Lang = 'es' | 'en' | 'ca';
type Callbacks = { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void };

/** Los autores de referencia, tal como los eligió el dueño. */
export const AUTORES_EF =
  'Praxiología motriz y juegos: Parlebas (lógica interna de los juegos y dominios de acción motriz: en solitario, ' +
  'de cooperación, de oposición y de cooperación-oposición, en un medio estable o con incertidumbre) y Lavega ' +
  '(juegos tradicionales y educación emocional a través del juego). Iniciación deportiva: Blázquez, y Devís y Peiró ' +
  '(enseñanza comprensiva y juegos modificados). Aprendizaje cooperativo en Educación Física: Fernández-Río. ' +
  'Evaluación formativa y compartida: López-Pastor. Actividades en el medio natural: Granero-Gallegos y ' +
  'Baena-Extremera.';

/** El DUA-A aplicado a la clase de Educación Física. */
export const DUA_A =
  'Diseño Universal para el Aprendizaje y la Accesibilidad (DUA-A): múltiples formas de implicación, de ' +
  'representación y de acción y expresión, y accesibilidad de espacios y materiales. En Educación Física, quien ' +
  'tiene una limitación participa en la MISMA actividad que el grupo, con un cambio en las reglas, el espacio, el ' +
  'material, el tiempo, el papel o el desplazamiento (por ejemplo, otra forma de puntuar, una zona propia, un balón ' +
  'más blando, un papel decisivo como lanzador, capitán o árbitro con poder de juego). Una tarea aparte (anotar, ' +
  'cronometrar) es el último recurso, y siempre ligada al juego de su equipo.';

/** El currículo oficial de Educación Física que toca, para citarlo. */
export function curriculoEF(comunidad: ComunidadId | undefined, etapa: Etapa | undefined): string {
  if (!etapa) return 'Currículo LOMLOE de Educación Física (Real Decreto 157/2022 en Primaria, Real Decreto 217/2022 en la ESO).';
  const normas = (comunidad && normasDe(comunidad, etapa)) || NORMAS_ESTATALES[etapa];
  return `Currículo LOMLOE de Educación Física de ${etapa === 'primaria' ? 'Educación Primaria' : 'la ESO'}: ${citarNormas(normas, 'es', { boletin: false })}.`;
}

/** El marco que va en el mensaje de sistema de toda la IA de EF. */
export function marcoEF(comunidad: ComunidadId | undefined, etapa: Etapa | undefined, lang: Lang): string {
  return (lang === 'en'
    ? 'You are an expert Physical Education teacher in Spain, with years of experience in schools. '
    : 'Eres un docente experto de Educación Física en España, con años de experiencia en centros educativos. ') +
    `\nCurrículo: ${curriculoEF(comunidad, etapa)}` +
    `\nInclusión: ${DUA_A}\n${NIVELES_PARA_IA}\nNormativa de inclusión: ${normativaInclusion(comunidad)}` +
    `\nAutores de referencia: ${AUTORES_EF}` +
    `\nModalidades de juegos y deportes: ${MODALIDADES_EF.map(m => m.label.toLowerCase()).join(', ')}. Cada juego o deporte ` +
    'se trabaja según la lógica de su modalidad y se prepara como ella pide (calentamiento específico, progresión y seguridad).' +
    '\nBásate en este marco y en estos autores, pero no inventes artículos, citas literales ni datos que no se te den. ' +
    'Propuestas seguras, realistas para un grupo entero, con el material y el espacio que se indican, y adecuadas a la ' +
    'edad. Lenguaje claro y práctico, de docente a docente. Sin formato (sin markdown, negritas ni almohadillas), ' +
    // «Texto llano», a secas, hacía que Flash-Lite escribiera sin tildes ni eñes (prueba real del 6-10-2026).
    'pero con la ortografía completa: tildes, eñes, diéresis y signos de apertura.' +
    (lang === 'en' ? '\nWrite every human-readable text in English.' : '');
}

export { limitacionesParaIA, recursosParaIA } from '../lib/ef';

const nombreTipo = (t: TipoActividadEF) => TIPOS_ACTIVIDAD.find(x => x.id === t)!.label;
const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export interface PeticionActividades {
  tipo: TipoActividadEF;
  /** «1º ESO», «5º de Primaria»…, si se sabe. */
  curso?: string;
  etapa?: Etapa;
  /** Qué se quiere trabajar: contenido, objetivo, deporte… */
  tema: string;
  /** Limitaciones que tienen que poder participar, sin nombres. */
  limitaciones: string[];
  /** Usar el inventario de material e instalaciones. */
  conInventario: boolean;
  /** Títulos que ya tiene, para no repetirlos. */
  yaTiene: string[];
  /** La modalidad del juego o deporte, si se pide una. */
  modalidad?: ModalidadEF;
}

/** La IA propone tres actividades para el banco del docente. */
export async function proponerActividades(
  p: PeticionActividades, d: EfData, comunidad: ComunidadId | undefined, lang: Lang, callbacks: Callbacks = {},
): Promise<Omit<ActividadEF, 'id'>[] | null> {
  const recursos = recursosParaIA(d);
  const userPrompt =
    `Tipo de actividad: ${nombreTipo(p.tipo)}\n` +
    (p.modalidad ? `${modalidadParaIA(p.modalidad)}\nLas tres actividades son de esta modalidad y siguen su preparación.\n` : '') +
    (p.curso ? `Curso: ${p.curso}\n` : '') +
    (p.tema.trim() ? `Qué se quiere trabajar: ${p.tema.trim()}\n` : '') +
    (p.conInventario && recursos.material ? `Material disponible: ${recursos.material}\n` : '') +
    (p.conInventario && recursos.instalaciones ? `Instalaciones: ${recursos.instalaciones}\n` : '') +
    (p.limitaciones.length ? `En el grupo hay alumnado con estas limitaciones o niveles de respuesta para la inclusión (una línea por alumno, sin nombres):\n${p.limitaciones.map(l => `- ${l}`).join('\n')}\n` : '') +
    (p.yaTiene.length ? `Actividades que ya tiene (no las repitas): ${p.yaTiene.slice(0, 40).join('; ')}\n` : '') +
    '\nPropón 3 actividades distintas de este tipo, variadas en su lógica interna (Parlebas). Para cada una: ' +
    '"titulo" (corto), "descripcion" (en qué consiste y sus reglas, 2 a 4 frases), "organizacion" (agrupamiento, ' +
    'espacio y duración aproximada), "material", "variantes" (2 o 3 progresiones o variantes, en una o dos frases) e ' +
    '"inclusion" (cómo participa en la misma actividad quien no puede correr, saltar o hacer esfuerzos intensos, o ' +
    'quien tenga las limitaciones indicadas, según el DUA-A; 1 a 3 frases).';
  const raw = await callGemini(marcoEF(comunidad, p.etapa, lang) + '\nResponde SOLO con JSON válido.', userPrompt, [], callbacks, {
    responseSchema: {
      type: 'OBJECT',
      properties: {
        actividades: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              titulo: { type: 'STRING' }, descripcion: { type: 'STRING' }, organizacion: { type: 'STRING' },
              material: { type: 'STRING' }, variantes: { type: 'STRING' }, inclusion: { type: 'STRING' },
            },
            required: ['titulo', 'descripcion', 'organizacion', 'material', 'variantes', 'inclusion'],
          },
        },
      },
      required: ['actividades'],
    },
    thinkingLevel: 'medium',
  });
  if (!raw) return null;
  const parsed = parseGeminiJson<{ actividades?: Record<string, unknown>[] }>(raw);
  const lista = (parsed?.actividades ?? [])
    .map(a => ({
      titulo: texto(a.titulo), tipo: p.tipo, ...(p.modalidad ? { modalidad: p.modalidad } : {}),
      descripcion: texto(a.descripcion), organizacion: texto(a.organizacion),
      material: texto(a.material), variantes: texto(a.variantes), inclusion: texto(a.inclusion), origen: 'ia' as const,
    }))
    .filter(a => a.titulo && a.descripcion);
  if (!lista.length) { callbacks.onError?.('La IA no devolvió actividades. Inténtalo de nuevo.'); return null; }
  return lista;
}

export interface PeticionFoto {
  /** «1º ESO»; o el nombre del grupo, si la clase no tiene curso. */
  curso?: string;
  etapa?: Etapa;
  /** «12 a 13 años», si se sabe el curso. */
  edad?: string;
  /** Lo que el docente quiere que tenga en cuenta. */
  nota: string;
  limitaciones: string[];
  conInventario: boolean;
}

export interface ActividadDeFoto {
  /** Lo que la IA reconoce en la foto, en una frase. */
  visto: string;
  /** La actividad redactada; `null` si la foto no muestra ninguna actividad física. */
  actividad: Omit<ActividadEF, 'id'> | null;
}

/**
 * La IA mira una foto de un deporte o de una actividad (o un esquema, o la
 * página de un libro) y la redacta para la edad del grupo (decisión del dueño,
 * 6-10-2026). La foto llega reducida y sin sus metadatos (`reducirFoto`) y no se
 * guarda; a la IA se le pide que no describa a las personas que salgan.
 */
export async function actividadDesdeFoto(
  p: PeticionFoto, foto: InlineFile, d: EfData, comunidad: ComunidadId | undefined, lang: Lang, callbacks: Callbacks = {},
): Promise<ActividadDeFoto | null> {
  const recursos = recursosParaIA(d);
  const userPrompt =
    'La foto adjunta la ha hecho o elegido el docente. Puede ser un deporte, un juego, un ejercicio o un circuito, un ' +
    'dibujo o esquema de una actividad, o la página de un libro o de una ficha.\n' +
    (p.curso ? `Para: ${p.curso}${p.edad ? ` (${p.edad})` : ''}\n` : 'Para: un grupo de Educación Física (curso sin indicar)\n') +
    (p.nota.trim() ? `Lo que el docente quiere que tengas en cuenta: ${p.nota.trim()}\n` : '') +
    (p.conInventario && recursos.material ? `Material disponible: ${recursos.material}\n` : '') +
    (p.conInventario && recursos.instalaciones ? `Instalaciones: ${recursos.instalaciones}\n` : '') +
    (p.limitaciones.length ? `En el grupo hay alumnado con estas limitaciones o niveles de respuesta para la inclusión (una línea por alumno, sin nombres):\n${p.limitaciones.map(l => `- ${l}`).join('\n')}\n` : '') +
    '\n"visto": en una frase, qué deporte o actividad física reconoces en la foto, sin describir ni identificar a las ' +
    'personas que salgan. "esActividad": "si" si la foto muestra o explica una actividad física que se pueda hacer en ' +
    'clase; si no, "no", y deja vacíos los demás campos. Si es "si", redacta esa actividad para que el docente la haga con ' +
    'su grupo, adaptada a esa edad (reglas, tamaño del espacio, material, duración y exigencia): "titulo" (corto), ' +
    '"tipo" y "modalidad" (de sus listas; "ninguna" si no es de ninguna), "descripcion" (en qué consiste y sus reglas, ' +
    'paso a paso, en 3 a 6 frases), "organizacion" (agrupamiento, espacio, duración aproximada y normas de seguridad ' +
    'para esa edad), "material", "variantes" (2 o 3 progresiones, de la más fácil a la más difícil, en una o dos ' +
    'frases) e "inclusion" (cómo participa en la misma actividad quien no puede correr, saltar o hacer esfuerzos ' +
    'intensos, o quien tenga las limitaciones indicadas, según el DUA-A; 1 a 3 frases). Si la foto es la página de un ' +
    'libro o de una ficha, no copies su texto: redáctala con tus palabras.';
  const raw = await callGemini(marcoEF(comunidad, p.etapa, lang) + '\nResponde SOLO con JSON válido.', userPrompt, [foto], callbacks, {
    responseSchema: {
      type: 'OBJECT',
      properties: {
        visto: { type: 'STRING' },
        esActividad: { type: 'STRING', enum: ['si', 'no'] },
        titulo: { type: 'STRING' },
        tipo: { type: 'STRING', enum: TIPOS_ACTIVIDAD.map(x => x.id) },
        modalidad: { type: 'STRING', enum: [...IDS_MODALIDADES, 'ninguna'] },
        descripcion: { type: 'STRING' }, organizacion: { type: 'STRING' }, material: { type: 'STRING' },
        variantes: { type: 'STRING' }, inclusion: { type: 'STRING' },
      },
      required: ['visto', 'esActividad', 'titulo', 'tipo', 'modalidad', 'descripcion', 'organizacion', 'material', 'variantes', 'inclusion'],
      propertyOrdering: ['visto', 'esActividad', 'titulo', 'tipo', 'modalidad', 'descripcion', 'organizacion', 'material', 'variantes', 'inclusion'],
    },
    thinkingLevel: 'medium',
  });
  if (!raw) return null;
  const a = parseGeminiJson<Record<string, unknown>>(raw);
  if (!a) { callbacks.onError?.('La IA no devolvió la actividad. Inténtalo de nuevo.'); return null; }
  const visto = texto(a.visto);
  const titulo = texto(a.titulo);
  const descripcion = texto(a.descripcion);
  if (a.esActividad !== 'si' || !titulo || !descripcion) return { visto, actividad: null };
  const tipo = TIPOS_ACTIVIDAD.find(x => x.id === a.tipo)?.id ?? 'juego';
  const modalidad = IDS_MODALIDADES.find(m => m === a.modalidad);
  return {
    visto,
    actividad: {
      titulo, tipo, ...(modalidad ? { modalidad } : {}), descripcion,
      organizacion: texto(a.organizacion), material: texto(a.material), variantes: texto(a.variantes),
      inclusion: texto(a.inclusion), origen: 'ia',
    },
  };
}

export interface PeticionSesion {
  curso?: string;
  etapa?: Etapa;
  /** Qué se trabaja en la sesión o en la unidad. */
  tema: string;
  minutos: number;
  instalacion?: InstalacionEF;
  /** Las demás instalaciones cubiertas, para el plan B. */
  cubiertas: InstalacionEF[];
  limitaciones: string[];
  /** Los criterios oficiales de EF de la clase, para elegir de una lista cerrada. */
  materias: MateriaDeClase[];
  /** Actividades del banco del docente que puede aprovechar, si encajan. */
  banco: Pick<ActividadEF, 'titulo' | 'tipo'>[];
  /** La modalidad del juego o deporte que se trabaja, si es uno. */
  modalidad?: ModalidadEF;
}

export type SesionPropuesta = Omit<SesionEF, 'id' | 'claseId' | 'fecha' | 'instalacionId'> & { criterios: OfficialCriterionRef[] };

/** La IA prepara una sesión completa, con medidas DUA-A para las limitaciones de ese día y un plan B. */
export async function prepararSesion(
  p: PeticionSesion, d: EfData, comunidad: ComunidadId | undefined, lang: Lang, callbacks: Callbacks = {},
): Promise<SesionPropuesta | null> {
  const recursos = recursosParaIA(d);
  const { texto: catalogo, disponibles } = catalogoCriterios(p.materias);
  const conCriterios = disponibles.length > 0;
  const lugar = p.instalacion
    ? `${p.instalacion.nombre} (${p.instalacion.cubierta ? 'cubierta' : 'al aire libre'}${p.instalacion.notas.trim() ? `; ${p.instalacion.notas.trim()}` : ''})`
    : '';
  const userPrompt =
    (p.curso ? `Curso: ${p.curso}\n` : '') +
    `Qué se trabaja: ${p.tema.trim()}\n` +
    (p.modalidad ? `${modalidadParaIA(p.modalidad)}\nEl calentamiento es específico de esta modalidad y la sesión sigue su preparación.\n` : '') +
    `Duración de la sesión: ${p.minutos} minutos\n` +
    (lugar ? `Instalación: ${lugar}\n` : '') +
    (recursos.material ? `Material disponible: ${recursos.material}\n` : '') +
    (p.cubiertas.length ? `Espacios cubiertos para el plan B: ${p.cubiertas.map(i => i.nombre).join('; ')}\n` : '') +
    (p.limitaciones.length
      ? `Hoy hay alumnado con estas limitaciones o niveles de respuesta para la inclusión (una línea por alumno, sin nombres):\n${p.limitaciones.map(l => `- ${l}`).join('\n')}\n`
      : 'Hoy no hay nadie exento ni lesionado ni con medidas de nivel II o III.\n') +
    (p.banco.length ? `Actividades de su banco que puedes usar si encajan: ${p.banco.slice(0, 40).map(a => a.titulo).join('; ')}\n` : '') +
    '\nPrepara la sesión. "titulo": corto. "objetivo": una o dos frases, qué aprenderá el alumnado. ' +
    '"calentamiento", "principal" y "calma": cada actividad en su párrafo, separados por un salto de línea, que ' +
    'empiece por su nombre y los minutos entre paréntesis y diga cómo se organiza y sus reglas; los minutos de las tres ' +
    'partes suman la duración (calentamiento 10 a 15, vuelta a la calma 5 a 10, con la recogida). "material": la lista ' +
    'de lo que hace falta, solo de lo disponible. "inclusion": para cada alumno de la lista, cómo participa en las mismas ' +
    'actividades según el DUA-A y su nivel (una o dos frases por alumno, sin nombres); si no hay ninguno, una medida ' +
    'general de accesibilidad. "planB": la misma sesión si llueve o la instalación está ocupada, en un espacio cubierto, en 2 a 4 ' +
    'frases.' +
    (conCriterios
      ? ' En "criterios" elige de 1 a 3 criterios de evaluación oficiales de esta lista cerrada, los que la sesión ' +
        `trabaje de verdad, escritos tal cual («Materia|código»).\n\n${catalogo}`
      : '');
  const raw = await callGemini(marcoEF(comunidad, p.etapa, lang) + '\nResponde SOLO con JSON válido.', userPrompt, [], callbacks, {
    responseSchema: {
      type: 'OBJECT',
      properties: {
        titulo: { type: 'STRING' }, objetivo: { type: 'STRING' }, calentamiento: { type: 'STRING' },
        principal: { type: 'STRING' }, calma: { type: 'STRING' }, material: { type: 'STRING' },
        inclusion: { type: 'STRING' }, planB: { type: 'STRING' },
        ...(conCriterios ? { criterios: { type: 'ARRAY', items: { type: 'STRING', enum: disponibles } } } : {}),
      },
      required: ['titulo', 'objetivo', 'calentamiento', 'principal', 'calma', 'material', 'inclusion', 'planB'],
    },
    thinkingLevel: 'medium',
  });
  if (!raw) return null;
  const s = parseGeminiJson<Record<string, unknown>>(raw);
  if (!s || !texto(s.principal)) { callbacks.onError?.('La IA no devolvió la sesión. Inténtalo de nuevo.'); return null; }
  return {
    titulo: texto(s.titulo), objetivo: texto(s.objetivo), calentamiento: texto(s.calentamiento),
    principal: texto(s.principal), calma: texto(s.calma), material: texto(s.material),
    inclusion: texto(s.inclusion), planB: texto(s.planB),
    criterios: refsDesdeIA(p.materias, s.criterios).slice(0, 3),
  };
}

