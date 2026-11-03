/**
 * El modelo de adaptación curricular significativa de cada comunidad: cómo se llama, en qué apartados se ordena, qué
 * campos lleva y qué pide su normativa. La pantalla (`pages/apoyo/AcsApoyo.tsx`) y el documento
 * (`services/acsDocumento.ts`) se construyen a partir de él, pieza a pieza. Los datos son los mismos en todas
 * (`AcsApoyo`); cada modelo enseña los suyos. Ver `docs/PTAL.md`, «Adaptación curricular significativa».
 *
 * - Andalucía: la ACS de Séneca, en cuatro bloques (órdenes de 30 de mayo de 2023).
 * - Comunitat Valenciana: la ACIS, medida de nivel IV dentro del PAP de ITACA (Decreto 104/2018, Orden 20/2019).
 * - Cataluña: el PI, pla individualitzat (Decret 150/2017, Decret 175/2022).
 * - Madrid: la ACS por área o materia de Raíces (Decreto 23/2023).
 * - El resto de comunidades: un modelo general con el marco estatal (LOE y reales decretos de enseñanzas mínimas) y el
 *   currículo de su comunidad, a falta de su formulario.
 */
import type { ComunidadId } from './curriculum/comunidades';
import type { AcsApoyo, FechaAcs } from '../types/apoyo';

export type ModeloAcsId = 'andalucia' | 'comunitat-valenciana' | 'cataluna' | 'madrid' | 'general';

/** Las piezas con que se arma cada apartado, en la pantalla y en el documento. */
export type PiezaAcs =
  | 'informe'       // la fecha del informe que propone la medida y las demás fechas del modelo
  | 'nivel'         // el curso de referencia, el desfase y su justificación
  | 'responsables'
  | 'barreras'      // barreras y fortalezas (Comunitat Valenciana)
  | 'area'          // el área del curso de referencia y cómo se llama en su clase
  | 'curriculo'     // competencias, criterios y saberes
  | 'objetivos'     // los objetivos concretos de cada criterio, por trimestre
  | 'ajusteCriterios' // priorizado o modificado, y qué hace en el aula (Cataluña)
  | 'estrategias'
  | 'apoyos'        // horas de PT y AL dentro y fuera del aula
  | 'calificacion'  // instrumentos con su peso y criterios de calificación
  | 'seguimiento'
  | 'acuerdos';     // acuerdos con la familia y aprobación (Cataluña)

export type Responsable = keyof AcsApoyo['responsables'];

export interface ModeloAcs {
  id: ModeloAcsId;
  /** La sigla, tal cual en todos los idiomas. */
  sigla: string;
  /** El nombre del documento (clave del diccionario). */
  nombre: string;
  /** El botón para crear una (clave) y la etiqueta del curso de referencia (clave). */
  nuevo: string;
  cursoReferencia: string;
  /** El título de la tarjeta (clave). */
  tarjeta: string;
  /** La explicación de la tarjeta (clave). */
  explicacion: string;
  apartados: { titulo: string; piezas: PiezaAcs[] }[];
  /** El nombre del informe que la propone (clave). */
  informe: string;
  /** Las otras fechas del modelo, con su etiqueta (clave), en el orden en que salen. */
  fechas: { id: FechaAcs; texto: string }[];
  responsables: Responsable[];
  /** Quién firma: responsables o, además, la familia y la dirección. */
  firmas: (Responsable | 'familia' | 'direccion')[];
  /** Es solo para el alumnado con necesidades educativas especiales. */
  soloNee: boolean;
  /** Pide un desfase de al menos dos cursos. */
  desfaseMinimo: number | null;
  /** Lleva la nota de cada trimestre y con qué marca sale (`{nota}` es la nota). */
  nota?: { formato: string; ayuda: string };
  /** Lleva la decisión de promoción al acabar el curso o el ciclo. */
  promocion: boolean;
  /** Cómo se llaman los dos especialistas del apoyo (claves). */
  apoyos?: { pt: string; al: string; siei: boolean };
}

