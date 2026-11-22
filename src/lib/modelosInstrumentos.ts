/**
 * Rúbricas y escalas de registro modelo (20-11-2026): instrumentos ya escritos para empezar sin IA. En «Nueva
 * rúbrica» y en «Nueva escala de registro», «Desde un modelo» los enseña y «Usar y adaptar» abre el editor de
 * siempre relleno: el docente cambia lo que quiera antes de guardar.
 *
 * Son pocos y escritos a mano para AulaPro, con nuestras palabras. Normas de los textos:
 *   - Cada descriptor dice lo que se ve hacer (observable), sin sujeto y sin nombres de personas.
 *   - Los cuatro niveles de un criterio hablan de lo mismo y suben de verdad: el 3 es lo que se espera en el curso.
 *   - Castellano, catalán e inglés, en ese orden. Sin rayas largas.
 *   - Un criterio lleva variante de Primaria y de ESO solo donde cambia el nivel; lo demás es común.
 *   - Las competencias clave de cada criterio van marcadas (códigos LOMLOE), para que la rúbrica puntúe en ellas
 *     sin pasar por «Marcar con IA». Los criterios oficiales del currículo no: dependen del área y del curso.
 *
 * Los niveles son los cuatro de partida de la app (`defaultLevels`). Aquí no hay IA y nada sale del dispositivo.
 */

export type Lengua = 'es' | 'ca' | 'en';
/** Las dos etapas con variante propia. Una clase de otra etapa usa la de ESO. */
export type EtapaModelo = 'primaria' | 'eso';
/** Castellano, catalán e inglés. */
type T3 = readonly [es: string, ca: string, en: string];
/** Los descriptores de un criterio, del nivel 1 (el más bajo) al 4 (el más alto). */
type Niveles = readonly [T3, T3, T3, T3];
interface PorEtapa { primaria: Niveles; eso: Niveles }

type Clave = 'CCL' | 'CP' | 'STEM' | 'CD' | 'CPSAA' | 'CC' | 'CE' | 'CCEC';

export interface CriterioModelo {
  nombre: T3;
  competencias: readonly Clave[];
  niveles: Niveles | PorEtapa;
}

export interface ModeloRubrica {
  id: string;
  /** `ef`: pensada para Educación Física; se enseña en su propio grupo. */
  ambito: 'general' | 'ef';
  nombre: T3;
  /** Para qué sirve, en una línea. */
  uso: T3;
  criterios: readonly CriterioModelo[];
}

export interface ModeloEscala {
  id: string;
  ambito: 'general' | 'ef';
  nombre: T3;
  uso: T3;
  /** Lo que se valora con pulgar arriba o abajo: una conducta concreta que se ve o no se ve. */
  conceptos: readonly T3[];
}

const INDICE: Record<Lengua, 0 | 1 | 2> = { es: 0, ca: 1, en: 2 };
const en = (t: T3, lengua: Lengua): string => t[INDICE[lengua] ?? 0];
const esPorEtapa = (n: Niveles | PorEtapa): n is PorEtapa => !Array.isArray(n);

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   RÚBRICAS
══════════════════════════════════════════════════════════════════════════════════════════════ */

