# AulaPro · Paquete de diseño (Tier 1)

Web de un solo plano: "La hoja que se posa" (versión final con el video de la profe aportado por el usuario). Idioma maestro: castellano. Las versiones català y English se traducen de este texto antes de construir y se guardan al final de este documento.

## 1. La premisa

**"Cada cosa en su sitio."** La palabra es *sitio*, con doble sentido. Primero, el orden: notas, asistencia, evaluación, informes y situaciones de aprendizaje viven en una sola app en lugar de en cinco cuadernos y tres hojas de cálculo. Segundo, el lugar: los datos del alumnado se quedan en *su sitio*, el ordenador del docente, sin cuentas ni servidor. El video lo cuenta sin palabras: una sola hoja, no una montaña, baja despacio y se posa donde tiene que estar. Toda sección vende una de las dos caras de *sitio*; la que no, sobra.

Público: maestros de primaria, profes de secundaria, estudiantes de Magisterio y opositores. Registro: compañero de sala de profes, sereno, directo, cálido. Frases cortas.

La única acción: **Quiero AulaPro** (formulario de email, no hay tienda todavía). Precio: pago único de 9,99 €.

## 2. Paleta (dirección; valores finales tras aprobar el video)

Desde el 11-10-2026 la web es cálida, como la app: ver las secciones 34 y 35. Esta paleta oscura ya no se usa; el vídeo también es cálido y el acento es terracota (sección 36).

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

## 32. Sin hora al empezar y franja final (2-10-2026, petición del usuario)

- Se quita la etiqueta "Martes, 22:14" de la primera parada del vídeo; queda solo "Son las diez de la noche. Y el papeleo sigue ahí." (claves `b1.kicker` borradas).
- En la última parada (la pantalla), una franja a lo ancho de la parte inferior dice "Sigue descubriendo AulaPro ↓" (`b5.more`; "Continua descobrint AulaPro", "Keep exploring AulaPro"). Es otra `.band` (`band-strip`, de 0,9 a 1): aparece al llegar a la parada y sube desde abajo con `--k`; fondo oscuro translúcido con desenfoque, flecha que baila (quieta con movimiento reducido). Es un enlace a `#funciones`.
- Ese mismo día, a petición del usuario, los botones "Quiero AulaPro" y "Ver cómo funciona ↓" salen de la parada de "Cada cosa en su sitio" y pasan a la franja final: "Sigue descubriendo AulaPro" queda como texto, con los dos botones al lado (`.strip-in`, que salta de línea si no caben).


## 33. Nombres de prueba: Profesor, Alumno 1, Alumno 2… (6-10-2026, petición del usuario)

- En las capturas y en los modos de prueba no aparecen nombres de personas: el docente es «Profesor» (avatar «P») y el alumnado, «Alumno 1», «Alumno 2»… La app ya lo hace en sus datos de ejemplo (`src/lib/demoData.ts`, `demoApoyo.ts`, `demoEF.ts`).
- Retocadas, sin volver a capturar, las imágenes de la web que llevaban nombres: `app/inicio`, `app/cuaderno`, `app/distribucion`, `app/diana-competencial`, `app/rubrica`, `app/aula-live` y `demo/inicio`, `demo/distribucion`, `demo/diana`, `demo/rubrica`, `demo/live` y el disco de la ruleta (`demo/ruleta-disco.webp`, con transparencia). Mismo tipo de letra que la app (Outfit) y mismo tamaño y grosor que el texto original.
- Equivalencias, para que el texto y la imagen coincidan: Lucía → Alumno 7, Daniel → Alumno 8, Sara → Alumno 9, Adrián → Alumno 10 (y María, Rubén y Patricia → Alumno 11, 12 y 13 en la ruleta); José Calladares → Alumno 1; las filas del cuaderno, Alumno 1 a 6 de arriba abajo. En `assets/demo.js` cambian las etiquetas de las zonas activas y los nombres de la ruleta; en `demo.html`, el perfil de la barra lateral.
- El título borroso del fondo de las dianas («Robots luminosos…») es una situación de aprendizaje, no una persona, y se queda. El nombre del pie (aviso legal) tampoco cambia.

