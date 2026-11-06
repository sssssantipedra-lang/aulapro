# Auditoría adversarial de lo que va a la IA (5-11-2026)

Pedida por el dueño tras la revisión de su abogado. Se construyó una batería de casos adversariales (nombres inventados) contra los filtros de `services/privacy.ts` y `lib/documentoParaIA.ts`, y se revisaron todas las pantallas que llaman a `callGemini` y todos los usos de `useAdjuntoParaIA`. Las baterías quedan como pruebas: `src/services/privacy.adversarial.test.ts` y `src/lib/documentoParaIA.adversarial.test.ts`. Antes de las correcciones fallaban 54 de 70 casos; después, solo los 4 que no se pueden filtrar (último apartado).

## 1. Fugas encontradas, con su ejemplo mínimo

Cada línea: lo que se enviaba a Google tal cual, y dónde está la corrección.

### Nombres del alumnado (`services/privacy.ts`)

| Fuga | Ejemplo mínimo (alumna «Lucía Pérez Navarro») | Corrección |
|---|---|---|
| Apellidos solos | «Pérez Navarro ha faltado» → salían los apellidos | Se tapan los apellidos juntos, y cada apellido solo con mayúscula si tiene 4 letras o más y no es una palabra o un lugar (`APELLIDOS_PALABRA`) |
| Lista con el orden invertido | «PÉREZ NAVARRO, LUCÍA» → «PÉREZ NAVARRO, [ALU-1]» | Apellidos tapados y los códigos repetidos se juntan en uno |
| Nombre con el segundo apellido | «Lucía Navarro» → «[ALU-1] Navarro» | Se tapa el nombre con cualquier combinación de sus apellidos |
| Apellidos con partícula | «García de la Torre», «El Amrani» → salían | Las partículas van con el apellido (`unidadesDeApellido`) |
| Nombre de pila en minúscula | «lucía va mal» → salía | Se tapa si tiene 4 letras o más y no es una palabra corriente (`NOMBRES_PALABRA`: «rosa», «marco», «pau»…) |
| Tildes como acento combinado (forma NFD) | «Lucía» (como lo escribe algún PDF o Mac) → salía | `textoNormal` compone el texto antes de buscar |
| Guion blando o carácter de anchura cero dentro del nombre | «Lu­cía» → salía | `textoNormal` los quita |
| Corte de línea con guion dentro de la palabra | «Lu-⏎cía Pérez» (PDF a dos columnas) → salía | El patrón admite el guion de fin de línea entre letras |
| Apóstrofo tipográfico | «O’Neil» con la alumna «O'Neil» → salía | Los dos apóstrofos valen |
| Apellido que comparten dos alumnos | «Pérez» con dos hermanos → salía | Código propio que vuelve como «Pérez», como ya pasaba con «Ana» |

### Datos de contacto (`quitarDatosDeContacto`)

| Fuga | Ejemplo mínimo | Corrección |
|---|---|---|
| Teléfono extranjero | «+44 7911 123456», «0033 6 12 34 56 78» | Prefijo internacional seguido de 7 a 12 cifras |
| Prefijo entre paréntesis | «(96) 123 45 67» | Se admite el paréntesis |
| Separación irregular | «96 12 34 567» | Nueve cifras con cualquier separación |
| Correo disimulado | «lucia (at) gmail.com», «lucia [arroba] gmail . com» | Patrón para «(at)», «[arroba]», «(dot)», «(punto)» |
| Usuario de redes | «@lucia_pn_2015» | «[usuario]» |
| DNI en minúscula | «12345678z», «x-1234567-l» | Letra en minúscula pegada |
| Fecha de nacimiento sin etiqueta | «Edad: 10 años (03/05/2015)», «nació el 3/5/2015», «nacida 3 de mayo de 2015» | Etiquetas nuevas («nació», «va néixer», «F. Nac.») y, sin etiqueta, toda fecha completa de hace entre 3 y 22 años (`esFechaDeNacimiento`) |
| Expediente o identificador corto | «Exp. 2023/0456», «expediente nº 4567-B», «tarjeta sanitaria 123 456 78 90» | Con su etiqueta, aunque tenga menos de 7 cifras |
| IBAN | «ES91 2100 0418 4502 0005 1332» | «[número]» |
| Dirección en texto libre | «vive en C/ Mayor 12, 3ºB» | «[dirección]» |
| Código postal | «Código postal: 46100», «C.P.: 46100» | Etiqueta de lugar y patrón propio |
| Centro educativo por su nombre | «viene del CEIP Las Acacias», «IES Pere Boïl», «Colegio San José» | «[centro]» |

### Datos de salud (`quitarDatosDeSalud`)

