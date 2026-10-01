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
