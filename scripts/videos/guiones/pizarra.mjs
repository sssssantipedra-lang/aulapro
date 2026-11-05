/** Vídeo: pizarra y herramientas. */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { pestana, por } from './_comun.mjs';
export default {
  id: 'pizarra', titulo: 'Pizarra y herramientas',
  escenas: [
    { texto: 'Pizarra y herramientas es para proyectar en el aula: todo en una sola pantalla.',
      hacer: async p => { await menu(p, 'En clase', rapido); await pestana(p, 'Pizarra y herramientas', rapido); await esperar(p, 1800); } },
    { texto: 'Añade ventanas de herramientas: temporizador, ruleta con los nombres, semáforo, sonómetro y más.',
      hacer: async p => { await clicar(p, por(p, 'Añadir Ruleta'), rapido); await esperar(p, 700); await clicar(p, por(p, 'Añadir Semáforo'), rapido); await esperar(p, 1000); } },
    { texto: 'Dibuja sobre la pantalla y cambia el fondo.',
      hacer: async p => { await clicar(p, por(p, 'Dibujar sobre la pantalla'), rapido); await esperar(p, 700); await mover(p, por(p, 'Cambiar el fondo'), { pasos: 18, espera: 1200 }); } },
    { texto: 'Guarda la disposición para recuperarla otro día.',
      hacer: async p => { await mover(p, por(p, 'Guardar y recuperar'), { pasos: 16, espera: 1500 }); } },
  ],
};
