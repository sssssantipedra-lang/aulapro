/**
 * Dónde se guarda lo que genera la app en Android (petición del dueño,
 * 18-10-2026): dentro de Documentos, una carpeta general «AulaPro» y, dentro,
 * una por cada tipo de cosa que se guarda (fichas, actas, informes…), en vez
 * de todo suelto en Descargas. Quien llama a `docs.savePdf` o a
 * `downloadFile` dice cuál con `CARPETAS`. En el escritorio no se usa: allí
 * el docente elige dónde guardar.
 */

/** La carpeta general, dentro de Documentos. */
export const CARPETA_RAIZ = 'AulaPro';

export const CARPETAS = {
  fichas: 'Fichas',
  situaciones: 'Situaciones de aprendizaje',
  actas: 'Actas',
  informes: 'Informes',
  ef: 'Educación Física',
  aula: 'Aula',
  reuniones: 'Reuniones y formaciones',
  apoyo: 'Apoyo',
  cuaderno: 'Cuaderno',
  copias: 'Copias de seguridad',
  otros: 'Otros',
} as const;

export type CarpetaAulaPro = typeof CARPETAS[keyof typeof CARPETAS];

/** El nombre de una carpeta sin lo que Android no admite en una ruta; vacío o raro, «Otros». */
export function nombreDeCarpeta(carpeta: string | undefined): string {
  const sinRaros = [...(carpeta ?? '')].map(c => (c.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(c) ? ' ' : c)).join('');
  const limpio = sinRaros.replace(/\s+/g, ' ').replace(/^[.\s]+/, '').slice(0, 60).trim();
  return limpio || CARPETAS.otros;
}

/** La ruta, tal como se la enseña al docente: «Documentos › AulaPro › Fichas». */
export function rutaLegible(carpeta: string): string {
  return ['Documentos', CARPETA_RAIZ, nombreDeCarpeta(carpeta)].join(' › ');
}