## 34. Estética cálida, nombres nuevos y demo rehecha (11-10-2026, petición del usuario)

- **La estética de la app.** La app pasó a un estilo cálido (fondo crema, tarjetas blancas, iconos en cuadraditos de color) y la web la sigue: `--canvas:#fbf8f3`, tarjetas y hojas blancas, texto `#1c1917`, líneas y sombras en tonos tierra. El acento sigue siendo el violeta del logo (decisión del usuario, frente al azul de la app). Lo mismo en la demo, las páginas legales (`assets/legal.css`), /descargar y /gracias (`assets/download.css`); `theme-color` y `color-scheme` claros, salvo el `theme-color` de la portada, que empieza en el vídeo.
- **La portada del vídeo se queda oscura** hasta que llegue el vídeo nuevo: el usuario hará otro «con luz al atardecer». `.hero` lleva sus propios colores (texto claro) y el menú es claro sobre el vídeo y crema al pasar a sólido (`.nav:not(.solid)`). Entre el vídeo y la primera sección, una franja de atardecer (`.dusk`, de índigo a melocotón y crema). Cuando llegue el vídeo hay que revisar el contraste de las bandas, el póster, `escritorio.jpg` (la foto de Privacidad y de la portada fija en el móvil, sacada del vídeo) y `og.jpg`.
- **Iconos de color** como en el menú de la app: la fila de S1 (Inicio, Mis clases, Agenda, Cuaderno, Asistencia, con los colores de `COLOR` en `src/components/layout/Sidebar.tsx`) y las cuatro tarjetas de En clase (`.ico`).
- **Nombres nuevos** (los de la app desde el 11-10-2026): «Aula Live» pasa a «Pizarra y herramientas» y «Sala de alumnos» a «Actividades con móviles», en los tres idiomas. La privacidad titula su apartado 3 «Actividades con móviles (la sala de alumnos)».
- **S4 · En clase rehecha**: ya no es una captura a sangre con texto encima. Cabecera como S1, la pizarra en un marco con «Anotar actitud» superpuesta, y cuatro tarjetas: Anotar actitud, Distribución de aula (mesas cooperativas o cuadradas), Pizarra y herramientas y Actividades con móviles. S3 dice que el bloque Trabajo diario y actitud se completa «desde Anotar actitud».
- **Capturas nuevas, de la app de verdad**: `scripts/web/capturar.mjs` abre la app en modo desarrollo con los datos de ejemplo, un miércoles a las 9:45, y saca las de la portada (`assets/app`) y las de la demo (`assets/demo`). Escribe además en `scripts/web/marcas.json` dónde caen los números y los círculos que la portada dibuja encima. Para que no parezca solo de Secundaria (petición del usuario), el horario de ejemplo mezcla Primaria y ESO cada día y las capturas eligen clases de Primaria: la jornada del Inicio (4.º, 5.º y 6.º de Primaria con 2.º y 3.º de ESO), el cuaderno de 3.º, la rúbrica de 4.º, la diana de 6.º, la diana competencial y la pizarra de 5.º.
- **La demo, rehecha con la app nueva**: cada pantalla es la captura de la ventana entera (menú incluido) a 1920 x 1008, con una zona pulsable sobre cada botón de la app, sacada del propio DOM (`assets/demo-pantallas.js`, generado; no se edita a mano). 28 pantallas, todas las del menú y las pestañas, en vez de 6 y notas de «No incluida en la demo». Funcionan de verdad: la ruleta (con los nombres de la clase), el temporizador, la calculadora, dibujar en la pizarra, pasar lista, anotar actitud (con contador y deshacer), marcar una rúbrica y rellenar una diana (la nota sale sola, con los pesos). Lo demás explica en un aviso qué hace. Lo que la demo dibuja encima de las capturas usa Outfit, la letra de la app (`assets/fonts`, OFL), y va en castellano como las capturas.

## 35. El vídeo y la portada, también cálidos (11-10-2026, petición del usuario)

