import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Student } from '../../types';
import { PERIODS } from '../../lib/utils';
import { aUnDecimal, porcentajesDeEvaluaciones, REGLA_CONTINUA, type NotasDeCurso as Notas, type ReglaFinal } from '../../lib/cuadernoEvaluacion';
import { useI18n } from '../../i18n';
import { useToast } from '../ui/Toast';

const CORTO = ['1.ª', '2.ª', '3.ª'];

function color(n: number | null): string {
  if (n === null) return 'var(--text-3)';
  return n < 5 ? 'var(--grade-bad)' : n < 7 ? 'var(--grade-mid)' : 'var(--grade-good)';
}

/**
 * «Curso» en el cuaderno (20-11-2026): la nota de cada evaluación y la final de cada alumno, y la regla con
 * la que sale la final, que elige el docente para esa clase y asignatura. La cuenta, en `lib/cuadernoEvaluacion.ts`.
 */
export function NotasDeCurso({ alumnado, notas, regla, onRegla, onParaTodas, onVerEvaluacion, marca }: {
  alumnado: Student[];
  notas: Map<string, Notas>;
  regla: ReglaFinal;
  onRegla: (regla: ReglaFinal) => void;
  /** Lleva la regla a las demás clases y asignaturas; ausente si solo hay una. */
  onParaTodas?: () => void;
  onVerEvaluacion: (periodo: string) => void;
  /** Lo que acompaña al nombre de un alumno (la marca de una adaptación curricular). */
  marca?: (s: Student) => React.ReactNode;
}) {
  const { t, locale, lang } = useI18n();
  const { toast } = useToast();
  /** Los pesos mientras se escriben, en texto; `null` = los de la regla. */
  const [borrador, setBorrador] = useState<string[] | null>(null);
  const media = regla.modo === 'media';
  const pct = porcentajesDeEvaluaciones(regla);
  const dec = (n: number) => { const s = String(Math.round(n * 100) / 100); return lang !== 'en' ? s.replace('.', ',') : s; };
  // Los pesos se enseñan como los escribió el docente (30, 30 y 40); los de partida, iguales, como 1 parte cada uno
  const escritos = regla.pesos.every(p => p === regla.pesos[0]) ? pct.map(p => dec(Math.round(p * 10) / 10)) : regla.pesos.map(dec);
  const textos = borrador ?? escritos;
  // Tres pesos iguales son un tercio cada uno: suman 100 aunque en pantalla se lean «33,3»
  const suma = borrador ? borrador.reduce((a, x) => a + (Number(x.trim().replace(',', '.')) || 0), 0)
    : regla.pesos.every(p => p === regla.pesos[0]) ? 100 : regla.pesos.reduce((a, b) => a + b, 0);
  const fmt = (n: number | null) => (n === null ? '—' : n.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

  function guardarPesos() {
    if (!borrador) return;
    const pesos = borrador.map(x => (x.trim() === '' ? 0 : Number(x.trim().replace(',', '.'))));
    if (pesos.some(p => Number.isNaN(p) || p < 0 || p > 100) || !pesos.some(p => p > 0)) {
      toast(t('El peso de cada evaluación debe ser un número entre 0 y 100, y alguna tiene que contar.'));
      return;
    }
    setBorrador(null);
    onRegla({ modo: 'media', pesos: pesos as [number, number, number] });
  }

  const sinNotas = [0, 1, 2].filter(k => alumnado.length > 0 && alumnado.every(s => (notas.get(s.id)?.evaluaciones[k] ?? null) === null));
  const mediaDe = (valores: (number | null)[]) => {
    const v = valores.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  return (
    <div className="card nc">
      <div className="nc-regla" role="group" aria-label={t('Cómo sale la nota final de curso')}>
        <span className="nc-regla-lbl">{t('Nota final de curso')}</span>
        <div className="chip-row">
          <button type="button" className={`chip sm accent${!media ? ' on' : ''}`} aria-pressed={!media}
            onClick={() => { setBorrador(null); onRegla(REGLA_CONTINUA); }}>
            {!media && <Check size={13} aria-hidden="true" />}{t('Evaluación continua')}
          </button>
          <button type="button" className={`chip sm accent${media ? ' on' : ''}`} aria-pressed={media}
            onClick={() => { if (!media) onRegla({ modo: 'media', pesos: [1, 1, 1] }); }}>
            {media && <Check size={13} aria-hidden="true" />}{t('Media de las evaluaciones')}
          </button>
        </div>
        {onParaTodas && (
          <button type="button" className="ev-enlace nc-todas" onClick={onParaTodas}>{t('Usar esta regla en todas mis clases')}</button>
        )}
      </div>

      {media ? (
        <div className="nc-pesos">
          <span className="nc-porque">{t('La nota final es la media de las notas de las tres evaluaciones, cada una con su peso:')}</span>
          {[0, 1, 2].map(k => (
            <label key={k} className="nc-peso">
              {t(CORTO[k])}
              <input className="finput" inputMode="decimal" value={textos[k]} aria-label={t('Peso de la {evaluacion} en la nota final (%)', { evaluacion: t(PERIODS[k]) })}
                onChange={e => setBorrador(textos.map((x, i) => (i === k ? e.target.value : x)))}
                onBlur={guardarPesos}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
              %
            </label>
          ))}
          {Math.abs(suma - 100) < 0.05
            ? <span className="gb-formula-total ok"><Check size={13} />100%</span>
            : <span className="gb-formula-total warn">{t('Suman {n}%: cada evaluación cuenta en proporción (lo ideal es 100%)', { n: dec(suma) })}</span>}
        </div>
      ) : (
        <p className="nc-porque">{t('Todas las notas del curso cuentan juntas, con el peso de cada categoría, como si fuera una sola evaluación. Es lo que sale si no eliges otra cosa.')}</p>
      )}

      <div className="nc-tabla">
        <table className="gb-table">
          <thead>
            <tr>
              <th className="gb-sticky">{t('Alumno')}</th>
              {[0, 1, 2].map(k => (
                <th key={k}>
                  <button type="button" className="gb-item-hd" onClick={() => onVerEvaluacion(PERIODS[k])} title={t('Ver la {evaluacion}', { evaluacion: t(PERIODS[k]) })}>
                    <span className="gb-item-name nc-largo">{t(PERIODS[k])}</span>
                    <span className="gb-item-name nc-corto" aria-hidden="true">{t(CORTO[k])}</span>
                    {media && <span className="gb-item-cat">{`${dec(Math.round(pct[k] * 10) / 10)}%`}</span>}
                  </button>
                </th>
              ))}
              <th className="gb-sticky-r nc-final">{t('Final@@nota')}</th>
            </tr>
          </thead>
          <tbody>
            {alumnado.map(s => {
              const n = notas.get(s.id);
              const final = aUnDecimal(n?.final ?? null);
              return (
                <tr key={s.id}>
                  <td className="gb-sticky gb-student">{s.name}{marca?.(s)}</td>
                  {[0, 1, 2].map(k => {
                    const v = aUnDecimal(n?.evaluaciones[k] ?? null);
                    return <td key={k} className="nc-num" style={{ color: color(v) }}>{fmt(v)}</td>;
                  })}
                  <td className="gb-sticky-r nc-num nc-final" style={{ color: color(final) }}>{fmt(final)}</td>
                </tr>
              );
            })}
            <tr className="gb-footer">
              <td className="gb-sticky nc-pie">{t('Media del grupo')}</td>
              {[0, 1, 2].map(k => {
                const m = mediaDe(alumnado.map(s => aUnDecimal(notas.get(s.id)?.evaluaciones[k] ?? null)));
                return <td key={k} className="nc-num" style={{ color: color(m) }}>{fmt(m)}</td>;
              })}
              <td className="gb-sticky-r nc-num nc-final">{fmt(mediaDe(alumnado.map(s => aUnDecimal(notas.get(s.id)?.final ?? null))))}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {media && sinNotas.length > 0 && sinNotas.length < 3 && (
        <p className="nc-porque nc-aviso" role="status">
          {sinNotas.length === 1
            ? t('La {evaluacion} aún no tiene notas: la final es provisional y sale de las demás.', { evaluacion: t(PERIODS[sinNotas[0]]) })
            : t('Solo una evaluación tiene notas: de momento, la final es la suya.')}
        </p>
      )}
    </div>
  );
}
