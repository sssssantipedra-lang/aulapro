/**
 * Las cuentas de «Repartir con IA» en Distribución de aula (24-11-2026, petición del dueño: «que asigne a los alumnos
 * por mesas, aunque no estén puestos ya en algún grupo, y que se tengan en cuenta todos los parámetros que el usuario
 * pone para hacer ese reparto»).
 *
 * Antes, con más alumnado que asientos la IA dejaba a quien no cabía «sin mesa», y no sabía cuántos asientos había en
 * total, ni la forma de las mesas ni los roles. Aquí, sin IA y con pruebas:
 *   - `estructuraParaTodos`: cuántas mesas (y, si no basta, cuántos asientos por mesa) hacen falta para que quepan
 *     todos, empezando por lo que eligió el docente y añadiendo lo justo.
 *   - `huecosDelPlan`: con «dejar sentados a los que ya tienen mesa», qué asientos quedan libres en cada mesa (los
 *     vacíos y los de alguien que ya no está en la clase), con el rol de cada uno.
 *   - `aplicarReparto`: escribe el resultado en las mesas, cada alumno en el asiento que le toca.
 */
import type { SeatGroup, SeatingPlan } from '../types';
import { seatStudentId } from '../types';

export const MAX_MESAS = 12;
export const MAX_POR_MESA = 8;

/** Cuántas mesas y de cuántos asientos hacen falta para `alumnos`, cambiando lo mínimo lo que eligió el docente. */
export function estructuraParaTodos(alumnos: number, numGroups: number, groupSize: number): { numGroups: number; groupSize: number } {
  if (alumnos <= numGroups * groupSize) return { numGroups, groupSize };
  // Primero, más mesas del mismo tamaño
  const mesas = Math.min(MAX_MESAS, Math.max(numGroups, Math.ceil(alumnos / groupSize)));
  if (mesas * groupSize >= alumnos) return { numGroups: mesas, groupSize };
  // Con las mesas al máximo, un asiento más por mesa
  return { numGroups: mesas, groupSize: Math.min(MAX_POR_MESA, Math.max(groupSize, Math.ceil(alumnos / mesas))) };
}

/** Una mesa a la hora de repartir: quién sigue sentado y qué asientos quedan libres (en su orden). */
export interface HuecosDeMesa {
  label: string;
  /** Quien ya está sentado y se queda, con su asiento. */
  sentados: { id: string; asiento: number }[];
  /** Los asientos libres, en orden. */
  libres: number[];
}

/**
 * Las mesas de un plan con sus asientos libres. Un asiento con alguien que ya no está en la clase cuenta como libre,
 * igual que en «Sentar por orden de lista». Con `todos` (repartir a toda la clase de nuevo), todos los asientos libres.
 */
export function huecosDelPlan(plan: Pick<SeatingPlan, 'groups' | 'groupSize'>, enClase: Set<string>, todos: boolean): HuecosDeMesa[] {
  return plan.groups.map(g => {
    const sentados: HuecosDeMesa['sentados'] = [];
    const libres: number[] = [];
    for (let i = 0; i < plan.groupSize; i++) {
      const id = seatStudentId(g, i);
      if (!todos && id && enClase.has(id)) sentados.push({ id, asiento: i });
      else libres.push(i);
    }
    return { label: g.label, sentados, libres };
  });
}

/**
 * Los roles para un número de asientos nuevo sin que nadie cambie de rol: con la rotación avanzada (`weekOffset`), el
 * asiento i tenía `roles[(i + weekOffset) % groupSize]`; se ponen en ese orden y la rotación vuelve a 0. Los que falten
 * los añade `completar` (los «Rol n» de la pantalla).
 */
export function rolesSinCambiarDeRol<R>(roles: R[], weekOffset: number): R[] {
  const n = roles.length;
  if (n === 0 || weekOffset % n === 0) return roles;
  return Array.from({ length: n }, (_, i) => roles[(i + weekOffset) % n]);
}

/**
 * Las mesas de un plan con otra estructura: conserva las que ya había (con su nombre y su gente, recortada si la mesa
 * encoge) y añade las que falten con el nombre «Mesa n».
 */
export function mesasConEstructura(groups: SeatGroup[], numGroups: number, groupSize: number, nombre: (n: number) => string, nuevoId: () => string): SeatGroup[] {
  return Array.from({ length: numGroups }, (_, i) => groups[i] ?? { id: nuevoId(), label: nombre(i + 1), studentIds: [] })
    .map(g => ({ ...g, studentIds: g.studentIds.slice(0, groupSize) }));
}

/**
 * Sienta a los alumnos repartidos: los de la mesa i van a sus asientos libres, en orden (el primero, al primer asiento
 * libre, que es el del primer rol libre). Quien ya estaba sentado y se queda no se mueve. La justificación de la IA
 * sustituye a la anterior solo si trae una.
 */
export function aplicarReparto(
  groups: SeatGroup[],
  huecos: HuecosDeMesa[],
  reparto: { estudiantes: string[]; justificacion?: string }[],
  groupSize: number,
  /** Repartir a toda la clase de nuevo: la justificación anterior ya no vale y se quita si la IA no trae otra. */
  todos: boolean,
): SeatGroup[] {
  return groups.map((g, i) => {
    const h = huecos[i];
    const ids = Array.from({ length: groupSize }, () => '');
    for (const s of h?.sentados ?? []) ids[s.asiento] = s.id;
    const nuevos = reparto[i]?.estudiantes ?? [];
    (h?.libres ?? []).forEach((asiento, k) => { if (nuevos[k]) ids[asiento] = nuevos[k]; });
    // Sin huecos al final: un asiento vacío al final de la mesa es «no hay más gente»
    while (ids.length && ids[ids.length - 1] === '') ids.pop();
    // Una mesa a la que no ha llegado nadie no ha cambiado: conserva su justificación aunque la IA escriba otra
    const llegaAlguien = nuevos.some(Boolean);
    const justificacion = reparto[i]?.justificacion?.trim();
    if (!todos && !llegaAlguien) return { ...g, studentIds: ids };
    return { ...g, studentIds: ids, justificacion: justificacion || (todos ? undefined : g.justificacion) };
  });
}