- **Toda la web en beige cálido.** Fuera los fondos lilas: el resplandor del fondo (`.env .g1`), el del final (`.final::before`), el recuadro de la demo (`.demo-cta`), el aviso de formulario enviado, el recuadro de /descargar y los fondos de la demo y de las páginas legales pasan a arena (`rgba(214,176,128,…)`) o a un panel beige (`#f3ebdf`). Los grises violáceos de la lista y de las fichas pasan a grises tierra. El violeta quedó como acento hasta la sección 36, que lo cambia por terracota.
- **El vídeo, con luz dorada de tarde.** Mismo vídeo y mismas paradas, con un filtro de color (tabla 3D en OKLab, `review/fps60/lut-calido.py` y `warm.cube`): los violetas del ambiente giran a ámbar, balance de blancos cálido y algo más de contraste, sin aclarar las sombras (si se aclaran, queda apagado). La pantalla del portátil no se toca: los colores saturados (el quesito azul y verde, los botones violeta) quedan protegidos. Se aplica igual a las dos películas (`hero-scrub-60.mp4` y `-atras.mp4`, con los fotogramas clave en las paradas), a `hero-poster.jpg`, `hero-ending.jpg`, `escritorio.jpg` y `og.jpg`.
- **Se probó rehacerlo con IA** (fal.ai, MiniMax H3 Max, unos 0,54 $): mantuvo el violeta, cambió el orden de los planos y dejó una imagen fantasma. Descartado; el resultado está en `review/fal-calido/`.
- **Los colores oscuros de la portada** (`.hero`, menú sobre el vídeo, sombras del texto, halos de las bandas, franja de transición `.dusk`) pasan de índigo a marrón café: base `#1e1611`, texto crema `#f3ece6`/`#efe6da`, secundario arena `#d8c9b6`.
- **La franja "Sigue descubriendo AulaPro"** es crema con texto oscuro: anuncia la página que viene.
- **Móvil y tableta en vertical:** la foto arriba y el texto debajo sobre crema, con texto oscuro y el menú oscuro sobre crema; sin franja de transición. `theme-color` crema en vertical y café en el resto.

## 36. Terracota, fondos que fluyen y la app nueva en el portátil (11-10-2026, petición del usuario)

- **Acento terracota** en toda la web (portada, demo, legales, /descargar, /gracias), elegido por el usuario: botones `#b4532a`, al pasar el ratón y enlaces `#9a4522` (contraste 5:1 y 6:1 sobre crema), trazos, subrayados y foco `#c8693a`. El logo conserva sus colores. Los iconos de colores de S1 y En clase son los del menú de la app y se quedan.
- **Fondos que fluyen**: cada sección pinta un velo arena (`rgba(214,178,134,…)`) que empieza donde acaba el de la anterior (`--v0`/`--v1` por sección), así la página pasa de crema a arena y latte y vuelve, sin cortes. El trazo a mano entre la lista y Evaluar (`.rule`) ya no ocupa alto, para que no quede una franja. El pie es café (`#241a13`), con una caída suave desde el latte, y cierra la página como la abre el vídeo.
- **La app nueva en el portátil del vídeo**: la pantalla muestra la app 2.8.0 de verdad, capturada en local a 16:10 (la proporción de la pantalla, calculada por la perspectiva) con la evaluación por diana «Trabajo en equipo» de 6.º de Primaria. En el plano general hay dos ítems marcados (8,8); en el primer plano se marcan los otros dos y sale la nota, 7,5. Montaje fotograma a fotograma (`review/pantalla-app/`): esquinas de la pantalla por sus bordes (en el primer plano la cámara solo hace zoom, así que las esquinas de la izquierda siguen a las de la derecha), por color mientras se abre el portátil, desenfoque por movimiento promediando la exposición, desenfoque del lado izquierdo en el primer plano, la luz y el tono del blanco de cada fotograma, y las manos por delante. El fundido entre los dos planos se rehace con el cambio de pantalla de cada plano. Después, el mismo filtro cálido y las mismas paradas.
- `escritorio.jpg` y `og.jpg` salen del fotograma 445 y `hero-ending.jpg` del último, con la pantalla nueva. Si cambia la app, se repite: capturar (`t53-capture-app.mjs` con `npm run dev`), `render_all.py`, montar, filtro y codificar.
- **Pendiente de decidir:** la primera banda dice «Son las diez de la noche» y la luz es de tarde.

