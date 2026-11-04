/**
 * Vídeo 2: crear una rúbrica con IA y evaluar con ella. La respuesta de la IA es un ejemplo fijo (no se gasta ninguna
 * clave): la grabación la simula con una rúbrica de «Exposición oral». La voz está en audio/crear-rubrica/0N.mp3.
 */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';

const RUBRICA = {
  name: 'Resolución de problemas en equipo',
  criteria: [
    { id: 'cr1', name: 'Comprende el enunciado', competencias: ['STEM', 'CCL'], oficiales: ['1.1', '1.2'], descriptors: { 1: 'Le cuesta saber qué se pide.', 2: 'Identifica parte de los datos.', 3: 'Identifica los datos y lo que se pide.', 4: 'Identifica datos y relaciones y reformula el problema.' } },
    { id: 'cr2', name: 'Razona la estrategia', competencias: ['STEM', 'CPSAA'], oficiales: ['2.1'], descriptors: { 1: 'No plantea una estrategia.', 2: 'Plantea una estrategia con ayuda.', 3: 'Plantea una estrategia adecuada.', 4: 'Plantea una estrategia y justifica por qué funciona.' } },
    { id: 'cr3', name: 'Comunica el resultado', competencias: ['CCL', 'CD'], oficiales: ['6.1', '6.2'], descriptors: { 1: 'El resultado no se entiende.', 2: 'Da el resultado sin explicar el proceso.', 3: 'Explica el proceso y el resultado.', 4: 'Explica con claridad y usa un soporte digital.' } },
  ],
};

const modal = p => p.locator('.modal-overlay.open');

export default {
  id: 'crear-rubrica',
  titulo: 'Crear una rúbrica con IA y evaluar',
  // Antes de cargar: la «IA» responde con la rúbrica de ejemplo
  antes: async page => {
    await page.route('https://generativelanguage.googleapis.com/**', async r => {
      const rubrica = { ...RUBRICA, criteria: RUBRICA.criteria.map(({ oficiales, ...c }) => ({ ...c, criteriosOficiales: oficiales.map(o => 'Matemáticas|' + o) })) };
      await r.fulfill({
        status: 200, contentType: 'text/event-stream',
        body: 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(rubrica) }] }, finishReason: 'STOP' }] }) + '\n\n',
      });
    });
  },
  // Con la app abierta: una clave de ejemplo y el uso de la IA ya aceptado, para ir directos a lo que se enseña
  despues: async page => {
    await page.evaluate(() => {
      localStorage.setItem('aulapro_gemini_key', 'AIza' + 'x'.repeat(35));
      localStorage.setItem('aulapro_uso_ia', JSON.stringify({ v: '2026-11-04', fecha: new Date().toISOString() }));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4500);
  },
  escenas: [
    { texto: 'Vamos a crear una rúbrica con IA, a evaluar con ella y a ver cómo la nota llega al cuaderno y a las competencias.',
      hacer: async p => { await menu(p, 'Evaluar', rapido); await clicar(p, p.locator('.hub-tab', { hasText: /^Rúbricas$/ }), rapido); } },
    { texto: 'En Evaluar, abre «Rúbricas» y pulsa «Nueva rúbrica». Marca la clase, elige la categoría del cuaderno donde contará la nota, describe la actividad y pulsa «Generar rúbrica».',
      hacer: async p => {
        await clicar(p, p.getByRole('button', { name: /Nueva rúbrica/ }).first(), rapido);
        await clicar(p, modal(p).getByRole('button', { name: '1º ESO A' }), rapido);
        const cat = modal(p).locator('select').first();
        await mover(p, cat, rapido); await cat.selectOption({ label: 'Tareas' }); await esperar(p, 500);
        await clicar(p, modal(p).locator('textarea').last(), rapido);
        await p.keyboard.type('Resolución de problemas en equipo', { delay: 40 });
        await clicar(p, modal(p).getByRole('button', { name: /Generar rúbrica/ }), rapido);
        await esperar(p, 1200);
      } },
    { texto: 'La IA propone los criterios y sus niveles, y marca las competencias clave y los criterios de evaluación oficiales que se trabajan. Puedes cambiar lo que quieras: la decisión final es tuya.',
      hacer: async p => {
        await clicar(p, modal(p).getByRole('button', { name: /Aplicar y editar/ }));
        await esperar(p, 2500);
        await p.mouse.wheel(0, 380); await esperar(p, 2500);
        await p.mouse.wheel(0, 380); await esperar(p, 1500);
        await clicar(p, modal(p).getByRole('button', { name: /Crear rúbrica/ }).last(), rapido);
      } },
    { texto: 'Pulsa «Evaluar alumno», elige la clase y el alumno, y marca el nivel de cada criterio.',
      hacer: async p => {
        await esperar(p, 600);
        await clicar(p, p.locator('main').getByRole('button', { name: 'Evaluar alumno' }).first(), rapido);
        const d = modal(p);
        const selects = d.locator('select');
        await mover(p, selects.nth(0), rapido);
        await selects.nth(0).selectOption({ index: 1 });
        await esperar(p, 500);
        await selects.nth(1).selectOption({ index: 1 });
        await esperar(p, 500);
        const filas = d.locator('tbody tr');
        for (const [fila, nivel] of [[0, 3], [1, 4], [2, 2]]) await clicar(p, filas.nth(fila).locator('td').nth(nivel), rapido);
      } },
    { texto: 'Al guardar, la nota se calcula sola y pasa al cuaderno.',
      hacer: async p => { await clicar(p, modal(p).getByRole('button', { name: /Guardar evaluación/ }), rapido); await esperar(p, 800); } },
    { texto: 'En el cuaderno docente aparece la nota registrada, en la categoría que elegiste, junto al resto de notas del alumno.',
      hacer: async p => {
        await menu(p, 'Cuaderno de Notas', rapido);
        await esperar(p, 1500);
        await mover(p, p.locator('th', { hasText: 'Resolución de problemas en equipo' }), { pasos: 20, espera: 1200 });
        // La celda de «Alumno 1» justo debajo de esa columna
        const cab = await p.locator('th', { hasText: 'Resolución de problemas en equipo' }).first().boundingBox();
        const tds = p.locator('tr', { hasText: /^Alumno 1/ }).first().locator('td');
        let mejor = null, dist = 1e9;
        for (let i = 0; i < await tds.count(); i++) {
          const b = await tds.nth(i).boundingBox();
          if (b && cab && Math.abs(b.x + b.width / 2 - (cab.x + cab.width / 2)) < dist) { dist = Math.abs(b.x + b.width / 2 - (cab.x + cab.width / 2)); mejor = i; }
        }
        if (mejor !== null) await mover(p, tds.nth(mejor), { pasos: 20, espera: 1500 });
      } },
    { texto: 'Y en «Por competencias», AulaPro asigna una nota a cada competencia trabajada, a partir de los criterios de evaluación de la rúbrica.',
      hacer: async p => {
        await clicar(p, p.getByText('Por competencias', { exact: true }), rapido);
        await esperar(p, 1000);
        const fila = p.locator('tr', { hasText: /^Alumno 1/ });
        for (const c of [1, 2, 6]) await mover(p, fila.locator('td').nth(c), { pasos: 25, espera: 1100 });
      } },
    { texto: 'Así, con una sola evaluación tienes la nota del cuaderno y la de las competencias. La IA propone, y la nota la pones tú.',
      hacer: async p => { await esperar(p, 1000); } },
  ],
};
