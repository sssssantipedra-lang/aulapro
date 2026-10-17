/**
 * Comprensión lectora (17-10-2026): lo que se le pide a la IA para una ficha con un texto y sus actividades, y la
 * lectura fácil para dislexia. Dos llamadas, como lo haría un docente: primero el texto (con la longitud del curso
 * comprobada por el código y los dibujos elegidos de una lista cerrada del catálogo) y después las actividades, que
 * se escriben sobre el texto ya escrito, para que sus soluciones citen lo que el texto dice de verdad.
 *
 * `resources.ts` usa estas piezas en `generateFicha`; no se importa de vuelta (solo tipos) para no dar vueltas.
 */
import { callGemini, parseGeminiJson } from './gemini';
import type { Lang } from '../i18n';
import type { PerfilCurso, BloquePlan } from '../lib/escalera';
import {
  GENEROS_LECTURA, GENERO_PARA_IA, MEDIA_FRASE_FACIL, FRASE_MAX_FACIL, limpiarLectura, listaDibujosDeLectura, longitudDeLectura, medirTexto,
  textoNumerado, type ContextoLectura, type FichaLectura, type GeneroLectura,
} from '../lib/lectura';

const S = (d: string) => ({ type: 'STRING', description: d });
const idioma = (lang: Lang) => (lang === 'en' ? 'INGLÉS' : lang === 'ca' ? 'CATALÁN (català)' : 'ESPAÑOL');

/* ── Lectura fácil (dislexia) ── */

/** Las reglas de escritura de la lectura fácil, para el texto y para los enunciados. */
export function lecturaFacilPrompt(): string {
  return (
    `LECTURA FÁCIL (alumnado con dislexia o con dificultades lectoras): todo lo que lea el alumnado se escribe así.\n` +
    `- Frases CORTAS: de 6 a ${MEDIA_FRASE_FACIL} palabras de media y ninguna de más de ${FRASE_MAX_FACIL}. Una sola idea por frase.\n` +
    `- Orden natural (quién hace qué, dónde y cuándo), tiempos verbales sencillos, voz activa; sin metáforas, ironías, frases hechas, ` +
    `incisos largos ni dobles negaciones. Palabras frecuentes y concretas; si una palabra difícil es necesaria, explícala la primera vez entre paréntesis.\n` +
    `- Párrafos cortos, de 2 o 3 frases.\n` +
    `- PALABRAS CLAVE EN NEGRITA: marca con **doble asterisco** las palabras que más importan de cada frase (el personaje, el lugar, la ` +
    `acción, el dato): una o dos por frase como mucho y nunca más de tres palabras seguidas. Cierra siempre cada negrita («**dragón**»). ` +
    `Lo mismo en los enunciados: pon en negrita lo que hay que hacer («**Rodea** las palabras…») y lo que hay que buscar.\n` +
    `- Cada enunciado, una sola tarea. Como mucho 4 opciones, 5 afirmaciones o 5 elementos por ejercicio. Los ejercicios largos o con muchas partes, ` +
    `mejor partidos en dos.\n`
  );
}

/** Las «Instrucciones» de una ficha de lectura (no las escribe la IA: son siempre las mismas). */
export function instruccionesDeLectura(lang: Lang, facil: boolean): string {
  const textos: Record<Lang, [string, string]> = {
    es: ['Lee el texto con atención, dos veces si hace falta. Después, haz las actividades.', 'Lee el texto despacio. Después, haz las actividades.'],
    ca: ['Llegeix el text amb atenció, dues vegades si cal. Després, fes les activitats.', 'Llegeix el text a poc a poc. Després, fes les activitats.'],
    en: ['Read the text carefully, twice if you need to. Then do the activities.', 'Read the text slowly. Then do the activities.'],
  };
  return textos[lang][facil ? 1 : 0];
}

/* ── El texto ── */

const TEXTO_SCHEMA = (genero: GeneroLectura | 'auto') => ({
  type: 'OBJECT',
  properties: {
    titulo: S('Título del texto, breve y atractivo, sin número delante'),
    genero: {
      type: 'STRING', enum: genero === 'auto' ? [...GENEROS_LECTURA] : [genero],
      description: 'El tipo de texto: cuento, poema, noticia, informativo, descripcion, entrevista o instrucciones',
    },
    parrafos: {
      type: 'ARRAY', items: { type: 'STRING' },
      description: 'Los párrafos del texto, en orden. En un poema, cada elemento es una estrofa con sus versos separados por saltos de línea (\\n).',
    },
    dibujos: {
      type: 'ARRAY',
      description: 'Los dibujos del catálogo que ilustran el texto, cada uno junto al párrafo donde aparece lo que dibuja',
      items: {
        type: 'OBJECT',
        properties: {
          ilustracion: S('Identificador del dibujo, de la lista DIBUJOS, escrito exactamente igual'),
          parrafo: { type: 'INTEGER', description: 'Número del párrafo (1, 2, 3…) junto al que va el dibujo' },
        },
        required: ['ilustracion', 'parrafo'],
        propertyOrdering: ['ilustracion', 'parrafo'],
      },
    },
    pista: S('Lo que dice la mascota antes de leer: una frase corta que invita a fijarse en algo concreto del texto sin contar el final'),
    destrezas: {
      type: 'ARRAY', items: { type: 'STRING' },
      description: 'De 1 a 2 etiquetas muy cortas (de 1 a 3 palabras) con lo que se trabaja con este texto',
    },
  },
  required: ['titulo', 'genero', 'parrafos', 'dibujos', 'pista', 'destrezas'],
  propertyOrdering: ['titulo', 'genero', 'parrafos', 'dibujos', 'pista', 'destrezas'],
} as const);

