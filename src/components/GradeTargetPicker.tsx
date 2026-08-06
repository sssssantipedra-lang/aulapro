import { BookOpen } from 'lucide-react';
import type { Class, GradeCategory, GradeTarget } from '../types';
import { useI18n } from '../i18n';

interface Props {
  value: GradeTarget;
  onChange: (next: GradeTarget) => void;
  classes: Class[];
  gradeCategories: GradeCategory[];
}

/**
 * Elige a dónde va la nota de una rúbrica o una diana: clase, asignatura y
 * categoría del cuaderno.
 *
 * Mientras no se elija una categoría, el instrumento sigue funcionando como
 * antes: la evaluación se guarda en el Historial y no toca el cuaderno. Por
 * eso «Solo el historial» es una opción legítima y no un estado a medias.
 */
export function GradeTargetPicker({ value, onChange, classes, gradeCategories }: Props) {
  const { t } = useI18n();
  const cls = classes.find(c => c.id === value.class_id);
  const subjects = cls?.subjects?.length ? cls.subjects : cls ? [cls.subject] : [];
  const subject = value.subject && subjects.includes(value.subject) ? value.subject : subjects[0];

  const cats = gradeCategories.filter(c =>
    c.class_id === value.class_id &&
    (c.subject ?? subjects[0] ?? '') === (subject ?? ''));

  function pickClass(id: string) {
    if (!id) { onChange({}); return; }
    const next = classes.find(c => c.id === id);
    const subs = next?.subjects?.length ? next.subjects : next ? [next.subject] : [];
    // Al cambiar de clase, la asignatura y la categoría anteriores ya no valen
    onChange({ class_id: id, subject: subs[0], category_id: undefined });
  }

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 12,
      padding: '14px 16px', marginBottom: 16, background: 'var(--surface)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <BookOpen size={15} color="var(--accent-d)" />
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
          {t('Dónde se guarda la nota')}
        </span>
      </div>

      <div className="frow">
        <div className="fgroup">
          <label className="flabel">{t('Clase')}</label>
          <select className="finput" value={value.class_id ?? ''} style={{ cursor: 'pointer' }}
            onChange={e => pickClass(e.target.value)}>
            <option value="">{t('Sin clase (solo historial)')}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {subjects.length > 1 && (
          <div className="fgroup">
            <label className="flabel">{t('Asignatura')}</label>
            <select className="finput" value={subject ?? ''} style={{ cursor: 'pointer' }}
              onChange={e => onChange({ ...value, subject: e.target.value, category_id: undefined })}>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      {value.class_id && (
        <div className="fgroup" style={{ marginBottom: 0 }}>
          <label className="flabel">{t('Categoría del cuaderno')}</label>
          {cats.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--warn)', lineHeight: 1.5, margin: 0 }}>
              {t('Esta asignatura todavía no tiene categorías en el cuaderno. Crea una (Exámenes, Trabajos…) y vuelve aquí; mientras tanto la evaluación se guardará solo en el historial.')}
            </p>
          ) : (
            <select className="finput" value={value.category_id ?? ''} style={{ cursor: 'pointer' }}
              onChange={e => onChange({ ...value, subject, category_id: e.target.value || undefined })}>
              <option value="">{t('Solo el historial, no el cuaderno')}</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name} ({c.weight}%)</option>)}
            </select>
          )}
        </div>
      )}

      {value.class_id && value.category_id && (
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 10, lineHeight: 1.5 }}>
          {t('Cada alumno que evalúes aparecerá al momento en el cuaderno, en una columna propia de este instrumento.')}{' '}
          <strong>{t('Si vuelves a evaluar al mismo alumno, su nota anterior se sustituye.')}</strong>
        </p>
      )}
    </div>
  );
}
