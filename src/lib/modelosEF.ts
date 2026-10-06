/**
 * Los modelos pedagógicos de Educación Física con los que se diseñan las
 * situaciones de aprendizaje de EF (decisión del dueño, 5-10-2026: que se
 * apoyen en estudios de autores publicados en abierto). Cada modelo lleva sus
 * referencias; la IA elige el modelo, pero las referencias las pone la
 * aplicación desde esta lista, para que nunca se cite un estudio inventado.
 *
 * Todas las referencias se comprobaron el 5-10-2026 y son de acceso abierto:
 * Revista Española de Educación Física y Deportes (REEFD), Retos, Cultura,
 * Ciencia y Deporte, Apunts. Educación Física y Deportes, el libro digital
 * gratuito de la Universidad de León y las pautas DUA de CAST. Ver
 * `docs/EF.md`. Si se añade una, comprobarla antes y anotar dónde se publicó.
 */

export interface ReferenciaEF {
  id: string;
  /** La cita en formato APA, tal como se publicó (no se traduce). */
  cita: string;
}

export const REFERENCIAS_EF: readonly ReferenciaEF[] = [
  { id: 'fr-2016-modelos', cita: 'Fernández-Río, J., Calderón, A., Hortigüela, D., Pérez-Pueyo, Á. y Aznar, M. (2016). Modelos pedagógicos en educación física: consideraciones teórico-prácticas para docentes. Revista Española de Educación Física y Deportes, 413, 55-75.' },
  { id: 'fr-2018-revisando', cita: 'Fernández-Río, J., Hortigüela-Alcalá, D. y Pérez-Pueyo, Á. (2018). Revisando los modelos pedagógicos en educación física. Ideas clave para incorporarlos al aula. Revista Española de Educación Física y Deportes, 423, 57-80. https://doi.org/10.55166/reefd.vi423.695' },
  { id: 'calderon-2011-med', cita: 'Calderón, A., Hastie, P. A. y Martínez de Ojeda, D. (2011). El modelo de educación deportiva (sport education model). ¿Metodología de enseñanza del nuevo milenio? Revista Española de Educación Física y Deportes, 395, 63-82.' },
  { id: 'fr-mg-2016-ac', cita: 'Fernández-Río, J. y Méndez-Giménez, A. (2016). El aprendizaje cooperativo: modelo pedagógico para educación física. Retos, 29, 201-206. https://doi.org/10.47197/retos.v0i29.38721' },
  { id: 'fr-2017-ciclo', cita: 'Fernández-Río, J. (2017). El ciclo del aprendizaje cooperativo: una guía para implementar de manera efectiva el aprendizaje cooperativo en educación física. Retos, 32, 264-269.' },
  { id: 'abad-2013-ecd', cita: 'Abad Robles, M. T., Benito Peinado, P. J., Giménez Fuentes-Guerra, F. J. y Robles Rodríguez, J. (2013). Fundamentos pedagógicos de la enseñanza comprensiva del deporte: una revisión de la literatura. Cultura, Ciencia y Deporte, 8(23), 137-146.' },
  { id: 'baena-2008-naturaleza', cita: 'Baena-Extremera, A. y Granero-Gallegos, A. (2008). Las actividades físicas en la naturaleza en el currículum actual: contribución a la educación para la ciudadanía y los derechos humanos. Retos, 14, 48-53. https://doi.org/10.47197/retos.v0i14.35010' },
  { id: 'niubo-2022-emociones', cita: 'Niubò-Solé, J., Lavega-Burgués, P. y Sáenz-López, P. (2022). Emociones en función del tipo de tarea motriz, experiencia deportiva y género. Apunts. Educación Física y Deportes, 148, 26-33. https://doi.org/10.5672/apunts.2014-0983.es.(2022/2).148.04' },
  { id: 'lp-pp-2017-evaluacion', cita: 'López-Pastor, V. M. y Pérez-Pueyo, Á. (coords.) (2017). Evaluación formativa y compartida en educación: experiencias de éxito en todas las etapas educativas. Universidad de León.' },
  { id: 'cast-2024-dua', cita: 'CAST (2024). Universal Design for Learning Guidelines version 3.0. https://udlguidelines.cast.org' },
];

