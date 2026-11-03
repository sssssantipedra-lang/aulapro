/**
 * Los objetivos de una adaptación curricular significativa, en los programas del especialista de PT y AL: van al
 * programa de la adaptación (en la Comunitat Valenciana, el de la ACIS del PAP; en el resto, uno con el nombre de la
 * adaptación y el área), con su trimestre y su criterio oficial, y con el origen «ACS». Los que ya están no se repiten.
 */
import { ambitosDe } from './apoyo';
import type { ModeloAcs } from './acsModelos';
import type { ComunidadId } from './curriculum/comunidades';
import type { AcsApoyo, ApoyoData, ObjetivoApoyo } from '../types/apoyo';

const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** El nombre del programa al que van los objetivos de la adaptación. */
export function ambitoDeAcs(
  acs: AcsApoyo, modelo: ModeloAcs, comunidad: ComunidadId | undefined, lang: 'es' | 'en' | 'ca', t: (k: string) => string,
): string {
  const oficial = ambitosDe(comunidad, lang);
  const acis = oficial.oficial ? oficial.ambitos.find(a => /ACIS/.test(a.nombre)) : undefined;
  return acis ? acis.nombre : `${t(modelo.tarjeta)} · ${acs.materiaAula.trim() || acs.area}`;
}

export function objetivosAcsAProgramas(
  d: ApoyoData, acs: AcsApoyo, ambito: string, materia: string, idNuevo: (p: string) => string,
): { data: ApoyoData; pasados: number } {
  const objetivos = (acs.objetivos ?? []).filter(o => o.texto.trim());
  const yaEsta = (texto: string) => d.programas.some(p => p.alumnoId === acs.alumnoId && p.objetivos.some(x => igual(x.texto, texto)));
  const nuevos: ObjetivoApoyo[] = objetivos.filter(o => !yaEsta(o.texto)).map(o => ({
    id: idNuevo('obj'), texto: o.texto.trim(), trimestres: o.trimestres,
    criterios: o.criterio ? [{ materia, codigo: o.criterio }] : [], origen: 'acs',
  }));
  if (!nuevos.length) return { data: d, pasados: 0 };
  const existe = d.programas.find(p => p.alumnoId === acs.alumnoId && p.ambito === ambito);
  const programas = existe
    ? d.programas.map(p => (p === existe ? { ...p, objetivos: [...p.objetivos, ...nuevos] } : p))
    : [...d.programas, { id: idNuevo('pro'), alumnoId: acs.alumnoId, ambito, especialidad: 'PT' as const, objetivos: nuevos }];
  return { data: { ...d, programas }, pasados: nuevos.length };
}
