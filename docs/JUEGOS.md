# Juegos para la clase

Petición del dueño (26-11-2026): una sección de juegos por áreas (Matemáticas, Lengua castellana, Valenciano, Inglés y Ciencias), dos juegos por área, cada uno por los cinco tramos (1.º y 2.º de Primaria, 3.º y 4.º, 5.º y 6.º, 1.º y 2.º de ESO y 3.º y 4.º de ESO). «Todo eso tiene que ser súper interactivo. Muy visual, al menos en Primaria. Y que sea una especie tipo de juego.» Se hace por fases; la primera (26-11-2026) es la galería y el segundo juego de matemáticas, «La recta numérica». El primero, «Tirar de la cuerda» (25-11-2026), está en `docs/PIZARRA.md`.

## La galería

- **Sin entrada nueva en el menú.** En Recursos, la tarjeta «Juegos para la clase» es una galería (`components/juegos/GaleriaJuegos.tsx`) con un filtro por área (Todas, Matemáticas, Lengua castellana, Valenciano, Inglés y Ciencias; se recuerda en el dispositivo, `aulapro_juegos_area`) y una tarjeta grande por juego: portada, área, nombre, para qué sirve, los cinco tramos marcados y «Jugar». En Pizarra y herramientas, el botón del mando abre la misma galería en una ventana (`VentanaJuegos`; se cierra con la X, Escape, tocando fuera o el botón de atrás) y, al elegir, el juego se abre encima de la pizarra, que sigue viva debajo.
- **Lo que aún no existe sale como «Próximamente»**, sin poderse abrir: con «Todas», una tarjeta por área a la que le faltan juegos («2 juegos nuevos de esta área…»), para no llenar la galería de huecos; con un área elegida, la suya.
- **Catálogo** (`lib/juegos/catalogo.ts`): cada juego es una entrada con `id`, área, nombre, descripción, tramos, color y `cargar` (el componente, que se pide solo al abrirlo y recibe `{ clase, onClose }`; lo monta `components/juegos/JuegoAbierto.tsx`). **Añadir un juego es añadir una entrada**, sus textos en un archivo de `i18n/tanda/` y, si se quiere, su portada (`public/juegos/<id>/portada.webp`; sin ella, la de código de `PortadaJuego`).
- **Tramos comunes** (`lib/juegos/tramos.ts`): los cinco y `tramoDeClase`, que propone el tramo por la etapa y el curso de la clase activa o por su nombre (antes `nivelDeClase` de la cuerda, que sigue existiendo como alias).
- **Piezas comunes** (sacadas de la cuerda sin cambiar cómo se comporta; sus pruebas siguen pasando): `Boton.tsx` (las teclas actúan al tocarlas y los demás botones al soltar), `EditorNombre.tsx` (el teclado de los nombres de los equipos) y `usoJuego.ts`: `useJuegoAbierto` (tamaño, cerrar si se oculta, sin desplazar lo de debajo, `wakeLock`, sin los atajos de Ctrl o ⌘ de la app y Escape para salir), `usePantallaCompleta`, `useConfeti`, `useSegundoToque` (salir en mitad de una partida pide dos toques) y `useHueco` (abajo). La raíz de cada juego lleva la clase `juego-abierto`: con ella la versión nueva de la app no se instala (`docenteOcupado` en `platform/web.ts`). Los sonidos cortos con Web Audio están en `lib/juegos/efectos.ts` (se callan con el altavoz del juego, `aulapro_juegos_silencio`). Los dos juegos comparten la base de estilos de `estilos/cuerda.css` (controles, ajustes, cuenta atrás y ganador); lo nuevo va en `estilos/juegos.css`.

## «La recta numérica» (26-11-2026)

**Cómo se juega.** Sale un número (el mismo para los dos equipos). Cada equipo tiene su propia recta: en horizontal, su mitad de la pantalla (rojo a la izquierda, azul a la derecha); en vertical, cara a cara, con el azul arriba y girado. Toca su recta y arrastra su marcador hasta donde cree que está, y lo fija con «¡Aquí!». Cuando los dos lo han fijado, o se acaba el tiempo (la barra de abajo, que se vacía de verde a rojo, con un «tic» en los tres últimos segundos), se revela: el número cae como una estrella y se queda una bandera con su valor, una regla mide lo lejos que ha quedado cada uno y gana el punto quien está más cerca; empate exacto, punto para los dos; quien no ha puesto su marcador no puntúa. Menos de un 1 % de la recta es «¡Diana!». Arriba, el marcador de estrellas y una bola por ronda con el color de quien la ganó. Se juega a 5, 7 o 10 rondas; si al final van empatados, hasta tres rondas de desempate y, si siguen, empate. Al final, trofeo, la mascota celebrando, confeti, «Jugar otra vez» y «Cambiar el nivel» (que esperan 1,5 s, como en la cuerda).

