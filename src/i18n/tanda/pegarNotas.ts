/**
 * Traducciones de la mejora «pegarNotas» (tanda de mejoras del 20-11-2026). La clave es el texto en castellano,
 * como en el resto de la app. Cada mejora tiene su archivo para que varias se puedan hacer a la vez.
 *
 * El cuaderno como una hoja de cálculo: la vista previa de pegar notas (`components/cuaderno/VistaPreviaPegado.tsx`),
 * el menú de la columna (`MenuDeColumna.tsx`), «Calificar esta actividad» (`CalificarActividad.tsx`) y las dos
 * formas de decir en el aviso de «Deshacer» que se han puesto varias notas de una vez (`lib/deshacer.ts`).
 */
export const EN: Record<string, string> = {
  // El aviso de «Deshacer»
  'una nota del cuaderno': 'one gradebook mark',
  '{n} notas del cuaderno': '{n} gradebook marks',

  // La tabla del cuaderno
  'clic para calificarla, rellenarla o editarla': 'click to grade it, fill it in or edit it',
  'Intro y las flechas pasan de una celda a otra. Para traer notas de una hoja de cálculo, copia allí la columna y pégala sobre la celda del primer alumno: antes de poner nada verás lo que cambia.':
    'Enter and the arrow keys move from one cell to another. To bring marks from a spreadsheet, copy the column there and paste it onto the first student\'s cell: you will see what changes before anything is entered.',
  'Pulsa el nombre de una actividad para calificarla en una lista o poner una nota a quien no tiene.':
    'Press the name of an activity to grade it in a list or to give a mark to those who have none.',

  // El menú de la columna
  '{n} de {total} con nota': '{n} of {total} with a mark',
  'Calificar esta actividad': 'Grade this activity',
  'El alumnado en una lista, con una casilla grande para cada nota.': 'The students in a list, with a large box for each mark.',
  'Poner una nota a quien no tiene': 'Give a mark to those who have none',
  'Toda la clase tiene nota en esta actividad.': 'The whole class has a mark in this activity.',
  'Poner a 1 alumno': 'Give it to 1 student',
  'Poner a {n} alumnos': 'Give it to {n} students',
  'Escribe una nota de 0 a 10.': 'Enter a mark from 0 to 10.',
  'Sin nota: {nombres}.': 'No mark: {nombres}.',
  'Las notas que ya están no se tocan, y se puede deshacer.': 'Existing marks are left untouched, and you can undo it.',
  'Editar o eliminar esta actividad': 'Edit or delete this activity',
  'Nombre, categoría, fecha y cuánto cuenta.': 'Name, category, date and how much it counts.',

  // «Calificar esta actividad»
  'de {total} con nota': 'of {total} with a mark',
  'No es una nota de 0 a 10: no se ha guardado.': 'This is not a mark from 0 to 10: it has not been saved.',
  'Cada nota se guarda al salir de su casilla.': 'Each mark is saved when you leave its box.',

  // La vista previa de pegar notas
  'Pegar notas: revisa antes de poner nada': 'Paste marks: check before anything is entered',
  'Lo que has pegado no trae ninguna columna de notas.': 'What you pasted has no column of marks.',
  'Se coloca por orden, no por nombre: la primera fila va a {alumno} y sigue hacia abajo; la primera columna va a «{actividad}» y sigue hacia la derecha.':
    'Marks are placed by position, not by name: the first row goes to {alumno} and continues downwards; the first column goes to «{actividad}» and continues to the right.',
  'Se coloca por orden, no por nombre: la primera fila va a {alumno}, en «{actividad}», y sigue hacia abajo.':
    'Marks are placed by position, not by name: the first row goes to {alumno}, in «{actividad}», and continues downwards.',
  'Lo que va a pasar': 'What is going to happen',
  'nota nueva': 'new mark',
  'notas nuevas': 'new marks',
  'cambia una nota que ya estaba': 'replaces an existing mark',
  'cambian una nota que ya estaba': 'replace an existing mark',
  'no es una nota de 0 a 10 y no entra': 'is not a mark from 0 to 10 and is left out',
  'no son notas de 0 a 10 y no entran': 'are not marks from 0 to 10 and are left out',
  'ya tenía esa nota': 'already had that mark',
  'ya tenían esa nota': 'already had that mark',
  '1 nombre de tu hoja no coincide con el alumno de su fila (marcado con ≠). Puede que tu hoja no esté en el orden de la lista: compruébalo antes de seguir.':
    '1 name in your sheet does not match the student in its row (marked with ≠). Your sheet may not be in the same order as the class list: check it before going on.',
  '{n} nombres de tu hoja no coinciden con el alumno de su fila (marcados con ≠). Puede que tu hoja no esté en el orden de la lista: compruébalo antes de seguir.':
    '{n} names in your sheet do not match the student in their row (marked with ≠). Your sheet may not be in the same order as the class list: check it before going on.',
  'Sobra 1 fila: tu hoja trae más filas que alumnos quedan desde {alumno}. No entra.':
    '1 row too many: your sheet has more rows than there are students from {alumno} down. It is left out.',
  'Sobran {n} filas: tu hoja trae más filas que alumnos quedan desde {alumno}. No entran.':
    '{n} rows too many: your sheet has more rows than there are students from {alumno} down. They are left out.',
  'Sobra 1 columna: no hay más actividades a la derecha de «{actividad}». No entra.':
    '1 column too many: there are no more activities to the right of «{actividad}». It is left out.',
  'Sobran {n} columnas: no hay más actividades a la derecha de «{actividad}». No entran.':
    '{n} columns too many: there are no more activities to the right of «{actividad}». They are left out.',
  'La primera fila es la cabecera de mi hoja: no es de ningún alumno': 'The first row is my sheet\'s header: it does not belong to any student',
  'Se ha marcado sola porque esa fila no trae ninguna nota y las de debajo sí.': 'It was ticked automatically because that row has no marks and the rows below do.',
  'La columna con el número de lista (1, 2, 3…) no se cuenta como nota.': 'The column with the list number (1, 2, 3…) is not counted as a mark.',
  'Los nombres de tu hoja salen junto a cada alumno para que compruebes el orden; no se usan para colocar las notas.':
    'The names in your sheet are shown next to each student so that you can check the order; they are not used to place the marks.',
  'En tu hoja': 'In your sheet',
  'Cómo se llama esta columna en tu hoja': 'What this column is called in your sheet',
  'No coincide con el alumno de esta fila': 'It does not match the student in this row',
  'No es una nota de 0 a 10: no entra': 'Not a mark from 0 to 10: it is left out',
  'Tu hoja no trae nada aquí: se queda como está': 'Your sheet has nothing here: it stays as it is',
  'Ya tenía esta nota': 'It already had this mark',
  'Cambia la nota que ya estaba': 'It replaces the existing mark',
  'pasa a': 'becomes',
  'Nota nueva': 'New mark',
  'Una celda vacía de tu hoja no borra la nota que ya estaba. Después de poner las notas tendrás unos segundos para deshacerlo.':
    'An empty cell in your sheet does not delete the existing mark. After the marks are entered you will have a few seconds to undo it.',
  'No hay nada que poner': 'There is nothing to enter',
  'Poner 1 nota': 'Enter 1 mark',
  'Poner {n} notas': 'Enter {n} marks',
};

