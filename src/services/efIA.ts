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
import { callGemini, parseGeminiJson } from './gemini';
import { normativaInclusion } from './apoyoIA';
import { catalogoCriterios, refsDesdeIA, type MateriaDeClase } from '../lib/curriculum/criteriosParaIA';
import { citarNormas, normasDe, NORMAS_ESTATALES, type ComunidadId } from '../lib/curriculum/comunidades';
import type { Etapa } from '../lib/curriculum';
import { exentosDelDia, LIMITACIONES, TIPOS_ACTIVIDAD } from '../lib/ef';
import type { ActividadEF, EfData, InstalacionEF, SesionEF, TipoActividadEF } from '../types/ef';
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
    `\nInclusión: ${DUA_A}\nNormativa de inclusión: ${normativaInclusion(comunidad)}` +
    `\nAutores de referencia: ${AUTORES_EF}` +
    '\nBásate en este marco y en estos autores, pero no inventes artículos, citas literales ni datos que no se te den. ' +
    'Propuestas seguras, realistas para un grupo entero, con el material y el espacio que se indican, y adecuadas a la ' +
    'edad. Lenguaje claro y práctico, de docente a docente. Texto llano: sin markdown, sin negritas ni almohadillas.' +
    (lang === 'en' ? '\nWrite every human-readable text in English.' : '');
}

/**
 * Lo que la IA sabe de quien está exento o lesionado ese día en esa clase:
 * solo qué no puede hacer, una línea por alumno, sin nombre ni motivo.
 */
export function limitacionesParaIA(d: EfData, alumnosDeLaClase: string[], fecha: string): string[] {
  const ids = new Set(alumnosDeLaClase);
  return exentosDelDia(d, fecha)
    .filter(e => ids.has(e.alumnoId))
    .map(e => e.limitaciones.map(l => LIMITACIONES.find(x => x.id === l)!.label).concat(e.otra.trim() ? [e.otra.trim()] : []).join(', '))
    .filter(Boolean);
}

/** El material que hay (sin lo que está para reponer) y las instalaciones, para el prompt. */
export function recursosParaIA(d: EfData): { material: string; instalaciones: string } {
  return {
    material: d.material.filter(m => m.estado !== 'reponer' && m.cantidad > 0)
      .map(m => `${m.nombre} (${m.cantidad}${m.estado === 'regular' ? ', en estado regular' : ''})`).join('; '),
    instalaciones: d.instalaciones.map(i => `${i.nombre} (${i.cubierta ? 'cubierta' : 'al aire libre'}${i.notas.trim() ? `; ${i.notas.trim()}` : ''})`).join('; '),
  };
}

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
}

/** La IA propone tres actividades para el banco del docente. */
export async function proponerActividades(
  p: PeticionActividades, d: EfData, comunidad: ComunidadId | undefined, lang: Lang, callbacks: Callbacks = {},
): Promise<Omit<ActividadEF, 'id'>[] | null> {
  const recursos = recursosParaIA(d);
  const userPrompt =
    `Tipo de actividad: ${nombreTipo(p.tipo)}\n` +
    (p.curso ? `Curso: ${p.curso}\n` : '') +
    (p.tema.trim() ? `Qué se quiere trabajar: ${p.tema.trim()}\n` : '') +
    (p.conInventario && recursos.material ? `Material disponible: ${recursos.material}\n` : '') +
    (p.conInventario && recursos.instalaciones ? `Instalaciones: ${recursos.instalaciones}\n` : '') +
    (p.limitaciones.length ? `En el grupo hay alumnado con estas limitaciones (una línea por alumno):\n${p.limitaciones.map(l => `- ${l}`).join('\n')}\n` : '') +
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
      titulo: texto(a.titulo), tipo: p.tipo, descripcion: texto(a.descripcion), organizacion: texto(a.organizacion),
      material: texto(a.material), variantes: texto(a.variantes), inclusion: texto(a.inclusion), origen: 'ia' as const,
    }))
    .filter(a => a.titulo && a.descripcion);
  if (!lista.length) { callbacks.onError?.('La IA no devolvió actividades. Inténtalo de nuevo.'); return null; }
  return lista;
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
    `Duración de la sesión: ${p.minutos} minutos\n` +
    (lugar ? `Instalación: ${lugar}\n` : '') +
    (recursos.material ? `Material disponible: ${recursos.material}\n` : '') +
    (p.cubiertas.length ? `Espacios cubiertos para el plan B: ${p.cubiertas.map(i => i.nombre).join('; ')}\n` : '') +
    (p.limitaciones.length
      ? `Hoy hay alumnado con estas limitaciones (una línea por alumno, sin nombres):\n${p.limitaciones.map(l => `- ${l}`).join('\n')}\n`
      : 'Hoy no hay nadie exento ni lesionado.\n') +
    (p.banco.length ? `Actividades de su banco que puedes usar si encajan: ${p.banco.slice(0, 40).map(a => a.titulo).join('; ')}\n` : '') +
    '\nPrepara la sesión. "titulo": corto. "objetivo": una o dos frases, qué aprenderá el alumnado. ' +
    '"calentamiento", "principal" y "calma": cada actividad en su párrafo, separados por un salto de línea, que ' +
    'empiece por su nombre y los minutos entre paréntesis y diga cómo se organiza y sus reglas; los minutos de las tres ' +
    'partes suman la duración (calentamiento 10 a 15, vuelta a la calma 5 a 10, con la recogida). "material": la lista ' +
    'de lo que hace falta, solo de lo disponible. "inclusion": para cada limitación de hoy, cómo participa en las mismas ' +
    'actividades según el DUA-A (una frase por limitación, sin nombres); si no hay ninguna, una medida general de ' +
    'accesibilidad. "planB": la misma sesión si llueve o la instalación está ocupada, en un espacio cubierto, en 2 a 4 ' +
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

