/**
 * Un ejemplo de cada creación con IA, para las capturas de la demo (`scripts/web/capturar.mjs`).
 *
 * Lo que la IA escribe en la app (una situación de aprendizaje, un informe, una reunión con su acta…) no existe en los
 * datos de ejemplo de la app, así que las pantallas salían vacías, con «Todavía no has guardado ninguna». Aquí se
 * escriben a mano, con la forma exacta que guarda la app (`src/types`), y `capturar.mjs` los mete en el perfil de
 * ejemplo antes de hacer las capturas. Así la demo enseña la app tal cual con un ejemplo de cada cosa, y nada de
 * esto se genera ni se guarda de verdad: es una captura.
 *
 * Reglas de la web: castellano con «tú» y vocabulario formal, sin rayas largas, y nadie con nombre propio: el
 * alumnado es «Alumno N» (`CLAUDE.md`, regla 7). Las fechas salen del día de las capturas (14-10-2026).
 */

const HOY = new Date('2026-10-14T09:45:00');
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dia = n => iso(new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() + n));
const instante = n => new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() + n, 10, 30).toISOString();

/** Una reunión y una formación, con el documento que redacta la IA. Las usan los tres perfiles. */
export function reunionYFormacion() {
  return [
    {
      id: 'ej-reu1', kind: 'meeting', at: instante(-4), date: dia(-4), timeStart: '14:00', timeEnd: '15:00',
      title: 'Reunión de ciclo, 5.º y 6.º de Primaria', organizer: 'Coordinación de ciclo', place: 'Sala de profesorado', attendees: 'Profesorado de 5.º y 6.º',
      notes: 'Calendario de evaluaciones. Salida al parque natural en noviembre. Criterios comunes para la rúbrica de exposición oral. Revisar el reparto de aulas de refuerzo.',
      document: {
        at: instante(-4), titulo: 'Acta de la reunión de ciclo',
        resumen: 'El equipo de ciclo acordó el calendario de la primera evaluación, la salida al parque natural y unos criterios comunes para evaluar las exposiciones orales.',
        apartados: [
          { titulo: 'Calendario de evaluaciones', contenido: 'Las pruebas escritas de la primera evaluación se harán entre el 23 de noviembre y el 4 de diciembre, evitando más de una prueba por día.' },
          { titulo: 'Salida al parque natural', contenido: 'La salida de 5.º y 6.º se fija para el 19 de noviembre. Se pedirán las autorizaciones a las familias con dos semanas de antelación.' },
          { titulo: 'Rúbrica de exposición oral', contenido: 'Se usará la misma rúbrica en los dos cursos, con cuatro criterios: contenido, expresión, apoyo visual y tiempo.' },
        ],
        acuerdos: ['Una sola prueba escrita por día en la semana de evaluaciones.', 'Rúbrica común de exposición oral en 5.º y 6.º.', 'Salida al parque natural el 19 de noviembre.'],
        tareas: [
          { tarea: 'Preparar las autorizaciones de la salida', responsable: 'Tutoras de 5.º', plazo: '5 de noviembre' },
          { tarea: 'Compartir la rúbrica de exposición oral', responsable: 'Coordinación de ciclo', plazo: '30 de octubre' },
        ],
        aplicacionAula: [], cierre: 'La próxima reunión de ciclo será el 11 de noviembre.',
      },
    },
    {
      id: 'ej-for1', kind: 'training', at: instante(-9), date: dia(-9), timeStart: '17:00', timeEnd: '19:00',
      title: 'Curso: evaluación competencial con rúbricas', organizer: 'Centro de formación del profesorado', place: 'Aula virtual', hours: 10,
      notes: 'Qué es una evaluación competencial. Cómo redactar descriptores por niveles de logro. Ejemplos de rúbricas de exposición oral y de trabajo cooperativo. Cómo dar retroalimentación al alumnado.',
      document: {
        at: instante(-9), titulo: 'Resumen de la formación: evaluación competencial con rúbricas',
        resumen: 'La sesión explicó cómo evaluar competencias con rúbricas de cuatro niveles y cómo usar los resultados para dar retroalimentación útil al alumnado.',
        apartados: [
          { titulo: 'Evaluar competencias, no solo contenidos', contenido: 'Una competencia se evalúa observando cómo el alumnado aplica lo aprendido en una situación real, y no solo cuánto recuerda.' },
          { titulo: 'Descriptores por niveles de logro', contenido: 'Cada criterio se describe en cuatro niveles, con frases observables y en positivo: qué hace el alumno en cada nivel.' },
        ],
        acuerdos: ['Los descriptores han de ser observables.', 'La rúbrica se comparte con el alumnado antes de la tarea.', 'La retroalimentación dice qué hacer para mejorar.'],
        tareas: [], aplicacionAula: ['Dar la rúbrica al alumnado al presentar la tarea.', 'Usar una rúbrica de exposición oral con cuatro criterios.', 'Dedicar cinco minutos a comentar los resultados con cada grupo.'],
        cierre: 'Se certifican 10 horas de formación.',
      },
    },
  ];
}

