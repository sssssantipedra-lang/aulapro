/**
 * Lógica de Educación Física, sin React. Ver `docs/EF.md`.
 */
import type { Class } from '../types';
import { esAsignaturaEF } from '../services/classMarks';
import type {
  ActividadEF, BaremoEF, CategoriaPrueba, CircuitoEF, EfData, ExentoEF, InstalacionEF, LimitacionEF, MarcaPrueba,
  MaterialEF, PruebaFisica, SesionEF, SexoEF, TipoActividadEF, TramoBaremo,
} from '../types/ef';

export const EF_VACIO: EfData = {
  exentos: [], niveles: {}, sexos: {}, separar: [], pruebas: [], marcas: [], baremos: [],
  actividades: [], sesiones: [], material: [], instalaciones: [], circuitos: [],
};

export function nuevoIdEF(prefijo: string): string {
  return prefijo + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** La asignatura de EF de una clase: la que se llame así, o la principal. */
export function asignaturaEF(c: Pick<Class, 'subjects' | 'subject'>): string {
  return c.subjects.find(esAsignaturaEF) ?? c.subjects[0] ?? c.subject;
}

/* ── Exentos y lesiones ── */

/** Lo que no puede hacer, en palabras que entiende cualquiera (y la IA). */
export const LIMITACIONES: readonly { id: LimitacionEF; label: string }[] = [
  { id: 'correr', label: 'No puede correr' },
  { id: 'saltar', label: 'No puede saltar' },
  { id: 'impacto', label: 'Sin impactos ni golpes' },
  { id: 'contacto', label: 'Sin contacto con otros' },
  { id: 'brazos', label: 'No puede usar un brazo' },
  { id: 'piernas', label: 'No puede apoyar una pierna' },
  { id: 'esfuerzo-intenso', label: 'Sin esfuerzo intenso' },
  { id: 'sol', label: 'Sin exposición al sol' },
];

/** Los exentos o lesionados que lo están ese día. */
export function exentosDelDia(d: EfData, fecha: string): ExentoEF[] {
  return d.exentos.filter(e => e.desde <= fecha && (!e.hasta || e.hasta >= fecha));
}

/* ── Pruebas físicas ── */

/**
 * Las pruebas con las que empieza la app (decisión del dueño, 5-10-2026):
 * resistencia, velocidad y agilidad, fuerza y flexibilidad. El docente puede
 * ocultarlas y añadir las suyas.
 */
export const PRUEBAS_DE_PARTIDA: readonly PruebaFisica[] = [
  { id: 'course-navette', nombre: 'Course Navette', categoria: 'resistencia', unidad: 'períodos', mejor: 'mas',
    descripcion: 'Ida y vuelta de 20 m al ritmo de la señal sonora, que acelera cada minuto. Se anota el último período completado.' },
  { id: 'cooper', nombre: 'Test de Cooper', categoria: 'resistencia', unidad: 'm', mejor: 'mas',
    descripcion: 'Correr la máxima distancia posible en 12 minutos.' },
  { id: 'velocidad-30', nombre: 'Carrera de 30 m', categoria: 'velocidad', unidad: 's', mejor: 'menos',
    descripcion: 'Salida de pie y 30 m a la máxima velocidad.' },
  { id: 'agilidad-4x10', nombre: '4 × 10 m', categoria: 'velocidad', unidad: 's', mejor: 'menos',
    descripcion: 'Ir y volver dos veces entre dos líneas separadas 10 m, recogiendo y dejando un objeto.' },
  { id: 'salto-horizontal', nombre: 'Salto horizontal sin impulso', categoria: 'fuerza', unidad: 'cm', mejor: 'mas',
    descripcion: 'Desde parado, con los pies juntos, saltar lo más lejos posible. Se mide hasta el talón más atrasado.' },
  { id: 'balon-medicinal', nombre: 'Lanzamiento de balón medicinal', categoria: 'fuerza', unidad: 'm', mejor: 'mas',
    descripcion: 'Lanzar el balón con las dos manos por encima de la cabeza, sin despegar los pies. Indica el peso del balón en las notas.' },
  { id: 'dinamometria', nombre: 'Dinamometría manual', categoria: 'fuerza', unidad: 'kg', mejor: 'mas',
    descripcion: 'Apretar el dinamómetro con la mano dominante, con el brazo estirado junto al cuerpo. El mejor de dos intentos.' },
  { id: 'sit-and-reach', nombre: 'Flexión de tronco sentado', categoria: 'flexibilidad', unidad: 'cm', mejor: 'mas',
    descripcion: 'Sentado con las piernas estiradas, llevar las manos lo más lejos posible sobre el cajón (sit and reach).' },
];

export const CATEGORIAS_PRUEBA: readonly { id: CategoriaPrueba; label: string }[] = [
  { id: 'resistencia', label: 'Resistencia' },
  { id: 'velocidad', label: 'Velocidad y agilidad' },
  { id: 'fuerza', label: 'Fuerza' },
  { id: 'flexibilidad', label: 'Flexibilidad' },
  { id: 'otra', label: 'Otras' },
];

/** Todas las pruebas: las de partida (con lo que el docente haya cambiado) y las suyas. */
export function pruebasDe(d: EfData): PruebaFisica[] {
  const cambios = new Map(d.pruebas.map(p => [p.id, p]));
  return [
    ...PRUEBAS_DE_PARTIDA.map(p => (cambios.get(p.id)?.oculta ? { ...p, oculta: true } : p)),
    ...d.pruebas.filter(p => p.propia),
  ];
}

/** La mejor de dos marcas según la prueba. */
export function esMejor(p: Pick<PruebaFisica, 'mejor'>, a: number, b: number): boolean {
  return p.mejor === 'mas' ? a > b : a < b;
}

/** Las marcas de un alumno en una prueba, de la más antigua a la más reciente. */
export function marcasDe(d: EfData, pruebaId: string, alumnoId: string): MarcaPrueba[] {
  return d.marcas
    .filter(m => m.pruebaId === pruebaId && m.alumnoId === alumnoId)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * La nota de una marca con un baremo: la del tramo más alto que alcanza.
 * Sin tramo alcanzado, la nota más baja del baremo.
 */
export function notaConBaremo(b: Pick<BaremoEF, 'tramos'>, p: Pick<PruebaFisica, 'mejor'>, marca: number): number | null {
  if (!b.tramos.length) return null;
  const alcanzados = b.tramos.filter(t => (p.mejor === 'mas' ? marca >= t.marca : marca <= t.marca));
  if (!alcanzados.length) return Math.min(...b.tramos.map(t => t.nota));
  return Math.max(...alcanzados.map(t => t.nota));
}

/** La primera y la última marca de un alumno, y cuánto ha mejorado (en %, positivo es mejor). */
export function evolucionPrueba(d: EfData, p: PruebaFisica, alumnoId: string):
  { primera?: MarcaPrueba; ultima?: MarcaPrueba; mejora: number | null; tomas: number } {
  const ms = marcasDe(d, p.id, alumnoId);
  const primera = ms[0];
  const ultima = ms[ms.length - 1];
  if (!primera || !ultima || ms.length < 2 || primera.valor === 0) return { primera, ultima, mejora: null, tomas: ms.length };
  const cambio = ((ultima.valor - primera.valor) / Math.abs(primera.valor)) * 100;
  return { primera, ultima, mejora: Math.round((p.mejor === 'mas' ? cambio : -cambio) * 10) / 10, tomas: ms.length };
}

/**
 * El baremo de una prueba para un curso: el de su sexo si lo hay, y si no, el
 * que no distingue. Sin curso o sin baremo, ninguno.
 */
export function baremoPara(
  d: EfData, pruebaId: string, curso: { etapa?: string; curso?: number } | undefined, sexo?: SexoEF,
): BaremoEF | undefined {
  if (!curso?.etapa || !curso.curso) return undefined;
  const delCurso = d.baremos.filter(b => b.pruebaId === pruebaId && b.etapa === curso.etapa && b.curso === curso.curso);
  return (sexo && delCurso.find(b => b.sexo === sexo)) || delCurso.find(b => !b.sexo);
}

/**
 * Lee un baremo pegado de una hoja de cálculo o escrito a mano: una línea por
 * tramo con la marca y la nota, separadas por tabulador, punto y coma o
 * espacio. Admite la coma decimal. Lo que no se entiende se salta.
 */
export function leerTramos(texto: string): TramoBaremo[] {
  const num = (x: string) => Number(x.trim().replace(',', '.'));
  return texto.split(/\r?\n/).flatMap(linea => {
    const partes = linea.trim().split(/\t|;|\s+/).filter(Boolean);
    if (partes.length < 2) return [];
    const marca = num(partes[0]);
    const nota = num(partes[1]);
    return Number.isFinite(marca) && Number.isFinite(nota) && nota >= 0 && nota <= 10 ? [{ marca, nota }] : [];
  });
}

/* ── Actividades ── */

export const TIPOS_ACTIVIDAD: readonly { id: TipoActividadEF; label: string }[] = [
  { id: 'juego', label: 'Juegos motrices' },
  { id: 'deporte', label: 'Deportes' },
  { id: 'lluvia', label: 'Para días de lluvia' },
  { id: 'natural', label: 'En el medio natural' },
  { id: 'calentamiento', label: 'Calentamiento' },
  { id: 'calma', label: 'Vuelta a la calma' },
];

/* ── Fin de curso ── */

/**
 * Lo que queda al vaciar el curso: lo que es material del docente (sus
 * pruebas, baremos, actividades, sesiones, material, instalaciones y
 * circuitos). Lo del alumnado de este curso (exentos, niveles, marcas…) se va.
 */
export function efParaOtroCurso(d: EfData): EfData {
  return {
    ...EF_VACIO,
    pruebas: d.pruebas,
    baremos: d.baremos,
    actividades: d.actividades,
    sesiones: d.sesiones.map(s => ({ ...s, claseId: undefined, fecha: undefined })),
    material: d.material,
    instalaciones: d.instalaciones,
    circuitos: d.circuitos,
  };
}

/** Quita a un alumno de todo lo de EF. */
export function sinAlumnoEF(d: EfData, alumnoId: string): EfData {
  const { [alumnoId]: _n, ...niveles } = d.niveles;
  const { [alumnoId]: _s, ...sexos } = d.sexos;
  void _n; void _s;
  return {
    ...d,
    exentos: d.exentos.filter(e => e.alumnoId !== alumnoId),
    niveles, sexos,
    separar: d.separar.filter(p => p.a !== alumnoId && p.b !== alumnoId),
    marcas: d.marcas.filter(m => m.alumnoId !== alumnoId),
  };
}

/* ── Carga segura ── */

const esTexto = (v: unknown): v is string => typeof v === 'string';
const texto = (v: unknown) => (esTexto(v) ? v : '');
const lista = <T,>(v: unknown, f: (x: unknown) => T | null): T[] =>
  Array.isArray(v) ? v.map(f).filter((x): x is T => x !== null) : [];
const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const fecha = (v: unknown) => (esTexto(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const de = <T extends string>(v: unknown, opciones: readonly T[], porDefecto: T): T =>
  (opciones as readonly unknown[]).includes(v) ? v as T : porDefecto;

const LIMS = LIMITACIONES.map(l => l.id);
const CATS: CategoriaPrueba[] = ['resistencia', 'velocidad', 'fuerza', 'flexibilidad', 'otra'];
const TIPOS: TipoActividadEF[] = ['juego', 'deporte', 'lluvia', 'natural', 'calentamiento', 'calma'];

function registro<V>(v: unknown, f: (x: unknown) => V | undefined): Record<string, V> {
  const o = obj(v);
  if (!o) return {};
  const out: Record<string, V> = {};
  for (const [k, x] of Object.entries(o)) {
    const y = f(x);
    if (y !== undefined) out[k] = y;
  }
  return out;
}

/** Lo guardado, tal cual o de una versión anterior, en la forma de ahora. Lo que no se entiende, fuera. */
export function normalizarEF(raw: unknown): EfData {
  const o = obj(raw);
  if (!o) return EF_VACIO;
  const exentos = lista<ExentoEF>(o.exentos, v => {
    const x = obj(v);
    const desde = fecha(x?.desde);
    if (!x || !esTexto(x.id) || !esTexto(x.alumnoId) || !desde) return null;
    const hasta = fecha(x.hasta);
    return {
      id: x.id, alumnoId: x.alumnoId,
      limitaciones: lista(x.limitaciones, l => (LIMS.includes(l as LimitacionEF) ? l as LimitacionEF : null)),
      otra: texto(x.otra), desde, ...(hasta ? { hasta } : {}),
      tarea: texto(x.tarea), justificante: x.justificante === true, motivo: texto(x.motivo),
    };
  });
  const pruebas = lista<PruebaFisica>(o.pruebas, v => {
    const x = obj(v);
    if (!x || !esTexto(x.id)) return null;
    return {
      id: x.id, nombre: texto(x.nombre), categoria: de(x.categoria, CATS, 'otra'), unidad: texto(x.unidad),
      mejor: x.mejor === 'menos' ? 'menos' : 'mas', descripcion: texto(x.descripcion),
      ...(x.propia === true ? { propia: true } : {}), ...(x.oculta === true ? { oculta: true } : {}),
    };
  });
  const marcas = lista<MarcaPrueba>(o.marcas, v => {
    const x = obj(v);
    const f = fecha(x?.fecha);
    const valor = numero(x?.valor);
    return x && esTexto(x.id) && esTexto(x.pruebaId) && esTexto(x.alumnoId) && f && valor !== undefined
      ? { id: x.id, pruebaId: x.pruebaId, alumnoId: x.alumnoId, fecha: f, valor } : null;
  });
  const baremos = lista<BaremoEF>(o.baremos, v => {
    const x = obj(v);
    const curso = numero(x?.curso);
    if (!x || !esTexto(x.id) || !esTexto(x.pruebaId) || (x.etapa !== 'primaria' && x.etapa !== 'eso') || !curso) return null;
    return {
      id: x.id, pruebaId: x.pruebaId, etapa: x.etapa, curso,
      ...(x.sexo === 'F' || x.sexo === 'M' ? { sexo: x.sexo as SexoEF } : {}),
      tramos: lista<TramoBaremo>(x.tramos, t => {
        const y = obj(t);
        const marca = numero(y?.marca);
        const nota = numero(y?.nota);
        return marca !== undefined && nota !== undefined ? { marca, nota } : null;
      }),
      fuente: texto(x.fuente) || 'propio',
    };
  });
  const actividades = lista<ActividadEF>(o.actividades, v => {
    const x = obj(v);
    if (!x || !esTexto(x.id) || !esTexto(x.titulo)) return null;
    return {
      id: x.id, titulo: x.titulo, tipo: de(x.tipo, TIPOS, 'juego'), descripcion: texto(x.descripcion),
      organizacion: texto(x.organizacion), material: texto(x.material), variantes: texto(x.variantes),
      inclusion: texto(x.inclusion), origen: de(x.origen, ['banco', 'propia', 'ia'] as const, 'propia'),
    };
  });
  const sesiones = lista<SesionEF>(o.sesiones, v => {
    const x = obj(v);
    if (!x || !esTexto(x.id)) return null;
    const f = fecha(x.fecha);
    return {
      id: x.id, titulo: texto(x.titulo),
      ...(esTexto(x.claseId) ? { claseId: x.claseId } : {}), ...(f ? { fecha: f } : {}),
      ...(esTexto(x.instalacionId) ? { instalacionId: x.instalacionId } : {}),
      objetivo: texto(x.objetivo), calentamiento: texto(x.calentamiento), principal: texto(x.principal),
      calma: texto(x.calma), material: texto(x.material), inclusion: texto(x.inclusion), planB: texto(x.planB),
    };
  });
  const material = lista<MaterialEF>(o.material, v => {
    const x = obj(v);
    if (!x || !esTexto(x.id) || !esTexto(x.nombre)) return null;
    return {
      id: x.id, nombre: x.nombre, cantidad: Math.max(0, Math.round(numero(x.cantidad) ?? 0)),
      estado: de(x.estado, ['bien', 'regular', 'reponer'] as const, 'bien'), ubicacion: texto(x.ubicacion),
    };
  });
  const instalaciones = lista<InstalacionEF>(o.instalaciones, v => {
    const x = obj(v);
    return x && esTexto(x.id) && esTexto(x.nombre)
      ? { id: x.id, nombre: x.nombre, cubierta: x.cubierta === true, notas: texto(x.notas) } : null;
  });
  const circuitos = lista<CircuitoEF>(o.circuitos, v => {
    const x = obj(v);
    if (!x || !esTexto(x.id)) return null;
    const seg = (n: unknown, def: number) => Math.max(0, Math.min(3600, Math.round(numero(n) ?? def)));
    return {
      id: x.id, nombre: texto(x.nombre), estaciones: lista(x.estaciones, e => (esTexto(e) ? e : null)),
      trabajo: seg(x.trabajo, 30), descanso: seg(x.descanso, 15),
      rondas: Math.max(1, Math.min(20, Math.round(numero(x.rondas) ?? 1))), descansoRondas: seg(x.descansoRondas, 60),
    };
  });
  return {
    exentos,
    niveles: registro(o.niveles, x => (x === 1 || x === 2 || x === 3 ? x : undefined)),
    sexos: registro(o.sexos, x => (x === 'F' || x === 'M' ? x : undefined)),
    separar: lista(o.separar, v => {
      const x = obj(v);
      return x && esTexto(x.a) && esTexto(x.b) && x.a !== x.b ? { a: x.a, b: x.b } : null;
    }),
    pruebas, marcas, baremos, actividades, sesiones, material, instalaciones, circuitos,
  };
}
