/**
 * La IA del módulo de PT y AL. Ver `docs/PTAL.md`.
 *
 * Todo lo que propone se apoya en la normativa de inclusión de la comunidad
 * del docente y en los autores de referencia que revisó el dueño
 * (4-10-2026), para que hable el idioma de los documentos oficiales.
 *
 * Datos (decisión del dueño, 4-10-2026): la IA recibe también el
 * diagnóstico y la categoría de NEAE del alumno. El nombre, como siempre, se
 * cambia por un código en `callGemini` (ver `services/privacy.ts`).
 */
import { callGemini, parseGeminiJson } from './gemini';
import { catalogoCriterios, refsDesdeIA, type MateriaDeClase } from '../lib/curriculum/criteriosParaIA';
import { nivelDe } from '../lib/apoyo';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import type { AlumnoApoyo, CursoDe, ObjetivoApoyo, ProgramaApoyo, Trimestre } from '../types/apoyo';
import type { OfficialCriterionRef } from '../types';

/** La normativa de inclusión que enmarca lo que propone la IA, por comunidad. */
export function normativaInclusion(comunidad: ComunidadId | undefined): string {
  switch (comunidad) {
    case 'comunitat-valenciana':
      return 'Comunitat Valenciana: Decreto 104/2018, de 27 de julio, del Consell, por el que se desarrollan los principios ' +
        'de equidad y de inclusión en el sistema educativo valenciano; Orden 20/2019, de 30 de abril, por la que se regula ' +
        'la organización de la respuesta educativa para la inclusión del alumnado. El documento del alumno es el plan de ' +
        'actuación personalizado (PAP), con sus medidas de respuesta y programas personalizados. Vocabulario: barreras para ' +
        'el acceso, la participación y el aprendizaje; fortalezas; necesidades educativas; medidas de respuesta.';
    case 'cataluna':
      return 'Cataluña: Decret 150/2017, de 17 d’octubre, de l’atenció educativa a l’alumnat en el marc d’un sistema ' +
        'educatiu inclusiu. Mesures i suports universals, addicionals i intensius; el document de l’alumne és el pla de ' +
        'suport individualitzat (PI).';
    case 'madrid':
      return 'Comunidad de Madrid: Decreto 23/2023, de 22 de marzo, por el que se regula la atención educativa a las ' +
        'diferencias individuales del alumnado. Medidas ordinarias y específicas; para el alumnado con necesidades ' +
        'educativas especiales, adaptaciones curriculares por área (significativas si van a cursos anteriores) y el apoyo ' +
        'del profesorado de Pedagogía Terapéutica y Audición y Lenguaje según el dictamen de escolarización.';
    default:
      return 'Normativa estatal: Ley Orgánica 2/2006, de Educación, modificada por la LOMLOE (título II, capítulo I, ' +
        'alumnado con necesidad específica de apoyo educativo); Real Decreto 157/2022 (artículo 16) y Real Decreto ' +
        '217/2022 (artículo 19), atención a las diferencias individuales.';
  }
}

/** Los autores de referencia, tal como los revisó el dueño. */
export const AUTORES_REFERENCIA =
  'Inclusión: Diseño Universal para el Aprendizaje (CAST: Meyer, Rose y Gordon; Alba Pastor), Booth y Ainscow ' +
  '(Index for Inclusion), Echeita, Pujolàs (aprendizaje cooperativo), Vygotsky (zona de desarrollo próximo). ' +
  'PT: Cuetos (lectura y escritura), apoyo conductual positivo. AL: Bloom y Lahey (forma, contenido y uso del ' +
  'lenguaje), Acosta y Moreno, Monfort y Juárez, Aguado (trastorno del desarrollo del lenguaje). Comunicación ' +
  'aumentativa y TEA: Basil y Soro-Camats, Rivière, modelo TEACCH.';

