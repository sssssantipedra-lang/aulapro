/**
 * Textos de los hilos conductores de las fichas (ver `lib/hilos.ts` y
 * `docs/FICHAS.md`), aparte para no mezclarlos con el diccionario general. Se
 * suman a `EN` en `core.ts` y a `CA` en `ca.ts`. Los nombres de los hilos no
 * están aquí: cada hilo lleva el suyo en los tres idiomas.
 */
export const HILOS_EN: Record<string, string> = {
  'Dibujos de la ficha': 'Worksheet drawings',
  'Hilo conductor': 'Theme thread',
  'Los dibujos y el ambiente de los enunciados salen de este tema. Puedes cambiarlo o quitarlo.': 'The drawings and the setting of the exercises come from this theme. You can change or remove it.',
  'Automático, según el tema': 'Automatic, from the topic',
  'Sin dibujos': 'No drawings',
  'Detectado: {hilo}': 'Detected: {hilo}',
  'Cambia la cabecera y el dibujo de cada bloque; los de los ejercicios se quedan.': 'Changes the header and each block’s drawing; the exercise drawings stay.',
  'Dibujos del ejercicio': 'Exercise drawings',
  'Añadir un dibujo': 'Add a drawing',
  'Quitar el dibujo {n}': 'Remove drawing {n}',
  'Cuántas veces se dibuja el dibujo {n}': 'Times drawing {n} is drawn',
  'Elige un dibujo': 'Choose a drawing',
  'Del hilo «{hilo}»': 'From the thread “{hilo}”',
  'Todos los dibujos': 'All drawings',
  'Buscar: vaca, pizza, reloj…': 'Search: cow, pizza, clock…',
  'Buscar un dibujo': 'Search for a drawing',
  'No hay ningún dibujo con ese nombre. Prueba con otra palabra.': 'No drawing matches. Try another word.',
  'Este dibujo no se repite: solo sale una vez.': 'This drawing is not repeated: it appears once.',
  'Nómbralos en el enunciado («Cuenta las vacas»): la ficha dibuja la cantidad exacta.': 'Mention them in the exercise (“Count the cows”): the sheet draws the exact amount.',
};

export const HILOS_CA: Record<string, string> = {
  'Dibujos de la ficha': 'Dibuixos de la fitxa',
  'Hilo conductor': 'Fil conductor',
  'Los dibujos y el ambiente de los enunciados salen de este tema. Puedes cambiarlo o quitarlo.': 'Els dibuixos i l’ambient dels enunciats surten d’aquest tema. Pots canviar-lo o treure’l.',
  'Automático, según el tema': 'Automàtic, segons el tema',
  'Sin dibujos': 'Sense dibuixos',
  'Detectado: {hilo}': 'Detectat: {hilo}',
  'Cambia la cabecera y el dibujo de cada bloque; los de los ejercicios se quedan.': 'Canvia la capçalera i el dibuix de cada bloc; els dels exercicis es queden.',
  'Dibujos del ejercicio': 'Dibuixos de l’exercici',
  'Añadir un dibujo': 'Afegeix un dibuix',
  'Quitar el dibujo {n}': 'Treu el dibuix {n}',
  'Cuántas veces se dibuja el dibujo {n}': 'Cops que es dibuixa el dibuix {n}',
  'Elige un dibujo': 'Tria un dibuix',
  'Del hilo «{hilo}»': 'Del fil «{hilo}»',
  'Todos los dibujos': 'Tots els dibuixos',
  'Buscar: vaca, pizza, reloj…': 'Cerca: vaca, pizza, rellotge…',
  'Buscar un dibujo': 'Cerca un dibuix',
  'No hay ningún dibujo con ese nombre. Prueba con otra palabra.': 'No hi ha cap dibuix amb aquest nom. Prova amb una altra paraula.',
  'Este dibujo no se repite: solo sale una vez.': 'Aquest dibuix no es repeteix: només surt una vegada.',
  'Nómbralos en el enunciado («Cuenta las vacas»): la ficha dibuja la cantidad exacta.': 'Anomena’ls a l’enunciat («Compta les vaques»): la fitxa dibuixa la quantitat exacta.',
};
