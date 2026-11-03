/**
 * La adaptación curricular significativa de un alumno de «Mis clases», para el docente de aula o de EF (decisión del
 * dueño, 3-11-2026: las dos vías, hacerla él o recibir la del especialista de PT). Es la misma pantalla que en PT y AL
 * (`pages/apoyo/AcsApoyo.tsx`, modo `aula`) sobre `ApoyoData.acsAula`, con el modelo de la comunidad del perfil.
 * Recibir: `RecibirAcs.tsx`. Ver `docs/PTAL.md`, «La adaptación en el aula».
 */
import { useMemo, useState } from 'react';
import { AcsApoyo } from '../../pages/apoyo/AcsApoyo';
import { RecibirAcs } from './RecibirAcs';
import { useMateriasDeNivel } from '../../hooks/useMateriasDeNivel';
import { useI18n } from '../../i18n';
import { useNombreCurso } from '../../hooks/useNombreCurso';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { Class, Student } from '../../types';
import type { AlumnoApoyo, ApoyoData, CursoDe } from '../../types/apoyo';
import type { DocenteAcs } from '../../services/acsDocumento';

const CURSOS: CursoDe[] = [
  ...[1, 2, 3, 4, 5, 6].map(curso => ({ etapa: 'primaria' as const, curso })),
  ...[1, 2, 3, 4].map(curso => ({ etapa: 'eso' as const, curso })),
];
const ordinal = (c: CursoDe) => (c.etapa === 'primaria' ? c.curso : 6 + c.curso);

/** El curso de su clase, si la clase lo tiene. */
export function cursoDeClase(cls: Class | undefined): CursoDe | undefined {
  if (!cls?.etapa || !cls.curso) return undefined;
  return cls.etapa === 'primaria' || cls.etapa === 'eso' ? { etapa: cls.etapa, curso: cls.curso } : undefined;
}

/** El alumno de la clase, con la forma que espera la pantalla de la adaptación. */
export function alumnoDeClase(s: Student, cls: Class | undefined, nivel: CursoDe | undefined): AlumnoApoyo {
  return {
    id: s.id, nombre: s.name, claseOrigen: cls?.name ?? '', matricula: cursoDeClase(cls), nivel,
    categorias: [], diagnostico: '', necesidades: '', notas: '',
  };
}

interface Props {
  student: Student;
  cls: Class | undefined;
  apoyo: ApoyoData;
  onApoyo: (f: (d: ApoyoData) => ApoyoData) => void;
  comunidad: ComunidadId | undefined;
  docente: DocenteAcs;
}

export function AcsDeAlumno({ student, cls, apoyo, onApoyo, comunidad, docente }: Props) {
  const { t } = useI18n();
  const nombreCurso = useNombreCurso();
  const matricula = cursoDeClase(cls);
  // De partida, dos cursos por debajo del suyo; se cambia aquí y dentro de cada adaptación
  const [nivel, setNivel] = useState<CursoDe | undefined>(() =>
    matricula ? CURSOS.find(c => ordinal(c) === Math.max(1, ordinal(matricula) - 2)) : undefined);
  const { materias } = useMateriasDeNivel(comunidad, nivel);
  const alumno = useMemo(() => alumnoDeClase(student, cls, nivel), [student, cls, nivel]);
  const clave = (c: CursoDe) => `${c.etapa}-${c.curso}`;
  return (
    <div className="acs-aula">
      <div className="fgroup">
        <label className="flabel" htmlFor="acs-aula-nivel">{t('Curso de referencia para una adaptación nueva')}</label>
        <select id="acs-aula-nivel" className="finput" value={nivel ? clave(nivel) : ''}
          onChange={e => setNivel(CURSOS.find(c => clave(c) === e.target.value))}>
          {!nivel && <option value="">{t('Elige un curso')}</option>}
          {CURSOS.map(c => <option key={clave(c)} value={clave(c)}>{nombreCurso(c)}</option>)}
        </select>
      </div>
      <AcsApoyo alumno={alumno} data={apoyo} onChange={onApoyo} materias={materias} comunidad={comunidad} docente={docente} modo="aula"
        extra={<RecibirAcs alumnoId={student.id} onApoyo={onApoyo} />} />
    </div>
  );
}
