# Publicar en Google Play y Microsoft Store

Todo lo que hace falta para enviar AulaPro a las dos tiendas: textos de la ficha en los tres idiomas, notas para quien revisa, respuestas de los formularios y la lista de lo que hay que hacer antes. Preparado el 25-10-2026, con la privacidad de la web ya al día con lo que la app envía fuera (Gemini, Lemon Squeezy, contenido incrustado en la pizarra).

Decisión del dueño (25-10-2026): **se cobra solo con Lemon Squeezy**, en la web. Las dos tiendas llevan la app gratuita, que se activa con la clave. No hay compras dentro de la app ni sistema de pago de las tiendas. Si Google la rechaza por eso, se decide entonces (ver el apartado 5).

Los límites de caracteres y los formularios de las tiendas cambian: se han puesto de memoria y **hay que comprobarlos en Play Console y Partner Center** al rellenar. Los textos de la ficha llevan sus recuentos de caracteres entre corchetes.

## 1. Antes de enviar nada

1. **Clave obligatoria (`ENFORCED`): hecho el 27-10-2026 (`true` en los dos archivos, `FOUNDER_CUTOFF = '2026-11-10'` (fijado por el dueño)).** Antes: Hoy, en `electron/license.cjs` y `src/platform/androidLicense.ts`, `ENFORCED = false` y `FOUNDER_CUTOFF = ''`: la app **no pide clave** y todo el que la abre queda como fundador, gratis para siempre. Con eso publicado en las tiendas, la app sería gratuita para quien la descargue. La versión que se envíe a las tiendas tiene que llevar `ENFORCED = true` (y, si se quiere, una `FOUNDER_CUTOFF`). Hay que cambiar los dos archivos a la vez y actualizar `docs/WEB.md`, apartado 3, punto 4.
2. **Crear una clave para quien revisa.** Google y Microsoft tienen que poder abrir la app. Con `ENFORCED = true` necesitan una clave: crea una en Lemon Squeezy (por ejemplo, con un código de descuento del 100 % en el producto individual) con un límite de activaciones holgado, y guarda la clave aparte. Se pega en las notas de cada tienda (marcada como `CLAVE_DE_REVISION`). Cuando acabe la revisión, desactívala.
3. **Cuentas.**
   - Microsoft: la ficha ya existe (nombre «AulaPro» reservado, Store ID `9N9WJW9C24DN`, identidad en `docs/WEB.md`, apartado 4). Falta subir el paquete `AulaPro-<versión>-microsoft-store.appx` de cada versión.
   - Google Play: cuenta de desarrollador (25 $, una vez). Las cuentas personales nuevas pueden tener que pasar una **prueba cerrada** con un número mínimo de probadores durante unas semanas antes de poder publicar: comprueba el requisito actual en Play Console al crear la cuenta, porque condiciona la fecha.
4. **Capturas de pantalla**, siempre con datos de ejemplo (regla 7 de `CLAUDE.md`: «Alumno 1», «Profesor»; nada de nombres reales):
   - Google Play: 4 a 8 capturas del móvil, hechas en un Android real con «Cargar datos de ejemplo». Además, icono de 512 × 512 (sale de `public/favicon-mini.svg`) y gráfico de funciones de 1024 × 500 (hay que diseñarlo).
   - Microsoft Store: 3 a 6 capturas de escritorio, de 1366 × 768 o más, en PNG. Sirven las de `web/sitio/assets/app/` (1920 × 1008, en WebP: convertirlas a PNG) o las que genera `scripts/web/capturar.mjs`.