function textoSistema(ctx: ContextoLectura, genero: GeneroLectura | 'auto', lang: Lang, base?: boolean): string {
  const long = longitudDeLectura(ctx.perfil, ctx.facil);
  return (
    `Eres un maestro o una maestra de Lengua con muchos años de experiencia y escribes textos ORIGINALES para trabajar la comprensión lectora ` +
    `con tu alumnado. ${base ? 'Reescribes un texto que ya existe, conservando a sus personajes, sus hechos y su orden.' : 'Inventas un texto nuevo; nunca copies ni imites un texto concreto de un libro.'} ` +
    `Que sea interesante para ese curso, con valores positivos, sin violencia ni nada que pueda herir.\n` +
    `TIPO DE TEXTO: ${genero === 'auto'
      ? `elige el que mejor encaje con el tema entre: ${GENEROS_LECTURA.map(g => `"${g}" (${GENERO_PARA_IA[g]})`).join('; ')}`
      : `"${genero}": ${GENERO_PARA_IA[genero]}`}.\n` +
    `LONGITUD: en prosa, entre ${long.palabras[0]} y ${long.palabras[1]} palabras repartidas en ${long.parrafos[0]} a ${long.parrafos[1]} párrafos; ` +
    `un poema, entre ${long.versos[0]} y ${long.versos[1]} versos en estrofas de 3 o 4 versos, con rima. Respeta el rango: el alumnado de este curso ` +
    `tiene que poder leerlo de una vez y con ganas.\n` +
    `VOCABULARIO: mete 3 o 4 palabras que el alumnado aún no use a menudo pero que se puedan deducir por el contexto (se trabajarán en las ` +
    `actividades); no las expliques en el texto.\n` +
    `DIBUJOS: el texto se ilustra con dibujos de un catálogo cerrado (lista DIBUJOS). Elige de 2 a ${long.dibujos} que representen de verdad lo que pasa ` +
    `en el texto (un personaje, un lugar, un objeto importante), cada uno junto al párrafo ("parrafo", empezando en 1) donde aparece. Un dibujo tiene que ser ` +
    `EXACTAMENTE lo que se nombra (un gato no es un tigre); no repitas dibujo ni pongas dos en el mismo párrafo. Lo mejor es escribir el texto ` +
    `con personajes, lugares y objetos que SÍ estén en la lista, para que los dibujos le den sentido (un dragón, una princesa, un detective, ` +
    `un cohete, un castillo…); es mejor cambiar al protagonista por uno que se pueda dibujar que dejar el texto sin dibujos.\n` +
    `PISTA: en "pista", una frase corta que diría una mascota antes de empezar a leer, para fijarse en algo concreto sin contar el final ` +
    `(«Fíjate en cómo se sienten los personajes», «Busca qué hace cada animal»).\n` +
    `DESTREZAS: en "destrezas", 1 o 2 etiquetas de 1 a 3 palabras con lo que se trabaja con este texto (Vocabulario, Orden de los hechos, ` +
    `Descripción de personajes, Causas y consecuencias, Rimas, Idea principal…).\n` +
    (ctx.facil ? lecturaFacilPrompt() : '') +
    `DIBUJOS (usa SOLO estos identificadores, escritos exactamente igual; lo que va tras los dos puntos es lo que se ve):\n${listaDibujosDeLectura(lang)}\n` +
    `El idioma de salida DEBE SER ${idioma(lang)}.`
  );
}

export interface TextoLectura {
  titulo: string;
  lectura: FichaLectura;
}

interface OpcionesTexto {
  onError?: (m: string) => void;
  genero?: GeneroLectura | 'auto';
  /** Un texto que se reescribe (para la lectura fácil de una ficha que ya existe). */
  base?: { titulo: string; lectura: FichaLectura };
}

