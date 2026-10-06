/**
 * Qué tipo de docente es un perfil: de aula, especialista de PT y AL o de
 * Educación Física. Cada uno tiene su menú y su Inicio (ver `navigation.ts`).
 *
 * El de PT y AL se reconoce por sus especialidades (así se guardó desde la
 * 2.1.0); el de EF, por `tipoDocente: 'ef'`. EF puede ser además tutor de un
 * grupo, el que tenga marcado «Es mi tutoría» en Mis Clases (el 2 en 1 que
 * pidió el dueño el 5-10-2026, ver `docs/EF.md`).
 */
export type TipoDocente = 'aula' | 'apoyo' | 'ef';

export function tipoDePerfil(p: { especialidades?: unknown; tipoDocente?: unknown } | null | undefined): TipoDocente {
  if (Array.isArray(p?.especialidades) && p.especialidades.some(e => e === 'PT' || e === 'AL')) return 'apoyo';
  return p?.tipoDocente === 'ef' ? 'ef' : 'aula';
}