export const MODELOS_ACS: Record<ModeloAcsId, ModeloAcs> = {
  andalucia: {
    id: 'andalucia', nuevo: 'Nueva ACS', cursoReferencia: 'Curso de referencia de la ACS', sigla: 'ACS', nombre: 'Adaptación curricular significativa',
    tarjeta: 'Adaptación curricular significativa (ACS)',
    explicacion: 'Como en Séneca: datos generales y dictamen, selección del currículo del curso de referencia, metodología y calificación, y seguimiento de cada trimestre. Una por área, para todo el curso.',
    apartados: [
      { titulo: 'Datos generales y dictamen', piezas: ['informe', 'nivel', 'responsables'] },
      { titulo: 'Selección curricular', piezas: ['area', 'curriculo', 'objetivos'] },
      { titulo: 'Adaptaciones metodológicas y criterios de calificación', piezas: ['estrategias', 'calificacion'] },
      { titulo: 'Seguimiento y valoración trimestral', piezas: ['seguimiento'] },
    ],
    informe: 'Fecha del informe de evaluación psicopedagógica', fechas: [],
    responsables: ['tutor', 'especialista', 'materia'], firmas: ['tutor', 'especialista', 'materia'],
    soloNee: true, desfaseMinimo: 2, promocion: false,
  },
  'comunitat-valenciana': {
    id: 'comunitat-valenciana', nuevo: 'Nueva ACIS', cursoReferencia: 'Curso de referencia de la ACIS', sigla: 'ACIS', nombre: 'Adaptación curricular individual significativa',
    tarjeta: 'Adaptación curricular individual significativa (ACIS)',
    explicacion: 'Como en el PAP de ITACA, donde la ACIS es una medida de nivel IV: datos identificativos y agentes implicados, barreras y fortalezas, propuesta curricular del curso de referencia, medidas de acceso y apoyos personales, y seguimiento de cada trimestre. Una por área, para todo el curso.',
    apartados: [
      { titulo: 'Datos identificativos y agentes implicados', piezas: ['responsables', 'informe'] },
      { titulo: 'Barreras y fortalezas para el aprendizaje y la participación', piezas: ['barreras'] },
      { titulo: 'Propuesta curricular por área o materia (ACIS)', piezas: ['nivel', 'area', 'curriculo', 'objetivos', 'calificacion'] },
      { titulo: 'Medidas de acceso y apoyos personales', piezas: ['apoyos', 'estrategias'] },
      { titulo: 'Seguimiento y evaluación trimestral', piezas: ['seguimiento'] },
    ],
    informe: 'Fecha del informe sociopsicopedagógico',
    fechas: [{ id: 'resolucion', texto: 'Fecha de la resolución de la dirección del centro' }],
    responsables: ['tutor', 'especialista', 'orientador', 'materia'], firmas: ['tutor', 'especialista', 'orientador', 'direccion'],
    soloNee: true, desfaseMinimo: 2, promocion: true,
    nota: { formato: '{nota} (ACIS)', ayuda: 'En el boletín de ITACA, la nota se acompaña de las siglas ACIS y toma como referencia los criterios adaptados.' },
    apoyos: { pt: 'Pedagogía terapéutica', al: 'Audición y lenguaje', siei: false },
  },
  cataluna: {
    id: 'cataluna', nuevo: 'Nuevo PI', cursoReferencia: 'Curso de referencia del PI', sigla: 'PI', nombre: 'Plan individualizado',
    tarjeta: 'Plan individualizado (PI)',
    explicacion: 'Como el PI de Cataluña: datos del alumno y motivo del PI, medidas y apoyos intensivos, adaptación curricular del área, criterios de evaluación y calificación, y acuerdos con la familia y el alumno. Uno por área, para todo el curso.',
    apartados: [
      { titulo: 'Datos del alumno y motivo del PI', piezas: ['informe', 'responsables'] },
      { titulo: 'Medidas y apoyos intensivos', piezas: ['apoyos', 'estrategias'] },
      { titulo: 'Adaptación curricular por ámbitos o áreas', piezas: ['nivel', 'area', 'curriculo', 'ajusteCriterios', 'objetivos'] },
      { titulo: 'Criterios de evaluación y calificación del PI', piezas: ['calificacion', 'seguimiento'] },
      { titulo: 'Acuerdos con la familia y el alumno', piezas: ['acuerdos'] },
    ],
    informe: 'Fecha del informe de reconocimiento de NESE del EAP',
    fechas: [
      { id: 'inicio', texto: 'Fecha de inicio del PI' },
      { id: 'vigencia', texto: 'Vigente hasta' },
      { id: 'cad', texto: 'Fecha de aprobación en la CAD' },
    ],
    responsables: ['referente', 'tutor', 'especialista'], firmas: ['referente', 'tutor', 'familia', 'direccion'],
    soloNee: false, desfaseMinimo: null, promocion: false,
    apoyos: { pt: 'Educación especial (MEE)', al: 'Audición y lenguaje', siei: true },
  },
  madrid: {
    id: 'madrid', nuevo: 'Nueva ACS', cursoReferencia: 'Nivel de competencia curricular de referencia', sigla: 'ACS', nombre: 'Adaptación curricular significativa',
    tarjeta: 'Adaptación curricular significativa (ACS)',
    explicacion: 'Como en Raíces, una por área o materia: datos del alumno y del dictamen, nivel de competencia curricular, elementos curriculares adaptados, metodología y apoyos, y seguimiento y calificación de cada trimestre.',
    apartados: [
      { titulo: 'Datos del alumno y del dictamen de escolarización', piezas: ['informe', 'responsables'] },
      { titulo: 'Área o materia y nivel de competencia curricular', piezas: ['area', 'nivel'] },
      { titulo: 'Elementos curriculares adaptados', piezas: ['curriculo', 'objetivos'] },
      { titulo: 'Metodología, recursos y organización de los apoyos', piezas: ['estrategias', 'apoyos'] },
      { titulo: 'Seguimiento trimestral y calificación', piezas: ['calificacion', 'seguimiento'] },
    ],
    informe: 'Fecha de la evaluación psicopedagógica',
    fechas: [{ id: 'dictamen', texto: 'Fecha del dictamen de escolarización' }],
    responsables: ['tutor', 'especialista', 'materia'], firmas: ['tutor', 'especialista', 'materia'],
    soloNee: true, desfaseMinimo: 2, promocion: false,
    nota: { formato: '{nota}*', ayuda: 'En las actas de Raíces, la nota de un área con ACS lleva un asterisco (*).' },
    apoyos: { pt: 'Pedagogía terapéutica', al: 'Audición y lenguaje', siei: false },
  },
  general: {
    id: 'general', nuevo: 'Nueva ACS', cursoReferencia: 'Curso de referencia de la ACS', sigla: 'ACS', nombre: 'Adaptación curricular significativa',
    tarjeta: 'Adaptación curricular significativa (ACS)',
    explicacion: 'Datos generales y evaluación psicopedagógica, selección del currículo del curso de referencia, metodología, apoyos y calificación, y seguimiento de cada trimestre. Una por área, para todo el curso.',
    apartados: [
      { titulo: 'Datos generales y evaluación psicopedagógica', piezas: ['informe', 'nivel', 'responsables'] },
      { titulo: 'Selección curricular', piezas: ['area', 'curriculo', 'objetivos'] },
      { titulo: 'Metodología, apoyos y calificación', piezas: ['estrategias', 'apoyos', 'calificacion'] },
      { titulo: 'Seguimiento y valoración trimestral', piezas: ['seguimiento'] },
    ],
    informe: 'Fecha del informe de evaluación psicopedagógica', fechas: [],
    responsables: ['tutor', 'especialista', 'orientador', 'materia'], firmas: ['tutor', 'especialista', 'materia'],
    soloNee: true, desfaseMinimo: null, promocion: false,
    apoyos: { pt: 'Pedagogía terapéutica', al: 'Audición y lenguaje', siei: false },
  },
};