5. **Política de privacidad**: https://aulapro.app/privacidad (pública, sin cuenta). Las dos tiendas piden la dirección. Contacto de soporte: contacto@aulapro.app. Web: https://aulapro.app.
6. **Inconsistencias a arreglar antes (reglas 1 y 3 de `CLAUDE.md`):**
   - **Trabajo compartido.** Resuelto el 25-10-2026 (2.20.0): ya no hay conexión entre equipos, QR ni cámara; es un archivo cifrado con contraseña (`docs/COMPARTIR.md`). La privacidad de la web lo cuenta así. Lo único que sale a internet por esa vía es el archivo, si el docente lo manda por correo o por la nube.
   - **Nombre.** Resuelto el 26-10-2026: el nombre es «AulaPro», todo junto, en la app, los instaladores, la web y las fichas. La carpeta de datos de Windows y Mac sigue llamándose «Aula Pro» (`electron/main.cjs` la fija) para no dejar sin datos a quien ya usaba la app.
   - **Aviso de Windows.** `docs/INSTALACION.md` explica el aviso «Windows protegió su PC» del instalador de la web. La versión de Microsoft Store va firmada por Microsoft y no lo muestra: conviene decirlo en la web cuando esté publicada.

## 2. Google Play

### 2.1 Datos generales

| Campo | Valor |
|---|---|
| Nombre de la app | AulaPro: IA para docentes |
| Identificador | `es.aulapro.app` (ya en `android/app/build.gradle`; no se puede cambiar después) |
| Tipo y precio | App, gratuita |
| Categoría | Educación |
| Etiquetas | Educación, Productividad |
| Correo de contacto | contacto@aulapro.app |
| Sitio web | https://aulapro.app |
| Política de privacidad | https://aulapro.app/privacidad |
| Idioma predeterminado | Español (España); además Catalán y Inglés |
| Anuncios | No |
| Público objetivo | **Mayores de 18 años** (docentes). No marcar ningún tramo de menores de edad: la app no está dirigida a niños, aunque el alumnado participe en «Actividades con móviles» desde el navegador del docente. |

### 2.2 Ficha en castellano

**Título** [25 de 30]: `AulaPro: IA para docentes`

**Descripción breve** [75 de 80]:
`Situaciones de aprendizaje, rúbricas e informes LOMLOE con IA. Sin cuentas.`

**Descripción completa** [menos de 4000]:

```
AulaPro es la app para docentes de Educación Primaria y Secundaria que prepara con IA el papeleo de la evaluación LOMLOE y lo reúne todo en un solo sitio. Los datos de tu alumnado se quedan en tu dispositivo. Sin cuentas, sin registro y sin servidor propio.

PREPARA CON IA
• Situaciones de aprendizaje para una o varias clases, con PDF, Word y cartel A4.
• Rúbricas y dianas de evaluación, con criterios y niveles de logro.
• Informes de competencias clave, con una tabla de competencias y un comentario de cada una.
• Fichas de trabajo de menos a más, con dibujos, comprensión lectora, escape rooms y tarjetas.
• Evaluar por foto: fotografías un examen o un trabajo y la IA propone los puntos de cada pregunta. La nota la calcula la app y tú la revisas.

EVALÚA Y ORGANIZA
• Cuaderno de notas con categorías ponderadas y el peso que quieras para cada nota.
• Actas imprimibles con la escala IN, SU, BI, NT y SB y una segunda página con la evaluación por competencias.
• Asistencia, agenda y horario semanal.
• Currículo de la Comunitat Valenciana, Cataluña y Madrid, y el estatal para el resto de comunidades.

EN CLASE
• Pizarra y herramientas: lápiz, rotulador, temporizador, ruleta con los nombres de cada clase, grupos, dados y más.
• Anotar actitud: toda la clase en una lista, con un toque por anotación.
• Actividades con móviles: tu alumnado participa escaneando un código QR, a través de la wifi del aula.

PT Y AL Y EDUCACIÓN FÍSICA
• PT y AL: sube el informe del orientador y la IA propone la ficha del alumno y sus programas. Cierra el trimestre y prepara los documentos de todo el alumnado de una vez.
• Educación Física: sesiones y situaciones de aprendizaje con IA, equipos equilibrados, circuitos y pruebas físicas.

TUS DATOS, EN SU SITIO
• Tus notas, tu alumnado y tus documentos se guardan en tu dispositivo.
• Antes de enviar nada a la IA, los nombres se sustituyen por códigos.
• La IA funciona con tu propia clave gratuita de Google (Gemini), que se guarda cifrada.
• Copia de seguridad automática en tu dispositivo.

LICENCIA
La app se descarga gratis y se activa con una licencia, la misma para Windows y Android. Consigue tu licencia en aulapro.app.
```