/** Lo del docente de aula. `clases` y `alumnos` son los del perfil de ejemplo (para usar sus identificadores). */
export function ejemplosAula({ clases, alumnos }) {
  const clase = n => clases.find(c => c.name.startsWith(n)) ?? clases[0];
  const delaClase = c => alumnos.filter(a => a.class_id === c.id);

  /* ── Informe competencial ── */
  const eso = clase('1º ESO A');
  const a1 = delaClase(eso)[0];
  const reports = [{
    id: 'ej-inf1', student_id: a1.id, student_name: a1.name, class_id: eso.id, period: '1ª evaluación', date: dia(-3),
    text: [
      `${a1.name} ha tenido un buen inicio de curso en Matemáticas. En la competencia matemática y en ciencia, tecnología e ingeniería (STEM) resuelve con seguridad problemas de proporcionalidad y explica los pasos que sigue, aunque todavía revisa poco el resultado final. Le conviene comprobar sus respuestas antes de entregarlas.`,
      `En comunicación lingüística participa con ganas en las exposiciones y escucha con respeto a sus compañeros. Su trabajo en equipo ha mejorado a lo largo de las semanas: reparte las tareas y cumple el papel que le toca.`,
      `Para la siguiente evaluación se propone que dedique unos minutos a revisar cada ejercicio, que cuide la presentación del cuaderno y que siga practicando la expresión escrita con textos breves. Su evolución es positiva y su actitud en clase, muy buena.`,
    ].join('\n\n'),
  }];

  /* ── Situación de aprendizaje ── */
  const prim = clase('5º Primaria A');
  const learningSituations = [{
    id: 'ej-sda1', at: instante(-5), date: dia(-5), class_id: prim.id, class_name: prim.name,
    title: 'Un mercado sostenible en el patio',
    request: {
      idea: 'Un mercado sostenible en el patio', numero: '1', temporalizacion: 'Segundo trimestre', meses: 'Enero y febrero',
      areas: ['Matemáticas', 'Lengua Castellana y Literatura', 'Conocimiento del Medio'], numSesiones: 6, nivel: '5º de Primaria',
      etapa: 'primaria', curso: 5, comunidad: 'comunitat-valenciana', contextoClase: '', metodologia: '',
    },
    content: {
      titulo: 'Un mercado sostenible en el patio',
      justificacion: 'El alumnado diseña, prepara y abre un mercado en el patio del colegio con productos de proximidad y envases reutilizables. Parte de una situación real y cercana: qué compramos, cuánto cuesta y qué residuos genera. Así aplica el cálculo con decimales, redacta carteles y folletos persuasivos y reflexiona sobre el consumo responsable.',
      ods: 'ODS 12: Producción y consumo responsables. ODS 11: Ciudades y comunidades sostenibles. ODS 13: Acción por el clima.',
      objetivosEtapa: 'b) Desarrollar hábitos de trabajo individual y de equipo. e) Conocer y valorar el entorno natural y social. g) Desarrollar las competencias matemáticas básicas.',
      competenciasClave: 'CCL, STEM, CD, CPSAA, CC, CE',
      explicacionCurricular: 'Se eligen competencias específicas que se trabajan de forma conjunta en el mercado: resolver problemas con números decimales (Matemáticas), producir textos que convenzan (Lengua) y analizar el impacto de nuestros hábitos de consumo (Conocimiento del Medio).',
      areas: [
        { area: 'Matemáticas', competenciasEspecificas: '1. Interpretar situaciones de la vida cotidiana y resolver problemas con estrategias adecuadas. 4. Utilizar el pensamiento computacional para organizar datos y mejorar los procesos.', criteriosEvaluacion: '1.1 Comprender las preguntas planteadas. 1.2 Aplicar estrategias para resolver problemas con números decimales. 4.1 Organizar datos en tablas y gráficos sencillos.', saberesBasicos: 'A. Sentido numérico: operaciones con números decimales. C. Sentido de la medida: euros y céntimos. E. Sentido estocástico: tablas y gráficos de datos.' },
        { area: 'Lengua Castellana y Literatura', competenciasEspecificas: '3. Producir textos escritos y multimodales con coherencia y adecuación.', criteriosEvaluacion: '3.1 Redactar un cartel y un folleto con una finalidad persuasiva. 3.2 Revisar y mejorar el propio texto.', saberesBasicos: 'C. Comunicación: el texto publicitario, el cartel y el folleto.' },
        { area: 'Conocimiento del Medio', competenciasEspecificas: '5. Identificar las características de los ecosistemas y proponer acciones para cuidar el medio.', criteriosEvaluacion: '5.1 Reconocer el impacto de los residuos y proponer acciones para reducirlos.', saberesBasicos: 'F. Sociedad y desarrollo sostenible: consumo responsable y reciclaje.' },
      ],
      inclusionUniversal: 'Se ofrecen varios modos de participar (vender, contar el dinero, preparar carteles o atender el puesto) y las instrucciones se dan por escrito, de forma oral y con apoyos visuales.',
      inclusionAdicional: 'Las tarjetas de precios llevan los números en un tamaño grande y se dispone de calculadora para quien lo necesite en las sesiones de cálculo.',
      inclusionIndividualizada: 'Para el alumnado con necesidades específicas de apoyo educativo se adapta la cantidad de productos y se asigna un puesto con compañeros de referencia.',
      sesiones: [
        { fase: 'Activación', titulo: '¿Qué compramos y qué tiramos?', descripcion: 'Se revisan en grupo los envases de una semana de compra y se anotan los residuos generados. Se plantea el reto: abrir un mercado sostenible en el patio.' },
        { fase: 'Exploración', titulo: 'Productos de proximidad', descripcion: 'Se investiga qué alimentos se producen cerca del colegio y se elabora una lista con sus precios aproximados.' },
        { fase: 'Desarrollo', titulo: 'Precios, cambios y cuentas', descripcion: 'Se ponen precios con decimales y se practican las compras y los cambios con monedas y billetes de juguete.' },
        { fase: 'Desarrollo', titulo: 'Carteles y folletos', descripcion: 'Cada equipo redacta un cartel persuasivo y un folleto para invitar a las familias al mercado.' },
        { fase: 'Aplicación', titulo: 'Abrimos el mercado', descripcion: 'Los equipos atienden sus puestos en el patio, registran las ventas en una tabla y recogen los envases.' },
        { fase: 'Cierre', titulo: 'Balance del mercado', descripcion: 'Se representan las ventas en un gráfico, se calcula el beneficio y se valora cuántos residuos se han evitado.' },
      ],
      metodologia: 'Aprendizaje basado en proyectos, con trabajo cooperativo y una situación real como hilo conductor.',
      agrupamiento: 'Equipos de cuatro con roles rotativos: portavoz, cajero, responsable del material y secretario.',
      recursos: 'Monedas y billetes de juguete, calculadoras, cartulinas, tablas de registro y envases reutilizables.',
      productoFinal: 'Un mercado abierto a las familias en el patio, con carteles, folleto y un gráfico con el balance de ventas.',
      evaluacionTecnicas: 'Observación del trabajo en equipo, análisis de las producciones escritas y de las tablas de registro.',
      evaluacionInstrumentos: 'Rúbrica de la exposición y del cartel, lista de cotejo del cálculo y diana de trabajo en equipo.',
      normativa: { comunidad: 'comunitat-valenciana', origen: 'autonomico', cita: 'Decreto 106/2022, de 5 de agosto (DOGV núm. 9402, de 11 de agosto de 2022)' },
    },
  }];

  const workSessions = reunionYFormacion();

  /* ── Autoevaluación contestada por el alumnado desde el móvil ── */
  const alumnosPrim = delaClase(prim).slice(0, 6);
  const items = [{ id: 'ej-ai1', name: 'Preparo bien lo que voy a decir' }, { id: 'ej-ai2', name: 'Hablo con claridad y sin prisa' }, { id: 'ej-ai3', name: 'Escucho a mis compañeros' }];
  const notas = [[4, 3, 4], [3, 3, 3], [4, 4, 3], [2, 3, 4], [3, 4, 4], [4, 3, 3]];
  const selfAssessments = [{
    id: 'ej-auto1', at: instante(-2), date: dia(-2), class_id: prim.id, class_name: prim.name,
    title: 'Exposición oral', items,
    rows: alumnosPrim.map((a, i) => {
      const scores = Object.fromEntries(items.map((it, k) => [it.id, notas[i][k]]));
      const media = notas[i].reduce((s, v) => s + v, 0) / 3;
      return { student_id: a.id, student_name: a.name, scores, grade: Math.round(media / 4 * 100) / 10 };
    }),
  }];

  return { reports, learningSituations, workSessions, selfAssessments };
}

