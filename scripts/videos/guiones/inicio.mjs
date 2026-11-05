/** Vídeo: Inicio, «Tu jornada». */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { por } from './_comun.mjs';
export default {
  id: 'inicio', titulo: 'Tu jornada en Inicio',
  escenas: [
    { texto: 'Inicio es tu jornada: las clases de hoy, ordenadas por hora.',
      hacer: async p => { await menu(p, 'Inicio', rapido); await esperar(p, 1500); } },
    { texto: 'Con un toque pasas lista, anotas la actitud o añades una nota al cuaderno.',
      hacer: async p => { for (const t of ['Pasar lista', 'Anotar actitud', 'Añadir nota']) await mover(p, por(p, t), { pasos: 16, espera: 700 }); } },
    { texto: 'Más abajo ves cómo va cada clase, con su nota media.',
      hacer: async p => { await p.mouse.wheel(0, 500); await esperar(p, 600); await mover(p, p.locator('main button', { hasText: '1º Primaria A' }).first(), { pasos: 16, espera: 900 }); await mover(p, p.locator('main button', { hasText: '3º ESO A' }).first(), { pasos: 16, espera: 900 }); } },
    { texto: 'Y los primeros pasos te recuerdan lo que falta por configurar.',
      hacer: async p => { await p.mouse.wheel(0, -900); await esperar(p, 500); await mover(p, p.getByText(/Primeros pasos/).first(), { pasos: 16, espera: 1500 }); } },
  ],
};