/** El marco que va en el mensaje de sistema de toda la IA del módulo. */
export function marcoApoyo(comunidad: ComunidadId | undefined, lang: 'es' | 'en' | 'ca'): string {
  return (lang === 'en'
    ? 'You are an expert specialist teacher in Learning Support (Pedagogía Terapéutica) and Speech and Language ' +
      '(Audición y Lenguaje) in Spain. '
    : 'Eres un especialista experto en Pedagogía Terapéutica y en Audición y Lenguaje en España. ') +
    `\nMarco normativo: ${normativaInclusion(comunidad)}` +
    `\nAutores de referencia: ${AUTORES_REFERENCIA}` +
    '\nBásate en este marco y en estos autores, pero no inventes artículos, citas literales ni datos del alumno que no ' +
    'se te den. Lenguaje claro, preciso y respetuoso, centrado en las barreras y en los apoyos, no en el déficit.' +
    (lang === 'en' ? '\nWrite every human-readable text in English.' : '');
}

/** Lo que la IA sabe del alumno: todo lo de su ficha, también el diagnóstico. */
export function alumnoParaIA(a: AlumnoApoyo, nombreCurso: (c: CursoDe) => string): string {
  const nivel = nivelDe(a);
  return [
    `Alumno: ${a.nombre}`,
    a.matricula ? `Matriculado en ${nombreCurso(a.matricula)}${a.claseOrigen ? ` (${a.claseOrigen})` : ''}` : (a.claseOrigen ? `Clase: ${a.claseOrigen}` : ''),
    nivel ? `Nivel de competencia curricular: ${nombreCurso(nivel)}` : '',
    a.categoria ? `Necesidad específica de apoyo educativo: ${a.categoria}` : '',
    a.diagnostico ? `Diagnóstico: ${a.diagnostico}` : '',
    a.necesidades ? `Necesidades educativas: ${a.necesidades}` : '',
    a.notas ? `Notas del especialista: ${a.notas}` : '',
  ].filter(Boolean).join('\n');
}

// En castellano, catalán o inglés: los ámbitos de partida se guardan traducidos
const SIN_AREA = /autonom|conduct|behaviou?r|habilidades sociales|social skills|emoci|emotion|atenci|attention|memor|ejecutiv|executiv|pragm|motor/i;
const DE_LENGUA = /lect|escrit|read|writ|literacy|lengua|lenguaje|llengua|llenguatge|language|comunica|communicat|habla|parla|speech|fon|phon|sem[aà]nt|semantic|morfo|morpho|vocab|voz|veu|voice|fluid|fluen|auditiv|auditory|conciencia|awareness/i;

/**
 * Las materias del nivel del alumno con las que tiene sentido enlazar los
 * objetivos de un ámbito: Lengua para lectoescritura y lenguaje, Matemáticas
 * para matemáticas, todas para una ACIS, ninguna para atención o conducta.
 * Así la lista cerrada que recibe la IA es corta y pertinente.
 */
export function materiasParaAmbito(ambito: string, materias: MateriaDeClase[]): MateriaDeClase[] {
  if (/ACIS|adaptaci/i.test(ambito)) return materias;
  if (/matem|math|l[oóò]gic/i.test(ambito)) return materias.filter(m => /matem/i.test(m.entry.nombre));
  if (SIN_AREA.test(ambito)) return [];
  if (DE_LENGUA.test(ambito)) {
    return materias.filter(m => /lengua|llengua|valenci|literatura/i.test(m.entry.nombre) && !/extranjer|estranger/i.test(m.entry.nombre));
  }
  return [];
}

export interface ObjetivoPropuesto {
  texto: string;
  trimestres: Trimestre[];
  criterios: OfficialCriterionRef[];
}

