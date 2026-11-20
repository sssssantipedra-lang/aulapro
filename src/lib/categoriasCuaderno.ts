/**
 * Las categorías con las que se puede empezar el cuaderno de una asignatura (20-11-2026, de la revisión a fondo:
 * un especialista de Música, de Inglés o de Plástica empezaba con «Exámenes, Tareas, Participación», que no es
 * como evalúa).
 *
 * Se ofrecen y nunca se imponen: la tarjeta de empezar el cuaderno (`pages/Notebook.tsx`) enseña un botón por
 * propuesta, además de «Crear a mi manera», y después el nombre y el peso de cada categoría se cambian como
 * siempre. Que coincidan con lo que pide cada departamento es una suposición razonable, no un dato: por eso son
 * solo un punto de partida.
 *
 * Qué asignatura es cuál se sabe por su nombre («Inglés», «Music», «Educació Plàstica») y, si el nombre no lo
 * dice, por la materia oficial con la que la clase la tiene casada (`Class.materiasOficiales`), que vale en
 * cualquier idioma.
 */

import { esAsignaturaEF } from '../services/classMarks';

export type IdiomaCategorias = 'es' | 'ca' | 'en';

export interface CategoriaPropuesta { name: string; weight: number }

export type TipoDePropuesta = 'ef' | 'lengua-extranjera' | 'musica' | 'plastica' | 'tipica';

export interface PropuestaDeCategorias {
  id: TipoDePropuesta;
  /** El texto del botón, en castellano: es la clave de su traducción. */
  boton: string;
  /** Las categorías, con el nombre ya en el idioma de la app (son datos del cuaderno, no interfaz). */
  categorias: CategoriaPropuesta[];
}

type EnTresIdiomas = Record<IdiomaCategorias, CategoriaPropuesta[]>;

const de = (nombres: [string, string, string], weight: number, i: number): CategoriaPropuesta => ({ name: nombres[i], weight });
/** Una lista de categorías escrita una vez: [castellano, catalán, inglés] y su peso. */
function enTresIdiomas(filas: [[string, string, string], number][]): EnTresIdiomas {
  return {
    es: filas.map(([n, w]) => de(n, w, 0)),
    ca: filas.map(([n, w]) => de(n, w, 1)),
    en: filas.map(([n, w]) => de(n, w, 2)),
  };
}

/** La de siempre, para cualquier asignatura. */
const TIPICA = enTresIdiomas([
  [['Exámenes', 'Exàmens', 'Tests'], 60],
  [['Tareas', 'Tasques', 'Homework'], 30],
  [['Participación', 'Participació', 'Participation'], 10],
]);

/**
 * La estructura de Educación Física (petición del dueño, 20-10-2026): tres componentes. Es solo el punto de
 * partida: nombre y peso se editan después, para ajustarlos a la ponderación del centro o a los criterios LOMLOE.
 */
const EF = enTresIdiomas([
  [['Componente motriz', 'Component motriu', 'Motor component'], 40],
  [['Componente cognitivo', 'Component cognitiu', 'Cognitive component'], 30],
  [['Componente social y relacional', 'Component social i relacional', 'Social and relational component'], 30],
]);

/** Una lengua extranjera, por destrezas. */
const LENGUA_EXTRANJERA = enTresIdiomas([
  [['Comprensión oral', 'Comprensió oral', 'Listening'], 25],
  [['Expresión oral', 'Expressió oral', 'Speaking'], 25],
  [['Comprensión escrita', 'Comprensió escrita', 'Reading'], 25],
  [['Expresión escrita', 'Expressió escrita', 'Writing'], 25],
]);

const MUSICA = enTresIdiomas([
  [['Interpretación', 'Interpretació', 'Performing'], 40],
  [['Escucha', 'Escolta', 'Listening'], 30],
  [['Creación', 'Creació', 'Composing'], 30],
]);

const PLASTICA = enTresIdiomas([
  [['Creaciones', 'Creacions', 'Artwork'], 50],
  [['Proceso de trabajo', 'Procés de treball', 'Working process'], 30],
  [['Observación y análisis', 'Observació i anàlisi', 'Observation and analysis'], 20],
]);

const DATOS: Record<TipoDePropuesta, { boton: string; categorias: EnTresIdiomas }> = {
  ef: { boton: 'Usar los 3 componentes de Educación Física (40/30/30)', categorias: EF },
  'lengua-extranjera': { boton: 'Usar las 4 destrezas de la lengua (25/25/25/25)', categorias: LENGUA_EXTRANJERA },
  musica: { boton: 'Usar interpretación, escucha y creación (40/30/30)', categorias: MUSICA },
  plastica: { boton: 'Usar creaciones, proceso y análisis (50/30/20)', categorias: PLASTICA },
  tipica: { boton: 'Usar configuración típica (60/30/10)', categorias: TIPICA },
};