## 37. Un acercamiento en vez del fundido, y el final en degradado (11-10-2026, petición del usuario)

- **El cambio de plano ya no deja fantasmas.** El fundido original (fotogramas 461 a 480) superponía la pantalla grande del primer plano, semitransparente, sobre el plano general: la pantalla «se comía» el portátil. Ahora es un acercamiento: los dos planos se deforman para que sus pantallas coincidan en cada fotograma, la pantalla crece dentro del portátil (de 312 a 863 px, a ritmo constante) con desenfoque de movimiento, y la sala pasa de un plano al otro alrededor. `review/pantalla-app/transition.py`.
- **El final es un degradado entero.** La franja «Sigue descubriendo AulaPro» va de transparente sobre el vídeo a crema, con un desenfoque que también crece hacia abajo (`.strip-in` y su `::before` con máscara), y la página sigue en el mismo crema: sin borde superior, sin sombra y sin la banda café. El vídeo ya no se oscurece por abajo (`.scrim`). La banda `.dusk` solo existe para la portada fija (móvil en horizontal y movimiento reducido).
- **El menú pasa a crema en cuanto el vídeo empieza a subir** (`app.js`), y no al terminar de salir: sobre la pantalla blanca del portátil sus enlaces claros no se leían.
- **El marco izquierdo del portátil, a la vista** (petición del usuario): en el primer plano, el borde izquierdo de la pantalla del vídeo original estaba más inclinado que el canto del portátil y, hacia abajo, se comía el marco (el lateral violeta oscuro lo disimulaba). Ahora ese borde va paralelo al canto (pendiente -0,1095) y el marco tiene el mismo ancho de arriba abajo, como el derecho; la franja que queda libre se pinta del color del marco, medido junto a la pantalla. `tracks.py` (`q614`) y `comp.py` (`OLD`, `BEZEL`).

## 38. Texto marrón y beige, marcas dentro de sus casillas (11-10-2026, petición del usuario)

- **Sobre fondo claro, marrón**: texto y títulos `#3b2a1f` (chocolate), secundario `#6e5644` (5:1 sobre el latte más oscuro), en lugar de casi negro. En todas las páginas (`--text`, `--ink`, `--text-2`, `--ink-2`).
- **Sobre fondo oscuro, beige**: `#f1e4cf` y, el secundario, `#d9c4a5` (portada del vídeo, menú sobre el vídeo, pie, visor de capturas, aviso de la demo, botones de tienda). En los botones terracota, crema `#fff6ea` (4,7:1).
- **Las marcas de las casillas quedan dentro** (la lista del vídeo y «Tacha la lista del domingo»): el dibujo ocupa la casilla, no se sale del borde.
- **«Tacha la lista del domingo» se tacha en terracota**, como la lista del vídeo (quedaba un violeta).

## 39. Google: una página por idioma, mapa del sitio y ficha de la app (11-10-2026, petición del usuario)

- **El problema**: la portada elegía el idioma por el navegador de quien la visitaba. Google la lee con un navegador en inglés, así que la portada en castellano podía quedar indexada en inglés, y el catalán no tenía dirección propia.
- **Una página por idioma**: `/` (castellano), `/ca` y `/en`. `web/idiomas.mjs` genera `ca.html` y `en.html` al publicar (paso de `web.yml`, antes de las huellas) con el texto traducido dentro del HTML, su título, descripción, `canonical`, `og:url` y `og:locale`. Los textos se siguen escribiendo solo en `index.html` (castellano) y `assets/i18n.js`. Las tres llevan `hreflang` entre sí (`x-default`: castellano).
- **La página no cambia de idioma sola**: los botones ES, CA y EN llevan a la página de ese idioma (en el mismo punto, con el `#`) y recuerdan la elección; quien eligió català o inglés y entra en `/` va a su página antes de que se vea nada (`<script id="lang-go">`, que no existe en `/ca` ni `/en`). Los enlaces antiguos con `?lang=` también llevan a su página. Las páginas legales, descargas, gracias y la demo enlazan la portada en su idioma.
- **`sitemap.xml` y `robots.txt`**: el mapa lista la portada en los tres idiomas (con sus alternativas), la demo y descargas; las legales y gracias llevan `noindex` y no están.
- **Ficha de la app para Google** (`application/ld+json`): SoftwareApplication, Windows y Android, educativa, 9,99 € hasta el 15-04-2027. El 16-04-2027 hay que cambiarla (docs/WEB.md, apartado 5, punto 9).
- **Pendiente del usuario**: dar de alta aulapro.app en Google Search Console y enviar el mapa del sitio.

