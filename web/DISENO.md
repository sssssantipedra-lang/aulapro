# AulaPro · Paquete de diseño (Tier 1)

Web de un solo plano: "La hoja que se posa" (versión final con el video de la profe aportado por el usuario). Idioma maestro: castellano. Las versiones català y English se traducen de este texto antes de construir y se guardan al final de este documento.

## 1. La premisa

**"Cada cosa en su sitio."** La palabra es *sitio*, con doble sentido. Primero, el orden: notas, asistencia, evaluación, informes y situaciones de aprendizaje viven en una sola app en lugar de en cinco cuadernos y tres hojas de cálculo. Segundo, el lugar: los datos del alumnado se quedan en *su sitio*, el ordenador del docente, sin cuentas ni servidor. El video lo cuenta sin palabras: una sola hoja, no una montaña, baja despacio y se posa donde tiene que estar. Toda sección vende una de las dos caras de *sitio*; la que no, sobra.

Público: maestros de primaria, profes de secundaria, estudiantes de Magisterio y opositores. Registro: compañero de sala de profes, sereno, directo, cálido. Frases cortas.

La única acción: **Quiero AulaPro** (formulario de email, no hay tienda todavía). Precio: pago único de 9,99 €.

## 2. Paleta (dirección; valores finales tras aprobar el video)

Mundo: aula vacía al anochecer, luz violeta por la ventana, lámpara cálida, papel en blanco, madera.

```css
:root{
  --canvas:#15112b;        /* índigo de anochecer, nunca negro puro */
  --panel:#1f1940;         /* superficies elevadas */
  --paper:#f3eee5;         /* el papel: tarjetas "hoja" y texto claro */
  --accent:#8f72ff;        /* violeta AulaPro: CTA y énfasis raros */
  --accent-hover:#a891ff;
  --accent-muted:rgba(143,114,255,.26); /* bordes, brillos, partículas */
  --lamp:#e9bd82;          /* la lámpara: solo en dosis mínimas */
  --text-secondary:#b8b0d8;
  --text-primary:#f3eee5;
}
```

## 3. Tipografía

- Display: **Bricolage Grotesque** 700 y 800. Cercana, con carácter, de cartel de aula.
- Cuerpo: **Lexend** 300, 400 y 500. Diseñada para facilitar la lectura; del mundo educativo.
- Etiquetas: **IBM Plex Mono** 500. Horas, versiones, kickers.

## 4. Mapa de bandas del hero (600vh; validado con el test de flick y la auditoría de contraste)

Video final: el del usuario (10 s, 1280x720, 240 fotogramas). Una profe en su mesa al anochecer; una hoja baja por el haz de luz, aterriza en la mesa (se convierte en un montoncito ordenado) y ella sonríe tranquila. Cámara quieta. Primera mitad: textos arriba a la derecha sobre la pizarra oscura mientras la hoja cae por la izquierda. Segunda mitad: textos a la izquierda, con la hoja ya en la mesa.

| Banda | Rango | Momento del video | Posición | Texto (literal) | Entrada |
|---|---|---|---|---|---|
| 1 | 0.00 a 0.17 | La hoja flota en el haz; ella mira hacia arriba | Arriba derecha | Kicker: "Martes, 22:14" · "Son las diez.<br>Y sigues con papeles." | Drift-down, rampa de carga |
| 2 | 0.21 a 0.42 | La hoja se mece y baja junto a ella | Arriba derecha | "La lista de esta noche:" · "Pasar las notas a la hoja de cálculo." / "Redactar doce informes." / "Preparar la situación de aprendizaje." | Cascada y tachado a mano con tick violeta |
| 3 | 0.48 a 0.68 | La hoja aterriza en la mesa | Izquierda | "Todo tu curso, en una sola app." · "Notas, asistencia, evaluación, informes y situaciones de aprendizaje. Sin cuentas ni servidor: los datos de tu alumnado se quedan en tu ordenador." | Blur-to-sharp |
| 4 | 0.74 a 1.00 | Los papeles reposan; ella sonríe | Izquierda | "Cada cosa en su <em>sitio</em>." · "AulaPro para Windows y Mac. Pago único de 9,99 €, y es tuya para siempre." · "Quiero AulaPro" / "Ver cómo funciona" | Palabra a palabra, subrayado violeta |

Resultados medidos (1440x900): flick de 120 px, cada banda legible 5, 7, 6 y 11 pasos; a 360 px ninguna se salta. Contraste en el peor fotograma: 14,9 / 14,5 / 5,8 / 6,9 a 1.

Pista bajo el video: "Baja despacio".

## 5. Hero estático (móvil y movimiento reducido)

Sobre el fotograma final (la hoja en la mesa):
- Titular: "Cada cosa en su sitio."
- Subtítulo: "El cuaderno, la evaluación y los documentos de tu curso, en una sola app para Windows y Mac. Los datos de tu alumnado se quedan en tu ordenador."
- Línea de precio: "Pago único de 9,99 €."
- Botón: "Quiero AulaPro"

## 6. Debajo del hero (en orden; todo empuja a #quiero)

**Nav:** logo AulaPro · Funciones · Privacidad · Precio · Preguntas · selector ES / CA / EN · botón "Quiero AulaPro".

