/**
 * Lógica del módulo de PT y AL, sin React. Ver `docs/PTAL.md`.
 */
import type { ComunidadId } from './curriculum/comunidades';
import type {
  AlumnoApoyo, ApoyoData, AspectoRespuesta, CursoDe, Especialidad, GrupoApoyo, Logro,
  ObjetivoApoyo, ProgramaApoyo, RegistroAlumno, SesionApoyo, Trimestre,
} from '../types/apoyo';

export const APOYO_VACIO: ApoyoData = { alumnos: [], grupos: [], programas: [], sesiones: [] };

export function nuevoIdApoyo(prefijo: string): string {
  return prefijo + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Las especialidades guardadas en el perfil; lo que no se entienda, fuera. */
export function especialidadesDePerfil(valor: unknown): Especialidad[] {
  if (!Array.isArray(valor)) return [];
  return (['PT', 'AL'] as const).filter(e => valor.includes(e));
}

/* ── Ámbitos ── */

export interface Ambito {
  nombre: string;
  /** Quién lo trabaja normalmente; el docente lo puede cambiar. */
  especialidad: Especialidad;
}

/**
 * Comunitat Valenciana: los programas personalizados del apartado D del PAP
 * (Documento 7 de la Conselleria) que lleva el profesorado de PT y AL, más la
 * ACIS. Texto literal del modelo, en sus dos lenguas, con su «personalitzat»
 * en la línea castellana de la autonomía personal.
 */
const AMBITOS_CV: Record<'es' | 'va', Ambito[]> = {
  es: [
    { nombre: 'Programa personalizado para la adquisición y uso funcional de la comunicación, el lenguaje y el habla', especialidad: 'AL' },
    { nombre: 'Programa personalizado para el aprendizaje de la lectura y la escritura', especialidad: 'PT' },
    { nombre: 'Programa personalizado para el aprendizaje de las matemáticas', especialidad: 'PT' },
    { nombre: 'Programa personalitzat para el desarrollo de la autonomía personal', especialidad: 'PT' },
    { nombre: 'Programa específico de conducta o plan terapéutico', especialidad: 'PT' },
    { nombre: 'Adaptación curricular individual significativa (ACIS)', especialidad: 'PT' },
  ],
  va: [
    { nombre: 'Programa personalitzat per a l’adquisició i ús funcional de la comunicació, el llenguatge i la parla', especialidad: 'AL' },
    { nombre: 'Programa personalitzat per a l’aprenentatge de la lectura i l’escriptura', especialidad: 'PT' },
    { nombre: 'Programa personalitzat per a l’aprenentatge de les matemàtiques', especialidad: 'PT' },
    { nombre: 'Programa personalitzat per al desenvolupament de l’autonomia personal', especialidad: 'PT' },
    { nombre: 'Programa específic de conducta o pla terapèutic', especialidad: 'PT' },
    { nombre: 'Adaptació curricular individual significativa (ACIS)', especialidad: 'PT' },
  ],
};

/** El resto de comunidades: ámbitos de partida, en castellano (se traducen al mostrarlos). */
export const AMBITOS_GENERALES: readonly Ambito[] = [
  { nombre: 'Lectoescritura', especialidad: 'PT' },
  { nombre: 'Razonamiento lógico-matemático', especialidad: 'PT' },
  { nombre: 'Atención, memoria y funciones ejecutivas', especialidad: 'PT' },
  { nombre: 'Autonomía personal', especialidad: 'PT' },
  { nombre: 'Habilidades sociales y regulación emocional', especialidad: 'PT' },
  { nombre: 'Fonética y fonología', especialidad: 'AL' },
  { nombre: 'Morfosintaxis', especialidad: 'AL' },
  { nombre: 'Semántica y vocabulario', especialidad: 'AL' },
  { nombre: 'Pragmática', especialidad: 'AL' },
  { nombre: 'Voz y fluidez', especialidad: 'AL' },
  { nombre: 'Discriminación auditiva', especialidad: 'AL' },
  { nombre: 'Conciencia fonológica', especialidad: 'AL' },
  { nombre: 'Comunicación aumentativa y alternativa', especialidad: 'AL' },
];

/**
 * Los ámbitos que se ofrecen al crear un programa. `oficial` dice si son el
 * texto literal de un modelo oficial (y no se traducen) o los de partida.
 */
export function ambitosDe(
  comunidad: ComunidadId | undefined, idiomaApp: 'es' | 'en' | 'ca',
): { oficial: boolean; ambitos: readonly Ambito[] } {
  if (comunidad === 'comunitat-valenciana') {
    return { oficial: true, ambitos: AMBITOS_CV[idiomaApp === 'ca' ? 'va' : 'es'] };
  }
  return { oficial: false, ambitos: AMBITOS_GENERALES };
}

/* ── Fechas ── */

/**
 * El trimestre de una fecha del curso, sin calendario escolar: de septiembre
 * a diciembre el 1º, de enero a marzo el 2º y de abril en adelante el 3º.
 */
export function trimestreDe(fechaIso: string): Trimestre {
  const mes = Number(fechaIso.slice(5, 7));
  if (mes >= 9) return 1;
  if (mes <= 3) return 2;
  return 3;
}

/** Día de la semana de una fecha, 0 = lunes … 6 = domingo. */
export function diaDeLaSemana(fechaIso: string): number {
  const [y, m, d] = fechaIso.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/** Los grupos que tienen sesión ese día, por la hora de la primera franja. */
export function gruposDelDia(grupos: readonly GrupoApoyo[], fechaIso: string): GrupoApoyo[] {
  const dia = diaDeLaSemana(fechaIso);
  const inicio = (g: GrupoApoyo) => g.horario.filter(f => f.dia === dia).map(f => f.inicio).sort()[0] ?? '';
  return grupos.filter(g => g.horario.some(f => f.dia === dia)).sort((a, b) => inicio(a).localeCompare(inicio(b)));
}

/* ── Alumnado ── */

/** El curso cuyo currículo trabaja: su nivel, o el de su matrícula. */
export function nivelDe(a: AlumnoApoyo): CursoDe | undefined {
  return a.nivel ?? a.matricula;
}

/** Su nivel está por debajo del curso en que está matriculado. */
export function tieneDesfase(a: AlumnoApoyo): boolean {
  if (!a.nivel || !a.matricula) return false;
  const orden = (c: CursoDe) => (c.etapa === 'eso' ? 6 : 0) + c.curso;
  return orden(a.nivel) < orden(a.matricula);
}

/**
 * Categorías de necesidad específica de apoyo educativo de la LOE (artículo
 * 71.2, en la redacción de la LOMLOE), para sugerirlas al escribir.
 */
export const CATEGORIAS_NEAE: readonly string[] = [
  'Necesidades educativas especiales',
  'Retraso madurativo',
  'Trastornos del desarrollo del lenguaje y la comunicación',
  'Trastornos de atención o de aprendizaje',
  'Desconocimiento grave de la lengua de aprendizaje',
  'Situación de vulnerabilidad socioeducativa',
  'Altas capacidades intelectuales',
  'Incorporación tardía al sistema educativo',
  'Condiciones personales o de historia escolar',
];

/* ── Programas y sesiones ── */

/** Los objetivos de un alumno que tocan en un trimestre, de los programas de esa especialidad. */
export function objetivosDelTrimestre(
  programas: readonly ProgramaApoyo[], alumnoId: string, especialidad: Especialidad, trimestre: Trimestre,
): { programa: ProgramaApoyo; objetivo: ObjetivoApoyo }[] {
  return programas
    .filter(p => p.alumnoId === alumnoId && p.especialidad === especialidad)
    .flatMap(programa => programa.objetivos
      .filter(o => o.trimestres.includes(trimestre))
      .map(objetivo => ({ programa, objetivo })));
}

export function registroVacio(alumnoId: string): RegistroAlumno {
  return { alumnoId, objetivos: {}, respuesta: {}, nota: '' };
}

/** La sesión de un grupo en una fecha, o una nueva con su alumnado de hoy. */
export function sesionDe(
  sesiones: readonly SesionApoyo[], grupo: GrupoApoyo, fechaIso: string,
): SesionApoyo {
  const hecha = sesiones.find(s => s.grupoId === grupo.id && s.fecha === fechaIso);
  if (hecha) {
    // Un alumno que se ha añadido al grupo después también aparece
    const faltan = grupo.alumnos.filter(id => !hecha.alumnos.some(r => r.alumnoId === id));
    return faltan.length ? { ...hecha, alumnos: [...hecha.alumnos, ...faltan.map(registroVacio)] } : hecha;
  }
  return {
    id: nuevoIdApoyo('ses'), grupoId: grupo.id, fecha: fechaIso, temaClase: '',
    alumnos: grupo.alumnos.map(registroVacio),
  };
}

/** Si la sesión tiene algo anotado; una vacía no se guarda. */
export function sesionConDatos(s: SesionApoyo): boolean {
  return s.temaClase.trim() !== '' || s.alumnos.some(r =>
    r.ausente || Object.keys(r.objetivos).length > 0 || Object.keys(r.respuesta).length > 0 || r.nota.trim() !== '');
}

export interface ResumenObjetivo {
  si: number;
  proceso: number;
  no: number;
  /** El último registro, el que dice cómo va ahora. */
  ultimo?: Logro;
}

/** Cuántas veces se ha registrado cada logro de un objetivo, en orden de fecha. */
export function resumenObjetivo(
  sesiones: readonly SesionApoyo[], alumnoId: string, objetivoId: string, trimestre?: Trimestre,
): ResumenObjetivo {
  const r: ResumenObjetivo = { si: 0, proceso: 0, no: 0 };
  [...sesiones]
    .filter(s => trimestre === undefined || trimestreDe(s.fecha) === trimestre)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .forEach(s => {
      const logro = s.alumnos.find(x => x.alumnoId === alumnoId)?.objetivos[objetivoId];
      if (!logro) return;
      r[logro] += 1;
      r.ultimo = logro;
    });
  return r;
}

export const ASPECTOS: readonly AspectoRespuesta[] = ['atencion', 'motivacion', 'conducta', 'autonomia'];

/* ── Carga segura ── */

const esTexto = (v: unknown): v is string => typeof v === 'string';
const lista = <T,>(v: unknown, f: (x: unknown) => T | null): T[] =>
  Array.isArray(v) ? v.map(f).filter((x): x is T => x !== null) : [];
const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

function curso(v: unknown): CursoDe | undefined {
  const o = obj(v);
  if (!o || (o.etapa !== 'primaria' && o.etapa !== 'eso')) return undefined;
  const n = Number(o.curso);
  const max = o.etapa === 'primaria' ? 6 : 4;
  return Number.isInteger(n) && n >= 1 && n <= max ? { etapa: o.etapa, curso: n } : undefined;
}

const especialidad = (v: unknown): Especialidad => (v === 'AL' ? 'AL' : 'PT');

/**
 * Lo que llega del disco o de una copia de seguridad, con la forma que espera
 * la app. Lo que no se entiende se descarta en vez de romper la pantalla.
 */
export function normalizarApoyo(raw: unknown): ApoyoData {
  const o = obj(raw);
  if (!o) return APOYO_VACIO;
  const alumnos = lista<AlumnoApoyo>(o.alumnos, v => {
    const a = obj(v);
    if (!a || !esTexto(a.id) || !esTexto(a.nombre)) return null;
    return {
      id: a.id, nombre: a.nombre,
      claseOrigen: esTexto(a.claseOrigen) ? a.claseOrigen : '',
      matricula: curso(a.matricula), nivel: curso(a.nivel),
      categoria: esTexto(a.categoria) ? a.categoria : '',
      diagnostico: esTexto(a.diagnostico) ? a.diagnostico : '',
      necesidades: esTexto(a.necesidades) ? a.necesidades : '',
      notas: esTexto(a.notas) ? a.notas : '',
    };
  });
  const ids = new Set(alumnos.map(a => a.id));
  const grupos = lista<GrupoApoyo>(o.grupos, v => {
    const g = obj(v);
    if (!g || !esTexto(g.id) || !esTexto(g.nombre)) return null;
    return {
      id: g.id, nombre: g.nombre, especialidad: especialidad(g.especialidad),
      modalidad: g.modalidad === 'dentro' ? 'dentro' : 'fuera',
      horario: lista(g.horario, f => {
        const x = obj(f);
        const dia = Number(x?.dia);
        if (!x || !Number.isInteger(dia) || dia < 0 || dia > 4 || !esTexto(x.inicio) || !esTexto(x.fin)) return null;
        return { dia, inicio: x.inicio, fin: x.fin };
      }),
      alumnos: lista(g.alumnos, id => (esTexto(id) && ids.has(id) ? id : null)),
      color: esTexto(g.color) ? g.color : '#6366f1',
    };
  });
  const programas = lista<ProgramaApoyo>(o.programas, v => {
    const p = obj(v);
    if (!p || !esTexto(p.id) || !esTexto(p.alumnoId) || !ids.has(p.alumnoId) || !esTexto(p.ambito)) return null;
    const intensidad = p.intensidad === 'baja' || p.intensidad === 'media' || p.intensidad === 'alta' ? p.intensidad : undefined;
    return {
      id: p.id, alumnoId: p.alumnoId, ambito: p.ambito, especialidad: especialidad(p.especialidad),
      ...(intensidad ? { intensidad } : {}),
      objetivos: lista<ObjetivoApoyo>(p.objetivos, ob => {
        const x = obj(ob);
        if (!x || !esTexto(x.id) || !esTexto(x.texto)) return null;
        const trimestres = lista<Trimestre>(x.trimestres, t => (t === 1 || t === 2 || t === 3 ? t : null));
        return {
          id: x.id, texto: x.texto,
          trimestres: trimestres.length ? [...new Set(trimestres)].sort() : [1, 2, 3],
          criterios: lista(x.criterios, c => {
            const r = obj(c);
            return r && esTexto(r.materia) && esTexto(r.codigo) ? { materia: r.materia, codigo: r.codigo } : null;
          }),
        };
      }),
    };
  });
  const sesiones = lista<SesionApoyo>(o.sesiones, v => {
    const s = obj(v);
    if (!s || !esTexto(s.id) || !esTexto(s.grupoId) || !esTexto(s.fecha) || !/^\d{4}-\d{2}-\d{2}$/.test(s.fecha)) return null;
    return {
      id: s.id, grupoId: s.grupoId, fecha: s.fecha,
      temaClase: esTexto(s.temaClase) ? s.temaClase : '',
      alumnos: lista<RegistroAlumno>(s.alumnos, r => {
        const x = obj(r);
        if (!x || !esTexto(x.alumnoId)) return null;
        const objetivos: Record<string, Logro> = {};
        Object.entries(obj(x.objetivos) ?? {}).forEach(([k, l]) => {
          if (l === 'si' || l === 'proceso' || l === 'no') objetivos[k] = l;
        });
        const respuesta: RegistroAlumno['respuesta'] = {};
        Object.entries(obj(x.respuesta) ?? {}).forEach(([k, c]) => {
          if ((ASPECTOS as readonly string[]).includes(k) && (c === 1 || c === 2 || c === 3)) respuesta[k as AspectoRespuesta] = c;
        });
        return {
          alumnoId: x.alumnoId, ...(x.ausente === true ? { ausente: true } : {}),
          objetivos, respuesta, nota: esTexto(x.nota) ? x.nota : '',
        };
      }),
    };
  });
  return { alumnos, grupos, programas, sesiones };
}

/** Quita un alumno de todo el módulo: grupos, programas y registros. */
export function sinAlumno(d: ApoyoData, alumnoId: string): ApoyoData {
  return {
    alumnos: d.alumnos.filter(a => a.id !== alumnoId),
    grupos: d.grupos.map(g => ({ ...g, alumnos: g.alumnos.filter(id => id !== alumnoId) })),
    programas: d.programas.filter(p => p.alumnoId !== alumnoId),
    sesiones: d.sesiones
      .map(s => ({ ...s, alumnos: s.alumnos.filter(r => r.alumnoId !== alumnoId) }))
      .filter(s => s.alumnos.length > 0),
  };
}

/** Quita un grupo y sus sesiones; el alumnado y sus programas se quedan. */
export function sinGrupo(d: ApoyoData, grupoId: string): ApoyoData {
  return {
    ...d,
    grupos: d.grupos.filter(g => g.id !== grupoId),
    sesiones: d.sesiones.filter(s => s.grupoId !== grupoId),
  };
}