## 40. Textos nuevos de la app (18-10-2026, petición del usuario: «actualizar la documentación de la app en la web»)

- **Pizarra y herramientas** (S4, tarjeta «Pizarra y herramientas»): ahora dice «Pizarra con lápiz, rotulador, subrayador y borrador, temporizador, ruleta, calculadora, sonómetro y retos para proyectar» (`s4.t3d`, en los tres idiomas). La app tiene desde la 2.12.0 esas cuatro herramientas, tres grosores, deshacer y rehacer, y dibuja sin retraso.
- **Privacidad** (S5): sexta casilla, «Lo que creas se autoguarda en tu equipo: si se cierra a medias, continúas donde lo dejaste» (`s5.p6`). Es el autoguardado de la 2.12.0 (borradores en el equipo con «Continuar» y «Descartar»). `privacidad.html` lo explica en el apartado 5 de «La aplicación», en los tres idiomas, y su fecha pasa al 18-10-2026.
- **Agenda con dos tarjetas** y **sesiones completadas**: son de la app y la portada no las nombra (la fila de S1 sigue diciendo «Agenda que lee tu horario con IA», que sigue siendo verdad). Se cuentan en el manual de la ayuda de la app y en las notas de la versión.
- **Pendiente**: las capturas (`assets/app/pizarra.webp`, la de la Agenda de la demo) y la demo son de antes: la barra de la pizarra dice ahora «Dibujar» y las herramientas salen al activarla, y la Agenda se abre en su portada con las dos tarjetas. Volver a ejecutar `scripts/web/capturar.mjs` cuando el dueño quiera estrenarlas (`demo.js` dibuja con cinco colores y borrador, como la app de antes; se puede acercar a las cuatro herramientas).

## 41. Toda la web con la app 2.13.1 y la pizarra de la demo con espacio (19-10-2026, petición del usuario)

- **Petición**: «actualizar toda la información de la app a la última versión» y que la pizarra de la demo tenga espacio suficiente, sin nada solapado.
- **Capturas**: se ha vuelto a ejecutar `scripts/web/capturar.mjs` entero con la app 2.13.1 (31 pantallas). Cambian la portada de Evaluar (tres tarjetas, con «Evaluar por foto»), la Agenda (portada de dos tarjetas), Recursos (cuatro tarjetas), Documentos, Configuración (tamaño de las letras), Anotar actitud (altavoz) y el resto de la app, que estaban de la 2.8.0. Nuevas en la demo: `evalfoto` (pestaña «Por foto»), `agendames` y `agendasemana` (pestañas Mensual y Semanal de la Agenda), y los saltos entre ellas funcionan. Las marcas de la portada no se han movido (`marcas.json` sin cambios).
- **Pizarra, el problema**: en la app las ventanas se abren juntas, arriba a la izquierda, y al activar el lápiz la paleta sale justo encima: tapaba la calculadora y rozaba la ruleta. Además lo que la demo dibujaba encima (cifras del temporizador, fichas, pantalla de la calculadora, aguja de la ruleta) era oscuro, de cuando la pizarra era oscura, y sobre la pizarra blanca de ahora quedaba como un parche.
- **Pizarra, la solución**: `capturar.mjs` reparte temporizador, ruleta y calculadora en fila por la pizarra, en la franja que dejan la barra de arriba con la paleta (170 px) y el dock (110 px). La portada lleva la misma idea con dos ventanas, a la izquierda (a la derecha la tapa la captura de Anotar actitud). La demo carga `pizarra-base.webp` (la captura sin temporizador, ruleta, pantalla de la calculadora ni paleta) y vuelve a dibujar todo eso con las medidas y los colores de la app (`INIT.pizarra` en `assets/demo.js`, CSS `.pz-*` en `demo.html`); `pizarra.webp`, la captura completa, es la que se amplía. Se borran `ruleta-disco.webp` y `ruleta-centro.webp`.
- **La demo de la pizarra ahora hace lo de la 2.13.1**: lápiz, rotulador, subrayador (translúcido, con sus colores) y borrador, tres grosores, deshacer, rehacer y «Borrar todo»; el lápiz de la barra de arriba muestra y oculta la paleta; el temporizador con su anillo que se gasta y sus colores (cian, ámbar, rojo); la ruleta **con memoria** (quien sale no vuelve a salir hasta «Reiniciar lista», con «Quedan n por salir» y «Volver a meter en el sorteo», y el círculo se rehace en el siguiente giro); la calculadora con el resultado en vivo y el historial. Los textos de la demo, en castellano, català e inglés (`demo-i18n.js`).
- **Textos de la portada** (`index.html`, `i18n.js`): Recursos pasa a «Fichas, lecturas y escape rooms» (fichas de menos a más con dibujos, comprensión lectora), nueva casilla de «Y además» con la lectura fácil para dislexia, «Evaluar por foto» en Evaluar y en «Tacha la lista», la racha en Anotar actitud, la tarjeta de Pizarra y herramientas (hasta 24 ventanas, ruleta con memoria, fondos y escenas) y dos preguntas nuevas: «¿Incluye el currículo de mi comunidad?» (Comunitat Valenciana, Cataluña y Madrid; el resto, el estatal) y «¿Sirve para PT y AL o para Educación Física?». Mismos cambios en català e inglés.
- **Pendiente**: la pantalla del portátil del vídeo de la portada sigue mostrando la app 2.8.0 (se rehace con `review/pantalla-app/`: capturar, montar fotograma a fotograma, filtro cálido y codificar; ver sección 36). La primera banda sigue diciendo «Son las diez de la noche».