**Novedades de la primera versión** [máx. 500]: `Primera versión en Google Play.`

### 2.3 Ficha en català

**Títol** [25 de 30]: `AulaPro: IA per a docents`

**Descripció breu** [77 de 80]:
`Situacions d'aprenentatge, rúbriques i informes LOMLOE amb IA. Sense comptes.`

**Descripció completa**:

```
AulaPro és l'app per a docents d'Educació Primària i Secundària que prepara amb IA la burocràcia de l'avaluació LOMLOE i ho reuneix tot en un sol lloc. Les dades del teu alumnat es queden al teu dispositiu. Sense comptes, sense registre i sense servidor propi.

PREPARA AMB IA
• Situacions d'aprenentatge per a una o diverses classes, amb PDF, Word i cartell A4.
• Rúbriques i dianes d'avaluació, amb criteris i nivells d'assoliment.
• Informes de competències clau, amb una taula de competències i un comentari de cadascuna.
• Fitxes de treball de menys a més, amb dibuixos, comprensió lectora, escape rooms i targetes.
• Avaluar per foto: fotografies un examen o un treball i la IA proposa els punts de cada pregunta. La nota la calcula l'app i tu la revises.

AVALUA I ORGANITZA
• Quadern de notes amb categories ponderades i el pes que vulguis per a cada nota.
• Actes imprimibles amb l'escala IN, SU, BI, NT i SB i una segona pàgina amb l'avaluació per competències.
• Assistència, agenda i horari setmanal.
• Currículum de la Comunitat Valenciana, Catalunya i Madrid, i l'estatal per a la resta de comunitats.

A CLASSE
• Pissarra i eines: llapis, retolador, temporitzador, ruleta amb els noms de cada classe, grups, daus i més.
• Anotar actitud: tota la classe en una llista, amb un toc per anotació.
• Activitats amb mòbils: el teu alumnat participa escanejant un codi QR, a través de la wifi de l'aula.

PT I AL I EDUCACIÓ FÍSICA
• PT i AL: puja l'informe de l'orientador i la IA proposa la fitxa de l'alumne i els seus programes. Tanca el trimestre i prepara els documents de tot l'alumnat alhora.
• Educació Física: sessions i situacions d'aprenentatge amb IA, equips equilibrats, circuits i proves físiques.

LES TEVES DADES, AL SEU LLOC
• Les teves notes, el teu alumnat i els teus documents es guarden al teu dispositiu.
• Abans d'enviar res a la IA, els noms se substitueixen per codis.
• La IA funciona amb la teva pròpia clau gratuïta de Google (Gemini), que es guarda xifrada.
• Còpia de seguretat automàtica al teu dispositiu.

LLICÈNCIA
L'app es descarrega gratis i s'activa amb una llicència, la mateixa per a Windows i Android. Aconsegueix la teva llicència a aulapro.app.
```

**Novetats de la primera versió**: `Primera versió a Google Play.`

### 2.4 Ficha en inglés

**Title** [24 of 30]: `AulaPro: AI for teachers`

**Short description** [78 of 80]:
`Learning units, rubrics and reports for Spanish teachers with AI. No accounts.`

**Full description**:

