/**
 * Vídeo 1: configurar la clave de la IA. Cada escena lleva su frase (la que se
 * locuta y sale subtitulada) y lo que se hace en pantalla mientras suena.
 */
import { menu, mover, clicar, clave } from '../lib.mjs';

export default {
  id: 'clave-ia',
  titulo: 'Configurar la clave de la IA',
  escenas: [
    { texto: 'Para usar la IA de AulaPro necesitas una clave gratuita de Google. Te enseño cómo conseguirla.',
      hacer: async p => { await menu(p, 'Inicio'); } },
    { texto: 'En Configuración, abre «Clave de la IA».',
      hacer: async p => { await menu(p, 'Configuración'); await clicar(p, p.getByText('Clave de la IA', { exact: true }).first()); } },
    { texto: 'Pulsa «Abrir AI Studio», entra con tu cuenta de Google y crea una clave de API. Cópiala.',
      hacer: async p => { await mover(p, p.getByRole('link', { name: /Abrir AI Studio/ })); await clave(p); await p.waitForTimeout(1200); await mover(p, p.getByText('Crea y copia la clave')); } },
    { texto: 'Vuelve a AulaPro y pulsa «Pegar mi clave». La aplicación comprueba que funciona.',
      hacer: async p => { await clicar(p, p.getByRole('button', { name: /Pegar mi clave/ })); } },
    { texto: 'Listo. Tu clave se queda en tu equipo y no se comparte.',
      hacer: async p => { await mover(p, p.getByText('La IA está lista para usar en toda la aplicación.')); } },
  ],
};
