/**
 * El informe sociopsicopedagógico del orientador: la app lo lee una vez con la IA y propone, para la ficha del
 * alumno, lo que dice de él (necesidades, nivel, fortalezas, orientaciones y los programas que sugiere). El docente
 * lo revisa antes de guardarlo. El informe no se guarda: solo esas conclusiones. Ver `docs/PTAL.md`, «El informe
 * del orientador».
 */
import { callGemini, parseGeminiJson, type InlineFile } from './gemini';
import { marcoApoyo } from './apoyoIA';
import { CATEGORIAS_NEAE } from '../lib/apoyo';
import { fileToBase64 } from '../lib/utils';
import { textoDeDocx } from '../lib/leerMaterial';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import type { AlumnoApoyo, CursoDe, InformeOrientacion } from '../types/apoyo';

export const MAX_BYTES_INFORME = 19 * 1024 * 1024;
export const EXTENSIONES_INFORME = '.pdf,.docx,.txt';

/** Lo que se le da a la IA del informe: su texto (Word, texto, pegado) o el propio archivo (PDF). */
export interface FuenteInforme { texto?: string; archivo?: InlineFile; nombre?: string }

/** Abre el archivo del informe. Word y texto se leen en el equipo; un PDF se envía tal cual. */
export async function leerArchivoInforme(file: File): Promise<FuenteInforme> {
  const n = file.name.toLowerCase();
  if (file.size > MAX_BYTES_INFORME) throw new Error('grande');
  if (n.endsWith('.docx')) return { texto: await textoDeDocx(file), nombre: file.name };
  if (n.endsWith('.txt')) return { texto: await file.text(), nombre: file.name };
  if (n.endsWith('.pdf')) return { archivo: await fileToBase64(file), nombre: file.name };
  throw new Error('formato');
}

export interface PropuestaInforme {
  categorias: string[];
  diagnostico: string;
  necesidades: string;
  nivel?: CursoDe;
  fortalezas: string;
  orientaciones: string;
  ambitos: string[];
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
  if (!fuente.texto?.trim() && !fuente.archivo) { callbacks.onError?.('Pega el texto del informe o sube un archivo.'); return null; }
  const userPrompt =
    'Lee el informe sociopsicopedagógico de un alumno y extrae SOLO lo que dice. Si algo no aparece, déjalo vacío: ' +
    'no inventes diagnósticos, cursos ni medidas.\n\n' +
    '- categorias: sus necesidades específicas de apoyo educativo, de la lista cerrada.\n' +
    '- diagnostico: el diagnóstico o la valoración clínica que consta, tal como lo dice el informe.\n' +
    '- necesidades: sus necesidades en términos educativos (barreras, cómo aprende, qué le ayuda), en 3 a 6 frases.\n' +
    '- nivelEtapa y nivelCurso: el nivel de competencia curricular si el informe lo dice (por ejemplo, «nivel de 2.º de Primaria»); si no, "ninguna" y "0".\n' +
    '- fortalezas: sus puntos fuertes e intereses, en 1 a 3 frases.\n' +
    '- orientaciones: las medidas y orientaciones que propone para el centro, el aula y el apoyo de PT o AL, en 3 a 6 frases.\n' +
    '- ambitos: los programas de apoyo que el informe hace necesarios, de la lista cerrada (como mucho 4).' +
    (fuente.texto?.trim() ? `\n\nINFORME:\n${fuente.texto.trim().slice(0, 60000)}` : '\n\nEl informe va en el archivo adjunto.');
  const raw = await callGemini(marcoApoyo(comunidad, lang) + '\nResponde SOLO con JSON válido.', userPrompt, fuente.archivo ? [fuente.archivo] : [], callbacks, {
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
      },
      required: ['categorias', 'diagnostico', 'necesidades', 'nivelEtapa', 'nivelCurso', 'fortalezas', 'orientaciones', 'ambitos'],
    },
    thinkingLevel: 'high',
    maxOutputTokens: 8192,
  });
  if (!raw) return null;
  const r = parseGeminiJson<unknown>(raw);
  if (!r || typeof r !== 'object') { callbacks.onError?.('La IA no devolvió nada utilizable. Inténtalo de nuevo.'); return null; }
  return propuestaDeRespuesta(r, ambitos);
}

/** La ficha del alumno con lo que el docente ha dado por bueno; lo que la propuesta deja vacío no borra lo que había. */
export function conInforme(a: AlumnoApoyo, p: PropuestaInforme, archivo: string | undefined, hoy: string): AlumnoApoyo {
  const informe: InformeOrientacion = {
    fecha: hoy, ...(archivo ? { archivo } : {}), fortalezas: p.fortalezas.trim(), orientaciones: p.orientaciones.trim(), ambitos: p.ambitos,
  };
  return {
    ...a,
    categorias: [...new Set([...a.categorias, ...p.categorias])],
    diagnostico: p.diagnostico.trim() || a.diagnostico,
    necesidades: p.necesidades.trim() || a.necesidades,
    ...(p.nivel ? { nivel: p.nivel } : {}),
    informe,
  };
}
