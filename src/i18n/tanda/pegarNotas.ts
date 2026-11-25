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
  'Si esa fila numera las actividades (1, 2, 3…), márcala: sus números serán los títulos de las columnas y no se pondrán como notas.':
    'If that row numbers the activities (1, 2, 3…), tick it: its numbers will be the column titles and will not be entered as marks.',
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

  // Colocar por nombre (24-11-2026)
  'Intro y las flechas pasan de una celda a otra. Para traer notas de una hoja de cálculo, copia allí los nombres con sus notas y pégalos en la columna de la actividad, o arrastra el archivo sobre el cuaderno: cada nota irá a su alumno, y antes de poner nada verás lo que cambia.':
    'Enter and the arrow keys move from one cell to another. To bring marks from a spreadsheet, copy the names with their marks there and paste them into the activity\'s column, or drag the file onto the gradebook: each mark will go to its student, and you will see what changes before anything is entered.',
  'Cada nota va al alumno que se llama así en tu hoja, aunque esté en otro orden o escrito de otra forma. La primera columna va a «{actividad}» y sigue hacia la derecha.':
    'Each mark goes to the student with that name in your sheet, even if it is in another order or written differently. The first column goes to “{actividad}” and continues to the right.',
  'Cada nota va al alumno que se llama así en tu hoja, aunque esté en otro orden o escrito de otra forma, en «{actividad}».':
    'Each mark goes to the student with that name in your sheet, even if it is in another order or written differently, in “{actividad}”.',
  'Tu hoja no trae los nombres: las notas se colocan en el orden de la lista del cuaderno. Si copias también la columna de los nombres, cada nota irá a su alumno.':
    'Your sheet has no names: the marks are placed in the order of the gradebook list. If you also copy the names column, each mark will go to its student.',
  'Ningún nombre de tu hoja coincide con el alumnado de esta clase: ¿es la hoja de otro grupo? Si sigues, las notas se colocan por orden.':
    'No name in your sheet matches the students in this class: is it another group’s sheet? If you continue, the marks are placed in order.',
  '1 fila de tu hoja no se coloca: elige abajo a quién va o se quedará sin poner.':
    '1 row of your sheet is not placed: choose below who it belongs to or it will not be entered.',
  '{n} filas de tu hoja no se colocan: elige abajo a quién van o se quedarán sin poner.':
    '{n} rows of your sheet are not placed: choose below who they belong to or they will not be entered.',
  '1 nombre de tu hoja se parece al del alumno, pero no es igual (marcado con ≈): compruébalo.':
    '1 name in your sheet looks like the student’s but is not the same (marked with ≈): check it.',
  '{n} nombres de tu hoja se parecen al del alumno, pero no son iguales (marcados con ≈): compruébalos.':
    '{n} names in your sheet look like the student’s but are not the same (marked with ≈): check them.',
  '1 alumno de la clase no está en tu hoja ({nombres}): su nota se queda como está.':
    '1 student in the class is not in your sheet ({nombres}): their mark stays as it is.',
  '{n} alumnos de la clase no están en tu hoja ({nombres}): sus notas se quedan como están.':
    '{n} students in the class are not in your sheet ({nombres}): their marks stay as they are.',
  'Se parece, pero no es igual: compruébalo':
    'It looks similar but is not the same: check it',
  'Quitar: esta fila se queda sin colocar':
    'Remove: this row is left unplaced',
  'elegido por ti':
    'chosen by you',
  'Sin colocar':
    'Not placed',
  '(sin nombre)':
    '(no name)',
  'A quién va la fila «{nombre}»':
    'Who the row “{nombre}” belongs to',
  'Sin poner':
    'Do not enter',
  'He comprobado los nombres marcados con ≈':
    'I have checked the names marked with ≈',
  'He comprobado que mi hoja está en el mismo orden que la lista del cuaderno':
    'I have checked that my sheet is in the same order as the gradebook list',
  'No se parece a nadie de la clase':
    'It does not look like anyone in the class',
  'Sin nombre en tu hoja':
    'No name in your sheet',
  'Se parece a {nombres}':
    'It looks like {nombres}',
  'Otra fila de tu hoja también es de {nombre}':
    'Another row of your sheet is also {nombre}',
  'La mitad de las filas de tu hoja o más no son de nadie de esta clase: ¿es la hoja de otro grupo? Comprueba que las notas que se colocan son de tu alumnado.':
    'Half the rows of your sheet or more are not anyone in this class: is it another group’s sheet? Check that the marks being placed belong to your students.',
  'He comprobado que las notas que se colocan son de mi alumnado':
    'I have checked that the marks being placed belong to my students',

  // Importar notas de un archivo (24-11-2026)
  'nueva':
    'new',
  'Importar notas de un archivo':
    'Import marks from a file',
  'Elige a qué actividad va cada columna de notas de «{archivo}». Después verás, alumno por alumno, cómo quedan antes de poner nada: cada nota va al alumno que se llama así en tu hoja.':
    'Choose which activity each column of marks in “{archivo}” goes to. Then you will see, student by student, how they look before anything is entered: each mark goes to the student with that name in your sheet.',
  'Hoja del archivo':
    'Sheet in the file',
  'Tu hoja trae {n} filas con nombre: cada nota irá al alumno que se llama así.':
    'Your sheet has {n} rows with a name: each mark will go to the student with that name.',
  'Tu hoja no trae una columna con los nombres: las notas se colocarán en el orden de la lista, y tendrás que confirmarlo.':
    'Your sheet has no column with the names: the marks will be placed in list order, and you will have to confirm it.',
  'Esta hoja no trae ninguna columna de notas.':
    'This sheet has no column of marks.',
  'Columna de tu hoja':
    'Column in your sheet',
  'Va a':
    'Goes to',
  '{n} notas':
    '{n} marks',
  'ninguna nota':
    'no marks',
  'A qué actividad va la columna «{nombre}»':
    'Which activity the column “{nombre}” goes to',
  'No importar':
    'Do not import',
  'Actividad nueva: «{nombre}»':
    'New activity: “{nombre}”',
  'Dos columnas van a la misma actividad: elige otra para una de ellas.':
    'Two columns go to the same activity: choose another one for one of them.',
  'Las actividades nuevas van a la categoría':
    'New activities go to the category',
  'El archivo se lee en este dispositivo: no se envía a ningún sitio.':
    'The file is read on this device: it is not sent anywhere.',
  'Ver cómo quedan':
    'See how they look',
  'Cada nota va al alumno que se llama así en tu hoja, aunque esté en otro orden o escrito de otra forma. Cada columna va a la actividad que has elegido.':
    'Each mark goes to the student with that name in your sheet, even if it is in another order or written differently. Each column goes to the activity you chose.',
  'Tu hoja no trae los nombres: la primera fila va a {alumno} y sigue hacia abajo. Cada columna va a la actividad que has elegido.':
    'Your sheet has no names: the first row goes to {alumno} and continues downwards. Each column goes to the activity you chose.',
  'Importar notas: revisa antes de poner nada':
    'Import marks: check before entering anything',
  'Trae las notas de un Excel o un CSV, o arrastra el archivo sobre el cuaderno: cada nota va al alumno que se llama así':
    'Bring marks from an Excel file or a CSV, or drag the file onto the gradebook: each mark goes to the student with that name',
  'Importar notas':
    'Import marks',
  'El archivo es demasiado grande (más de 10 MB).':
    'The file is too large (more than 10 MB).',
  'Ese archivo no es una hoja de cálculo: elige un Excel (.xlsx, .xls, .ods) o un CSV.':
    'That file is not a spreadsheet: choose an Excel file (.xlsx, .xls, .ods) or a CSV.',
  'El archivo no trae ninguna tabla.':
    'The file has no table.',
  'No se ha podido leer el archivo.':
    'The file could not be read.',
  '✅ {n} notas importadas y {m} actividades nuevas':
    '✅ {n} marks imported and {m} new activities',
  '✅ {n} notas importadas':
    '✅ {n} marks imported',
  // Importar arrastrando el archivo o desde su ventana (24-11-2026)
  'Para importar notas, añade antes el alumnado de la clase.':
    'To import marks, first add the students to the class.',
  'Para importar notas, elige antes cómo evalúas en esta clase: las categorías del cuaderno.':
    'To import marks, first choose how you assess in this class: the gradebook categories.',
  'Ya hay un archivo abierto: termina o cierra esa ventana para importar otro.':
    'A file is already open: finish or close that window to import another one.',
  'Cierra la ventana que tienes abierta para importar el archivo.':
    'Close the window you have open to import the file.',
  'Se importa un archivo cada vez: se abre «{archivo}».':
    'One file is imported at a time: “{archivo}” is opened.',
  'Suelta el archivo para importar las notas de {clase}':
    'Drop the file to import the marks of {clase}',
  'Excel (.xlsx, .xls), LibreOffice (.ods) o CSV':
    'Excel (.xlsx, .xls), LibreOffice (.ods) or CSV',
  'Importar notas de {clase}':
    'Import marks for {clase}',
  'Trae las notas de un Excel o de un CSV. Después eliges a qué actividad va cada columna y ves, alumno por alumno, cómo quedan antes de poner nada.':
    'Bring the marks from an Excel file or a CSV. Then you choose which activity each column goes to and see, student by student, how they turn out before anything is entered.',
  'Leyendo el archivo…':
    'Reading the file…',
  'Suéltalo aquí':
    'Drop it here',
  'Arrastra aquí tu archivo':
    'Drag your file here',
  'o pulsa para elegirlo':
    'or click to choose it',
  'Pulsa para elegir el archivo':
    'Tap to choose the file',
  'Excel (.xlsx, .xls), LibreOffice (.ods) o CSV, de hasta 10 MB. Va mejor con una columna con los nombres del alumnado y una columna por actividad.':
    'Excel (.xlsx, .xls), LibreOffice (.ods) or CSV, up to 10 MB. It works best with a column with the students\' names and one column per activity.',
  'Elegir archivo':
    'Choose file',
};

