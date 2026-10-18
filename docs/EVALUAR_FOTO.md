# Evaluar por foto

Petición del dueño (18-10-2026): «incluir evaluación por foto para exámenes y trabajos, enfocado al profesorado de aula». Es la tercera tarjeta de la portada de Evaluar («Evaluar por foto», pestaña «Por foto»; `evalfoto`, `src/pages/EvalFoto.tsx`).

## Cómo funciona

1. El docente elige la clase, la asignatura (si hay varias), el alumno, si es un **examen** o un **trabajo**, los puntos en total (opcional), el nombre de la columna del cuaderno y su categoría (Exámenes, Trabajos…).
2. Añade las fotos (hasta 8, una por página; desde el móvil, con la cámara) y, si quiere, las soluciones o los criterios, escritos o en foto de la hoja de soluciones (hasta 3).
3. «Corregir con IA» (`corregirPorFoto` en `src/services/evaluarFoto.ts`) devuelve, pregunta por pregunta: lo que ha escrito el alumno (para que el docente compruebe la lectura), los puntos máximos y los propuestos, el estado (correcta, en parte, incorrecta, en blanco, no se lee), un comentario y si la IA duda («Revísala»); más un comentario para el alumno o su familia, lo que hace bien y lo que debe mejorar, y avisos (una foto borrosa, una página que falta). Un trabajo se corrige por apartados o, si no los tiene, por contenido, organización, expresión y presentación.
4. El docente cambia los puntos de cada pregunta; la **nota sobre 10 la recalcula el código** (`calcularNota` en `src/lib/evalFoto.ts`): ningún punto pasa del máximo de su pregunta y la IA no suma nunca. Lo que la IA devuelve se sanea (`normalizarCorreccion`): estados de la lista, máximos positivos, preguntas vacías fuera, y a la que no trae máximo se le reparte lo que falta hasta el total.
5. «Guardar la nota en el cuaderno» la pone en la columna con ese nombre y categoría (se crea si no existe; si ya existe por otro alumno del mismo examen, se usa) con `onAddGradeItem` y `onSetGrade`, como hacen las pruebas físicas de EF. «Siguiente alumno» pasa al siguiente de la lista (en orden de lista, ver `lib/alumnado.ts`) con las mismas opciones y criterios y las fotos vacías; los ya guardados salen con una ✓.

## Qué sale de la app

- Las fotos (hasta 2000 px por el lado mayor, `LADO_FOTO_EXAMEN`, porque la letra a mano pide más que reconocer un deporte; JPEG, sin metadatos) y los criterios escritos. **No el nombre del alumno**: se elige en la app y nunca entra en la petición, y a la IA se le pide que no lea ni repita ningún nombre de la hoja. La pantalla pide tapar el nombre en la foto.
- La privacidad lo dice en los tres idiomas. Nada se guarda fuera del equipo; AulaPro no guarda las fotos.
- Usa el modelo bueno (`thinkingLevel: 'high'`, hasta 16384 tokens de salida): el cupo diario del plan gratuito de Google (unas 20 peticiones al día en septiembre de 2026, ver `src/services/gemini.ts`) limita cuántos exámenes se pueden corregir de golpe; si se agota, la app pasa a los modelos ligeros, que leen peor la letra a mano.

## Lo que falta

- **Probar con una IA real y con exámenes reales** (solo se probó con respuestas simuladas): cuántos fallos de lectura hay con letra de Primaria, y si la nota se acerca a la del docente.
- No se guarda la corrección (preguntas, comentarios) más que la nota en el cuaderno: no sale en el Historial ni en los informes. Valorar guardarla como una evaluación del Historial (`Evaluation`, con `instrument` nuevo) para poder repasarla y enseñarla.
- Corregir de una vez la clase entera con una sola foto por alumno, o con el PDF escaneado de todos los exámenes, que el cupo de la IA gratuita hoy no permite.
- Evaluar con una rúbrica de la app (los criterios de una rúbrica como criterios de la corrección).
