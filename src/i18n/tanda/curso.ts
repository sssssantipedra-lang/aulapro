/**
 * Traducciones de la mejora «curso» (tanda de mejoras del 20-11-2026). La clave es el texto en castellano,
 * como en el resto de la app. Cada mejora tiene su archivo para que varias se puedan hacer a la vez.
 */
export const EN: Record<string, string> = {
  // Categorías para empezar el cuaderno (lib/categoriasCuaderno.ts)
  'Usar las 4 destrezas de la lengua (25/25/25/25)': 'Use the 4 language skills (25/25/25/25)',
  'Usar interpretación, escucha y creación (40/30/30)': 'Use performing, listening and composing (40/30/30)',
  'Usar creaciones, proceso y análisis (50/30/20)': 'Use artwork, process and analysis (50/30/20)',
  'Define las categorías de nota y cuánto pesa cada una en la media. Como «{asignatura}» reúne plástica y música, puedes empezar con las categorías de una de las dos y renombrarlas o cambiar su peso después.':
    'Set up your grade categories and how much each one counts towards the average. As "{asignatura}" covers both art and music, you can start with the categories of either one and rename them or change their weight later.',
  'Define las categorías de nota y cuánto pesa cada una en la media. Como «{asignatura}» es una lengua extranjera, puedes empezar con sus cuatro destrezas, comprensión y expresión oral y escrita, y renombrarlas o cambiar su peso después.':
    'Set up your grade categories and how much each one counts towards the average. As "{asignatura}" is a foreign language, you can start with its four skills, listening, speaking, reading and writing, and rename them or change their weight later.',
  'Define las categorías de nota y cuánto pesa cada una en la media. Como «{asignatura}» es de música, puedes empezar con interpretación, escucha y creación, y renombrarlas o cambiar su peso después.':
    'Set up your grade categories and how much each one counts towards the average. As "{asignatura}" is a music subject, you can start with performing, listening and composing, and rename them or change their weight later.',
  'Define las categorías de nota y cuánto pesa cada una en la media. Como «{asignatura}» es de plástica, puedes empezar con creaciones, proceso de trabajo y observación y análisis, y renombrarlas o cambiar su peso después.':
    'Set up your grade categories and how much each one counts towards the average. As "{asignatura}" is an art subject, you can start with artwork, working process and observation and analysis, and rename them or change their weight later.',
  // Crear varios grupos (components/clases/CrearVariosGrupos.tsx)
  'Para cuando das la misma asignatura a muchos grupos. Elige la etapa, marca los cursos, escribe las letras y verás abajo la lista de clases antes de crearlas. Después podrás cambiar cualquiera de ellas.': 'For when you teach the same subject to many groups. Choose the stage, tick the year groups, type the letters and you will see the list of classes below before creating them. You can change any of them afterwards.',
  'Cursos': 'Year groups',
  'Letras de los grupos': 'Group letters',
  'Separadas por comas: «A, B, C». También vale «A-D». Si solo hay un grupo por curso, puedes dejarlo vacío.': 'Separated by commas: "A, B, C". "A-D" also works. If there is only one group per year, you can leave it empty.',
  'Asignatura que les das': 'Subject you teach them',
  'Una sola para todos los grupos. Si a alguno le das más, se las añades después en «Editar clase».': 'One subject for all the groups. If you teach more to any of them, add the others later in "Edit class".',
  'Marca al menos un curso para ver las clases que se crearán.': 'Tick at least one year group to see the classes that will be created.',
  'No hay nada que crear: todos esos grupos ya existen.': 'Nothing to create: all those groups already exist.',
  'Se va a crear {n} clase': '{n} class will be created',
  'Se van a crear {n} clases': '{n} classes will be created',
  'Ya existe y no se duplica: {grupos}.': 'Already exists and will not be duplicated: {grupos}.',
  'Ya existen y no se duplican: {grupos}.': 'Already exist and will not be duplicated: {grupos}.',
  'Se crean como mucho {max} de una vez. Los demás, en una segunda tanda.': 'At most {max} are created at once. Create the rest in a second batch.',
  '«{asignatura}» no está en el currículo oficial de {cursos}: en esas clases quedará sin materia oficial, y podrás elegirla después.': '"{asignatura}" is not in the official curriculum for {cursos}: in those classes it will have no official subject, and you can choose one later.',
  'Crear {n} clases': 'Create {n} classes',
  'Elige la asignatura para poder crearlas.': 'Choose the subject to be able to create them.',
  'Una clase': 'One class',
  'Crear varios grupos': 'Create several groups',
  'Se han creado {n} clases. Entra en cada una para añadir su alumnado.': '{n} classes created. Open each one to add its students.',
};

