/**
 * Catálogo de ilustraciones de las fichas (decisión del dueño, 14-10-2026):
 * ninguna imagen entra suelta. Cada una lleva su identificador, una
 * descripción de lo que se ve (en los tres idiomas) y los temas comunes que
 * cubre, para que se pueda reutilizar en cualquier ficha y para que la app
 * la relacione sola con lo que se está trabajando, sin pedírselo a la IA:
 * `elegirIlustraciones` cruza el tema, el área y el curso de la ficha con
 * los temas y la descripción de cada una.
 *
 * Dos orígenes, una sola forma:
 * - `svg`: dibujadas en código (`services/fichaCuaderno.ts`): cabeceras por
 *   área y las mascotas de los recuadros. Sin peso, nítidas al imprimir.
 * - `img`: ilustraciones generadas una vez con `scripts/ilustraciones/`
 *   (fal.ai, modelo barato), guardadas en `public/ilustraciones/` y apuntadas
 *   en `ilustraciones.catalogo.json`, que el script reescribe: no se cambia a
 *   mano. Van dentro de la aplicación: funcionan sin conexión y no se envía
 *   nada (ver la regla 1 de `CLAUDE.md`).
 *
 * Los temas son palabras en castellano, sin tildes y en minúscula, y se
 * buscan como trozo de palabra («fraccion» encuentra «fracciones»). Mejor
 * pocos y comunes —tópicos que salen en muchas fichas— que uno por ficha.
 */
import type { Lang } from '../i18n';
import { pickMotifKey, empiezaPalabra, type FichaMotifKey } from '../services/fichaMotifs';
import catalogoImg from './ilustraciones.catalogo.json';

/** Para qué sirve: cabecera de la ficha, mascota de un recuadro, objeto suelto o escena. */
export type UsoIlustracion = 'cabecera' | 'mascota' | 'objeto' | 'escena';
export type EtapaIlustracion = 'infantil' | 'primaria' | 'eso';

export interface Ilustracion {
  id: string;
  uso: UsoIlustracion;
  /** Qué se ve, en una frase. La lee la IA (lista cerrada) y la usa también la búsqueda. */
  descripcion: Record<Lang, string>;
  /** Tópicos comunes que cubre: castellano, sin tildes, en minúscula. */
  temas: string[];
  /** Áreas donde encaja. */
  areas: FichaMotifKey[];
  /** Sin ellas, vale para todas. */
  etapas?: EtapaIlustracion[];
  fuente: 'svg' | 'img';
}

const d = (es: string, ca: string, en: string): Record<Lang, string> => ({ es, ca, en });

