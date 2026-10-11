/**
 * Portada de Mis clases (decisión del dueño, 11-10-2026): todas las clases
 * como tarjetas, agrupadas en Primaria, ESO y las demás, con su asignatura,
 * cuántos alumnos tiene, su media y cuántos alumnos tienen avisos. Al pulsar
 * una se entra en su alumnado.
 */
import { AlertTriangle, ChevronRight, Users } from 'lucide-react';
import type { Class, GradeCategory, GradeItem, GradeMap, Student } from '../../types';
import { weightedAverage } from '../../services/aiContext';
import { agruparPorEtapa } from '../../lib/etapas';
import { useI18n } from '../../i18n';

interface Props {
  classes: Class[];
  students: Student[];
  gradeCategories?: GradeCategory[];
  gradeItems?: GradeItem[];
  grades?: GradeMap;
  onOpen: (id: string) => void;
}

const notaColor = (v: number) => (v < 5 ? 'var(--grade-bad)' : v < 7 ? 'var(--grade-mid)' : 'var(--grade-good)');

export function ClassCards({ classes, students, gradeCategories = [], gradeItems = [], grades = {}, onOpen }: Props) {
  const { t, locale } = useI18n();

  const resumen = (c: Class) => {
    const suyos = students.filter(s => s.class_id === c.id);
    const cats = gradeCategories.filter(g => g.class_id === c.id);
    const items = gradeItems.filter(i => i.class_id === c.id);
    const medias = suyos.map(s => weightedAverage(s.id, cats, items, grades)).filter((v): v is number => v !== null);
    return {
      alumnos: suyos.length,
      avisos: suyos.filter(s => s.alerts.length > 0).length,
      media: medias.length ? medias.reduce((a, b) => a + b, 0) / medias.length : null,
    };
  };

  return (
    <div className="cls-groups">
      {agruparPorEtapa(classes).map(g => (
        <section key={g.id} aria-label={t(g.label)}>
          <h2 className="cls-group-ttl">{t(g.label)}</h2>
          <div className="cls-grid">
            {g.clases.map(c => {
              const r = resumen(c);
              return (
                <button key={c.id} type="button" className="cls-card" style={{ '--cls-c': c.color } as React.CSSProperties} onClick={() => onOpen(c.id)}>
                  <span className="cls-card-hd">
                    <span className="cls-card-dot" aria-hidden="true" />
                    <span className="cls-card-name">{c.name}</span>
                    {c.isTutoria && <span className="cls-card-tag">{t('Tutoría')}</span>}
                    <ChevronRight size={16} className="cls-card-go" aria-hidden="true" />
                  </span>
                  <span className="cls-card-subj">{(c.subjects?.length ? c.subjects : [c.subject]).join(' · ')}</span>
                  <span className="cls-card-ft">
                    <span className="cls-card-stat"><Users size={13} />{t(r.alumnos === 1 ? '{n} alumno' : '{n} alumnos', { n: r.alumnos })}</span>
                    {r.avisos > 0 && (
                      <span className="cls-card-stat warn" title={t('Alumnos con avisos')}><AlertTriangle size={13} />{r.avisos}</span>
                    )}
                    {r.media !== null && (
                      <span className="cls-card-avg" title={t('Media de la clase')} style={{ color: notaColor(r.media) }}>
                        {r.media.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