/** Lo que hay que sumar a los datos de ejemplo del docente de aula para las fichas: se completan dentro de la página (`prepareExercise`). */
export function fichasAula({ clases }) {
  const clase = n => clases.find(c => c.name.startsWith(n)) ?? clases[0];
  const p3 = clase('3º Primaria A'), p5 = clase('5º Primaria A');
  const ficha = (id, dias, c, titulo, request, content) => ({
    id, at: instante(dias), date: dia(dias), class_id: c.id, class_name: c.name, title: titulo, request, content,
  });
  const ej = (tipo, extra) => ({ tipo, enunciado: `Enunciado ${tipo}`, solucion: '', ...extra });
  return {
    // Comprensión lectora
    lectura: ficha('ej-fic2', -6, p3, 'El dragón que perdió su fuego',
      { tema: 'Un dragón que pierde su fuego', area: 'Lengua Castellana y Literatura', nivel: '3º de Primaria', numEjercicios: 6, niveles: false, contextoClase: '', lectura: true },
      {
        titulo: 'El dragón que perdió su fuego', explicacion: '', instrucciones: 'Lee el texto con calma y contesta a las preguntas.', estilo: 'cuaderno', formato: 'ficha',
        lectura: {
          genero: 'cuento',
          parrafos: [
            'En lo alto de una montaña vivía Brasa, un dragón verde con las alas muy grandes. Cada mañana soplaba una llama para calentar el valle.',
            'Un día, Brasa se resfrió y su fuego se apagó. Intentó soplar, pero solo le salió una nube de humo pequeña. El dragón se puso muy triste.',
            'Una niña llamada Lía subió a la cueva con una linterna y un termo de caldo caliente. Brasa lo tomó despacio y, poco a poco, sintió calor por dentro.',
            'Al día siguiente, el fuego volvió. Brasa dio las gracias a Lía y, desde entonces, juntos encendieron cada mañana la chimenea del pueblo.',
          ],
          dibujos: [{ ilustracion: 'cue-dragon', parrafo: 0 }, { ilustracion: 'obj-linterna', parrafo: 2 }, { ilustracion: 'cue-libro-magico', parrafo: 3 }],
          pista: 'Fíjate en cómo se siente Brasa al principio y al final.', destrezas: ['Vocabulario', 'Orden de los hechos'],
        },
        actividades: [
          { titulo: 'Buscamos en el texto', dificultad: 1, ejercicios: [
            ej('en_texto', { enunciado: 'Rodea en el texto las palabras que dicen cómo es Brasa.', lineasRespuesta: 2, solucion: 'verde, alas muy grandes' }),
            ej('ordenar', { enunciado: 'Numera los hechos según el orden en que ocurren.', elementos: ['Brasa se resfría y su fuego se apaga.', 'Lía sube con una linterna y un termo.', 'El fuego vuelve.', 'Brasa sopla una llama cada mañana.'], solucion: '4, 1, 2, 3' }),
          ] },
          { titulo: 'Pensamos', dificultad: 2, ejercicios: [
            ej('contestar', { enunciado: 'Contesta.', preguntas: ['¿Por qué se apagó el fuego de Brasa?', '¿Qué llevó Lía a la cueva?'], solucion: 'Porque se resfrió. Una linterna y un termo de caldo caliente.' }),
            ej('verdadero_falso', { enunciado: 'Marca verdadero o falso.', afirmaciones: ['Brasa vive en el mar.', 'Lía ayudó al dragón.'], solucion: 'Falso, verdadero' }),
          ] },
          { titulo: 'Opinamos y creamos', dificultad: 3, ejercicios: [
            ej('dibujar', { enunciado: 'Dibuja a Lía y a Brasa juntos en la cueva.', lineasRespuesta: 1 }),
            ej('abierta', { enunciado: '¿Qué otra cosa podría haber hecho Lía para ayudar al dragón? Escríbelo.', solucion: 'Respuesta libre.' }),
          ] },
        ],
      }),
    // Escape room: cada bloque es una sala con su candado
    escape: ficha('ej-fic3', -7, p5, 'Escape room: el tesoro de las fracciones',
      { tema: 'Fracciones equivalentes', area: 'Matemáticas', nivel: '5º de Primaria', numEjercicios: 6, niveles: false, contextoClase: '', formato: 'escape' },
      {
        titulo: 'El tesoro de las fracciones', explicacion: 'Dos fracciones son equivalentes cuando valen lo mismo: 1/2 y 2/4 son equivalentes.', instrucciones: 'Resuelve cada sala para obtener el código del candado y abrir la puerta.',
        estilo: 'espacio', formato: 'escape',
        historia: { personaje: 'Capitana Nova', emoji: '🚀', mision: 'La nave está atrapada en una estación abandonada. Abre las tres salas para llegar a los motores.', cierre: 'Habéis salido a tiempo. ¡Buen trabajo, tripulación!', insignia: 'Piloto de las fracciones' },
        actividades: [
          { titulo: 'Sala 1: la compuerta', emoji: '🔒', narrativa: 'Cada respuesta correcta te da una cifra del candado.', candado: { codigo: '417', pista: 'Une los numeradores de las tres respuestas.' },
            ejercicios: [ej('abierta', { enunciado: 'Escribe una fracción equivalente a 2/4.', solucion: '1/2' }), ej('abierta', { enunciado: '¿Cuántos sextos son lo mismo que 1/3?', solucion: '2' })] },
          { titulo: 'Sala 2: el laboratorio', emoji: '🔬', narrativa: 'Los tubos de ensayo guardan la segunda pista.', candado: { codigo: '362', pista: 'Suma los resultados de cada problema.' },
            ejercicios: [ej('problema', { enunciado: 'Una tarta se parte en 8 trozos y se comen 4. ¿Qué fracción queda? Simplifícala.', solucion: '4/8 = 1/2' })] },
          { titulo: 'Sala 3: los motores', emoji: '⚙️', narrativa: 'Último esfuerzo antes de arrancar.', candado: { codigo: '905', pista: 'Ordena las fracciones de menor a mayor y une sus cifras.' },
            ejercicios: [ej('ordenar', { enunciado: 'Ordena de menor a mayor.', elementos: ['3/4', '1/2', '1/4'], solucion: '1/4, 1/2, 3/4' })] },
        ],
      }),
    // Tarjetas para recortar y doblar
    tarjetas: ficha('ej-fic4', -8, p5, 'Tarjetas: el ciclo del agua',
      { tema: 'El ciclo del agua', area: 'Conocimiento del Medio', nivel: '5º de Primaria', numEjercicios: 8, niveles: false, contextoClase: '', formato: 'tarjetas' },
      {
        titulo: 'Tarjetas del ciclo del agua', explicacion: '', instrucciones: 'Recorta cada tarjeta, dóblala por la mitad y estudia con un compañero.', estilo: 'clasico', formato: 'tarjetas', actividades: [],
        tarjetas: [
          { pregunta: '¿Cómo se llama el paso de líquido a gas?', respuesta: 'Evaporación' },
          { pregunta: '¿Qué forma el vapor de agua al enfriarse en el cielo?', respuesta: 'Las nubes (condensación)' },
          { pregunta: '¿Qué es la precipitación?', respuesta: 'El agua que cae de las nubes en forma de lluvia, nieve o granizo.' },
          { pregunta: '¿Dónde se almacena el agua dulce?', respuesta: 'En ríos, lagos, acuíferos y glaciares.' },
        ],
      }),
  };
}