export const MODELOS_RUBRICA: readonly ModeloRubrica[] = [
  /* ── Exposición oral ── */
  {
    id: 'exposicion-oral', ambito: 'general',
    nombre: ['Exposición oral', 'Exposició oral', 'Oral presentation'],
    uso: [
      'Una exposición ante la clase, individual o en grupo, con o sin apoyo visual.',
      'Una exposició davant de la classe, individual o en grup, amb suport visual o sense.',
      'A talk in front of the class, alone or in a group, with or without visual support.',
    ],
    criterios: [
      {
        nombre: ['Contenido', 'Contingut', 'Content'], competencias: ['CCL'],
        niveles: {
          primaria: [
            ['Nombra el tema y da uno o dos datos sueltos, con ayuda.', "Anomena el tema i dona una o dues dades soltes, amb ajuda.", 'Names the topic and gives one or two isolated facts, with help.'],
            ['Cuenta las ideas principales, aunque alguna queda sin explicar.', "Explica les idees principals, tot i que alguna queda sense desenvolupar.", 'Tells the main ideas, though some are left unexplained.'],
            ['Explica las ideas principales con sus palabras y pone algún ejemplo.', "Explica les idees principals amb les seves paraules i posa algun exemple.", 'Explains the main ideas in their own words and gives an example.'],
            ['Explica todas las ideas con sus palabras, pone ejemplos propios y responde a las preguntas.', "Explica totes les idees amb les seves paraules, posa exemples propis i respon a les preguntes.", 'Explains every idea in their own words, gives their own examples and answers questions.'],
          ],
          eso: [
            ['Presenta datos sueltos, leídos o memorizados, sin relacionarlos.', "Presenta dades soltes, llegides o memoritzades, sense relacionar-les.", 'Presents isolated facts, read out or memorised, without linking them.'],
            ['Expone las ideas principales, con algún error o alguna laguna.', "Exposa les idees principals, amb algun error o alguna llacuna.", 'Covers the main ideas, with some errors or gaps.'],
            ['Expone las ideas principales con rigor y las apoya en ejemplos o datos.', "Exposa les idees principals amb rigor i les recolza en exemples o dades.", 'Covers the main ideas accurately and supports them with examples or data.'],
            ['Domina el tema: relaciona las ideas, cita sus fuentes y responde con acierto a las preguntas.', "Domina el tema: relaciona les idees, cita les fonts i respon amb encert a les preguntes.", 'Masters the topic: links the ideas, cites sources and answers questions well.'],
          ],
        },
      },
      {
        nombre: ['Orden de la exposición', "Ordre de l'exposició", 'Structure'], competencias: ['CCL', 'CPSAA'],
        niveles: {
          primaria: [
            ['Dice las ideas según le vienen, sin presentar el tema ni cerrarlo.', "Diu les idees tal com li venen, sense presentar el tema ni tancar-lo.", 'Says ideas as they come, without introducing or closing the topic.'],
            ['Presenta el tema, pero salta de una idea a otra o no lo cierra.', "Presenta el tema, però salta d'una idea a una altra o no el tanca.", 'Introduces the topic, but jumps between ideas or does not close it.'],
            ['Presenta el tema, sigue un orden y termina con un cierre.', "Presenta el tema, segueix un ordre i acaba amb un tancament.", 'Introduces the topic, follows an order and ends with a closing.'],
            ['Presenta el tema, avisa de las partes, las sigue y cierra resumiendo lo importante.', "Presenta el tema, avisa de les parts, les segueix i tanca resumint el més important.", 'Introduces the topic, announces the parts, follows them and closes by summing up the key points.'],
          ],
          eso: [
            ['Expone sin un orden reconocible, sin introducción ni conclusión.', "Exposa sense un ordre recognoscible, sense introducció ni conclusió.", 'Speaks with no recognisable order, without introduction or conclusion.'],
            ['Tiene introducción y desarrollo, pero el paso de una parte a otra es brusco o falta la conclusión.', "Té introducció i desenvolupament, però el pas d'una part a l'altra és brusc o hi falta la conclusió.", 'Has an introduction and a body, but moves abruptly between parts or lacks a conclusion.'],
            ['Sigue un guion claro, con introducción, desarrollo y conclusión, y respeta el tiempo.', "Segueix un guió clar, amb introducció, desenvolupament i conclusió, i respecta el temps.", 'Follows a clear outline, with introduction, body and conclusion, and keeps to time.'],
            ['Anuncia el guion, enlaza las partes con conectores, concluye con una idea propia y se ajusta al tiempo.', "Anuncia el guió, enllaça les parts amb connectors, conclou amb una idea pròpia i s'ajusta al temps.", 'Announces the outline, links the parts with connectors, concludes with an idea of their own and fits the time.'],
          ],
        },
      },
      {
        nombre: ['Voz y lenguaje', 'Veu i llenguatge', 'Voice and language'], competencias: ['CCL'],
        niveles: [
          ['Habla tan bajo o tan deprisa que cuesta seguir lo que dice, y lee casi todo.', "Parla tan baix o tan de pressa que costa seguir el que diu, i ho llegeix gairebé tot.", 'Speaks so quietly or so fast that it is hard to follow, and reads almost everything.'],
          ['Se le oye, aunque con muletillas o pausas largas, y lee a menudo.', "Se sent, tot i que amb falques o pauses llargues, i llegeix sovint.", 'Can be heard, though with fillers or long pauses, and often reads.'],
          ['Habla con volumen y ritmo adecuados y consulta sus notas solo de vez en cuando.', "Parla amb un volum i un ritme adequats i consulta les notes només de tant en tant.", 'Speaks at a suitable volume and pace and only glances at notes now and then.'],
          ['Habla con claridad, cambia la entonación para destacar lo importante y usa el vocabulario del tema sin leer.', "Parla amb claredat, canvia l'entonació per destacar el més important i fa servir el vocabulari del tema sense llegir.", 'Speaks clearly, varies intonation to stress what matters and uses the topic vocabulary without reading.'],
        ],
      },
      {
        nombre: ['Contacto con el público y apoyo visual', 'Contacte amb el públic i suport visual', 'Audience contact and visual support'], competencias: ['CCL', 'CD'],
        niveles: [
          ['Mira al papel o a la pantalla y no al grupo; el apoyo visual falta o no tiene que ver con lo que dice.', "Mira el paper o la pantalla i no el grup; el suport visual falta o no té a veure amb el que diu.", 'Looks at the paper or the screen, not the group; visual support is missing or unrelated to the talk.'],
          ['Mira al grupo de vez en cuando; el apoyo visual tiene mucho texto y lo lee.', "Mira el grup de tant en tant; el suport visual té molt de text i el llegeix.", 'Looks at the group now and then; the visual support is text-heavy and gets read out.'],
          ['Mira al grupo la mayor parte del tiempo y el apoyo visual acompaña lo que explica.', "Mira el grup la major part del temps i el suport visual acompanya el que explica.", 'Looks at the group most of the time and the visual support goes with what is explained.'],
          ['Mira a todo el grupo, se mueve con naturalidad y usa imágenes o esquemas para aclarar, sin leerlos.', "Mira tot el grup, es mou amb naturalitat i fa servir imatges o esquemes per aclarir, sense llegir-los.", 'Looks at the whole group, moves naturally and uses images or diagrams to clarify, without reading them.'],
        ],
      },
    ],
  },

  /* ── Expresión escrita ── */
  {
    id: 'expresion-escrita', ambito: 'general',
    nombre: ['Expresión escrita', 'Expressió escrita', 'Written composition'],
    uso: [
      'Un texto escrito por el alumnado: una narración, una descripción, una carta, una opinión.',
      "Un text escrit per l'alumnat: una narració, una descripció, una carta, una opinió.",
      'A text written by students: a story, a description, a letter, an opinion piece.',
    ],
    criterios: [
      {
        nombre: ['Contenido y adecuación a la tarea', 'Contingut i adequació a la tasca', 'Content and fit to the task'], competencias: ['CCL'],
        niveles: {
          primaria: [
            ['Escribe frases sueltas que apenas tienen que ver con lo que se pide.', "Escriu frases soltes que gairebé no tenen a veure amb el que es demana.", 'Writes isolated sentences that barely relate to the task.'],
            ['Escribe sobre el tema, aunque el texto queda corto o se desvía.', "Escriu sobre el tema, tot i que el text queda curt o es desvia.", 'Writes about the topic, though the text is short or drifts away.'],
            ['Escribe lo que se pide, con ideas suficientes y relacionadas con el tema.', "Escriu el que es demana, amb idees suficients i relacionades amb el tema.", 'Writes what is asked, with enough ideas, all related to the topic.'],
            ['Escribe lo que se pide con ideas propias y detalles que enriquecen el texto.', "Escriu el que es demana amb idees pròpies i detalls que enriqueixen el text.", 'Writes what is asked with ideas of their own and details that enrich the text.'],
          ],
          eso: [
            ['Escribe un texto que no responde a la tarea o no se ajusta al tipo de texto pedido.', "Escriu un text que no respon a la tasca o no s'ajusta al tipus de text demanat.", 'Writes a text that does not address the task or the text type requested.'],
            ['Responde a la tarea solo en parte y no siempre usa el registro adecuado.', "Respon a la tasca només en part i no sempre fa servir el registre adequat.", 'Addresses the task only in part and does not always use a suitable register.'],
            ['Responde a la tarea con ideas suficientes y un registro adecuado al tipo de texto y al destinatario.', "Respon a la tasca amb idees suficients i un registre adequat al tipus de text i al destinatari.", 'Addresses the task with enough ideas and a register suited to the text type and the reader.'],
            ['Desarrolla la tarea con ideas propias y bien argumentadas, y mantiene el registro en todo el texto.', "Desenvolupa la tasca amb idees pròpies i ben argumentades, i manté el registre en tot el text.", 'Develops the task with well-argued ideas of their own and keeps the register throughout.'],
          ],
        },
      },
      {
        nombre: ['Organización del texto', 'Organització del text', 'Organisation'], competencias: ['CCL'],
        niveles: {
          primaria: [
            ['Escribe las ideas seguidas, sin puntos ni párrafos.', "Escriu les idees seguides, sense punts ni paràgrafs.", 'Writes ideas one after another, with no full stops or paragraphs.'],
            ['Separa algunas ideas con puntos, pero cuesta seguir el orden.', "Separa algunes idees amb punts, però costa seguir-ne l'ordre.", 'Separates some ideas with full stops, but the order is hard to follow.'],
            ['Ordena el texto en principio, desarrollo y final, y separa los párrafos.', "Ordena el text en inici, desenvolupament i final, i separa els paràgrafs.", 'Orders the text into beginning, middle and end, and separates paragraphs.'],
            ['Ordena el texto en párrafos y une las ideas con conectores (primero, después, por eso).', "Ordena el text en paràgrafs i uneix les idees amb connectors (primer, després, per això).", 'Orders the text into paragraphs and links ideas with connectors (first, then, so).'],
          ],
          eso: [
            ['Presenta las ideas sin orden y sin separarlas en párrafos.', "Presenta les idees sense ordre i sense separar-les en paràgrafs.", 'Presents ideas in no order and without paragraphs.'],
            ['Separa el texto en párrafos, pero alguna idea se repite o está fuera de lugar.', "Separa el text en paràgrafs, però alguna idea es repeteix o està fora de lloc.", 'Splits the text into paragraphs, but some ideas are repeated or misplaced.'],
            ['Desarrolla una idea en cada párrafo y el texto avanza con un orden lógico.', "Desenvolupa una idea a cada paràgraf i el text avança amb un ordre lògic.", 'Develops one idea per paragraph and the text moves forward logically.'],
            ['Sigue la estructura propia del tipo de texto y enlaza los párrafos con conectores variados.', "Segueix l'estructura pròpia del tipus de text i enllaça els paràgrafs amb connectors variats.", 'Follows the structure of the text type and links paragraphs with varied connectors.'],
          ],
        },
      },
      {
        nombre: ['Vocabulario y construcción de las frases', 'Vocabulari i construcció de les frases', 'Vocabulary and sentences'], competencias: ['CCL'],
        niveles: {
          primaria: [
            ['Repite las mismas palabras y deja frases sin terminar.', "Repeteix les mateixes paraules i deixa frases sense acabar.", 'Repeats the same words and leaves sentences unfinished.'],
            ['Usa palabras sencillas y frases cortas, con algunas repeticiones.', "Fa servir paraules senzilles i frases curtes, amb algunes repeticions.", 'Uses simple words and short sentences, with some repetition.'],
            ['Usa palabras variadas y frases completas y bien construidas.', "Fa servir paraules variades i frases completes i ben construïdes.", 'Uses varied words and complete, well-built sentences.'],
            ['Usa palabras precisas, alguna aprendida en clase, y combina frases cortas y largas.', "Fa servir paraules precises, alguna apresa a classe, i combina frases curtes i llargues.", 'Uses precise words, some learnt in class, and mixes short and long sentences.'],
          ],
          eso: [
            ['Usa un vocabulario pobre y repetitivo, con frases incompletas o mal construidas.', "Fa servir un vocabulari pobre i repetitiu, amb frases incompletes o mal construïdes.", 'Uses poor, repetitive vocabulary, with incomplete or badly built sentences.'],
            ['Usa un vocabulario correcto pero básico, con frases simples que se parecen entre sí.', "Fa servir un vocabulari correcte però bàsic, amb frases simples que s'assemblen entre si.", 'Uses correct but basic vocabulary, with simple, similar sentences.'],
            ['Usa un vocabulario variado y adecuado al tema, con oraciones bien construidas.', "Fa servir un vocabulari variat i adequat al tema, amb oracions ben construïdes.", 'Uses varied vocabulary suited to the topic, with well-built sentences.'],
            ['Usa un vocabulario preciso, con términos propios del tema, y oraciones de estructura variada.', "Fa servir un vocabulari precís, amb termes propis del tema, i oracions d'estructura variada.", 'Uses precise vocabulary, with subject-specific terms, and varied sentence structures.'],
          ],
        },
      },
      {
        nombre: ['Ortografía y presentación', 'Ortografia i presentació', 'Spelling and presentation'], competencias: ['CCL'],
        niveles: {
          primaria: [
            ['Comete muchas faltas en palabras de uso frecuente y la letra cuesta de leer.', "Fa moltes faltes en paraules d'ús freqüent i la lletra costa de llegir.", 'Makes many mistakes in common words and the handwriting is hard to read.'],
            ['Comete algunas faltas en palabras trabajadas en clase y la presentación es mejorable.', "Fa algunes faltes en paraules treballades a classe i la presentació és millorable.", 'Makes some mistakes in words practised in class and the presentation could be better.'],
            ['Escribe bien las palabras trabajadas, usa el punto y la mayúscula y presenta el texto limpio.', "Escriu bé les paraules treballades, fa servir el punt i la majúscula i presenta el text net.", 'Spells practised words correctly, uses full stops and capitals, and hands in a clean text.'],
            ['Escribe casi sin faltas, usa bien los signos de puntuación y cuida márgenes, letra y limpieza.', "Escriu gairebé sense faltes, fa servir bé els signes de puntuació i té cura dels marges, la lletra i la netedat.", 'Writes almost without mistakes, punctuates well and takes care of margins, handwriting and neatness.'],
          ],
          eso: [
            ['Comete tantas faltas de ortografía y de puntuación que cuesta leer el texto.', "Fa tantes faltes d'ortografia i de puntuació que costa llegir el text.", 'Makes so many spelling and punctuation mistakes that the text is hard to read.'],
            ['Comete varias faltas (tildes, puntuación) que no impiden entender el texto.', "Fa diverses faltes (accents, puntuació) que no impedeixen entendre el text.", 'Makes several mistakes (accents, punctuation) that do not prevent understanding.'],
            ['Comete pocas faltas, puntúa bien y presenta el texto limpio y con márgenes.', "Fa poques faltes, puntua bé i presenta el text net i amb marges.", 'Makes few mistakes, punctuates well and hands in a clean text with margins.'],
            ['Escribe sin faltas, puntúa con intención y entrega el texto revisado y bien presentado.', "Escriu sense faltes, puntua amb intenció i lliura el text revisat i ben presentat.", 'Writes without mistakes, punctuates with purpose and hands in a revised, well-presented text.'],
          ],
        },
      },
    ],
  },

  /* ── Resolución de problemas ── */
  {
    id: 'resolucion-problemas', ambito: 'general',
    nombre: ['Resolución de problemas', 'Resolució de problemes', 'Problem solving'],
    uso: [
      'Un problema de Matemáticas o de ciencias, del enunciado a la comprobación.',
      "Un problema de Matemàtiques o de ciències, de l'enunciat a la comprovació.",
      'A maths or science problem, from the statement to the check.',
    ],
    criterios: [
      {
        nombre: ['Comprensión del problema', 'Comprensió del problema', 'Understanding the problem'], competencias: ['STEM', 'CCL'],
        niveles: {
          primaria: [
            ['Necesita ayuda para decir qué se pregunta.', "Necessita ajuda per dir què es pregunta.", 'Needs help to say what is being asked.'],
            ['Dice qué se pregunta, pero confunde u olvida algún dato.', "Diu què es pregunta, però confon o oblida alguna dada.", 'Says what is being asked, but mixes up or forgets a piece of data.'],
            ['Señala los datos y la pregunta, y explica el problema con sus palabras.', "Assenyala les dades i la pregunta, i explica el problema amb les seves paraules.", 'Points out the data and the question, and explains the problem in their own words.'],
            ['Explica el problema con sus palabras, aparta los datos que sobran y lo representa con un dibujo o un esquema.', "Explica el problema amb les seves paraules, aparta les dades que sobren i el representa amb un dibuix o un esquema.", 'Explains the problem in their own words, sets aside extra data and represents it with a drawing or diagram.'],
          ],
          eso: [
            ['Copia los datos sin distinguir lo que se pide.', "Copia les dades sense distingir què es demana.", 'Copies the data without identifying what is asked.'],
            ['Identifica lo que se pide, pero omite un dato o una condición.', "Identifica què es demana, però omet una dada o una condició.", 'Identifies what is asked, but leaves out a piece of data or a condition.'],
            ['Identifica datos, incógnita y condiciones, y los organiza en una tabla, un esquema o un dibujo.', "Identifica dades, incògnita i condicions, i les organitza en una taula, un esquema o un dibuix.", 'Identifies data, unknown and conditions, and organises them in a table, diagram or drawing.'],
            ['Reformula el problema, descarta los datos irrelevantes y anticipa de qué orden será el resultado.', "Reformula el problema, descarta les dades irrellevants i anticipa de quin ordre serà el resultat.", 'Restates the problem, discards irrelevant data and estimates the size of the result in advance.'],
          ],
        },
      },
      {
        nombre: ['Estrategia', 'Estratègia', 'Strategy'], competencias: ['STEM', 'CPSAA'],
        niveles: {
          primaria: [
            ['Opera con los números sin un plan o prueba al azar.', "Opera amb els nombres sense un pla o prova a l'atzar.", 'Operates on the numbers with no plan, or tries at random.'],
            ['Elige una operación adecuada, pero no sabe explicar por qué.', "Tria una operació adequada, però no sap explicar per què.", 'Chooses a suitable operation, but cannot explain why.'],
            ['Elige las operaciones adecuadas y sigue los pasos en orden.', "Tria les operacions adequades i segueix els passos en ordre.", 'Chooses the right operations and follows the steps in order.'],
            ['Elige una estrategia eficaz, la explica y, si no funciona, prueba otra.', "Tria una estratègia eficaç, l'explica i, si no funciona, en prova una altra.", 'Chooses an effective strategy, explains it and, if it fails, tries another.'],
          ],
          eso: [
            ['Trabaja sin una estrategia reconocible o con una que no lleva a la solución.', "Treballa sense una estratègia recognoscible o amb una que no porta a la solució.", 'Works with no recognisable strategy, or with one that does not lead to the solution.'],
            ['Plantea una estrategia válida, pero la deja a medias o la aplica solo en parte.', "Planteja una estratègia vàlida, però la deixa a mitges o l'aplica només en part.", 'Sets out a valid strategy, but leaves it unfinished or applies it only in part.'],
            ['Plantea una estrategia válida y la desarrolla paso a paso hasta el final.', "Planteja una estratègia vàlida i la desenvolupa pas a pas fins al final.", 'Sets out a valid strategy and carries it through step by step.'],
            ['Elige la estrategia más eficaz, justifica cada paso y es capaz de proponer otro camino.', "Tria l'estratègia més eficaç, justifica cada pas i és capaç de proposar un altre camí.", 'Chooses the most efficient strategy, justifies each step and can suggest another route.'],
          ],
        },
      },
      {
        nombre: ['Cálculo y procedimiento', 'Càlcul i procediment', 'Calculation and working'], competencias: ['STEM'],
        niveles: [
          ['Comete errores de cálculo en la mayoría de los pasos.', "Fa errors de càlcul en la majoria dels passos.", 'Makes calculation errors in most steps.'],
          ['Hace bien parte de los cálculos, con algún error que cambia el resultado.', "Fa bé part dels càlculs, amb algun error que canvia el resultat.", 'Gets part of the calculations right, with an error that changes the result.'],
          ['Calcula bien, con algún descuido menor que no cambia el resultado, e indica las unidades.', "Calcula bé, amb algun descuit menor que no canvia el resultat, i indica les unitats.", 'Calculates correctly, with a minor slip that does not change the result, and states the units.'],
          ['Calcula sin errores, deja escritos todos los pasos y usa las unidades correctas.', "Calcula sense errors, deixa escrits tots els passos i fa servir les unitats correctes.", 'Calculates without errors, shows every step and uses the correct units.'],
        ],
      },
      {
        nombre: ['Solución y comprobación', 'Solució i comprovació', 'Answer and checking'], competencias: ['STEM', 'CPSAA'],
        niveles: {
          primaria: [
            ['Da un número como resultado, sin decir a qué se refiere.', "Dona un nombre com a resultat, sense dir a què es refereix.", 'Gives a number as the result, without saying what it refers to.'],
            ['Escribe la respuesta con su unidad, pero no mira si tiene sentido.', "Escriu la resposta amb la unitat, però no mira si té sentit.", 'Writes the answer with its unit, but does not check whether it makes sense.'],
            ['Responde con una frase completa y repasa si el resultado tiene sentido.', "Respon amb una frase completa i repassa si el resultat té sentit.", 'Answers in a full sentence and checks that the result makes sense.'],
            ['Responde con una frase completa, comprueba el resultado por otro camino y explica cómo lo ha hecho.', "Respon amb una frase completa, comprova el resultat per un altre camí i explica com ho ha fet.", 'Answers in a full sentence, checks the result another way and explains how it was done.'],
          ],
          eso: [
            ['Deja el resultado sin interpretar o sin unidades.', "Deixa el resultat sense interpretar o sense unitats.", 'Leaves the result uninterpreted or without units.'],
            ['Expresa la solución con unidades, sin comprobar si es razonable.', "Expressa la solució amb unitats, sense comprovar si és raonable.", 'States the solution with units, without checking that it is reasonable.'],
            ['Redacta la solución en el contexto del problema y comprueba que es razonable.', "Redacta la solució en el context del problema i comprova que és raonable.", 'Writes the solution in the context of the problem and checks that it is reasonable.'],
            ['Interpreta la solución, la comprueba por otro método y valora si hay más soluciones.', "Interpreta la solució, la comprova per un altre mètode i valora si hi ha més solucions.", 'Interprets the solution, checks it by another method and considers whether there are other solutions.'],
          ],
        },
      },
    ],
  },

  /* ── Trabajo en equipo ── */
  {
    id: 'trabajo-en-equipo', ambito: 'general',
    nombre: ['Trabajo en equipo', 'Treball en equip', 'Teamwork'],
    uso: [
      'Cómo trabaja cada alumno dentro de su grupo, en cualquier área.',
      'Com treballa cada alumne dins del seu grup, en qualsevol àrea.',
      'How each student works within their group, in any subject.',
    ],
    criterios: [
      {
        nombre: ['Responsabilidad con su parte', 'Responsabilitat amb la seva part', 'Responsibility for their part'], competencias: ['CPSAA'],
        niveles: [
          ['Deja su parte sin hacer o la hace solo cuando se le insiste.', "Deixa la seva part sense fer o la fa només quan se li insisteix.", 'Leaves their part undone, or does it only when pressed.'],
          ['Hace su parte, aunque incompleta o fuera de plazo.', "Fa la seva part, tot i que incompleta o fora de termini.", 'Does their part, though incomplete or late.'],
          ['Hace su parte completa y la entrega al grupo a tiempo.', "Fa la seva part completa i la lliura al grup a temps.", 'Completes their part and gives it to the group on time.'],
          ['Hace su parte a tiempo, la revisa y ayuda a terminar la de otros si hace falta.', "Fa la seva part a temps, la revisa i ajuda a acabar la dels altres si cal.", "Does their part on time, checks it and helps finish others' parts if needed."],
        ],
      },
      {
        nombre: ['Participación y aportaciones', 'Participació i aportacions', 'Participation and contributions'], competencias: ['CPSAA', 'CE'],
        niveles: [
          ['Se queda al margen y espera a que decidan los demás.', "Es queda al marge i espera que decideixin els altres.", 'Stays on the sidelines and waits for others to decide.'],
          ['Aporta ideas cuando se le pregunta.', "Aporta idees quan se li pregunta.", 'Offers ideas when asked.'],
          ['Aporta ideas por iniciativa propia y las explica al grupo.', "Aporta idees per iniciativa pròpia i les explica al grup.", 'Offers ideas unprompted and explains them to the group.'],
          ['Aporta ideas, construye sobre las de los demás y anima a participar a quien no lo hace.', "Aporta idees, construeix sobre les dels altres i anima a participar qui no ho fa.", "Offers ideas, builds on others' and encourages those who are not taking part."],
        ],
      },
      {
        nombre: ['Escucha y respeto', 'Escolta i respecte', 'Listening and respect'], competencias: ['CC', 'CCL'],
        niveles: [
          ['Interrumpe o descarta las ideas de los demás sin escucharlas.', "Interromp o descarta les idees dels altres sense escoltar-les.", "Interrupts or dismisses others' ideas without listening."],
          ['Escucha, aunque a veces interrumpe o insiste en su idea.', "Escolta, tot i que de vegades interromp o insisteix en la seva idea.", 'Listens, though sometimes interrupts or insists on their own idea.'],
          ['Escucha sin interrumpir, respeta los turnos y acepta las decisiones del grupo.', "Escolta sense interrompre, respecta els torns i accepta les decisions del grup.", "Listens without interrupting, takes turns and accepts the group's decisions."],
          ['Escucha, pregunta para entender mejor y busca acuerdos cuando hay opiniones distintas.', "Escolta, pregunta per entendre millor i busca acords quan hi ha opinions diferents.", 'Listens, asks to understand better and looks for agreement when opinions differ.'],
        ],
      },
      {
        nombre: ['Organización y uso del tiempo', 'Organització i ús del temps', 'Organisation and use of time'], competencias: ['CPSAA', 'CE'],
        niveles: [
          ['Se distrae, distrae al grupo y no sabe qué le toca hacer.', "Es distreu, distreu el grup i no sap què li toca fer.", 'Gets distracted, distracts the group and does not know what to do.'],
          ['Sigue el plan del grupo si alguien se lo recuerda.', "Segueix el pla del grup si algú l'hi recorda.", "Follows the group's plan when reminded."],
          ['Cumple su papel, cuida el material y está pendiente del tiempo.', "Compleix el seu paper, té cura del material i està pendent del temps.", 'Fulfils their role, looks after the materials and keeps an eye on time.'],
          ['Ayuda a repartir las tareas, avisa del tiempo y propone cómo mejorar la próxima vez.', "Ajuda a repartir les tasques, avisa del temps i proposa com millorar la pròxima vegada.", 'Helps share out the tasks, keeps time and suggests how to improve next time.'],
        ],
      },
    ],
  },

  /* ── Cuaderno del alumno ── */
  {
    id: 'cuaderno', ambito: 'general',
    nombre: ['Cuaderno del alumno', "Quadern de l'alumne", "Student's notebook"],
    uso: [
      'La revisión del cuaderno de clase al final de una unidad o de un trimestre.',
      "La revisió del quadern de classe al final d'una unitat o d'un trimestre.",
      'Checking the class notebook at the end of a unit or a term.',
    ],
    criterios: [
      {
        nombre: ['Está completo', 'És complet', 'Completeness'], competencias: ['CPSAA'],
        niveles: [
          ['Le faltan la mayoría de las actividades y de los apuntes.', "Li falten la majoria de les activitats i dels apunts.", 'Is missing most activities and notes.'],
          ['Le faltan varias actividades o las tiene a medias.', "Li falten diverses activitats o les té a mitges.", 'Is missing several activities, or has them half done.'],
          ['Tiene casi todas las actividades y los apuntes, con la fecha y el título.', "Té gairebé totes les activitats i els apunts, amb la data i el títol.", 'Has almost all activities and notes, with date and title.'],
          ['Tiene todas las actividades y los apuntes, y ha completado lo de los días que faltó.', "Té totes les activitats i els apunts, i ha completat el dels dies que va faltar.", 'Has every activity and all the notes, and has caught up on the days missed.'],
        ],
      },
      {
        nombre: ['Orden y presentación', 'Ordre i presentació', 'Order and presentation'], competencias: ['CPSAA'],
        niveles: [
          ['Escribe sin orden, con hojas sueltas o saltadas, y cuesta leerlo.', "Escriu sense ordre, amb fulls solts o saltats, i costa de llegir.", 'Writes in no order, with loose or skipped pages, and it is hard to read.'],
          ['Sigue un orden, aunque faltan fechas o títulos y la letra o la limpieza son mejorables.', "Segueix un ordre, tot i que hi falten dates o títols i la lletra o la netedat són millorables.", 'Follows an order, though dates or titles are missing and handwriting or neatness could be better.'],
          ['Pone fecha y título, respeta los márgenes y la letra se lee bien.', "Posa data i títol, respecta els marges i la lletra es llegeix bé.", 'Writes date and title, keeps the margins and the handwriting is easy to read.'],
          ['Destaca títulos e ideas importantes, separa los apartados y todo se encuentra con facilidad.', "Destaca títols i idees importants, separa els apartats i tot es troba amb facilitat.", 'Highlights titles and key ideas, separates sections and everything is easy to find.'],
        ],
      },
      {
        nombre: ['Corrección de las actividades', 'Correcció de les activitats', 'Correcting the activities'], competencias: ['CPSAA'],
        niveles: [
          ['Deja las actividades sin corregir o borra lo que tenía mal.', "Deixa les activitats sense corregir o esborra el que tenia malament.", 'Leaves activities uncorrected, or rubs out what was wrong.'],
          ['Marca si está bien o mal, sin escribir la respuesta correcta.', "Marca si està bé o malament, sense escriure la resposta correcta.", 'Marks right or wrong, without writing the correct answer.'],
          ['Corrige con otro color y escribe la respuesta correcta.', "Corregeix amb un altre color i escriu la resposta correcta.", 'Corrects in another colour and writes the correct answer.'],
          ['Corrige, escribe la respuesta correcta y anota en qué se había equivocado.', "Corregeix, escriu la resposta correcta i anota en què s'havia equivocat.", 'Corrects, writes the correct answer and notes what the mistake was.'],
        ],
      },
      {
        nombre: ['Apuntes y trabajo propio', 'Apunts i treball propi', 'Notes and own work'], competencias: ['CCL', 'CPSAA'],
        niveles: [
          ['Copia de la pizarra de forma incompleta.', "Copia de la pissarra de manera incompleta.", 'Copies from the board incompletely.'],
          ['Copia lo de la pizarra tal cual, sin añadir nada.', "Copia el de la pissarra tal qual, sense afegir-hi res.", 'Copies what is on the board as it is, adding nothing.'],
          ['Copia lo importante y añade esquemas, dibujos o ejemplos cuando se le pide.', "Copia el que és important i hi afegeix esquemes, dibuixos o exemples quan se li demana.", 'Copies what matters and adds diagrams, drawings or examples when asked.'],
          ['Resume con sus palabras, hace esquemas por iniciativa propia y anota sus dudas.', "Resumeix amb les seves paraules, fa esquemes per iniciativa pròpia i anota els dubtes.", 'Summarises in their own words, makes diagrams unprompted and notes down questions.'],
        ],
      },
    ],
  },

  /* ── Lectura en voz alta ── */
  {
    id: 'lectura-voz-alta', ambito: 'general',
    nombre: ['Lectura en voz alta', 'Lectura en veu alta', 'Reading aloud'],
    uso: [
      'La lectura de un texto ante el docente o ante la clase.',
      "La lectura d'un text davant del docent o davant de la classe.",
      'Reading a text to the teacher or to the class.',
    ],
    criterios: [
      {
        nombre: ['Exactitud', 'Exactitud', 'Accuracy'], competencias: ['CCL'],
        niveles: [
          ['Lee sílaba a sílaba y cambia u omite muchas palabras.', "Llegeix síl·laba a síl·laba i canvia o omet moltes paraules.", 'Reads syllable by syllable and changes or skips many words.'],
          ['Lee palabra a palabra y se equivoca en las largas o poco conocidas.', "Llegeix paraula a paraula i s'equivoca en les llargues o poc conegudes.", 'Reads word by word and stumbles on long or unfamiliar ones.'],
          ['Lee las palabras correctamente, con algún error que corrige al momento.', "Llegeix les paraules correctament, amb algun error que corregeix al moment.", 'Reads the words correctly, with an occasional error corrected straight away.'],
          ['Lee todas las palabras correctamente, también las largas o nuevas.', "Llegeix totes les paraules correctament, també les llargues o noves.", 'Reads every word correctly, including long or new ones.'],
        ],
      },
      {
        nombre: ['Fluidez y ritmo', 'Fluïdesa i ritme', 'Fluency and pace'], competencias: ['CCL'],
        niveles: [
          ['Se detiene a menudo y vuelve atrás, y cuesta seguir la lectura.', "S'atura sovint i torna enrere, i costa seguir la lectura.", 'Stops often and goes back, and the reading is hard to follow.'],
          ['Lee despacio, con pausas donde no tocan.', "Llegeix a poc a poc, amb pauses on no toquen.", 'Reads slowly, with pauses in the wrong places.'],
          ['Lee con un ritmo constante, agrupando las palabras con sentido.', "Llegeix amb un ritme constant, agrupant les paraules amb sentit.", 'Reads at a steady pace, grouping words meaningfully.'],
          ['Lee con soltura y adapta el ritmo a lo que cuenta el texto.', "Llegeix amb desimboltura i adapta el ritme al que explica el text.", 'Reads with ease and adapts the pace to what the text is telling.'],
        ],
      },
      {
        nombre: ['Pausas y entonación', 'Pauses i entonació', 'Pauses and intonation'], competencias: ['CCL'],
        niveles: [
          ['Lee todo seguido, sin respetar puntos ni comas, con un tono plano.', "Ho llegeix tot seguit, sense respectar punts ni comes, amb un to pla.", 'Reads straight through, ignoring full stops and commas, in a flat tone.'],
          ['Hace la pausa en los puntos, pero no en las comas, y apenas cambia el tono.', "Fa la pausa als punts, però no a les comes, i gairebé no canvia el to.", 'Pauses at full stops but not at commas, and barely changes tone.'],
          ['Respeta puntos y comas y entona las preguntas y las exclamaciones.', "Respecta punts i comes i entona les preguntes i les exclamacions.", 'Respects full stops and commas and gives questions and exclamations their intonation.'],
          ['Da a cada frase su entonación y cambia la voz en los diálogos o para dar emoción.', "Dona a cada frase la seva entonació i canvia la veu en els diàlegs o per donar emoció.", 'Gives each sentence its intonation and changes voice in dialogue or to add feeling.'],
        ],
      },
      {
        nombre: ['Voz y comprensión', 'Veu i comprensió', 'Voice and understanding'], competencias: ['CCL', 'CPSAA'],
        niveles: [
          ['Lee tan bajo que apenas se oye y no sabe decir de qué trata lo leído.', "Llegeix tan baix que gairebé no se sent i no sap dir de què tracta el que ha llegit.", 'Reads so quietly it can barely be heard and cannot say what the text is about.'],
          ['Se le oye desde cerca y recuerda algún detalle del texto.', "Se sent des de prop i recorda algun detall del text.", 'Can be heard from nearby and remembers a detail of the text.'],
          ['Se le oye en toda la clase y cuenta de qué trata lo que ha leído.', "Se sent a tota la classe i explica de què tracta el que ha llegit.", 'Can be heard across the room and tells what the text is about.'],
          ['Proyecta la voz, vocaliza y cuenta lo leído con sus palabras, con los detalles importantes.', "Projecta la veu, vocalitza i explica el que ha llegit amb les seves paraules, amb els detalls importants.", 'Projects the voice, articulates and retells the text in their own words, with the key details.'],
        ],
      },
    ],
  },

  /* ── Proyecto ── */
  {
    id: 'proyecto', ambito: 'general',
    nombre: ['Proyecto', 'Projecte', 'Project'],
    uso: [
      'Un proyecto de varios días o semanas: el proceso, el producto y lo aprendido.',
      'Un projecte de diversos dies o setmanes: el procés, el producte i el que s\'ha après.',
      'A project lasting days or weeks: the process, the product and what was learnt.',
    ],
    criterios: [
      {
        nombre: ['Planificación', 'Planificació', 'Planning'], competencias: ['CPSAA', 'CE'],
        niveles: [
          ['Empieza sin un plan y deja el trabajo para el final.', "Comença sense un pla i deixa la feina per al final.", 'Starts with no plan and leaves the work until the end.'],
          ['Sigue el plan que se le da, con retrasos en alguna entrega.', "Segueix el pla que se li dona, amb retards en algun lliurament.", 'Follows the plan given, with some late hand-ins.'],
          ['Reparte el trabajo en pasos, anota lo que va haciendo y cumple los plazos.', "Reparteix la feina en passos, anota el que va fent i compleix els terminis.", 'Breaks the work into steps, logs progress and meets deadlines.'],
          ['Hace su propio plan con fechas, lo revisa a mitad del proyecto y lo ajusta si hace falta.', "Fa el seu propi pla amb dates, el revisa a mig projecte i l'ajusta si cal.", 'Makes their own dated plan, reviews it halfway and adjusts it if needed.'],
        ],
      },
      {
        nombre: ['Búsqueda y uso de la información', 'Cerca i ús de la informació', 'Finding and using information'], competencias: ['CD', 'CCL'],
        niveles: {
          primaria: [
            ['Copia la información de una sola fuente, tal como la encuentra.', "Copia la informació d'una sola font, tal com la troba.", 'Copies information from a single source, just as found.'],
            ['Busca en una o dos fuentes que se le dan y copia lo que le parece importante.', "Cerca en una o dues fonts que se li donen i copia el que li sembla important.", 'Looks in one or two given sources and copies what seems important.'],
            ['Busca en varias fuentes, elige lo que sirve y lo cuenta con sus palabras.', "Cerca en diverses fonts, tria el que serveix i ho explica amb les seves paraules.", 'Looks in several sources, picks what is useful and tells it in their own words.'],
            ['Compara lo que dicen varias fuentes, lo cuenta con sus palabras y dice de dónde lo ha sacado.', "Compara el que diuen diverses fonts, ho explica amb les seves paraules i diu d'on ho ha tret.", 'Compares what several sources say, tells it in their own words and says where it came from.'],
          ],
          eso: [
            ['Copia y pega de una sola fuente, sin citarla.', "Copia i enganxa d'una sola font, sense citar-la.", 'Copies and pastes from a single source, without citing it.'],
            ['Usa pocas fuentes, sin comprobar si son fiables, y las cita de forma incompleta.', "Fa servir poques fonts, sense comprovar si són fiables, i les cita de manera incompleta.", 'Uses few sources, without checking their reliability, and cites them incompletely.'],
            ['Selecciona información de varias fuentes fiables, la reelabora y las cita.', "Selecciona informació de diverses fonts fiables, la reelabora i les cita.", 'Selects information from several reliable sources, rewrites it and cites them.'],
            ['Contrasta fuentes de distinto tipo, valora su fiabilidad, reelabora la información y cita con un formato coherente.', "Contrasta fonts de tipus diferent, en valora la fiabilitat, reelabora la informació i cita amb un format coherent.", 'Cross-checks different kinds of sources, judges their reliability, rewrites the information and cites consistently.'],
          ],
        },
      },
      {
        nombre: ['Producto final', 'Producte final', 'Final product'], competencias: ['CE', 'CCEC'],
        niveles: {
          primaria: [
            ['Entrega el producto sin terminar o no responde a lo que se pedía.', "Lliura el producte sense acabar o no respon al que es demanava.", 'Hands in an unfinished product, or one that does not match what was asked.'],
            ['Entrega el producto terminado, aunque falta alguna parte de lo pedido.', "Lliura el producte acabat, tot i que hi falta alguna part del que es demanava.", 'Hands in a finished product, though part of what was asked is missing.'],
            ['Entrega un producto completo, cuidado y que responde a lo pedido.', "Lliura un producte complet, acurat i que respon al que es demanava.", 'Hands in a complete, careful product that matches what was asked.'],
            ['Entrega un producto completo y cuidado, con ideas propias que lo hacen original.', "Lliura un producte complet i acurat, amb idees pròpies que el fan original.", 'Hands in a complete, careful product, with ideas of their own that make it original.'],
          ],
          eso: [
            ['Entrega un producto incompleto o que no responde al reto planteado.', "Lliura un producte incomplet o que no respon al repte plantejat.", 'Hands in an incomplete product, or one that does not meet the challenge.'],
            ['Entrega un producto que responde al reto solo en parte o con un acabado descuidado.', "Lliura un producte que respon al repte només en part o amb un acabat descurat.", 'Hands in a product that meets the challenge only in part, or with a careless finish.'],
            ['Entrega un producto completo y bien acabado, que responde al reto.', "Lliura un producte complet i ben acabat, que respon al repte.", 'Hands in a complete, well-finished product that meets the challenge.'],
            ['Entrega un producto que responde al reto con una solución original, bien acabada y justificada.', "Lliura un producte que respon al repte amb una solució original, ben acabada i justificada.", 'Hands in a product that meets the challenge with an original, well-finished and justified solution.'],
          ],
        },
      },
      {
        nombre: ['Presentación y reflexión', 'Presentació i reflexió', 'Presentation and reflection'], competencias: ['CCL', 'CPSAA'],
        niveles: [
          ['Enseña el producto sin explicar cómo lo ha hecho.', "Ensenya el producte sense explicar com l'ha fet.", 'Shows the product without explaining how it was made.'],
          ['Explica qué ha hecho, pero no lo que ha aprendido.', "Explica què ha fet, però no el que ha après.", 'Explains what was done, but not what was learnt.'],
          ['Explica qué ha hecho, cómo lo ha hecho y qué ha aprendido.', "Explica què ha fet, com ho ha fet i què ha après.", 'Explains what was done, how, and what was learnt.'],
          ['Explica el proceso, lo aprendido, las dificultades que tuvo y qué cambiaría otra vez.', "Explica el procés, el que ha après, les dificultats que va tenir i què canviaria una altra vegada.", 'Explains the process, what was learnt, the difficulties met and what they would change next time.'],
        ],
      },
    ],
  },

  /* ── Práctica de laboratorio ── */
  {
    id: 'practica-laboratorio', ambito: 'general',
    nombre: ['Práctica de laboratorio', 'Pràctica de laboratori', 'Lab practical'],
    uso: [
      'Una práctica de laboratorio o un experimento en el aula, de la preparación al informe.',
      "Una pràctica de laboratori o un experiment a l'aula, de la preparació a l'informe.",
      'A lab practical or a classroom experiment, from the set-up to the report.',
    ],
    criterios: [
      {
        nombre: ['Preparación y seguridad', 'Preparació i seguretat', 'Set-up and safety'], competencias: ['STEM', 'CPSAA'],
        niveles: [
          ['Empieza sin leer el guion y hay que recordarle las normas de seguridad.', "Comença sense llegir el guió i cal recordar-li les normes de seguretat.", 'Starts without reading the instructions and has to be reminded of the safety rules.'],
          ['Lee el guion, pero necesita que se le recuerde alguna norma o el material.', "Llegeix el guió, però necessita que se li recordi alguna norma o el material.", 'Reads the instructions, but needs a reminder about a rule or the equipment.'],
          ['Prepara el material, sigue el guion y cumple las normas de seguridad.', "Prepara el material, segueix el guió i compleix les normes de seguretat.", 'Sets out the equipment, follows the instructions and keeps the safety rules.'],
          ['Prepara su puesto con autonomía, prevé los riesgos, cumple las normas y lo deja todo limpio y recogido.', "Prepara el seu lloc amb autonomia, preveu els riscos, compleix les normes i ho deixa tot net i recollit.", 'Sets up the workstation independently, anticipates risks, keeps the rules and leaves everything clean and tidy.'],
        ],
      },
      {
        nombre: ['Realización y toma de datos', 'Realització i presa de dades', 'Procedure and data collection'], competencias: ['STEM'],
        niveles: {
          primaria: [
            ['Hace los pasos sin orden y no anota lo que ocurre.', "Fa els passos sense ordre i no anota el que passa.", 'Does the steps out of order and does not record what happens.'],
            ['Sigue los pasos con ayuda y anota algunas observaciones.', "Segueix els passos amb ajuda i anota algunes observacions.", 'Follows the steps with help and records some observations.'],
            ['Sigue los pasos en orden y anota lo que observa y lo que mide.', "Segueix els passos en ordre i anota el que observa i el que mesura.", 'Follows the steps in order and records what is observed and measured.'],
            ['Sigue los pasos con cuidado, repite la medida si duda y lo anota todo con sus unidades.', "Segueix els passos amb cura, repeteix la mesura si dubta i ho anota tot amb les unitats.", 'Follows the steps carefully, repeats a measurement when unsure and records everything with units.'],
          ],
          eso: [
            ['Manipula el material sin cuidado y toma los datos incompletos o sin unidades.', "Manipula el material sense cura i pren les dades incompletes o sense unitats.", 'Handles the equipment carelessly and collects incomplete data or data without units.'],
            ['Sigue el procedimiento con ayuda y recoge los datos, con algún error de medida o de unidades.', "Segueix el procediment amb ajuda i recull les dades, amb algun error de mesura o d'unitats.", 'Follows the procedure with help and collects the data, with some measurement or unit errors.'],
            ['Sigue el procedimiento, usa bien los instrumentos y recoge los datos en una tabla con sus unidades.', "Segueix el procediment, fa servir bé els instruments i recull les dades en una taula amb les unitats.", 'Follows the procedure, uses the instruments properly and records the data in a table with units.'],
            ['Trabaja con precisión, repite las medidas para reducir el error y organiza los datos en tablas claras.', "Treballa amb precisió, repeteix les mesures per reduir l'error i organitza les dades en taules clares.", 'Works precisely, repeats measurements to reduce error and organises the data in clear tables.'],
          ],
        },
      },
      {
        nombre: ['Resultados y conclusiones', 'Resultats i conclusions', 'Results and conclusions'], competencias: ['STEM', 'CCL'],
        niveles: {
          primaria: [
            ['Cuenta lo que ha hecho, sin decir qué ha pasado.', "Explica el que ha fet, sense dir què ha passat.", 'Tells what was done, without saying what happened.'],
            ['Describe lo que ha pasado, sin explicar por qué.', "Descriu el que ha passat, sense explicar per què.", 'Describes what happened, without explaining why.'],
            ['Describe lo que ha pasado y lo explica con lo aprendido en clase.', "Descriu el que ha passat i ho explica amb el que ha après a classe.", 'Describes what happened and explains it using what was learnt in class.'],
            ['Explica lo que ha pasado, lo compara con lo que esperaba y propone otra prueba.', "Explica el que ha passat, ho compara amb el que esperava i proposa una altra prova.", 'Explains what happened, compares it with the prediction and suggests another test.'],
          ],
          eso: [
            ['Presenta los datos sin tratarlos y sin conclusión.', "Presenta les dades sense tractar-les i sense conclusió.", 'Presents raw data with no processing and no conclusion.'],
            ['Hace los cálculos o la gráfica, pero la conclusión no se apoya en los datos.', "Fa els càlculs o la gràfica, però la conclusió no es recolza en les dades.", 'Does the calculations or the graph, but the conclusion is not based on the data.'],
            ['Trata los datos con cálculos y gráficas y saca una conclusión coherente con ellos y con la hipótesis.', "Tracta les dades amb càlculs i gràfiques i treu una conclusió coherent amb elles i amb la hipòtesi.", 'Processes the data with calculations and graphs and draws a conclusion consistent with them and the hypothesis.'],
            ['Interpreta los resultados, analiza las fuentes de error y propone mejoras en el experimento.', "Interpreta els resultats, analitza les fonts d'error i proposa millores en l'experiment.", 'Interprets the results, analyses sources of error and suggests improvements to the experiment.'],
          ],
        },
      },
      {
        nombre: ['Informe', 'Informe', 'Report'], competencias: ['CCL', 'STEM'],
        niveles: [
          ['Entrega el informe incompleto o desordenado.', "Lliura l'informe incomplet o desordenat.", 'Hands in an incomplete or disorganised report.'],
          ['Entrega el informe con los apartados principales, aunque alguno queda sin desarrollar.', "Lliura l'informe amb els apartats principals, tot i que algun queda sense desenvolupar.", 'Hands in a report with the main sections, though some are left undeveloped.'],
          ['Entrega el informe con todos los apartados, bien redactado y con dibujos o esquemas rotulados.', "Lliura l'informe amb tots els apartats, ben redactat i amb dibuixos o esquemes retolats.", 'Hands in a report with every section, well written and with labelled drawings or diagrams.'],
          ['Entrega un informe completo, con vocabulario científico preciso y con tablas, gráficas y esquemas bien rotulados.', "Lliura un informe complet, amb vocabulari científic precís i amb taules, gràfiques i esquemes ben retolats.", 'Hands in a complete report, with precise scientific vocabulary and well-labelled tables, graphs and diagrams.'],
        ],
      },
    ],
  },

  /* ── Educación Física: juego colectivo ── */
  {
    id: 'ef-juego-colectivo', ambito: 'ef',
    nombre: ['Juego colectivo', 'Joc col·lectiu', 'Team game'],
    uso: [
      'Un juego o un deporte de equipo con balón: lo que hace cada alumno en situación de juego.',
      "Un joc o un esport d'equip amb pilota: el que fa cada alumne en situació de joc.",
      'A team game or sport with a ball: what each student does in game play.',
    ],
    criterios: [
      {
        nombre: ['Juego sin balón y ocupación del espacio', "Joc sense pilota i ocupació de l'espai", 'Off-the-ball play and use of space'], competencias: ['CPSAA'],
        niveles: {
          primaria: [
            ['Se queda sin moverse o lejos de la jugada.', "Es queda sense moure's o lluny de la jugada.", 'Stands still or stays far from the play.'],
            ['Sigue el balón junto a los demás, sin buscar un espacio libre.', "Segueix la pilota amb els altres, sense buscar un espai lliure.", 'Follows the ball along with everyone else, without looking for free space.'],
            ['Se mueve hacia espacios libres para recibir y vuelve a defender.', "Es mou cap a espais lliures per rebre i torna a defensar.", 'Moves into free space to receive and gets back to defend.'],
            ['Se desmarca, ofrece ayuda a quien lleva el balón y ocupa el sitio que deja un compañero.', "Es desmarca, ofereix ajuda a qui porta la pilota i ocupa el lloc que deixa un company.", 'Gets free, supports the ball carrier and fills the space a teammate leaves.'],
          ],
          eso: [
            ['Permanece sin moverse o fuera de su zona, sin intervenir en el juego.', "Es queda sense moure's o fora de la seva zona, sense intervenir en el joc.", 'Stays still or out of position, taking no part in the game.'],
            ['Se mueve hacia el balón sin tener en cuenta a compañeros ni adversarios.', "Es mou cap a la pilota sense tenir en compte companys ni adversaris.", 'Moves towards the ball without regard for teammates or opponents.'],
            ['Se desmarca para recibir, ocupa los espacios libres y se repliega al perder el balón.', "Es desmarca per rebre, ocupa els espais lliures i es replega en perdre la pilota.", 'Gets free to receive, fills open spaces and drops back when the ball is lost.'],
            ['Lee el juego: crea espacios para los demás, se anticipa en defensa y se coloca según lo acordado por el equipo.', "Llegeix el joc: crea espais per als altres, s'anticipa en defensa i es col·loca segons el que ha acordat l'equip.", 'Reads the game: creates space for others, anticipates in defence and positions as the team agreed.'],
          ],
        },
      },
      {
        nombre: ['Decisiones con el balón', 'Decisions amb la pilota', 'Decisions on the ball'], competencias: ['CPSAA', 'CE'],
        niveles: {
          primaria: [
            ['Suelta el balón enseguida o lo retiene hasta perderlo.', "Deixa anar la pilota de seguida o la reté fins que la perd.", 'Gets rid of the ball at once, or holds it until it is lost.'],
            ['Pasa a quien tiene más cerca, esté libre o no.', "Passa a qui té més a prop, estigui lliure o no.", 'Passes to whoever is nearest, free or not.'],
            ['Mira antes de actuar y pasa a quien está libre o avanza si tiene espacio.', "Mira abans d'actuar i passa a qui està lliure o avança si té espai.", 'Looks before acting and passes to a free player, or moves forward if there is space.'],
            ['Elige casi siempre bien entre pasar, avanzar o lanzar, y lo hace a tiempo.', "Tria gairebé sempre bé entre passar, avançar o llançar, i ho fa a temps.", 'Nearly always chooses well between passing, moving forward or shooting, and does it in time.'],
          ],
          eso: [
            ['Actúa sin mirar: pierde el balón o lanza sin opción.', "Actua sense mirar: perd la pilota o llança sense opció.", 'Acts without looking: loses the ball or shoots with no chance.'],
            ['Decide tarde o repite siempre la misma acción.', "Decideix tard o repeteix sempre la mateixa acció.", 'Decides late, or always repeats the same action.'],
            ['Elige entre pasar, progresar o lanzar según la posición de compañeros y adversarios.', "Tria entre passar, progressar o llançar segons la posició de companys i adversaris.", 'Chooses between passing, advancing or shooting according to where teammates and opponents are.'],
            ['Decide rápido y con acierto, también bajo presión, y varía sus acciones para sorprender.', "Decideix ràpid i amb encert, també sota pressió, i varia les accions per sorprendre.", 'Decides quickly and well, even under pressure, and varies actions to surprise.'],
          ],
        },
      },
      {
        nombre: ['Técnica: pases, recepciones y lanzamientos', 'Tècnica: passades, recepcions i llançaments', 'Technique: passing, receiving and shooting'], competencias: ['CPSAA'],
        niveles: [
          ['Pierde el control del balón en la mayoría de las acciones.', "Perd el control de la pilota en la majoria de les accions.", 'Loses control of the ball in most actions.'],
          ['Controla el balón en parado o sin oposición.', "Controla la pilota en parat o sense oposició.", 'Controls the ball when standing still or unopposed.'],
          ['Pasa, recibe y lanza con control en situación de juego.', "Passa, rep i llança amb control en situació de joc.", 'Passes, receives and shoots with control in game play.'],
          ['Pasa, recibe y lanza con precisión, en movimiento y con oposición.', "Passa, rep i llança amb precisió, en moviment i amb oposició.", 'Passes, receives and shoots accurately, on the move and under opposition.'],
        ],
      },
      {
        nombre: ['Juego limpio y cooperación', 'Joc net i cooperació', 'Fair play and cooperation'], competencias: ['CC', 'CPSAA'],
        niveles: [
          ['Discute las decisiones o deja de jugar cuando pierde.', "Discuteix les decisions o deixa de jugar quan perd.", 'Argues with decisions, or stops playing when losing.'],
          ['Acepta las reglas si se le recuerdan y protesta alguna decisión.', "Accepta les regles si se li recorden i protesta alguna decisió.", 'Accepts the rules when reminded and protests the odd decision.'],
          ['Respeta las reglas, al adversario y a quien arbitra, gane o pierda.', "Respecta les regles, l'adversari i qui arbitra, guanyi o perdi.", 'Respects the rules, the opponents and the referee, win or lose.'],
          ['Respeta las reglas, reconoce sus faltas, anima a su equipo y felicita al adversario.', "Respecta les regles, reconeix les seves faltes, anima el seu equip i felicita l'adversari.", 'Respects the rules, owns up to fouls, encourages the team and congratulates the opponents.'],
        ],
      },
    ],
  },

  /* ── Educación Física: expresión corporal ── */
  {
    id: 'ef-expresion-corporal', ambito: 'ef',
    nombre: ['Expresión corporal', 'Expressió corporal', 'Movement and expression'],
    uso: [
      'Una sesión o una composición de expresión corporal, danza o dramatización.',
      "Una sessió o una composició d'expressió corporal, dansa o dramatització.",
      'A lesson or a group piece of expressive movement, dance or drama.',
    ],
    criterios: [
      {
        nombre: ['Desinhibición y participación', 'Desinhibició i participació', 'Confidence and participation'], competencias: ['CPSAA', 'CCEC'],
        niveles: [
          ['Evita participar o se esconde detrás del grupo.', "Evita participar o s'amaga darrere del grup.", 'Avoids taking part, or hides behind the group.'],
          ['Participa imitando a los demás, con gestos pequeños.', "Participa imitant els altres, amb gestos petits.", 'Takes part by copying others, with small gestures.'],
          ['Participa con naturalidad y se muestra ante el grupo.', "Participa amb naturalitat i es mostra davant del grup.", 'Takes part naturally and performs in front of the group.'],
          ['Se implica del todo, propone y ayuda a que los demás se suelten.', "S'hi implica del tot, proposa i ajuda que els altres es deixin anar.", 'Commits fully, suggests ideas and helps others to loosen up.'],
        ],
      },
      {
        nombre: ['Uso del cuerpo y del espacio', "Ús del cos i de l'espai", 'Use of body and space'], competencias: ['CCEC'],
        niveles: [
          ['Repite uno o dos gestos, siempre en el mismo sitio.', "Repeteix un o dos gestos, sempre al mateix lloc.", 'Repeats one or two gestures, always on the same spot.'],
          ['Usa brazos y piernas, pero se mueve poco por el espacio.', "Fa servir braços i cames, però es mou poc per l'espai.", 'Uses arms and legs, but moves little around the space.'],
          ['Usa todo el cuerpo, cambia de nivel (alto, medio, bajo) y se desplaza por el espacio.', "Fa servir tot el cos, canvia de nivell (alt, mitjà, baix) i es desplaça per l'espai.", 'Uses the whole body, changes level (high, middle, low) and travels around the space.'],
          ['Combina gestos, posturas, niveles y trayectorias con intención de comunicar algo.', "Combina gestos, postures, nivells i trajectòries amb la intenció de comunicar alguna cosa.", 'Combines gestures, postures, levels and pathways with the intention of communicating something.'],
        ],
      },
      {
        nombre: ['Ritmo', 'Ritme', 'Rhythm'], competencias: ['CCEC'],
        niveles: [
          ['Se mueve sin tener en cuenta la música ni el ritmo marcado.', "Es mou sense tenir en compte la música ni el ritme marcat.", 'Moves with no regard for the music or the beat.'],
          ['Sigue el ritmo a ratos y lo pierde en los cambios.', "Segueix el ritme a estones i el perd en els canvis.", 'Keeps the beat at times and loses it at the changes.'],
          ['Sigue el ritmo y ajusta sus movimientos a los cambios de la música.', "Segueix el ritme i ajusta els moviments als canvis de la música.", 'Keeps the beat and adjusts movements to changes in the music.'],
          ['Sigue el ritmo con precisión y juega con la velocidad y las pausas para expresar.', "Segueix el ritme amb precisió i juga amb la velocitat i les pauses per expressar.", 'Keeps the beat precisely and plays with speed and pauses to express.'],
        ],
      },
      {
        nombre: ['Creación en grupo', 'Creació en grup', 'Group creation'], competencias: ['CE', 'CCEC', 'CC'],
        niveles: [
          ['Deja que los demás decidan y no recuerda la composición.', "Deixa que els altres decideixin i no recorda la composició.", 'Lets others decide and does not remember the piece.'],
          ['Aprende la composición del grupo, sin aportar ideas.', "Aprèn la composició del grup, sense aportar idees.", "Learns the group's piece, without contributing ideas."],
          ['Aporta ideas, acepta las de los demás y recuerda la composición entera.', "Aporta idees, accepta les dels altres i recorda la composició sencera.", "Contributes ideas, accepts others' and remembers the whole piece."],
          ['Aporta ideas originales, ayuda a coordinar al grupo y cuida el principio y el final.', "Aporta idees originals, ajuda a coordinar el grup i té cura de l'inici i el final.", 'Contributes original ideas, helps coordinate the group and takes care over the opening and the ending.'],
        ],
      },
    ],
  },
];

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   ESCALAS DE REGISTRO
══════════════════════════════════════════════════════════════════════════════════════════════ */

