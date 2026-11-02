/**
 * La app no se acerca ni se aleja con los dedos (petición del dueño, 2-11-2026): en el iPhone, alejar la vista con dos
 * dedos dejaba la app en media pantalla, con desplazamiento a los lados. Funciona como una app del teléfono.
 *
 * Son tres capas, porque Safari no siempre hace caso a la primera: el `viewport` de `index.html` (escala fija en 1),
 * `touch-action: pan-x pan-y` en `index.css` (desplazar sí, ampliar no) y esto, que cancela los gestos de pellizco
 * de Safari. Para leer mejor está «Tamaño de las letras» (Configuración › Apariencia, `lib/tamanoLetra.ts`).
 * El dibujo con el dedo (pizarra, circuitos, «Tapa el nombre») usa eventos de puntero y no se ve afectado.
 */
const GESTOS = ['gesturestart', 'gesturechange', 'gestureend'] as const;

const cancelar = (e: Event) => e.preventDefault();

export function sinZoomConLosDedos(doc: Document = document): () => void {
  for (const g of GESTOS) doc.addEventListener(g, cancelar, { passive: false });
  return () => { for (const g of GESTOS) doc.removeEventListener(g, cancelar); };
}
