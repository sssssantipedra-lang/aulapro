/**
 * Sugerencias en el momento (18-11-2026, decisión del dueño): avisos pequeños
 * que salen justo después de hacer algo, en la pantalla en la que ya se está.
 * Siempre dicen por qué, proponen una sola cosa y se pueden cerrar; una vez
 * cerrada o atendida, la misma sugerencia no vuelve a salir (`useSugerencias`).
 * Aquí, las reglas; el recuadro es `components/ui/Sugerencia.tsx`.
 */
import type { AttendanceStatus, GradeItem, GradeMap, Student } from '../types';

/* ── Asistencia: faltas seguidas sin justificar ── */

/** A partir de cuántas faltas seguidas se propone anotar un aviso en la ficha. */
export const FALTAS_SEGUIDAS = 3;

export interface RachaDeFaltas { student: Student; n: number; desde: string; hasta: string; clave: string }

/**
 * Quién lleva `FALTAS_SEGUIDAS` o más faltas sin justificar seguidas hasta el
 * día `hasta`, contando solo los días en que se le pasó lista. Un retraso, una
 * falta justificada o un día presente cortan la racha. La clave lleva el día
 * en que empezó: mientras la racha siga, es la misma sugerencia.
 */
export function faltasSeguidas(
  dias: Record<string, Record<string, AttendanceStatus>> | undefined, alumnos: Student[], hasta: string,
): RachaDeFaltas[] {
  const fechas = Object.keys(dias ?? {}).filter(f => f <= hasta).sort().reverse();
  const out: RachaDeFaltas[] = [];
  for (const student of alumnos) {
    let n = 0, desde = '', ultima = '';
    for (const f of fechas) {
      const estado = dias![f][student.id];
      if (!estado) continue;
      if (estado !== 'absent') break;
      n++; desde = f; ultima ||= f;
    }
    if (n >= FALTAS_SEGUIDAS) out.push({ student, n, desde, hasta: ultima, clave: `faltas:${student.id}:${desde}` });
  }
  return out.sort((a, b) => b.n - a.n);
}

/* ── Cuaderno: una actividad a medio calificar ── */

export interface ColumnaACompletar { item: GradeItem; faltan: string[]; clave: string }

/**
 * Las actividades que la mayoría de la clase ya tiene calificadas y a las que
 * les falta la nota de alguien, de la más reciente a la más antigua. Con menos
 * de la mitad calificada no se dice nada: el docente aún está en ello.
 */
export function columnasACompletar(items: GradeItem[], grades: GradeMap, alumnos: string[]): ColumnaACompletar[] {
  if (alumnos.length < 2) return [];
  return items
    .map(item => ({ item, faltan: alumnos.filter(id => typeof grades[item.id]?.[id] !== 'number') }))
    .filter(x => x.faltan.length > 0 && alumnos.length - x.faltan.length >= Math.ceil(alumnos.length / 2))
    .sort((a, b) => (b.item.date || '').localeCompare(a.item.date || ''))
    .map(x => ({ ...x, clave: `sinnota:${x.item.id}` }));
}

/* ── Lo que ya se ha visto ── */

const CLAVE = 'aulapro_sugerencias_vistas';
const MAXIMO = 400;

export function sugerenciasVistas(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

/** Apunta una sugerencia como vista (cerrada o atendida) y devuelve la lista nueva. Se guardan las últimas `MAXIMO`. */
export function marcarSugerenciaVista(clave: string): string[] {
  const lista = [...sugerenciasVistas().filter(x => x !== clave), clave].slice(-MAXIMO);
  try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch { /* sin almacenamiento: solo dura esta visita */ }
  return lista;
}