**Tramos** (los números los genera el código, `lib/juegos/recta.ts`, con pruebas; en los ajustes se elige qué números salen o «Mezcla»):

| Tramo | Qué números salen | Recta |
|---|---|---|
| 1.º y 2.º de Primaria | Del 0 al 10 (del 1 al 9) y del 0 al 20 (del 1 al 19); el número también con puntos en marcos de diez | Marcas de 1 en 1, todas con su número; el marcador se queda en el entero más cercano al soltarlo (imán) |
| 3.º y 4.º | Del 0 al 100 y del 0 al 1000; solo uno de cada diez cae en una marca | Marcas de 10 en 10 y de 100 en 100 |
| 5.º y 6.º | Decimales de una cifra (del 0 al 1 y del 0 al 10) y fracciones irreducibles de medios, tercios, cuartos, quintos y décimos (del 0 al 1 y del 0 al 2, también impropias) | Del 0 al 1 con décimas (número en 0, 0,5 y 1); del 0 al 10 con medias unidades; las de fracciones, solo con los enteros |
| 1.º y 2.º de ESO | Enteros de −20 a 20 y de −100 a 100 (sin el 0); fracciones (medios a quintos) y decimales con negativos, de −2 a 2 | De 1 en 1 con número cada 5; de 10 en 10 con número cada 50; de −2 a 2 con medias unidades |
| 3.º y 4.º de ESO | Fracciones (hasta octavos) y decimales de dos cifras de −3 a 3; raíces no exactas (√2 a √99) del 0 al 10; expresiones del 0 al 20 (2,5 · 4, 18 : 4, 1,5², 35 % de 40, ¾ de 12) y un decimal o una fracción en una recta del 0 al 100 % (hay que pasarlo a porcentaje) | Solo los enteros, o de 1 en 1 con número cada 5, o del 0 % al 100 % de 25 en 25 |

**Decisiones.**
- **La cercanía, en proporción a la longitud de la recta** (`distanciaRelativa`): quedarse a 1 en la del 0 al 10 vale como quedarse a 100 en la del 0 al 1000. La distancia que se enseña está en las unidades de la recta (enteros con imán o en rectas de 100 o más, una cifra decimal en las de más de 10 y dos en las de 10 o menos). Los marcadores se redondean a la milésima de la recta, así que un empate exacto es posible pero raro (salvo con imán).
- **Fijar con «¡Aquí!», no al soltar** (el dueño dejó las dos opciones): el alumnado de 1.º levanta el dedo para mirar y vuelve a tocar; fijar al soltar dejaba marcadores mal puestos sin querer. Al acabar el tiempo cuenta lo que cada uno tenía puesto.
- **Que nadie copie**: cada equipo ve su recta y su marcador; al fijarlo, el marcador se esconde («¡Listo!») hasta revelar. Mientras arrastra se ve (hace falta para colocarlo), y en horizontal la recta del otro está al lado: es el límite que queda.
- **Multitoque**: cada recta atiende a su propio dedo (`setPointerCapture` con su `pointerId`; un dedo que no es el suyo no la mueve) y los movimientos se juntan en uno por fotograma; todo el juego lleva `touch-action: none`. Tocar en cualquier punto de la recta lleva el marcador allí. Con el teclado: el rojo mueve con A y D y fija con S; el azul, con ← y → y fija con ↓ (con Mayúsculas, a saltos de un veinteavo de la recta); Intro pasa de ronda. Con el ratón, como con un dedo.
- **Tiempo** para poner el marcador: 10, 15, 20 o 30 s, o sin límite; de partida, 20 s en Primaria y 15 en ESO (más ritmo). Los ajustes se recuerdan en el dispositivo (`aulapro_recta`); el tramo de partida es el de la clase activa.
- **Aspecto**: en Primaria, un escenario con cielo, nubes, sol, colinas y árboles, la recta como un tablón de madera con postes y carteles con sus números, y una mascota por equipo (el zorro del rojo y el pingüino del azul, del catálogo de dibujos de la app) que corre mientras se arrastra, bota cuando está puesta, salta al ganar y se pone triste al perder. En ESO, el mismo juego sobrio: fondo de cuadrícula oscuro, una línea fina, chinchetas de color y una línea dorada al revelar, sin mascotas. Botones y marcadores de 44 px o más; la letra crece con la pantalla (vmin) para leerse desde el fondo en una pantalla digital. Igual en claro y en oscuro (lleva su propio escenario, como la cuerda). Con «reducir movimiento», sin carreras, saltos, caídas ni sellos: el número aparece en su sitio.
- Nada sale del dispositivo ni se guarda nada del alumnado: ni la privacidad ni las condiciones cambian.

