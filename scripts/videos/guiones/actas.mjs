/** Vídeo: actas de calificaciones. */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { modal, pestana, por, cerrar } from './_comun.mjs';
export default {
  id: 'actas', titulo: 'Actas de calificaciones',
  escenas: [
    { texto: 'En Actas tienes el acta de cada clase y evaluación, lista para firmar.',
      hacer: async p => { await menu(p, 'Documentos', rapido); await pestana(p, 'Actas', rapido); await esperar(p, 1500); } },
    { texto: 'Elige la clase, la evaluación y la escala: de uno a cuatro, o sobre diez.',
      hacer: async p => {
        const sel = p.locator('main select');
        await mover(p, sel.first(), rapido); await sel.first().selectOption({ index: 2 }); await esperar(p, 600);
        await mover(p, sel.nth(1), rapido); await mover(p, sel.nth(2), { pasos: 14, espera: 900 });
      } },
    { texto: 'Mira la vista previa tal como saldrá, y guárdala en PDF.',
      hacer: async p => { await clicar(p, por(p, 'Vista previa'), rapido); await esperar(p, 2500); await cerrar(p); await mover(p, por(p, 'Imprimir o guardar en PDF'), { pasos: 16, espera: 1000 }); } },
    { texto: 'También puedes sacar los datos en CSV.',
      hacer: async p => { await mover(p, por(p, 'Datos en CSV'), { pasos: 16, espera: 1500 }); } },
  ],
};
