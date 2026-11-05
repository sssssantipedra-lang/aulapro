/** Vídeo: situaciones de aprendizaje con IA. */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { modal, pestana, por, cerrar } from './_comun.mjs';
export default {
  id: 'situaciones-aprendizaje', titulo: 'Situaciones de aprendizaje',
  escenas: [
    { texto: 'Tú pones la idea y la IA redacta la situación entera: currículo, sesiones y evaluación.',
      hacer: async p => { await menu(p, 'Documentos', rapido); await pestana(p, 'Situaciones de aprendizaje', rapido); await esperar(p, 1500); } },
    { texto: 'Pulsa «Nueva situación de aprendizaje» y marca las clases para las que es.',
      hacer: async p => {
        await clicar(p, por(p, 'Nueva situación de aprendizaje'), rapido);
        await esperar(p, 600);
        await clicar(p, p.locator('main').getByRole('button', { name: '1º ESO A', exact: true }).first(), rapido);
        await clicar(p, p.locator('main').getByRole('button', { name: '2º ESO B', exact: true }).first(), rapido);
      } },
    { texto: 'Escribe la idea, ajusta las opciones si quieres y pulsa «Generar».',
      hacer: async p => {
        await clicar(p, p.locator('main textarea').first(), rapido);
        await p.keyboard.type('El ciclo del agua', { delay: 55 });
        await mover(p, por(p, 'Más opciones'), { pasos: 14, espera: 900 });
        await mover(p, por(p, 'Generar situación de aprendizaje'), { pasos: 14, espera: 900 });
      } },
    { texto: 'Para generarla necesitas la clave gratuita de Google.',
      hacer: async p => { await mover(p, por(p, 'Configurar la IA'), { pasos: 16, espera: 1500 }); } },
  ],
};
