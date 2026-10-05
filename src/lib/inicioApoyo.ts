/**
 * El Inicio del profesorado de PT y AL, sin React: las sesiones de hoy, los
 * avisos de seguimiento y cómo va cada alumno en el trimestre (decisión del
 * dueño, 5-10-2026). Ver `docs/PTAL.md`.
 */
import { isoDate } from './utils';
import { diaDeLaSemana, gruposDelDia, resumenObjetivo, sesionConDatos, trimestreDe } from './apoyo';
import type {
  AlumnoApoyo, ApoyoData, FranjaApoyo, GrupoApoyo, Logro, ObjetivoApoyo, ProgramaApoyo, RegistroAlumno, Trimestre,
} from '../types/apoyo';

function sumarDias(fecha: string, n: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + n));
}

/** Si en ese registro hay algo anotado del alumno. */
function registroConDatos(r: RegistroAlumno): boolean {
  return !!r.ausente || Object.keys(r.objetivos).length > 0 || Object.keys(r.respuesta).length > 0 || r.nota.trim() !== '';
}

/* ── Sesiones de hoy ── */

export interface SesionDeHoy {
  grupo: GrupoApoyo;
  /** Sus franjas de hoy, por orden de hora. */
  franjas: FranjaApoyo[];
  /** Si ya tiene algo anotado. */
  registrada: boolean;
}

export function sesionesDeHoy(d: ApoyoData, hoy: string): SesionDeHoy[] {
  const dia = diaDeLaSemana(hoy);
  return gruposDelDia(d.grupos, hoy).map(grupo => ({
    grupo,
    franjas: grupo.horario.filter(f => f.dia === dia).sort((a, b) => a.inicio.localeCompare(b.inicio)),
    registrada: d.sesiones.some(s => s.grupoId === grupo.id && s.fecha === hoy && sesionConDatos(s)),
  }));
}

/* ── Avisos de seguimiento ── */

export type Aviso =
  /** Se acaba el trimestre y a estos alumnos les falta el informe. */
  | { tipo: 'informes'; trimestre: Trimestre; alumnos: AlumnoApoyo[] }
  /** Una sesión de los últimos siete días que se quedó sin registrar. */
  | { tipo: 'sin-registrar'; grupo: GrupoApoyo; fecha: string }
  /** Las últimas veces que se trabajó, no lo consiguió. */
  | { tipo: 'atascado'; alumno: AlumnoApoyo; objetivo: ObjetivoApoyo; veces: number }
  /** Ha venido a varias sesiones del trimestre y este objetivo no se ha trabajado en ninguna. */
  | { tipo: 'sin-trabajar'; alumno: AlumnoApoyo; objetivo: ObjetivoApoyo; sesiones: number }
  | { tipo: 'sin-objetivos'; alumno: AlumnoApoyo; trimestre: Trimestre }
  | { tipo: 'sin-grupo'; alumno: AlumnoApoyo };

/** Cuántas veces seguidas sin conseguirlo hacen falta para avisar. */
export const VECES_ATASCADO = 3;
/** Sesiones del trimestre sin tocar un objetivo para avisar. */
export const SESIONES_SIN_TRABAJAR = 3;
/** Días hacia atrás en los que se buscan sesiones sin registrar. */
const DIAS_ATRAS = 7;

/**
 * Desde cuándo se avisa de los informes de cada trimestre: las dos últimas
 * semanas, más o menos. Las fechas de evaluación cambian de un centro a otro.
 */
function finDeTrimestre(hoy: string): Trimestre | null {
  const mes = Number(hoy.slice(5, 7));
  const dia = Number(hoy.slice(8, 10));
  if (mes === 12) return 1;
  if (mes === 3 && dia >= 10) return 2;
  if (mes === 6) return 3;
  return null;
}

