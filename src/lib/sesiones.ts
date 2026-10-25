/**
 * «Sesiones» de todo el profesorado (decisión del dueño, 21-10-2026): el mismo
 * apartado para Educación Física y para el docente de aula. La clase es la
 * portada (una tarjeta por clase); dentro, las sesiones van agrupadas por su
 * situación de aprendizaje, y se pueden elegir varias para borrarlas,
 * archivarlas, asociarlas a una SdA o crear una SdA con ellas.
 *
 * Aquí, lo que se calcula sin pantalla. La sesión es `SesionEF` (el nombre
 * viene de cuando solo la tenía EF); `sdaId` la une a una SdA.
 */
import { imagenesDeSesionSda } from './imagenesSesion';
import type { LearningSituation } from '../types';
import type { SesionEF } from '../types/ef';
import { sesionParaEF } from './sesionSda';
import type { SdaContent } from '../services/learningSituations';

const porFecha = (a: SesionEF, b: SesionEF) => (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999');

/** Las sesiones que se ven: las no archivadas. */
export const activas = (sesiones: readonly SesionEF[]): SesionEF[] => sesiones.filter(s => !s.archivada);

export interface ResumenClase {
  total: number;
  hechas: number;
  /** La siguiente sin completar: la de fecha más próxima desde hoy, o, si no hay con fecha, la primera sin fecha. */
  proxima?: SesionEF;
  /** Con su día ya pasado y sin completar. */
  atrasadas: number;
  archivadas: number;
}

export function resumenDeClase(sesiones: readonly SesionEF[], hoy: string): ResumenClase {
  const vivas = activas(sesiones);
  const pendientes = vivas.filter(s => !s.completada);
  return {
    total: vivas.length,
    hechas: vivas.length - pendientes.length,
    proxima: [...pendientes.filter(s => s.fecha && s.fecha >= hoy)].sort(porFecha)[0] ?? pendientes.find(s => !s.fecha),
    atrasadas: pendientes.filter(s => s.fecha && s.fecha < hoy).length,
    archivadas: sesiones.length - vivas.length,
  };
}

export interface GrupoSda {
  /** El id de la SdA, o `sin-sda`. */
  key: string;
  sda?: LearningSituation;
  sesiones: SesionEF[];
}

const numeroDeSda = (s: LearningSituation) => {
  const n = parseInt(s.request.numero, 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};

/**
 * Las sesiones de una clase agrupadas por situación de aprendizaje: primero las
 * SdA (por su número y su título), dentro de cada una por su orden y su fecha,
 * y al final las que no tienen ninguna. Una sesión cuya SdA ya no existe cuenta como «sin SdA».
 */
export function agruparPorSda(sesiones: readonly SesionEF[], sdas: readonly LearningSituation[]): GrupoSda[] {
  const grupos = new Map<string, GrupoSda>();
  for (const s of sesiones) {
    const sda = s.sdaId ? sdas.find(x => x.id === s.sdaId) : undefined;
    const key = sda ? sda.id : 'sin-sda';
    if (!grupos.has(key)) grupos.set(key, { key, ...(sda ? { sda } : {}), sesiones: [] });
    grupos.get(key)!.sesiones.push(s);
  }
  const ordenSesion = (a: SesionEF, b: SesionEF) => (a.sdaOrden ?? 1e9) - (b.sdaOrden ?? 1e9) || porFecha(a, b);
  return [...grupos.values()]
    .map(g => ({ ...g, sesiones: g.sda ? [...g.sesiones].sort(ordenSesion) : [...g.sesiones].sort(porFecha) }))
    .sort((a, b) => {
      if (!a.sda) return 1;
      if (!b.sda) return -1;
      return numeroDeSda(a.sda) - numeroDeSda(b.sda) || a.sda.title.localeCompare(b.sda.title, 'es');
    });
}

/* ── Acciones en bloque ── */

export const quitarSesiones = (sesiones: readonly SesionEF[], ids: ReadonlySet<string>): SesionEF[] =>
  sesiones.filter(s => !ids.has(s.id));

export function archivarSesiones(sesiones: readonly SesionEF[], ids: ReadonlySet<string>, archivada: boolean): SesionEF[] {
  return sesiones.map(s => {
    if (!ids.has(s.id)) return s;
    if (archivada) return { ...s, archivada: true };
    const { archivada: _a, ...resto } = s;
    void _a;
    return resto;
  });
}

/**
 * Asocia las sesiones a una SdA (a continuación de las que ya tiene, en el
 * orden de `ids` si se pasa un array) o, con `sdaId` vacío, las deja sin SdA.
 */
export function asociarASda(sesiones: readonly SesionEF[], ids: readonly string[], sdaId: string | undefined): SesionEF[] {
  const elegidos = new Set(ids);
  let orden = sdaId
    ? Math.max(0, ...sesiones.filter(s => s.sdaId === sdaId && !elegidos.has(s.id)).map(s => s.sdaOrden ?? 0))
    : 0;
  const posicion = new Map(ids.map((id, i) => [id, i]));
  const nuevoOrden = new Map<string, number>();
  [...ids].sort((a, b) => (posicion.get(a) ?? 0) - (posicion.get(b) ?? 0)).forEach(id => nuevoOrden.set(id, ++orden));
  return sesiones.map(s => {
    if (!elegidos.has(s.id)) return s;
    const { sdaId: _i, sdaOrden: _o, ...resto } = s;
    void _i; void _o;
    return sdaId ? { ...resto, sdaId, sdaOrden: nuevoOrden.get(s.id) } : resto;
  });
}

/* ── De la SdA a las sesiones ── */

/**
 * Las sesiones de una SdA como sesiones de «Sesiones», sin fecha para que se
 * repartan en el calendario y ya unidas a su SdA, en su orden. En EF, con los tres
 * momentos de cada sesión en sus partes.
 */
export function sesionesDeSda(
  sda: { id: string; content: SdaContent },
  opciones: { claseId?: string; nuevoId: (i: number) => string; t: (k: string, v?: Record<string, string | number>) => string },
): SesionEF[] {
  const { content } = sda;
  return content.sesiones.map((s, i) => {
    const e = sesionParaEF(s, opciones.t);
    return {
      id: opciones.nuevoId(i),
      titulo: `${i + 1}. ${s.titulo}`,
      ...(opciones.claseId ? { claseId: opciones.claseId } : {}),
      // Con momentos, el objetivo es el resumen de la sesión y cada momento va a su parte; sin ellos, como siempre
      objetivo: s.momentos ? e.objetivo : opciones.t('Sesión {n} de «{sda}» ({fase}).', { n: i + 1, sda: content.titulo, fase: s.fase }),
      calentamiento: e.calentamiento, principal: e.principal, calma: e.calma, material: e.material,
      inclusion: content.inclusionUniversal, planB: '', ia: true,
      sdaId: sda.id, sdaOrden: i + 1,
      // Las imágenes que el docente puso en la sesión de la SdA pasan a la sesión
      ...(imagenesDeSesionSda(s).length ? { imagenes: imagenesDeSesionSda(s) } : {}),
      ...(content.ef?.modalidad ? { modalidad: content.ef.modalidad } : {}),
    };
  });
}
