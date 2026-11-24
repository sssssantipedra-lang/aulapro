/**
 * Vídeo: Agenda (mensual, capas de otras pantallas, nuevo evento, horario semanal).
 * Puesto al día el 23-11-2026: la Agenda se abre en «Resumen»; se enseñan las capas «También se ve:» y el filtro
 * por clase, y que una entrega de una clase puede crear también su columna en el cuaderno.
 */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { modal, por, cerrar } from './_comun.mjs';

/** Pestaña de la Agenda (Resumen, Mensual, Semanal). */
const vista = (p, nombre) => clicar(p, p.locator('main .tab-bar [role="tab"]').filter({ hasText: new RegExp(`^\\s*${nombre}\\s*$`) }), rapido);

export default {
  id: 'agenda', titulo: 'La agenda y el horario',
  escenas: [
    { texto: 'En Agenda ves el calendario del mes, con tus eventos y los días no lectivos de tu comunidad.',
      hacer: async p => { await menu(p, 'Agenda', rapido); await esperar(p, 500); await vista(p, 'Mensual'); await esperar(p, 1500); } },
    { texto: 'En «También se ve:» enciendes o apagas las sesiones, el cuaderno y las reuniones, y puedes filtrar por clase.',
      hacer: async p => {
        const capa = p.locator('main .ag-capa').first();
        await clicar(p, capa, rapido); await esperar(p, 600);
        await clicar(p, capa, rapido); await esperar(p, 400);
        await mover(p, p.locator('main .ag-capa').nth(1), rapido); await esperar(p, 500);
        await mover(p, p.locator('#ag-filtro-clase'), { pasos: 14, espera: 1200 });
      } },
    { texto: 'Pulsa «Nuevo evento». Si es una entrega de una clase, puedes crear también su columna en el cuaderno.',
      hacer: async p => {
        await clicar(p, por(p, 'Nuevo evento'), rapido);
        await clicar(p, modal(p).locator('input').first(), rapido);
        await p.keyboard.type('Entrega del mural', { delay: 45 });
        const tipo = modal(p).locator('#agenda-f10');
        await mover(p, tipo, rapido); await tipo.selectOption('deadline'); await esperar(p, 300);
        const clase = modal(p).locator('#agenda-f13');
        await mover(p, clase, rapido); await clase.selectOption({ index: 1 }); await esperar(p, 400);
        await clicar(p, modal(p).locator('.ag-columna input[type="checkbox"]'), rapido);
        await mover(p, modal(p).locator('.ag-columna'), { pasos: 10, espera: 1100 });
      } },
    { texto: 'En «Semanal» ves tu horario, y con «Horario» lo creas a mano o lo escaneas desde una foto.',
      hacer: async p => {
        await cerrar(p); await vista(p, 'Semanal'); await esperar(p, 900);
        await clicar(p, p.locator('main button[aria-haspopup="menu"]').filter({ hasText: 'Horario' }), rapido);
        await mover(p, p.locator('main .menu-pop .menu-item').first(), { pasos: 12, espera: 1400 });
      } },
  ],
};