/**
 * El texto de una ficha de lectura: lo escribe la IA y el código lo comprueba contra la longitud del curso (y, en
 * lectura fácil, contra la longitud de las frases y las negritas). Si no vale, se le pide otra vez una vez más,
 * diciéndole qué falla; si tampoco, se queda con el mejor intento (el docente lo edita). `null` si la IA no contesta.
 */
export async function generarTextoLectura(
  tema: string, ctx: ContextoLectura, lang: Lang, opts: OpcionesTexto = {},
): Promise<TextoLectura | null> {
  const genero = opts.genero ?? 'auto';
  const long = longitudDeLectura(ctx.perfil, ctx.facil);
  const system = textoSistema(ctx, genero, lang, !!opts.base);
  const pedido =
    `Tema: ${tema}\nÁrea o asignatura: ${ctx.area || '(no indicada)'}\nCurso o nivel: ${ctx.nivel || '(no indicado)'}\n` +
    (opts.base
      ? `\nTexto que hay que reescribir (título: ${opts.base.titulo}):\n${textoNumerado(opts.base.lectura)}\n\nReescribe este texto${ctx.facil ? ' en lectura fácil' : ''}, con sus mismos personajes y hechos.`
      : `\nEscribe el texto de comprensión lectora sobre este tema.`) +
    ` Entre ${long.palabras[0]} y ${long.palabras[1]} palabras.`;
  let prompt = pedido;
  let mejor: TextoLectura | null = null;
  for (let intento = 0; intento < 2; intento++) {
    const raw = await callGemini(system, prompt, [], { onError: intento === 0 ? opts.onError : undefined }, {
      maxOutputTokens: 8192,
      responseSchema: TEXTO_SCHEMA(genero),
      thinkingLevel: 'medium',
      temperature: 1.1,
    });
    // Un género elegido por el docente se respeta aunque la IA ponga otro
    const final = raw ? limpiarLectura(parseGeminiJson<unknown>(raw), genero !== 'auto' ? { ...ctx, genero } : ctx) : null;
    if (!final) { if (mejor) break; continue; }
    mejor = final;
    const medida = medirTexto(final.lectura, long, ctx.facil);
    if (!medida.problemas.length) break;
    prompt = `${pedido}\n\nTu intento anterior no vale: ${medida.problemas.join(' ')} Escríbelo de nuevo corrigiéndolo.`;
  }
  return mejor;
}

/* ── Las actividades ── */

/** Lo que se espera de cada peldaño de la escalera en una ficha de comprensión lectora. */
export const NIVELES_LECTURA: Record<1 | 2 | 3, string> = {
  1: 'BUSCA EN EL TEXTO (comprensión literal): localizar datos, personajes, lugares y hechos que el texto dice tal cual; rodear o subrayar en el texto, ' +
    'verdadero o falso, ordenar los hechos, completar con palabras del texto.',
  2: 'PIENSA (vocabulario e inferencia): el significado de las palabras por el contexto, sinónimos y antónimos, causas y consecuencias, cómo es un ' +
    'personaje y por qué actúa así, qué quiere decir una frase, relacionar, ficha de datos.',
  3: 'OPINA Y CREA (valoración y creatividad): opinar y justificar con el texto, cambiar el final, qué habría pasado si…, escribir un mensaje o una ' +
    'frase nueva, dibujar lo que se imagina.',
};

/** El reparto por bloques, dicho para el prompt de lectura. */
export function planLecturaParaPrompt(plan: BloquePlan[]): string {
  return plan.map((b, i) => `- Bloque ${i + 1}: nivel ${b.dificultad}, ${b.ejercicios} ejercicio${b.ejercicios === 1 ? '' : 's'}. ${NIVELES_LECTURA[b.dificultad]}`).join('\n');
}

