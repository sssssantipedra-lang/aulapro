/** Piezas comunes de los guiones de los vídeos de apartados (20 a 25 s). */
import { clicar, mover } from '../lib.mjs';
export const modal = p => p.locator('.modal-overlay.open');
/** Pestaña de un apartado (Evaluar, Documentos, En clase). */
export const pestana = (p, nombre, o) => clicar(p, p.locator('.hub-tab, main button').filter({ hasText: new RegExp(`^${nombre}$`) }), o);
/** Botón o tarjeta por su texto o su etiqueta. */
export const por = (p, texto) => p.locator(`button:has-text("${texto}"), [aria-label*="${texto}"], [title*="${texto}"]`).first();
/** Cierra la ventana emergente que haya abierta. */
export async function cerrar(p) {
  const m = modal(p);
  if (await m.count()) {
    const b = m.getByRole('button', { name: /^(Cancelar|Cerrar)$/ });
    if (await b.count()) await clicar(p, b.first(), { pasos: 10, espera: 100, despues: 300 }); else await p.keyboard.press('Escape');
  }
}
export { mover };