## 42. La demo, como la app: con un ejemplo de cada cosa y los tres perfiles (19-10-2026, petición del usuario)

- **Petición**: que la demo sea exactamente como la app, con un ejemplo de cada cosa y sin que la IA haga nada, e incluir los apartados de Educación Física y de PT y AL.
- **Un ejemplo de cada creación de la IA**: los datos de ejemplo de la app no traen nada de lo que crea la IA, así que las pantallas salían con «Todavía no has guardado ninguna». `scripts/web/ejemplos.mjs` escribe a mano, con la forma exacta que guarda la app, un informe, una situación de aprendizaje (y una de EF), cuatro fichas (ejercicios, comprensión lectora, escape room y tarjetas), una corrección por foto (como borrador), una reunión y una formación con su acta, una autoevaluación, un circuito dibujado y los documentos de un alumno de PT y AL. `capturar.mjs` los mete en el perfil de ejemplo (localStorage, y las fichas completadas con la propia app) y pone una clave de IA falsa solo para que la app no pida la clave. Nada se genera ni se envía.
- **Tres perfiles**: `FASES=aula,ef,apoyo`. 83 pantallas (las de EF llevan `ef-` y las de PT y AL, `pt-`). La demo tiene un selector de perfil sobre la ventana, y los botones de cada menú llevan a las pantallas de su perfil.
- **Sin IA**: los botones que piden algo a la IA (`RE_IA` en `capturar.mjs`) avisan de que en la demo no se genera nada.
- Capturada con la app 2.13.2 (tarjetas grandes y tarjetas circulares de Recursos y Actividades con móviles).

## 43. Novedades de la 2.19 en la portada (25-10-2026, petición del usuario: «actualiza la web con las novedades de la 2.19»)

