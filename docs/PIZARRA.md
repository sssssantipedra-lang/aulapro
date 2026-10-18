# Pizarra y herramientas (Aula Live)

Petición del dueño (18-10-2026): que el apartado «Aula Live» (en la app, En clase › «Pizarra y herramientas»,
`src/pages/SecClassroom.tsx`) se parezca a Classroomscreen (classroomscreen.com/app). No se copia código ni imágenes de
esa web: se parte de lo que hace una pizarra de aula de ese tipo y se escribe aquí desde cero. **No se pudo abrir
classroomscreen.com desde la sesión que lo hizo** (el entorno bloquea esa dirección), así que el parecido sale de
la interfaz pública que se conocía, no de una comparación pantalla a pantalla.

## Lo que hay

- **Herramientas:** temporizador, ruleta (por clase), calculadora, sonómetro, contenido incrustado, reloj y fecha,
  cronómetro con vueltas, semáforo, símbolos de trabajo, dados (1 a 6), grupos (de la clase elegida, por tamaño o por
  número), marcador por equipos, plan del día con casillas, nota y código QR. «Reto» proyecta una ficha.
  Las nuevas están en `src/components/live/PizarraWidgets.tsx` y la lógica sin pantalla, en `src/lib/pizarraAula.ts`.
- **Varias ventanas de cada herramienta** (19-10-2026, como Classroomscreen): cada pulsación en la barra inferior abre
  otra ventana, hasta 24 (`MAX_VENTANAS`). Cada una es una instancia con su identificador (`timer`, `timer-2`…) y
  funciona por su cuenta: dos notas no comparten texto, dos marcadores no comparten puntos. La nueva se coloca en el
  primer hueco libre de la pizarra (`huecoLibre`) y, si no cabe sin tapar a otra, en cascada. El número sobre el icono
  dice cuántas hay abiertas. Lo que se escribe dentro de una ventana se guarda con la clave
  `aulapro_pizarra_d:<id>:<campo>` y se borra al cerrarla (`borrarDatosDeVentana`).
- **Fondos:** 4 claros y 4 oscuros (`FONDOS`). El tono decide los colores del lápiz, y lo ya dibujado se recolorea.
- **Escenas:** una disposición con nombre (qué ventanas, dónde y qué fondo), hasta 12. Guarda la disposición, no lo
  escrito dentro: al recuperarla las ventanas salen limpias. La última disposición se recupera al volver a entrar.
  Todo es del dispositivo (`localStorage`, claves `aulapro_pizarra_*`): no sale de él ni va en las copias.
- **Pantalla completa:** solo si el sistema lo permite; en el WebView de Android puede no hacerlo.

## Aspecto (decisión del dueño, 19-10-2026: «más minimalista y organizado, hay demasiados elementos juntos»)

- Barra superior de **solo iconos** (lápiz, fondo, escenas, pantalla completa) con el nombre al pasar el ratón. La
  paleta del lápiz es una barra aparte, centrada, que solo sale mientras se dibuja.
- Barra inferior de **solo iconos en cuatro grupos**: tiempo (temporizador, cronómetro, reloj), clase (semáforo,
  símbolos, plan, nota), participación (ruleta, grupos, dados, marcador) y recursos (calculadora, sonómetro,
  contenido, QR), y «Reto» al final.
- Superficie plana de un solo color (`#1e2433`) en ventanas, barras y menús: sin degradados, sin desenfoque y sin
  brillos. La cabecera de la ventana es una línea con un punto del color de la herramienta, el título pequeño y la X.
  Ese color solo se usa en el botón principal (`--pz-accent`). Los botones principales son sólidos, sin degradado.
- Los menús de fondo y de escena son una cuadrícula de muestras y una lista, sin textos explicativos salvo cuando aún
  no hay ninguna escena.

## Decisiones

- Las ventanas se pintan siempre en el mismo orden del DOM (por identificador) y el apilado va por `z-index`:
  reordenar nodos recargaría el contenido incrustado (un iframe).
- Lo que depende del azar (dados, grupos) recibe el generador como parámetro para poder probarlo.
- `scripts/web/capturar.mjs` busca los botones de la pizarra por su nombre accesible («Añadir Calculadora», «Dibujar
  sobre la pantalla», «Desactivar lápiz»…): si se cambian, se cambia también el script.

## Lo que falta

- Webcam, tiempo meteorológico, imagen propia como fondo, encuesta en pantalla (existe «Actividades con móviles»).
- Que una escena recuerde también lo escrito dentro de las ventanas.
- Comprobar en un móvil Android real (barra inferior, pantalla completa) y en un proyector.
- Las capturas de la portada y de la demo de la web se han vuelto a hacer solo para la pizarra (19-10-2026). Al
  ejecutar `scripts/web/capturar.mjs` entero cambian también otras pantallas (Evaluar, Recursos, Configuración…)
  porque sus capturas estaban desfasadas respecto a la app: conviene regenerarlas en otro cambio.