/** La IA propone objetivos para un programa, repartidos por trimestres. */
export async function proponerObjetivos(
  args: {
    alumno: AlumnoApoyo;
    programa: Pick<ProgramaApoyo, 'ambito' | 'especialidad' | 'intensidad'>;
    /** Los que ya tiene, para no repetirlos. */
    actuales: ObjetivoApoyo[];
    /** Las materias del curso de su nivel (ver `materiasParaAmbito`). */
    materias: MateriaDeClase[];
    comunidad: ComunidadId | undefined;
    lang: 'es' | 'en' | 'ca';
    nombreCurso: (c: CursoDe) => string;
  },
  callbacks: { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void } = {},
): Promise<ObjetivoPropuesto[] | null> {
  const { alumno, programa, actuales, comunidad, lang, nombreCurso } = args;
  const materias = materiasParaAmbito(programa.ambito, args.materias);
  const { texto: catalogo, disponibles } = catalogoCriterios(materias);
  const conCriterios = disponibles.length > 0;

  const userPrompt =
    `${alumnoParaIA(alumno, nombreCurso)}\n` +
    `Especialidad: ${programa.especialidad === 'AL' ? 'Audición y Lenguaje' : 'Pedagogía Terapéutica'}\n` +
    `Programa o ámbito: ${programa.ambito}\n` +
    (programa.intensidad ? `Intensidad del apoyo: ${programa.intensidad}\n` : '') +
    (actuales.length ? `Objetivos que ya tiene (no los repitas):\n${actuales.map(o => `- ${o.texto}`).join('\n')}\n` : '') +
    '\nPropón de 4 a 6 objetivos para este programa durante el curso. Cada objetivo: una frase corta (máximo 12 ' +
    'palabras), que empiece por un verbo en infinitivo, observable y evaluable en una sesión, ajustada a su nivel de ' +
    'competencia curricular y a sus necesidades, de lo más sencillo a lo más complejo. En "trimestres" indica en cuáles ' +
    'se trabaja (1, 2 o 3; puede ser más de uno), con una progresión a lo largo del curso.' +
    (conCriterios
      ? ' En "criterios" elige de 0 a 2 criterios de evaluación oficiales del curso de su nivel, de la lista cerrada de ' +
        'abajo, solo los que el objetivo trabaje de verdad, escritos tal cual («Materia|código»).' +
        `\n\nCriterios oficiales de ${alumno.nivel || alumno.matricula ? nombreCurso((alumno.nivel ?? alumno.matricula)!) : 'su nivel'}:\n${catalogo}`
      : '');

  const raw = await callGemini(marcoApoyo(comunidad, lang) + '\nResponde SOLO con JSON válido.', userPrompt, [], callbacks, {
    responseSchema: {
      type: 'OBJECT',
      properties: {
        objetivos: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              texto: { type: 'STRING' },
              trimestres: { type: 'ARRAY', items: { type: 'INTEGER', enum: [1, 2, 3] } },
              ...(conCriterios ? { criterios: { type: 'ARRAY', items: { type: 'STRING', enum: disponibles } } } : {}),
            },
            required: ['texto', 'trimestres'],
          },
        },
      },
      required: ['objetivos'],
    },
    thinkingLevel: 'medium',
  });
  if (!raw) return null;
  const parsed = parseGeminiJson<{ objetivos?: { texto?: unknown; trimestres?: unknown; criterios?: unknown }[] }>(raw);
  if (!parsed?.objetivos) {
    callbacks.onError?.('La IA no devolvió objetivos. Inténtalo de nuevo.');
    return null;
  }
  return parsed.objetivos
    .filter((o): o is { texto: string; trimestres?: unknown; criterios?: unknown } => typeof o.texto === 'string' && o.texto.trim() !== '')
    .map(o => {
      const trimestres = (Array.isArray(o.trimestres) ? o.trimestres : [])
        .map(Number).filter((n): n is Trimestre => n === 1 || n === 2 || n === 3);
      return {
        texto: o.texto.trim(),
        trimestres: trimestres.length ? [...new Set(trimestres)].sort() : [1, 2, 3],
        criterios: refsDesdeIA(materias, o.criterios).slice(0, 2),
      };
    });
}