```
AulaPro is the app for Primary and Secondary teachers in Spain that prepares the LOMLOE assessment paperwork with AI and brings everything together in one place. Your students' data stays on your device. No accounts, no sign-up and no server of our own.

PREPARE WITH AI
• Learning units for one or several classes, with PDF, Word and an A4 poster.
• Assessment rubrics and target charts, with criteria and achievement levels.
• Key competency reports, with a competency table and a comment for each one.
• Worksheets that go from easier to harder, with drawings, reading comprehension, escape rooms and cards.
• Mark by photo: take a picture of an exam or a piece of work and the AI suggests the points for each question. The app calculates the grade and you review it.

ASSESS AND ORGANISE
• Gradebook with weighted categories and the weight you want for each mark.
• Printable report sheets with the IN, SU, BI, NT and SB scale and a second page with the competency assessment.
• Attendance, planner and weekly timetable.
• Curriculum for the Comunitat Valenciana, Catalonia and Madrid, and the national one for the rest of the regions.

IN CLASS
• Whiteboard and tools: pencil, marker, timer, a wheel with each class's names, groups, dice and more.
• Record behaviour: the whole class in one list, one tap per note.
• Activities with phones: your students take part by scanning a QR code over the classroom wifi.

SPECIAL EDUCATION AND PE
• Special education support: upload the guidance counsellor's report and the AI suggests the student's profile and programmes. Close the term and prepare the documents for all students at once.
• Physical Education: sessions and learning units with AI, balanced teams, circuits and fitness tests.

YOUR DATA, WHERE IT BELONGS
• Your marks, your students and your documents are stored on your device.
• Before anything is sent to the AI, names are replaced with codes.
• The AI works with your own free Google (Gemini) key, which is stored encrypted.
• Automatic backup on your device.

LICENCE
The app is free to download and is activated with a licence, the same one for Windows and Android. Get your licence at aulapro.app.
```

**What's new**: `First release on Google Play.`

### 2.5 Notas para quien revisa (Acceso a la app y pagos)

En **Contenido de la app › Acceso a la app**, elige «Todas o algunas funciones están restringidas» y pega (en inglés, que es lo que lee el equipo de revisión):

```
AulaPro is a tool for teachers. On first launch it shows an activation screen asking for a licence key.

Licence key for review: CLAVE_DE_REVISION
(It allows several activations. Enter it in the "Clave de licencia" field and tap "Activar". An internet connection is needed once, to activate.)

After activation, no sign-in is needed. The welcome screen has the button "Explore with sample data" ("Explorar con datos de ejemplo" in Spanish), which loads fictitious data; all names in it are fictitious.

About payments: the app does not sell anything. It has no in-app purchases, no prices, no purchase buttons and no links to buy. The activation screen only shows the plain text "Consigue tu licencia en aulapro.app" (no link). The licence is obtained outside the app, on the developer's website, and the same key also activates the developer's Windows version. The app is free to download.

Permissions: RECORD_AUDIO is used only by the classroom noise meter, which analyses the sound on the device and does not record or transmit it. It is optional and requested at the moment of use. The app does not request the camera permission.

If you consider that this licensing model requires a different arrangement under the Payments policy, please tell us exactly which requirement applies so we can address it.
```

Antes de pegarlo: comprueba que la clave de revisión funciona con una instalación limpia y que el botón «Explorar con datos de ejemplo» sigue en la pantalla de bienvenida (en inglés, «Explore with sample data»). Lo mismo vale para las notas de Microsoft.

### 2.6 Seguridad de los datos

Las respuestas siguen lo que la app hace de verdad (privacidad y `docs/WEB.md`, apartado 3). La decisión sobre qué se considera «compartir» es del dueño: abajo va la lectura prudente, que es la que recomiendo.

| Pregunta | Respuesta |
|---|---|
| ¿La app recopila o comparte tipos de datos del usuario? | Sí |
| ¿Todos los datos se cifran en tránsito? | **No**, mientras exista el servidor de Actividades con móviles, que va por HTTP dentro de la wifi del aula. Si se cifrara, sería Sí. Trabajo compartido ya no cuenta: el archivo va cifrado de extremo a extremo. |
| ¿Se puede pedir la eliminación de los datos? | Sí. El desarrollador no guarda datos del alumnado ni cuentas: lo del dispositivo se borra al desinstalar. Los datos de la licencia, en Lemon Squeezy, se piden a contacto@aulapro.app. |