| Fuga | Ejemplo mínimo | Corrección |
|---|---|---|
| Siglas en minúscula | «tiene tdah» | Las siglas que en minúscula no son otra palabra (`SIGLAS_MINUSCULA`) |
| Siglas con puntos | «T.D.A.H.», «T.E.A.» | Patrón con puntos opcionales |
| Grado o porcentaje detrás | «TEA grado 1», «discapacidad intelectual leve (33%)» → quedaba «grado 1», «33%» | `GRADO` admite el grado y el porcentaje |
| Déficit sin «de atención» | «déficit atencional», «déficit auditivo» | Nuevas colas |
| Medicación por su nombre | «Medikinet», «Ritalin», «atomoxetina», «melatonina», «insulina», «Ventolín», «EpiPen», «se toma la pastilla» | Lista de fármacos y «pastilla», «comprimido», «jarabe», «inhalador» |
| Alergias e intolerancias | «alergia a los frutos secos», «intolerancia a la lactosa», «anafilaxia» | Con su complemento («a los frutos secos») |
| Salud mental | «ansiedad», «ataques de pánico», «fobia escolar», «mutismo selectivo», «autolesiones», «ideación suicida», «anorexia», «TCA» | Nuevas palabras |
| Habla y lenguaje | «tartamudea», «dislalia», «va al logopeda», «terapia ocupacional» | Nuevas palabras |
| Especialistas y servicios | «la ve el psicólogo», «neurólogo», «pediatra», «USMIJ», «CSMIJ», «atención temprana» | Nuevas palabras y siglas |
| Síndrome sin la palabra | «niño Down» | «Down» con mayúscula |
| Categorías de necesidades | «altas capacidades», «AACC», «alumno NEAE», «ACNEE», «dictamen de escolarización» | Nuevas palabras y siglas |
| Retrasos del desarrollo | «retraso madurativo», «retraso del lenguaje» | Nuevas colas |
| Enfermedad, hospital, lesiones | «enfermedad crónica», «ingresado en el hospital», «operado del corazón», «leucemia», «convulsiones», «lesión de rodilla por su artritis», «esguince» | Nuevas palabras |
| Movilidad | «silla de ruedas», «muletas», «prótesis» | Nuevas palabras |
| Catalán e inglés | «al·lèrgia», «malaltia», «cadira de rodes», «psicòleg»; «allergic», «anxiety», «wheelchair», «gifted» | En los tres idiomas |

### Documentos (`quitarIdentificadores`, `textoDeDocx`)

| Fuga | Ejemplo mínimo | Corrección |
|---|---|---|
| Etiquetas de familia | «Padres: Elena Mir y Luis Sanz», «Hermanos: Dani», «Abuela: Pilar», «Representante legal:», «Persona de contacto:» | Etiquetas nuevas de persona |
| Etiquetas de especialistas y de quien firma | «Logopeda: Eva Roca», «Pediatra: Dr. Jaime Soto», «Jefa de estudios:», «Profesora de PT:», «Elaborado por:», «Firma:» | Etiquetas nuevas; «Profesor/a de X:» admite el complemento |
| Etiqueta en otro idioma | «Nom de l'alumne: Jordi Puig» | Etiqueta nueva |
| Etiqueta sin dos puntos | «Nombre y apellidos  Carla Sanz Mir» (tabla de PDF) | Las etiquetas fuertes al inicio de línea seguidas de dos espacios o un tabulador se tratan como etiqueta |
| Tabla con separadores | «Nombre;Apellidos;Fecha nac.;Tel⏎Carla;Sanz Mir;03/05/2015;612345678» | `taparColumnas`: las columnas cuya cabecera es una etiqueta se tapan en todas las filas |
| Tratamientos | «D.ª Marta Gil», «Prof. Soto», «Profa. Vila», «Hno. Pedro» | Tratamientos nuevos |
| Un tratamiento arrastraba la línea siguiente | «Pediatra: Dr. Jaime Soto⏎Jefa de estudios: Inés Vila» → se comía «Jefa de estudios» y dejaba «Inés Vila» | El nombre tras un tratamiento no cruza de línea |
| Word con control de cambios | El nombre borrado en una revisión seguía en `document.xml` y llegaba | `textoDeDocx` quita `w:del` y `w:delText` |

### Pantallas que mandaban texto libre sin pasar por `textoLibreParaIA`

