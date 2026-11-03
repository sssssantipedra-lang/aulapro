/**
 * La adaptación curricular significativa (ACS) de Andalucía, sin React. Ver `docs/PTAL.md`, «Adaptación curricular
 * significativa (Andalucía)».
 *
 * Sigue los cuatro bloques en que la recoge Séneca: datos generales y dictamen, selección curricular del curso de
 * referencia, metodología y calificación, y seguimiento trimestral. Lo que dicen las órdenes de 30 de mayo de 2023
 * (Primaria, artículos 33 y 36; ESO, 47 y 50) se comprueba aquí y se avisa, sin impedir guardar: es para el alumnado
 * con necesidades educativas especiales, con un desfase de al menos dos cursos en el área, y la propone el informe de
 * evaluación psicopedagógica.
 */
import { competenciasDe, type CurriculumEntry } from './curriculum';
import { GRUPOS_NEAE, nuevoIdApoyo } from './apoyo';
import type {
  AcsApoyo, AlumnoApoyo, CursoDe, GradoAcs, InstrumentoAcs, SeguimientoAcs, Trimestre,
} from '../types/apoyo';

/** Las estrategias que se marcan en el bloque 3. El texto es la clave del diccionario. */
export const ESTRATEGIAS_ACS: readonly { id: string; grupo: 'metodologica' | 'organizativa'; texto: string }[] = [
  { id: 'visual', grupo: 'metodologica', texto: 'Apoyos visuales: imágenes, pictogramas y esquemas' },
  { id: 'instrucciones', grupo: 'metodologica', texto: 'Instrucciones simplificadas, de una en una' },
  { id: 'dua-representacion', grupo: 'metodologica', texto: 'Varias formas de presentar la información (DUA)' },
  { id: 'dua-expresion', grupo: 'metodologica', texto: 'Varias formas de expresar lo aprendido (DUA)' },
  { id: 'dua-implicacion', grupo: 'metodologica', texto: 'Sus intereses como punto de partida (DUA)' },
  { id: 'manipulativo', grupo: 'metodologica', texto: 'Material manipulativo y concreto' },
  { id: 'modelado', grupo: 'metodologica', texto: 'Modelado y aprendizaje sin error' },
  { id: 'tareas-cortas', grupo: 'metodologica', texto: 'Tareas cortas y secuenciadas' },
  { id: 'refuerzo', grupo: 'metodologica', texto: 'Refuerzo positivo y retroalimentación inmediata' },
  { id: 'lectura-facil', grupo: 'metodologica', texto: 'Textos en lectura fácil' },
  { id: 'digital', grupo: 'metodologica', texto: 'Recursos digitales y tecnologías de apoyo' },
  { id: 'cooperativo', grupo: 'metodologica', texto: 'Aprendizaje cooperativo y tutoría entre iguales' },
  { id: 'apoyo-aula', grupo: 'organizativa', texto: 'Apoyo de PT o AL dentro del aula' },
  { id: 'apoyo-fuera', grupo: 'organizativa', texto: 'Sesiones de apoyo fuera del aula, justificadas' },
  { id: 'ubicacion', grupo: 'organizativa', texto: 'Ubicación cerca del docente y lejos de distracciones' },
  { id: 'tiempo', grupo: 'organizativa', texto: 'Más tiempo para las tareas y las pruebas' },
  { id: 'anticipacion', grupo: 'organizativa', texto: 'Anticipación de las rutinas y agenda visual' },
  { id: 'agrupamientos', grupo: 'organizativa', texto: 'Agrupamientos flexibles' },
  { id: 'coordinacion', grupo: 'organizativa', texto: 'Coordinación periódica con el tutor o la tutora' },
];

/** Los instrumentos con los que empieza una ACS: más peso a la observación y pruebas adaptadas. Se cambian. */
export const INSTRUMENTOS_INICIALES: readonly Omit<InstrumentoAcs, 'id'>[] = [
  { nombre: 'Observación directa', peso: 40 },
  { nombre: 'Tareas y producciones del cuaderno', peso: 30 },
  { nombre: 'Pruebas adaptadas: orales, con menos ejercicios y más tiempo', peso: 30 },
];

