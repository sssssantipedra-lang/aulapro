/**
 * Vídeo 1: configurar la clave de la IA. Cada escena lleva su frase (la que se
 * locuta y sale subtitulada) y lo que se hace en pantalla mientras suena.
 * La voz de cada escena está en audio/clave-ia/0N.mp3.
 */
import { menu, mover, clicar, clave, esperar, rapido } from '../lib.mjs';

export default {
  id: 'clave-ia',
  titulo: 'Configurar la clave de la IA',
  escenas: [
    { texto: 'Para usar la IA en AulaPro necesitas una clave gratuita de Google. Te enseño cómo conseguirla.',
      hacer: async p => { await menu(p, 'Inicio'); } },
    { texto: 'En Configuración, abre «Clave de la IA» y pulsa «Abrir AI Studio». Te recomendamos leer la información y marcar que aceptas el uso de la IA. Y recuerda: evita escribir nombres completos de tu alumnado.',
      hacer: async p => {
        // Abrir AI Studio abre otra pestaña: en el vídeo no hace falta
        p.context().on('page', n => { n.close().catch(() => {}); });
        await menu(p, 'Configuración', rapido);
        await clicar(p, p.getByText('Clave de la IA', { exact: true }).first(), rapido);
        await clicar(p, p.getByRole('link', { name: /Abrir AI Studio/ }), rapido);
        // Se recomienda leer la información antes de aceptar: se abre el panel, se enseña y se cierra
        await clicar(p, p.locator('.modal-overlay.open').getByRole('button', { name: 'Leer la información' }), rapido);
        await esperar(p, 3200);
        await clicar(p, p.locator('.modal-overlay.open').getByRole('button', { name: 'Cerrar' }).last(), rapido);
        await clicar(p, p.locator('.modal-overlay.open').getByRole('checkbox'), rapido);
        await clicar(p, p.locator('.modal-overlay.open').getByRole('button', { name: 'Continuar' }), rapido);
      } },
    // Lo que se ve de Google AI Studio es una grabación real (clips/aistudio.mp4), puesta encima en el montaje
    { texto: 'En Google AI Studio, lee y marca la casilla que te pide Google, y pulsa «Continuar». Después, abre «Get API key», crea una clave de API y cópiala con este icono.', clip: 'aistudio.mp4',
      hacer: async p => { await clave(p); await mover(p, p.getByText('Crea y copia la clave')); } },
    { texto: 'Vuelve a AulaPro y pulsa «Pegar mi clave». La aplicación comprueba que funciona.',
      hacer: async p => { await clicar(p, p.getByRole('button', { name: /Pegar mi clave/ })); } },
    { texto: 'Listo. Tu clave se queda en tu equipo y no se comparte.',
      hacer: async p => { await mover(p, p.getByText('La IA está lista para usar en toda la aplicación.')); } },
  ],
};
