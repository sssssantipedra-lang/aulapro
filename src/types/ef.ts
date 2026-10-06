/**
 * Educación Física: lo que se guarda en el perfil del profesorado de EF, al
 * lado de sus clases y su cuaderno (decisiones del dueño del 5-10-2026, ver
 * `docs/EF.md`). El alumnado es el de «Mis Clases»: aquí solo va lo propio de
 * la asignatura, por el id de cada alumno.
 */

/** Lo que alguien exento o lesionado no puede hacer, para adaptar la clase. */
export type LimitacionEF =
  | 'correr' | 'saltar' | 'impacto' | 'contacto' | 'brazos' | 'piernas' | 'esfuerzo-intenso' | 'sol';

export interface ExentoEF {
  id: string;
  alumnoId: string;
  limitaciones: LimitacionEF[];
  /** Otra limitación escrita por el docente. */
  otra: string;
  /** YYYY-MM-DD. */
  desde: string;
  /** YYYY-MM-DD; sin fecha, hasta que se quite. */
  hasta?: string;
  /** Qué hace en clase mientras tanto. */
  tarea: string;
  /** Si ha traído justificante. */
  justificante: boolean;
  /**
   * El motivo, solo para el docente (por ejemplo, «esguince de tobillo»). Es
   * un dato de salud: nunca se envía a la IA.
   */
  motivo: string;
}

/**
 * Nivel de respuesta para la inclusión del alumno o la alumna en EF, según el
 * Decreto 104/2018 de la Comunitat Valenciana, art. 14 (decisión del dueño,
 * 6-10-2026): 2, el nivel II, medidas generales del grupo-clase; 3, el nivel
 * III, respuesta diferenciada con apoyos ordinarios adicionales.
 */
export type NivelApoyoEF = 2 | 3;

/** Lo que necesita en clase de EF, sin diagnóstico. */
export type NecesidadEF =
  | 'anticipar' | 'rutinas' | 'instrucciones' | 'visual' | 'senales' | 'companero'
  | 'tiempo' | 'material' | 'desplazamiento' | 'estimulos' | 'calma' | 'normas';

/**
 * Un alumno con medidas de nivel II o III, para todo el curso (no tiene
 * fechas, como los exentos). A la IA solo le llegan el nivel y lo que
 * necesita, sin su nombre ni su diagnóstico.
 */
export interface ApoyoEF {
  id: string;
  alumnoId: string;
  nivel: NivelApoyoEF;
  necesidades: NecesidadEF[];
  /** Otra necesidad escrita por el docente, sin el diagnóstico. */
  otra: string;
}

export type CategoriaPrueba = 'resistencia' | 'velocidad' | 'fuerza' | 'flexibilidad' | 'otra';

/** Una prueba de condición física: las de partida y las del docente. */
export interface PruebaFisica {
  id: string;
  nombre: string;
  categoria: CategoriaPrueba;
  /** «s», «m», «cm», «kg», «períodos»… */
  unidad: string;
  /** Si es mejor una marca más alta (salto) o más baja (tiempo). */
  mejor: 'mas' | 'menos';
  /** Cómo se hace, en una o dos frases. */
  descripcion: string;
  /** Las del docente se pueden borrar; las de partida, solo ocultar. */
  propia?: boolean;
  oculta?: boolean;
}

export interface MarcaPrueba {
  id: string;
  pruebaId: string;
  alumnoId: string;
  /** YYYY-MM-DD. */
  fecha: string;
  valor: number;
}

export type SexoEF = 'F' | 'M';

/** Un tramo del baremo: con esta marca o mejor, esta nota. */
export interface TramoBaremo { marca: number; nota: number }

/**
 * Cómo se pasa una marca a nota en una prueba, para un curso y, si se quiere,
 * para un sexo. Opcional: sin baremo solo se ven las marcas y la mejora.
 */
export interface BaremoEF {
  id: string;
  pruebaId: string;
  etapa: 'primaria' | 'eso';
  curso: number;
  sexo?: SexoEF;
  tramos: TramoBaremo[];
  /** De dónde sale: «propio» o la referencia de una batería publicada. */
  fuente: string;
}

