/**
 * Módulo de PT y AL: el trabajo del profesorado especialista de Pedagogía
 * Terapéutica y de Audición y Lenguaje. Ver `docs/PTAL.md`.
 *
 * Es un alumnado aparte del de «Mis clases»: el especialista atiende a
 * alumnos de muchas clases que no son suyas, así que cada alumno guarda su
 * clase de origen como texto y su propio nivel de competencia curricular.
 */
import type { Etapa } from '../lib/curriculum';
import type { OfficialCriterionRef } from './index';

export type Especialidad = 'PT' | 'AL';

export type Trimestre = 1 | 2 | 3;

/** Un curso concreto: el que el alumno tiene matriculado o el de su nivel. */
export interface CursoDe {
  etapa: Etapa;
  curso: number;
}

export interface AlumnoApoyo {
  id: string;
  nombre: string;
  /** Su clase en el centro, como la llama el centro: «2º B». */
  claseOrigen: string;
  /** El curso en que está matriculado. */
  matricula?: CursoDe;
  /**
   * Nivel de competencia curricular: el curso cuyo currículo trabaja. Un
   * alumno de 4º con nivel de 2º trabaja los criterios de 2º. Ausente = el
   * de su matrícula.
   */
  nivel?: CursoDe;
  /**
   * Sus necesidades específicas de apoyo educativo: puede tener varias. Las de
   * la lista (`GRUPOS_NEAE`) se guardan con su texto en castellano y se
   * traducen al mostrarlas; las escritas a mano, tal cual.
   */
  categorias: string[];
  /** Dato de salud: se guarda en el equipo. Ver `docs/PTAL.md`, «Datos y IA». */
  diagnostico: string;
  /** Sus necesidades en términos educativos: barreras, fortalezas, qué le ayuda. */
  necesidades: string;
  notas: string;
}

export interface FranjaApoyo {
  /** 0 = lunes … 4 = viernes. */
  dia: number;
  /** «HH:MM». */
  inicio: string;
  fin: string;
}

export interface GrupoApoyo {
  id: string;
  nombre: string;
  especialidad: Especialidad;
  /** Dentro del aula de referencia o fuera, en el aula de apoyo. */
  modalidad: 'dentro' | 'fuera';
  horario: FranjaApoyo[];
  /** Ids de `AlumnoApoyo`, en el orden en que se pasan en la sesión. */
  alumnos: string[];
  color: string;
}

export interface ObjetivoApoyo {
  id: string;
  texto: string;
  /** Trimestres en que se trabaja. Nunca vacío. */
  trimestres: Trimestre[];
  /** Criterios oficiales del curso de su nivel con los que se enlaza, si los hay. */
  criterios: OfficialCriterionRef[];
}

/**
 * Programa personalizado: lo que el especialista trabaja con un alumno en
 * un ámbito. En la Comunitat Valenciana, los ámbitos son los programas del
 * apartado D del PAP; en el resto, los de `lib/apoyo.ts`.
 */
export interface ProgramaApoyo {
  id: string;
  alumnoId: string;
  ambito: string;
  especialidad: Especialidad;
  /** Intensidad del apoyo, como la pide el PAP. */
  intensidad?: 'baja' | 'media' | 'alta';
  objetivos: ObjetivoApoyo[];
}

/** Cómo va un objetivo en una sesión. */
export type Logro = 'si' | 'proceso' | 'no';

/** Las cuatro filas de «cómo ha respondido». */
export type AspectoRespuesta = 'atencion' | 'motivacion' | 'conducta' | 'autonomia';

/** Tres caras: 3 bien, 2 regular, 1 mal. */
export type Cara = 1 | 2 | 3;

export interface RegistroAlumno {
  alumnoId: string;
  /** No vino a la sesión. */
  ausente?: boolean;
  /** Por id de objetivo. Un objetivo que no se trabajó no aparece. */
  objetivos: Record<string, Logro>;
  respuesta: Partial<Record<AspectoRespuesta, Cara>>;
  nota: string;
}

export interface SesionApoyo {
  id: string;
  grupoId: string;
  /** YYYY-MM-DD. */
  fecha: string;
  /** Lo que trabaja ese día la clase de referencia. */
  temaClase: string;
  /** Lo que propone la IA para trabajar ese tema con cada alumno, por id; el docente lo retoca. */
  adaptaciones?: Record<string, string>;
  alumnos: RegistroAlumno[];
}

/**
 * Los documentos del especialista. Ver `docs/PTAL.md`, «Documentos»:
 * - `programacion`: la del alumno, una por curso.
 * - `familia` y `equipo`: los informes trimestrales.
 * - `pap`: el seguimiento del apartado I del PAP (Comunitat Valenciana), uno
 *   por curso, con una columna por trimestre que se va rellenando.
 */
export type TipoDocumentoApoyo = 'programacion' | 'familia' | 'equipo' | 'pap';

export interface ApartadoDocumento {
  /** Identificador estable del apartado dentro de su tipo de documento. */
  id: string;
  titulo: string;
  texto: string;
}

export interface DocumentoApoyo {
  id: string;
  alumnoId: string;
  tipo: TipoDocumentoApoyo;
  /** Los informes trimestrales y el trimestre que se rellenó por última vez en el PAP. */
  trimestre?: Trimestre;
  /** Cuándo se generó o se cambió por última vez, YYYY-MM-DD. */
  fecha: string;
  titulo: string;
  /** Lo que el docente puede retocar; siempre en el orden del modelo. */
  apartados: ApartadoDocumento[];
  /** Solo el PAP: una fila por medida de respuesta, con sus cinco columnas. */
  tabla?: string[][];
}

/** Con quién se coordina el especialista sobre un alumno. */
export type ConQuien = 'tutoria' | 'familia' | 'orientacion' | 'equipo' | 'otros';

/**
 * Una reunión o conversación de coordinación sobre un alumno, con lo que se
 * acordó. Sale en el apartado H del PAP y en los informes del trimestre.
 */
export interface CoordinacionApoyo {
  id: string;
  alumnoId: string;
  /** YYYY-MM-DD. */
  fecha: string;
  con: ConQuien;
  /** Quiénes estuvieron, si se quiere anotar. */
  asistentes: string;
  /** De qué se habló. */
  temas: string;
  acuerdos: string;
}

/** Un paso de la agenda visual: un pictograma de Mulberry o una foto, y su texto. */
export interface PasoAgenda {
  id: string;
  /** Identificador de `lib/pictos.ts`. */
  picto?: string;
  /** Identificador de una de `ApoyoData.fotos`. */
  fotoId?: string;
  texto: string;
}

/** Una agenda visual: la secuencia de una sesión, de un día o de una rutina. */
export interface AgendaVisual {
  id: string;
  /** Sin alumno es una plantilla, que se queda al empezar otro curso. */
  alumnoId?: string;
  titulo: string;
  pasos: PasoAgenda[];
}

/** Una foto del propio docente para la agenda visual. Se queda en el equipo. */
export interface FotoApoyo {
  id: string;
  nombre: string;
  /** La imagen ya reducida, como `data:image/jpeg;base64,…`. */
  datos: string;
}

/** Todo lo del módulo, tal como se guarda en el perfil. */
export interface ApoyoData {
  alumnos: AlumnoApoyo[];
  grupos: GrupoApoyo[];
  programas: ProgramaApoyo[];
  sesiones: SesionApoyo[];
  documentos: DocumentoApoyo[];
  coordinaciones: CoordinacionApoyo[];
  agendas: AgendaVisual[];
  fotos: FotoApoyo[];
}
