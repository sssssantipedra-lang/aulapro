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
   * Las barreras de aprendizaje del alumno: qué le cuesta, qué le ayuda, sus fortalezas (p. ej. «le cuesta la lectoescritura»).
   * AulaPro no guarda ni pide diagnóstico ni categoría NEAE (3-11-2026, decisión del dueño tras la revisión de su abogado):
   * lo que importa para adaptar son las barreras, no el origen. Un dato antiguo se descarta al abrir el perfil.
   */
  necesidades: string;
  /**
   * Los apoyos que necesita en el aula, de la lista `APOYOS_AULA` (texto en castellano, se traduce al mostrarlo).
   * Es lo que la IA recibe para adaptar, junto con sus barreras.
   */
  apoyos?: string[];
  notas: string;
  /**
   * Lo que se sacó de su informe sociopsicopedagógico (el del orientador): solo las conclusiones, no el
   * informe. Lo revisa el docente antes de guardarse. Ver `docs/PTAL.md`, «El informe del orientador».
   */
  informe?: InformeOrientacion;
  /**
   * Los objetivos que vienen de la orientación: los que plantea su informe y los que indica la orientadora
   * aunque no estén en el informe. Pasan a sus programas; la IA propone otros además de estos.
   */
  objetivosOrientacion?: ObjetivoOrientacion[];
}

/** De dónde viene un objetivo: del informe del orientador, de lo que dice la orientadora, o lo propuso la IA. */
export type OrigenObjetivo = 'informe' | 'orientacion' | 'ia' | 'acs';

/** Un objetivo que viene de la orientación, antes o después de pasarlo a un programa. */
export interface ObjetivoOrientacion {
  id: string;
  texto: string;
  /** El programa (ámbito) al que va, por su nombre en la lengua de la app; sin él no se puede pasar. */
  ambito?: string;
  trimestres: Trimestre[];
  origen: Exclude<OrigenObjetivo, 'ia' | 'acs'>;
}

/** Las conclusiones del informe sociopsicopedagógico de un alumno, ya revisadas por el docente. */
export interface InformeOrientacion {
  /** Cuándo se leyó, YYYY-MM-DD. */
  fecha: string;
  /** El nombre del archivo del que se leyó, si lo hubo (el archivo no se guarda). */
  archivo?: string;
  fortalezas: string;
  /** Orientaciones y medidas que propone el informe. */
  orientaciones: string;
  /** Los ámbitos de programa que sugiere el informe (por su nombre en la lengua de la app). */
  ambitos: string[];
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
  /** De dónde viene; ausente en los escritos a mano y en los de antes. */
  origen?: OrigenObjetivo;
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

/**
 * La valoración del especialista de un objetivo al cerrar un trimestre. Manda sobre lo último que se
 * registró: es lo que sale en los informes y en el PAP.
 */
export interface EvaluacionObjetivo {
  alumnoId: string;
  objetivoId: string;
  trimestre: Trimestre;
  /** `sin`: no se trabajó. */
  resultado: Logro | 'sin';
  comentario: string;
  /** YYYY-MM-DD. */
  fecha: string;
}

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
 * - `adaptacion`: la adaptación de la programación de aula del tutor a un
 *   alumno, de un área y un trimestre (ACI o ACIS, en formato general).
 */
export type TipoDocumentoApoyo = 'programacion' | 'familia' | 'equipo' | 'pap' | 'adaptacion';

/** Los documentos que se preparan con un clic desde los datos del registro (todos menos la adaptación, que pide el área y la programación del tutor). */
export type TipoDocumentoGenerable = Exclude<TipoDocumentoApoyo, 'adaptacion'>;

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
  /** Solo la adaptación de la programación de aula: el área, por su nombre en el currículo. */
  area?: string;
  /** Cuándo se generó o se cambió por última vez, YYYY-MM-DD. */
  fecha: string;
  titulo: string;
  /** Lo que el docente puede retocar; siempre en el orden del modelo. */
  apartados: ApartadoDocumento[];
  /** Solo el PAP: una fila por medida de respuesta, con sus cinco columnas. */
  tabla?: string[][];
}

/**
 * Adaptación curricular significativa: una por alumno y área, para todo el curso. Se construye eligiendo elementos del
 * currículo oficial del curso de referencia (al que se rebaja el área) y se sigue trimestre a trimestre criterio a
 * criterio. Los apartados y los campos que se ven dependen de la comunidad (`lib/acsModelos.ts`): la ACS de Séneca
 * en Andalucía, la ACIS del PAP en la Comunitat Valenciana, el PI en Cataluña y la ACS de Raíces en Madrid. Los
 * campos de otra comunidad se conservan aunque no se vean. Ver `docs/PTAL.md`, «Adaptación curricular significativa».
 */
