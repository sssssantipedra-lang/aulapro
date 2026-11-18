/**
 * «Tu semana», en el Inicio (18-11-2026, decisión del dueño): las sesiones que
 * tocan esta semana, las entregas, reuniones y eventos, y lo que quedó sin dar
 * de la semana anterior. De lunes a viernes es la semana en curso; el sábado y
 * el domingo, la que viene, que es la que se prepara.
 */
import type { CalEvent, Class } from '../types';
import type { SesionEF } from '../types/ef';

export interface SesionDeSemana { id: string; titulo: string; fecha: string; clase: string; color: string; completada: boolean }

export interface Semana {
  /** Lunes y domingo de la semana que se enseña, YYYY-MM-DD. */
  desde: string;
  hasta: string;
  /** Es la semana que viene (se mira en fin de semana). */
  proxima: boolean;
  /** Las sesiones con fecha en la semana, por día. */
  sesiones: SesionDeSemana[];
  /** Entregas, reuniones y eventos de la semana, por día y hora. */
  eventos: CalEvent[];
  /** Sesiones de la semana anterior que no se marcaron como completadas. */
  pendientes: SesionDeSemana[];
}

const sumar = (iso: string, dias: number): string => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
};
/** 0 = lunes … 6 = domingo. */
const diaSemana = (iso: string): number => {
  const [a, m, d] = iso.split('-').map(Number);
  return (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7;
};

export function semanaDe(d: { sesiones: SesionEF[]; calEvents: CalEvent[]; classes: Class[]; hoy: string }): Semana {
  const dia = diaSemana(d.hoy);
  const proxima = dia >= 5;
  const desde = sumar(d.hoy, proxima ? 7 - dia : -dia);
  const hasta = sumar(desde, 6);
  const antes = { desde: sumar(desde, -7), hasta: sumar(desde, -1) };

  const fila = (s: SesionEF): SesionDeSemana => {
    const c = d.classes.find(x => x.id === s.claseId);
    return { id: s.id, titulo: s.titulo, fecha: s.fecha!, clase: c?.name ?? '', color: c?.color ?? 'var(--text-3)', completada: !!s.completada };
  };
  const conFecha = d.sesiones.filter(s => s.fecha && !s.archivada);
  const enRango = (r: { desde: string; hasta: string }) => conFecha
    .filter(s => s.fecha! >= r.desde && s.fecha! <= r.hasta)
    .sort((a, b) => a.fecha!.localeCompare(b.fecha!) || a.titulo.localeCompare(b.titulo))
    .map(fila);

  return {
    desde, hasta, proxima,
    sesiones: enRango({ desde, hasta }),
    eventos: d.calEvents
      .filter(e => e.date >= desde && e.date <= hasta)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')),
    pendientes: enRango(antes).filter(s => !s.completada),
  };
}

/** Si hay algo que enseñar. */
export const semanaConAlgo = (s: Semana) => s.sesiones.length + s.eventos.length + s.pendientes.length > 0;
