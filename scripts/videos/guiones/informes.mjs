/** Vídeo: informes para las familias. */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { pestana, por } from './_comun.mjs';
export default {
  id: 'informes', titulo: 'Informes para las familias',
  escenas: [
    { texto: 'En Informes, la IA redacta el informe de cada alumno con tus evaluaciones.',
      hacer: async p => { await menu(p, 'Documentos', rapido); await pestana(p, 'Informes', rapido); await esperar(p, 1500); } },
    { texto: 'Elige la clase y la evaluación, y pulsa un alumno para revisar su texto.',
      hacer: async p => {
        const sel = p.locator('main select');
        await mover(p, sel.first(), rapido); await sel.first().selectOption({ index: 1 }); await esperar(p, 500);
        await mover(p, sel.nth(1), rapido); await esperar(p, 400);
        await clicar(p, p.locator('main button').filter({ hasText: /Alumno/ }).nth(1), rapido); await esperar(p, 900);
      } },
    { texto: '«Generar los que faltan» los redacta todos, y «Todos en PDF» los descarga.',
      hacer: async p => { await mover(p, por(p, 'Generar los que faltan'), { pasos: 18, espera: 1100 }); await mover(p, por(p, 'Todos en PDF'), { pasos: 14, espera: 1100 }); } },
    { texto: 'La IA solo propone: el texto final lo revisas y decides tú.',
      hacer: async p => { await mover(p, por(p, 'Vista previa'), { pasos: 16, espera: 1500 }); } },
  ],
};
