/** Vídeo: sesiones. */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { modal, pestana, por, cerrar } from './_comun.mjs';
export default {
  id: 'sesiones', titulo: 'Las sesiones de cada clase',
  escenas: [
    { texto: 'En Sesiones tienes una tarjeta por clase, con todo lo que vas a trabajar.',
      hacer: async p => { await menu(p, 'Documentos', rapido); await pestana(p, 'Sesiones', rapido); await esperar(p, 1500); } },
    { texto: 'Pulsa «Nueva sesión» y escribe qué vas a hacer: objetivos, desarrollo y materiales.',
      hacer: async p => { await clicar(p, por(p, 'Nueva sesión'), rapido); await esperar(p, 1200); await mover(p, p.locator('main input, .modal-overlay.open input').first(), { pasos: 14, espera: 900 }); } },
    { texto: 'Puedes pegar imágenes, ordenar las sesiones, y agruparlas en una situación de aprendizaje.',
      hacer: async p => { await p.mouse.wheel(0, 400); await esperar(p, 1800); await p.mouse.wheel(0, -400); await esperar(p, 400); } },
  ],
};