export const MODELOS_ESCALA: readonly ModeloEscala[] = [
  {
    id: 'habitos-de-trabajo', ambito: 'general',
    nombre: ['Hábitos de trabajo en clase', 'Hàbits de treball a classe', 'Work habits in class'],
    uso: ['Para pasar de vez en cuando, en cualquier área.', 'Per passar de tant en tant, en qualsevol àrea.', 'To run now and then, in any subject.'],
    conceptos: [
      ['Trae el material que hace falta', 'Porta el material que cal', 'Brings the materials needed'],
      ['Empieza la tarea sin que haya que repetírselo', "Comença la tasca sense que calgui repetir-l'hi", 'Starts the task without being told twice'],
      ['Trabaja sin molestar a los demás', 'Treballa sense molestar els altres', 'Works without disturbing others'],
      ['Termina la tarea en el tiempo de clase', 'Acaba la tasca en el temps de classe', 'Finishes the task in class time'],
      ['Deja su sitio recogido', 'Deixa el seu lloc recollit', 'Leaves their place tidy'],
    ],
  },
  {
    id: 'entrega-de-tareas', ambito: 'general',
    nombre: ['Entrega de una tarea', "Lliurament d'una tasca", 'Handing in a task'],
    uso: ['Al recoger un trabajo o los deberes.', 'En recollir un treball o els deures.', 'When collecting a piece of work or homework.'],
    conceptos: [
      ['La entrega en la fecha acordada', 'La lliura en la data acordada', 'Hands it in on the agreed date'],
      ['La tarea está completa', 'La tasca és completa', 'The task is complete'],
      ['Ha seguido las instrucciones', 'Ha seguit les instruccions', 'Followed the instructions'],
      ['La presentación es limpia y ordenada', 'La presentació és neta i ordenada', 'The presentation is clean and tidy'],
    ],
  },
  {
    id: 'trabajo-cooperativo', ambito: 'general',
    nombre: ['Trabajo cooperativo', 'Treball cooperatiu', 'Cooperative work'],
    uso: ['Durante una sesión de trabajo en grupos.', 'Durant una sessió de treball en grups.', 'During a group-work lesson.'],
    conceptos: [
      ['Cumple el papel que le toca en el grupo', 'Compleix el paper que li toca al grup', 'Fulfils their role in the group'],
      ['Escucha sin interrumpir', 'Escolta sense interrompre', 'Listens without interrupting'],
      ['Aporta ideas al grupo', 'Aporta idees al grup', 'Contributes ideas to the group'],
      ['Ayuda a quien lo necesita', 'Ajuda qui ho necessita', 'Helps those who need it'],
      ['Habla en voz baja', 'Parla en veu baixa', 'Keeps their voice down'],
    ],
  },
  {
    id: 'participacion-oral', ambito: 'general',
    nombre: ['Participación en un debate o una asamblea', 'Participació en un debat o una assemblea', 'Taking part in a debate or class meeting'],
    uso: ['En una puesta en común, un debate o la asamblea de clase.', "En una posada en comú, un debat o l'assemblea de classe.", 'In a class discussion, a debate or a class meeting.'],
    conceptos: [
      ['Pide el turno de palabra', 'Demana el torn de paraula', 'Asks for a turn to speak'],
      ['Escucha a quien habla', 'Escolta qui parla', 'Listens to the speaker'],
      ['Habla del tema que se trata', 'Parla del tema que es tracta', 'Keeps to the topic'],
      ['Se expresa con un volumen adecuado', 'S\'expressa amb un volum adequat', 'Speaks at a suitable volume'],
      ['Respeta las opiniones distintas de la suya', 'Respecta les opinions diferents de la seva', 'Respects opinions different from their own'],
    ],
  },
  {
    id: 'ef-habitos-sesion', ambito: 'ef',
    nombre: ['Hábitos en la sesión de Educación Física', "Hàbits a la sessió d'Educació Física", 'Habits in the PE lesson'],
    uso: ['Para pasar en una sesión cualquiera, en la pista o en el gimnasio.', 'Per passar en una sessió qualsevol, a la pista o al gimnàs.', 'To run in any lesson, on the court or in the gym.'],
    conceptos: [
      ['Trae ropa y calzado deportivo', 'Porta roba i calçat esportiu', 'Brings sports kit and trainers'],
      ['Participa en el calentamiento', "Participa en l'escalfament", 'Takes part in the warm-up'],
      ['Respeta las normas del juego', 'Respecta les normes del joc', 'Respects the rules of the game'],
      ['Cuida el material y ayuda a recogerlo', 'Té cura del material i ajuda a recollir-lo', 'Looks after the equipment and helps put it away'],
      ['Se asea al terminar', "Es renta en acabar", 'Washes up at the end'],
    ],
  },
  {
    id: 'uso-de-dispositivos', ambito: 'general',
    nombre: ['Trabajo con dispositivos', 'Treball amb dispositius', 'Working with devices'],
    uso: ['En una sesión con tabletas u ordenadores.', 'En una sessió amb tauletes o ordinadors.', 'In a lesson with tablets or computers.'],
    conceptos: [
      ['Enciende el dispositivo y entra sin ayuda', 'Engega el dispositiu i hi entra sense ajuda', 'Switches the device on and logs in unaided'],
      ['Usa solo la aplicación o la página indicada', "Fa servir només l'aplicació o la pàgina indicada", 'Uses only the app or page indicated'],
      ['Guarda el trabajo donde se le pide', 'Desa la feina on se li demana', 'Saves the work where asked'],
      ['Cuida el dispositivo y lo deja en su sitio', 'Té cura del dispositiu i el deixa al seu lloc', 'Looks after the device and puts it back'],
    ],
  },
];

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   LO QUE USAN LAS PANTALLAS
══════════════════════════════════════════════════════════════════════════════════════════════ */