const CATALOGO_SVG: Ilustracion[] = [
  {
    id: 'cab-base10', uso: 'cabecera', fuente: 'svg', areas: ['matematicas'], etapas: ['primaria'],
    descripcion: d('Cubo, barra, placa y cubito de base 10 (millar, centena, decena y unidad)', 'Cub, barra, placa i cubet de base 10 (miler, centena, desena i unitat)', 'Base-ten cube, rod, flat and unit block (thousand, hundred, ten and one)'),
    temas: ['numero', 'cifra', 'millon', 'millar', 'centena', 'decena', 'unidad', 'valor posicional', 'descomponer', 'descomposicion', 'ordenar numeros', 'suma', 'resta', 'sumar', 'restar', 'calculo', 'operacion', 'sistema de numeracion', 'cantidad', 'decimal', 'redondeo', 'aproxima'],
  },
  {
    id: 'cab-fracciones', uso: 'cabecera', fuente: 'svg', areas: ['matematicas'], etapas: ['primaria', 'eso'],
    descripcion: d('Círculo y barra divididos en partes iguales con la fracción 3/4', 'Cercle i barra dividits en parts iguals amb la fracció 3/4', 'Circle and bar split into equal parts showing the fraction 3/4'),
    temas: ['fraccion', 'numerador', 'denominador', 'mitad', 'tercio', 'cuarto', 'partes iguales', 'porcentaje', 'proporcion', 'razon', 'equivalente', 'decimal'],
  },
  {
    id: 'cab-geometria', uso: 'cabecera', fuente: 'svg', areas: ['matematicas'],
    descripcion: d('Regla, escuadra y cubo para figuras y medidas', 'Regle, escaire i cub per a figures i mesures', 'Ruler, set square and cube for shapes and measures'),
    temas: ['geometria', 'figura', 'area', 'perimetro', 'volumen', 'angulo', 'triangulo', 'cuadrado', 'rectangulo', 'circulo', 'poligono', 'cuerpo geometrico', 'prisma', 'simetria', 'medida', 'longitud', 'regla', 'capacidad', 'masa', 'unidades'],
  },
  {
    id: 'cab-lengua', uso: 'cabecera', fuente: 'svg', areas: ['lengua'],
    descripcion: d('Libro abierto, lápiz y letras para leer y escribir', 'Llibre obert, llapis i lletres per llegir i escriure', 'Open book, pencil and letters for reading and writing'),
    temas: ['lectura', 'leer', 'comprension', 'texto', 'cuento', 'narracion', 'poema', 'redaccion', 'escritura', 'ortografia', 'gramatica', 'sustantivo', 'adjetivo', 'verbo', 'sinonimo', 'antonimo', 'vocabulario', 'silaba', 'acentuacion', 'tilde', 'oracion', 'literatura', 'letra'],
  },
  {
    id: 'cab-ingles', uso: 'cabecera', fuente: 'svg', areas: ['ingles'],
    descripcion: d('Bocadillos con «Hello» y «Hi» y un bloque ABC para el idioma', 'Bocadillos amb «Hello» i «Hi» i un bloc ABC per a l’idioma', 'Speech bubbles with “Hello” and “Hi” and an ABC block for languages'),
    temas: ['ingles', 'english', 'idioma', 'lengua extranjera', 'vocabulary', 'greeting', 'saludo', 'frances', 'conversacion', 'present simple', 'past simple', 'verb to be'],
  },
  {
    id: 'cab-naturales', uso: 'cabecera', fuente: 'svg', areas: ['cienciasNaturales'],
    descripcion: d('Matraz, hoja y lupa para experimentar y observar la naturaleza', 'Matràs, fulla i lupa per experimentar i observar la natura', 'Flask, leaf and magnifying glass for experiments and observing nature'),
    temas: ['ciencia', 'experimento', 'materia', 'energia', 'planta', 'animal', 'ser vivo', 'ecosistema', 'cuerpo humano', 'fotosintesis', 'celula', 'agua', 'ciclo', 'mezcla', 'fuerza', 'electricidad', 'luz', 'sonido', 'medio ambiente', 'biologia', 'quimica', 'fisica', 'reino'],
  },
  {
    id: 'cab-sociales', uso: 'cabecera', fuente: 'svg', areas: ['cienciasSociales'],
    descripcion: d('Globo terráqueo, brújula y chincheta de mapa', 'Globus terraqüi, brúixola i xinxeta de mapa', 'Globe, compass and map pin'),
    temas: ['historia', 'geografia', 'mapa', 'pais', 'continente', 'oceano', 'comunidad', 'europa', 'espana', 'edad media', 'prehistoria', 'romanos', 'epoca', 'civilizacion', 'poblacion', 'clima', 'relieve', 'paisaje', 'rio', 'sociedad', 'orientacion', 'territorio'],
  },
  {
    id: 'cab-musica', uso: 'cabecera', fuente: 'svg', areas: ['musica'],
    descripcion: d('Pentagrama con notas musicales de colores', 'Pentagrama amb notes musicals de colors', 'Staff with coloured musical notes'),
    temas: ['musica', 'nota musical', 'ritmo', 'melodia', 'pentagrama', 'instrumento', 'cancion', 'compas', 'figura musical', 'cantar', 'flauta'],
  },
  {
    id: 'cab-deporte', uso: 'cabecera', fuente: 'svg', areas: ['educacionFisica'],
    descripcion: d('Balón, trofeo y cronómetro para el deporte', 'Pilota, trofeu i cronòmetre per a l’esport', 'Ball, trophy and stopwatch for sport'),
    temas: ['deporte', 'juego', 'balon', 'equipo', 'carrera', 'condicion fisica', 'resistencia', 'velocidad', 'gimnasia', 'baloncesto', 'futbol', 'olimpico', 'calentamiento', 'salud'],
  },
  {
    id: 'cab-plastica', uso: 'cabecera', fuente: 'svg', areas: ['plastica'],
    descripcion: d('Paleta de pintura con colores y un pincel', 'Paleta de pintura amb colors i un pinzell', 'Paint palette with colours and a brush'),
    temas: ['arte', 'pintura', 'dibujo', 'color', 'colores', 'forma', 'textura', 'collage', 'creatividad', 'artista', 'cuadro', 'mezcla de colores', 'colores primarios'],
  },
  {
    id: 'cab-valores', uso: 'cabecera', fuente: 'svg', areas: ['valores'],
    descripcion: d('Corazones y estrella para las emociones y los valores', 'Cors i estrella per a les emocions i els valors', 'Hearts and a star for feelings and values'),
    temas: ['valor', 'emocion', 'sentimiento', 'respeto', 'amistad', 'convivencia', 'empatia', 'solidaridad', 'derechos', 'igualdad', 'religion', 'etica', 'normas', 'responsabilidad'],
  },
  {
    id: 'cab-aula', uso: 'cabecera', fuente: 'svg', areas: ['general'],
    descripcion: d('Lápiz, libros, bombilla y estrella: material de clase para cualquier tema', 'Llapis, llibres, bombeta i estrella: material de classe per a qualsevol tema', 'Pencil, books, light bulb and star: classroom supplies for any topic'),
    temas: ['repaso', 'aula', 'colegio', 'estudio', 'tecnologia', 'proyecto'],
  },
  {
    id: 'mascota-chincheta', uso: 'mascota', fuente: 'svg', areas: ['general'],
    descripcion: d('Chincheta roja que destaca lo que hay que recordar', 'Xinxeta vermella que destaca el que cal recordar', 'Red pin that highlights what to remember'),
    temas: ['recuerda', 'recordar', 'repaso', 'definicion', 'equivalencia', 'leyenda', 'formula'],
  },
  {
    id: 'mascota-estrella', uso: 'mascota', fuente: 'svg', areas: ['general'],
    descripcion: d('Estrella sonriente para un reto o una pregunta extra', 'Estrella somrient per a un repte o una pregunta extra', 'Smiling star for a challenge or bonus question'),
    temas: ['reto', 'desafio', 'ampliacion', 'pregunta extra', 'premio'],
  },
  {
    id: 'mascota-bombilla', uso: 'mascota', fuente: 'svg', areas: ['general'],
    descripcion: d('Bombilla encendida para un consejo o una idea', 'Bombeta encesa per a un consell o una idea', 'Lit light bulb for a tip or an idea'),
    temas: ['consejo', 'pista', 'truco', 'idea', 'estrategia', 'metodo'],
  },
];

