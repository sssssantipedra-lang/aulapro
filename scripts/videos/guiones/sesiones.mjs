/**
 * Vídeo: sesiones.
 * Puesto al día el 23-11-2026: los datos de ejemplo no traen sesiones, así que antes de grabar se crean tres en
 * 5º Primaria A (sin fecha, la primera con actividades); se enseñan «Poner fechas» (reparto en las horas del horario)
 * con el porqué de cada salto, «No se dio» y «Dar la clase» (la pizarra con el plan del día). Antes, «Nueva sesión»
 * y una vista del formulario.
 */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { modal, pestana, por } from './_comun.mjs';

const CLASE = '5º Primaria A';
const SESIONES = ['Los animales salvajes', 'Describir un animal', 'Presentación oral'];
/** Las actividades de la primera, para que «Dar la clase» enseñe un plan con algo dentro. */
const MOMENTOS = {
  'Inicio de la sesión': 'Lluvia de ideas (5 min): qué animales salvajes conocemos en inglés.',
  'Desarrollo de la sesión': 'Vocabulario con tarjetas (15 min): cada animal con su nombre.\nAdivina el animal (15 min): describirlo sin decir su nombre.',
  'Cierre de la sesión': 'Repaso en voz alta (5 min): cada grupo dice tres animales.',
};

/** La tarjeta de una clase en la portada de Sesiones. */
const tarjeta = p => p.locator('main').getByText(CLASE, { exact: true }).first();

export default {
  id: 'sesiones', titulo: 'Las sesiones de cada clase',
  // Fuera del vídeo (se recorta lo anterior a la primera escena): tres sesiones de 5º Primaria A, sin fecha
  despues: async page => {
    const sin = { pasos: 2, espera: 0, despues: 150 };
    await menu(page, 'Documentos', sin); await pestana(page, 'Sesiones', sin);
    for (const titulo of SESIONES) {
      await clicar(page, por(page, 'Nueva sesión'), sin);
      const m = modal(page);
      await m.locator('select').first().selectOption({ label: CLASE });
      await m.locator('input').first().fill(titulo);
      await m.locator('input[type="date"]').first().fill('');
      if (titulo === SESIONES[0]) for (const [etiqueta, texto] of Object.entries(MOMENTOS)) await m.getByLabel(etiqueta).fill(texto);
      await clicar(page, m.getByRole('button', { name: 'Guardar' }), sin);
      await esperar(page, 300);
    }
    await menu(page, 'Inicio', sin);
    await esperar(page, 800);
  },
  escenas: [
    { texto: 'En Sesiones tienes una tarjeta por clase. Dentro, las sesiones van agrupadas por situación de aprendizaje.',
      hacer: async p => {
        await menu(p, 'Documentos', rapido); await pestana(p, 'Sesiones', rapido); await esperar(p, 900);
        await clicar(p, tarjeta(p), rapido); await esperar(p, 900);
      } },
    { texto: '«Poner fechas» las reparte en las horas de esa clase en tu horario, y te dice qué festivos y vacaciones salta.',
      hacer: async p => {
        await clicar(p, por(p, 'Poner fechas'), rapido); await esperar(p, 500);
        // Desde el 9 de diciembre, para que se vea el salto de las vacaciones de Navidad y su porqué
        const desde = modal(p).locator('#pf-desde');
        await mover(p, desde, rapido); await desde.fill('2026-12-09'); await esperar(p, 700);
        await mover(p, modal(p).locator('.pf-salto').first(), { pasos: 14, espera: 1300 });
        await mover(p, modal(p).locator('.pf-lista .pf-fecha').last(), { pasos: 12, espera: 500 });
      } },
    { texto: 'Nada cambia hasta que lo apliques. Y si una sesión no se dio, con un botón pasa a la clase siguiente.',
      hacer: async p => {
        await clicar(p, modal(p).getByRole('button', { name: 'Poner estas fechas' }), rapido); await esperar(p, 900);
        await mover(p, p.locator('main .ses-nodio').first(), { pasos: 14, espera: 1200 });
      } },
    { texto: 'El día de la clase, «Dar la clase» abre la pizarra con el plan de esa sesión.',
      hacer: async p => {
        await clicar(p, p.locator('main .dlc-btn').first(), rapido); await esperar(p, 1800);
      } },
  ],
};
