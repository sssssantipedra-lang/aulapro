/**
 * Un instrumento de evaluación como archivo (20-11-2026): «Guardar como archivo» y «Abrir archivo» de una rúbrica,
 * una diana o una escala de registro, para pasarla a un compañero o guardarla de un curso a otro sin compartir
 * clases. «Trabajo compartido» (`services/paquete.ts`) solo manda los instrumentos junto con su clase.
 *
 * En el archivo va el instrumento y nada más: nombre, niveles de logro y criterios (o ítems, o conceptos) con sus
 * descriptores, sus competencias clave y sus criterios oficiales. **No lleva alumnado, clases, cuaderno ni
 * evaluaciones**, ni el «contexto» que el docente escribió para la IA (texto libre que puede hablar de un grupo).
 * Es un JSON sin cifrar, porque no hay nada que proteger; no pasa por ningún servidor.
 *
 * Al abrirlo se comprueba la forma entera y se rehacen los identificadores: un archivo de fuera no puede traer
 * campos que la app no espere, ni pisar un instrumento que ya exista. Lo abierto no se guarda solo: rellena el
 * editor de siempre y el docente elige sus clases antes de guardar.
 */
import type { AchievementLevel, DianaItem, EvalDiana, OfficialCriterionRef, Rubric, RubricCriterion } from '../types';
import { competenciasClaveValidas } from './utils';
import { NIVELES_REGISTRO, esRegistro } from './registro';

export type TipoDeInstrumento = 'rubrica' | 'diana' | 'registro';

export const FORMATO_INSTRUMENTO = 'aulapro-instrumento';
export const VERSION_INSTRUMENTO = 1;

interface ParteDeArchivo {
  name: string;
  /** Solo en dianas y escalas. */
  weight?: number;
  descriptors?: Record<string, string>;
  competencies?: string[];
  officialCriteria?: OfficialCriterionRef[];
}

export interface ArchivoDeInstrumento {
  formato: typeof FORMATO_INSTRUMENTO;
  version: number;
  tipo: TipoDeInstrumento;
  name: string;
  levels?: AchievementLevel[];
  partes: ParteDeArchivo[];
}

/* Topes al abrir: un archivo de fuera no puede meter en el perfil algo desmesurado */
const MAX_PARTES = 40;
const MAX_NIVELES = 8;
const MAX_NOMBRE = 200;
const MAX_DESCRIPTOR = 1500;
/** Tamaño máximo del archivo que se intenta leer (bytes). Una rúbrica grande no llega a 30 KB. */
export const MAX_BYTES_INSTRUMENTO = 512 * 1024;

const limpio = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function parteDe(p: { name: string; descriptors?: Record<number, string>; competencies?: string[]; officialCriteria?: OfficialCriterionRef[] }, peso?: number): ParteDeArchivo {
  const parte: ParteDeArchivo = { name: p.name };
  if (peso !== undefined && peso !== 1) parte.weight = peso;
  if (p.descriptors && Object.keys(p.descriptors).length) parte.descriptors = { ...p.descriptors };
  if (p.competencies?.length) parte.competencies = [...p.competencies];
  if (p.officialCriteria?.length) parte.officialCriteria = p.officialCriteria.map(c => ({ materia: c.materia, codigo: c.codigo }));
  return parte;
}

/** Lo que se guarda de una rúbrica: sin clases, sin cuaderno, sin contexto y sin identificadores. */
export function archivoDeRubrica(r: Rubric): ArchivoDeInstrumento {
  return {
    formato: FORMATO_INSTRUMENTO, version: VERSION_INSTRUMENTO, tipo: 'rubrica', name: r.name,
    ...(r.levels?.length ? { levels: r.levels.map(l => ({ value: l.value, label: l.label })) } : {}),
    partes: r.criteria.map(c => parteDe(c)),
  };
}

/** Lo que se guarda de una diana o de una escala de registro (que es una diana con `tipo: 'registro'`). */
export function archivoDeDiana(d: EvalDiana): ArchivoDeInstrumento {
  const registro = esRegistro(d);
  return {
    formato: FORMATO_INSTRUMENTO, version: VERSION_INSTRUMENTO, tipo: registro ? 'registro' : 'diana', name: d.name,
    // Los niveles de una escala son siempre los dos pulgares: no se guardan
    ...(!registro && d.levels?.length ? { levels: d.levels.map(l => ({ value: l.value, label: l.label })) } : {}),
    partes: d.items.map(i => parteDe(i, i.weight)),
  };
}

const PREFIJO: Record<TipoDeInstrumento, string> = { rubrica: 'rubrica', diana: 'diana', registro: 'escala' };

/** `aulapro-rubrica-exposicion-oral.json`: sin tildes ni signos, para que viaje bien por correo y entre sistemas. */
export function nombreDeArchivoDeInstrumento(nombre: string, tipo: TipoDeInstrumento): string {
  const base = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `aulapro-${PREFIJO[tipo]}${base ? `-${base}` : ''}.json`;
}

export type MotivoDeRechazo =
  /** No es un JSON: otro tipo de archivo, o uno estropeado. */
  | 'ilegible'
  /** Es un JSON, pero no un instrumento de AulaPro (por ejemplo, una copia de datos o un paquete de «Trabajo compartido»). */
  | 'no-es-instrumento'
  /** Lo guardó una versión de AulaPro posterior a esta. */
  | 'version-posterior'
  /** No trae nombre o no trae ningún criterio con nombre. */
  | 'vacio';

