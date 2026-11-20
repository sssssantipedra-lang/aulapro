/**
 * Cerrar lo que esté abierto por encima de la pantalla (20-11-2026).
 *
 * Con una ventana emergente abierta, el botón de atrás del navegador (o el gesto de atrás del móvil) cierra la
 * ventana en vez de cambiar de pantalla, como espera cualquiera que use un móvil. Las pantallas no avisan de que
 * abren una ventana, así que se miran en el documento: todas siguen unas pocas formas.
 *
 *   - `.modal-overlay.open`: las ventanas de siempre; se cierran tocando fuera (todas lo admiten).
 *   - `.bq-fondo`: el buscador general; igual.
 *   - `.sb-backdrop`: el menú abierto por encima en el móvil y la tableta; igual.
 *   - Un diálogo a pantalla completa (`role="dialog"` con `aria-modal`): la vista previa de un documento, las
 *     tarjetas interactivas, un reto proyectado, el cronómetro de circuitos… Se cierran con Escape.
 *
 * Se cierra solo lo de más arriba (lo último del documento): una vista previa abierta desde una ventana deja la
 * ventana abierta, y el siguiente «atrás» la cierra.
 */

const CANDIDATOS = '.modal-overlay.open, .bq-fondo, .sb-backdrop, [role="dialog"][aria-modal="true"]';

/** Lo que hay abierto por encima de la pantalla, lo de más arriba (o `null`). */
export function loAbierto(doc: Document): Element | null {
  const todos = [...doc.querySelectorAll(CANDIDATOS)].filter(el => {
    // Una ventana cerrada sigue montada, con su diálogo dentro: no cuenta
    const ventana = el.closest('.modal-overlay');
    return !ventana || ventana.classList.contains('open');
  });
  const ultimo = todos[todos.length - 1];
  if (!ultimo) return null;
  // El diálogo de una ventana de siempre es la ventana: se cierra tocando su fondo
  const fondo = ultimo.parentElement;
  if (fondo && ultimo.matches('[role="dialog"]') && fondo.matches('.modal-overlay.open, .bq-fondo')) return fondo;
  return ultimo;
}

/**
 * Cierra lo de más arriba y lo devuelve, o `null` si no hay nada abierto. `yaIntentado` es lo que se intentó cerrar
 * la vez anterior sin que el docente haya tocado nada desde entonces: si sigue ahí es que no se deja cerrar así
 * (una ventana a medio guardar, un diálogo que no atiende a Escape), y no se insiste, para que «atrás» no se quede
 * sin hacer nada para siempre.
 */
export function cerrarLoAbierto(doc: Document, yaIntentado: Element | null = null): Element | null {
  const el = loAbierto(doc);
  if (!el || el === yaIntentado) return null;
  if (el.matches('.modal-overlay, .bq-fondo, .sb-backdrop')) (el as HTMLElement).click();
  else el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  return el;
}