/** Sin tildes ni mayúsculas, para comparar nombres escritos de cualquier manera. */
const llano = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const IDIOMAS = /\b(ingles|english|angles|frances|french|francais|aleman|german|alemany|italiano|italia|portugues|lengua extranjera|llengua estrangera|foreign language|idioma extranjero)\b/;
const DE_MUSICA = /\b(musica|music)\b/;
const DE_PLASTICA = /\b(plastica|dibujo|dibuix|art|arts and crafts)\b/;
const ARTISTICA = /\b(educacion artistica|educacio artistica|artistic education|art education)\b/;

/** Por la materia oficial de la clase (`CurriculumEntry.id`, el mismo en todas las comunidades y lenguas). */
const POR_MATERIA: Record<string, TipoDePropuesta[]> = {
  'educacion-fisica': ['ef'],
  'lengua-extranjera': ['lengua-extranjera'],
  'segunda-lengua-extranjera': ['lengua-extranjera'],
  musica: ['musica'],
  'musica-y-danza': ['musica'],
  'creatividad-musical': ['musica'],
  'educacion-plastica-y-visual': ['plastica'],
  'educacion-plastica-visual-y-audiovisual': ['plastica'],
  'proyecto-educacion-plastica': ['plastica'],
  'expresion-artistica': ['plastica'],
  // En Primaria, donde es un área sola, lleva las dos
  'educacion-artistica': ['plastica', 'musica'],
};

/**
 * Qué propuestas propias le tocan a una asignatura, sin la típica. Manda el nombre que le puso el docente
 * («Música» dentro del área de Educación Artística es música); si no dice nada, la materia oficial.
 */
export function tiposDeAsignatura(asignatura: string, materiaOficial?: string | null): TipoDePropuesta[] {
  const porNombre = tiposPorNombre(asignatura);
  if (porNombre.length || !materiaOficial) return porNombre;
  // Las clases de antes guardaban el nombre de la materia, no su identificador
  return POR_MATERIA[materiaOficial] ?? tiposPorNombre(materiaOficial);
}

function tiposPorNombre(nombre: string): TipoDePropuesta[] {
  if (esAsignaturaEF(nombre)) return ['ef'];
  const n = llano(nombre);
  if (ARTISTICA.test(n)) return ['plastica', 'musica'];
  if (IDIOMAS.test(n)) return ['lengua-extranjera'];
  if (DE_MUSICA.test(n)) return ['musica'];
  if (DE_PLASTICA.test(n)) return ['plastica'];
  return [];
}

/**
 * Las propuestas para empezar el cuaderno de una asignatura: primero las de su materia, si las tiene, y al final
 * la típica, que vale para todas.
 */
export function propuestasDeCategorias(
  asignatura: string, lang: IdiomaCategorias, materiaOficial?: string | null,
): PropuestaDeCategorias[] {
  const idioma: IdiomaCategorias = lang === 'ca' || lang === 'en' ? lang : 'es';
  return [...tiposDeAsignatura(asignatura, materiaOficial), 'tipica' as const].map(id => ({
    id, boton: DATOS[id].boton, categorias: DATOS[id].categorias[idioma],
  }));
}

/**
 * Lo que dice la tarjeta antes de los botones, con su porqué: la clave del texto en castellano (lleva
 * `{asignatura}` cuando la nombra).
 */
export function explicacionDePropuestas(tipos: readonly TipoDePropuesta[]): string {
  if (tipos.includes('ef')) return 'Define las categorías de nota y cuánto pesa cada una en la media. En Educación Física puedes empezar con sus tres componentes, motriz, cognitivo y social y relacional, y renombrarlos o cambiar su peso después.';
  if (tipos.includes('plastica') && tipos.includes('musica')) return 'Define las categorías de nota y cuánto pesa cada una en la media. Como «{asignatura}» reúne plástica y música, puedes empezar con las categorías de una de las dos y renombrarlas o cambiar su peso después.';
  if (tipos.includes('lengua-extranjera')) return 'Define las categorías de nota y cuánto pesa cada una en la media. Como «{asignatura}» es una lengua extranjera, puedes empezar con sus cuatro destrezas, comprensión y expresión oral y escrita, y renombrarlas o cambiar su peso después.';
  if (tipos.includes('musica')) return 'Define las categorías de nota y cuánto pesa cada una en la media. Como «{asignatura}» es de música, puedes empezar con interpretación, escucha y creación, y renombrarlas o cambiar su peso después.';
  if (tipos.includes('plastica')) return 'Define las categorías de nota y cuánto pesa cada una en la media. Como «{asignatura}» es de plástica, puedes empezar con creaciones, proceso de trabajo y observación y análisis, y renombrarlas o cambiar su peso después.';
  return 'Define las categorías de nota y cuánto pesa cada una en la media. Puedes empezar con la configuración más habitual y ajustarla después.';
}
