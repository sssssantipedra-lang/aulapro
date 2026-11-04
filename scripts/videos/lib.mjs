/** Piezas comunes de los guiones de vídeo (ver grabar.mjs). */
export const esperar = (p, ms) => p.waitForTimeout(ms);

/** Mueve el cursor del vídeo hasta un elemento, sin pulsar. */
export async function mover(p, loc) {
  const el = loc.first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const b = await el.boundingBox();
  if (!b) return;
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 28 });
  await p.waitForTimeout(350);
}

/** Mueve el cursor y pulsa. */
export async function clicar(p, loc) {
  await mover(p, loc);
  await loc.first().click();
  await p.waitForTimeout(700);
}

/** Entrada del menú lateral. */
export const menu = (p, nombre) => clicar(p, p.locator('.sidebar .nav-item', { hasText: new RegExp(`^${nombre}$`) }));

/** Deja en el portapapeles una clave de ejemplo (nunca una real). */
export const clave = p => p.evaluate(k => navigator.clipboard.writeText(k), 'AIza' + 'Sy' + 'x'.repeat(33));
