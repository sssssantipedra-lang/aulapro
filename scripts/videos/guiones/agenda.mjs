/** Vídeo: Agenda (mensual, nuevo evento, horario semanal). */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { modal, pestana, por, cerrar } from './_comun.mjs';
export default {
  id: 'agenda', titulo: 'La agenda y el horario',
  escenas: [
    { texto: 'En Agenda ves el calendario del mes, con tus eventos y los días no lectivos de tu comunidad.',
      hacer: async p => { await menu(p, 'Agenda', rapido); await pestana(p, 'Mensual', rapido); await esperar(p, 1500); } },
    { texto: 'Pulsa «Nuevo evento», ponle nombre y elige si es un evento, una entrega o una reunión.',
      hacer: async p => {
        await clicar(p, por(p, 'Nuevo evento'), rapido);
        await clicar(p, modal(p).locator('input').first(), rapido);
        await p.keyboard.type('Examen de Matemáticas', { delay: 50 });
        await mover(p, modal(p).locator('select').first(), { pasos: 14, espera: 900 });
        await cerrar(p);
      } },
    { texto: 'En «Semanal» ves tu horario, y con «Horario» lo creas a mano o lo escaneas desde una foto.',
      hacer: async p => { await pestana(p, 'Semanal', rapido); await esperar(p, 1000); await mover(p, por(p, 'Horario'), { pasos: 20, espera: 1500 }); } },
  ],
};
