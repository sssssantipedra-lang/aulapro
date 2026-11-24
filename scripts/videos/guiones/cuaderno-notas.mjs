/**
 * Vídeo: el cuaderno de notas (clase de ahora, evaluaciones, categorías, añadir una nota, notas por alumno,
 * menú de la actividad, pegar desde una hoja de cálculo y nota final de curso).
 * Puesto al día el 23-11-2026: se abre en la clase de ahora y en la evaluación de hoy (selector «1.ª · 2.ª · 3.ª ·
 * Curso»), la fecha de una nota decide su evaluación, Intro pasa al alumno siguiente, la sugerencia de los que
 * faltan, el menú del nombre de la actividad, pegar un bloque con vista previa y la nota final en «Curso».
 */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';

const modal = p => p.locator('.modal-overlay.open');
const COLUMNA = 'Examen tema 4';
const chipEv = (p, nombre) => p.locator('main .ev-sel-chips button', { hasText: nombre }).first();

/** La celda del alumno (fila) bajo la columna con ese título. */
async function celda(p, fila) {
  const cab = await p.locator('th', { hasText: COLUMNA }).first().boundingBox();
  const tds = p.locator('.gb-table tbody tr').nth(fila).locator('td');
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
    { texto: 'El cuaderno se abre en la clase que toca ahora, según tu horario, y en la evaluación en la que estás.',
      hacer: async p => {
        await menu(p, 'Cuaderno de Notas', rapido);
        await esperar(p, 600);
        await mover(p, p.locator('main .clase-ahora'), { pasos: 16, espera: 900 });
        await mover(p, chipEv(p, '1.ª'), { pasos: 16, espera: 700 });
        await mover(p, p.locator('main .ev-sel-fechas'), { pasos: 14, espera: 700 });
      } },
    { texto: 'La nota final se reparte por categorías: pruebas, tareas y trabajo diario.',
      hacer: async p => {
        for (const t of [/^Pruebas 40%/, /^Tareas 40%/]) await mover(p, p.getByText(t).first(), { pasos: 16, espera: 700 });
        await mover(p, p.getByText(/Trabajo diario y actitud/).first(), { pasos: 16, espera: 700 });
      } },
    { texto: 'Para añadir una nota, pulsa «Añadir nota», ponle nombre, elige la categoría y cuánto cuenta. Su fecha decide en qué evaluación entra.',
      hacer: async p => {
        await clicar(p, p.getByRole('button', { name: /Añadir nota/ }), rapido);
        await clicar(p, modal(p).locator('#notebook-f3'), rapido);
        await p.keyboard.type(COLUMNA, { delay: 45 });
        await mover(p, modal(p).locator('#notebook-f4'), { pasos: 12, espera: 500 });
        await mover(p, modal(p).locator('#notebook-f6'), { pasos: 12, espera: 600 });
        await mover(p, modal(p).locator('#notebook-f5'), { pasos: 12, espera: 400 });
        await mover(p, modal(p).locator('.nc-donde'), { pasos: 10, espera: 900 });
        await clicar(p, modal(p).getByRole('button', { name: 'Guardar' }), rapido);
        await esperar(p, 400);
      } },
    { texto: 'Escribe la nota de cada alumno y pulsa Intro para pasar al siguiente. La media se calcula sola.',
      hacer: async p => {
        await clicar(p, await celda(p, 0), rapido);
        for (const nota of ['7,5', '9', '6,5']) {
          await p.keyboard.type(nota, { delay: 90 });
          await esperar(p, 250);
          await p.keyboard.press('Enter');
          await esperar(p, 350);
        }
        await p.locator('main input.gb-cell:focus').evaluate(e => e.blur()).catch(() => {});
        await mover(p, p.locator('.gb-table thead th', { hasText: /^Media$/ }).first(), { pasos: 14, espera: 700 });
      } },
    { texto: 'Si falta alguien por calificar, la app te lo recuerda. Y al pulsar el nombre de una actividad, puedes calificarla, poner una nota a quien no tiene o editarla.',
      hacer: async p => {
        await mover(p, p.getByText(/faltan \d+ alumnos por calificar/).first(), { pasos: 14, espera: 1200 });
        await clicar(p, p.locator('.gb-table button.gb-item-hd', { hasText: COLUMNA }), rapido);
        for (const t of ['Calificar esta actividad', 'Poner una nota a quien no tiene', 'Editar o eliminar esta actividad']) {
          await mover(p, modal(p).getByText(t).first(), { pasos: 12, espera: 900 });
        }
      } },
    { texto: 'También puedes pegar un bloque de notas copiado de una hoja de cálculo. Antes de ponerlas, ves cómo quedan.',
      hacer: async p => {
        await p.keyboard.press('Escape');
        await esperar(p, 400);
        const c = await celda(p, 3);
        await clicar(p, c, rapido);
        // Lo que llegaría al pegar los nombres y las notas de tres alumnos copiados de una hoja de cálculo, en otro orden
        // que el de la lista y con el nombre en mayúsculas: cada nota va a su alumno por el nombre (24-11-2026)
        const nombres = await p.locator('.gb-table tbody tr').evaluateAll(trs => trs.slice(3, 6).map(tr => (tr.querySelector('th, td')?.textContent ?? '').match(/Alumno \d+/)?.[0] ?? ''));
        const hoja = ['Nombre\tNota', `${nombres[2].toUpperCase()}\t9`, `${nombres[0]}\t8`, `${nombres[1]}\t7,5`].join('\n');
        await c.locator('input').evaluate((el, texto) => {
          const dt = new DataTransfer();
          dt.setData('text/plain', texto);
          el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
        }, hoja);
        await esperar(p, 900);
        await mover(p, modal(p).locator('.pn-tabla td.pn-etiqueta').first(), { pasos: 12, espera: 900 });
        await clicar(p, modal(p).getByRole('button', { name: /^Poner \d+ notas?$/ }), rapido);
      } },
    { texto: 'En «Curso» ves la nota final de cada alumno, y eliges si es la evaluación continua o la media de las evaluaciones.',
      hacer: async p => {
        await clicar(p, chipEv(p, 'Curso'), rapido);
        await esperar(p, 500);
        await mover(p, p.locator('main .nc-regla').getByText('Evaluación continua').first(), { pasos: 14, espera: 900 });
        await mover(p, p.locator('main .nc-regla').getByText('Media de las evaluaciones').first(), { pasos: 14, espera: 900 });
        await mover(p, p.locator('main .nc-tabla th.nc-final').first(), { pasos: 14, espera: 700 });
      } },
    { texto: 'Y las evaluaciones que hagas con rúbricas, dianas o escalas de registro se guardan solas en el cuaderno.',
      hacer: async p => {
        await menu(p, 'Evaluar', rapido);
        for (const t of [/Evaluar por rúbricas/, /Evaluar por dianas/, /Escalas de registro/]) await mover(p, p.getByText(t).first(), { pasos: 16, espera: 800 });
        await menu(p, 'Cuaderno de Notas', rapido);
        await esperar(p, 600);
      } },
  ],
};