/** Las comunidades con modelo propio; el resto usa el general. */
export const CON_MODELO_PROPIO: readonly ComunidadId[] = ['andalucia', 'comunitat-valenciana', 'cataluna', 'madrid'];

/** El modelo de la comunidad del perfil: el suyo si lo tiene, y si no (o sin comunidad), el general. */
export function modeloAcs(comunidad: ComunidadId | undefined): ModeloAcs {
  return comunidad && CON_MODELO_PROPIO.includes(comunidad) ? MODELOS_ACS[comunidad as ModeloAcsId] : MODELOS_ACS.general;
}

/** Si el modelo lleva una pieza en alguno de sus apartados. */
export const llevaPieza = (m: ModeloAcs, p: PiezaAcs) => m.apartados.some(a => a.piezas.includes(p));

/** Las etiquetas de cada responsable (claves). */
export function etiquetaResponsable(m: ModeloAcs, r: Responsable): string {
  if (r === 'tutor') return 'Tutor o tutora';
  if (r === 'materia') return 'Profesorado de la materia';
  if (r === 'orientador') return 'Orientador u orientadora';
  if (r === 'referente') return 'Referente del PI';
  return m.id === 'cataluna' ? 'Maestro o maestra de educación especial o de AL' : 'Especialista de PT o AL';
}

export const etiquetaFirma = (m: ModeloAcs, f: ModeloAcs['firmas'][number]) =>
  f === 'familia' ? 'Conformidad de la familia' : f === 'direccion' ? 'Visto bueno de la dirección' : etiquetaResponsable(m, f);

/** La nota de un trimestre con la marca del modelo: «7 (ACIS)», «7*». */
export function notaConMarca(m: ModeloAcs, nota: string | undefined): string {
  const n = (nota ?? '').trim();
  return n && m.nota ? m.nota.formato.replace('{nota}', n) : n;
}

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Si una adaptación es de una asignatura del cuaderno: por su materia en clase o por su área, comparando la primera
 * palabra con significado («Matemáticas (1º ESO)» con «Matemáticas»; «Educación Física» con «Educación física»).
 */
export function esDeAsignatura(acs: { area: string; materiaAula: string }, asignatura: string): boolean {
  const a = plano(asignatura);
  if (!a.trim()) return false;
  return [acs.materiaAula, acs.area].some(x => {
    const p = plano(x).replace(/\(.*?\)/g, '').trim();
    if (!p) return false;
    if (a.includes(p) || p.includes(a)) return true;
    const palabras = p.split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !['educacion', 'lengua', 'llengua', 'cultura', 'ciencias'].includes(w));
    return palabras.length > 0 && palabras.every(w => a.includes(w));
  });
}
