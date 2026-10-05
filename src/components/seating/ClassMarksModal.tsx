/**
 * Anotar a un alumno desde la Distribución de aula: un toque por anotación
 * («Sin tarea», «Buen comportamiento»…). Todas cuentan en el bloque
 * «Trabajo diario y actitud» del cuaderno (ver services/classMarks.ts).
 */
import { useState } from 'react';
import { Flag, X, BookX, PackageX, ThumbsDown, ThumbsUp, Hand, ArrowRight, Shirt, Droplets, Flame } from 'lucide-react';
import type { Class, ClassMark, ClassMarkType, MarksBlockConfig, Student } from '../../types';
import { MARK_TYPES, markTypeInfo, TARGET_LABEL, BLOCK_NAME, blockConfig } from '../../services/classMarks';
import { isoDate } from '../../lib/utils';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { useI18n } from '../../i18n';

const ICONS: Record<ClassMarkType, React.ReactNode> = {
  homework: <BookX size={18} />,
  material: <PackageX size={18} />,
  'behavior-bad': <ThumbsDown size={18} />,
  'behavior-good': <ThumbsUp size={18} />,
  participation: <Hand size={18} />,
  // Las de EF se anotan en la pista; aquí solo se ven en el historial
  'ef-ropa': <Shirt size={18} />,
  'ef-aseo': <Droplets size={18} />,
  'ef-esfuerzo': <Flame size={18} />,
  'ef-no-participa': <Hand size={18} />,
};

interface Props {
  student: Student | null;
  cls: Class;
  marksConfigs: Record<string, MarksBlockConfig>;
  classMarks: ClassMark[];
  onAdd: (m: ClassMark, label: string) => void;
  onDelete: (id: string, label: string) => void;
  onClose: () => void;
  onNav: (s: string) => void;
}

export function ClassMarksModal({ student, cls, marksConfigs, classMarks, onAdd, onDelete, onClose, onNav }: Props) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const subjects = cls.subjects?.length ? cls.subjects : [cls.subject];
  const [subjectPick, setSubject] = useState(subjects[0] ?? '');
  const subject = subjects.includes(subjectPick) ? subjectPick : (subjects[0] ?? '');
  const today = isoDate();

  if (!student) return null;

  const mainSubject = subjects[0] ?? '';
  const cfg = blockConfig(marksConfigs, cls.id, subject);
  const mine = classMarks.filter(m => m.student_id === student.id && m.class_id === cls.id
    && (m.subject ?? mainSubject) === subject);
  const todays = mine.filter(m => m.date === today);
  const countOf = (type: ClassMarkType) => todays.filter(m => m.type === type).length;

  function add(type: ClassMarkType) {
    if (!student) return;
    const info = markTypeInfo(type);
    if (!info) return;
    onAdd({
      id: 'mk' + crypto.randomUUID(),
      class_id: cls.id,
      student_id: student.id,
      type,
      date: today,
      // Solo se guarda si hay donde elegir: así, si luego se añade una
      // asignatura a la clase, las anotaciones viejas siguen en la principal.
      subject: subjects.length > 1 ? subject : undefined,
    }, t(info.label));
    toast(t('Anotado: {what} · {name}', { what: t(info.label), name: student.name.split(' ')[0] }));
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={<span className="mk-ttl"><Flag size={16} color="var(--accent-d)" />{t('Anotar a {name}', { name: student.name })}</span>}
    >
      {subjects.length > 1 && (
        <div className="chip-row" role="group" aria-label={t('Asignatura')} style={{ marginBottom: 12 }}>
          {subjects.map(s => (
            <button key={s} type="button" className={`chip sm accent${s === subject ? ' on' : ''}`} aria-pressed={s === subject} onClick={() => setSubject(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mk-grid">
        {MARK_TYPES.map(m => {
          const n = countOf(m.id);
          return (
            <button
              key={m.id} type="button"
              className={`mk-btn ${m.positive ? 'pos' : 'neg'}`}
              onClick={() => add(m.id)}
            >
              <span className="mk-ico">{ICONS[m.id]}</span>
              <span className="mk-lbl">{t(m.label)}</span>
              <span className="mk-where">
                {t('{sign} en {cat}', { sign: m.positive ? '+' : '−', cat: t(TARGET_LABEL[m.target]) })}
              </span>
              {n > 0 && <span className="mk-count" aria-label={t('{n} hoy', { n })}>{n}</span>}
            </button>
          );
        })}
      </div>

      <p className="mk-hint">
        {cfg.enabled === false
          ? t('En esta asignatura el bloque «{name}» está desactivado: las anotaciones se guardan, pero no cuentan en la nota.', { name: t(BLOCK_NAME) })
          : t('Cuentan en el bloque «{name}» del cuaderno, que vale {n} pto. de la nota final.', { name: t(BLOCK_NAME), n: cfg.points.toLocaleString(locale) })}{' '}
        <button type="button" className="mk-link" onClick={() => { onClose(); onNav('notebook'); }}>
          {t('Ir al cuaderno')} <ArrowRight size={12} />
        </button>
      </p>

      <div className="mk-today">
        <p className="mk-today-ttl">
          {t('Hoy')}
          <span>{t('{n} en total este curso', { n: mine.length })}</span>
        </p>
        {todays.length === 0 ? (
          <p className="mk-empty">{t('Nada anotado hoy.')}</p>
        ) : (
          <ul>
            {todays.map(m => {
              const info = markTypeInfo(m.type);
              const label = info ? t(info.label) : m.type;
              return (
                <li key={m.id} className={info?.positive ? 'pos' : 'neg'}>
                  {info && ICONS[info.id]}
                  <span>{label}</span>
                  <button
                    type="button" className="seat-x" style={{ opacity: 1 }}
                    onClick={() => onDelete(m.id, label)}
                    title={t('Quitar esta anotación')} aria-label={t('Quitar esta anotación')}
                  >
                    <X size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
