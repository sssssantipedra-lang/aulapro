/**
 * Vídeo: reuniones y formaciones.
 * Puesto al día el 23-11-2026: la última frase decía que el certificado queda guardado, y la app no guarda certificados;
 * ahora dice lo que hay (las horas certificadas y la memoria que redacta la IA) y el cursor va a esas horas.
 */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { modal, por, cerrar } from './_comun.mjs';
export default {
  id: 'reuniones-formaciones', titulo: 'Reuniones y formaciones',
  escenas: [
    { texto: 'En Reuniones preparas el acta de cada reunión: pulsa «Nueva reunión» y anota el asunto.',
      hacer: async p => {
        await menu(p, 'Reuniones', rapido); await esperar(p, 700);
        await clicar(p, por(p, 'Nueva reunión'), rapido);
        await clicar(p, modal(p).locator('input').first(), rapido);
        await p.keyboard.type('Claustro de evaluación', { delay: 50 });
      } },
    { texto: 'Cuanto más apuntes, mejor queda el documento: la IA no añade nada que no hayas escrito tú.',
      hacer: async p => { await clicar(p, modal(p).locator('textarea').first(), rapido); await p.keyboard.type('Se revisan las notas de la primera evaluación.', { delay: 40 }); await esperar(p, 800); } },
    { texto: 'En Formaciones haces lo mismo con tus cursos: anotas las horas certificadas y la IA redacta la memoria.',
      hacer: async p => {
        await cerrar(p); await menu(p, 'Formaciones', rapido); await esperar(p, 700);
        await clicar(p, por(p, 'Nueva formación'), rapido);
        await clicar(p, modal(p).locator('#worksessions-f5'), rapido); await p.keyboard.type('20', { delay: 80 });
        await mover(p, modal(p).locator('#worksessions-f9'), { pasos: 14, espera: 1500 });
      } },
  ],
};