export type TipoActividadEF = 'juego' | 'deporte' | 'lluvia' | 'natural' | 'calentamiento' | 'calma';

/**
 * La modalidad de un juego o deporte, por su lógica interna (decisión del
 * dueño, 6-10-2026): invasión, red y pared, lucha, blanco y diana,
 * cooperación, juegos tradicionales y populares, y medio natural y urbano.
 * Cada una se prepara de una manera (ver `MODALIDADES_EF`).
 */
export type ModalidadEF =
  | 'invasion' | 'red-pared' | 'lucha' | 'blanco-diana' | 'cooperacion' | 'tradicionales' | 'natural-urbano';

/** Una actividad del banco: las de partida, las del docente y las de la IA que guarda. */
export interface ActividadEF {
  id: string;
  titulo: string;
  tipo: TipoActividadEF;
  /** En qué consiste. */
  descripcion: string;
  organizacion: string;
  material: string;
  /** Variantes y progresiones. */
  variantes: string;
  /** Cómo participa quien tiene una limitación (DUA-A). */
  inclusion: string;
  /** Las de partida vienen con la app; las demás, del docente o de la IA. */
  origen: 'banco' | 'propia' | 'ia';
  /** Si es un juego o deporte, su modalidad. */
  modalidad?: ModalidadEF;
}

/** Una sesión de EF: calentamiento, parte principal y vuelta a la calma. */
export interface SesionEF {
  /** Los criterios de evaluación oficiales que trabaja. */
  criterios?: import('./index').OfficialCriterionRef[];
  /** Si la preparó la IA. */
  ia?: boolean;
  /** La modalidad del juego o deporte que trabaja, si es uno. */
  modalidad?: ModalidadEF;
  id: string;
  titulo: string;
  claseId?: string;
  /** YYYY-MM-DD, si está prevista para un día. */
  fecha?: string;
  instalacionId?: string;
  objetivo: string;
  calentamiento: string;
  principal: string;
  calma: string;
  material: string;
  /** Medidas de inclusión para las limitaciones de hoy (DUA-A). */
  inclusion: string;
  /** Plan B si llueve o la instalación está ocupada. */
  planB: string;
}

export interface MaterialEF {
  id: string;
  nombre: string;
  cantidad: number;
  /** Bien, regular, para reponer. */
  estado: 'bien' | 'regular' | 'reponer';
  ubicacion: string;
}

export interface InstalacionEF {
  id: string;
  nombre: string;
  /** Si se puede usar con lluvia. */
  cubierta: boolean;
  notas: string;
}

/** Un circuito o un trabajo por intervalos para el cronómetro. */
export interface CircuitoEF {
  id: string;
  nombre: string;
  /** Una por estación, en orden. */
  estaciones: string[];
  /** Segundos de trabajo en cada estación. */
  trabajo: number;
  /** Segundos de descanso entre estaciones. */
  descanso: number;
  rondas: number;
  /** Segundos de descanso entre rondas. */
  descansoRondas: number;
}

/** Los últimos equipos de una clase, que se quedan hasta que se hagan otros. */
export interface EquiposEF {
  /** YYYY-MM-DD. */
  fecha: string;
  /** Los ids del alumnado de cada equipo, en el orden de los colores. */
  grupos: string[][];
}

export interface EfData {
  exentos: ExentoEF[];
  /** Alumnado con medidas de nivel II o III, uno por alumno. */
  apoyos: ApoyoEF[];
  /** Nivel general de 1 a 3 que marca el docente, para hacer equipos. */
  niveles: Record<string, 1 | 2 | 3>;
  /** Para mezclar en los equipos y, si se quiere, para el baremo. */
  sexos: Record<string, SexoEF>;
  /** Parejas que conviene separar al hacer equipos. */
  separar: { a: string; b: string }[];
  /** Por id de clase. */
  equipos: Record<string, EquiposEF>;
  pruebas: PruebaFisica[];
  marcas: MarcaPrueba[];
  baremos: BaremoEF[];
  actividades: ActividadEF[];
  sesiones: SesionEF[];
  material: MaterialEF[];
  instalaciones: InstalacionEF[];
  circuitos: CircuitoEF[];
}
