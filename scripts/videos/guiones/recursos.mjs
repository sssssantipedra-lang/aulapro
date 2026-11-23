/**
 * Vídeo: recursos (fichas, escape rooms, tarjetas).
 * Puesto al día el 23-11-2026: sin clave de la IA («Crear ficha» sale apagado) se enseña lo que se hace sin ella,
 * «Empezar en blanco» y la tarjeta «Al instante (sin IA)», con una hoja de fracciones con pizzas creada de verdad.
 */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { pestana, por } from './_comun.mjs';

/** Una tarjeta de elegir (tipo de recurso o de hoja al instante) por su título. */
const tarjeta = (p, titulo) => p.locator('main .ev-card').filter({ has: p.locator('.ev-card-ttl', { hasText: titulo }) }).first();

export default {
  id: 'recursos', titulo: 'Fichas y recursos',
  escenas: [
    { texto: 'En Recursos, la IA crea fichas, textos de comprensión lectora, escape rooms y tarjetas.',
      hacer: async p => { await menu(p, 'Documentos', rapido); await pestana(p, 'Recursos', rapido); await esperar(p, 1500); } },
    { texto: 'Sin clave de la IA también puedes crear. «Empezar en blanco» te da la ficha vacía para escribir tus ejercicios.',
      hacer: async p => {
        await mover(p, tarjeta(p, 'Ficha de ejercicios'), rapido); await esperar(p, 300);
        await mover(p, por(p, 'Empezar en blanco'), { pasos: 16, espera: 1400 });
      } },
    { texto: 'Y «Al instante» monta sopas de letras, crucigramas, operaciones y fracciones con pizzas.',
      hacer: async p => {
        await clicar(p, tarjeta(p, 'Al instante (sin IA)'), rapido); await esperar(p, 500);
        await mover(p, tarjeta(p, 'Sopa de letras'), rapido); await esperar(p, 300);
        await clicar(p, tarjeta(p, 'Fracciones con pizzas'), rapido); await esperar(p, 400);
      } },
    { texto: 'Pulsa «Crear al instante»: sale de menos a más y con su solucionario, lista para retocar e imprimir.',
      hacer: async p => {
        await mover(p, p.locator('main .fsi-gen .fe-check').last(), rapido); await esperar(p, 300);
        await clicar(p, por(p, 'Crear al instante'), rapido); await esperar(p, 900);
        await mover(p, p.locator('main .fe-crear, main').getByText('Vista previa').first(), { pasos: 14, espera: 900 });
      } },
  ],
};
