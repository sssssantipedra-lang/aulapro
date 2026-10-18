/**
 * Pictogramas de AulaPro dibujados con IA (fal.ai, Nano Banana 2) para la
 * agenda visual y las fichas de PT y AL, en lo que Mulberry no tiene: iniciar y
 * terminar una actividad, material manipulativo (plastilina, puzle…), praxias y
 * respiración del trabajo de Audición y Lenguaje, y autorregulación.
 *
 * Cada fila: [id, categoría, castellano, català, inglés, concepto para el modelo].
 * El id lleva el prefijo `ia-` en la app; el archivo es
 * `public/pictos/aulapro/ia-<id>.webp`. Los modelos no escriben ni cuentan, así
 * que los conceptos evitan letras, números y cantidades exactas. Ver `docs/PTAL.md`.
 *
 * Por qué Nano Banana 2 y no FLUX schnell (el de las ilustraciones): probado el
 * 18-10-2026, schnell no da pictogramas, da ilustraciones (caras sin la acción,
 * letras inventadas, una mano con el dedo corazón). Nano Banana 2 sí da el
 * estilo de ARASAAC o Mulberry: contorno negro, colores planos y un solo concepto.
 */
export const ESTILO =
  'A pictogram for augmentative communication (AAC), in the style of Mulberry Symbols and ARASAAC: ' +
  'simple flat illustration, thick black outlines, flat bright colors with no gradients, no shading and no shadows, ' +
  'plain pure white background, one single clear concept shown in its most recognizable way, ' +
  'no text, no letters, no numbers. Concept: ';