export const CA: Record<string, string> = {
  'Usar las 4 destrezas de la lengua (25/25/25/25)': 'Fer servir les 4 destreses de la llengua (25/25/25/25)',
  'Usar interpretación, escucha y creación (40/30/30)': 'Fer servir interpretació, escolta i creació (40/30/30)',
  'Usar creaciones, proceso y análisis (50/30/20)': 'Fer servir creacions, procés i anàlisi (50/30/20)',
  'Define las categorías de nota y cuánto pesa cada una en la media. Como «{asignatura}» reúne plástica y música, puedes empezar con las categorías de una de las dos y renombrarlas o cambiar su peso después.':
    'Defineix les categories de nota i quant pesa cadascuna en la mitjana. Com que «{asignatura}» reuneix plàstica i música, pots començar amb les categories d\'una de les dues i canviar-ne el nom o el pes després.',
  'Define las categorías de nota y cuánto pesa cada una en la media. Como «{asignatura}» es una lengua extranjera, puedes empezar con sus cuatro destrezas, comprensión y expresión oral y escrita, y renombrarlas o cambiar su peso después.':
    'Defineix les categories de nota i quant pesa cadascuna en la mitjana. Com que «{asignatura}» és una llengua estrangera, pots començar amb les seves quatre destreses, comprensió i expressió oral i escrita, i canviar-ne el nom o el pes després.',
  'Define las categorías de nota y cuánto pesa cada una en la media. Como «{asignatura}» es de música, puedes empezar con interpretación, escucha y creación, y renombrarlas o cambiar su peso después.':
    'Defineix les categories de nota i quant pesa cadascuna en la mitjana. Com que «{asignatura}» és de música, pots començar amb interpretació, escolta i creació, i canviar-ne el nom o el pes després.',
  'Define las categorías de nota y cuánto pesa cada una en la media. Como «{asignatura}» es de plástica, puedes empezar con creaciones, proceso de trabajo y observación y análisis, y renombrarlas o cambiar su peso después.':
    'Defineix les categories de nota i quant pesa cadascuna en la mitjana. Com que «{asignatura}» és de plàstica, pots començar amb creacions, procés de treball i observació i anàlisi, i canviar-ne el nom o el pes després.',
  // Crear varios grupos (components/clases/CrearVariosGrupos.tsx)
  'Para cuando das la misma asignatura a muchos grupos. Elige la etapa, marca los cursos, escribe las letras y verás abajo la lista de clases antes de crearlas. Después podrás cambiar cualquiera de ellas.': 'Per a quan fas la mateixa assignatura a molts grups. Tria l\'etapa, marca els cursos, escriu les lletres i veuràs a sota la llista de classes abans de crear-les. Després podràs canviar-ne qualsevol.',
  'Cursos': 'Cursos',
  'Letras de los grupos': 'Lletres dels grups',
  'Separadas por comas: «A, B, C». También vale «A-D». Si solo hay un grupo por curso, puedes dejarlo vacío.': 'Separades per comes: «A, B, C». També val «A-D». Si només hi ha un grup per curs, ho pots deixar buit.',
  'Asignatura que les das': 'Assignatura que els fas',
  'Una sola para todos los grupos. Si a alguno le das más, se las añades después en «Editar clase».': 'Una de sola per a tots els grups. Si a algun n\'hi fas més, les afegeixes després a «Edita la classe».',
  'Marca al menos un curso para ver las clases que se crearán.': 'Marca almenys un curs per veure les classes que es crearan.',
  'No hay nada que crear: todos esos grupos ya existen.': 'No hi ha res a crear: tots aquests grups ja existeixen.',
  'Se va a crear {n} clase': 'Es crearà {n} classe',
  'Se van a crear {n} clases': 'Es crearan {n} classes',
  'Ya existe y no se duplica: {grupos}.': 'Ja existeix i no es duplica: {grupos}.',
  'Ya existen y no se duplican: {grupos}.': 'Ja existeixen i no es dupliquen: {grupos}.',
  'Se crean como mucho {max} de una vez. Los demás, en una segunda tanda.': 'Se\'n creen com a molt {max} de cop. La resta, en una segona tanda.',
  '«{asignatura}» no está en el currículo oficial de {cursos}: en esas clases quedará sin materia oficial, y podrás elegirla después.': '«{asignatura}» no és al currículum oficial de {cursos}: en aquestes classes quedarà sense matèria oficial, i la podràs triar després.',
  'Crear {n} clases': 'Crea {n} classes',
  'Elige la asignatura para poder crearlas.': 'Tria l\'assignatura per poder crear-les.',
  'Una clase': 'Una classe',
  'Crear varios grupos': 'Crea diversos grups',
  'Se han creado {n} clases. Entra en cada una para añadir su alumnado.': 'S\'han creat {n} classes. Entra a cadascuna per afegir-hi l\'alumnat.',
};
