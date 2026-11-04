/**
 * Vídeo 3: la privacidad de los datos y de la IA, con la propia app: dónde se guarda el trabajo y qué se envía a la IA.
 * La voz está en audio/privacidad/0N.mp3.
 */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';

const modal = p => p.locator('.modal-overlay.open');

export default {
  id: 'privacidad',
  titulo: 'Privacidad de los datos y de la IA',
  // Con la app abierta: el uso de la IA ya aceptado, para poder enseñar el panel de información
  despues: async page => {
    await page.evaluate(() => localStorage.setItem('aulapro_uso_ia', JSON.stringify({ v: '2026-11-04', fecha: new Date().toISOString() })));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4500);
  },
  escenas: [
    { texto: 'Así protege AulaPro los datos de tu alumnado.',
      hacer: async p => { await menu(p, 'Inicio', rapido); } },
    { texto: 'Tu trabajo se guarda en tu navegador, en tu Drive u OneDrive, o en una carpeta de tu ordenador. AulaPro no tiene servidores para tus datos y no puede verlos.',
      hacer: async p => {
        await menu(p, 'Configuración', rapido);
        await clicar(p, p.getByText('Datos y copias', { exact: true }).first(), rapido);
        await esperar(p, 1500);
        await p.mouse.wheel(0, 380); await esperar(p, 1800);
      } },
    { texto: 'Si usas la IA, los nombres se cambian por códigos antes de enviarlos y los datos de salud se quitan. Aun así, evita escribir nombres completos: usa el número de lista y el nombre, o las iniciales.',
      hacer: async p => {
        await menu(p, 'Inicio', rapido);
        await menu(p, 'Configuración', rapido);
        await clicar(p, p.getByText('Clave de la IA', { exact: true }).first(), rapido);
        await clicar(p, p.getByRole('button', { name: 'Cómo trata AulaPro lo que envías a la IA' }), rapido);
        await esperar(p, 2000);
        await p.mouse.wheel(0, 250); await esperar(p, 1500);
      } },
    { texto: 'La IA da recomendaciones, nunca notas, y la decisión final es siempre tuya. Puedes leerlo todo en la política de privacidad.',
      hacer: async p => {
        await mover(p, modal(p).getByRole('link', { name: 'Leer la política de privacidad' }), rapido);
        await esperar(p, 1500);
      } },
  ],
};