export const LISTA = [
  /* Inicio y fin de una actividad. Terminado, pausa, repetir y cambio de actividad son SVG propios
     (`../propios/`): son símbolos sin personas y el SVG es exacto. */
  ['inicio-actividad', 'estructura', 'Inicio de la actividad', 'Inici de l\'activitat', 'Start of the activity', 'start of the activity: a green round button with a white play triangle, and a small child pointing happily at it'],
  ['fin-actividad', 'estructura', 'Fin de la actividad', 'Final de l\'activitat', 'End of the activity', 'end of the activity: a finished work sheet and a small child putting a pencil down on the table, smiling, with a green tick'],
  ['levantar-mano', 'estructura', 'Levantar la mano', 'Aixecar la mà', 'Raise your hand', 'raise your hand: a smiling child, upper body seen from the front, raising one arm straight up with the open hand'],
  ['guardar-trabajo', 'estructura', 'Guardar el trabajo', 'Desar el treball', 'Put your work away', 'put your work away: a child putting a worksheet into an orange folder'],
  ['pedir-descanso', 'estructura', 'Pedir un descanso', 'Demanar un descans', 'Ask for a break', 'ask for a break: a child holding up a blue card that shows two white vertical bars, the pause symbol'],

  /* Manipulativo y motricidad fina */
  ['plastilina', 'manipulativo', 'Plastilina', 'Plastilina', 'Modelling clay', 'modelling clay (plasticine): a few colorful lumps of plasticine - a ball, a roll and a flat bar - in red, blue and yellow'],
  ['modelar-plastilina', 'manipulativo', 'Modelar con plastilina', 'Modelar amb plastilina', 'Model with clay', 'to play with plasticine: two simple cartoon hands rolling a green snake of plasticine on top of a small piece of colored clay'],
  ['puzle', 'manipulativo', 'Puzle', 'Trencaclosques', 'Puzzle', 'jigsaw puzzle: a child fitting the last piece into a colorful jigsaw puzzle'],
  ['bloques', 'manipulativo', 'Bloques de construcción', 'Blocs de construcció', 'Building blocks', 'building blocks: a child building a tower with colorful wooden toy blocks'],
  ['enhebrar', 'manipulativo', 'Enhebrar cuentas', 'Enfilar comptes', 'Thread beads', 'thread beads: a child threading big colorful beads onto a string'],
  ['pinzas', 'manipulativo', 'Pinzas de la ropa', 'Pinces de la roba', 'Clothes pegs', 'clothes pegs: a hand clipping colorful wooden clothes pegs along the edge of a piece of cardboard'],
  ['rasgar-papel', 'manipulativo', 'Rasgar papel', 'Esquinçar paper', 'Tear paper', 'tear paper: two hands tearing a sheet of colored paper in two pieces'],
  ['arrugar-papel', 'manipulativo', 'Arrugar papel', 'Arrugar paper', 'Scrunch paper', 'scrunch paper: a hand squeezing a sheet of yellow paper into a ball'],
  ['doblar-papel', 'manipulativo', 'Doblar papel', 'Plegar paper', 'Fold paper', 'fold paper: two hands folding a sheet of blue paper in half'],
  ['pintar-dedos', 'manipulativo', 'Pintar con los dedos', 'Pintar amb els dits', 'Finger painting', 'finger painting: a child with colorful paint on the fingertips painting on a sheet of paper'],
  ['arena', 'manipulativo', 'Bandeja de arena', 'Safata de sorra', 'Sand tray', 'sand tray: a hand drawing a spiral with one finger in a rectangular tray of sand'],
  ['abrochar-botones', 'manipulativo', 'Abrochar botones', 'Cordar botons', 'Do up buttons', 'do up buttons: a child buttoning up the buttons of a shirt'],
  ['atar-cordones', 'manipulativo', 'Atarse los cordones', 'Lligar-se els cordons', 'Tie your laces', 'tie your laces: a child tying the laces of a sneaker'],
  ['cremallera', 'manipulativo', 'Subir la cremallera', 'Pujar la cremallera', 'Zip up', 'zip up: a child zipping up the zip of a jacket'],
  ['tarjetas', 'manipulativo', 'Tarjetas', 'Targetes', 'Cards', 'cards: a hand holding a fan of plain colored cards, completely blank'],
  ['juego-mesa', 'manipulativo', 'Juego de mesa', 'Joc de taula', 'Board game', 'board game: two children playing a board game with a dice and colored pawns'],
  ['instrumentos', 'manipulativo', 'Instrumentos', 'Instruments', 'Instruments', 'musical instruments: a child playing a small drum with two drumsticks, and a pair of maracas next to it'],
  ['espejo', 'manipulativo', 'Espejo', 'Mirall', 'Mirror', 'mirror: a child looking at their own face in a large standing mirror with a wooden frame'],

  /* Lenguaje y habla (AL) */
  ['sacar-lengua', 'lenguaje', 'Sacar la lengua', 'Treure la llengua', 'Stick out your tongue', 'stick out your tongue: a smiling child face seen from the front with the tongue sticking out straight'],
  ['hinchar-mejillas', 'lenguaje', 'Hinchar las mejillas', 'Inflar les galtes', 'Puff out your cheeks', 'puff out your cheeks: a smiling child face seen from the front, both cheeks blown up round like balloons, lips closed'],
  ['morritos', 'lenguaje', 'Hacer morritos', 'Fer morrets', 'Pucker your lips', 'pucker your lips: a child face seen from the front with the lips pushed forward in a small round kiss shape'],
  ['abrir-boca', 'lenguaje', 'Abrir la boca', 'Obrir la boca', 'Open your mouth wide', 'open your mouth wide: a child face seen from the front with the mouth very wide open, showing the teeth and the tongue'],
  ['inspirar', 'lenguaje', 'Coger aire por la nariz', 'Agafar aire pel nas', 'Breathe in through your nose', 'breathe in through your nose: a child with closed eyes smelling a pink flower, a blue arrow going toward the nose'],
  ['soplar-vela', 'lenguaje', 'Soplar la vela', 'Bufar l\'espelma', 'Blow out the candle', 'blow out the candle: a child, side view, blowing air at a lit candle, with small air lines between the mouth and the flame'],
  ['garganta', 'lenguaje', 'Notar la voz en la garganta', 'Notar la veu a la gola', 'Feel your voice in your throat', 'feel your voice: a child with one hand on the throat while speaking, with small sound waves near the mouth'],
  ['microfono', 'lenguaje', 'Micrófono', 'Micròfon', 'Microphone', 'microphone: a child speaking into a microphone'],
  ['palabra', 'lenguaje', 'Decir la palabra', 'Dir la paraula', 'Say the word', 'say the word: a child speaking, with a big blue speech bubble with three dots inside'],
  ['contar-cuento', 'lenguaje', 'Contar un cuento', 'Explicar un conte', 'Tell a story', 'tell a story: a child holding an open storybook, with a small castle and a star above the book'],
  ['boca-espejo', 'lenguaje', 'Mirar mi boca en el espejo', 'Mirar-me la boca al mirall', 'Look at my mouth in the mirror', 'look at my mouth in the mirror: a child holding a small hand mirror in front of the face and looking at their own mouth'],
  ['aplaudir-silabas', 'lenguaje', 'Dar palmadas a las sílabas', 'Picar de mans les síl·labes', 'Clap the syllables', 'clap the syllables: a smiling child clapping the hands, with small motion lines'],

  /* Autorregulación y convivencia */
  ['respirar-hondo', 'calma', 'Respirar hondo', 'Respirar fondo', 'Take a deep breath', 'take a deep breath: a calm child with closed eyes and one hand on the belly, breathing in slowly'],
  ['rincon-calma', 'calma', 'Rincón de la calma', 'Racó de la calma', 'Calm corner', 'calm corner: a cozy corner with a big soft cushion, a teddy bear and a small cloud-shaped pillow'],
  ['abrazo', 'calma', 'Abrazo', 'Abraçada', 'Hug', 'hug: two children hugging each other, smiling'],
  ['manos-quietas', 'calma', 'Manos quietas', 'Mans quietes', 'Hands still', 'keep your hands still: a child sitting on a chair with both hands resting folded on the lap, calm'],
  ['mirar-ojos', 'calma', 'Mirar a los ojos', 'Mirar als ulls', 'Look into the eyes', 'look into the eyes: two children facing each other, looking into each other eyes, side view'],
];