export interface AcsApoyo {
  id: string;
  alumnoId: string;
  /* 1. Datos generales y dictamen */
  /** Fecha del informe de evaluación psicopedagógica que propone la medida, YYYY-MM-DD. */
  fechaInforme: string;
  /** El curso de referencia: el que se toma del currículo (con el desfase justificado). */
  nivel: CursoDe;
  /** Por qué ese curso: el desfase curricular, de al menos dos cursos (artículos 36 y 50 de las órdenes). */
  justificacion: string;
  /**
   * El profesorado responsable: nombres o cargos, como los escriba el docente. Nunca van a la IA. `orientador`
   * (Comunitat Valenciana) y `referente` (el referente del PI, Cataluña) solo en esas comunidades.
   */
  responsables: { tutor: string; especialista: string; materia: string; orientador?: string; referente?: string };
  /**
   * Otras fechas del modelo de cada comunidad, YYYY-MM-DD: la resolución de la dirección (Comunitat Valenciana), el
   * dictamen de escolarización (Madrid), el inicio y la vigencia del PI y su aprobación en la CAD (Cataluña).
   */
  fechas?: Partial<Record<FechaAcs, string>>;
  /** Madrid: quién hizo la evaluación psicopedagógica y el dictamen. */
  organismo?: 'eoep' | 'orientacion';
  /** Comunitat Valenciana: barreras y fortalezas para el aprendizaje y la participación. */
  barreras?: string;
  fortalezas?: string;
  /** Cataluña: cada criterio elegido, priorizado o modificado, y qué hace en relación con la actividad del aula. */
  ajusteCriterios?: Record<string, { tipo?: 'priorizado' | 'modificado'; aula: string }>;
  /** Horas semanales de apoyo dentro y fuera del aula, y cómo se organizan (no Andalucía). */
  apoyos?: ApoyosAcs;
  /** Cataluña: la familia está conforme y lo que se acuerda con ella y con el alumno. */
  acuerdos?: string;
  familiaConforme?: boolean;
  /** La nota de cada trimestre con los criterios de la adaptación (Comunitat Valenciana y Madrid). */
  notas?: Partial<Record<Trimestre, string>>;
  /** Comunitat Valenciana: la decisión de promoción al final del curso o del ciclo. */
  promocion?: string;
  /**
   * Los objetivos concretos que salen de la adaptación: frases cortas y evaluables, por trimestre, cada una ligada a un
   * criterio elegido. El especialista los puede pasar a sus programas; el docente de aula los sigue aquí.
   */
  objetivos?: ObjetivoAcs[];
  /* 2. Selección curricular */
  /** El área o materia en el currículo del curso de referencia (`CurriculumEntry.nombre`). */
  area: string;
  /** Cómo se llama la materia en su clase, si no es la misma (un alumno de ESO con el área de Primaria). */
  materiaAula: string;
  /** Las competencias específicas elegidas, por su número. */
  competencias: number[];
  /** Los criterios de evaluación elegidos, por su código («1.1»). */
  criterios: string[];
  /** Los bloques de saberes básicos elegidos, por su letra. */
  saberes: string[];
  /* 3. Metodología y calificación */
  /** Las estrategias metodológicas y organizativas marcadas, por su id (`ESTRATEGIAS_ACS`). */
  estrategias: string[];
  /** Otras estrategias, escritas a mano. */
  otrasEstrategias: string;
  /** Los instrumentos de evaluación adaptados y su peso en la calificación, en %. */
  instrumentos: InstrumentoAcs[];
  /** Los criterios de calificación, en texto. */
  calificacion: string;
  /* 4. Seguimiento */
  seguimiento: SeguimientoAcs[];
  /** Las medidas de ajuste de cada trimestre. */
  ajustes: Partial<Record<Trimestre, string>>;
  /** Cuándo se cambió por última vez, YYYY-MM-DD. */
  fecha: string;
}

export interface ObjetivoAcs {
  id: string;
  texto: string;
  /** Nunca vacío. */
  trimestres: Trimestre[];
  /** El código del criterio de la adaptación con el que se evalúa, si lo tiene. */
  criterio?: string;
}

export type FechaAcs = 'resolucion' | 'dictamen' | 'inicio' | 'vigencia' | 'cad';

export interface ApoyosAcs {
  ptDentro: number;
  ptFuera: number;
  alDentro: number;
  alFuera: number;
  /** Cataluña: escolarizado con el apoyo de una SIEI. */
  siei?: boolean;
  organizacion: string;
}

export interface InstrumentoAcs {
  id: string;
  nombre: string;
  peso: number;
}

/** Grado de consecución de un criterio o de un bloque de saberes en un trimestre. */
export type GradoAcs = 'no-iniciado' | 'proceso' | 'conseguido';

export interface SeguimientoAcs {
  trimestre: Trimestre;
  /** Qué se valora: un criterio de evaluación o un bloque de saberes. */
  tipo: 'criterio' | 'saber';
  /** El código del criterio o la letra del bloque. */
  clave: string;
  grado?: GradoAcs;
  observaciones: string;
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
  /** Cierre de cada trimestre: la valoración del especialista de cada objetivo. */
  evaluaciones: EvaluacionObjetivo[];
  /** Las adaptaciones curriculares significativas (Andalucía). */
  acs: AcsApoyo[];
  /**
   * Las adaptaciones que hace o recibe un docente de aula o de EF para el alumnado de «Mis clases»: `alumnoId` es el
   * id del `Student`. Ver `docs/PTAL.md`, «La adaptación en el aula».
   */
  acsAula: AcsApoyo[];
  agendas: AgendaVisual[];
  fotos: FotoApoyo[];
}