- **Qué cambia**: solo textos, en los tres idiomas (`index.html` para el castellano, `assets/i18n.js` para catalán e inglés). Ninguna captura ni la demo se han vuelto a hacer: las pantallas que salen no han cambiado de aspecto.
- **Recursos con IA** (`ia.d1d`, `ia.d3d`): las situaciones de aprendizaje valen para una o varias clases y el Word lleva la rúbrica y la diana de anexo; los informes llevan una tabla de competencias clave con un comentario de cada una.
- **Y además** (`ia.p7`, `ia.p8`, dos viñetas nuevas): PT y AL con el informe del orientador (la IA propone la ficha y los programas, con los objetivos del informe), el cierre del trimestre, los documentos de todo el alumnado de una vez y la adaptación de la programación de aula.
- **Evaluar** (`s3.p3`, `s3.p5`, `s2.a4`): el peso de cada nota dentro de su categoría, y la segunda página del acta con la evaluación por competencias.
- **Pregunta «¿Sirve para PT y AL o para Educación Física?»** (`a13`): añade el flujo de PT y AL de la 2.19. Dice «Tú lo revisas todo», porque la IA solo propone.
- **No se promete**: los formatos oficiales de Cataluña y Madrid para la adaptación (aún sin sus modelos) ni nada que dependa de probar en un dispositivo real.
- **Pendiente**: la pantalla del portátil del vídeo de la portada sigue siendo la de la app 2.8.0 (ver secciones 36 y 41).

## 44. Educación Física en la portada (25-10-2026, petición del usuario: «añade algo de EF en la web»)

- La portada solo nombraba Educación Física en una pregunta. Ahora, en «Y además» (`ia.p9`, `ia.p10`, dos viñetas nuevas): la anotación en la pista desde el móvil, los equipos equilibrados, el cronómetro de circuitos y las pruebas físicas, y las sesiones y situaciones de aprendizaje con IA con la pizarra de circuitos y su banco de material.
- La respuesta de «¿Sirve para PT y AL o para Educación Física?» (`a13`) añade lo mismo en una frase, antes de «Tú lo revisas todo».
- Solo textos, en los tres idiomas. La demo ya tenía el perfil de Educación Física (sección 42).

## 45. Trabajo compartido dicho como es (25-10-2026, petición del usuario: «revisa a fondo cómo funciona la app y actualiza todos los documentos»)

- La portada (`s5.p5`) y la pregunta sobre compartir (`a9`) decían que el trabajo compartido iba «sin pasar por ningún servidor» y que el registro de cambios mostraba «quién modificó qué y cuándo». Ninguna de las dos cosas era exacta: la conexión por código usa el servicio de encuentro de PeerJS y un STUN de Google, y el registro solo anota que se recibieron cambios. Ahora dicen que los datos van directos de un equipo a otro, sin guardarse en ningún servidor, y que el registro anota cuándo se reciben cambios.
- La privacidad (apartado 4 de la app) cuenta el servicio de encuentro, las direcciones IP que ven, el canal local sin cifrar y lo que se comparte. El apartado 3 dice que la sala de alumnos es una conexión local sin cifrar, y se añade un párrafo sobre el contenido incrustado en la pizarra (YouTube, Vimeo, Drive o la web que elija el docente). Fecha de actualización: 25 de octubre de 2026, en los tres idiomas.
- Solo textos. Si se quita Trabajo compartido, estas frases se retiran (`docs/COMPARTIR.md`, apartado 8).

## 46. Trabajo compartido pasa a ser un archivo cifrado (25-10-2026, petición del usuario)

- El usuario quitó la conexión por QR y código: ahora se comparte un archivo cifrado con contraseña (`docs/COMPARTIR.md`). La portada (`s5.p5`) y la pregunta sobre compartir (`a9`) lo dicen así, y la privacidad (apartado 4 de la app, en los tres idiomas) lo explica, incluido que la seguridad depende de la contraseña. Sustituye a lo escrito en la sección 45 sobre PeerJS y el canal local.
- La privacidad ya no habla de la cámara en Android: la app no pide ese permiso (no hay lector de QR).
- La demo y las capturas de Trabajo compartido se rehicieron el 26-10-2026 (sección 47).

## 47. Capturas y demo rehechas, y el nombre «AulaPro» (26-10-2026, petición del usuario)

