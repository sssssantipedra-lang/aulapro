/**
 * Vídeo: pizarra y herramientas.
 * Puesto al día el 23-11-2026: empieza con «Dar la clase» desde la franja de En clase (la clase que toca, 5º Primaria A
 * a las 9:45), que abre la pizarra con la ventana «Plan del día» rellena. Los datos de ejemplo no traen sesiones, así
 * que antes de grabar se crea una para hoy con sus tres momentos. Después, las herramientas, el dibujo, el fondo y las
 * escenas, como antes, en menos frases.
 */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { modal, pestana, por } from './_comun.mjs';

const CLASE = '5º Primaria A';

export default {
  id: 'pizarra', titulo: 'Pizarra y herramientas',
  // Fuera del vídeo (se recorta lo anterior a la primera escena): una sesión de hoy para 5º Primaria A
  despues: async page => {
    const sin = { pasos: 2, espera: 0, despues: 150 };
    await menu(page, 'Documentos', sin); await pestana(page, 'Sesiones', sin);
    await clicar(page, por(page, 'Nueva sesión'), sin);
    const m = modal(page);
    await m.locator('#ef-s-titulo').fill('Los animales salvajes');
    await m.locator('#ef-s-clase').selectOption({ label: CLASE });
    await m.locator('#ef-s-fecha').fill('2026-10-14');
    await m.locator('#ef-s-calentamiento').fill('Canción de los animales (5 min): la cantamos y repasamos el vocabulario.');
    await m.locator('#ef-s-principal').fill('Adivina el animal (15 min): por parejas, uno describe un animal y el otro lo adivina.\nMi animal favorito (15 min): escribimos tres frases sobre él.');
    await m.locator('#ef-s-calma').fill('Puesta en común (5 min): cada pareja presenta su animal.');
    await clicar(page, m.getByRole('button', { name: 'Guardar' }), sin);
    await esperar(page, 300);
    await menu(page, 'Inicio', sin);
    await esperar(page, 800);
  },
  escenas: [
    { texto: 'Desde En clase, «Dar la clase» abre la pizarra con la clase que toca y el plan de la sesión de hoy.',
      hacer: async p => {
        await menu(p, 'En clase', rapido); await esperar(p, 700);
        await clicar(p, p.locator('.ec-ahora .dlc-btn').first(), rapido); await esperar(p, 1500);
      } },
    { texto: 'Lo ve la clase: el título y las actividades de cada momento. Márcalas al terminarlas.',
      hacer: async p => {
        await clicar(p, p.locator('.dlc-tarea [role=checkbox]').first(), rapido); await esperar(p, 500);
        await clicar(p, p.locator('.dlc-tarea [role=checkbox]').nth(1), rapido); await esperar(p, 900);
      } },
    { texto: 'Añade las herramientas que necesites: temporizador, ruleta con los nombres, semáforo y muchas más.',
      hacer: async p => {
        // El plan pasa a su icono para dejar sitio a las herramientas
        const plan = p.locator('div').filter({ has: p.getByText('Los animales salvajes', { exact: true }) })
          .filter({ has: p.locator('[aria-label="Minimizar"]') }).last();
        await clicar(p, plan.locator('[aria-label="Minimizar"]'), rapido); await esperar(p, 400);
        await clicar(p, por(p, 'Añadir Ruleta'), rapido); await esperar(p, 700);
        await clicar(p, por(p, 'Añadir Semáforo'), rapido); await esperar(p, 1000);
      } },
    { texto: 'Dibuja sobre la pantalla, cambia el fondo y guarda la disposición para otro día.',
      hacer: async p => {
        await clicar(p, por(p, 'Dibujar sobre la pantalla'), rapido); await esperar(p, 600);
        await mover(p, por(p, 'Cambiar el fondo'), { pasos: 14, espera: 900 });
        await mover(p, por(p, 'Guardar y recuperar'), { pasos: 14, espera: 1000 });
      } },
  ],
};
