/**
 * Educación Física, «En la pista»: la observación rápida desde el móvil
 * (decisión del dueño, 5-10-2026). Se elige un aspecto (participa, se
 * esfuerza, juego limpio, sin equipación…) y se toca a cada alumno; volver a
 * tocarlo lo quita. Son anotaciones del cuaderno: cuentan en el bloque
 * «Trabajo diario y actitud», con sus partes de EF (ver
 * `services/classMarks.ts`). Ver `docs/EF.md`.
 */
import { useMemo, useState } from 'react';
import { BookOpen, Bandage } from 'lucide-react';
import { useI18n } from '../../i18n';
import { isoDate } from '../../lib/utils';
import { EF_MARK_TYPES, esAsignaturaEF } from '../../services/classMarks';
import { asignaturaEF, exentosDelDia, LIMITACIONES, nuevoIdEF } from '../../lib/ef';
import type { Class, ClassMark, ClassMarkType, ScheduleBlock, Section, Student } from '../../types';
import type { EfData } from '../../types/ef';

interface Props {
  classes: Class[];
  students: Student[];
  scheduleBlocks: ScheduleBlock[];
  classMarks: ClassMark[];
  ef: EfData;
  onAddMark: (m: ClassMark, label: string) => void;
  onDeleteMark: (id: string, label: string) => void;
  onNav: (s: Section) => void;
}

/** La clase que toca ahora o la siguiente de hoy, según el horario. */
function claseDeAhora(blocks: ScheduleBlock[], ahora: Date): string | undefined {
  const dia = ahora.getDay() === 0 ? 7 : ahora.getDay();
  const hm = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
  const hoy = blocks.filter(b => b.day === dia && b.class_id).sort((a, b) => a.time_start.localeCompare(b.time_start));
  return (hoy.find(b => b.time_start <= hm && hm < b.time_end) ?? hoy.find(b => b.time_start > hm))?.class_id;
}

export function EfPista({ classes, students, scheduleBlocks, classMarks, ef, onAddMark, onDeleteMark, onNav }: Props) {
  const { t } = useI18n();
  const [ahora] = useState(() => new Date());
  const hoy = isoDate(ahora);
  const ordenadas = useMemo(
    () => [...classes].sort((a, b) => Number(!a.subjects.some(esAsignaturaEF)) - Number(!b.subjects.some(esAsignaturaEF)) || a.name.localeCompare(b.name)),
    [classes],
  );
  const [claseId, setClaseId] = useState<string | null>(() => claseDeAhora(scheduleBlocks, ahora) ?? null);
  const clase = ordenadas.find(c => c.id === claseId) ?? ordenadas[0] ?? null;
  const [aspecto, setAspecto] = useState<ClassMarkType>('participation');

  if (!clase) {
    return (
      <section className="sec active ap-page">
        <div className="pg-hd"><div><h1 className="pg-title">{t('En la pista')}</h1></div></div>
        <div className="card">
          <p className="ap-vacio">{t('Para observar en la pista, crea primero tus clases con su alumnado.')}</p>
          <button className="btn-accent" style={{ marginTop: 12 }} onClick={() => onNav('classes')}>{t('Ir a Mis Clases')}</button>
        </div>
      </section>
    );
  }

  const asignatura = asignaturaEF(clase);
  const principal = clase.subjects[0] ?? clase.subject;
  const alumnos = students.filter(s => s.class_id === clase.id).sort((a, b) => a.name.localeCompare(b.name));
  const deHoy = classMarks.filter(m => m.class_id === clase.id && m.date === hoy && (m.subject ?? principal) === asignatura);
  const exentos = new Map(exentosDelDia(ef, hoy).map(e => [e.alumnoId, e]));
  const info = EF_MARK_TYPES.find(m => m.id === aspecto)!;

  function tocar(s: Student) {
    const ya = deHoy.find(m => m.student_id === s.id && m.type === aspecto);
    if (ya) { onDeleteMark(ya.id, t(info.label)); return; }
    onAddMark({
      id: nuevoIdEF('mk'),
      class_id: clase!.id, student_id: s.id, type: aspecto, date: hoy,
      ...(asignatura !== principal ? { subject: asignatura } : {}),
    }, t(info.label));
  }

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('En la pista')}</h1>
          <p className="pg-sub">{t('Elige qué observas y toca a cada alumno; otro toque lo quita. Cuenta en el cuaderno, en el bloque «Trabajo diario y actitud».')}</p>
        </div>
        <button className="btn-ghost" onClick={() => onNav('notebook')}><BookOpen size={15} />{t('Cuaderno')}</button>
      </div>

      <div className="chip-row ap-alumnos" role="tablist" aria-label={t('Clase')}>
        {ordenadas.map(c => (
          <button key={c.id} type="button" role="tab" aria-selected={c.id === clase.id}
            className={`chip sm accent${c.id === clase.id ? ' on' : ''}`} onClick={() => setClaseId(c.id)}>{c.name}</button>
        ))}
      </div>

      <div className="ef-aspectos" role="radiogroup" aria-label={t('Qué observas')}>
        {EF_MARK_TYPES.map(m => (
          <button key={m.id} type="button" role="radio" aria-checked={aspecto === m.id}
            className={`ef-aspecto ${m.positive ? 'pos' : 'neg'}${aspecto === m.id ? ' on' : ''}`} onClick={() => setAspecto(m.id)}>
            {m.positive ? '+' : '−'} {t(m.label)}
          </button>
        ))}
      </div>

      {alumnos.length === 0 ? (
        <div className="card"><p className="ap-vacio">{t('Esta clase todavía no tiene alumnado.')}</p></div>
      ) : (
        <ul className="ef-pista">
          {alumnos.map(s => {
            const suyas = deHoy.filter(m => m.student_id === s.id);
            const marcado = suyas.some(m => m.type === aspecto);
            const ex = exentos.get(s.id);
            return (
              <li key={s.id}>
                <button type="button" className={`ef-alumno${marcado ? ` on ${info.positive ? 'pos' : 'neg'}` : ''}`} aria-pressed={marcado} onClick={() => tocar(s)}>
                  <span className="ef-alumno-nom">{s.name}</span>
                  {ex && (
                    <span className="ef-exento" title={ex.tarea}>
                      <Bandage size={12} aria-hidden="true" />
                      {ex.limitaciones.map(l => t(LIMITACIONES.find(x => x.id === l)!.label)).concat(ex.otra.trim() ? [ex.otra.trim()] : []).join(' · ') || t('Exento')}
                    </span>
                  )}
                  {suyas.length > 0 && (
                    <span className="ef-alumno-marcas">
                      {suyas.map(m => {
                        const x = EF_MARK_TYPES.find(y => y.id === m.type);
                        return x ? <span key={m.id} className={`ef-marca ${x.positive ? 'pos' : 'neg'}`}>{t(x.label)}</span> : null;
                      })}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="ap-sub" style={{ marginTop: 14 }}>
        {t(deHoy.length === 1 ? 'Hoy, {n} anotación en {clase}.' : 'Hoy, {n} anotaciones en {clase}.', { n: deHoy.length, clase: clase.name })}
      </p>
    </section>
  );
}
