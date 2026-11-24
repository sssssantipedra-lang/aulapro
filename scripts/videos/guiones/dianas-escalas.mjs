/**
 * Vídeo: evaluar con dianas y con escalas de registro.
 *
 * Puesto al día el 23-11-2026: sin clave de la IA, «Nueva diana» se abre en «Manual», así que el vídeo escribe los
 * ítems a mano y enseña cómo se dibuja la diana (ya no dice que la IA los propone); las tarjetas tienen «Evaluar a la
 * clase», con el alumnado en una lista; y «Nueva escala» tiene «Desde un modelo», con seis escalas ya escritas, sin IA.
 */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { modal, pestana, por, cerrar } from './_comun.mjs';

/** Escribe un ítem en el último campo «Nombre del ítem» de la ventana de la diana. */
async function item(p, texto) {
  await clicar(p, modal(p).getByPlaceholder('Nombre del ítem').last(), { pasos: 8, espera: 60, despues: 120 });
  await p.keyboard.type(texto, { delay: 30 });
}

/** Toca un sector de la diana (zonas de clic invisibles, con su título «Ítem — Nivel»). */
async function sector(p, itemNombre, nivel) {
  const zona = modal(p).locator('svg path').filter({ hasText: `${itemNombre} — ${nivel}` }).first();
  await mover(p, zona, { pasos: 10, espera: 120 });
  await zona.dispatchEvent('click');
  await esperar(p, 350);
}

export default {
  id: 'dianas-escalas', titulo: 'Dianas y escalas de registro',
  escenas: [
    { texto: 'Las dianas evalúan de un vistazo: cada ítem es un sector y cada nivel, un anillo.',
      hacer: async p => {
        await menu(p, 'Evaluar', rapido);
        await pestana(p, 'Dianas', rapido);
        await esperar(p, 600);
        await mover(p, p.locator('main .card').filter({ has: p.getByRole('button', { name: 'Evaluar a la clase' }) }).first(), { pasos: 18, espera: 900 });
      } },
    { texto: 'Pulsa «Nueva diana», escribe los ítems y verás cómo se dibuja la diana al momento.',
      hacer: async p => {
        await clicar(p, por(p, 'Nueva diana'), rapido);
        await item(p, 'Escucha a los demás');
        for (const texto of ['Aporta ideas', 'Cumple su papel']) {
          await clicar(p, modal(p).getByRole('button', { name: 'Añadir ítem' }), { pasos: 8, espera: 60, despues: 150 });
          await item(p, texto);
        }
        await mover(p, modal(p).getByText('Vista previa', { exact: true }), { pasos: 14, espera: 1400 });
      } },
    { texto: 'Con «Evaluar a la clase», el alumnado sale en una lista: tocas el nivel de cada ítem y la nota se calcula sola.',
      hacer: async p => {
        await cerrar(p);
        await esperar(p, 300);
        // Cerrar sin guardar deja el aviso de borrador («Continuar» o «Descartar»): se descarta para que no se quede
        const descartar = p.locator('main').getByRole('button', { name: 'Descartar' }).first();
        if (await descartar.isVisible().catch(() => false)) await clicar(p, descartar, rapido);
        await clicar(p, p.locator('main').getByRole('button', { name: 'Evaluar a la clase' }).first(), rapido);
        await esperar(p, 600);
        await mover(p, modal(p).locator('.evc-al').first(), { pasos: 10, espera: 300 });
        for (const [it, nivel] of [['Escucha y respeta', 'Bien'], ['Aporta ideas', 'Excelente'], ['Cumple su papel', 'Bien'], ['Aprende de los errores', 'Suficiente']]) await sector(p, it, nivel);
        await mover(p, modal(p).getByText('Nota calculada', { exact: false }), { pasos: 14, espera: 900 });
      } },
    { texto: 'Las escalas de registro son más simples: un pulgar arriba o abajo. Y puedes partir de uno de sus seis modelos, sin IA.',
      hacer: async p => {
        // Lo marcado en la escena anterior no se guarda: se acepta el aviso de que se pierde
        p.once('dialog', d => d.accept().catch(() => {}));
        await cerrar(p);
        await pestana(p, 'Escalas de registro', rapido);
        await esperar(p, 500);
        await clicar(p, por(p, 'Nueva escala'), rapido);
        await clicar(p, modal(p).getByRole('button', { name: 'Desde un modelo' }), rapido);
        await mover(p, modal(p).locator('.mi-tarjeta').first(), { pasos: 16, espera: 900 });
        await mover(p, modal(p).locator('.mi-usar').first(), { pasos: 12, espera: 900 });
      } },
  ],
};