**Piezas**: `components/juegos/LaRectaNumerica.tsx` (pantalla), `lib/juegos/recta.ts` (rectas, números, escritura con coma o punto según el idioma, distancia y la partida como reductor puro con semilla), pruebas en `lib/juegos/recta.test.ts` y `components/juegos/LaRectaNumerica.test.tsx` (dos dedos a la vez, marcador escondido, tiempo, imán, teclado y final), textos en `i18n/tanda/juegos.ts`.

### Huecos de imagen

El dueño generará los dibujos con los modelos de ChatGPT y Gemini. Cada dibujo importante es un «hueco» con nombre: si existe `public/juegos/recta/<nombre>.webp`, se usa; si no, se pinta la versión hecha con código (`useHueco` en `components/juegos/usoJuego.ts`, que lo prueba una vez por sesión). Poner o quitar un dibujo no pide cambiar código. **Ningún dibujo lleva texto ni números**: los pone la app. En ESO no hay mascotas ni bandera (solo cuentan sus fondos).

| Archivo (`public/juegos/recta/`) | Qué es | Tamaño y proporción | Fondo transparente | Dónde sale |
|---|---|---|---|---|
| `portada.webp` | Portada del juego | 1600 x 900 (16:9) | No | Tarjeta de la galería y portada del juego (sale entera en la tarjeta, recortada al centro si no es 16:9) |
| `fondo-p12-ancho.webp`, `fondo-p34-ancho.webp`, `fondo-p56-ancho.webp`, `fondo-e12-ancho.webp`, `fondo-e34-ancho.webp` | Escenario de cada tramo para un panel más ancho que alto: cielo y paisaje, con el suelo abajo | 1600 x 1000 (16:10) | No | Cara a cara (móvil y tableta en vertical) y mitades anchas. Se recorta para llenar el panel, pegado abajo: la recta va sobre el suelo, a un 30 % del borde de abajo; deja esa franja despejada |
| `fondo-p12-alto.webp` … `fondo-e34-alto.webp` | Lo mismo para un panel más alto que ancho | 1000 x 1200 (5:6) | No | Las dos mitades en horizontal (pantalla digital, ordenador, tableta tumbada) |
| `mascota-roja-quieta.webp`, `-corriendo`, `-saltando`, `-celebrando`, `-triste` | Mascota del equipo rojo en cada pose | 512 x 512 (1:1), de pie, con los pies centrados abajo | Sí | Sobre su punto de la recta (Primaria): quieta antes de tocar, corriendo al arrastrar, saltando ya puesta, celebrando o triste al revelar y en el ganador. Sin una pose se usa la quieta con el movimiento de código |
| `mascota-azul-quieta.webp` … `mascota-azul-triste.webp` | Lo mismo para el equipo azul | 512 x 512 (1:1) | Sí | Igual, en el panel azul |
| `bandera.webp` | Bandera o mástil que marca el número exacto | 256 x 384 (2:3), con la base del palo centrada abajo | Sí | Al revelar, en el sitio del número (Primaria), con el valor encima |
| `estrella.webp` | Estrella de premio | 256 x 256 (1:1) | Sí | La que cae al revelar (Primaria) y la de los puntos de cada equipo |
| `trofeo.webp` | Trofeo | 512 x 512 (1:1) | Sí | Pantalla del ganador |

Para «Tirar de la cuerda», la galería busca también `public/juegos/cuerda/portada.webp` (1600 x 900, sin transparencia); sin él, enseña los dos robots.

### Sin comprobar

- Dedos reales en una tableta, en un móvil y en una pantalla digital táctil (se probó con toques simultáneos de Chromium por CDP, dos dedos moviéndose a la vez en 1024 x 768 y en 390 x 844 cara a cara), Safari en el iPad y el iPhone, y el sonido de Web Audio en un iPhone con el interruptor de silencio.
- Que los rangos y las rectas de cada tramo los den por buenos un maestro y un profesor de matemáticas, y los textos en catalán y en inglés, un hablante.
- Los dibujos del dueño: el código los espera con esos nombres, pero no se ha probado con dibujos reales de esas proporciones.