export const GRADOS_ACS: readonly { id: GradoAcs; texto: string }[] = [
  { id: 'no-iniciado', texto: 'No iniciado' },
  { id: 'proceso', texto: 'En proceso' },
  { id: 'conseguido', texto: 'Conseguido' },
];

/** El curso como número seguido de la enseñanza básica: 1º de Primaria es 1 y 1º de ESO, 7. */
export const ordinalCurso = (c: CursoDe): number => (c.etapa === 'primaria' ? c.curso : 6 + c.curso);

/** Cuántos cursos hay entre el que tiene matriculado y el de referencia; sin matrícula, `null`. */
export function desfaseCursos(matricula: CursoDe | undefined, nivel: CursoDe): number | null {
  return matricula ? ordinalCurso(matricula) - ordinalCurso(nivel) : null;
}

/** Si tiene marcada alguna necesidad educativa especial (las del primer grupo de la lista). */
export function tieneNee(alumno: AlumnoApoyo): boolean {
  const nee = GRUPOS_NEAE[0].categorias;
  return alumno.categorias.some(c => nee.includes(c));
}

/** `t` traduce los instrumentos de partida al idioma de la app: se guardan ya escritos, como los escribiría el docente. */
export function nuevaAcs(
  alumno: AlumnoApoyo, area: string, nivel: CursoDe, hoy: string, t: (k: string) => string = k => k, idNuevo = nuevoIdApoyo,
): AcsApoyo {
  return {
    id: idNuevo('acs'), alumnoId: alumno.id,
    // La fecha del informe la escribe el docente: la de `alumno.informe` es cuándo se leyó en la app, no la del informe
    fechaInforme: '', nivel, justificacion: '',
    responsables: { tutor: '', especialista: '', materia: '' },
    area, materiaAula: '', competencias: [], criterios: [], saberes: [],
    estrategias: [], otrasEstrategias: '',
    instrumentos: INSTRUMENTOS_INICIALES.map(i => ({ ...i, nombre: t(i.nombre), id: idNuevo('ins') })),
    calificacion: '', seguimiento: [], ajustes: {}, fecha: hoy,
  };
}

/** Lo que conviene revisar, con su texto (clave del diccionario) y sus variables. No impide guardar. */
export interface AvisoAcs { texto: string; vars?: Record<string, string | number> }

export function avisosAcs(acs: AcsApoyo, alumno: AlumnoApoyo): AvisoAcs[] {
  const avisos: AvisoAcs[] = [];
  if (!tieneNee(alumno)) {
    avisos.push({ texto: 'La ACS es para el alumnado con necesidades educativas especiales, y este alumno no tiene ninguna marcada en «Datos». Para el resto hay programas de refuerzo del aprendizaje.' });
  }
  const desfase = desfaseCursos(alumno.matricula, acs.nivel);
  if (desfase === null) {
    avisos.push({ texto: 'Indica en «Datos» el curso en que está matriculado, para comprobar el desfase.' });
  } else if (desfase < 2) {
    avisos.push({ texto: 'La ACS pide un desfase de al menos dos cursos entre el curso de referencia y el curso en que está matriculado, y aquí es de {n}.', vars: { n: desfase } });
  }
  if (!acs.fechaInforme) avisos.push({ texto: 'Falta la fecha del informe de evaluación psicopedagógica, que es el que propone la medida.' });
  if (acs.criterios.length === 0) avisos.push({ texto: 'Elige al menos un criterio de evaluación: son los que sirven para calificar.' });
  const suma = acs.instrumentos.reduce((s, i) => s + (Number.isFinite(i.peso) ? i.peso : 0), 0);
  if (acs.instrumentos.length && suma !== 100) avisos.push({ texto: 'Los pesos de los instrumentos suman {n} %, no 100 %.', vars: { n: suma } });
  return avisos;
}

/* ── Selección curricular ── */

