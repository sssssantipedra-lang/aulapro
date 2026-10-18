/**
 * La racha de un alumno en «Anotar actitud»: los días seguidos de clase en que
 * tuvo alguna anotación que suma y ninguna que resta.
 *
 * Solo cuentan los días en que el docente anotó a alguien de esa clase (y
 * asignatura): un día sin clase no rompe la racha, un día con clase en que no
 * se le anotó, sí. Mientras no se le haya anotado nada en el día que se está
 * mirando, ese día no cuenta ni a favor ni en contra: se parte del anterior.
 */
import type { ClassMark, ClassMarkType } from '../types';

export function racha(
  marcas: ClassMark[],
  alumno: string,
  hasta: string,
  suma: (tipo: ClassMarkType) => boolean,
): number {
  const dias = [...new Set(marcas.map(m => m.date).filter(d => d <= hasta))].sort().reverse();
  const deAlumno = (dia: string) => marcas.filter(m => m.student_id === alumno && m.date === dia);

  let n = 0;
  for (const [i, dia] of dias.entries()) {
    const suyas = deAlumno(dia);
    if (suyas.length === 0 && i === 0 && dia === hasta) continue;
    if (suyas.length === 0 || suyas.some(m => !suma(m.type)) || !suyas.some(m => suma(m.type))) break;
    n++;
  }
  return n;
}
