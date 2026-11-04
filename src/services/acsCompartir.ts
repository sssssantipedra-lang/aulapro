/**
 * El especialista de PT y AL envía las adaptaciones curriculares significativas de un alumno al docente de aula o de
 * EF, en el mismo archivo cifrado con contraseña que «Trabajo compartido» (`copiaCifrada.ts`). Va el alumnado sin
 * nombre ni id (quien recibe elige a qué alumno de su clase se las pone), con sus necesidades específicas de apoyo
 * educativo; no van el diagnóstico, la ficha ni los programas. Ver `docs/PTAL.md`, «La adaptación en el aula».
 */
import { cifrarCopia, type ContenidoCompartido } from './copiaCifrada';
import { emptyBundle } from './paquete';
import { normalizarAcs } from '../lib/acs';
import { curso } from '../lib/apoyo';
import { palabrasDeNombres, sinNombres } from '../lib/barreras';
import type { AcsApoyo, AlumnoApoyo } from '../types/apoyo';

/** Lo que va dentro del archivo, sin cifrar: para las pruebas. */
/** Cada texto de dentro, con el nombre del alumno cambiado por «el alumno», si el docente lo escribió. */
function sinSuNombre<T>(v: T, nombres: readonly string[]): T {
  if (typeof v === 'string') return sinNombres(v, nombres) as T;
  if (Array.isArray(v)) return v.map(x => sinSuNombre(x, nombres)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sinSuNombre(x, nombres)])) as T;
  return v;
}

export function contenidoAcsCompartido(lista: readonly AcsApoyo[], alumno: AlumnoApoyo, de: string, ahora: Date): ContenidoCompartido {
  const nombres = palabrasDeNombres([alumno.nombre]);
  return {
    de, creado: ahora.toISOString(), paquete: emptyBundle(),
    acs: lista.map(a => sinSuNombre({ ...a, alumnoId: '' }, nombres)),
  };
}

export async function archivoAcs(lista: readonly AcsApoyo[], alumno: AlumnoApoyo, de: string, contrasena: string): Promise<Blob> {
  const texto = await cifrarCopia(contenidoAcsCompartido(lista, alumno, de, new Date()), contrasena);
  return new Blob([texto], { type: 'application/json' });
}

/** Las adaptaciones de un archivo ya abierto, para un alumno de la clase, con ids nuevos. Lo que no se entiende se descarta. */
export function acsDelArchivo(contenido: ContenidoCompartido, alumnoId: string, idNuevo: (p: string) => string): AcsApoyo[] {
  return (Array.isArray(contenido.acs) ? contenido.acs : []).flatMap(x => {
    if (!x || typeof x !== 'object') return [];
    const a = normalizarAcs({ ...(x as object), id: idNuevo('acs'), alumnoId }, { has: id => id === alumnoId }, curso);
    return a ? [a] : [];
  });
}
