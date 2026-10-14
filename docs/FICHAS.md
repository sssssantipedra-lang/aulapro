# Fichas de trabajo (Recursos)

Cómo se generan, cómo se ven y qué falta. Las decisiones llevan su fecha; si una cambia, se cambia aquí en el mismo cambio.

## Dónde está cada cosa

- `src/services/resources.ts`: lo que se le pide a la IA (esquema, prompts) y la limpieza de lo que devuelve.
- `src/services/exportFicha.ts`: la hoja (HTML para el PDF y la vista previa) y el Word.
- `src/services/fichaCuaderno.ts`: el diseño «Cuaderno» (cabeceras, recuadros, listas de cálculos, estilos).
- `src/lib/fichaThemes.ts`: los temas (aspecto de la ficha). `src/lib/fuenteCuaderno.ts`: la letra incrustada.
- `src/lib/ilustraciones.ts` y `ilustraciones.catalogo.json`: el catálogo de ilustraciones.
- `src/lib/hilos.ts` y `docs/HILOS.md`: los hilos conductores, la clasificación de los dibujos por tópicos y el detector de qué trata una ficha.
- `scripts/ilustraciones/`: la lista de ilustraciones y el generador con fal.ai.
- `src/pages/Resources.tsx` y `src/components/fichas/`: la pantalla, el editor (`DibujosEditor.tsx`: selector del hilo y dibujos de cada ejercicio) y la vista previa.

## Aspecto: el tema «Cuaderno» (14-10-2026)

Por qué: las fichas de ChatGPT con imagen salen mejor maquetadas que las nuestras (cinta de título, bloques numerados con color, ejercicios compactos, recuadros laterales). Casi todo eso es maquetación, no ilustración, así que se hace en código, sin imágenes de IA: nítido al imprimir, editable y sin enviar nada.

- Es un tema más (`FichaThemeId` `cuaderno`) y el que sale por defecto al crear una ficha. «Clásica» y los once temas con historia siguen como estaban; las fichas guardadas no cambian. Un tema sin historia lleva `historia: false` (`conHistoria()` lo consulta); «Cuaderno» y «Clásica» no llevan historia.
- Cabecera: cinta con el título (la letra baja con los títulos largos) y, a su lado, una ilustración de cabecera elegida por el catálogo según el tema, el área y el curso.
- Cada bloque va numerado en un círculo con el color del bloque (verde, naranja, rosa, violeta, en rotación). Un solo ejercicio en el bloque no lleva número; con listas de cálculos, los ejercicios llevan letras (A., B.) para no confundirse con las líneas 1., 2.; si no, números.
- Tipo de ejercicio nuevo, `calculos`: una lista de líneas (`lineas`) con su «=» y su hueco a la derecha, en línea o en caja (`respuesta`). Funciona en todos los temas.
- En «Cuaderno», una serie corta de `ordenar` (3 o más elementos de hasta 14 caracteres: números, palabras sueltas) se escribe en orden en una caja; las largas (pasos de un proceso) se siguen numerando.
- Recuadro lateral por bloque (`FichaActivity.recuadro`): «Recuerda» (chincheta, con leyenda `SIGLA = significado`), «Reto» (estrella, con su hueco de respuesta) o «Consejo» (bombilla). La IA lo pide solo en «Cuaderno» y solo en algunos bloques; el editor deja ponerlo en cualquier tema. Con otros temas sale debajo de los ejercicios. En la hoja flota a la derecha y los ejercicios corren a su lado (no es una rejilla de dos columnas: una rejilla no se parte entre páginas y dejaba media hoja en blanco); un bloque puede partirse entre ejercicios, nunca dentro de uno.
- La letra es Outfit (la de la app, OFL), incrustada en el HTML del PDF y de la vista previa; en el Word, Trebuchet MS.
- Word: título en bloque azul, bloques numerados con color, listas de cálculos, series con su caja y el recuadro en una caja debajo de los ejercicios (Word no admite SVG ni columnas flotantes sencillas).
- La vista previa y el PDF tienen la misma anchura útil (178 mm con margen de 16 mm); el PDF de Electron imprime con 14 mm de margen lateral (`electron/main.cjs`), así que la hoja es algo más ancha al imprimir.