/** Marca o quita un criterio. Al marcarlo se marca también su competencia específica. */
export function alternarCriterio(acs: AcsApoyo, entry: CurriculumEntry, grupo: string, codigo: string): AcsApoyo {
  if (acs.criterios.includes(codigo)) return { ...acs, criterios: acs.criterios.filter(c => c !== codigo) };
  const cr = (entry.criterios[grupo] ?? []).find(c => c.codigo === codigo);
  if (!cr) return acs;
  return {
    ...acs, criterios: ordenarCriterios([...acs.criterios, codigo], entry, grupo),
    competencias: acs.competencias.includes(cr.competencia) ? acs.competencias : [...acs.competencias, cr.competencia].sort((a, b) => a - b),
  };
}

/** Marca o quita una competencia específica. Al quitarla se quitan sus criterios. */
export function alternarCompetencia(acs: AcsApoyo, entry: CurriculumEntry, grupo: string, n: number): AcsApoyo {
  if (!acs.competencias.includes(n)) return { ...acs, competencias: [...acs.competencias, n].sort((a, b) => a - b) };
  const suyos = new Set((entry.criterios[grupo] ?? []).filter(c => c.competencia === n).map(c => c.codigo));
  return { ...acs, competencias: acs.competencias.filter(x => x !== n), criterios: acs.criterios.filter(c => !suyos.has(c)) };
}

export function alternarSaber(acs: AcsApoyo, entry: CurriculumEntry, grupo: string, bloque: string): AcsApoyo {
  if (acs.saberes.includes(bloque)) return { ...acs, saberes: acs.saberes.filter(b => b !== bloque) };
  const orden = (entry.saberes[grupo] ?? []).map(b => b.bloque);
  return { ...acs, saberes: [...acs.saberes, bloque].sort((a, b) => orden.indexOf(a) - orden.indexOf(b)) };
}

function ordenarCriterios(codigos: string[], entry: CurriculumEntry, grupo: string): string[] {
  const orden = (entry.criterios[grupo] ?? []).map(c => c.codigo);
  return [...new Set(codigos)].sort((a, b) => orden.indexOf(a) - orden.indexOf(b));
}

/**
 * Lo elegido que existe en el currículo del curso de referencia, en su orden. Al cambiar de curso o de área, lo que
 * ya no está se cae (y su seguimiento se conserva, por si se vuelve atrás).
 */
export function seleccionValida(acs: AcsApoyo, entry: CurriculumEntry | undefined, grupo: string): AcsApoyo {
  if (!entry) return { ...acs, competencias: [], criterios: [], saberes: [] };
  const comps = new Set(competenciasDe(entry, grupo).map(c => c.n));
  const crits = new Set((entry.criterios[grupo] ?? []).map(c => c.codigo));
  const bloques = (entry.saberes[grupo] ?? []).map(b => b.bloque);
  return {
    ...acs,
    competencias: acs.competencias.filter(n => comps.has(n)),
    criterios: ordenarCriterios(acs.criterios.filter(c => crits.has(c)), entry, grupo),
    saberes: acs.saberes.filter(b => bloques.includes(b)).sort((a, b) => bloques.indexOf(a) - bloques.indexOf(b)),
  };
}

/* ── Seguimiento ── */

/** Las filas de un trimestre: cada criterio elegido y, después, cada bloque de saberes, con lo ya anotado. */
export function filasSeguimiento(acs: AcsApoyo, trimestre: Trimestre): SeguimientoAcs[] {
  const de = (tipo: SeguimientoAcs['tipo'], clave: string): SeguimientoAcs =>
    acs.seguimiento.find(s => s.trimestre === trimestre && s.tipo === tipo && s.clave === clave)
      ?? { trimestre, tipo, clave, observaciones: '' };
  return [...acs.criterios.map(c => de('criterio', c)), ...acs.saberes.map(b => de('saber', b))];
}

/** Guarda una fila del seguimiento; una fila vacía no se guarda. */
export function conFila(acs: AcsApoyo, fila: SeguimientoAcs): AcsApoyo {
  const resto = acs.seguimiento.filter(s => !(s.trimestre === fila.trimestre && s.tipo === fila.tipo && s.clave === fila.clave));
  const vacia = !fila.grado && !fila.observaciones.trim();
  return { ...acs, seguimiento: vacia ? resto : [...resto, fila] };
}