export type InstrumentoLeido =
  | { ok: true; tipo: 'rubrica'; rubrica: Pick<Rubric, 'name' | 'criteria' | 'levels'> }
  | { ok: true; tipo: 'diana' | 'registro'; diana: Pick<EvalDiana, 'name' | 'items' | 'levels' | 'tipo'> }
  | { ok: false; motivo: MotivoDeRechazo };

function nivelesDe(v: unknown): AchievementLevel[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const vistos = new Set<number>();
  const niveles: AchievementLevel[] = [];
  for (const n of v) {
    const value: unknown = (n as AchievementLevel | null)?.value;
    const label = limpio((n as AchievementLevel | null)?.label, 60);
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 99 || vistos.has(value) || !label) continue;
    vistos.add(value);
    niveles.push({ value, label });
  }
  niveles.sort((a, b) => a.value - b.value);
  return niveles.length >= 2 && niveles.length <= MAX_NIVELES ? niveles : undefined;
}

function descriptoresDe(v: unknown, valores: ReadonlySet<number> | null): Record<number, string> {
  const out: Record<number, string> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, texto] of Object.entries(v as Record<string, unknown>)) {
    const n = Number(k);
    // Solo los niveles del instrumento (o, con los cuatro de partida, del 1 al 4): un descriptor de un nivel que no existe no se ve en ningún sitio
    if (!Number.isInteger(n) || (valores ? !valores.has(n) : n < 1 || n > 4)) continue;
    const d = limpio(texto, MAX_DESCRIPTOR);
    if (d) out[n] = d;
  }
  return out;
}

function oficialesDe(v: unknown): OfficialCriterionRef[] {
  if (!Array.isArray(v)) return [];
  const vistos = new Set<string>();
  const out: OfficialCriterionRef[] = [];
  for (const c of v.slice(0, 60)) {
    const materia = limpio((c as OfficialCriterionRef | null)?.materia, 80);
    const codigo = limpio((c as OfficialCriterionRef | null)?.codigo, 20);
    if (!materia || !codigo || vistos.has(`${materia}|${codigo}`)) continue;
    vistos.add(`${materia}|${codigo}`);
    out.push({ materia, codigo });
  }
  return out;
}

/**
 * Lee el texto de un archivo de instrumento. Devuelve el instrumento sin clases y con identificadores nuevos
 * (`nuevoId`), o por qué no se puede abrir. Nunca lanza.
 */
export function leerArchivoDeInstrumento(texto: string, nuevoId: () => string): InstrumentoLeido {
  let datos: unknown;
  try { datos = JSON.parse(texto); } catch { return { ok: false, motivo: 'ilegible' }; }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return { ok: false, motivo: 'no-es-instrumento' };
  const a = datos as Partial<ArchivoDeInstrumento>;
  if (a.formato !== FORMATO_INSTRUMENTO || !['rubrica', 'diana', 'registro'].includes(a.tipo as string) || !Array.isArray(a.partes)) {
    return { ok: false, motivo: 'no-es-instrumento' };
  }
  if (typeof a.version !== 'number' || a.version > VERSION_INSTRUMENTO) return { ok: false, motivo: 'version-posterior' };

  const tipo = a.tipo as TipoDeInstrumento;
  const name = limpio(a.name, MAX_NOMBRE);
  const levels = tipo === 'registro' ? undefined : nivelesDe(a.levels);
  const valores = levels ? new Set(levels.map(l => l.value)) : null;

  const partes = a.partes.slice(0, MAX_PARTES).flatMap(p => {
    const nombre = limpio((p as ParteDeArchivo | null)?.name, MAX_NOMBRE);
    if (!nombre) return [];
    const parte = p as ParteDeArchivo;
    const competencies = competenciasClaveValidas(parte.competencies);
    const officialCriteria = oficialesDe(parte.officialCriteria);
    const peso = typeof parte.weight === 'number' && parte.weight > 0 && parte.weight <= 10 ? parte.weight : 1;
    return [{
      name: nombre, peso,
      descriptors: tipo === 'registro' ? {} : descriptoresDe(parte.descriptors, valores),
      ...(competencies.length ? { competencies } : {}),
      ...(officialCriteria.length ? { officialCriteria } : {}),
    }];
  });
  if (!name || partes.length === 0) return { ok: false, motivo: 'vacio' };

  if (tipo === 'rubrica') {
    const criteria: RubricCriterion[] = partes.map(p => ({
      id: nuevoId(), name: p.name, descriptors: p.descriptors,
      ...(p.competencies ? { competencies: p.competencies } : {}),
      ...(p.officialCriteria ? { officialCriteria: p.officialCriteria } : {}),
    }));
    return { ok: true, tipo, rubrica: { name, criteria, ...(levels ? { levels } : {}) } };
  }
  const items: DianaItem[] = partes.map(({ peso, descriptors, ...p }) => ({
    id: nuevoId(), name: p.name, weight: peso,
    ...(Object.keys(descriptors).length ? { descriptors } : {}),
    ...(p.competencies ? { competencies: p.competencies } : {}),
    ...(p.officialCriteria ? { officialCriteria: p.officialCriteria } : {}),
  }));
  if (tipo === 'registro') return { ok: true, tipo, diana: { name, items, tipo: 'registro', levels: NIVELES_REGISTRO } };
  return { ok: true, tipo, diana: { name, items, ...(levels ? { levels } : {}) } };
}