## Catálogo de ilustraciones (14-10-2026)

Ninguna imagen entra suelta. Cada ilustración lleva:

- `id` con prefijo de familia (`ani-perro`, `mat-reloj`, `cab-base10`…),
- `descripcion` en es, ca y en: qué se ve, en una frase,
- `temas`: tópicos comunes (castellano, sin tildes, minúscula) que cubre,
- `areas` (las del motivo de una ficha, `fichaMotifs.ts`), `etapas` y `uso`: `cabecera`, `mascota`, `objeto` o `escena`.

La app la relaciona sola con lo que se trabaja: `elegirIlustraciones({ tema, area, nivel })` puntúa cada una (temas que empiezan una palabra del tema o del área, área deducida, palabras de la descripción, etapa) y devuelve las mejores; sin coincidencia, las generales. Para la IA hay una lista cerrada con identificador y descripción (`listaIlustracionesParaIA`), como con los pictogramas: la IA elige, nunca dibuja ni inventa. Los temas se buscan por comienzo de palabra: «arte» ya no encuentra «partes» (también se arregló en `pickMotifKey`); los de tres letras o menos («sol», «mar», «pez») solo cuentan como palabra entera o en plural, para que «sol» no encuentre «solar».

Dos orígenes:

- `svg`: dibujadas en `fichaCuaderno.ts` (las cabeceras por área y las tres mascotas de los recuadros).
- `img`: generadas con fal.ai con `scripts/ilustraciones/generar.mjs` a partir de `lista.mjs` y `lista-ampliada.mjs` (281 motivos comunes, pensados para reutilizarse en muchos escenarios: animales, naturaleza y tiempo, alimentación, cole y material escolar, matemáticas y formas, historia, cuerpo humano y salud, ciencia y espacio, transporte, música, deporte, artes y manualidades, valores y emociones, profesiones, ropa, hogar, juegos, tecnología, seguridad, fiestas, idiomas y lugares). Quedan en `public/ilustraciones/<id>.webp` (384 px, fondo transparente, unos 21 KB cada una y unos 6 MB en total, dentro de la app y sin conexión) y en `ilustraciones.catalogo.json`, que el script reescribe: no se toca a mano.

Generar:

```
node scripts/ilustraciones/generar.mjs --dry                 # valida la lista y cuenta, sin red ni clave
FAL_KEY=… node scripts/ilustraciones/generar.mjs --solo ani-perro,mat-reloj,his-castillo   # unas pocas, para ver el estilo
FAL_KEY=… node scripts/ilustraciones/generar.mjs             # las que faltan
```

