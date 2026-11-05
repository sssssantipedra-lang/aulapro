/** Vídeo: evaluar con dianas y con escalas de registro. */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { modal, pestana, por, cerrar } from './_comun.mjs';
export default {
  id: 'dianas-escalas', titulo: 'Dianas y escalas de registro',
  escenas: [
    { texto: 'Las dianas evalúan de un vistazo: cada ítem es un sector y cada nivel, un anillo.',
      hacer: async p => { await menu(p, 'Evaluar', rapido); await pestana(p, 'Dianas', rapido); await esperar(p, 1800); } },
    { texto: 'Pulsa «Nueva diana», describe la actividad y la IA propone los ítems.',
      hacer: async p => {
        await clicar(p, por(p, 'Nueva diana'), rapido);
        await clicar(p, modal(p).locator('textarea').first(), rapido);
        await p.keyboard.type('Trabajo cooperativo en el proyecto', { delay: 45 });
        await mover(p, modal(p).getByRole('button', { name: /Generar diana/ }), { pasos: 14, espera: 900 });
        await cerrar(p);
      } },
    { texto: 'Las escalas de registro son más simples: un pulgar arriba o abajo por alumno.',
      hacer: async p => { await pestana(p, 'Escalas de registro', rapido); await esperar(p, 800); await clicar(p, por(p, 'Nueva escala'), rapido); await esperar(p, 1800); await cerrar(p); } },
    { texto: 'La nota de todas ellas llega sola al cuaderno.',
      hacer: async p => { await menu(p, 'Cuaderno de Notas', rapido); await esperar(p, 1500); } },
  ],
};