export const CA: Record<string, string> = {
  // El aviso de «Deshacer»
  'una nota del cuaderno': 'una nota del quadern',
  '{n} notas del cuaderno': '{n} notes del quadern',

  // La tabla del cuaderno
  'clic para calificarla, rellenarla o editarla': 'clic per qualificar-la, omplir-la o editar-la',
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
    'Sobra 1 fila: començant per {alumno}, el teu full porta més files que alumnes queden. No entra.',
  'Sobran {n} filas: tu hoja trae más filas que alumnos quedan desde {alumno}. No entran.':
    'Sobren {n} files: començant per {alumno}, el teu full porta més files que alumnes queden. No entren.',
  'Sobra 1 columna: no hay más actividades a la derecha de «{actividad}». No entra.':
    'Sobra 1 columna: no hi ha més activitats a la dreta de «{actividad}». No entra.',
  'Sobran {n} columnas: no hay más actividades a la derecha de «{actividad}». No entran.':
    'Sobren {n} columnes: no hi ha més activitats a la dreta de «{actividad}». No entren.',
  'La primera fila es la cabecera de mi hoja: no es de ningún alumno': 'La primera fila és la capçalera del meu full: no és de cap alumne',
  'Se ha marcado sola porque esa fila no trae ninguna nota y las de debajo sí.': 'S\'ha marcat sola perquè aquesta fila no porta cap nota i les de sota sí.',
  'Si esa fila numera las actividades (1, 2, 3…), márcala: sus números serán los títulos de las columnas y no se pondrán como notas.':
    'Si aquesta fila numera les activitats (1, 2, 3…), marca-la: els seus números seran els títols de les columnes i no es posaran com a notes.',
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

  // Colocar por nombre (24-11-2026)
  'Intro y las flechas pasan de una celda a otra. Para traer notas de una hoja de cálculo, copia allí los nombres con sus notas y pégalos en la columna de la actividad, o arrastra el archivo sobre el cuaderno: cada nota irá a su alumno, y antes de poner nada verás lo que cambia.':
    'Intro i les fletxes passen d\'una cel·la a una altra. Per portar notes d\'un full de càlcul, copia allà els noms amb les seves notes i enganxa\'ls a la columna de l\'activitat, o arrossega el fitxer sobre el quadern: cada nota anirà al seu alumne, i abans de posar res veuràs què canvia.',
  'Cada nota va al alumno que se llama así en tu hoja, aunque esté en otro orden o escrito de otra forma. La primera columna va a «{actividad}» y sigue hacia la derecha.':
    'Cada nota va a l\'alumne que es diu així al teu full, encara que estigui en un altre ordre o escrit d\'una altra manera. La primera columna va a «{actividad}» i continua cap a la dreta.',
  'Cada nota va al alumno que se llama así en tu hoja, aunque esté en otro orden o escrito de otra forma, en «{actividad}».':
    'Cada nota va a l\'alumne que es diu així al teu full, encara que estigui en un altre ordre o escrit d\'una altra manera, a «{actividad}».',
  'Tu hoja no trae los nombres: las notas se colocan en el orden de la lista del cuaderno. Si copias también la columna de los nombres, cada nota irá a su alumno.':
    'El teu full no porta els noms: les notes es col·loquen en l\'ordre de la llista del quadern. Si copies també la columna dels noms, cada nota anirà al seu alumne.',
  'Ningún nombre de tu hoja coincide con el alumnado de esta clase: ¿es la hoja de otro grupo? Si sigues, las notas se colocan por orden.':
    'Cap nom del teu full no coincideix amb l\'alumnat d\'aquesta classe: és el full d\'un altre grup? Si continues, les notes es col·loquen per ordre.',
  '1 fila de tu hoja no se coloca: elige abajo a quién va o se quedará sin poner.':
    '1 fila del teu full no es col·loca: tria a sota a qui va o es quedarà sense posar.',
  '{n} filas de tu hoja no se colocan: elige abajo a quién van o se quedarán sin poner.':
    '{n} files del teu full no es col·loquen: tria a sota a qui van o es quedaran sense posar.',
  '1 nombre de tu hoja se parece al del alumno, pero no es igual (marcado con ≈): compruébalo.':
    '1 nom del teu full s\'assembla al de l\'alumne, però no és igual (marcat amb ≈): comprova\'l.',
  '{n} nombres de tu hoja se parecen al del alumno, pero no son iguales (marcados con ≈): compruébalos.':
    '{n} noms del teu full s\'assemblen al de l\'alumne, però no són iguals (marcats amb ≈): comprova\'ls.',
  '1 alumno de la clase no está en tu hoja ({nombres}): su nota se queda como está.':
    '1 alumne de la classe no és al teu full ({nombres}): la seva nota es queda com està.',
  '{n} alumnos de la clase no están en tu hoja ({nombres}): sus notas se quedan como están.':
    '{n} alumnes de la classe no són al teu full ({nombres}): les seves notes es queden com estan.',
  'Se parece, pero no es igual: compruébalo':
    'S\'assembla, però no és igual: comprova-ho',
  'Quitar: esta fila se queda sin colocar':
    'Treure: aquesta fila es queda sense col·locar',
  'elegido por ti':
    'triat per tu',
  'Sin colocar':
    'Sense col·locar',
  '(sin nombre)':
    '(sense nom)',
  'A quién va la fila «{nombre}»':
    'A qui va la fila «{nombre}»',
  'Sin poner':
    'Sense posar',
  'He comprobado los nombres marcados con ≈':
    'He comprovat els noms marcats amb ≈',
  'He comprobado que mi hoja está en el mismo orden que la lista del cuaderno':
    'He comprovat que el meu full està en el mateix ordre que la llista del quadern',
  'No se parece a nadie de la clase':
    'No s\'assembla a ningú de la classe',
  'Sin nombre en tu hoja':
    'Sense nom al teu full',
  'Se parece a {nombres}':
    'S\'assembla a {nombres}',
  'Otra fila de tu hoja también es de {nombre}':
    'Una altra fila del teu full també és de {nombre}',
  'La mitad de las filas de tu hoja o más no son de nadie de esta clase: ¿es la hoja de otro grupo? Comprueba que las notas que se colocan son de tu alumnado.':
    'La meitat de les files del teu full o més no són de ningú d\'aquesta classe: és el full d\'un altre grup? Comprova que les notes que es col·loquen són del teu alumnat.',
  'He comprobado que las notas que se colocan son de mi alumnado':
    'He comprovat que les notes que es col·loquen són del meu alumnat',

  // Importar notas de un archivo (24-11-2026)
  'nueva':
    'nova',
  'Importar notas de un archivo':
    'Importar notes d\'un arxiu',
  'Elige a qué actividad va cada columna de notas de «{archivo}». Después verás, alumno por alumno, cómo quedan antes de poner nada: cada nota va al alumno que se llama así en tu hoja.':
    'Tria a quina activitat va cada columna de notes de «{archivo}». Després veuràs, alumne per alumne, com queden abans de posar res: cada nota va a l\'alumne que es diu així al teu full.',
  'Hoja del archivo':
    'Full de l\'arxiu',
  'Tu hoja trae {n} filas con nombre: cada nota irá al alumno que se llama así.':
    'El teu full porta {n} files amb nom: cada nota anirà a l\'alumne que es diu així.',
  'Tu hoja no trae una columna con los nombres: las notas se colocarán en el orden de la lista, y tendrás que confirmarlo.':
    'El teu full no porta una columna amb els noms: les notes es col·locaran en l\'ordre de la llista, i ho hauràs de confirmar.',
  'Esta hoja no trae ninguna columna de notas.':
    'Aquest full no porta cap columna de notes.',
  'Columna de tu hoja':
    'Columna del teu full',
  'Va a':
    'Va a',
  '{n} notas':
    '{n} notes',
  'ninguna nota':
    'cap nota',
  'A qué actividad va la columna «{nombre}»':
    'A quina activitat va la columna «{nombre}»',
  'No importar':
    'No importar',
  'Actividad nueva: «{nombre}»':
    'Activitat nova: «{nombre}»',
  'Dos columnas van a la misma actividad: elige otra para una de ellas.':
    'Dues columnes van a la mateixa activitat: tria\'n una altra per a una d\'elles.',
  'Las actividades nuevas van a la categoría':
    'Les activitats noves van a la categoria',
  'El archivo se lee en este dispositivo: no se envía a ningún sitio.':
    'L\'arxiu es llegeix en aquest dispositiu: no s\'envia enlloc.',
  'Ver cómo quedan':
    'Veure com queden',
  'Cada nota va al alumno que se llama así en tu hoja, aunque esté en otro orden o escrito de otra forma. Cada columna va a la actividad que has elegido.':
    'Cada nota va a l\'alumne que es diu així al teu full, encara que estigui en un altre ordre o escrit d\'una altra manera. Cada columna va a l\'activitat que has triat.',
  'Tu hoja no trae los nombres: la primera fila va a {alumno} y sigue hacia abajo. Cada columna va a la actividad que has elegido.':
    'El teu full no porta els noms: la primera fila va a {alumno} i continua cap avall. Cada columna va a l\'activitat que has triat.',
  'Importar notas: revisa antes de poner nada':
    'Importar notes: revisa abans de posar res',
  'Trae las notas de un Excel o un CSV, o arrastra el archivo sobre el cuaderno: cada nota va al alumno que se llama así':
    'Porta les notes d\'un Excel o un CSV, o arrossega el fitxer sobre el quadern: cada nota va a l\'alumne que es diu així',
  'Importar notas':
    'Importar notes',
  'El archivo es demasiado grande (más de 10 MB).':
    'L\'arxiu és massa gran (més de 10 MB).',
  'Ese archivo no es una hoja de cálculo: elige un Excel (.xlsx, .xls, .ods) o un CSV.':
    'Aquest arxiu no és un full de càlcul: tria un Excel (.xlsx, .xls, .ods) o un CSV.',
  'El archivo no trae ninguna tabla.':
    'L\'arxiu no porta cap taula.',
  'No se ha podido leer el archivo.':
    'No s\'ha pogut llegir l\'arxiu.',
  '✅ {n} notas importadas y {m} actividades nuevas':
    '✅ {n} notes importades i {m} activitats noves',
  '✅ {n} notas importadas':
    '✅ {n} notes importades',
  // Importar arrastrando el archivo o desde su ventana (24-11-2026)
  'Para importar notas, añade antes el alumnado de la clase.':
    'Per importar notes, afegeix abans l\'alumnat de la classe.',
  'Para importar notas, elige antes cómo evalúas en esta clase: las categorías del cuaderno.':
    'Per importar notes, tria abans com avalues en aquesta classe: les categories del quadern.',
  'Ya hay un archivo abierto: termina o cierra esa ventana para importar otro.':
    'Ja hi ha un fitxer obert: acaba o tanca aquesta finestra per importar-ne un altre.',
  'Cierra la ventana que tienes abierta para importar el archivo.':
    'Tanca la finestra que tens oberta per importar el fitxer.',
  'Se importa un archivo cada vez: se abre «{archivo}».':
    'S\'importa un fitxer cada vegada: s\'obre «{archivo}».',
  'Suelta el archivo para importar las notas de {clase}':
    'Deixa anar el fitxer per importar les notes de {clase}',
  'Excel (.xlsx, .xls), LibreOffice (.ods) o CSV':
    'Excel (.xlsx, .xls), LibreOffice (.ods) o CSV',
  'Importar notas de {clase}':
    'Importar notes de {clase}',
  'Trae las notas de un Excel o de un CSV. Después eliges a qué actividad va cada columna y ves, alumno por alumno, cómo quedan antes de poner nada.':
    'Porta les notes d\'un Excel o d\'un CSV. Després tries a quina activitat va cada columna i veus, alumne per alumne, com queden abans de posar res.',
  'Leyendo el archivo…':
    'Llegint el fitxer…',
  'Suéltalo aquí':
    'Deixa\'l anar aquí',
  'Arrastra aquí tu archivo':
    'Arrossega aquí el teu fitxer',
  'o pulsa para elegirlo':
    'o fes clic per triar-lo',
  'Pulsa para elegir el archivo':
    'Prem per triar el fitxer',
  'Excel (.xlsx, .xls), LibreOffice (.ods) o CSV, de hasta 10 MB. Va mejor con una columna con los nombres del alumnado y una columna por actividad.':
    'Excel (.xlsx, .xls), LibreOffice (.ods) o CSV, de fins a 10 MB. Funciona millor amb una columna amb els noms de l\'alumnat i una columna per activitat.',
  'Elegir archivo':
    'Triar fitxer',
};