export function actividadesSistema(lang: Lang, plan: BloquePlan[], perfil: PerfilCurso, facil: boolean, soloUno = false): string {
  return (
    `Eres un maestro o una maestra de Lengua con muchos años de experiencia. Creas las ACTIVIDADES de comprensión lectora de una ficha de trabajo: ` +
    `el texto ya está escrito (te lo doy en el mensaje, con sus párrafos numerados entre corchetes) y las actividades se hacen SOLO con ese texto, ` +
    `como las de un buen cuaderno de comprensión lectora. Las respuestas se escriben a mano en el papel.\n` +
    `ESTILO: consignas breves y directas que empiezan con un verbo en imperativo («Rodea en el texto…», «Subraya…», «Numera según el orden…», ` +
    `«Contesta.», «Marca…», «Completa…», «Dibuja…»). Las preguntas se contestan con lo que el texto dice o permite deducir; cita párrafos si ayuda ` +
    `(«en el párrafo 2»). Nada que dependa de saber algo que el texto no cuenta. Las soluciones citan las palabras o frases exactas del texto.\n` +
    `TIPOS DE EJERCICIO (varía entre bloques, usa al menos cuatro distintos):\n` +
    `- "en_texto": se hace sobre el propio texto impreso: rodear, subrayar o buscar palabras o frases («Rodea en el texto las palabras que usa el autor ` +
    `para referirse a la nave»). "lineasRespuesta": cuántas líneas se dejan para escribir lo que se ha buscado (0 si solo se marca en el texto; 1 o 2 si ` +
    `dice «Después, escríbelo»). La "solucion" dice qué hay que marcar, con las palabras exactas del texto.\n` +
    `- "contestar": "preguntas" (de 2 a 4 preguntas cortas, cada una con su línea para la respuesta); el "enunciado" es «Contesta.».\n` +
    `- "verdadero_falso": de 4 a 6 "afirmaciones" sobre el texto, unas verdaderas y otras falsas con un error concreto.\n` +
    `- "ordenar": de 4 a 6 hechos del texto en "elementos", EN SU ORDEN CORRECTO (la aplicación los desordena y el alumnado los numera). El enunciado: ` +
    `«Numera según el orden en que sucede en el texto.».\n` +
    `- "completar": frases con huecos ______ (al menos tres guiones bajos) que se rellenan con palabras del texto o con un recuadro de palabras ` +
    `("bancoPalabras": de 4 a 8 palabras, con alguna de más). Sirve para vocabulario: sustituir una palabra por otra de significado más preciso.\n` +
    `- "opcion_multiple": de 3 a 4 opciones, una sola correcta (qué quiere decir una palabra, de qué trata el texto, por qué hace algo un personaje).\n` +
    `- "relacionar": palabras del texto con su significado, o personajes con lo que hacen ("derecha" en orden distinto).\n` +
    `- "tabla_rellenar": una ficha de datos del texto (personaje, dónde vive, qué hace; con celdas "" para rellenar).\n` +
    `- "abierta": una frase o dos de respuesta libre (opinar, causas, un final distinto). "comic": quién dice qué, con algún bocadillo vacío (como mucho uno).\n` +
    `- "dibujar": el alumnado dibuja en un recuadro lo que se imagina del texto («Dibuja al protagonista tal como lo imaginas»); "lineasRespuesta" 0 o 1 ` +
    `para escribir su nombre o una frase debajo. Como mucho uno, normalmente en el último bloque.\n` +
    `- "crucigrama" y "sopa_letras": solo con vocabulario del texto, y como mucho uno de los dos.\n` +
    `NO uses "problema", "calculos", "colorear" ni dibujos del catálogo: esto es lectura, no matemáticas.\n` +
    (soloUno
      ? `Crea UN solo ejercicio, del nivel que se te indique. Lo que se espera en cada nivel:\n${([1, 2, 3] as const).map(d => `- Nivel ${d}: ${NIVELES_LECTURA[d]}`).join('\n')}\n`
      : `ESCALERA DE DIFICULTAD (obligatoria, de menos a más): cada bloque lleva su "dificultad" (1, 2 o 3) y su título dice qué se hace («Buscamos en el ` +
        `texto», «Pensamos», «Opinamos y creamos»), sin número delante ni «Nivel». Reparto:\n${planLecturaParaPrompt(plan)}\n`) +
    `${perfil.sube ? 'Este curso es de los más altos de Primaria: pide inferencias y vocabulario de nivel, no solo localizar datos.\n' : ''}` +
    (soloUno ? '' : `RECUADROS: el primer bloque lleva un "consejo" de estrategia lectora (una frase: «Lee las preguntas antes de volver al texto») y el último un ` +
      `"reto": una pregunta extra de respuesta corta que haga pensar. El del medio, ninguno.\n`) +
    `SOLUCIÓN: la "solucion" de cada ejercicio es para el profesorado y nunca se imprime: la respuesta correcta, con las palabras del texto.\n` +
    (facil ? lecturaFacilPrompt() : '') +
    `El idioma de salida DEBE SER ${idioma(lang)}.`
  );
}

/** Lo que se pide al final del mensaje de las actividades: el texto entero y el reparto. */
export function actividadesPedido(titulo: string, lectura: FichaLectura, plan: BloquePlan[], n: number): string {
  return (
    `Título del texto: ${titulo}\nTipo de texto: ${lectura.genero}\n` +
    `TEXTO (párrafos numerados${lectura.genero === 'poema' ? '; los versos de cada estrofa van separados por «/»' : ''}):\n${textoNumerado(lectura)}\n\n` +
    `Crea un total de EXACTAMENTE ${n} ejercicios sobre este texto, repartidos en EXACTAMENTE ${plan.length} bloques de menos a más dificultad ` +
    `(${plan.map(b => b.ejercicios).join(' + ')} ejercicios).`
  );
}
