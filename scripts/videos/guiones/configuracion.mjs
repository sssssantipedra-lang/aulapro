/** Vídeo: configuración. */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
const tarjeta = (p, t) => p.locator('.st-tile', { hasText: t }).first();
const volver = p => clicar(p, p.locator('.st-hd button').first(), rapido);
export default {
  id: 'configuracion', titulo: 'Configurar AulaPro',
  escenas: [
    { texto: 'En Configuración está todo lo personal: tu perfil y el idioma.',
      hacer: async p => { await menu(p, 'Configuración', rapido); await esperar(p, 1000); await mover(p, tarjeta(p, 'Perfil'), { pasos: 16, espera: 700 }); await mover(p, tarjeta(p, 'Idioma'), { pasos: 16, espera: 900 }); } },
    { texto: 'En Apariencia, el color, el modo oscuro y el tamaño de las letras.',
      hacer: async p => { await clicar(p, tarjeta(p, 'Apariencia'), rapido); await esperar(p, 2500); await volver(p); } },
    { texto: 'En Seguridad puedes poner una contraseña para abrir tu perfil.',
      hacer: async p => { await clicar(p, tarjeta(p, 'Seguridad'), rapido); await esperar(p, 2200); await volver(p); } },
    { texto: 'Y en Datos y copias, tus copias de seguridad.',
      hacer: async p => { await clicar(p, tarjeta(p, 'Datos y copias'), rapido); await esperar(p, 2200); } },
  ],
};
