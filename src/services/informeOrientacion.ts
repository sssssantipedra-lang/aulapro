/**
 * El informe sociopsicopedagógico del orientador. Desde el 3-11-2026 (revisión del abogado del dueño: un informe
 * describe el cuadro clínico con frases que ningún filtro reconoce del todo) **la IA no lo lee**: el docente anota en
 * la ficha lo que dice (fortalezas, orientaciones, programas, objetivos y los apoyos que necesita en el aula), y la IA
 * solo recibe eso, sin diagnóstico ni categoría. El informe no se guarda. Ver `docs/PTAL.md`, «El informe del
 * orientador».
 *
 * `leerArchivoInforme` sigue sirviendo para la programación de aula del tutor (`AdaptacionApoyo`), que no lleva datos
 * de salud del alumno.
 */
import { currentPseudonymizer } from './privacy';
import { conObjetivosOrientacion } from '../lib/apoyo';
import { EXTENSIONES_DOCUMENTO, leerDocumento, textoDeDocumento } from '../lib/documentoParaIA';
import type { AlumnoApoyo, CursoDe, InformeOrientacion, ObjetivoOrientacion } from '../types/apoyo';

export const MAX_BYTES_INFORME = 19 * 1024 * 1024;
export const EXTENSIONES_INFORME = EXTENSIONES_DOCUMENTO;

/** Lo que se le da a la IA del informe: siempre su texto (pegado o leído del archivo en el navegador). */
export interface FuenteInforme { texto?: string; nombre?: string }

/**
 * Lo que la IA recibe de un documento del alumnado, tal como se enseña al docente para que lo revise: sin los datos
 * que identifican (`quitarIdentificadores`) y con los nombres del alumnado cambiados por su código. `callGemini`
 * vuelve a enmascarar al enviar, así que lo pegado a mano también sale sin nombres.
 */
export const textoParaRevisar = (texto: string) => textoDeDocumento(texto, t => currentPseudonymizer().mask(t));

/**
 * Abre el archivo del informe (o de la programación) y lo convierte en texto en el navegador, también un PDF: desde el
 * 31-10-2026 el archivo nunca se envía (`docs/PTAL.md`). Errores: «grande», «escaneado», «doc» y «formato».
 */
export async function leerArchivoInforme(file: File): Promise<FuenteInforme> {
  if (file.size > MAX_BYTES_INFORME) throw new Error('grande');
  return { texto: textoParaRevisar(await leerDocumento(file)), nombre: file.name };
}

export interface PropuestaInforme {
  categorias: string[];
  diagnostico: string;
  necesidades: string;
  /** Los apoyos que necesita en el aula (`APOYOS_AULA`). */
  apoyos: string[];
  nivel?: CursoDe;
  fortalezas: string;
  orientaciones: string;
  ambitos: string[];
  /** Los objetivos nuevos que el informe plantea, tal como los dice. */
  objetivos: ObjetivoOrientacion[];
}

/** Lo que ya tiene su ficha, para empezar a anotar el informe sobre ello. */
export function propuestaDesdeFicha(a: AlumnoApoyo): PropuestaInforme {
  return {
    categorias: [...a.categorias], diagnostico: a.diagnostico, necesidades: a.necesidades, apoyos: [...(a.apoyos ?? [])],
    fortalezas: a.informe?.fortalezas ?? '', orientaciones: a.informe?.orientaciones ?? '', ambitos: [...(a.informe?.ambitos ?? [])],
    objetivos: [],
  };
}

/**
 * La ficha del alumno con lo que el docente ha anotado del informe (la propuesta parte de su ficha, así que lo que
 * quita, se quita). Los objetivos del informe se suman a los que ya hubiera de la orientación, sin repetir.
 */
export function conInforme(a: AlumnoApoyo, p: PropuestaInforme, archivo: string | undefined, hoy: string): AlumnoApoyo {
  const informe: InformeOrientacion = {
    fecha: hoy, ...(archivo ? { archivo } : {}), fortalezas: p.fortalezas.trim(), orientaciones: p.orientaciones.trim(), ambitos: p.ambitos,
  };
  return conObjetivosOrientacion({
    ...a,
    categorias: [...new Set(p.categorias)],
    diagnostico: p.diagnostico.trim(),
    necesidades: p.necesidades.trim(),
    ...(p.apoyos.length ? { apoyos: [...new Set(p.apoyos)] } : { apoyos: undefined }),
    ...(p.nivel ? { nivel: p.nivel } : {}),
    informe,
  }, p.objetivos);
}