**Tipos de datos declarados:**

| Tipo | Recopilado | Compartido | Obligatorio | Para qué |
|---|---|---|---|---|
| Identificadores de dispositivo u otros (clave de licencia e identificador de activación; el nombre del dispositivo es genérico, «AulaPro · Android») | Sí | Sí, con Lemon Squeezy (comprobación de la licencia) | Sí | Funcionalidad de la app |
| Fotos (Evaluar por foto, actividades desde una foto) | Sí | Sí, con Google (API de Gemini, con la clave del propio docente) | No, solo si usa la IA | Funcionalidad de la app |
| Archivos y documentos (PDF y manuales que el docente adjunta a la IA) | Sí | Sí, con Google | No | Funcionalidad de la app |
| Otro contenido generado por el usuario (el texto de las peticiones a la IA, con los nombres cambiados por códigos) | Sí | Sí, con Google | No | Funcionalidad de la app |

**Trabajo compartido** no añade nada a esta tabla: el archivo cifrado lo crea y lo manda el propio docente, y el desarrollador no lo recibe ni pasa por ningún servicio suyo.

**Datos que no se recopilan:** ubicación, contactos, mensajes, historial de navegación, información financiera, salud y forma física, audio y vídeo (el medidor de ruido analiza el sonido en el momento y no lo guarda ni lo envía; la cámara solo lee un QR). Anuncios y analíticas: ninguno.

**Alternativa menos prudente.** Google exime de «compartir» algunas transferencias hechas por una acción concreta del usuario o a un proveedor que trata los datos en nombre del desarrollador. Se podría defender que lo enviado a Gemini con la clave propia del docente no cuenta como compartir. No lo recomiendo: es más seguro declararlo, porque la privacidad ya lo explica con detalle, y un formulario más completo que el estricto no tiene riesgo de rechazo. Lee la ayuda «Proporcionar información para la sección Seguridad de los datos» antes de decidir.

### 2.7 Clasificación de contenido y otras declaraciones

- **Cuestionario de clasificación (IARC):** categoría «Utilidad, productividad, comunicación u otra». Sin violencia, sin contenido sexual, sin lenguaje soez, sin drogas, sin apuestas. A «¿los usuarios pueden interactuar o intercambiar contenido?», responde que sí, por Actividades con móviles y por el archivo cifrado de Trabajo compartido, que se manda fuera de la app; no es contenido público ni hay chat. Se espera una clasificación apta para todos los públicos; comprueba el resultado.
- **Anuncios:** no contiene anuncios.
- **Aplicación de noticias, de salud, financiera, gubernamental o de COVID-19:** no.
- **Permisos:** `INTERNET`, `RECORD_AUDIO` y `MODIFY_AUDIO_SETTINGS`, y la función de hardware `microphone` marcada como no obligatoria. **Sin `CAMERA`** desde la 2.20.0. Los documentos se guardan con MediaStore en Documentos › AulaPro, sin permisos de archivos. No hay permisos sensibles que requieran formulario.
- **Copia de seguridad del sistema:** `allowBackup="false"`, a propósito: los datos del alumnado no se suben a la copia de Google.
- **Dirección del desarrollador:** si Play la pide para el perfil público, es la del Aviso legal (ya pública). No se publican el DNI ni el Gmail del dueño.

## 3. Microsoft Store

### 3.1 Datos generales

| Campo | Valor |
|---|---|
| Nombre del producto | AulaPro (reservado) |
| Identidad del paquete | `EdTechLabs.AulaPro`, editor `CN=9A7A9138-5354-4236-8D7F-D57E49D851CB`, nombre del editor `EdTech Labs` (en `package.json`, bloque `appx`) |
| Store ID | `9N9WJW9C24DN` |
| Precio | Gratis |
| Categoría | Educación (subcategoría: herramientas para docentes, si existe) |
| Idiomas del paquete | `es-ES`, `ca-ES`, `en-GB` |
| Política de privacidad | https://aulapro.app/privacidad |
| Sitio web y soporte | https://aulapro.app, contacto@aulapro.app |
| Clasificación por edades | Cuestionario IARC igual que en Google Play |
| Disponibilidad | Todos los mercados, o los países de habla hispana y Reino Unido para empezar |

