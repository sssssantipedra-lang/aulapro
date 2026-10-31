/**
 * El informe sociopsicopedagógico del orientador: la app lo lee una vez con la IA y propone, para la ficha del
 * alumno, lo que dice de él (necesidades, nivel, fortalezas, orientaciones y los programas que sugiere). El docente
 * lo revisa antes de guardarlo. El informe no se guarda: solo esas conclusiones. Ver `docs/PTAL.md`, «El informe
 * del orientador».
 */
import { callGemini, parseGeminiJson } from './gemini';
import { marcoApoyo } from './apoyoIA';
import { currentPseudonymizer } from './privacy';
import { CATEGORIAS_NEAE, conObjetivosOrientacion, nuevoIdApoyo } from '../lib/apoyo';
import { EXTENSIONES_DOCUMENTO, leerDocumento, textoDeDocumento } from '../lib/documentoParaIA';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import type { AlumnoApoyo, CursoDe, InformeOrientacion, ObjetivoOrientacion, Trimestre } from '../types/apoyo';

export const MAX_BYTES_INFORME = 19 * 1024 * 1024;
export const EXTENSIONES_INFORME = EXTENSIONES_DOCUMENTO;

/** Lo que se le da a la IA del informe: siempre su texto (pegado o leído del archivo en el navegador). */
export interface FuenteInforme { texto?: string; nombre?: string }

/**
 * Lo que la IA recibe de un documento del alumnado, tal como se enseña al docente para que lo revise: sin los datos
 * que identifican (`quitarIdentificadores`) y con los nombres del alumnado cambiados por su código. `callGemini`
 * vuelve a enmascarar al enviar, así que lo pegado a mano también sale sin nombres.
 */
export const textoParaRevisar = (texto: string) => textoDeDocumento(texto, t => currentPseudonymizer().mask(t));

/**
 * Abre el archivo del informe (o de la programación) y lo convierte en texto en el navegador, también un PDF: desde el
 * 31-10-2026 el archivo nunca se envía (`docs/PTAL.md`). Errores: «grande», «escaneado», «doc» y «formato».
 */
export async function leerArchivoInforme(file: File): Promise<FuenteInforme> {
  if (file.size > MAX_BYTES_INFORME) throw new Error('grande');
  return { texto: textoParaRevisar(await leerDocumento(file)), nombre: file.name };
}

export interface PropuestaInforme {
  categorias: string[];
  diagnostico: string;
  necesidades: string;
  nivel?: CursoDe;
  fortalezas: string;
  orientaciones: string;
  ambitos: string[];
  /** Los objetivos que el informe plantea, tal como los dice (la IA no inventa otros aquí). */
  objetivos: ObjetivoOrientacion[];
}

const cadena = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Lo que devuelve la IA, comprobado: categorías de la lista, ámbitos de los que se ofrecen, un nivel que exista. */
export function propuestaDeRespuesta(raw: unknown, ambitosValidos: readonly string[]): PropuestaInforme {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const etapa = o.nivelEtapa === 'primaria' || o.nivelEtapa === 'eso' ? o.nivelEtapa : undefined;
  const curso = Number(o.nivelCurso);
  const max = etapa === 'primaria' ? 6 : 4;
  return {
    categorias: [...new Set(lista(o.categorias).filter(c => CATEGORIAS_NEAE.includes(c)))],
    diagnostico: cadena(o.diagnostico),
    necesidades: cadena(o.necesidades),
    ...(etapa && Number.isInteger(curso) && curso >= 1 && curso <= max ? { nivel: { etapa, curso } } : {}),
    fortalezas: cadena(o.fortalezas),
    orientaciones: cadena(o.orientaciones),
    ambitos: [...new Set(lista(o.ambitos).filter(a => ambitosValidos.includes(a)))].slice(0, 5),
    objetivos: (Array.isArray(o.objetivos) ? o.objetivos : []).flatMap((x): ObjetivoOrientacion[] => {
      const y = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      const texto = cadena(y.texto);
      if (!texto) return [];
      const trimestres = lista(y.trimestres).map(Number).filter((n): n is Trimestre => n === 1 || n === 2 || n === 3);
      const ambito = typeof y.ambito === 'string' && ambitosValidos.includes(y.ambito) ? y.ambito : undefined;
      return [{
        id: nuevoIdApoyo('oo'), texto, ...(ambito ? { ambito } : {}),
        trimestres: trimestres.length ? [...new Set(trimestres)].sort() : [1, 2, 3], origen: 'informe',
      }];
    }).slice(0, 20),
  };
}

