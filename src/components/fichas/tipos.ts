/** Nombre y emoji de cada tipo de ejercicio, para el editor de fichas. */
import type { FichaExerciseType } from '../../services/resources';

export const TIPO_LABEL: Record<FichaExerciseType, string> = {
  abierta: 'Respuesta abierta',
  completar: 'Completar',
  opcion_multiple: 'Opción múltiple',
  problema: 'Problema',
  tabla_rellenar: 'Tabla para rellenar',
  relacionar: 'Relacionar',
  colorear: 'Colorear según el resultado',
  sopa_letras: 'Sopa de letras',
  verdadero_falso: 'Verdadero o falso',
  ordenar: 'Ordenar',
  crucigrama: 'Crucigrama',
  comic: 'Cómic',
};

export const TIPO_EMOJI: Record<FichaExerciseType, string> = {
  abierta: '✍️', completar: '🔤', opcion_multiple: '🔘', problema: '🧮', tabla_rellenar: '📊',
  relacionar: '🔗', colorear: '🖍️', sopa_letras: '🔎', verdadero_falso: '✅', ordenar: '🔢',
  crucigrama: '🧩', comic: '💬',
};