/** Si el modelo cambia entre Primaria y ESO (si no, la etapa da igual). */
export const cambiaConLaEtapa = (m: ModeloRubrica): boolean => m.criterios.some(c => esPorEtapa(c.niveles));

/** Lo que se enseña de un modelo en la lista: nombre, para qué sirve y de qué habla. */
export interface ResumenDeModelo { id: string; ambito: 'general' | 'ef'; nombre: string; uso: string; partes: string[]; cambiaConLaEtapa: boolean }

export function resumenDeRubrica(m: ModeloRubrica, lengua: Lengua): ResumenDeModelo {
  return { id: m.id, ambito: m.ambito, nombre: en(m.nombre, lengua), uso: en(m.uso, lengua), partes: m.criterios.map(c => en(c.nombre, lengua)), cambiaConLaEtapa: cambiaConLaEtapa(m) };
}

export function resumenDeEscala(m: ModeloEscala, lengua: Lengua): ResumenDeModelo {
  return { id: m.id, ambito: m.ambito, nombre: en(m.nombre, lengua), uso: en(m.uso, lengua), partes: m.conceptos.map(c => en(c, lengua)), cambiaConLaEtapa: false };
}

/** Un criterio de un modelo, ya en una lengua y para una etapa: lo que el editor de rúbricas necesita, sin id. */
export interface CriterioDeModelo {
  name: string;
  /** Descriptor de cada nivel, del 1 al 4, como en `RubricCriterion.descriptors`. */
  descriptors: Record<number, string>;
  competencies: string[];
}