export const CA: Record<string, string> = {
  // El aviso de «Deshacer»
  'una nota del cuaderno': 'una nota del quadern',
  '{n} notas del cuaderno': '{n} notes del quadern',

  // La tabla del cuaderno
  'clic para calificarla, rellenarla o editarla': 'clic per qualificar-la, omplir-la o editar-la',
  'Intro y las flechas pasan de una celda a otra. Para traer notas de una hoja de cálculo, copia allí la columna y pégala sobre la celda del primer alumno: antes de poner nada verás lo que cambia.':
    'Intro i les fletxes passen d\'una cel·la a una altra. Per portar notes d\'un full de càlcul, copia allà la columna i enganxa-la sobre la cel·la del primer alumne: abans de posar res veuràs què canvia.',
  'Pulsa el nombre de una actividad para calificarla en una lista o poner una nota a quien no tiene.':
    'Prem el nom d\'una activitat per qualificar-la en una llista o posar una nota a qui no en té.',

  // El menú de la columna
  '{n} de {total} con nota': '{n} de {total} amb nota',
  'Calificar esta actividad': 'Qualificar aquesta activitat',
  'El alumnado en una lista, con una casilla grande para cada nota.': 'L\'alumnat en una llista, amb una casella gran per a cada nota.',
  'Poner una nota a quien no tiene': 'Posar una nota a qui no en té',
  'Toda la clase tiene nota en esta actividad.': 'Tota la classe té nota en aquesta activitat.',
  'Poner a 1 alumno': 'Posar a 1 alumne',
  'Poner a {n} alumnos': 'Posar a {n} alumnes',
  'Escribe una nota de 0 a 10.': 'Escriu una nota de 0 a 10.',
  'Sin nota: {nombres}.': 'Sense nota: {nombres}.',
  'Las notas que ya están no se tocan, y se puede deshacer.': 'Les notes que ja hi són no es toquen, i es pot desfer.',
  'Editar o eliminar esta actividad': 'Editar o eliminar aquesta activitat',
  'Nombre, categoría, fecha y cuánto cuenta.': 'Nom, categoria, data i quant compta.',

  // «Calificar esta actividad»
  'de {total} con nota': 'de {total} amb nota',
  'No es una nota de 0 a 10: no se ha guardado.': 'No és una nota de 0 a 10: no s\'ha desat.',
  'Cada nota se guarda al salir de su casilla.': 'Cada nota es desa en sortir de la seva casella.',

  // La vista previa de pegar notas
  'Pegar notas: revisa antes de poner nada': 'Enganxar notes: revisa abans de posar res',
  'Lo que has pegado no trae ninguna columna de notas.': 'El que has enganxat no porta cap columna de notes.',
  'Se coloca por orden, no por nombre: la primera fila va a {alumno} y sigue hacia abajo; la primera columna va a «{actividad}» y sigue hacia la derecha.':
    'Es col·loca per ordre, no per nom: la primera fila va a {alumno} i continua cap avall; la primera columna va a «{actividad}» i continua cap a la dreta.',
  'Se coloca por orden, no por nombre: la primera fila va a {alumno}, en «{actividad}», y sigue hacia abajo.':
    'Es col·loca per ordre, no per nom: la primera fila va a {alumno}, en «{actividad}», i continua cap avall.',
  'Lo que va a pasar': 'El que passarà',
  'nota nueva': 'nota nova',
  'notas nuevas': 'notes noves',
  'cambia una nota que ya estaba': 'canvia una nota que ja hi era',
  'cambian una nota que ya estaba': 'canvien una nota que ja hi era',
  'no es una nota de 0 a 10 y no entra': 'no és una nota de 0 a 10 i no entra',
  'no son notas de 0 a 10 y no entran': 'no són notes de 0 a 10 i no entren',
  'ya tenía esa nota': 'ja tenia aquesta nota',
  'ya tenían esa nota': 'ja tenien aquesta nota',
  '1 nombre de tu hoja no coincide con el alumno de su fila (marcado con ≠). Puede que tu hoja no esté en el orden de la lista: compruébalo antes de seguir.':
    '1 nom del teu full no coincideix amb l\'alumne de la seva fila (marcat amb ≠). Pot ser que el teu full no estigui en l\'ordre de la llista: comprova-ho abans de continuar.',
  '{n} nombres de tu hoja no coinciden con el alumno de su fila (marcados con ≠). Puede que tu hoja no esté en el orden de la lista: compruébalo antes de seguir.':
    '{n} noms del teu full no coincideixen amb l\'alumne de la seva fila (marcats amb ≠). Pot ser que el teu full no estigui en l\'ordre de la llista: comprova-ho abans de continuar.',
  'Sobra 1 fila: tu hoja trae más filas que alumnos quedan desde {alumno}. No entra.':
    'Sobra 1 fila: el teu full porta més files que alumnes queden des de {alumno}. No entra.',
  'Sobran {n} filas: tu hoja trae más filas que alumnos quedan desde {alumno}. No entran.':
    'Sobren {n} files: el teu full porta més files que alumnes queden des de {alumno}. No entren.',
  'Sobra 1 columna: no hay más actividades a la derecha de «{actividad}». No entra.':
    'Sobra 1 columna: no hi ha més activitats a la dreta de «{actividad}». No entra.',
  'Sobran {n} columnas: no hay más actividades a la derecha de «{actividad}». No entran.':
    'Sobren {n} columnes: no hi ha més activitats a la dreta de «{actividad}». No entren.',
  'La primera fila es la cabecera de mi hoja: no es de ningún alumno': 'La primera fila és la capçalera del meu full: no és de cap alumne',
  'Se ha marcado sola porque esa fila no trae ninguna nota y las de debajo sí.': 'S\'ha marcat sola perquè aquesta fila no porta cap nota i les de sota sí.',
  'La columna con el número de lista (1, 2, 3…) no se cuenta como nota.': 'La columna amb el número de llista (1, 2, 3…) no es compta com a nota.',
  'Los nombres de tu hoja salen junto a cada alumno para que compruebes el orden; no se usan para colocar las notas.':
    'Els noms del teu full surten al costat de cada alumne perquè comprovis l\'ordre; no es fan servir per col·locar les notes.',
  'En tu hoja': 'Al teu full',
  'Cómo se llama esta columna en tu hoja': 'Com es diu aquesta columna al teu full',
  'No coincide con el alumno de esta fila': 'No coincideix amb l\'alumne d\'aquesta fila',
  'No es una nota de 0 a 10: no entra': 'No és una nota de 0 a 10: no entra',
  'Tu hoja no trae nada aquí: se queda como está': 'El teu full no porta res aquí: es queda com està',
  'Ya tenía esta nota': 'Ja tenia aquesta nota',
  'Cambia la nota que ya estaba': 'Canvia la nota que ja hi era',
  'pasa a': 'passa a',
  'Nota nueva': 'Nota nova',
  'Una celda vacía de tu hoja no borra la nota que ya estaba. Después de poner las notas tendrás unos segundos para deshacerlo.':
    'Una cel·la buida del teu full no esborra la nota que ja hi era. Després de posar les notes tindràs uns segons per desfer-ho.',
  'No hay nada que poner': 'No hi ha res a posar',
  'Poner 1 nota': 'Posar 1 nota',
  'Poner {n} notas': 'Posar {n} notes',
};