- Modelo barato: `fal-ai/flux/schnell` (768 × 768, una llamada por imagen; precio del 14-10-2026: 0,003 $ por megapíxel, unos 0,002 $ por imagen). El script se niega a usar un modelo cuya licencia comercial no esté revisada (`MODELOS_PERMITIDOS`): FLUX.1 schnell vale para uso comercial; FLUX.1 dev no.
- El fondo se quita en local (`fondo.mjs`, relleno desde los bordes) y no con un quitafondos de IA: `fal-ai/imageutils/rembg` dejó el perro con solo la cabeza y el cuerpo medio transparente (prueba del 14-10-2026), porque el sujeto es del color del fondo. Por eso el estilo pide «fondo blanco liso, contorno grueso, sin sombra».
- Los modelos no cuentan ni escriben: pedido «un reloj a las tres», dibujó las diez, y los calendarios, reglas, transportadores, ejes de gráficos, teclados, el visor de una calculadora o el cartel de un mercado salían con números y letras inventados (se quitaron o se volvieron a pedir «sin números, sin letras, en blanco»). Las ilustraciones son decorativas, nunca el dato de un ejercicio (la hora, una cantidad, un nombre).
- Cómo se revisa cada tanda (14-10-2026): se miran las imágenes una a una, se descarta lo que invente texto o números, lo que sea otra cosa (una brújula que parecía un reloj, un prisma que parecía un vaso) o lo que ocupe todo el cuadro como un paisaje (un sujeto aislado queda bien en cualquier ficha; un paisaje a sangre no), y se pide otra vez con una frase más estricta («objeto aislado, sin cielo, sin suelo»). Al acabar, una hoja de contacto sobre fondo gris enseña si el recorte del fondo es limpio.
- Limitaciones conocidas del recorte: lo que el relleno desde los bordes no alcanza (el hueco blanco entre las cuerdas de un columpio, el interior de unos auriculares, lo de debajo de una mesa) se queda blanco opaco: sobre papel blanco no se ve, sobre un color sí. Las piezas diminutas sueltas (gotas de lluvia, confeti) se borran como motas.
- Las que ya están no se regeneran (ni se pagan); el catálogo se guarda a cada imagen.
- Dos formas de generarlas: (1) con la clave `FAL_KEY` en el entorno, que además necesita permitir en la red los hosts `fal.run` y `*.fal.media` (las imágenes salen de `v3b.fal.media`, no solo de `v3`); (2) sin clave ni red, con el conector MCP de fal en una sesión de Claude (https://mcp.fal.ai/mcp-relay, hay que abrir sesión nueva tras conectarlo): se genera con el conector (`submit_jobs` de 8 en 8, a 640 × 640), se leen las imágenes con `inspect_images` (que las deja como archivos locales de vista previa) y se meten con `--importar id=archivo`. Así se hicieron las 281 el 14-10-2026, con unas 350 generaciones (las que se repitieron incluidas), que a unos 0,002 $ cada una son menos de 1 $ de crédito de fal.ai (cálculo, no factura).
- Antes de publicar, revisar las imágenes a ojo: estilo común, sin texto ni deformaciones.
- Para añadir ilustraciones: una fila nueva en `lista-ampliada.mjs` (con su motivo en inglés, sus tres descripciones, sus temas y sus áreas; `lista.mjs` lleva las primeras, la ampliación lleva el resto) y volver a ejecutar.
- Estado (14-10-2026): hechas y en el catálogo las 281 (con el visto bueno del dueño al estilo). Se descartaron, tras varios intentos, el calendario, la regla, el transportador y el cinturón de seguridad (el modelo los llena de números o no los reconoce). El script y la lista están probados (`scripts/ilustraciones/generar.test.mjs`; `src/lib/ilustraciones.test.ts` comprueba que cada `img` tiene su archivo, ids únicos, las tres descripciones y temas en minúscula sin tildes).

## Hilo conductor: las fichas con dibujos (14-10-2026)

Los 281 dibujos del catálogo se clasifican por tópicos en **hilos conductores** (`src/lib/hilos.ts`, índice completo en `docs/HILOS.md`, generado por una prueba). Un hilo es el «mundo» de lo que se trabaja: la granja, el sistema solar, el cuerpo humano, repartir en partes iguales, el mercado y el dinero, la Edad Media… Son 57, con nombre en los tres idiomas, las palabras del tema que lo activan, las áreas donde es natural y sus dibujos, del más al menos protagonista. Un dibujo puede estar en varios hilos (la pizza, en el reparto y en la cocina); todos están al menos en uno (lo comprueba una prueba).

**Cómo reconoce la app de qué trata la ficha** (`detectarHilos`, `hiloDeFicha`): las palabras de cada hilo se buscan en el tema (no en el nombre del área: «Ciencias Naturales» no activa nada ni «Lengua» activa los sentidos). Cada palabra vale 3 puntos (más si es larga), que el hilo sea del área que se deduce, 1,5, y cada dibujo suyo que encaja con el tema, 0,5 (hasta 2). De las palabras que empiezan igual («animal», «animales») cuenta la más larga, y un hilo `amplio` (los animales, los seres vivos, el cole, el laboratorio) resta 1,5, para que «los animales de la granja» sea la granja y no los animales. Con menos de 3 puntos no hay hilo detectado y vale el del área (matemáticas: números y cálculo; ciencias sociales: la ciudad…); sin área, el cole. El hilo que se le pone a una ficha lo puede cambiar o quitar el docente.

**Qué se hace con el hilo** (solo diseño «Cuaderno», formato ficha y sin apoyos visuales, que ya llevan sus pictogramas; `resolverHilo`):

- A la IA se le dice el hilo («ambienta los enunciados en ese mundo cuando encaje») y se le da la lista cerrada de los dibujos de ese hilo, con su identificador y su descripción; los que no se pueden repetir van marcados `[solo 1]`. Elige en `dibujos` de un ejercicio (de 1 a 3, con `cantidad`) y solo cuando ayudan a hacerlo o lo ambientan: contar, comparar, reconocer. Nunca dibuja: lo que devuelve se comprueba (`cleanDibujos`): solo los del catálogo, sin repetir, cantidad de 1 a 10 y 1 en los que no son contables (`esContable`: objetos sueltos, no partes del cuerpo, lugares, personas ni gráficos).
- **El recuento lo hace el código.** La cantidad es un número, y la hoja repite el dibujo esas veces: un «cuenta las vacas» siempre tiene las vacas que dice. Un modelo de imagen no sabe contar (ver «Catálogo de ilustraciones»); por eso se usan dibujos sueltos repetidos y no escenas.
- La hoja (`fichaCuaderno.ts`, `exportFicha.ts`): en la cabecera, los tres primeros dibujos del hilo, con el 1.º, más grande, en medio; junto al título de cada bloque, un dibujo del hilo (`FichaActivity.dibujo`, uno por bloque, distinto, sin repetir el de la cabecera ni los del propio bloque; `asignarDibujosDeBloque`); en «Antes de empezar», el 2.º dibujo del hilo asoma en la esquina; y en los ejercicios, un solo dibujo a la derecha del enunciado (el texto y las líneas lo esquivan) o varios en una bandeja debajo, que se hace más pequeña con más dibujos (16, 12,5 y 10 mm). Con dibujos que contar y una respuesta corta, la respuesta es una caja y no tres líneas.
- Los dibujos se cargan como `data:` (`cargarIlustracionesFicha`) antes de maquetar, igual que los pictogramas, para que el PDF no dependa de nada externo. Mientras no están (la vista previa los pide al cambiar cuáles son), la cabecera es la de siempre por área y no salen imágenes rotas.
- Word: el título lleva los tres dibujos a la derecha, cada bloque su dibujo y cada ejercicio sus dibujos debajo del enunciado (Word no admite WebP: se pasan a PNG en un `<canvas>`; si no se puede, el documento sale sin ellos).
- Editor: «Hilo conductor» (selector con los 57 hilos y «Sin dibujos») cambia la cabecera y el dibujo de cada bloque, y los de los ejercicios se quedan; cada ejercicio muestra sus dibujos con su cantidad, un botón para quitarlos y el buscador del catálogo (primero los del hilo). Al pasar a «Cuaderno» una ficha sin hilo, se le pone el del tema. En el formulario de creación, «Dibujos de la ficha»: Automático (muestra el que detecta), Sin dibujos o un hilo.
- Rehacer un ejercicio, añadir uno y las versiones adaptadas (apoyo, ampliación, lectura fácil) conservan el hilo y siguen pidiendo dibujos de él; la versión visual lo deja (lleva pictogramas).

Lo que se ve queda como una hoja de ChatGPT con imagen, pero cada dibujo es del catálogo, nítido al imprimir, sin enviar nada a ningún sitio y con el recuento siempre bien. Lo que no hace: ilustrar con una escena a medida (fase 4).

## Lo que falta

1. Fase 2: más material dibujado por área (fracciones, ábaco, mapas, cuerpo humano…) y más cabeceras.
2. Hecho el 14-10-2026 (fase 3, ver «Hilo conductor»): las ilustraciones `img` van en la cabecera, en los bloques y dentro de los ejercicios. Queda ajustar con fichas reales: qué hilos hay que afinar o añadir, y cuántos dibujos por ficha es lo que le gusta al profesorado.
3. Fase 4 (por decidir): escenas de cuento con IA de imágenes pagada por el docente. Obligaría a actualizar la privacidad y las condiciones en los tres idiomas (regla 1 de `CLAUDE.md`).
4. Capturas de la web (`scripts/web/capturar.mjs`) con el diseño nuevo, cuando el dueño dé el visto bueno.
