/** Vídeo: recursos (fichas, escape rooms, tarjetas). */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { pestana, por } from './_comun.mjs';
export default {
  id: 'recursos', titulo: 'Fichas y recursos',
  escenas: [
    { texto: 'En Recursos, la IA crea fichas, textos de comprensión lectora, escape rooms y tarjetas.',
      hacer: async p => { await menu(p, 'Documentos', rapido); await pestana(p, 'Recursos', rapido); await esperar(p, 1500); } },
    { texto: 'Elige el tipo de recurso, escribe el tema y el curso.',
      hacer: async p => {
        await clicar(p, p.locator('main').getByText('Ficha de ejercicios').first(), rapido);
        const inp = p.locator('main input[placeholder^="Ej: las"]').first();
        await clicar(p, inp, rapido); await p.keyboard.type('Las fracciones equivalentes', { delay: 45 });
        const cur = p.locator('main input[placeholder^="Ej: 5"]').first();
        await clicar(p, cur, rapido); await p.keyboard.type('5º de Primaria', { delay: 45 });
      } },
    { texto: 'Pulsa «Crear ficha», retócala a tu gusto y descárgala en PDF o en Word. Siempre van de menos a más.',
      hacer: async p => { await mover(p, por(p, 'Crear ficha'), { pasos: 18, espera: 1800 }); } },
  ],
};
