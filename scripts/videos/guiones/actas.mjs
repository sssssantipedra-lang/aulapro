/**
 * Vídeo: actas de calificaciones.
 * Puesto al día el 23-11-2026: el selector de evaluación común («1.ª · 2.ª · 3.ª · Curso», antes un desplegable),
 * el acta cuenta solo las notas de esas fechas y «Curso» usa la nota final elegida en el cuaderno; la escala de
 * las competencias clave y la segunda página, y la vista previa, el PDF y el CSV en una sola escena.
 */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { pestana, por, cerrar } from './_comun.mjs';

const chipEv = (p, nombre) => p.locator('main .ev-sel-chips button', { hasText: nombre }).first();

export default {
  id: 'actas', titulo: 'Actas de calificaciones',
  escenas: [
    { texto: 'En Actas tienes el acta de cada clase y evaluación, lista para firmar. Se abre en la clase que toca ahora.',
      hacer: async p => {
        await menu(p, 'Documentos', rapido); await pestana(p, 'Actas', rapido); await esperar(p, 900);
        await mover(p, p.locator('main .clase-ahora'), { pasos: 14, espera: 900 });
      } },
    { texto: 'Elige la evaluación: el acta cuenta solo las notas de sus fechas. En «Curso», usa la nota final que elegiste en el cuaderno.',
      hacer: async p => {
        await mover(p, chipEv(p, '1.ª'), rapido);
        await mover(p, p.locator('main .ev-sel-fechas'), { pasos: 12, espera: 1200 });
        await clicar(p, chipEv(p, 'Curso'), rapido);
        await esperar(p, 400);
        await mover(p, p.getByText(/^Nota final: /).first(), { pasos: 14, espera: 1200 });
      } },
    { texto: 'Elige la escala de las competencias clave, de uno a cuatro o sobre diez. La segunda página recoge las competencias.',
      hacer: async p => {
        const sel = p.locator('main select.tb-select').last();
        await mover(p, sel, rapido); await sel.selectOption('nota'); await esperar(p, 500);
        await mover(p, p.locator('main .acta-comp-title').first(), { pasos: 16, espera: 1500 });
      } },
    { texto: 'Mira la vista previa tal como saldrá y guárdala en PDF. También puedes sacar los datos en CSV.',
      hacer: async p => {
        await p.evaluate(() => scrollTo({ top: 0 }));
        await clicar(p, por(p, 'Vista previa'), rapido); await esperar(p, 2000); await cerrar(p);
        await mover(p, por(p, 'Imprimir o guardar en PDF'), { pasos: 14, espera: 700 });
        await mover(p, por(p, 'Datos en CSV'), { pasos: 14, espera: 900 });
      } },
  ],
};
