/**
 * Vídeo 2: crear una rúbrica con IA y evaluar con ella. La respuesta de la IA es un ejemplo fijo (no se gasta ninguna
 * clave): la grabación la simula con una rúbrica de «Exposición oral». La voz está en audio/crear-rubrica/0N.mp3.
 */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';

const RUBRICA = {
  name: 'Exposición oral sobre el medioambiente',
  criteria: [
    { id: 'cr1', name: 'Claridad expositiva', competencias: ['CCL'], descriptors: { 1: 'Se le entiende con dificultad.', 2: 'Se le entiende en parte y a veces pierde el hilo.', 3: 'Explica con claridad y orden.', 4: 'Explica con claridad, orden y recursos propios.' } },
    { id: 'cr2', name: 'Dominio del contenido', competencias: ['STEM'], descriptors: { 1: 'Conoce muy pocos datos.', 2: 'Conoce lo básico del tema.', 3: 'Domina el tema y responde preguntas.', 4: 'Domina el tema y relaciona ideas.' } },
    { id: 'cr3', name: 'Material de apoyo', competencias: ['CD'], descriptors: { 1: 'No usa material de apoyo.', 2: 'Usa un material poco cuidado.', 3: 'Usa un material correcto.', 4: 'Usa un material cuidado y original.' } },
  ],
};

const modal = p => p.locator('.modal-overlay.open');

export default {
  id: 'crear-rubrica',
  titulo: 'Crear una rúbrica con IA y evaluar',
  // Antes de cargar: la «IA» responde con la rúbrica de ejemplo
  antes: async page => {
    await page.route('https://generativelanguage.googleapis.com/**', r => r.fulfill({
      status: 200, contentType: 'text/event-stream',
      body: 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(RUBRICA) }] }, finishReason: 'STOP' }] }) + '\n\n',
    }));
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
    { texto: 'Vamos a crear una rúbrica con IA y a evaluar con ella.',
      hacer: async p => { await menu(p, 'Evaluar', rapido); await clicar(p, p.locator('.hub-tab', { hasText: /^Rúbricas$/ }), rapido); } },
    { texto: 'En Evaluar, abre «Rúbricas» y pulsa «Nueva rúbrica». Marca la clase, describe la actividad y pulsa «Generar rúbrica».',
      hacer: async p => {
        await clicar(p, p.getByRole('button', { name: /Nueva rúbrica/ }).first(), rapido);
        await clicar(p, modal(p).getByRole('button', { name: '4º Primaria A' }), rapido);
        await clicar(p, modal(p).locator('textarea').last(), rapido);
        await p.keyboard.type('Exposición oral sobre el medioambiente', { delay: 45 });
        await clicar(p, modal(p).getByRole('button', { name: /Generar rúbrica/ }), rapido);
        await esperar(p, 1200);
      } },
    { texto: 'La IA propone criterios y niveles, pero la decisión final es tuya: puedes cambiar lo que quieras antes de crearla.',
      hacer: async p => {
        await clicar(p, modal(p).getByRole('button', { name: /Aplicar y editar/ }));
        await esperar(p, 1800);
        await p.mouse.wheel(0, 500); await esperar(p, 1500);
        await clicar(p, modal(p).getByRole('button', { name: /Crear rúbrica/ }).last(), rapido);
      } },
    { texto: 'Pulsa «Evaluar alumno», elige la clase y el alumno, y marca el nivel de cada criterio.',
      hacer: async p => {
        await esperar(p, 600);
        await clicar(p, p.locator('main').getByRole('button', { name: 'Evaluar alumno' }).first(), rapido);
        const d = modal(p);
        const selects = d.locator('select');
        await mover(p, selects.nth(0), rapido);
        await selects.nth(0).selectOption({ label: '4º Primaria A – Valenciano' }).catch(async () => { await selects.nth(0).selectOption({ index: 1 }); });
        await esperar(p, 500);
        await selects.nth(1).selectOption({ index: 2 });
        await esperar(p, 500);
        const filas = d.locator('tbody tr');
        for (const [fila, nivel] of [[0, 3], [1, 4], [2, 2]]) await clicar(p, filas.nth(fila).locator('td').nth(nivel), rapido);
      } },
    { texto: 'Guarda la evaluación: la nota se calcula sola y pasa al cuaderno.',
      hacer: async p => { await clicar(p, modal(p).getByRole('button', { name: /Guardar evaluación/ }), rapido); await esperar(p, 800); } },
  ],
};
