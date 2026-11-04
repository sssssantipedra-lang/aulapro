/**
 * Vídeo 1: configurar la clave de la IA. Cada escena lleva su frase (la que se
 * locuta y sale subtitulada) y lo que se hace en pantalla mientras suena.
 * La voz de cada escena está en audio/clave-ia/0N.mp3.
 */
import { menu, mover, clicar, clave, esperar } from '../lib.mjs';

export default {
  id: 'clave-ia',
  titulo: 'Configurar la clave de la IA',
  escenas: [
    { texto: 'Para usar la IA de AulaPro necesitas una clave gratuita de Google. Te enseño cómo conseguirla.',
      hacer: async p => { await menu(p, 'Inicio'); } },
    { texto: 'En Configuración, abre «Clave de la IA» y pulsa «Abrir AI Studio». La primera vez, marca la casilla para aceptar el uso de la IA.',
      hacer: async p => {
        // Abrir AI Studio abre otra pestaña: en el vídeo no hace falta
        p.context().on('page', n => { n.close().catch(() => {}); });
        await menu(p, 'Configuración');
        await clicar(p, p.getByText('Clave de la IA', { exact: true }).first());
        await clicar(p, p.getByRole('link', { name: /Abrir AI Studio/ }));
        const d = p.locator('.modal-overlay.open');
        await clicar(p, d.getByRole('checkbox'));
        await esperar(p, 500);
        await clicar(p, d.getByRole('button', { name: 'Continuar' }));
      } },
    // Lo que se ve de Google AI Studio es una grabación real (clips/aistudio.mp4), puesta encima en el montaje
    { texto: 'Entra con tu cuenta de Google y crea una clave de API. Cópiala.', clip: 'aistudio.mp4',
      hacer: async p => { await clave(p); await mover(p, p.getByText('Crea y copia la clave')); } },
    { texto: 'Vuelve a AulaPro y pulsa «Pegar mi clave». La aplicación comprueba que funciona.',
      hacer: async p => { await clicar(p, p.getByRole('button', { name: /Pegar mi clave/ })); } },
    { texto: 'Listo. Tu clave se queda en tu equipo y no se comparte.',
      hacer: async p => { await mover(p, p.getByText('La IA está lista para usar en toda la aplicación.')); } },
  ],
};
