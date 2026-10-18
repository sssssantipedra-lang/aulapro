# Pizarra y herramientas (Aula Live)

Petición del dueño (18-10-2026): que el apartado «Aula Live» (en la app, En clase › «Pizarra y herramientas»,
`src/pages/SecClassroom.tsx`) se parezca a Classroomscreen (classroomscreen.com/app). No se copia código ni imágenes de
esa web: se parte de lo que hace una pizarra de aula de ese tipo y se escribe aquí desde cero. **No se pudo abrir
classroomscreen.com desde la sesión que lo hizo** (el entorno bloquea esa dirección), así que el parecido sale de
la interfaz pública que se conocía, no de una comparación pantalla a pantalla.

## Lo que hay

- **Herramientas de antes:** temporizador, ruleta (por clase), calculadora, sonómetro, contenido incrustado y «Reto».
- **Herramientas nuevas** (`src/components/live/PizarraWidgets.tsx`): reloj y fecha, cronómetro con vueltas, semáforo,
  símbolos de trabajo (silencio, susurro, voz normal, individual, parejas, grupos, mano levantada, escucha), dados
  (1 a 6), grupos (a partir de la clase elegida, por tamaño o por número), marcador por equipos, plan del día con
  casillas, nota y código QR.
- **Fondos** (`FONDOS` en `src/lib/pizarraAula.ts`): 4 claros y 4 oscuros. El tono decide los colores del lápiz, y lo ya
  dibujado se recolorea al cambiar de tono.
- **Escenas:** una disposición con nombre (qué ventanas, dónde y qué fondo), hasta 12. La última disposición se
  recupera al volver a entrar. Lo que se escribe dentro de nota, marcador, plan del día, símbolos y QR también se
  recuerda. Todo es del dispositivo (`localStorage`, claves `aulapro_pizarra_*`): no sale de él ni va en las copias.
- **Ventanas:** cada una se mueve, se redimensiona y pasa delante al tocarla. Se vuelven a meter en el área visible si
  cambia el tamaño de la pantalla (`ajustarRect`).
- **Pantalla completa** (botón de la barra): solo si el sistema lo permite; en el WebView de Android puede no hacerlo.

## Decisiones

- Las ventanas se pintan siempre en el mismo orden del DOM y el apilado va por `z-index`: reordenar nodos recargaría el
  contenido incrustado (un iframe).
- Cada herramienta es de una sola instancia. Classroomscreen permite varias del mismo tipo (dos temporizadores): falta.
- Lo que depende del azar (dados, grupos) recibe el generador como parámetro para poder probarlo.

## Lo que falta

- Varias instancias de una misma herramienta.
- Webcam, tiempo meteorológico, imagen propia como fondo, encuesta en pantalla (existe «Actividades con móviles»).
- Comprobar en un móvil Android real (barra inferior con scroll, pantalla completa) y en un proyector.
- Volver a ejecutar `scripts/web/capturar.mjs` para que la web enseñe la pizarra nueva (la captura de la portada y de
  la demo son de antes; el script sigue funcionando con la barra y el dock nuevos).
