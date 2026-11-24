/**
 * Vídeo: informes para las familias.
 * Puesto al día el 23-11-2026: el informe de seguimiento sale por reglas y sin IA, se revisa antes de guardarlo
 * y se crea para toda la clase de una vez, con «Deshacer». Ya no habla de «Generar los que faltan».
 */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { pestana, por } from './_comun.mjs';
export default {
  id: 'informes', titulo: 'Informes para las familias',
  escenas: [
    { texto: 'En Informes preparas el informe de seguimiento para las familias, y no necesitas la IA.',
      hacer: async p => { await menu(p, 'Documentos', rapido); await pestana(p, 'Informes', rapido); await esperar(p, 1200); } },
    { texto: 'Elige la evaluación y un alumno, y pulsa «Informe de seguimiento»: reúne sus notas, su asistencia y sus competencias.',
      hacer: async p => {
        await mover(p, p.locator('main .ev-sel-chips button.on'), rapido);
        await esperar(p, 500);
        await clicar(p, p.locator('main .split-list button').filter({ hasText: /^\s*\d*\s*Alumno 52$/ }), rapido);
        await clicar(p, p.locator('main .inf-vacio-btns button').filter({ hasText: 'Informe de seguimiento' }), rapido);
        await mover(p, p.locator('main .inf-hoja'), { pasos: 16, espera: 1200 });
      } },
    { texto: 'Te propone lo positivo y lo que hay que mejorar. Lo revisas, añades tus observaciones y lo guardas.',
      hacer: async p => {
        await mover(p, p.locator('main .inf-frases').first(), { pasos: 16, espera: 1300 });
        await mover(p, p.locator('main .inf-frases').nth(1), { pasos: 14, espera: 900 });
        await clicar(p, p.locator('#inf-observacion'), rapido);
        await p.keyboard.type('Trabaja con interés y ayuda a sus compañeros.', { delay: 30 });
        await clicar(p, p.locator('main .inf-botones button').filter({ hasText: 'Guardar informe' }), rapido);
      } },
    { texto: 'Con «Informes de seguimiento de la clase» haces los del resto del grupo de una vez, y puedes deshacerlo.',
      hacer: async p => {
        await clicar(p, por(p, 'Informes de seguimiento de la clase'), { ...rapido, despues: 900 });
        await mover(p, p.locator('.deshacer-btn'), { pasos: 16, espera: 1500 });
      } },
  ],
};
