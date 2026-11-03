/**
 * Con los dedos se amplía, pero no se aleja por debajo del tamaño normal.
 *
 * Historia: el 2-11-2026 el dueño pidió que la app no se acercara ni se alejara con los dedos, porque en el iPhone, al
 * alejar la vista con dos dedos, la app se quedaba en media pantalla con desplazamiento a los lados. El 3-11-2026, tras
 * la revisión de su abogado («intentaría que se pudiera ampliar la pantalla con los dedos; aumentar las letras un 25 %
 * no es exactamente lo mismo»), se vuelve a poder ampliar. Lo que causaba el problema era alejar, y eso sigue sin
 * poderse:
 *
 * - el `viewport` de `index.html` lleva `minimum-scale=1.0` y ya no `maximum-scale` ni `user-scalable=no`;
 * - `touch-action: manipulation` en `index.css` (desplazar y pellizcar sí; el zoom de dos toques, no);
 * - y esto, para Safari, que no siempre respeta la escala mínima: cancela el gesto de pellizco que aleja cuando la
 *   página ya está a su tamaño normal. Ampliar y volver al tamaño normal no se tocan.
 *
 * Nada ensancha la página (`overflow-x: clip`), así que a escala 1 no hay desplazamiento a los lados. El dibujo con el
 * dedo (pizarra, circuitos, «Tapa el nombre») lleva `touch-action: none` y no se amplía al dibujar.
 */
const GESTOS = ['gesturestart', 'gesturechange'] as const;

/** La escala de la vista: 1 a tamaño normal, más de 1 ampliada. */
const escala = (w: Window) => w.visualViewport?.scale ?? 1;

export function sinAlejarConLosDedos(doc: Document = document): () => void {
  const w = doc.defaultView ?? window;
  const cancelar = (e: Event) => {
    const s = (e as Event & { scale?: number }).scale;
    // `scale` del gesto: menos de 1 es juntar los dedos (alejar). Solo se cancela si ya no queda nada que alejar.
    if (typeof s === 'number' && s < 1 && escala(w) <= 1.01) e.preventDefault();
  };
  for (const g of GESTOS) doc.addEventListener(g, cancelar, { passive: false });
  return () => { for (const g of GESTOS) doc.removeEventListener(g, cancelar); };
}