/** Cuántas filas del trimestre tienen grado anotado, para la lista. */
export function progresoTrimestre(acs: AcsApoyo, trimestre: Trimestre): { hechas: number; total: number } {
  const filas = filasSeguimiento(acs, trimestre);
  return { hechas: filas.filter(f => f.grado).length, total: filas.length };
}

/* ── Carga segura ── */

const esTexto = (v: unknown): v is string => typeof v === 'string';
const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const textos = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter(esTexto).map(x => x.trim()).filter(Boolean))] : [];
const trimestre = (v: unknown): Trimestre | null => (v === 1 || v === 2 || v === 3 ? v : null);

/** Una ACS tal como llega del disco o de una copia; `null` si no se entiende o su alumno no existe. */
export function normalizarAcs(v: unknown, alumnos: ReadonlySet<string>, curso: (v: unknown) => CursoDe | undefined): AcsApoyo | null {
  const x = obj(v);
  if (!x || !esTexto(x.id) || !esTexto(x.alumnoId) || !alumnos.has(x.alumnoId) || !esTexto(x.area) || !x.area.trim()) return null;
  const nivel = curso(x.nivel);
  if (!nivel) return null;
  const r = obj(x.responsables) ?? {};
  const grados = GRADOS_ACS.map(g => g.id);
  const ajustes: AcsApoyo['ajustes'] = {};
  Object.entries(obj(x.ajustes) ?? {}).forEach(([k, val]) => {
    const t = trimestre(Number(k));
    if (t && esTexto(val) && val.trim()) ajustes[t] = val;
  });
  return {
    id: x.id, alumnoId: x.alumnoId,
    fechaInforme: esTexto(x.fechaInforme) && /^\d{4}-\d{2}-\d{2}$/.test(x.fechaInforme) ? x.fechaInforme : '',
    nivel, justificacion: esTexto(x.justificacion) ? x.justificacion : '',
    responsables: {
      tutor: esTexto(r.tutor) ? r.tutor : '', especialista: esTexto(r.especialista) ? r.especialista : '',
      materia: esTexto(r.materia) ? r.materia : '',
    },
    area: x.area, materiaAula: esTexto(x.materiaAula) ? x.materiaAula : '',
    competencias: Array.isArray(x.competencias)
      ? [...new Set(x.competencias.filter((n): n is number => Number.isInteger(n) && (n as number) > 0))].sort((a, b) => a - b)
      : [],
    criterios: textos(x.criterios), saberes: textos(x.saberes),
    estrategias: textos(x.estrategias).filter(id => ESTRATEGIAS_ACS.some(e => e.id === id)),
    otrasEstrategias: esTexto(x.otrasEstrategias) ? x.otrasEstrategias : '',
    instrumentos: (Array.isArray(x.instrumentos) ? x.instrumentos : []).flatMap(i => {
      const y = obj(i);
      const peso = Number(y?.peso);
      return y && esTexto(y.id) && esTexto(y.nombre)
        ? [{ id: y.id, nombre: y.nombre, peso: Number.isFinite(peso) ? Math.min(100, Math.max(0, Math.round(peso))) : 0 }]
        : [];
    }),
    calificacion: esTexto(x.calificacion) ? x.calificacion : '',
    seguimiento: (Array.isArray(x.seguimiento) ? x.seguimiento : []).flatMap(s => {
      const y = obj(s);
      const t = trimestre(y?.trimestre);
      if (!y || !t || (y.tipo !== 'criterio' && y.tipo !== 'saber') || !esTexto(y.clave) || !y.clave.trim()) return [];
      const grado = grados.includes(y.grado as GradoAcs) ? y.grado as GradoAcs : undefined;
      const observaciones = esTexto(y.observaciones) ? y.observaciones : '';
      return grado || observaciones.trim() ? [{ trimestre: t, tipo: y.tipo, clave: y.clave, ...(grado ? { grado } : {}), observaciones }] : [];
    }),
    ajustes, fecha: esTexto(x.fecha) ? x.fecha : '',
  };
}
