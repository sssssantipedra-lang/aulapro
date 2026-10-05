# Educación Física

Para el profesorado de Educación Física, con o sin tutoría. Decisiones del dueño del 5-10-2026. Si una cambia, cámbiala aquí en el mismo cambio.

## Perfil

- Al crear el perfil, «Tipo de docente» → «Educación Física». Se cambia en Configuración → Perfil y al cambiar no se borra nada.
- Casilla «También soy tutor o tutora» (el 2 en 1). Su grupo es la clase en la que marque «Soy el tutor o la tutora de este grupo» en Mis Clases.
- En los datos: `tipoDocente: 'ef'` y `tutor` en el perfil; se leen con `tipoDePerfil` (`src/lib/tipoDocente.ts`).

## Menú e Inicio

- El menú de aula entero (clases, cuaderno, asistencia, evaluar con rúbricas y dianas, documentos, en clase) y, después del Inicio, el apartado «Educación Física» (`NAV_EF` en `src/lib/navigation.ts`).
- Inicio sin tutoría: el de siempre, adaptado a EF, con «Observar en la pista» en la clase de ahora y la tarjeta «Exentos y lesiones».
- Inicio con tutoría: el de tutoría tal cual.

## En la pista

- Observación rápida desde el móvil: se elige un aspecto y se toca a cada alumno; otro toque lo quita.
- Aspectos: participa, se esfuerza, no participa, juego limpio, mala actitud, sin equipación, sin aseo.
- Son anotaciones del cuaderno (`EF_MARK_TYPES` en `src/services/classMarks.ts`) y cuentan en el bloque «Trabajo diario y actitud». En EF sus partes se llaman «Vestimenta e higiene», «Actitud y juego limpio» y «Participación y esfuerzo».
- La asignatura de EF de una clase se reconoce por el nombre (`esAsignaturaEF`).

## Exentos y lesiones

- Qué no puede hacer (lista y texto libre), desde y hasta cuándo, qué hace mientras tanto, justificante y motivo.
- El motivo es un dato de salud: se queda en el equipo y nunca se envía a la IA.
- A la IA solo le llega la limitación, sin nombre, para que proponga medidas de inclusión basadas en el DUA-A.
- Salen en la pista, en el Inicio y al hacer equipos. Los exentos participan en los equipos con su adaptación.

## Pruebas físicas

- De partida:
  - Resistencia: Course Navette y test de Cooper.
  - Velocidad y agilidad: 30 m y 4 × 10 m.
  - Fuerza: salto horizontal, lanzamiento de balón medicinal y dinamometría manual.
  - Flexibilidad: sit and reach.
- El docente puede ocultar estas pruebas y añadir las suyas.
- Por defecto, marcas y evolución de cada alumno respecto a sí mismo.
- Baremos opcionales, de dos fuentes:
  - Los del docente, por curso y, si quiere, por sexo.
  - Uno publicado, solo si su licencia permite incluirlo en una app de pago.

## Equipos y circuitos

- Equipos equilibrados:
  - Por el nivel de 1 a 3 que marca el docente.
  - Mezclando chicos y chicas.
  - Separando las parejas que no conviene juntar.
- Cronómetro de estaciones, series y descansos, a pantalla completa y con aviso sonoro.

## Actividades y sesiones

- Banco de actividades:
  - Tipos: juegos y deportes motrices, días de lluvia, medio natural, calentamiento y vuelta a la calma.
  - Origen: un banco inicial escrito por nosotros, la IA y las del docente.
- Sesiones con IA: calentamiento, parte principal y vuelta a la calma, según el curso, el material y la instalación, con medidas DUA-A para las limitaciones del día y un plan B.
- Autores de referencia:
  - Parlebas y Lavega (juegos y praxiología motriz).
  - Blázquez, Devís y Peiró (iniciación deportiva).
  - Fernández-Río (aprendizaje cooperativo).
  - López-Pastor (evaluación formativa).
  - Granero-Gallegos y Baena-Extremera (medio natural).

## Material e instalaciones

- Inventario del material (cantidad, estado y ubicación).
- Instalaciones, con si son cubiertas, para el plan B por lluvia.

## Datos

- Todo va en `ef` del perfil (`src/types/ef.ts`, `src/lib/ef.ts`).
- Al vaciar el curso se queda el material del docente (pruebas, baremos, actividades, sesiones, material, instalaciones y circuitos) y se va lo del alumnado (exentos, niveles, marcas…).
- Datos de ejemplo: `src/lib/demoEF.ts`.