/**
 * Lo que llegó entre la 2.14 y la 2.21 y la demo aún no enseñaba (26-10-2026): un juego de tarjetas interactivas
 * (imagen en una cara y texto en la otra) y las sesiones de una situación de aprendizaje, con imágenes.
 * `imagenes` son `data:image/jpeg` ya hechas por `capturar.mjs` a partir del catálogo de ilustraciones.
 */
export function nuevasAula({ clases, sdaId, imagenes }) {
  const clase = n => clases.find(c => c.name.startsWith(n)) ?? clases[0];
  const p5 = clase('5º Primaria A');
  const tj = (texto, imagen, imagenDelante) => ({ texto, imagen, imagenTipo: 'ilustracion', imagenDelante });
  const interactivas = {
    id: 'ej-fic5', at: instante(-7), date: dia(-7), class_id: p5.id, class_name: p5.name, title: 'Tarjetas interactivas: el tiempo y la naturaleza',
    request: { tema: 'El tiempo y la naturaleza', area: 'Conocimiento del Medio', nivel: '5º de Primaria', numEjercicios: 8, niveles: false, contextoClase: '', formato: 'tarjetas', interactivas: true },
    content: {
      titulo: 'El tiempo y la naturaleza', explicacion: '', instrucciones: 'Toca cada tarjeta para girarla.', estilo: 'clasico', formato: 'tarjetas', actividades: [], interactivas: true,
      tarjetasInteractivas: [
        tj('La lluvia', 'nat-lluvia', true), tj('El sol', 'nat-sol', true), tj('El arcoíris', 'nat-arcoiris', true), tj('La tormenta', 'nat-tormenta', true),
        tj('El viento', 'nat-viento', true), tj('El río', 'nat-rio', true), tj('La cascada', 'nat-cascada', true), tj('El volcán', 'nat-volcan', true),
      ],
    },
  };
  const sesion = (n, titulo, objetivo, inicio, desarrollo, cierre, material, conImagenes, completada) => ({
    id: `ej-ses${n}`, titulo, claseId: p5.id, fecha: dia(-4 + n * 2), completada, sdaId, sdaOrden: n,
    objetivo, calentamiento: inicio, principal: desarrollo, calma: cierre, material, inclusion: 'Los equipos llevan un guion con pasos y un apoyo visual. Quien lo necesite tiene más tiempo y la calculadora.', planB: 'Si llueve, el mercado se hace en el aula con las mesas en U.',
    imagenes: conImagenes ? imagenes.map((im, i) => ({ id: `ej-im${n}${i}`, src: im.src, ancho: im.ancho, alto: im.alto, pie: im.pie })) : [],
  });
  const sesiones = [
    sesion(1, 'Preparamos los puestos del mercado', 'Organizar los equipos y calcular el precio de cada producto.', 'Se presenta el proyecto con preguntas: ¿qué vendería tu equipo y a qué precio?', 'Cada equipo reparte sus roles, elige sus productos y calcula el precio con el coste de los envases.', 'Cada portavoz cuenta en una frase qué venderá su puesto.', 'Calculadoras, cartulinas, tablas de precios', true, true),
    sesion(2, 'Los carteles y los precios', 'Escribir un cartel claro con el precio y el mensaje de reutilizar.', 'Se comentan dos carteles de ejemplo: qué se entiende y qué falta.', 'Los equipos diseñan su cartel con un titular, el precio y un dibujo, y lo revisan con una lista de cotejo.', 'Galería rápida: cada equipo valora un cartel con un comentario amable.', 'Cartulinas, rotuladores, lista de cotejo', true, false),
    sesion(3, 'Abrimos el mercado', 'Vender y registrar las ventas con monedas de juguete.', 'Se recuerdan las normas del puesto y los turnos de compra y venta.', 'Los equipos atienden su puesto, registran las ventas en una tabla y recogen los envases.', 'Se cuenta la caja de cada equipo y se anota el balance.', 'Monedas y billetes de juguete, tablas de registro', false, false),
  ];
  return { interactivas, sesiones };
}

