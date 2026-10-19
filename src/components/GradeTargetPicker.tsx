import { useId } from 'react';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import type { Class, ClassTarget, GradeCategory, GradeTarget } from '../types';
import { objetivosDe } from '../lib/objetivos';
import { useI18n } from '../i18n';

interface Props {
  value: GradeTarget;
  onChange: (next: GradeTarget) => void;
  classes: Class[];
  gradeCategories: GradeCategory[];
  /** Clases que ya eligió otra fila: no se ofrecen aquí. */
  excluidas?: string[];
  /** Es una clase más (no la primera): sin «solo historial» y con botón para quitarla. */
  adicional?: boolean;
  onQuitar?: () => void;
}

/**
 * Elige a dónde va la nota de una rúbrica o una diana: clase, asignatura y
 * categoría del cuaderno.
 *
 * Mientras no se elija una categoría, el instrumento sigue funcionando como
 * antes: la evaluación se guarda en el Historial y no toca el cuaderno. Por
 * eso «Solo el historial» es una opción legítima y no un estado a medias.
 */
export function GradeTargetPicker({ value, onChange, classes, gradeCategories, excluidas = [], adicional = false, onQuitar }: Props) {
  const { t } = useI18n();
  const uid = useId();
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
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', flex: 1 }}>
          {t(adicional ? 'Otra clase donde se usa' : 'Dónde se guarda la nota')}
        </span>
        {onQuitar && (
          <button type="button" className="ico-btn" onClick={onQuitar} title={t('Quitar esta clase')} aria-label={t('Quitar esta clase')}>
            <Trash2 size={14} color="var(--danger)" />
          </button>
        )}
      </div>

      <div className="frow">
        <div className="fgroup">
          <label className="flabel" htmlFor={`${uid}-clase`}>{t('Clase')}</label>
          <select id={`${uid}-clase`} className="finput" value={value.class_id ?? ''} style={{ cursor: 'pointer' }}
            onChange={e => pickClass(e.target.value)}>
            {!adicional && <option value="">{t('Sin clase (solo historial)')}</option>}
            {adicional && !value.class_id && <option value="">{t('Elige la clase')}</option>}
            {classes.filter(c => !excluidas.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {subjects.length > 1 && (
          <div className="fgroup">
            <label className="flabel" htmlFor={`${uid}-asig`}>{t('Asignatura')}</label>
            <select id={`${uid}-asig`} className="finput" value={subject ?? ''} style={{ cursor: 'pointer' }}
              onChange={e => onChange({ ...value, subject: e.target.value, category_id: undefined })}>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      {value.class_id && (
        <div className="fgroup" style={{ marginBottom: 0 }}>
          <label className="flabel" htmlFor={`${uid}-cat`}>{t('Categoría del cuaderno')}</label>
          {cats.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--warn)', lineHeight: 1.5, margin: 0 }}>
              {t('Esta asignatura todavía no tiene categorías en el cuaderno. Crea una (Exámenes, Trabajos…) y vuelve aquí; mientras tanto la evaluación se guardará solo en el historial.')}
            </p>
          ) : (
            <select id={`${uid}-cat`} className="finput" value={value.category_id ?? ''} style={{ cursor: 'pointer' }}
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


/**
 * Las clases de un instrumento: la primera y, si hace falta, otras (decisión
 * del dueño, 19-10-2026: la misma rúbrica o diana sirve para dos o tres
 * clases y no hay que duplicarla). Cada clase lleva su asignatura y su
 * categoría del cuaderno, y por tanto su propia columna. Ver `lib/objetivos.ts`.
 */
export function GradeTargetsPicker({ value, onChange, classes, gradeCategories }: Omit<Props, 'excluidas' | 'adicional' | 'onQuitar'>) {
  const { t } = useI18n();
  const filas: ClassTarget[] = objetivosDe(value);
  const primera: GradeTarget = filas[0] ?? {};
  const otras = filas.slice(1);

  const emitir = (nueva: GradeTarget, resto: ClassTarget[]) =>
    onChange(nueva.class_id ? { ...nueva, otras_clases: resto.length ? resto : undefined } : { ...nueva, otras_clases: undefined });

  const usadas = filas.map(f => f.class_id);
  const libres = classes.filter(c => !usadas.includes(c.id));

  function quitar(i: number) {
    // Quitar la primera deja pasar a la siguiente a ser la principal
    if (i === 0) {
      const [sig, ...resto] = otras;
      emitir(sig ? { class_id: sig.class_id, subject: sig.subject, category_id: sig.category_id } : {}, resto);
    } else {
      emitir(primera, otras.filter((_, j) => j !== i - 1));
    }
  }

  function anadir() {
    const c = libres[0];
    if (!c) return;
    const subs = c.subjects?.length ? c.subjects : [c.subject];
    emitir(primera, [...otras, { class_id: c.id, subject: subs[0] }]);
  }

  return (
    <>
      <GradeTargetPicker
        value={primera} classes={classes} gradeCategories={gradeCategories}
        excluidas={usadas.filter(id => id !== primera.class_id)}
        onChange={n => emitir(n, n.class_id ? otras.filter(o => o.class_id !== n.class_id) : [])}
        onQuitar={otras.length > 0 ? () => quitar(0) : undefined}
      />
      {otras.map((o, i) => (
        <GradeTargetPicker
          key={o.class_id} adicional value={o} classes={classes} gradeCategories={gradeCategories}
          excluidas={usadas.filter(id => id !== o.class_id)}
          onChange={n => (n.class_id
            ? emitir(primera, otras.map((x, j) => (j === i ? { class_id: n.class_id as string, subject: n.subject, category_id: n.category_id } : x)))
            : quitar(i + 1))}
          onQuitar={() => quitar(i + 1)}
        />
      ))}
      {primera.class_id && libres.length > 0 && (
        <button type="button" className="btn-ghost" style={{ fontSize: 12.5, marginBottom: 16 }} onClick={anadir}>
          <Plus size={13} />{t('Usarla también en otra clase')}
        </button>
      )}
      {otras.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '-6px 0 16px', lineHeight: 1.5 }}>
          {t('Cada clase tiene su propia columna en su cuaderno, con la categoría que elijas para ella.')}
        </p>
      )}
    </>
  );
}
