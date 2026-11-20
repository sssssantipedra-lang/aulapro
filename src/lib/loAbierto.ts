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
 *   - Un diálogo a pantalla completa (`role="dialog"` con `aria-modal`): las tarjetas interactivas y el Memory, un
 *     reto proyectado y su selector, el cronómetro de circuitos, la agenda visual que se enseña al alumno… Todos
 *     llevan su botón de «Cerrar» o de «Salir», y se pulsa ese: no todos atienden a Escape (el Memory, la agenda
 *     visual y el selector de reto no lo hacen, y los que se ponen a pantalla completa lo ignoran mientras lo
 *     están). Si un diálogo no tuviera ese botón, Escape.
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

/** El botón con el que se cierra un diálogo: el primero que se llama como alguno de `nombres`. */
function botonDeCerrar(dialogo: Element, nombres: readonly string[]): HTMLButtonElement | null {
  if (nombres.length === 0) return null;
  for (const b of dialogo.querySelectorAll('button')) {
    const nombre = (b.getAttribute('aria-label') ?? b.textContent ?? '').trim();
    if (!b.disabled && nombres.includes(nombre)) return b;
  }
  return null;
}

/**
 * Cierra lo de más arriba y lo devuelve, o `null` si no hay nada abierto. `yaIntentado` es lo que se intentó cerrar
 * la vez anterior sin que el docente haya tocado nada desde entonces: si sigue ahí es que no se deja cerrar así
 * (una ventana a medio guardar), y no se insiste, para que «atrás» no se quede sin hacer nada para siempre.
 * `nombresDeCerrar` es cómo se llama el botón de cerrar de un diálogo a pantalla completa en el idioma de la app
 * («Cerrar», «Salir»).
 */
export function cerrarLoAbierto(doc: Document, yaIntentado: Element | null = null, nombresDeCerrar: readonly string[] = []): Element | null {
  const el = loAbierto(doc);
  if (!el || el === yaIntentado) return null;
  if (el.matches('.modal-overlay, .bq-fondo, .sb-backdrop')) (el as HTMLElement).click();
  else {
    const boton = botonDeCerrar(el, nombresDeCerrar);
    if (boton) boton.click();
    else el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  }
  return el;
}