/** La rúbrica de un modelo en una lengua y para una etapa, lista para rellenar el editor. */
export function rubricaDeModelo(m: ModeloRubrica, etapa: EtapaModelo, lengua: Lengua): { name: string; criteria: CriterioDeModelo[] } {
  return {
    name: en(m.nombre, lengua),
    criteria: m.criterios.map(c => {
      const niveles = esPorEtapa(c.niveles) ? c.niveles[etapa] ?? c.niveles.eso : c.niveles;
      const descriptors: Record<number, string> = {};
      niveles.forEach((d, i) => { descriptors[i + 1] = en(d, lengua); });
      return { name: en(c.nombre, lengua), descriptors, competencies: [...c.competencias] };
    }),
  };
}

/** La escala de registro de un modelo en una lengua: su nombre y sus conceptos. */
export function escalaDeModelo(m: ModeloEscala, lengua: Lengua): { name: string; items: string[] } {
  return { name: en(m.nombre, lengua), items: m.conceptos.map(c => en(c, lengua)) };
}

/**
 * La etapa con la que se enseñan los modelos de partida: la de la clase elegida para la rúbrica o, sin ella, la de
 * la mayoría de las clases del docente (a igualdad, Primaria). El docente la cambia con un clic.
 */
export function etapaDePartida(clases: readonly { etapa?: string }[], elegida?: { etapa?: string } | null): EtapaModelo {
  if (elegida?.etapa === 'primaria') return 'primaria';
  if (elegida?.etapa) return 'eso';
  const primaria = clases.filter(c => c.etapa === 'primaria').length;
  const otras = clases.filter(c => c.etapa && c.etapa !== 'primaria').length;
  return otras > primaria ? 'eso' : 'primaria';
}

/** Los modelos en el orden en que se enseñan: quien da Educación Física ve primero los suyos. */
export function enOrden<M extends { ambito: 'general' | 'ef' }>(modelos: readonly M[], primeroEF: boolean): M[] {
  const ef = modelos.filter(m => m.ambito === 'ef');
  const resto = modelos.filter(m => m.ambito !== 'ef');
  return primeroEF ? [...ef, ...resto] : [...resto, ...ef];
}
