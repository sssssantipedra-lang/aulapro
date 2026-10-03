/**
 * Los criterios de evaluación oficiales de una clase, para que la IA los elija
 * al crear una rúbrica o una diana (decisión del dueño, 3-10-2026: que vengan
 * puestos por la IA según la actividad y las asignaturas de la clase, y que el
 * docente pueda cambiarlos). La IA solo elige de esta lista cerrada, con la
 * forma «Materia|código», y `refsDesdeIA` descarta lo que no esté en ella.
 */
import { competenciasDe, type CurriculumEntry } from './index';
import type { OfficialCriterionRef } from '../../types';

export interface MateriaDeClase {
  /** Cómo llama el docente a la asignatura en su clase. */
  asignatura: string;
  entry: CurriculumEntry;
  grupo: string;
}

/** La lista para el prompt, con las competencias como títulos, y los códigos que se aceptan. */
export function catalogoCriterios(materias: MateriaDeClase[]): { texto: string; disponibles: string[] } {
  const disponibles: string[] = [];
  const lineas: string[] = [];
  for (const { entry, grupo } of materias) {
    lineas.push(`${entry.nombre}:`);
    for (const c of competenciasDe(entry, grupo)) {
      const criterios = (entry.criterios[grupo] ?? []).filter(cr => cr.competencia === c.n);
      if (criterios.length === 0) continue;
      lineas.push(`  CE${c.n}. ${c.texto}`);
      for (const cr of criterios) {
        const clave = `${entry.nombre}|${cr.codigo}`;
        disponibles.push(clave);
        lineas.push(`    - ${clave}: ${cr.texto}`);
      }
    }
  }
  return { texto: lineas.join('\n'), disponibles };
}

/** Las instrucciones para la IA, con la lista. Vacío si la clase no tiene materias oficiales. */
export function promptCriteriosOficiales(
  materias: MateriaDeClase[], lang: 'es' | 'en' | 'ca', que: 'criterion' | 'item', asignaturaDeLaNota?: string,
): string {
  const { texto, disponibles } = catalogoCriterios(materias);
  if (disponibles.length === 0) return '';
  if (lang === 'en') {
    return `\n\nOFFICIAL CRITERIA: for each ${que}, in "criteriosOficiales", put 1 to 3 official assessment ` +
      `criteria from the closed list below (at least 1), the ones it truly assesses given the activity, ` +
      `written exactly as listed ("Subject|code").` +
      (asignaturaDeLaNota ? ` The grade goes to ${asignaturaDeLaNota}: prefer its criteria, and add criteria ` +
        `of other subjects only if the activity really works on them.` : '') +
      `\n${texto}`;
  }
  return `\n\nCRITERIOS OFICIALES: en cada ${que === 'criterion' ? 'criterio' : 'ítem'}, en "criteriosOficiales", ` +
    `pon de 1 a 3 criterios de evaluación oficiales de esta lista cerrada (al menos 1), los que de verdad ` +
    `evalúe según la actividad, escritos tal cual («Materia|código»).` +
    (asignaturaDeLaNota ? ` La nota va a ${asignaturaDeLaNota}: prioriza sus criterios, y añade de otras ` +
      `asignaturas solo si la actividad las trabaja de verdad.` : '') +
    `\n${texto}`;
}

/** De lo que devuelve la IA a criterios oficiales, sin dejar pasar ninguno que no sea de la clase. */
export function refsDesdeIA(materias: MateriaDeClase[], marcados: unknown): OfficialCriterionRef[] {
  if (!Array.isArray(marcados)) return [];
  const out: OfficialCriterionRef[] = [];
  for (const m of marcados) {
    if (typeof m !== 'string') continue;
    const corte = m.lastIndexOf('|');
    const nombre = m.slice(0, corte).trim();
    const codigo = m.slice(corte + 1).trim();
    const materia = materias.find(x => x.entry.nombre === nombre);
    if (!materia || !(materia.entry.criterios[materia.grupo] ?? []).some(c => c.codigo === codigo)) continue;
    if (!out.some(r => r.materia === materia.entry.id && r.codigo === codigo)) out.push({ materia: materia.entry.id, codigo });
  }
  return out;
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface CriterioEncontrado {
  ref: OfficialCriterionRef;
  materia: string;
  competencia: { n: number; texto: string };
  texto: string;
}

/**
 * Buscar un criterio para añadirlo a mano: por código («2.1»), por asignatura o
 * por palabras del criterio o de su competencia. Todas las palabras tienen que
 * estar. Sin nada escrito, nada: la lista entera es demasiado larga.
 */
export function buscarCriterios(materias: MateriaDeClase[], consulta: string, max = 8): CriterioEncontrado[] {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (palabras.length === 0 || (palabras.length === 1 && palabras[0].length < 2)) return [];
  const out: CriterioEncontrado[] = [];
  for (const { entry, grupo } of materias) {
    const competencias = competenciasDe(entry, grupo);
    for (const cr of entry.criterios[grupo] ?? []) {
      const ce = competencias.find(c => c.n === cr.competencia);
      const pajar = normalizar(`${entry.nombre} ${cr.codigo} ${cr.texto} ${ce?.texto ?? ''}`);
      if (palabras.every(p => (/^\d+(\.\d+)?$/.test(p) ? cr.codigo === p || cr.codigo.startsWith(`${p}.`) : pajar.includes(p)))) {
        out.push({
          ref: { materia: entry.id, codigo: cr.codigo }, materia: entry.nombre,
          competencia: { n: cr.competencia, texto: ce?.texto ?? '' }, texto: cr.texto,
        });
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}

/** Los datos de un criterio ya marcado, para mostrarlo con su asignatura y su competencia. */
export function describirCriterio(materias: MateriaDeClase[], ref: OfficialCriterionRef): CriterioEncontrado | null {
  const m = materias.find(x => x.entry.id === ref.materia);
  const cr = m?.entry.criterios[m.grupo]?.find(c => c.codigo === ref.codigo);
  if (!m || !cr) return null;
  const ce = competenciasDe(m.entry, m.grupo).find(c => c.n === cr.competencia);
  return { ref, materia: m.entry.nombre, competencia: { n: cr.competencia, texto: ce?.texto ?? '' }, texto: cr.texto };
}

/** Las competencias específicas que trabaja un instrumento, por los criterios que marca, sin repetir. */
export function competenciasDelInstrumento(
  materias: MateriaDeClase[], refs: OfficialCriterionRef[],
): { materia: string; n: number; texto: string }[] {
  const out: { materia: string; n: number; texto: string }[] = [];
  for (const ref of refs) {
    const d = describirCriterio(materias, ref);
    if (d && !out.some(c => c.materia === d.materia && c.n === d.competencia.n)) {
      out.push({ materia: d.materia, n: d.competencia.n, texto: d.competencia.texto });
    }
  }
  const orden = (nombre: string) => materias.findIndex(m => m.entry.nombre === nombre);
  return out.sort((a, b) => orden(a.materia) - orden(b.materia) || a.n - b.n);
}