| Pantalla | Lo que iba sin filtrar | Ejemplo mínimo |
|---|---|---|
| Asistente del cuaderno (`services/aiContext.ts`) | El centro del docente; los eventos de la agenda y su descripción; las tareas; el texto de los informes; el nombre de un alumno dado de baja en evaluaciones e informes (ya no está en la lista, así que `callGemini` no lo tapaba) | «Reunión con la madre de Carmen (612 345 678)», «Pedir el informe del neurólogo» |
| Asistente del cuaderno y chat de ayuda (la pregunta y el historial) | Teléfonos, DNI y, si nombra a un alumno, datos de salud | «¿Qué hago con Lucía, que tiene TDAH?» |
| Agrupamientos (`services/classGroups.ts`) | Avisos, anotaciones y notas del docente | aviso «TDAH», anotación «toma Rubifen» |
| Actas y memorias (`services/workSessions.ts`) | Título, convocante, lugar y asistentes | «Asistentes: madre (612 345 678)» |
| PT y AL (`services/apoyoIA.ts`, `apoyoDocumentos.ts`, `apoyoAdaptacion.ts`, `lib/apoyo.ts`) | Objetivos que ya tiene, tema de la clase, ámbito, coordinaciones en la programación, objetivos del próximo trimestre, objetivos en la ficha adaptada, objetivos en la adaptación de la programación | objetivo «Reducir la disfemia en lectura» |
| Educación Física (`services/efIA.ts`) | «Otra» limitación o necesidad escrita a mano, el tema y la nota de la foto | «No puede correr, lesión de rodilla por su artritis» |
| Situaciones de aprendizaje, fichas y tarjetas (`learningSituations.ts`, `resources.ts`) | «Cómo es el grupo» | «Dos alumnos con TEA y uno con TDAH» |
| Rúbricas (`pages/Rubrics.tsx`) | La descripción del trabajo del alumno (la función está apagada por `CORRECCION_CON_IA`, pero el código sigue) | «El alumno tiene TDAH, tener en cuenta» |

No cambian: el escáner de horarios (archivo del docente, sin alumnado), los manuales e inventarios de Educación Física, la normativa y las SdA importadas, que siguen yendo tal cual como dice la privacidad. `useAdjuntoParaIA` se usa en el asistente del cuaderno y en las rúbricas, en los dos casos con `textoDeDocumento`. No se envía el nombre de ningún archivo adjunto. Los PDF solo aportan el texto de las páginas (ni metadatos, ni campos de formulario, ni anotaciones); los Word, solo `document.xml` (ni encabezados ni pies, ni comentarios, ni ya lo borrado).

## 2. Lo que no se puede filtrar (y así lo dice la privacidad)

- **Un nombre que no está en la lista del alumnado** (un familiar, un compañero de otro centro) **escrito a mano sin etiqueta ni tratamiento delante**: «Hoy Carla ha venido contenta.» No hay forma de saber que «Carla» es una persona sin una lista de nombres de pila, y esa lista taparía palabras y nombres de autores en el material didáctico.
- **Apodos y diminutivos**: «Lu», «Marquitos», «Rosi». Solo se taparían con un diccionario de diminutivos que tampoco sería completo.
- **Un nombre pegado a otra cosa sin separación**: «LuciaPerez», «Lucía2».
- **Una descripción clínica sin palabras clave**: «le cuesta mantener la mirada, repite frases y aletea cuando se emociona». Es, además, justo lo que sirve para adaptar. Por eso el texto de un documento se enseña antes de enviarlo.
- **Un dato de salud de un alumno al que se señala sin su nombre** en un chat: «el de la tercera fila toma medicación» se filtra solo si la pregunta nombra a un alumno de la lista; con «el de la tercera fila», no (y en los demás textos sobre el alumnado sí se filtra siempre).
- **Siglas que son otra palabra en minúscula**: «tea» (té en inglés), «toc» (catalán), «add», «tel». En mayúsculas sí se tapan.
- **Apellidos que son palabras o lugares, solos**: «Toledo», «Blanco», «Roig», «Smith». Junto al nombre o al otro apellido sí.
- **Una fecha de nacimiento de un alumno de menos de 3 años o escrita solo con el año** («2015»).
- **Lo que hay dentro de una imagen**: en las fotos del trabajo, el docente tapa el nombre a mano; una foto de una actividad, un horario, un manual o un PDF escaneado van tal cual, como dice la privacidad.
- **Lo que la IA pueda inferir** de lo que sí se envía (que un alumno con «necesita instrucciones cortas y apoyo visual» tiene una necesidad educativa). Eso es, por decisión del dueño y de su abogado, lo que se envía para poder adaptar.

## 3. Decisiones que conviene conocer

- El nombre de pila en minúscula y el apellido solo con mayúscula se tapan ahora. El coste: si un apellido o un nombre poco corriente coincide con una palabra que no está en las listas de excepciones, la IA recibe un código donde había una palabra y la respuesta puede sonar rara. Es un fallo de calidad, no de privacidad; las listas (`NOMBRES_PALABRA`, `APELLIDOS_PALABRA`) se amplían cuando aparezca un caso.
- Las fechas completas de hace entre 3 y 22 años se quitan en todos los textos sobre el alumnado aunque no lleven etiqueta. Una fecha antigua de otra cosa (la de un informe anterior) se pierde también: se consideró preferible.
- En los chats, el filtro de salud solo entra cuando la pregunta nombra a un alumno de la lista, para no estropear «¿cómo explico la diabetes en 5º?». Los datos de contacto se quitan siempre.
- El asistente del cuaderno ya no recibe el centro del docente: no hacía falta para responder y acotaba demasiado junto a los códigos de toda una clase.
- `VERSION_USO_IA` pasa a `2026-11-05`: quien ya había aceptado vuelve a ver la casilla con el texto nuevo (apellidos solos, lesiones, direcciones, centros, chats).
