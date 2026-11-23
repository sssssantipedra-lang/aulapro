/**
 * Vídeo: pasar lista y anotar la actitud en clase.
 * Puesto al día el 23-11-2026: Asistencia y Anotar actitud se abren en la clase que toca ahora según el horario
 * (el selector la marca con «Ahora»); se dice y se señala.
 */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';

export default {
  id: 'asistencia-actitud',
  titulo: 'Asistencia y actitud',
  escenas: [
    { texto: 'Asistencia se abre en la clase que toca ahora, según tu horario. Para pasar lista, pulsa «Todos presentes».',
      hacer: async p => {
        await menu(p, 'Asistencia', rapido);
        await mover(p, p.locator('main .clase-ahora'), { pasos: 14, espera: 1300 });
        await clicar(p, p.getByRole('button', { name: /Todos presentes/ }), rapido);
      } },
    { texto: 'Después marca solo las excepciones: falta, retraso o justificada.',
      hacer: async p => {
        await clicar(p, p.getByRole('button', { name: 'Falta' }).nth(1), rapido);
        await clicar(p, p.getByRole('button', { name: 'Retraso' }).nth(3), rapido);
        await clicar(p, p.getByRole('button', { name: 'Justificada' }).nth(4), rapido);
      } },
    { texto: 'Para anotar la actitud, ve a «En clase», «Anotar actitud». También se abre en la clase de ahora: un toque por anotación.',
      hacer: async p => {
        await menu(p, 'En clase', rapido);
        await clicar(p, p.locator('.hub-tab', { hasText: /^Anotar actitud$/ }), rapido);
        await esperar(p, 300);
        await mover(p, p.locator('main .clase-ahora'), { pasos: 12, espera: 600 });
        await clicar(p, p.getByRole('button', { name: /Buen comportamiento/ }).nth(0), rapido);
        await clicar(p, p.getByRole('button', { name: /Participa/ }).nth(2), rapido);
      } },
    { texto: 'Cada anotación suma o resta, y cuenta en el trabajo diario del cuaderno.',
      hacer: async p => {
        await clicar(p, p.getByRole('button', { name: /Sin tarea/ }).nth(3), rapido);
        await mover(p, p.getByText(/Pesa un/).first(), { pasos: 18, espera: 1500 });
      } },
  ],
};
