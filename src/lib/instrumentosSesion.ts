/**
 * Los instrumentos de evaluación de una sesión de Educación Física (19-10-2026):
 * a qué rúbrica, diana o escala de registro apunta cada uno y cómo se llama.
 * Ver `components/ef/SesionEvaluacionCircuito.tsx`.
 */
import type { EvalDiana, Rubric } from '../types';
import type { InstrumentoRefEF } from '../types/ef';
import { esRegistro } from './registro';


/** Qué es un instrumento de los de la lista de dianas. */
export const tipoDe = (d: EvalDiana): InstrumentoRefEF['tipo'] => (esRegistro(d) ? 'registro' : 'diana');

/** Lo que hay que enseñar de un instrumento adjunto: su nombre, qué es y a qué pantalla lleva. Sin él (se borró), `null`. */
export function describirInstrumento(r: InstrumentoRefEF, rubrics: Rubric[], dianas: EvalDiana[]): { nombre: string; tipo: InstrumentoRefEF['tipo']; conceptos: string[] } | null {
  if (r.tipo === 'rubrica') {
    const x = rubrics.find(y => y.id === r.id);
    return x ? { nombre: x.name, tipo: 'rubrica', conceptos: x.criteria.map(c => c.name) } : null;
  }
  const d = dianas.find(y => y.id === r.id);
  return d ? { nombre: d.name, tipo: tipoDe(d), conceptos: d.items.map(i => i.name) } : null;
}

export const ETIQUETA_INSTRUMENTO: Record<InstrumentoRefEF['tipo'], string> = {
  rubrica: 'Rúbrica', diana: 'Diana', registro: 'Escala de registro',
};

