/**
 * Vídeo 1: configurar la clave de la IA. Cada escena lleva su frase (la que se
 * locuta y sale subtitulada) y lo que se hace en pantalla mientras suena.
 * La voz de cada escena está en audio/clave-ia/0N.mp3.
 *
 * Puesto al día el 23-11-2026: la primera escena enseña que «Configurar la IA», en cualquier pantalla que pida la
 * clave, abre los mismos pasos en una ventana encima (aquí, en «Nueva rúbrica»); el resto sigue por Configuración ›
 * Clave de la IA, que no ha cambiado. Falta regenerar todas las voces con la voz común de los vídeos
 * (fal.ai sin saldo el 23-11-2026): las de audio/clave-ia/ son las de antes y 01 y 02 dicen las frases antiguas.
 */
import { menu, mover, clicar, clave, esperar, rapido } from '../lib.mjs';

export default {
  id: 'clave-ia',
  titulo: 'Configurar la clave de la IA',
  escenas: [
    { texto: 'Para usar la IA en AulaPro necesitas una clave gratuita de Google. Si una pantalla te la pide, «Configurar la IA» abre los pasos ahí mismo.',
      hacer: async p => {
        // Sin clave, «Nueva rúbrica» se abre en «Desde un modelo»: en la pestaña de la IA sale el aviso con el botón
        await menu(p, 'Evaluar', rapido);
        await clicar(p, p.locator('.hub-tab', { hasText: /^Rúbricas$/ }), rapido);
        await clicar(p, p.getByRole('button', { name: /Nueva rúbrica/ }).first(), rapido);
        await clicar(p, p.locator('.modal-overlay.open').getByRole('button', { name: /IA$/ }).first(), rapido);
        await clicar(p, p.locator('.modal-overlay.open .ai-notice-btn'), rapido);
        await esperar(p, 2200);
        // Se cierra la ventana de la clave y, después, la de la rúbrica
        await clicar(p, p.locator('.vci').getByRole('button', { name: 'Ahora no' }), rapido);
        await clicar(p, p.locator('.modal-overlay.open').getByRole('button', { name: 'Cerrar', exact: true }).first(), rapido);
      } },
    { texto: 'También están en Configuración: abre «Clave de la IA» y pulsa «Abrir AI Studio». Te recomendamos leer la información y marcar que aceptas el uso de la IA. Y recuerda: evita escribir nombres completos de tu alumnado.',
      hacer: async p => {
        // Abrir AI Studio abre otra pestaña: en el vídeo no hace falta
        p.context().on('page', n => { n.close().catch(() => {}); });
        await menu(p, 'Configuración', rapido);
        await clicar(p, p.locator('main').getByText('Clave de la IA', { exact: true }).first(), rapido);
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