### 3.2 Ficha en castellano

**Descripción** (sirve la misma que la completa de Google Play, apartado 2.2, cambiando «dispositivo» por «equipo» y «móvil» por «equipo o móvil», y el apartado «Licencia» por:)

```
LICENCIA
La app se descarga gratis y se activa con una licencia, la misma para Windows y Android. Consigue tu licencia en aulapro.app.
```

**Descripción breve** [87 de 100]:
`Situaciones de aprendizaje, rúbricas e informes LOMLOE con IA, sin cuentas ni servidor.`

**Características** (cada una, hasta 200 caracteres):

1. `Situaciones de aprendizaje, rúbricas y dianas con IA, en PDF y Word, para una o varias clases.`
2. `Informes de competencias clave con una tabla de competencias y un comentario de cada una.`
3. `Cuaderno de notas con categorías ponderadas, actas imprimibles y evaluación por competencias.`
4. `Evaluar por foto: la IA propone los puntos de cada pregunta, la app calcula la nota y tú la revisas.`
5. `Pizarra y herramientas para clase: lápiz, temporizador, ruleta, grupos y actividades con móviles por QR.`
6. `PT y AL y Educación Física: informe del orientador, documentos del trimestre, sesiones y circuitos.`
7. `Los datos de tu alumnado se quedan en tu equipo. Sin cuentas. Antes de usar la IA, los nombres pasan a códigos.`

**Palabras de búsqueda** (hasta 7, de hasta 30 caracteres): `docentes`, `rúbricas`, `LOMLOE`, `situaciones de aprendizaje`, `cuaderno del profesor`, `informes`, `evaluación`.

**Novedades de la primera versión**: `Primera versión en Microsoft Store.`

### 3.3 Ficha en català

**Descripció**: la de Google Play, apartat 2.3, canviant «dispositiu» per «equip».

**Descripció breu** [89 de 100]:
`Situacions d'aprenentatge, rúbriques i informes LOMLOE amb IA, sense comptes ni servidor.`

**Característiques:**

1. `Situacions d'aprenentatge, rúbriques i dianes amb IA, en PDF i Word, per a una o diverses classes.`
2. `Informes de competències clau amb una taula de competències i un comentari de cadascuna.`
3. `Quadern de notes amb categories ponderades, actes imprimibles i avaluació per competències.`
4. `Avaluar per foto: la IA proposa els punts de cada pregunta, l'app calcula la nota i tu la revises.`
5. `Pissarra i eines per a classe: llapis, temporitzador, ruleta, grups i activitats amb mòbils per QR.`
6. `PT i AL i Educació Física: informe de l'orientador, documents del trimestre, sessions i circuits.`
7. `Les dades del teu alumnat es queden al teu equip. Sense comptes. Abans d'usar la IA, els noms passen a codis.`

**Paraules de cerca**: `docents`, `rúbriques`, `LOMLOE`, `situacions d'aprenentatge`, `quadern del professor`, `informes`, `avaluació`.

### 3.4 Ficha en inglés

**Description**: the one from Google Play, section 2.4, changing "device" to "computer" and the licence paragraph as in 3.2.

**Short description** [78 of 100]:
`Learning units, rubrics and reports for Spanish teachers with AI. No accounts.`

**Features:**

1. `Learning units, rubrics and target charts with AI, in PDF and Word, for one or several classes.`
2. `Key competency reports with a competency table and a comment for each one.`
3. `Gradebook with weighted categories, printable report sheets and competency assessment.`
4. `Mark by photo: the AI suggests the points for each question, the app calculates the grade and you review it.`
5. `Classroom whiteboard and tools: pencil, timer, wheel, groups and activities with phones by QR code.`
6. `Special education support and PE: counsellor's report, term documents, sessions and circuits.`
7. `Your students' data stays on your computer. No accounts. Before using the AI, names are replaced with codes.`