export function avisosApoyo(d: ApoyoData, hoy: string): Aviso[] {
  const T = trimestreDe(hoy);
  const avisos: Aviso[] = [];
  const delTrimestre = d.sesiones.filter(s => trimestreDe(s.fecha) === T && s.fecha <= hoy);
  const programasDe = (alumnoId: string) => d.programas.filter(p => p.alumnoId === alumnoId);

  const fin = finDeTrimestre(hoy);
  if (fin) {
    const sinInforme = d.alumnos.filter(a => !d.documentos.some(doc =>
      doc.alumnoId === a.id && doc.trimestre === fin && (doc.tipo === 'familia' || doc.tipo === 'equipo')));
    if (sinInforme.length) avisos.push({ tipo: 'informes', trimestre: fin, alumnos: sinInforme });
  }

  // Solo desde la primera sesión registrada de cada grupo: a un grupo recién
  // creado no se le reclaman los días de antes.
  for (let atras = DIAS_ATRAS; atras >= 1; atras--) {
    const fecha = sumarDias(hoy, -atras);
    for (const grupo of gruposDelDia(d.grupos, fecha)) {
      if (grupo.alumnos.length === 0) continue;
      const suyas = d.sesiones.filter(s => s.grupoId === grupo.id && sesionConDatos(s));
      const primera = suyas.map(s => s.fecha).sort()[0];
      if (!primera || fecha < primera) continue;
      if (!suyas.some(s => s.fecha === fecha)) avisos.push({ tipo: 'sin-registrar', grupo, fecha });
    }
  }

  const atascados: Aviso[] = [];
  const sinTrabajar: Aviso[] = [];
  for (const alumno of d.alumnos) {
    for (const programa of programasDe(alumno.id)) {
      // Las sesiones de grupos de su especialidad en las que vino y hay algo anotado
      const vino = delTrimestre.filter(s => {
        const g = d.grupos.find(x => x.id === s.grupoId);
        const r = s.alumnos.find(x => x.alumnoId === alumno.id);
        return g?.especialidad === programa.especialidad && !!r && !r.ausente && registroConDatos(r);
      });
      for (const objetivo of programa.objetivos.filter(o => o.trimestres.includes(T))) {
        const serie = serieDe(d, alumno.id, objetivo.id);
        const ultimas = serie.slice(-VECES_ATASCADO);
        if (ultimas.length === VECES_ATASCADO && ultimas.every(l => l === 'no')) {
          atascados.push({ tipo: 'atascado', alumno, objetivo, veces: VECES_ATASCADO });
        } else if (vino.length >= SESIONES_SIN_TRABAJAR && !vino.some(s => s.alumnos.find(x => x.alumnoId === alumno.id)?.objetivos[objetivo.id])) {
          sinTrabajar.push({ tipo: 'sin-trabajar', alumno, objetivo, sesiones: vino.length });
        }
      }
    }
  }
  avisos.push(...atascados, ...sinTrabajar);

  for (const alumno of d.alumnos) {
    const enGrupo = d.grupos.some(g => g.alumnos.includes(alumno.id));
    if (!enGrupo) avisos.push({ tipo: 'sin-grupo', alumno });
    else if (!programasDe(alumno.id).some(p => p.objetivos.some(o => o.trimestres.includes(T)))) {
      avisos.push({ tipo: 'sin-objetivos', alumno, trimestre: T });
    }
  }
  return avisos;
}

/* ── Evolución del alumnado ── */

/** Cómo va un objetivo: lo de la última vez que se trabajó, o sin trabajar. */
export type EstadoObjetivo = Logro | 'sin';

export interface EvolucionAlumno {
  alumno: AlumnoApoyo;
  /** Sesiones del trimestre en que vino. */
  sesiones: number;
  objetivos: { programa: ProgramaApoyo; objetivo: ObjetivoApoyo; estado: EstadoObjetivo; serie: Logro[] }[];
  cuenta: Record<EstadoObjetivo, number>;
}

/** Lo que se anotó de un objetivo, sesión a sesión y por orden de fecha. */
export function serieDe(d: ApoyoData, alumnoId: string, objetivoId: string, trimestre?: Trimestre): Logro[] {
  return [...d.sesiones]
    .filter(s => trimestre === undefined || trimestreDe(s.fecha) === trimestre)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(s => s.alumnos.find(r => r.alumnoId === alumnoId)?.objetivos[objetivoId])
    .filter((l): l is Logro => !!l);
}

export function evolucionDelTrimestre(d: ApoyoData, trimestre: Trimestre): EvolucionAlumno[] {
  return d.alumnos.map(alumno => {
    const objetivos = d.programas
      .filter(p => p.alumnoId === alumno.id)
      .flatMap(programa => programa.objetivos
        .filter(o => o.trimestres.includes(trimestre))
        .map(objetivo => {
          const r = resumenObjetivo(d.sesiones, alumno.id, objetivo.id, trimestre);
          return { programa, objetivo, estado: (r.ultimo ?? 'sin') as EstadoObjetivo, serie: serieDe(d, alumno.id, objetivo.id, trimestre) };
        }));
    const cuenta: Record<EstadoObjetivo, number> = { si: 0, proceso: 0, no: 0, sin: 0 };
    objetivos.forEach(o => { cuenta[o.estado] += 1; });
    const sesiones = d.sesiones.filter(s => {
      if (trimestreDe(s.fecha) !== trimestre) return false;
      const r = s.alumnos.find(x => x.alumnoId === alumno.id);
      return !!r && !r.ausente && registroConDatos(r);
    }).length;
    return { alumno, sesiones, objetivos, cuenta };
  });
}
