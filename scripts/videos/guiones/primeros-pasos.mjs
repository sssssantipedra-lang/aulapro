/** Vídeo: empezar con AulaPro (perfil, primera clase y alumnado). Sin datos de ejemplo: se parte de la bienvenida. */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';

const modal = p => p.locator('.modal-overlay.open');

export default {
  id: 'primeros-pasos',
  titulo: 'Empezar con AulaPro',
  sinDemo: true,
  escenas: [
    { texto: 'Para empezar, escribe tu nombre, elige tu comunidad y pulsa «Empezar a usar AulaPro».',
      hacer: async p => {
        await esperar(p, 900);
        await clicar(p, p.locator('input').first(), { pasos: 16, espera: 200, despues: 200 });
        await p.keyboard.type('Profesor', { delay: 90 });
        const sel = p.locator('select').last();
        await mover(p, sel, { pasos: 14, espera: 300 });
        await sel.selectOption({ label: 'Comunitat Valenciana' });
        await esperar(p, 700);
        await clicar(p, p.getByText('Empezar a usar AulaPro'), { pasos: 14, espera: 300, despues: 2000 });
      } },
    { texto: 'En Mis clases, pulsa «Nueva clase», ponle nombre, elige etapa, curso y asignatura, y créala.',
      hacer: async p => {
        await menu(p, 'Mis Clases', rapido);
        await clicar(p, p.getByRole('button', { name: /Nueva clase/ }).first(), rapido);
        await clicar(p, modal(p).locator('input').first(), rapido);
        await p.keyboard.type('4º A', { delay: 70 });
        const sel = modal(p).locator('select');
        await mover(p, sel.first(), rapido); await sel.first().selectOption({ label: 'Primaria' }); await esperar(p, 300);
        await mover(p, sel.nth(1), rapido); await sel.nth(1).selectOption({ label: '4º de Primaria' }); await esperar(p, 300);
        await clicar(p, modal(p).getByRole('button', { name: 'Matemáticas', exact: true }), rapido);
        await clicar(p, modal(p).getByRole('button', { name: 'Crear clase' }), rapido);
        await esperar(p, 500);
      } },
    { texto: 'Añade a tu alumnado con «Nuevo alumno», o importa toda la lista con un archivo CSV.',
      hacer: async p => {
        await clicar(p, p.getByRole('button', { name: /Nuevo alumno/ }), rapido);
        await clicar(p, modal(p).locator('input').first(), rapido);
        await p.keyboard.type('Alumno 1', { delay: 70 });
        await clicar(p, modal(p).getByRole('button', { name: 'Guardar' }), rapido);
        await esperar(p, 400);
        await mover(p, p.getByRole('button', { name: /Importar CSV/ }), { pasos: 18, espera: 900 });
      } },
    { texto: 'Y ya está: desde el menú tienes el cuaderno, la asistencia y la evaluación de tu clase.',
      hacer: async p => {
        await menu(p, 'Cuaderno de Notas', rapido);
        await menu(p, 'Asistencia', rapido);
        await menu(p, 'Evaluar', rapido);
      } },
  ],
};