**S1 · Tu día a día** (#funciones). Captura grande de Inicio en un marco de ventana, con anotaciones a mano que se dibujan solas.
- Kicker: "Tu día a día"
- H2: "Abres AulaPro y ya sabes qué toca."
- Entradilla: "Tus clases de hoy, lo que tienes pendiente y el alumnado que necesita atención, en la primera pantalla."
- Anotaciones: "Te guía los primeros días" · "Tus clases de hoy" · "Quién necesita atención"
- Fila: "Inicio" · "Mis clases" · "Agenda que lee tu horario con IA" · "Cuaderno de notas" · "Asistencia"

**S2 · El momento interactivo: tacha la lista** (#lista). Una hoja de papel real sobre el fondo índigo.
- Kicker: "Pruébalo"
- H2: "Tacha la lista del domingo."
- Entradilla: "Toca cada tarea y mira quién se encarga."
- Tareas y respuesta al tacharlas:
  1. "Calcular medias con porcentajes" → "Cuaderno de notas: categorías con peso y media ponderada automática. Exporta a Excel."
  2. "Pasar lista y sacar porcentajes" → "Asistencia: cuatro estados y porcentajes al momento."
  3. "Evaluar por niveles de logro" → "Rúbricas y Diana competencial: la nota sale sola."
  4. "Redactar los informes de competencias" → "Informes LOMLOE redactados por IA, listos para revisar."
  5. "Preparar la situación de aprendizaje" → "Situaciones de aprendizaje con IA, en PDF y Word, con cartel A4."
  6. "Imprimir las actas" → "Actas con la escala IN, SU, BI, NT y SB."
- Estado final: "Domingo libre." · "Y así cada semana."
- Movimiento reducido: la lista aparece ya tachada.

**S3 · Evaluar** (#evaluar). Dos columnas: captura del cuaderno (català) y texto.
- Kicker: "Evaluar"
- H2: "Las cuentas las hace AulaPro."
- Entradilla: "Evaluar cada criterio de cada alumno ya no es una labor titánica."
- Puntos: "Categorías con peso: exámenes, tareas, participación." · "El bloque Trabajo diario y actitud vale 1 punto y se rellena desde el aula, con un toque." · "Rúbricas, Diana competencial y autoevaluaciones, con historial." · "Exporta a Excel en un clic."
- Pie de captura: "Vista en català. También en castellano y en inglés."

**S4 · En clase** (#en-clase). Captura de Aula Live a sangre, con la de Distribución de aula superpuesta.
- Kicker: "En clase"
- H2: "Pizarra, temporizador y ruleta, en la misma ventana."
- Entradilla: "Aula Live proyecta lo que tu clase necesita: pizarra, calculadora, sonómetro, ruleta y retos."
- Bloque: "Distribución de aula" · "Grupos cooperativos, roles y rotación semanal. Anotas en un toque: sin tarea, sin material, participa."
- Bloque: "Sala de alumnos" · "Tu alumnado entra desde el móvil escaneando un QR, por la wifi del aula."

**S5 · Privacidad** (#privacidad). El fotograma final de la hoja en la mesa a sangre, con el texto encima.
- Kicker: "Privacidad"
- H2: "Los datos de tu alumnado, en su sitio."
- Entradilla: "Su sitio es tu ordenador. AulaPro no tiene cuentas ni servidor."
- Puntos: "Sin registro ni contraseña." · "Antes de usar la IA, los nombres se cambian por códigos." · "Tu clave de Google se guarda cifrada." · "Copia de seguridad automática cada 10 minutos." · "Compartes trabajo con otros profes sin pasar por ningún servidor."

**S6 · Documentos** (#documentos). Documentos dibujados en abanico, más un bloque para Magisterio.
- Kicker: "Documentos"
- H2: "El papeleo LOMLOE, en minutos."
- Tarjetas: "Informes de competencias clave" · "Actas imprimibles" · "Situaciones de aprendizaje" · "Fichas, escape rooms y tarjetas"
- Bloque Magisterio: "¿Estudias Magisterio o preparas oposiciones?" · "Las situaciones de aprendizaje quitan el sueño a mucha gente. AulaPro te da un punto de partida sólido, con biblioteca e índice, para revisarlo y hacerlo tuyo."

**Tira IA.** "La IA funciona con tu propia clave gratuita de Google. La pegas en Mi perfil en tres pasos y AulaPro comprueba que funciona sin gastar cupo."

**Tira idiomas.** "En castellano. En català. In English."

**S7 · Precio** (#precio). Una sola hoja de papel centrada.
- Kicker: "Precio"
- H2: "9,99 €. Una vez."
- Entradilla: "Sin suscripción. Pagas una vez y AulaPro es tuya para siempre."
- Incluye: "Windows y Mac" · "Todas las funciones" · "Castellano, català y English" · "Sin cuentas ni cuotas"
- Botón: "Quiero AulaPro"

**S8 · Preguntas** (#preguntas)
- "¿Tengo que crear una cuenta?" · "No. Instalas AulaPro y empiezas. No hay registro ni contraseña."
- "¿Dónde se guardan los datos de mi alumnado?" · "En tu ordenador y en ningún otro sitio. AulaPro no tiene servidor."
- "¿La IA ve los nombres de mis alumnos?" · "No. Antes de enviar nada, AulaPro cambia los nombres por códigos."
- "¿La IA cuesta dinero?" · "Con el plan gratuito de Google, no. Tienes unas 20 peticiones al día con el modelo Flash para las tareas grandes. Si se acaban, la app sigue sola con Flash-Lite hasta las 9:00."
- "¿Es una suscripción?" · "No. Es un pago único de 9,99 €."
- "¿Funciona en Mac?" · "Sí, en Windows y en Mac. En Windows se actualiza sola y en Mac las actualizaciones se instalan a mano."
- "¿Sirve para primaria?" · "Sí. Está pensada para maestros de primaria, profes de secundaria y estudiantes de Magisterio, sobre el currículo LOMLOE."
- "¿Puedo trabajar con otros profes?" · "Sí. Compartes trabajo sin pasar por ningún servidor, y el registro de cambios muestra quién cambió qué y cuándo."

**S9 · Formulario final** (#quiero)
- H2: "Pon tu curso en su sitio."
- Entradilla: "Déjanos tu email y te avisamos en cuanto puedas comprar AulaPro."
- Campo: "Tu email" · placeholder "nombre@correo.com"
- Campo: "Soy..." · "Maestro o maestra de primaria" / "Profe de secundaria" / "Estudiante de Magisterio" / "Otro"
- Botón: "Quiero AulaPro"
- Nota: "Solo te escribiremos para esto."
- Éxito: "¡Apuntado! Te avisamos por email en cuanto AulaPro esté a la venta."
- Destino del envío: se decide con el usuario al construir (servicio de formularios gratuito o email directo). Nunca un éxito falso.

**Pie:** logo · "Cada cosa en su sitio." · "Diseñada sobre el currículo LOMLOE." · enlaces · ES / CA / EN · "© 2026 AulaPro".

## 7. Capa vectorial

- **La firma:** trazos a mano (SVG) que tachan tareas y ticks violeta que se dibujan: banda 2 del hero, S2 y la lista de "incluye" del precio.
- Flechas y círculos de anotación a mano alrededor de las capturas (S1, S3), dibujados con el scroll.
- Separadores: una sola línea de cuaderno (pautada) que se dibuja al entrar en cada sección.
- Partículas de polvo en suspensión a nivel susurro, del mismo haz de luz del video.
- Fondo fijo: un resplandor violeta de anochecer que deriva lentamente (ciclo de 70 s) con grano suave.
- Movimiento reducido: todo en su estado final, sin animaciones.

## 8. Ingeniería (lista completa)

Blob fetch (con anillo de carga si pasa de 8 MB), lerp normalizado por dt en un rAF que descansa, seeks con compuerta, escrituras al DOM solo con cambios, bandas medidas en vh con test de flick, sistema de legibilidad de cuatro capas con auditoría del peor fotograma, las cinco compuertas del hero estático vivas con listeners de cambio, página completa sin video, suelo de calidad de `scrub-pipeline.md`, y todo el sitio animado (Fase 8). Selector de idioma sin recargar: textos en diccionarios JS, `lang` del documento actualizado, idioma recordado en localStorage con try/catch.

## 9. Compuerta de texto

Cada línea de este paquete se publica literal. La página construida debe pasar la compuerta de la Fase 9 (cero rayas largas, cero palabras de relleno, más el barrido de tics de IA) antes de que nadie la vea. Los recursos deliberados (la lista tachada, "9,99 €. Una vez.") son oficio y se quedan.

## 10. Líneas añadidas durante la construcción (se publican literales)

- S1 leyenda: "Cada paso se marca solo en cuanto lo haces." · "Con hora y aula, y la semana a un clic." · "Faltas sin justificar, mejoras y avisos."
- S3 etiqueta sobre la captura: "Se rellena solo desde el aula"
- S5 pie de imagen: "Tu ordenador. Su sitio."
- S6 detalle de cada documento: "Redactados por IA sobre las competencias clave." · "Con la escala IN, SU, BI, NT y SB." · "Biblioteca, índice, PDF, Word y cartel A4." · "Diez temas de aventura y candado digital."
- S8 titular: "Lo que más nos preguntan."
- Formulario: "Escribe un email válido, por favor." · "No se ha podido enviar. Prueba otra vez en un momento." · "Vista previa: el formulario aún no está conectado, así que no se ha enviado nada." · contador "{n} de 6 tachadas" · "Volver a empezar"

Las versiones en català e inglés de todo el texto viven en `aulapro/assets/i18n.js`.

## 11. Ronda de revisión 2 (30-09-2026): decisiones del usuario

- **Público:** el foco principal pasa a Educación Primaria (maestros y maestras de Primaria y estudiantes de Magisterio). Secundaria solo aparece en las preguntas frecuentes.
- **Registro:** trato de tú con vocabulario formal. Fuera coloquialismos ("profes", "toca", "quitan el sueño"). Se usa "docentes", "maestros y maestras", "profesorado".
- **La IA como protagonista:** nueva sección "Recursos con IA" (#ia) tras "Tu día a día", con el abanico de documentos (situaciones de aprendizaje, rúbricas, informes de competencias clave, fichas y escape rooms), la captura de la rúbrica con "Evaluar trabajo con IA" y la lista "Y además". La antigua sección Documentos se integra aquí.
- **Evaluar:** usa la Diana competencial y la diana con la nota calculada (capturas del usuario de 5.º A). El cuaderno en català pasa a la franja de idiomas.
- **Capturas con grupos de ESO/Bachillerato** (Inicio, Cuaderno, Distribución): el usuario decide dejarlas.
- **Plataformas:** Windows, Mac y Android. En Android la compra es por Google Play. "Ordenador" pasa a "equipo" donde se habla de dónde viven los datos.
- **Compra:** tres botones con icono (Windows, Mac, Android) en la tarjeta del precio y en el cierre. Mientras `STORE_LINKS` en `assets/app.js` esté vacío dicen "Próximamente" y llevan al formulario de aviso. Con los tres enlaces rellenos pasan a "Comprar para" y el formulario se oculta.
- **Hero:** banda 1 "Son las diez de la noche. / Y el papeleo sigue ahí." · banda 2 "Pendiente para mañana:" con situación de aprendizaje, rúbrica e informes · banda 3 "AulaPro lo prepara con IA." · banda 4 sin cambios.

El texto definitivo de esta ronda vive en `aulapro/index.html` (castellano) y `aulapro/assets/i18n.js` (català y English), y es el que se publica. Contraste medido en el peor fotograma: 13,0 / 4,55 / 5,81 / 6,95 a 1.

## 12. Ronda 3 (30-09-2026): video definitivo "del agobio al alivio"

- Video del usuario (Gemini, 10 s): la maestra agobiada abre el portátil y se relaja. Corte a primer plano de la pantalla en el segundo 8.
- Tratamiento: fundido de 0,35 s en el corte; marca "MacBook Air" del marco borrada por tramos; medio segundo quieto al final; la pantalla dibujada por la IA sustituida fotograma a fotograma por la grabación real del usuario (diana de El Mercado Eco-Saludable, de vacía a rellena con el 6,3), con los dedos por delante. Script: scratchpad `screen_comp.py`; resultado `review/agobio-final-scrub.mp4`.
- Hero de 700vh. Bandas arriba a la derecha, sobre la pizarra: 1 (0 a 0,17), 2 (0,20 a 0,38, se tacha mientras abre el portátil), 3 (0,41 a 0,56), 4 (0,59 a 0,745, con los botones). Primer plano final (0,80 a 1) solo con la etiqueta "Así se ve AulaPro por dentro." arriba a la izquierda.
- Medido: contraste en el peor fotograma de 7,26 a 10,9 a 1 en 1280x720, 1440x900 y 1920x1080; flick de 120 px con al menos 5 pasos por banda; ninguna banda se salta a 360 px.

## 13. Ronda 4 (30-09-2026): demo interactiva y capturas ampliables

- Petición del usuario: "un HTML en el que puedan toquetear la interfaz de la app, como si fuese una app disfuncional", o como mínimo ampliar las imágenes. Se hacen las dos cosas.
- `demo.html`: réplica de la ventana de AulaPro a su tamaño real (1919 x 1032) escalada al espacio disponible. Menú lateral, pestañas y barra de título en HTML con Lexend y los colores medidos en las capturas (fondo del menú #1e0a3c, activo #2c1256 con #a78bfa, textos #64748b). Cada pantalla es la captura real recortada a la zona de contenido, con botones invisibles encima.
- Funcionan de verdad: ruleta (gira y dice a quién le toca), calculadora, temporizador (fichas, iniciar, pausar, más y menos), pizarra (dibujar con cinco colores y borrador), rúbrica (marcar un nivel por criterio) y diana de evaluación (cada sector se rellena al pulsarlo; con los cinco sale la nota 6,3). El resto de botones muestran un aviso que explica qué hacen en la aplicación.
- Pantallas sin captura (Mis Clases, Agenda, Cuaderno, Asistencia, Documentos, Autoevaluaciones, Historial, Sala de alumnos y el grupo Más): nota honesta "No incluida en la demo" con lo que hace cada una y botones a pantallas que sí están. Se completan cuando el usuario envíe capturas.
- La grabación de la diana no se usa en la demo: su primer fotograma está generado y el texto sale deformado. La diana vacía se construye a partir de la captura nítida.
- Web principal: enlace "Demo" en el menú, bloque "Probar la demo interactiva" bajo la pantalla de inicio y visor para ampliar las siete capturas (clic, rueda, pellizco, arrastrar, Esc). Texto de Magisterio cambiado por el del usuario.
- Recursos en `aulapro/assets/demo/` (484 KB). Script de recortes: scratchpad `demo/build_assets.py`.
- Retoque del vídeo (30-09-2026, a petición del usuario): en el primer plano, los dedos de la mano izquierda quedaban cortados por la captura superpuesta. En la esquina inferior izquierda de la pantalla la captura baja a opacidad cero justo donde hay piel, con borde suave; también se afina el borde de la mano derecha. Script: scratchpad `screen_comp2.py` (fotogramas en `review/comp/out2`). Versión anterior guardada en `review/agobio-v1/`.
- Texto de la banda 3 del inicio (30-09-2026, a petición del usuario): "para Educación Primaria y Secundaria", en los tres idiomas. Contraste medido de nuevo: 7,03 a 1 en el peor fotograma (catalán, 1280x720).
- Público (30-09-2026, decisión del usuario): "Primaria y Secundaria, ambos son válidos". Título, descripción, h1, texto del inicio en móvil, entrada de la sección IA y la pregunta frecuente 1 dicen ahora Educación Primaria y Secundaria en los tres idiomas. Se mantienen los pies de foto de 5.º de Primaria (capturas reales) y el texto de Magisterio (oposiciones de Primaria, texto del usuario).

## 14. Publicación (30-09-2026)

- Formulario de lista de espera conectado a Formspree (formulario del usuario). Prueba real enviada y recibida.
- Hosting: Cloudflare Pages gratis, elegido por el usuario. Dirección: https://aulapro-app.pages.dev/ (demo en /demo). Etiquetas og con la dirección real.
- Medido en la dirección real, desde la conexión del usuario (zona wifi del móvil): primera respuesta en 0,37 s; página lista para usar en 0,97 s; 147 KB sin contar el vídeo; el vídeo (4,4 MB) llega detrás del póster mientras la página ya se usa. Consola limpia, el vídeo se desplaza bien con el scroll, la demo y los tres idiomas funcionan.
- Dominio propio (30-09-2026): aulapro.app, comprado por el usuario en Cloudflare. Registros CNAME @ y www hacia aulapro-app.pages.dev; etiquetas og y canonical con https://aulapro.app/. Verificado con candado: página 0,74 s completa, demo 0,31 s, vídeo 4,4 MB en 1,8 s; en el navegador, lista para usar en 1,07 s y 148 KB sin vídeo. Consola limpia.

## 15. Legal (30-09-2026)

- Páginas nuevas, en tres idiomas y ocultas a los buscadores (noindex): `aviso-legal.html` (titular Santiago Pedra Calás, domicilio en Vinaròs, contacto@aulapro.app; sin DNI por decisión del usuario) y `privacidad.html` (web y aplicación; la URL sirve para Google Play).
- Formulario: casilla obligatoria "He leído y acepto la política de privacidad" y aviso breve debajo del botón. Sin casilla marcada no se envía nada.
- Correo contacto@aulapro.app reenviado a la cuenta Gmail del usuario (Cloudflare Email Routing).
- Tipografías servidas desde la propia web (`assets/fonts/`): ya no se envía la IP de los visitantes a Google.
- Sin cookies: no hace falta banner. Solo se guarda el idioma elegido en el navegador.

## 16. Modelo de venta (30-09-2026, decisiones del usuario)

- Windows y Mac: venta directa en la web con Lemon Squeezy (vendedor registrado; IVA, facturas y claves de licencia). Android: Google Play, compra aparte.
- Licencia: pago único 9,99 €, hasta 2 equipos a la vez, no caduca, actualizaciones incluidas. Devolución en 14 días sin preguntas.
- Página nueva `condiciones.html` (tres idiomas; ancla #devoluciones). Privacidad ampliada con Lemon Squeezy y la activación de la licencia. Precio con quinta línea "Devolución en 14 días, sin preguntas"; pregunta frecuente nueva "¿Y si no me convence?"; respuesta sobre dispositivos aclarando que Android se compra aparte.
- Pendiente del usuario: cuenta de Lemon Squeezy, Apple Developer (99 $/año), certificado de firma de Windows, Google Play Console (25 $), alta de autónomo. Pendiente en la app (otra sesión): pantalla de licencia, firma e instaladores.
- Cambio (30-09-2026, decisión del usuario): una sola licencia para Windows, Mac y Android, hasta 2 dispositivos a la vez. La app de Android se descarga gratis en Google Play y se activa con la clave comprada en aulapro.app (modelo "solo de uso" permitido por Google Play; dentro de la app se puede decir dónde comprar, sin enlace directo al pago). Toda la venta pasa por Lemon Squeezy. Condiciones, privacidad, precio y preguntas frecuentes actualizados.

## 17. Paradas en el vídeo del inicio (1-10-2026, petición del usuario)

- Al dejar de hacer scroll dentro del inicio, la página se desliza sola hasta la siguiente parada en la dirección del movimiento, para que el vídeo nunca descanse en un fotograma a medias. Un toque de rueda lleva al texto siguiente; un roce mínimo vuelve a la parada; cualquier rueda, tecla o toque durante el deslizamiento devuelve el control al visitante.
- Paradas, en progreso del inicio: 0 (texto 1), 0,335 (texto 2, con las tres tareas ya tachadas), 0,49 (texto 3), 0,68 (texto 4, con los botones) y 1 (primer plano de la diana rellena).
- Suavidad: al bajar, el vídeo se reproduce de verdad a 1,2 veces su velocidad con arranque y frenada suaves, y la página lo sigue; al subir, se busca fotograma a fotograma a 0,8 veces. Medido: unos 20 ms de película por fotograma de pantalla de media, el 95 % por debajo de 27 ms, y ninguna imagen de la película saltada (el salto máximo, unos 45 ms, es una sola imagen a 24 por segundo).
- Solo en ordenador (modo vídeo). Móviles, tabletas en vertical y movimiento reducido siguen con la imagen fija.

## 18. Inicio paso a paso (1-10-2026, petición del usuario)

- Dentro del vídeo del inicio, cualquier movimiento de rueda, deslizamiento de dedo o tecla de avance (flechas, Av Pág, Re Pág, espacio), sea largo o corto, es un solo paso a la parada siguiente o anterior. Mientras dura el deslizamiento no se puede bajar ni subir más. Un gesto es un paso: el resto de un gesto de trackpad no lanza otro hasta que la rueda se detiene un instante (220 ms; en la sección 19 pasa a 450 ms). En la última parada, bajar sale al contenido como siempre. Un clic (botón, enlace, barra de desplazamiento) interrumpe el deslizamiento.
- Velocidad: 1,56 veces la real en las dos direcciones; los tramos largos duran unos 2,5 segundos.
- Vídeo recodificado con todos los fotogramas clave (`-g 1 -crf 23`, 7,3 MB, antes 4,4 MB) para que también al subir, que busca fotograma a fotograma, no se salte imágenes. Comparación en las mismas condiciones: al subir, imágenes saltadas en el 30 % de los cambios con la versión anterior y en el 4 % con esta; al bajar, 2-3 % con ambas. Calidad frente a la referencia sin pérdida: SSIM 0,976 (antes 0,984), sin diferencia visible a tamaño doble. Archivo: `review/agobio-final-scrub-v3-intra.mp4`.
- El aviso del inicio pasa de "Desplázate despacio" a "Desplázate hacia abajo".
- Se sale del estándar del método (un fotograma clave cada 8) porque el deslizamiento automático hacia atrás lo exige.

## 19. Un gesto, un paso, de verdad (1-10-2026, petición del usuario)

- El usuario veía que con un giro grande la página seguía bajando. Dos causas:
  - Al girar la rueda de un ratón a mano, el dedo se levanta hasta unos 0,3 s entre impulsos, y con 220 ms cada impulso contaba como un gesto nuevo, así que al acabar un deslizamiento empezaba otro. Ahora el gesto termina tras 450 ms sin rueda, y la rueda que sigue girando durante el deslizamiento cuenta como el mismo gesto. Para avanzar otra parada hay que parar y volver a girar.
  - Cloudflare dice a los navegadores que guarden los archivos de `assets/` 4 horas (el HTML no), así que el navegador del usuario seguía con el `app.js` anterior. Ahora `web/versionar.mjs`, que ejecuta `web.yml` antes de publicar, añade a cada referencia de `assets/` una huella de su contenido (`?v=…`): un archivo se vuelve a descargar justo cuando cambia. En el repositorio las rutas siguen limpias. No se sellan las fuentes (ya llevan la huella en el nombre) ni las imágenes de la demo (demo.js las nombra por partes).
- Si un giro empieza por debajo del vídeo, el navegador no deja cancelarlo; al entrar en el vídeo desde abajo, la página se queda en la última parada y el resto de ese giro no la mueve. El siguiente giro hacia arriba lleva a la parada anterior.

## 20. Oferta de lanzamiento (1-10-2026, decisión del usuario)

- Hasta el 15 de abril de 2027 incluido: 6,99 € una sola vez y licencia de por vida (2 dispositivos, actualizaciones, 14 días de devolución). Desde el 16 de abril de 2027, las licencias nuevas son anuales, 9,99 € al año; las de por vida se respetan siempre.
- La web lo anuncia con fecha y con el precio posterior ("Después costará 9,99 € al año"), porque es el argumento más fuerte: pagas una vez lo que después costará cada año. Cambia el precio en la portada (bloque 4 del inicio, tarjeta de precio con el título "Precio de lanzamiento", pregunta 7, llamada final, descripciones), la demo, /descargar y las condiciones de venta, que añaden el párrafo "Oferta de lanzamiento", en los tres idiomas.
- Al acabar la oferta hay que cambiar la web y Lemon Squeezy el mismo día: `docs/WEB.md`, apartado 5, punto 9.

## 21. Packs para grupos (1-10-2026, decisión del usuario)

- Packs de 5, 10, 20 y 30 docentes por 22,99 €, 39,99 €, 69,99 € y 89,99 € (4,60 €, 4 €, 3,50 € y 3 € por docente; la individual cuesta 6,99 €), de por vida con la misma oferta de lanzamiento. Más de 30 docentes: "escríbenos" a contacto@aulapro.app.
- Una sola clave para todo el grupo, con 2 dispositivos por docente (en Lemon Squeezy, una variante por pack con su límite de activaciones). Así funciona con la app tal como está.
- Corrección del mismo día: el usuario prefiere una licencia por docente (cada una con sus 2 dispositivos). Con una clave compartida, el pack de 30 daría 60 activaciones a cualquiera que tuviera la clave. La web dice ahora "5 licencias", "4,60 € por licencia" y "una licencia para cada docente". Falta comprobar en Lemon Squeezy cómo entregar varias claves en una compra (`docs/WEB.md`, apartado 5, punto 7).
- En la web: bloque "¿Sois varios docentes?" debajo de la tarjeta de precio (`#packs`, cuatro fichas oscuras como los botones de compra, dos columnas en móvil), pregunta 11 de las frecuentes, enlace a los packs en la llamada final, apartado "Packs para grupos" en las condiciones de venta y una línea en /gracias para quien compra un pack. Cada pack dice "Próximamente" hasta que su enlace de pago se pone en `packs` de `assets/launch.js`.

## 22. Precios frente a la competencia (1-10-2026)

- Competencia por docente, consultada el 1-10-2026: iDoceo 19,99 € pago único (solo Apple, sin IA, sin descuento por volumen); Additio 13,99 €/año sin IA y 29,99 €/año con IA; Prográmalo 79-99 €/año, 4Docentes 90 €/año y KumuPlanner 189 €/año (claustro 80 €/docente/año, mínimo 6), las tres solo IA.
- AulaPro se compara con los cuadernos (su IA usa la clave del docente, no hay web ni nube y aún no tiene opiniones): precio justo de unos 15-20 € en pago único o unos 15 €/año.
- Decisión del usuario, buscando un precio bajo y atractivo: el lanzamiento se queda en 6,99 € de por vida, la anual baja a 11,99 €/año (antes 9,99 €; se recomendó 14,99 €) y los packs se quedan en 22,99 / 39,99 / 69,99 / 89,99 € (se recomendó 29,99 / 54,99 / 99,99 / 139,99 €).
- Ese mismo día el usuario sube los packs a 24,99 / 44,99 / 79,99 / 99,99 € (5 €, 4,50 €, 4 € y 3,33 € por licencia).

## 23. Captura del cuaderno en castellano (1-10-2026, petición del usuario)

- En la franja de idiomas ("En castellano. En català. In English."), la captura del cuaderno de notas en catalán (`cuaderno-ca.webp`, 1440x900) se sustituye por la del usuario en castellano (`assets/app/cuaderno.webp`). Ese mismo día pasa a ser la captura oficial de la versión 1.7.1, sin la barra de título de Windows (1919x1008), como las demás capturas. El pie y el texto alternativo dicen ahora "en castellano", en los tres idiomas.

## 24. Windows desde Microsoft Store (1-10-2026, decisión del usuario)

- El usuario no quiere pagar firmas de código. Windows se distribuirá gratis en Microsoft Store (Microsoft firma el paquete MSIX), Android en Google Play y Mac en descarga directa sin firmar. La licencia se sigue vendiendo solo en la web. Detalles para la app en `docs/WEB.md`, apartado 4.
- `launch.js` gana `store` (ficha de Microsoft Store). Con `store` relleno, la tarjeta de Windows de /descargar dice "Microsoft Store" y "Descargar en Microsoft Store", el botón (también el de /gracias) abre la Store y desaparece la ayuda del aviso «Windows protegió tu PC». Vacío, todo sigue como antes, con el instalador .exe.

## 25. Packs: una clave por grupo (2-10-2026, decisión del usuario)

- Prueba en Lemon Squeezy: comprar 3 unidades cobra 20,97 € pero entrega una sola clave de 2 activaciones, y Lemon Squeezy no permite crear claves a mano. "Una clave por docente" no se puede automatizar.
- Tras ver cómo lo hace Microsoft (claves de volumen MAK: una clave para un número fijo de equipos), el usuario elige una clave por pack con 2 dispositivos por docente (10, 20, 40 y 60). La web vuelve a decir "5 docentes", "5,00 € por docente" y "una sola clave para todo el grupo, con 2 dispositivos por docente"; condiciones, /gracias y el PDF de Lemon Squeezy, igual.

## 26. Logo oficial (2-10-2026, petición del usuario)

- El logo oficial es el de la app: cuadrado con degradado de morado (#863bff) a azul (#47bfff), tarjeta blanca con tres casillas marcadas y "AULAPRO" debajo (`public/favicon.svg`); sin el texto para tamaños pequeños (`public/favicon-mini.svg`). Sustituye a las capas moradas que usaba la web.
- En la web: favicon `assets/icono.svg` (copia del pequeño), `assets/icono-180.png` para la pantalla de inicio de iPhone y iPad (fondo a sangre, iOS redondea las esquinas) y la marca de la cabecera dibujada en cada página (símbolo `#mark` en la portada y la demo; en línea en las páginas legales, de descargas y de gracias).
- Para Lemon Squeezy: `aulapro-logo.png` (con texto) y `aulapro-icono.png` (sin texto, mejor para el avatar pequeño de la tienda), y el PDF del comprador lleva el pequeño.

## 27. Mac, más adelante (2-10-2026, decisión del usuario)

- Hasta que haya ganancias para pagar la firma de Apple, AulaPro se vende para Windows y Android. Una app de Mac sin firmar obliga a saltarse un aviso de seguridad al instalarla, y eso genera desconfianza.
- En la portada, la ficha de Mac pasa a ser un `<span class="store store-soon">` atenuado con "Próximamente": no es un enlace y `app.js` ya no la cuenta para abrir la tienda. Textos: "Windows y Android" y, en la pregunta 8 y bajo los botones, "La versión para Mac llegará más adelante". /descargar: tarjeta de Mac en "Próximamente", sin botón y sin la ayuda del aviso de macOS. /gracias: sin acceso directo a Mac. Condiciones y privacidad: solo Windows y Android. Los detalles para recuperarlo están en `docs/WEB.md`, apartado 4.

## 28. El paso del inicio nunca se queda atascado (2-10-2026)

- Fallo encontrado al probar: si el vídeo dejaba de avanzar durante un paso hacia abajo (el decodificador se atasca, el navegador pausa el vídeo para ahorrar energía, la pestaña pasa a segundo plano), el paso no terminaba nunca. La página quedaba clavada en el inicio: la rueda no hacía nada y hasta los saltos del menú volvían atrás.
- Ahora, si el vídeo no avanza en 0,9 s al empezar o en 0,45 s después, el paso termina buscando fotograma a fotograma, como al subir. Si `play()` falla, igual. Si la pestaña pasa a segundo plano a mitad de un paso, la página salta directamente a la parada. Prueba: con `play()` falseado para que no avance, el paso llega a la parada siguiente en unos 3,5 s y todo vuelve a responder.

## 29. Foto fija del inicio en móvil (2-10-2026, petición del usuario)

- En pantallas verticales (móviles y tabletas en vertical), la foto fija ocupaba toda la pantalla recortada en vertical: solo se veía la cara de la docente y el portátil quedaba fuera.
- Ahora, en vertical (`max-aspect-ratio:1/1` dentro de las condiciones de la portada fija), la foto va en una franja de proporción 3:2 bajo la barra (`padding-top: var(--nav-h)`), encuadrada al 27 % para que se vean la docente y el portátil enteros, y fundida con el fondo por abajo (`mask-image`). El texto va debajo, sobre el fondo liso. En horizontal no cambia nada.

## 30. 1,5 segundos entre paradas (2-10-2026, petición del usuario)

- Cada paso de una parada a la siguiente dura 1,5 s (`GLIDE_TIME`), sea cual sea el trozo de vídeo entre ellas (de 1,6 a 3,4 s de metraje, así que el vídeo va de 1,4x a 3x), con el mismo arranque y frenado suaves (`GLIDE_RAMP` 0,35 s). Antes iba siempre a 1,56x y los tramos largos tardaban unos 2,5 s.
- Un paso que empieza entre dos paradas (por ejemplo, tras arrastrar la barra) lleva la velocidad de ese tramo, así que simplemente dura menos.
- Medido con la rueda: hacia abajo 1,54-1,59 s y hacia arriba 1,41-1,46 s en los cuatro tramos (incluye la detección del gesto). La prueba de la rueda y la del vídeo parado dan lo mismo que antes.

## 31. Vídeo del inicio a 60 fps y con más calidad (2-10-2026, petición del usuario)

- El original (Veo) es de 1280x720 a 24 fps. Durante el arranque y el frenado de cada paso el vídeo va muy lento, y a 24 fps eso eran unas 4 imágenes por segundo: se notaba a saltos. Ahora el vídeo está interpolado a 60 fps (615 imágenes, 10,25 s, igual que antes) con `minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:scd=none` sobre la referencia sin pérdida (`review/ref-lossless.mkv`), más `tpad` para clonar las 4 últimas. Revisado en los momentos de más movimiento (cabeza, pelo, manos, pantalla): sin deformaciones visibles.
- Dos archivos: `hero-scrub-60.mp4` (hacia delante) y `hero-scrub-60-atras.mp4` (el mismo vídeo al revés, `-vf reverse`). Un vídeo no se puede reproducir hacia atrás, así que al subir se reproduce el invertido en lugar de buscar fotograma a fotograma. Por eso ya no hace falta que todo sean fotogramas clave: x264 `-crf 20 -preset slow -g 60`, con fotogramas clave forzados en las paradas (hacia delante 0, 206, 301, 418 y 614; al revés 0, 196, 313, 408 y 614), así el cambio de vídeo en una parada es instantáneo. Peso: 2,96 + 2,99 MB = 5,9 MB (antes 7,3 MB). Calidad frente a la referencia: SSIM 0,989 (antes 0,976). Fuentes en `review/fps60/`.
- En la web: el segundo `<video class="atras">` va encima del primero y solo se ve mientras suena (`.stage.atras-on`). La imagen hacia delante i es la imagen al revés N-1-i; con tiempos en el centro de cada imagen, el tiempo t hacia delante equivale a duración - t al revés. Al acabar, el vídeo hacia delante busca la misma imagen y el invertido se aparta. Si el invertido no ha cargado o falla, al subir se busca fotograma a fotograma como antes; si se atasca, el paso termina buscando (como el de bajada, sección 28). En las paradas, la imagen de los dos vídeos coincide (PSNR 44 dB).
- Medido: 47-55 imágenes distintas por segundo en cada paso, en ambos sentidos; ninguna imagen se queda quieta más de 67 ms; cada paso termina en la imagen exacta de su parada. La tolerancia de búsqueda baja de 4 ms a 1 ms (a 60 fps una imagen dura 17 ms).

