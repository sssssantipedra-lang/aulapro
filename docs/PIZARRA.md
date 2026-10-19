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
- **Ruleta con memoria** (18-10-2026, petición del dueño): quien sale queda guardado por clase (`src/lib/ruleta.ts`,
  `aulapro_ruleta_<id de clase>`) y no vuelve a salir hasta «Reiniciar lista», aunque se cierre la pizarra. Dos
  ruletas de la misma clase comparten la lista. El círculo se rehace en el siguiente giro y no al salir alguien, para
  no recolocar los sectores al enseñar el resultado; «Volver a meter en el sorteo» devuelve a quien acaba de salir.
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
- **Dibujo** (de la 2.12.0, `src/components/pizarra/Lienzo.tsx` y `src/lib/trazos.ts`): lápiz (con presión), rotulador,
  subrayador translúcido y borrador que quita solo la parte por donde pasa; tres grosores; deshacer, rehacer y «Borrar
  todo». Los trazos son vectores en dos capas, así que salen al instante, también los largos (medido en la página: unos
  12 a 20 microsegundos por movimiento). Los controles van en una barra propia (`role="toolbar"`), centrada bajo la de
  arriba y solo mientras se dibuja. **No se debe volver a un dibujo que repinte el trazo entero en cada movimiento.**
- **Minimizar para aprovechar la pantalla** (19-10-2026, petición del dueño): cada ventana tiene en su asa un botón de
  minimizar que la reduce a un icono de 44 px en su misma esquina (`Ventana.min`, `LADO_MINIMIZADA`). La ventana sigue
  montada, oculta con `display: none`, así que un temporizador o un cronómetro siguen contando. La barra de arriba
  tiene «Minimizar todas las ventanas» (que pasa a «Restaurar todas») y «Ocultar las barras»: quita las dos barras, la
  de dibujo y el dock, y deja solo un botón discreto arriba a la izquierda para volver. Con la pantalla completa, la
  pizarra ocupa todo. Lo minimizado se recuerda al volver y viaja con las escenas.
- **Pantalla completa:** solo si el sistema lo permite; en el WebView de Android puede no hacerlo.

## Aspecto (decisión del dueño, 19-10-2026: «más minimalista y organizado, hay demasiados elementos juntos»)

- Barra superior de **solo iconos** (lápiz, fondo, escenas, pantalla completa) con el nombre al pasar el ratón. La
  paleta del lápiz es una barra aparte, centrada, que solo sale mientras se dibuja.
- Barra inferior de **solo iconos en cuatro grupos**: tiempo (temporizador, cronómetro, reloj), clase (semáforo,
  símbolos, plan, nota), participación (ruleta, grupos, dados, marcador) y recursos (calculadora, sonómetro,
  contenido, QR), y «Reto» al final.
- **Las herramientas no tienen tarjeta** (19-10-2026, petición del dueño: «en lugar de tarjetas, que ocupen menos
  espacio; la ruleta, por ejemplo, directamente»): cada una se pinta sobre la pizarra, sin fondo, cabecera ni relleno.
  Se arrastra desde cualquier parte que no sea un control (`cancel` de `Rnd`); al pasar el ratón sale arriba a la
  derecha una pastilla con un asa y la X (siempre visible en pantallas táctiles, `@media (hover: none)`). Las ventanas
  por defecto son unos 60 px más pequeñas que con tarjeta.
- **El color sigue al fondo:** el contenedor de la pizarra define `--pz-rgb` (blanco sobre fondos oscuros, azul pizarra
  `15,23,42` sobre claros) y las herramientas escriben con `rgba(var(--pz-rgb), x)` en vez de blanco fijo. `--pz-accent`
  es el color de cada herramienta (solo en su botón principal) y `--pz-ac`, ese mismo color mezclado con la tinta para
  poder usarlo como texto en cualquier fondo. Una herramienta nueva no debe escribir colores fijos claros ni oscuros.
- Las barras y los menús siguen siendo una superficie plana de un solo color (`#1e2433`), sin degradados ni brillos.
  Los botones principales son sólidos.
- Los menús de fondo y de escena son una cuadrícula de muestras y una lista, sin textos explicativos salvo cuando aún
  no hay ninguna escena.

## Decisiones

- Las ventanas se pintan siempre en el mismo orden del DOM (por identificador) y el apilado va por `z-index`:
  reordenar nodos recargaría el contenido incrustado (un iframe).
- Lo que depende del azar (dados, grupos) recibe el generador como parámetro para poder probarlo.
- `scripts/web/capturar.mjs` busca los botones de la pizarra por su nombre accesible («Añadir Calculadora», «Dibujar
  sobre la pantalla», «Dejar de dibujar»…): si se cambian, se cambia también el script.

## Lo que falta

- Webcam, tiempo meteorológico, imagen propia como fondo, encuesta en pantalla (existe «Actividades con móviles»).
- Que una escena recuerde también lo escrito dentro de las ventanas.
- Comprobar en un móvil Android real (barra inferior, pantalla completa) y en un proyector.
- Las capturas de la portada y de la demo de la web se han vuelto a hacer enteras con la 2.13.1 (19-10-2026, `web/DISENO.md`,
  sección 41). La demo vuelve a dibujar el lápiz y su paleta, el temporizador, la ruleta (con memoria) y la pantalla de
  la calculadora sobre una captura sin ellos: si cambian las medidas, los colores o las reglas de esas herramientas
  (grosores, opacidad del subrayador, colores, qué sale al girar la ruleta…), hay que cambiar también `INIT.pizarra` en
  `web/sitio/assets/demo.js` y su CSS (`.pz-*` en `demo.html`), y volver a ejecutar `scripts/web/capturar.mjs`.
- **Las ventanas se abren juntas, arriba a la izquierda, y la paleta del lápiz (que sale a 66 px del borde de arriba) tapa lo
  que haya debajo**: con el lápiz activado y la calculadora abierta, la paleta cubre su pantalla. Es del diseño actual; las
  capturas de la web reparten las ventanas a mano para que se vean bien. Si se quiere arreglar en la app, `huecoLibre`
  podría dejar libre también la franja de la paleta (`margen.arriba` de 70 a unos 120 px).
