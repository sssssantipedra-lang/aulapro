import { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { PERIODS, fromIsoDate } from '../lib/utils';
import { CURSO_ENTERO } from '../lib/periodos';
import { useI18n } from '../i18n';
import type { EvaluacionElegida } from '../hooks/useEvaluacionElegida';

/** El nombre corto de cada evaluación en el selector. */
const CORTO: Record<string, string> = {
  [PERIODS[0]]: '1.ª', [PERIODS[1]]: '2.ª', [PERIODS[2]]: '3.ª', [PERIODS[3]]: 'Curso@@evaluacion',
};

/**
 * Una fecha de la evaluación. Mientras se teclea pasa por valores a medias («0002-…», un mes antes que el
 * año): se quedan en el campo sin guardarse, y solo cuenta la fecha cuando está entera y dentro de su tope.
 */
function FechaDeEvaluacion({ valor, min, max, etiqueta, onCambio }: {
  valor: string; min?: string; max?: string; etiqueta: string; onCambio: (v: string) => void;
}) {
  const [borrador, setBorrador] = useState<string | null>(null);
  return (
    <input type="date" className="tb-select" value={borrador ?? valor} min={min} max={max} aria-label={etiqueta}
      onChange={e => {
        const v = e.target.value;
        const vale = /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= '2020-01-01' && (!min || v >= min) && (!max || v <= max);
        if (vale) { setBorrador(null); onCambio(v); } else setBorrador(v);
      }}
      onBlur={() => setBorrador(null)} />
  );
}

/**
 * El selector de evaluación de toda la app (20-11-2026): «1.ª · 2.ª · 3.ª · Curso», con las fechas de la
 * evaluación al lado, que se cambian ahí mismo. Lo llevan el cuaderno y las actas, y lo elegido en uno vale
 * en el otro (`useEvaluacionElegida`). La evaluación en la que cae hoy lleva un punto.
 */
export function SelectorEvaluacion({ ev, queCuenta }: {
  ev: EvaluacionElegida;
  /** Qué cuenta la pantalla con esas fechas, para la ayuda de los campos (cada pantalla dice lo suyo). */
  queCuenta: string;
}) {
  const { t, locale } = useI18n();
  const [abierto, setAbierto] = useState(false);
  const { rango } = ev;
  const dia = (f: string) => fromIsoDate(f).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  return (
    <div className="ev-sel">
      <div className="ev-sel-chips" role="group" aria-label={t('Evaluación')}>
        {PERIODS.map(p => {
          const on = p === ev.periodo;
          const deHoy = p === ev.deHoy;
          return (
            <button key={p} type="button" className={`chip sm accent${on ? ' on' : ''}`} aria-pressed={on}
              title={deHoy ? `${t(p)} · ${t('la de hoy')}` : t(p)}
              aria-label={deHoy ? `${t(p)} (${t('la de hoy')})` : t(p)}
              onClick={() => ev.elegir(p)}>
              {t(CORTO[p])}
              {deHoy && <span className="ev-sel-hoy" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {rango ? (
        <button type="button" className={`ev-sel-fechas${abierto ? ' on' : ''}`} aria-expanded={abierto}
          title={t('Cambiar las fechas de esta evaluación')} onClick={() => setAbierto(a => !a)}>
          <CalendarRange size={13} aria-hidden="true" />
          <span>{t('{desde} a {hasta}', { desde: dia(rango.desde), hasta: dia(rango.hasta) })}</span>
        </button>
      ) : ev.periodo === CURSO_ENTERO && (
        <span className="ev-sel-todo">{t('Todo el curso')}</span>
      )}
      {abierto && rango && (
        <span className="ev-sel-editar acta-fechas">
          <label>{t('Del')} <FechaDeEvaluacion valor={rango.desde} max={rango.hasta} etiqueta={t('Primer día de la evaluación')}
            onCambio={v => ev.cambiarRango({ desde: v, hasta: rango.hasta })} /></label>
          <label>{t('al')} <FechaDeEvaluacion valor={rango.hasta} min={rango.desde} etiqueta={t('Último día de la evaluación')}
            onCambio={v => ev.cambiarRango({ desde: rango.desde, hasta: v })} /></label>
          <span className="ev-sel-nota">{queCuenta} {t('Cámbialas si tu centro cierra la evaluación otro día: las evaluaciones vecinas se ajustan solas y las fechas se recuerdan en este dispositivo.')}</span>
        </span>
      )}
    </div>
  );
}
