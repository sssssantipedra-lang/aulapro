/**
 * Los documentos de todo el alumnado de una vez (informe a la familia o al tutor, seguimiento del PAP o
 * programación): se prepara uno por alumno, de uno en uno, y se va guardando cada uno al acabar, para que una
 * interrupción no pierda lo hecho. El docente los revisa después alumno a alumno. Ver `docs/PTAL.md`.
 */
import type { Lang } from '../i18n';
import { materiasDeNivel } from '../lib/curriculum/materiasDeNivel';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import { nivelDe, trimestreCerrado } from '../lib/apoyo';
import { generarDocumento, type GenerarArgs } from './apoyoDocumentos';
import type { AlumnoApoyo, ApoyoData, CursoDe, DocumentoApoyo, TipoDocumentoApoyo, Trimestre } from '../types/apoyo';

export interface FilaLote {
  alumno: AlumnoApoyo;
  /** Sin programas no hay de qué redactar. */
  conProgramas: boolean;
  /** El trimestre ya está cerrado (la programación no depende de él). */
  cerrado: boolean;
  /** El documento que ya hay de ese tipo y trimestre; se sustituye al generar (el PAP se va rellenando). */
  existente?: DocumentoApoyo;
}

/** El documento que ya tiene un alumno: la programación y el PAP son uno por curso; los informes, uno por trimestre. */
export function documentoExistente(d: ApoyoData, alumnoId: string, tipo: TipoDocumentoApoyo, trimestre: Trimestre): DocumentoApoyo | undefined {
  return d.documentos.find(x => x.alumnoId === alumnoId && x.tipo === tipo && (tipo === 'programacion' || tipo === 'pap' || x.trimestre === trimestre));
}

export function filasDeLote(d: ApoyoData, tipo: TipoDocumentoApoyo, trimestre: Trimestre): FilaLote[] {
  return d.alumnos.map(alumno => ({
    alumno,
    conProgramas: d.programas.some(p => p.alumnoId === alumno.id),
    cerrado: tipo === 'programacion' || trimestreCerrado(d, alumno.id, trimestre),
    existente: documentoExistente(d, alumno.id, tipo, trimestre),
  }));
}

export interface ResultadoLote { hechos: number; fallidos: string[]; cancelado: boolean }

export async function generarLote(args: {
  data: ApoyoData;
  tipo: TipoDocumentoApoyo;
  trimestre: Trimestre;
  alumnoIds: readonly string[];
  comunidad: ComunidadId | undefined;
  lang: Lang;
  nombreCurso: (c: CursoDe) => string;
  hoy: string;
  /** Se llama con cada documento en cuanto está hecho. */
  alTerminar: (doc: DocumentoApoyo) => void;
  alEmpezar?: (alumno: AlumnoApoyo, n: number, total: number) => void;
  /** Para parar entre un alumno y el siguiente. */
  cancelado?: () => boolean;
  /** Sustituibles en las pruebas. */
  generar?: typeof generarDocumento;
  abrirMaterias?: typeof materiasDeNivel;
}): Promise<ResultadoLote> {
  const { data, tipo, trimestre, alumnoIds, comunidad, lang, nombreCurso, hoy } = args;
  const generar = args.generar ?? generarDocumento;
  const abrirMaterias = args.abrirMaterias ?? materiasDeNivel;
  const alumnos = alumnoIds.map(id => data.alumnos.find(a => a.id === id)).filter((a): a is AlumnoApoyo => !!a);
  const fallidos: string[] = [];
  let hechos = 0;
  for (const [i, alumno] of alumnos.entries()) {
    if (args.cancelado?.()) return { hechos, fallidos, cancelado: true };
    args.alEmpezar?.(alumno, i + 1, alumnos.length);
    let error = false;
    const a: GenerarArgs = {
      tipo, alumno, trimestre, data, comunidad, lang, nombreCurso, hoy,
      materias: await abrirMaterias(comunidad, nivelDe(alumno), lang === 'ca' ? 'ca' : lang === 'en' ? 'en' : 'es'),
      anterior: documentoExistente(data, alumno.id, tipo, trimestre),
    };
    const doc = await generar(a, { onError: () => { error = true; } });
    if (doc && !error) { args.alTerminar(doc); hechos++; } else fallidos.push(alumno.nombre);
  }
  return { hechos, fallidos, cancelado: false };
}
