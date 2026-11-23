/**
 * Vídeo: situaciones de aprendizaje con IA.
 * Puesto al día el 23-11-2026: se enseñan la casilla «Dar prioridad a lo que aún no has evaluado» y el selector
 * «Modelo de IA», y «Configurar la IA», que ahora abre los pasos de la clave en una ventana encima de la pantalla.
 */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { modal, pestana, por } from './_comun.mjs';
export default {
  id: 'situaciones-aprendizaje', titulo: 'Situaciones de aprendizaje',
  escenas: [
    { texto: 'Tú pones la idea y la IA redacta la situación entera: currículo, sesiones y evaluación.',
      hacer: async p => { await menu(p, 'Documentos', rapido); await pestana(p, 'Situaciones de aprendizaje', rapido); await esperar(p, 1500); } },
    { texto: 'Pulsa «Nueva situación de aprendizaje» y marca las clases. La IA puede dar prioridad a lo que aún no has evaluado.',
      hacer: async p => {
        await clicar(p, por(p, 'Nueva situación de aprendizaje'), rapido);
        await esperar(p, 500);
        await clicar(p, p.locator('main').getByRole('button', { name: '1º ESO A', exact: true }).first(), rapido);
        await clicar(p, p.locator('main').getByRole('button', { name: '2º ESO B', exact: true }).first(), rapido);
        await mover(p, p.locator('main').getByText('Dar prioridad a lo que aún no has evaluado').first(), { pasos: 14, espera: 1000 });
      } },
    { texto: 'Escribe la idea, elige el modelo de IA si quieres y pulsa «Generar».',
      hacer: async p => {
        await clicar(p, p.locator('main textarea').first(), rapido);
        await p.keyboard.type('El ciclo del agua', { delay: 45 });
        await mover(p, p.locator('#learningsituations-modelo'), { pasos: 14, espera: 700 });
        await mover(p, por(p, 'Generar situación de aprendizaje'), { pasos: 12, espera: 700 });
      } },
    { texto: 'Sin clave, «Configurar la IA» te abre aquí mismo los pasos para conseguir la clave gratuita de Google.',
      hacer: async p => {
        await clicar(p, p.locator('main').getByRole('button', { name: 'Configurar la IA' }).first(), rapido);
        await esperar(p, 700);
        await mover(p, modal(p).locator('.ak-intro'), { pasos: 14, espera: 1500 });
      } },
  ],
};