/** Las que van siempre: la evaluación formativa y compartida y el DUA. */
const SIEMPRE = ['lp-pp-2017-evaluacion', 'cast-2024-dua'];

export interface ModeloEF {
  id: string;
  /** El nombre, para el desplegable (se traduce). */
  nombre: string;
  /** Qué es y cómo se lleva a una SdA, para la IA (en castellano). */
  claves: string;
  refs: string[];
}

export const MODELOS_EF: readonly ModeloEF[] = [
  {
    id: 'aprendizaje-cooperativo', nombre: 'Aprendizaje cooperativo',
    claves: 'Interdependencia positiva, responsabilidad individual, interacción promotora, habilidades sociales y procesamiento grupal; ciclo de creación y cohesión de grupo, la cooperación como contenido y la cooperación como recurso (Fernández-Río).',
    refs: ['fr-mg-2016-ac', 'fr-2017-ciclo', 'fr-2016-modelos'],
  },
  {
    id: 'educacion-deportiva', nombre: 'Educación Deportiva',
    claves: 'Temporada en lugar de unidad, afiliación a equipos estables, roles (capitán, árbitro, preparador físico, periodista), competición formal, registro de datos y evento culminante festivo (Siedentop; Calderón, Hastie y Martínez de Ojeda).',
    refs: ['calderon-2011-med', 'fr-2016-modelos'],
  },
  {
    id: 'ensenanza-comprensiva', nombre: 'Enseñanza comprensiva del deporte',
    claves: 'Juegos modificados por representación y exageración, conciencia táctica antes que técnica, preguntas al alumnado sobre qué hacer y por qué, progresión de forma de juego a práctica y vuelta al juego (Bunker y Thorpe; Devís y Peiró).',
    refs: ['abad-2013-ecd', 'fr-2016-modelos'],
  },
  {
    id: 'responsabilidad', nombre: 'Responsabilidad personal y social',
    claves: 'Niveles de Hellison (respeto, participación y esfuerzo, autonomía, ayuda y liderazgo, transferencia fuera del aula); charla inicial, actividad con responsabilidades, reunión de grupo y autoevaluación al final de cada sesión.',
    refs: ['fr-2016-modelos', 'fr-2018-revisando'],
  },
  {
    id: 'medio-natural', nombre: 'Educación en el medio natural',
    claves: 'Actividades en la naturaleza y en el entorno próximo (orientación, senderismo, juegos de pistas), respeto y conservación del medio, seguridad, autonomía y trabajo en equipo; del centro al entorno cercano (Baena-Extremera y Granero-Gallegos).',
    refs: ['baena-2008-naturaleza', 'fr-2016-modelos'],
  },
  {
    id: 'juegos-emociones', nombre: 'Juegos motores y educación emocional',
    claves: 'Lógica interna de los juegos y dominios de acción motriz (Parlebas): psicomotrices, de cooperación, de oposición y de cooperación-oposición; vivencia y conciencia de las emociones que provoca cada tipo de juego (Lavega).',
    refs: ['niubo-2022-emociones'],
  },
  {
    id: 'hibridacion', nombre: 'Hibridación de modelos',
    claves: 'Combinar dos modelos que se complementan (por ejemplo, Educación Deportiva con Aprendizaje cooperativo, o Enseñanza comprensiva con Responsabilidad personal y social), con una estructura clara de cada uno en las sesiones.',
    refs: ['fr-2018-revisando', 'fr-mg-2016-ac'],
  },
];

export const IDS_MODELOS_EF = MODELOS_EF.map(m => m.id);

export function modeloEF(id: string): ModeloEF | undefined {
  return MODELOS_EF.find(m => m.id === id);
}

/** Las referencias de los modelos elegidos, más las que van siempre, sin repetir y en el orden de la lista. */
export function referenciasDeModelos(ids: readonly string[]): string[] {
  const usadas = new Set([...ids.flatMap(id => modeloEF(id)?.refs ?? []), ...SIEMPRE]);
  return REFERENCIAS_EF.filter(r => usadas.has(r.id)).map(r => r.cita);
}

/** El bloque de los modelos para el prompt de la IA. */
export function modelosParaIA(): string {
  return MODELOS_EF.map(m => `- ${m.id}: ${m.nombre}. ${m.claves}`).join('\n');
}
