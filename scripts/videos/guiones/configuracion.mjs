/**
 * Vídeo: configuración.
 * Puesto al día el 23-11-2026: las tarjetas de Configuración (también la clave de la IA), Apariencia y Seguridad
 * en una escena, y Datos y copias con la tarjeta «Final de curso» y el asistente «Empezar curso nuevo».
 * La grabación se hace con la app fuera de la versión web: «Mis datos» enseña el texto de la versión web
 * (el mismo arreglo que el vídeo de privacidad).
 */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
const tarjeta = (p, t) => p.locator('.st-tile', { hasText: t }).first();
const volver = p => clicar(p, p.locator('.st-hd button').first(), rapido);
const modal = p => p.locator('.modal-overlay.open');
const WEB = 'Tu trabajo se guarda en este dispositivo, dentro del navegador, solo para este perfil, y no se sube a ningún servidor de AulaPro. AulaPro hace copias automáticas cada diez minutos mientras trabajas, pero están en el mismo navegador: si se borran sus datos, se pierden también. Para no perder nada, guarda tu trabajo en tu Drive u OneDrive, en una carpeta de tu ordenador o descarga copias a menudo.';

export default {
  id: 'configuracion', titulo: 'Configurar AulaPro',
  despues: async page => {
    await page.evaluate(web => {
      const cambiar = () => { for (const q of document.querySelectorAll('p')) if (q.textContent.includes('AulaPro.exe')) q.textContent = web; };
      new MutationObserver(cambiar).observe(document.body, { childList: true, subtree: true });
      cambiar();
    }, WEB);
  },
  escenas: [
    { texto: 'En Configuración está todo lo personal: tu perfil, la clave de la IA y el idioma.',
      hacer: async p => {
        await menu(p, 'Configuración', rapido); await esperar(p, 700);
        for (const t of ['Perfil', 'Clave de la IA', 'Idioma']) await mover(p, tarjeta(p, t), { pasos: 14, espera: 650 });
      } },
    { texto: 'En Apariencia eliges el color, el modo oscuro y el tamaño de las letras. En Seguridad, una contraseña para tu perfil.',
      hacer: async p => {
        await clicar(p, tarjeta(p, 'Apariencia'), rapido); await esperar(p, 2300); await volver(p);
        await clicar(p, tarjeta(p, 'Seguridad'), rapido); await esperar(p, 1800); await volver(p);
      } },
    { texto: 'En Datos y copias descargas todo tu trabajo para guardarlo aparte o llevarlo a otro equipo.',
      hacer: async p => {
        await clicar(p, tarjeta(p, 'Datos y copias'), rapido); await esperar(p, 600);
        await mover(p, p.getByRole('button', { name: /Descargar mis datos/ }), { pasos: 14, espera: 900 });
        await mover(p, p.getByText('Mis datos', { exact: true }).first(), { pasos: 14, espera: 900 });
      } },
    { texto: 'Y al final de curso, «Empezar curso nuevo» te guía paso a paso, con una copia descargada antes de cambiar nada.',
      hacer: async p => {
        await mover(p, p.getByText('Final de curso', { exact: false }).first(), { pasos: 14, espera: 400 });
        await clicar(p, p.locator('.fc').getByRole('button', { name: /Empezar curso nuevo/ }), { ...rapido, despues: 900 });
        await mover(p, modal(p).getByRole('button', { name: /Descargar la copia del curso/ }), { pasos: 14, espera: 1500 });
      } },
  ],
};
