/** Vídeo: distribución de aula. */
import { menu, mover, clicar, esperar, rapido } from '../lib.mjs';
import { modal, pestana, por, cerrar } from './_comun.mjs';
export default {
  id: 'distribucion-aula', titulo: 'Distribución del aula',
  escenas: [
    { texto: 'En Distribución de aula decides quién se sienta dónde y qué papel tiene cada uno.',
      hacer: async p => { await menu(p, 'En clase', rapido); await pestana(p, 'Distribución de aula', rapido); await esperar(p, 1500); } },
    { texto: 'Elige mesas cooperativas o mesas cuadradas, según cómo esté tu aula.',
      hacer: async p => { await clicar(p, por(p, 'Mesas y roles'), rapido); await esperar(p, 700); await clicar(p, p.getByRole('radio').filter({ hasText: 'Mesas cuadradas' }), rapido); await esperar(p, 900); await clicar(p, p.getByRole('radio').filter({ hasText: 'Mesas cooperativas' }), rapido); await esperar(p, 500); await cerrar(p); } },
    { texto: 'Reparte al alumnado por orden de lista, o deja que la IA proponga una distribución.',
      hacer: async p => { await clicar(p, por(p, 'Sentar por orden de lista'), rapido); await esperar(p, 800); await mover(p, por(p, 'Repartir con IA'), { pasos: 16, espera: 1000 }); } },
    { texto: 'Y asigna los roles de cada semana en «Mesas y roles».',
      hacer: async p => { await clicar(p, por(p, 'Mesas y roles'), rapido); await esperar(p, 900); await mover(p, modal(p).locator('input:not([type=number])').first(), { pasos: 14, espera: 1200 }); } },
  ],
};
