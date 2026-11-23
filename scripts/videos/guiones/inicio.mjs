/**
 * Vídeo: Inicio, «Tu jornada».
 * Puesto al día el 23-11-2026: la jornada con la clase de ahora, los atajos (también Evaluar), «Necesitan atención»
 * con su motivo, que abre la ficha del alumno, «Cómo van tus clases» y el buscador general.
 */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';

const arriba = p => p.evaluate(() => { for (const el of [document.scrollingElement, ...document.querySelectorAll('main, .main, .content')]) if (el) el.scrollTop = 0; });

export default {
  id: 'inicio', titulo: 'Tu jornada en Inicio',
  escenas: [
    { texto: 'Inicio es tu jornada: las clases de hoy por hora, con la que toca ahora.',
      hacer: async p => {
        await menu(p, 'Inicio', rapido);
        await arriba(p); await esperar(p, 500);
        await mover(p, p.getByText('Tu jornada de hoy').first(), { pasos: 14, espera: 500 });
        await mover(p, p.locator('main').getByText('Ahora', { exact: true }).first(), { pasos: 14, espera: 600 });
        await mover(p, p.locator('main').getByText('5º Primaria A - Inglés').first(), { pasos: 14, espera: 900 });
      } },
    { texto: 'Con un toque pasas lista, anotas la actitud, pones una nota o evalúas.',
      hacer: async p => { for (const t of ['Pasar lista', 'Anotar actitud', 'Añadir nota', 'Evaluar']) await mover(p, p.locator('main').locator(`button:has-text("${t}")`).first(), { pasos: 12, espera: 550 }); } },
    { texto: 'Abajo, la media de cada clase y quién necesita atención, con el motivo. Al tocarlo, se abre su ficha.',
      hacer: async p => {
        await mover(p, p.getByText('Cómo van tus clases').first(), { pasos: 14, espera: 700 });
        await mover(p, p.locator('main button', { hasText: '3º ESO A' }).last(), { pasos: 12, espera: 600 });
        await mover(p, p.getByText('Necesitan atención', { exact: true }).first(), { pasos: 12, espera: 500 });
        await clicar(p, p.locator('.home-alert-btn').first(), { pasos: 12, espera: 600, despues: 1800 });
      } },
    { texto: 'Y con Buscar, en el menú, encuentras al momento una pantalla, una clase o un alumno.',
      hacer: async p => {
        // Se cierra la ficha que abrió la escena anterior
        const ficha = p.locator('.modal-overlay.open');
        if (await ficha.count()) await clicar(p, ficha.getByRole('button', { name: 'Cerrar' }).first(), { ...rapido, despues: 250 });
        await clicar(p, p.locator('.sidebar .sb-buscar-txt'), rapido);
        await p.keyboard.type('3º ESO', { delay: 90 });
        await esperar(p, 900);
        await mover(p, p.locator('.bq-lista li').first(), { pasos: 12, espera: 900 });
      } },
  ],
};
