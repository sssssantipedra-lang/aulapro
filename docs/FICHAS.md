# Fichas de trabajo (Recursos)

Cómo se generan, cómo se ven y qué falta. Las decisiones llevan su fecha; si una cambia, se cambia aquí en el mismo cambio.

## Dónde está cada cosa

- `src/services/resources.ts`: lo que se le pide a la IA (esquema, prompts) y la limpieza de lo que devuelve.
- `src/services/exportFicha.ts`: la hoja (HTML para el PDF y la vista previa) y el Word.
- `src/services/fichaCuaderno.ts`: el diseño «Cuaderno» (cabeceras, recuadros, listas de cálculos, estilos).
- `src/lib/fichaThemes.ts`: los temas (aspecto de la ficha). `src/lib/fuenteCuaderno.ts`: la letra incrustada.
- `src/lib/ilustraciones.ts` y `ilustraciones.catalogo.json`: el catálogo de ilustraciones.
- `scripts/ilustraciones/`: la lista de ilustraciones y el generador con fal.ai.
- `src/pages/Resources.tsx` y `src/components/fichas/`: la pantalla, el editor y la vista previa.

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

La app la relaciona sola con lo que se trabaja: `elegirIlustraciones({ tema, area, nivel })` puntúa cada una (temas que empiezan una palabra del tema o del área, área deducida, palabras de la descripción, etapa) y devuelve las mejores; sin coincidencia, las generales. Para la IA hay una lista cerrada con identificador y descripción (`listaIlustracionesParaIA`), como con los pictogramas: la IA elige, nunca dibuja ni inventa. Los temas se buscan por comienzo de palabra: «arte» ya no encuentra «partes» (también se arregló en `pickMotifKey`).

Dos orígenes:

- `svg`: dibujadas en `fichaCuaderno.ts` (las cabeceras por área y las tres mascotas de los recuadros).
- `img`: generadas con fal.ai con `scripts/ilustraciones/generar.mjs` a partir de `lista.mjs` (67 temas comunes: animales, naturaleza, alimentación, cole, matemáticas, historia, cuerpo, ciencia, transporte, música, deporte y valores). Quedan en `public/ilustraciones/<id>.webp` (512 px, fondo transparente, dentro de la app y sin conexión) y en `ilustraciones.catalogo.json`, que el script reescribe: no se toca a mano.

Generar:

```
node scripts/ilustraciones/generar.mjs --dry                 # valida la lista y cuenta, sin red ni clave
FAL_KEY=… node scripts/ilustraciones/generar.mjs --solo ani-perro,mat-reloj,his-castillo   # unas pocas, para ver el estilo
FAL_KEY=… node scripts/ilustraciones/generar.mjs             # las que faltan
```

- Modelo barato: `fal-ai/flux/schnell` y quitafondos `fal-ai/imageutils/rembg`, dos llamadas por imagen. El script se niega a usar un modelo cuya licencia comercial no esté revisada (`MODELOS_PERMITIDOS`): FLUX.1 schnell es Apache-2.0; FLUX.1 dev no vale.
- Las que ya están no se regeneran (ni se pagan); el catálogo se guarda a cada imagen.
- La clave va solo en la variable `FAL_KEY` del entorno (nunca en un archivo del repositorio). En las sesiones en la nube, el host `fal.run` (y `fal.media` para descargar) hay que permitirlo en la red del entorno.
- Antes de publicar, revisar las imágenes a ojo: estilo común, sin texto ni deformaciones.
- Para añadir ilustraciones: una fila nueva en `lista.mjs` (con sus tres descripciones y sus temas) y volver a ejecutar.
- Estado: el script y la lista están hechos y probados en seco (`scripts/ilustraciones/generar.test.mjs`). Aún no se ha generado ninguna imagen (sin clave ni red a fal.ai en la sesión de la fase 1).

## Lo que falta

1. Fase 2: más material dibujado por área (fracciones, ábaco, mapas, cuerpo humano…) y más cabeceras.
2. Fase 3: usar las ilustraciones `img` dentro de los ejercicios (la IA elige de la lista cerrada, como con los pictogramas) y en las cabeceras con el mismo catálogo.
3. Fase 4 (por decidir): escenas de cuento con IA de imágenes pagada por el docente. Obligaría a actualizar la privacidad y las condiciones en los tres idiomas (regla 1 de `CLAUDE.md`).
4. Capturas de la web (`scripts/web/capturar.mjs`) con el diseño nuevo, cuando el dueño dé el visto bueno.
