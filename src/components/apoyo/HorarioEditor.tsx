/**
 * PT y AL: las sesiones a la semana de un grupo de apoyo (día, hora de empezar
 * y de acabar). Lo comparten la ventana del grupo y el grupo que se crea desde
 * la ventana de un alumno. Ver `docs/PTAL.md`.
 */
import { Plus, Trash2 } from 'lucide-react';
import { useI18n, weekdayLabel } from '../../i18n';
import type { FranjaApoyo } from '../../types/apoyo';

/** La sesión que se añade: la misma hora, el día siguiente al de la última. */
function otraFranja(horario: FranjaApoyo[]): FranjaApoyo {
  const ultima = horario[horario.length - 1];
  if (!ultima) return { dia: 0, inicio: '09:00', fin: '09:45' };
  return { ...ultima, dia: Math.min(ultima.dia + 1, 4) };
}

export function HorarioEditor({ horario, onChange }: { horario: FranjaApoyo[]; onChange: (h: FranjaApoyo[]) => void }) {
  const { t, locale } = useI18n();
  const patch = (i: number, p: Partial<FranjaApoyo>) => onChange(horario.map((f, j) => (j === i ? { ...f, ...p } : f)));
  return (
    <>
      {horario.map((f, i) => (
        <div key={i} className="ap-franja">
          <select className="finput" aria-label={t('Día')} value={f.dia} onChange={e => patch(i, { dia: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4].map(n => <option key={n} value={n}>{weekdayLabel(n, locale)}</option>)}
          </select>
          <input type="time" className="finput" aria-label={t('Empieza')} value={f.inicio} onChange={e => patch(i, { inicio: e.target.value })} />
          <input type="time" className="finput" aria-label={t('Acaba')} value={f.fin} onChange={e => patch(i, { fin: e.target.value })} />
          <button type="button" className="ico-btn" aria-label={t('Quitar esta sesión')} title={t('Quitar')}
            onClick={() => onChange(horario.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
        </div>
      ))}
      <button type="button" className="btn-ghost" style={{ fontSize: 12.5 }} onClick={() => onChange([...horario, otraFranja(horario)])}>
        <Plus size={14} />{t('Otra sesión a la semana')}
      </button>
    </>
  );
}