- **Nombre**: «AulaPro», todo junto, en la app, la web y las capturas (la marca de la demo y de la portada decía «Aula Pro»). `web/sitio/index.html`, `demo.html` y `privacidad.html` en los tres idiomas.
- **Capturas**: se ejecutó `scripts/web/capturar.mjs` entero con la app 2.21.0 (83 pantallas de los tres perfiles, sin errores) y se regeneraron `assets/app/*.webp`, `assets/demo/*.webp` y `assets/demo-pantallas.js`. La pantalla de Trabajo compartido (`compartido.webp`, `ef-compartido.webp`) es ya la del archivo cifrado con contraseña, sin QR. El «Código QR» que sigue en la demo es el botón de la pizarra para proyectar un código, no el de compartir. Las marcas de la portada (`scripts/web/marcas.json`) no se han movido.
- **Demo comprobada** con Chromium sobre `web/sitio`: carga sin errores de consola ni recursos que fallen, y el salto del menú a «Trabajo compartido» enseña la pantalla nueva.
- **En un entorno sin el navegador de Playwright** se puede lanzar con `CHROMIUM=<ruta al ejecutable> node scripts/web/capturar.mjs`.
- **Pendiente**: la pantalla del portátil del vídeo de la portada sigue siendo la de la app 2.8.0. `review/pantalla-app/`, la carpeta con la que se montó fotograma a fotograma (sección 36), no está en el repositorio: hace falta recuperarla del equipo del dueño (con el vídeo original) para rehacerla. La primera banda sigue diciendo «Son las diez de la noche». **Pantallas nuevas de la demo (2.14 a 2.21)**: nueve más, hasta 92. Sesiones (`sesiones`, `sesiones-clase`, `sesion` con sus imágenes; pestaña «Sesiones» de Documentos), Recursos con una ficha de tarjetas interactivas (`tarjetas-panel` con Proyectar, Memory y Editar; `tarjetas-juego` y `tarjetas-girada`, que se alternan al tocar la tarjeta; `memory` con dos parejas encontradas; `tarjetas-editor`) y «Cuánto cuenta cada nota» (`pesos`, que se abre desde las categorías del Cuaderno). Los datos de ejemplo salen de `nuevasAula` en `scripts/web/ejemplos.mjs`, con dos imágenes del catálogo reducidas a JPEG como las guarda la app. La fase `nuevas` de `capturar.mjs` las hace (`FASES=aula,nuevas` para la pasada completa); el orden de las tarjetas se fija para que no cambie en cada captura. La biblioteca de Recursos lleva la ficha nueva la primera, para que quede en la primera fila y la demo pueda enlazarla.


## 48. Portada para la versión web (29-10-2026)

Petición del dueño: como la app pasa a ser web y se entra desde la propia página, una portada más sencilla. Arriba, «Iniciar sesión» (lleva a `/app/`) junto a «Quiero AulaPro»; en pantallas de menos de 440 px solo cabe «Iniciar sesión», porque «Quiero AulaPro» está en grande justo debajo. Fuera del menú «Privacidad» y «Descargar». Fuera de la página la lista del domingo (`#lista`) y la franja de la clave de IA y los idiomas (`.strips`), y de las preguntas las de compartir y packs (ya están en Precio). Los textos dicen «el ordenador, la tableta y el móvil» en vez de «Windows y Android», y las preguntas de la cuenta, los datos y los dispositivos cuentan la versión web. Pendiente: la página de descargas, la privacidad y las condiciones completas.

## Packs de 5 y 10 docentes (30-10-2026)

- Decisión del dueño: solo packs de 5 y 10 docentes (24,99 € y 44,99 €), con una clave única por pack; quien compra entra con su cuenta y la licencia se activa sola, y el resto escribe la clave. Los de 20 y 30 se quitan; para más de 10 docentes se escribe a contacto@aulapro.app. La portada enseña dos tarjetas (no cuatro), y `launch.js` y `web/comprobar.mjs` solo piden los enlaces del 5 y del 10. Las condiciones y `/gracias` (tres idiomas) lo dicen igual.

## Portada: sin marcha atrás (31-10-2026)

Al subir, la portada ya no reproduce el vídeo invertido: el paso hacia arriba recorre el vídeo buscando fotograma a fotograma, y hacia abajo se reproduce. Para que buscar sea instantáneo, `hero-scrub-60.mp4` está codificado con todos los fotogramas clave (`-g 1 -bf 0`, 9,6 MB); no volver a codificarlo con pocos. El suavizado del vídeo sigue al scroll con 0,22 por cuadro.
