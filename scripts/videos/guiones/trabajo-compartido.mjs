/** Vídeo: trabajo compartido (archivo cifrado). */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { por } from './_comun.mjs';
export default {
  id: 'trabajo-compartido', titulo: 'Trabajo compartido',
  escenas: [
    { texto: 'Trabajo compartido pasa tu trabajo a otro docente en un archivo cifrado.',
      hacer: async p => { await menu(p, 'Trabajo compartido', rapido); await esperar(p, 1500); } },
    { texto: 'Marca las clases que quieres enviar.',
      hacer: async p => { await clicar(p, por(p, '1º ESO A'), rapido); await clicar(p, por(p, '2º ESO B'), rapido); await esperar(p, 600); } },
    { texto: 'AulaPro propone una contraseña: dísela a quien recibe por otro medio.',
      hacer: async p => { await mover(p, por(p, 'Copiar contraseña'), { pasos: 18, espera: 900 }); await mover(p, por(p, 'Crear archivo cifrado'), { pasos: 14, espera: 900 }); } },
    { texto: 'Quien lo recibe decide qué conserva. Nunca se borra nada.',
      hacer: async p => { await mover(p, por(p, 'Elegir el archivo recibido'), { pasos: 18, espera: 1600 }); } },
  ],
};
