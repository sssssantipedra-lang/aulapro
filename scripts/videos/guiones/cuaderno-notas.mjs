/** Vídeo: el cuaderno de notas (categorías, añadir una nota, notas por alumno y media). */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';

const modal = p => p.locator('.modal-overlay.open');
const COLUMNA = 'Examen tema 4';

/** La celda del alumno (fila) bajo la columna con ese título. */
async function celda(p, fila) {
  const cab = await p.locator('th', { hasText: COLUMNA }).first().boundingBox();
  const tds = p.locator('tbody tr').nth(fila).locator('td');
  for (let i = 0; i < await tds.count(); i++) {
    const b = await tds.nth(i).boundingBox();
    if (b && cab && Math.abs(b.x + b.width / 2 - (cab.x + cab.width / 2)) < 30) return tds.nth(i);
  }
  return tds.nth(3);
}

export default {
  id: 'cuaderno-notas',
  titulo: 'El cuaderno de notas',
  escenas: [
    { texto: 'En el cuaderno, la nota final se reparte por categorías: pruebas, tareas y trabajo diario.',
      hacer: async p => {
        await menu(p, 'Cuaderno de Notas', rapido);
        await esperar(p, 800);
        for (const t of [/^Pruebas 40%/, /^Tareas 40%/]) await mover(p, p.getByText(t).first(), { pasos: 18, espera: 800 });
        await mover(p, p.getByText(/Trabajo diario y actitud/).first(), { pasos: 18, espera: 800 });
      } },
    { texto: 'Para añadir una nota, pulsa «Añadir nota», ponle nombre, elige la categoría y cuánto cuenta, y guarda.',
      hacer: async p => {
        await clicar(p, p.getByRole('button', { name: /Añadir nota/ }), rapido);
        await clicar(p, modal(p).locator('input').first(), rapido);
        await p.keyboard.type(COLUMNA, { delay: 55 });
        await mover(p, modal(p).locator('select').first(), rapido);
        await mover(p, modal(p).locator('input').nth(2), { pasos: 14, espera: 700 });
        await clicar(p, modal(p).getByRole('button', { name: 'Guardar' }), rapido);
        await esperar(p, 500);
      } },
    { texto: 'Escribe la nota de cada alumno, y la media se calcula sola.',
      hacer: async p => {
        for (const [fila, nota] of [[0, '7,5'], [1, '9'], [2, '6,5']]) {
          const c = await celda(p, fila);
          await clicar(p, c, rapido);
          await p.keyboard.type(nota, { delay: 80 });
          await p.keyboard.press('Enter');
          await esperar(p, 400);
        }
      } },
    { texto: 'Así tienes la media del grupo y la nota final de cada alumno siempre al día.',
      hacer: async p => {
        await mover(p, p.locator('th', { hasText: 'MEDIA' }).first(), { pasos: 20, espera: 1200 });
        await mover(p, p.locator('tbody tr').first().locator('td').last(), { pasos: 14, espera: 1200 });
      } },
  ],
};