/** «Evaluar por foto»: lo que dejaría una corrección a medias sin guardar (el borrador de la app), para enseñar el resultado. */
export function borradorEvalFoto({ clase, alumno, categoriaId }) {
  const q = (n, enunciado, respuesta, puntosMax, puntos, estado, comentario, dudosa = false) => ({ n, enunciado, respuesta, puntosMax, puntos, estado, comentario, dudosa });
  const correccion = {
    titulo: 'Examen de fracciones',
    preguntas: [
      q('1', 'Escribe tres fracciones equivalentes a 1/2.', '2/4, 3/6 y 4/8', 2, 2, 'correcta', 'Las tres son correctas y están bien simplificadas.'),
      q('2', 'Ordena de menor a mayor: 3/4, 1/2 y 1/4.', '1/4, 1/2, 3/4', 2, 2, 'correcta', 'Orden correcto.'),
      q('3', 'Suma 1/5 + 2/5.', '3/10', 2, 1, 'parcial', 'Suma bien los numeradores, pero cambia el denominador. Con igual denominador, este se mantiene.', true),
      q('4', 'Marca con una cruz la fracción mayor: 5/8 o 3/8.', '3/8', 2, 0, 'incorrecta', 'Elige la menor. Con el mismo denominador es mayor la que tiene más numerador.'),
      q('5', 'Un alumno come 2 de los 6 trozos de una pizza. ¿Qué fracción ha comido?', '2/6', 2, 2, 'correcta', 'Correcto, y lo explica con un dibujo.'),
    ],
    comentarioGeneral: 'Buen trabajo con las fracciones equivalentes y con el orden. Repasa la suma con igual denominador y fíjate en qué fracción es mayor cuando el denominador es el mismo. Con un poco de práctica, subirás la nota.',
    puntosFuertes: ['Fracciones equivalentes', 'Ordenar fracciones', 'Problemas con dibujos'],
    aMejorar: ['Sumar fracciones con igual denominador', 'Comparar fracciones con el mismo denominador'],
    avisos: [],
  };
  return {
    datos: {
      claseId: clase.id, asignatura: '', alumnoId: alumno.id, tipo: 'examen', total: '10', nombre: 'Examen de fracciones', categoriaId, criterios: '',
      correccion, puntos: correccion.preguntas.map(p => String(p.puntos)), comentario: correccion.comentarioGeneral, hechos: [],
    },
    titulo: `${alumno.name}: Examen de fracciones`, guardadoEn: new Date(HOY.getTime() - 60000).toISOString(),
  };
}