/** Las generadas con fal.ai: las escribe `scripts/ilustraciones/generar.mjs`. */
const CATALOGO_IMG = catalogoImg as Ilustracion[];

export const ILUSTRACIONES: readonly Ilustracion[] = [...CATALOGO_SVG, ...CATALOGO_IMG];

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function ilustracionPorId(id: string | undefined | null): Ilustracion | undefined {
  return id ? ILUSTRACIONES.find(i => i.id === id) : undefined;
}

/** Dónde está el archivo de una ilustración `img`, dentro de la aplicación. */
export const urlIlustracion = (id: string) => `ilustraciones/${id}.webp`;

export interface ContextoIlustracion {
  tema: string;
  area: string;
  /** El curso o nivel, tal como lo escribe el docente («3º Primaria», «1º ESO»…). */
  nivel?: string;
}

function etapaDe(nivel: string | undefined): EtapaIlustracion | undefined {
  const n = plano(nivel ?? '');
  if (/infantil/.test(n)) return 'infantil';
  if (/eso|secundaria|bachiller/.test(n)) return 'eso';
  if (/primaria|\bº\b|\d/.test(n)) return 'primaria';
  return undefined;
}

/**
 * Un tema encaja si empieza una palabra del texto; los de tres letras o menos
 * («sol», «mar», «pez», «luz») solo con la palabra entera o su plural, porque
 * si no «sol» encontraba «solar» (el sistema solar salía con unas gafas de sol)
 * y «mar», «marzo».
 */
export function coincideTema(texto: string, clave: string): boolean {
  if (clave.length > 3) return empiezaPalabra(texto, clave);
  const k = clave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${k}(es|s)?($|[^a-z0-9])`).test(texto);
}

/**
 * Cuánto encaja una ilustración con lo que se trabaja. Cada tema de la
 * ilustración que aparece en el tema o el área vale 3 (el más largo, el más
 * específico, un poco más); que sea del área que se deduce vale 2; cada palabra
 * de su descripción que se menciona, 0,5. Con una etapa que no es la suya,
 * resta 1.
 */
export function puntuarIlustracion(ilu: Ilustracion, ctx: ContextoIlustracion): number {
  const texto = plano(`${ctx.tema} ${ctx.area}`);
  let puntos = 0;
  for (const t of ilu.temas) {
    const k = plano(t);
    if (k && coincideTema(texto, k)) puntos += 3 + Math.min(1, k.length / 20);
  }
  if (ilu.areas.includes(pickMotifKey(ctx.tema, ctx.area))) puntos += 2;
  for (const w of new Set(plano(ilu.descripcion.es).split(/[^a-z0-9]+/).filter(x => x.length > 4))) {
    if (empiezaPalabra(texto, w)) puntos += 0.5;
  }
  const etapa = etapaDe(ctx.nivel);
  if (etapa && ilu.etapas && !ilu.etapas.includes(etapa)) puntos -= 1;
  return puntos;
}

/**
 * Las ilustraciones que mejor encajan con una ficha, de más a menos. Sin
 * coincidencia ninguna, las generales: la app nunca se queda sin una cabecera.
 */
export function elegirIlustraciones(
  ctx: ContextoIlustracion, opts: { uso?: UsoIlustracion; max?: number } = {},
): Ilustracion[] {
  const { uso, max = 3 } = opts;
  const candidatas = ILUSTRACIONES.filter(i => !uso || i.uso === uso);
  const ranking = candidatas
    .map(ilu => ({ ilu, puntos: puntuarIlustracion(ilu, ctx) }))
    .sort((a, b) => b.puntos - a.puntos);
  const buenas = ranking.filter(r => r.puntos > 2).slice(0, max).map(r => r.ilu);
  if (buenas.length) return buenas;
  const generales = candidatas.filter(i => i.areas.includes('general'));
  return (generales.length ? generales : candidatas).slice(0, max);
}

/** Para el prompt de la IA: «id (descripción)», separados por comas. */
export function listaIlustracionesParaIA(uso: UsoIlustracion, lang: Lang = 'es'): string {
  return ILUSTRACIONES.filter(i => i.uso === uso).map(i => `${i.id} (${i.descripcion[lang]})`).join(', ');
}