/** La IA lee el informe y propone lo que va a la ficha. `null` si no se pudo. */
export async function analizarInforme(
  args: {
    fuente: FuenteInforme;
    alumno: AlumnoApoyo;
    /** Los ámbitos de programa que se ofrecen en su comunidad, para que la IA elija entre ellos. */
    ambitos: readonly string[];
    comunidad: ComunidadId | undefined;
    lang: 'es' | 'en' | 'ca';
  },
  callbacks: { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void } = {},
): Promise<PropuestaInforme | null> {
  const { fuente, ambitos, comunidad, lang } = args;
  const texto = textoParaRevisar(fuente.texto ?? '');
  if (!texto) { callbacks.onError?.('Pega el texto del informe o sube un archivo.'); return null; }
  const userPrompt =
    'Lee el informe sociopsicopedagógico de un alumno y extrae SOLO lo que dice. Si algo no aparece, déjalo vacío: ' +
    'no inventes diagnósticos, cursos ni medidas.\n\n' +
    '- categorias: sus necesidades específicas de apoyo educativo, de la lista cerrada.\n' +
    '- diagnostico: el diagnóstico o la valoración clínica que consta, tal como lo dice el informe.\n' +
    '- necesidades: sus necesidades en términos educativos (barreras, cómo aprende, qué le ayuda), en 3 a 6 frases.\n' +
    '- nivelEtapa y nivelCurso: el nivel de competencia curricular si el informe lo dice (por ejemplo, «nivel de 2.º de Primaria»); si no, "ninguna" y "0".\n' +
    '- fortalezas: sus puntos fuertes e intereses, en 1 a 3 frases.\n' +
    '- orientaciones: las medidas y orientaciones que propone para el centro, el aula y el apoyo de PT o AL, en 3 a 6 frases.\n' +
    '- ambitos: los programas de apoyo que el informe hace necesarios, de la lista cerrada (como mucho 4).\n' +
    '- objetivos: SOLO los objetivos que el informe plantea o recomienda trabajar con el alumno, uno por elemento, con las ' +
    'palabras del informe (una frase corta, mejor si empieza por un verbo en infinitivo). En "ambito", el programa de la ' +
    'lista cerrada al que pertenece, o "ninguno" si no encaja; en "trimestres", en cuáles se trabaja si el informe lo dice ' +
    '(si no, los tres). Si el informe no trae objetivos, déjalos vacíos: no los inventes.' +
    `\n\nINFORME:\n${texto.slice(0, 60000)}`;
  const raw = await callGemini(marcoApoyo(comunidad, lang) + '\nResponde SOLO con JSON válido.', userPrompt, [], callbacks, {
    responseSchema: {
      type: 'OBJECT',
      properties: {
        categorias: { type: 'ARRAY', items: { type: 'STRING', enum: [...CATEGORIAS_NEAE] } },
        diagnostico: { type: 'STRING' },
        necesidades: { type: 'STRING' },
        nivelEtapa: { type: 'STRING', enum: ['primaria', 'eso', 'ninguna'] },
        nivelCurso: { type: 'STRING', enum: ['0', '1', '2', '3', '4', '5', '6'] },
        fortalezas: { type: 'STRING' },
        orientaciones: { type: 'STRING' },
        ambitos: { type: 'ARRAY', items: { type: 'STRING', enum: [...ambitos] } },
        objetivos: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
          texto: { type: 'STRING' },
          ambito: { type: 'STRING', enum: [...ambitos, 'ninguno'] },
          trimestres: { type: 'ARRAY', items: { type: 'STRING', enum: ['1', '2', '3'] } },
        }, required: ['texto', 'ambito', 'trimestres'] } },
      },
      required: ['categorias', 'diagnostico', 'necesidades', 'nivelEtapa', 'nivelCurso', 'fortalezas', 'orientaciones', 'ambitos', 'objetivos'],
    },
    thinkingLevel: 'high',
    maxOutputTokens: 8192,
  });
  if (!raw) return null;
  const r = parseGeminiJson<unknown>(raw);
  if (!r || typeof r !== 'object') { callbacks.onError?.('La IA no devolvió nada utilizable. Inténtalo de nuevo.'); return null; }
  return propuestaDeRespuesta(r, ambitos);
}

/**
 * La ficha del alumno con lo que el docente ha dado por bueno; lo que la propuesta deja vacío no borra lo que había.
 * Los objetivos del informe se suman a los que ya hubiera de la orientación, sin repetir.
 */
export function conInforme(a: AlumnoApoyo, p: PropuestaInforme, archivo: string | undefined, hoy: string): AlumnoApoyo {
  const informe: InformeOrientacion = {
    fecha: hoy, ...(archivo ? { archivo } : {}), fortalezas: p.fortalezas.trim(), orientaciones: p.orientaciones.trim(), ambitos: p.ambitos,
  };
  return conObjetivosOrientacion({
    ...a,
    categorias: [...new Set([...a.categorias, ...p.categorias])],
    diagnostico: p.diagnostico.trim() || a.diagnostico,
    necesidades: p.necesidades.trim() || a.necesidades,
    ...(p.nivel ? { nivel: p.nivel } : {}),
    informe,
  }, p.objetivos);
}