/** Lo de Educación Física que la IA crea y los datos de ejemplo de la app no traen: una SdA y un circuito dibujado. */
export function ejemplosEF({ referencias }) {
  const act = (nombre, minutos, descripcion, organizacion, material) => ({ nombre, minutos, descripcion, organizacion, material });
  const learningSituations = [{
    id: 'ej-sdaef1', at: instante(-3), date: dia(-3), class_id: 'ef-c1', class_name: '1º ESO A', title: 'Juegos cooperativos: la isla del tesoro',
    request: {
      idea: 'Juegos cooperativos: la isla del tesoro', numero: '1', temporalizacion: 'Primer trimestre', meses: 'Octubre y noviembre', areas: ['Educación Física'], numSesiones: 4,
      nivel: '1º de ESO', etapa: 'eso', curso: 1, comunidad: 'comunitat-valenciana', contextoClase: '', metodologia: '', efModelo: 'aprendizaje-cooperativo', efModalidad: '', efMinutos: 50,
    },
    content: {
      titulo: 'Juegos cooperativos: la isla del tesoro',
      justificacion: 'El grupo supera retos motores en equipo para llegar a «la isla del tesoro». Nadie gana si no gana todo el equipo: se trabajan la comunicación, la confianza y el reparto de roles, con una intensidad de esfuerzo ajustada a cada alumno.',
      ods: 'ODS 3: Salud y bienestar. ODS 10: Reducción de las desigualdades.',
      objetivosEtapa: 'b) Desarrollar y consolidar hábitos de disciplina, estudio y trabajo en equipo. k) Conocer el funcionamiento del propio cuerpo y valorar los efectos beneficiosos del ejercicio físico.',
      competenciasClave: 'CPSAA, CC, CE, CCEC',
      explicacionCurricular: 'Las competencias específicas elegidas se centran en la interacción motriz con otras personas, la cooperación y la resolución de problemas motores.',
      areas: [{ area: 'Educación Física', competenciasEspecificas: '2. Adaptar los elementos técnicos y tácticos de las situaciones motrices. 5. Participar en juegos y actividades cooperativas respetando las reglas.', criteriosEvaluacion: '2.1 Resolver retos motores en equipo. 5.1 Colaborar con el grupo y respetar las normas del juego.', saberesBasicos: 'A. Vida activa y saludable. D. Manifestaciones de la cultura motriz: juegos cooperativos.' }],
      inclusionUniversal: 'Todas las actividades tienen versiones de menor y mayor intensidad y se puede elegir el rol (guía, cronometrador, apoyo o jugador).',
      inclusionAdicional: 'Quien no puede correr participa como estratega y árbitro del equipo, con la misma responsabilidad en el resultado.',
      inclusionIndividualizada: 'Se ofrecen señales visuales y un compañero de referencia al alumnado con medidas de nivel II o III.',
      sesiones: [
        { fase: 'Activación', titulo: 'Naufragio y reparto de roles', descripcion: 'Presentación de la isla, formación de equipos y primeros retos cooperativos.', momentos: {
          preimpacto: { texto: 'El docente presenta la historia, forma los equipos y reparte los roles.', actividades: [act('Pilla-pilla de cadenas', 8, 'Quien es pillado se agarra de la mano de quien lo ha pillado; la cadena crece hasta atrapar a todos.', 'Un solo grupo, toda la pista', 'Petos')] },
          impacto: { texto: 'Cada equipo resuelve retos para conseguir una pieza del mapa.', actividades: [act('El puente de aros', 15, 'El equipo cruza la pista pisando solo dentro de los aros, que se pasan entre sí sin que nadie toque el suelo.', 'Equipos de 6, un cono de salida y otro de llegada', 'Aros y conos')] },
          postimpacto: { texto: 'Puesta en común sobre cómo se han coordinado y estiramientos.', actividades: [act('Estiramientos en círculo', 6, 'En círculo, cada persona propone un estiramiento y el grupo lo repite contando hasta diez.', 'Círculo, parejas', 'Ninguno')] },
        } },
        { fase: 'Desarrollo', titulo: 'La travesía del equipo', descripcion: 'Retos de coordinación y de comunicación sin hablar.' },
        { fase: 'Desarrollo', titulo: 'La cueva oscura', descripcion: 'Circuito de confianza con guía y ojos vendados por parejas.' },
        { fase: 'Cierre', titulo: 'El tesoro y la reflexión', descripcion: 'Reto final de todo el grupo y autoevaluación del trabajo en equipo.' },
      ],
      metodologia: 'Aprendizaje cooperativo: cada alumno tiene un rol y todo el equipo es responsable del resultado.',
      agrupamiento: 'Equipos heterogéneos de seis, con roles rotativos.',
      recursos: 'Aros, conos, petos, cuerdas y antifaces.',
      productoFinal: 'El reto final de la isla del tesoro y un diario de equipo con lo aprendido.',
      evaluacionTecnicas: 'Observación sistemática y autoevaluación del trabajo en equipo.',
      evaluacionInstrumentos: 'Lista de cotejo de cooperación y rúbrica de participación.',
      normativa: { comunidad: 'comunitat-valenciana', origen: 'autonomico', cita: 'Decreto 107/2022, de 5 de agosto (DOGV núm. 9403, de 12 de agosto de 2022)' },
      ef: { modelos: ['aprendizaje-cooperativo'], referencias },
    },
  }];
  const cono = (i, x, y) => ({ id: `ej-pz-c${i}`, material: 'cono', x, y, giro: 0, escala: 1 });
  const pizarras = [{
    id: 'ej-piz1', nombre: 'Circuito de agilidad',
    elementos: [
      { id: 'ej-pz-e1', material: 'estacion', x: 110, y: 470, giro: 0, escala: 1, texto: '1' },
      cono(1, 230, 440), cono(2, 330, 330), cono(3, 430, 440), cono(4, 530, 330),
      { id: 'ej-pz-a1', material: 'aro', x: 650, y: 300, giro: 0, escala: 1 }, { id: 'ej-pz-a2', material: 'aro', x: 730, y: 380, giro: 0, escala: 1 }, { id: 'ej-pz-a3', material: 'aro', x: 810, y: 300, giro: 0, escala: 1 },
      { id: 'ej-pz-b1', material: 'banco', x: 780, y: 160, giro: 0, escala: 1.1 },
      { id: 'ej-pz-e2', material: 'estacion', x: 900, y: 460, giro: 0, escala: 1, texto: '2' },
    ],
    trazos: [
      { id: 'ej-pz-t1', tipo: 'flecha', color: '#2563eb', puntos: [[130, 470], [230, 420], [330, 350], [430, 420], [530, 350], [620, 320]] },
      { id: 'ej-pz-t2', tipo: 'flecha', color: '#2563eb', puntos: [[650, 320], [730, 395], [810, 320], [860, 220], [800, 175]] },
    ],
  }];
  return { learningSituations, pizarras };
}

