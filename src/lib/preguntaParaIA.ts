/**
 * Lo que el docente escribe en un chat (el asistente del cuaderno, la ayuda) tal como va a la IA (auditoría del
 * 5-11-2026). Los nombres del alumnado los cambia `callGemini`; aquí se quitan los datos de contacto (un teléfono, un
 * DNI, una dirección) y, si la pregunta nombra a un alumno de la lista, también los datos de salud: «¿qué hago con
 * Lucía, que tiene TDAH?» sale como «¿qué hago con [ALU-…], que tiene [dato de salud]?». Una pregunta que no nombra a
 * nadie conserva esas palabras («¿cómo explico la diabetes en 5º?» es una pregunta de clase, no un dato de un alumno).
 * Lo que no se reconoce: un dato de salud de un alumno al que se señala sin su nombre («el de la tercera fila»).
 */
import { quitarDatosDeContacto, quitarDatosDeSalud } from './documentoParaIA';
import { currentPseudonymizer } from '../services/privacy';

export function preguntaParaIA(texto: string, nombraAlumno: (t: string) => boolean = t => currentPseudonymizer().hasCodes(currentPseudonymizer().mask(t))): string {
  const sinContacto = quitarDatosDeContacto(texto);
  return nombraAlumno(texto) ? quitarDatosDeSalud(sinContacto) : sinContacto;
}