**Search terms**: `teachers`, `rubrics`, `LOMLOE`, `learning units`, `gradebook`, `reports`, `assessment`.

**What's new**: `First release on Microsoft Store.`

### 3.5 Notas para la certificación

En **Opciones de envío › Notas para la certificación** (en inglés):

```
AulaPro is a desktop tool for teachers. On first launch it may show an activation screen asking for a licence key.

Licence key for certification: CLAVE_DE_REVISION
(Enter it in the "Clave de licencia" field and select "Activar". An internet connection is needed once, to activate.)

After activation no sign-in is needed. The welcome screen has the button "Explore with sample data" ("Explorar con datos de ejemplo" in Spanish), which loads fictitious data (no real names).

Licensing: the app is free to download. The licence is obtained outside the app, on the developer's website, and has no in-app purchases or links to buy. It is the same licence that activates the developer's Android app.

Capabilities: the package uses runFullTrust because it is an Electron (Chromium) desktop app. It needs it to: open a small server on the user's own local network for the classroom activities (students join over the classroom wifi; Windows may show a firewall prompt the first time), save documents to Documents\AulaPro, and use the system print and file dialogs. The in-app auto-updater is disabled in the Store build (the Store updates the app).

Optional features that use the network: AI features call the Google Gemini API with the user's own key (names are replaced by codes before sending); the activation checks the licence with the licence provider, sending only the key and a generic device name ("AulaPro · Windows").
```

Para justificar `runFullTrust` en el formulario de capacidades restringidas, sirve el párrafo «Capabilities» de arriba. Las capacidades reales del paquete salen en Partner Center al subir el `.appx`: comprueba que son las esperadas.

## 4. Lo que queda después de enviar

1. **Cuando se publique en Microsoft Store**, poner su enlace en `store` de `web/sitio/assets/launch.js` (`https://apps.microsoft.com/detail/9N9WJW9C24DN`); y el de Google Play, en `play`. La web sigue en «Próximamente» mientras `checkout` esté vacío.
2. **Cada versión nueva** hay que subirla a las dos tiendas a mano (el APK firmado con tu llave de subida en Play, el `.appx` en Partner Center). El workflow «Publicar versión» solo deja los archivos en GitHub y en descargas.aulapro.app.
3. **Cuando cambie lo que la app envía fuera** (IA, licencia, Compartir), actualizar a la vez la privacidad de la web y el formulario de seguridad de los datos de Play.
4. **Prueba antes de abrir la venta**: instalar la versión de cada tienda en un equipo y un móvil limpios, activar la clave de revisión, comprar una licencia de verdad y devolverla (ver el punto 5 de `docs/WEB.md`).

## 5. El riesgo principal: la política de pagos de Google

La política de pagos de Google Play dice que quien cobra por funciones dentro de una app de Play debe usar el sistema de pago de Google, salvo excepciones. No he encontrado una excepción escrita para «compras la licencia en la web y la activas en la app», ni tampoco un caso de rechazo por eso. Lo más probable es que la revisión lo trate como una app de solo uso, pero **no es seguro**. Puntos a favor del envío: no hay ningún botón ni enlace de pago en Android (solo texto), y la licencia vale también para otra plataforma.

Si Google la rechaza, las salidas, de menos a más trabajo:

1. Contestar al rechazo con la explicación de las notas del apartado 2.5 y pedir el requisito exacto.
2. Ofrecer el APK directamente en la web, como instalación fuera de Play (ya se genera en cada versión).
3. Una suscripción solo para Android dentro de Google Play (con su comisión, su precio propio y la integración del sistema de pago de Google), dejando la clave de la web para Windows. Rompe la licencia única y los packs para grupos en Android.
