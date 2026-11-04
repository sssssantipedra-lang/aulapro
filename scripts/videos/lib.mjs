/** Piezas comunes de los guiones de vídeo (ver grabar.mjs). */
export const esperar = (p, ms) => p.waitForTimeout(ms);

/** Mueve el cursor del vídeo hasta un elemento, sin pulsar. */
export async function mover(p, loc, { pasos = 28, espera = 350 } = {}) {
  const el = loc.first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const b = await el.boundingBox();
  if (!b) return;
  // El subtítulo se pasa arriba cuando lo que se va a pulsar queda abajo, para no tapar botones
  await p.evaluate(y => {
    const s = document.getElementById('v-sub');
    const abajo = y / (window.__Z || 1) > 500;
    if (s) { s.style.top = abajo ? '14px' : 'auto'; s.style.bottom = abajo ? 'auto' : '26px'; }
  }, b.y + b.height / 2);
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: pasos });
  await p.waitForTimeout(espera);
}

/** Mueve el cursor y pulsa. */
export async function clicar(p, loc, { pasos = 28, espera = 350, despues = 700 } = {}) {
  await mover(p, loc, { pasos, espera });
  await loc.first().click();
  await p.waitForTimeout(despues);
}

/** Más ágil: para escenas con mucho que hacer en poco tiempo. */
export const rapido = { pasos: 12, espera: 120, despues: 350 };

/** Entrada del menú lateral. */
export const menu = (p, nombre, o) => clicar(p, p.locator('.sidebar .nav-item', { hasText: new RegExp(`^${nombre}$`) }), o);

/** Deja en el portapapeles una clave de ejemplo (nunca una real). */
export const clave = p => p.evaluate(k => navigator.clipboard.writeText(k), 'AIza' + 'Sy' + 'x'.repeat(33));
