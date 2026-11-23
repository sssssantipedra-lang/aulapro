/**
 * Vídeo: distribución de aula.
 * Puesto al día el 23-11-2026: la pantalla se abre en la clase que toca ahora (5º Primaria A, «Ahora»), y la primera
 * frase lo dice; la última enseña la rotación semanal de los roles con las flechas (antes decía que los roles de cada
 * semana se asignaban en «Mesas y roles», donde solo se definen).
 */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { modal, pestana, por, cerrar } from './_comun.mjs';
export default {
  id: 'distribucion-aula', titulo: 'Distribución del aula',
  escenas: [
    { texto: 'Distribución de aula se abre en la clase que toca ahora. Decide quién se sienta dónde y qué papel tiene cada uno.',
      hacer: async p => {
        await menu(p, 'En clase', rapido); await pestana(p, 'Distribución de aula', rapido); await esperar(p, 900);
        await mover(p, p.locator('main').getByText('Ahora', { exact: true }).first(), { pasos: 14, espera: 1200 });
      } },
    { texto: 'Elige mesas cooperativas o mesas cuadradas, según cómo esté tu aula.',
      hacer: async p => { await clicar(p, por(p, 'Mesas y roles'), rapido); await esperar(p, 700); await clicar(p, p.getByRole('radio').filter({ hasText: 'Mesas cuadradas' }), rapido); await esperar(p, 900); await clicar(p, p.getByRole('radio').filter({ hasText: 'Mesas cooperativas' }), rapido); await esperar(p, 500); await cerrar(p); } },
    { texto: 'Reparte al alumnado por orden de lista, o deja que la IA proponga una distribución.',
      hacer: async p => { await clicar(p, por(p, 'Sentar por orden de lista'), rapido); await esperar(p, 800); await mover(p, por(p, 'Repartir con IA'), { pasos: 16, espera: 1000 }); } },
    { texto: 'Los roles los defines en «Mesas y roles», y con las flechas rotan cada semana.',
      hacer: async p => {
        await mover(p, por(p, 'Mesas y roles'), { pasos: 14, espera: 700 });
        await clicar(p, p.locator('.seat-rotation').getByRole('button', { name: 'Semana siguiente' }), rapido); await esperar(p, 900);
        await mover(p, p.locator('main').getByText('Portavoz', { exact: true }).first(), { pasos: 14, espera: 900 });
      } },
  ],
};