/** Lo de PT y AL que la IA crea y los datos de ejemplo de la app no traen: los documentos de un alumno. */
export function ejemplosApoyo({ titulos }) {
  const ap = (id, titulo, texto) => ({ id, titulo, texto });
  const documentos = [
    {
      id: 'ej-doc1', alumnoId: 'demo-a1', tipo: 'familia', trimestre: 1, fecha: dia(-2), titulo: titulos.familia,
      apartados: [
        ap('trabajado', 'Lo trabajado y cómo avanza', 'Este trimestre hemos trabajado la lectura de sílabas directas y los números hasta el 100. Alumno 1 ya lee sílabas con más fluidez y cuenta con material hasta el 100. Todavía le cuesta separar las palabras en sílabas, y lo seguiremos practicando.'),
        ap('respuesta', 'Cómo ha respondido', 'Mantiene la atención más tiempo con tarjetas grandes y juegos cortos. Se motiva mucho cuando puede elegir la actividad. Participa con mucho interés y trabaja con una buena conducta.'),
        ap('casa', 'Orientaciones para casa', '- Leer cinco minutos al día con un cuento de frases cortas.\n- Contar objetos de casa (cubiertos, botones…) hasta el 20.\n- Jugar a encontrar palabras que empiecen por la misma sílaba.\n- Felicitarle por cada pequeño logro.'),
        ap('proximo', 'Objetivos del próximo trimestre', '- Segmentar palabras en sílabas.\n- Sumar sin llevar con material manipulativo.\n- Leer frases sencillas comprendiendo su sentido.'),
      ],
    },
    {
      id: 'ej-doc2', alumnoId: 'demo-a1', tipo: 'programacion', fecha: dia(-12), titulo: titulos.programacion,
      apartados: [
        ap('justificacion', 'Justificación y marco normativo', 'Alumno 1 presenta una discapacidad intelectual leve que exige medidas de respuesta educativa de nivel III. Esta programación se enmarca en el Decreto 104/2018, de la Conselleria, que regula los principios de equidad e inclusión, y se apoya en el Diseño Universal para el Aprendizaje.'),
        ap('partida', 'Necesidades educativas y punto de partida', 'Le cuesta mantener la atención más de diez minutos. Aprende mejor con apoyo visual y con tareas cortas, y se motiva con los juegos. Lee sílabas directas y cuenta hasta el 50 con ayuda.'),
        ap('objetivos', 'Objetivos por ámbito y trimestre', 'Lectoescritura: leer sílabas directas con fluidez; segmentar palabras en sílabas; leer frases sencillas.\nMatemáticas: contar y escribir números hasta el 100; sumar sin llevar con material manipulativo.'),
        ap('metodologia', 'Metodología', 'Sesiones de 45 minutos fuera del aula, en grupo reducido, con una agenda visual al comienzo, tareas cortas y refuerzo positivo inmediato. Se usan materiales manipulativos y juegos.'),
        ap('recursos', 'Recursos y materiales', '- Tarjetas de sílabas con pictogramas.\n- Regletas y bloques lógicos.\n- Juegos de mesa de lectura y cálculo.'),
        ap('coordinacion', 'Coordinación con el tutor, el equipo y la familia', 'Reunión trimestral con la tutora de 4.º B para acordar adaptaciones de las fichas, y contacto con la familia al finalizar cada trimestre mediante el informe.'),
        ap('evaluacion', 'Evaluación', 'Se evalúa con el registro diario de cada sesión (conseguido, en proceso, no conseguido) y con la respuesta del alumno. Al final de cada trimestre se redacta un informe a la familia y al equipo.'),
      ],
    },
  ];
  return { documentos };
}
