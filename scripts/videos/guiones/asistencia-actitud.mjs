/** Vídeo: pasar lista y anotar la actitud en clase. */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';

export default {
  id: 'asistencia-actitud',
  titulo: 'Asistencia y actitud',
  escenas: [
    { texto: 'Para pasar lista, abre Asistencia y pulsa «Todos presentes».',
      hacer: async p => {
        await menu(p, 'Asistencia', rapido);
        await clicar(p, p.getByRole('button', { name: /Todos presentes/ }), rapido);
      } },
    { texto: 'Después marca solo las excepciones: falta, retraso o justificada.',
      hacer: async p => {
        const fila = n => p.locator('main').locator('div', { hasText: new RegExp(`^${n}\\b`) });
        await clicar(p, p.getByRole('button', { name: 'Falta' }).nth(1), rapido);
        await clicar(p, p.getByRole('button', { name: 'Retraso' }).nth(3), rapido);
        await clicar(p, p.getByRole('button', { name: 'Justificada' }).nth(4), rapido);
      } },
    { texto: 'Para anotar la actitud, ve a «En clase», «Anotar actitud»: un toque por anotación.',
      hacer: async p => {
        await menu(p, 'En clase', rapido);
        await clicar(p, p.locator('.hub-tab', { hasText: /^Anotar actitud$/ }), rapido);
        await esperar(p, 500);
        await clicar(p, p.getByRole('button', { name: /Buen comportamiento/ }).nth(0), rapido);
        await clicar(p, p.getByRole('button', { name: /Participa/ }).nth(1), rapido);
      } },
    { texto: 'Cada anotación suma o resta, y cuenta en el trabajo diario del cuaderno.',
      hacer: async p => {
        await clicar(p, p.getByRole('button', { name: /Sin tarea/ }).nth(3), rapido);
        await mover(p, p.getByText(/Pesa un/).first(), { pasos: 18, espera: 1500 });
      } },
  ],
};
