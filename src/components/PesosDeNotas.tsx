import { Scale } from 'lucide-react';
import type { GradeItem } from '../types';
import { useI18n } from '../i18n';

interface Props {
  /** Las notas de la categoría, por fecha. */
  items: GradeItem[];
  /** Lo que se está escribiendo, en texto: id de la nota → «25» o «» (cuenta como las demás). */
  valores: Record<string, string>;
  onChange: (valores: Record<string, string>) => void;
}

const num = (v: string) => Number(v.trim().replace(',', '.'));

/**
 * Cuánto cuenta cada nota dentro de su categoría, en %: una fila por nota con su casilla y, abajo, lo que
 * suman (lo ideal es 100) y «Repartir por igual». Una casilla vacía cuenta como su parte igual.
 */
export function PesosDeNotas({ items, valores, onChange }: Props) {
  const { t, locale } = useI18n();
  const n = items.length;
  const suma = items.reduce((a, i) => {
    const v = (valores[i.id] ?? '').trim();
    return a + (v === '' || Number.isNaN(num(v)) ? 100 / n : num(v));
  }, 0);
  const ok = Math.abs(suma - 100) < 0.05;
  const hayElegidos = items.some(i => (valores[i.id] ?? '').trim() !== '');

  return (
    <div className="pesos-notas">
      <div className="pesos-notas-hd"><Scale size={14} />{t('Cuánto cuenta cada nota en esta categoría')}</div>
      <ul className="pesos-notas-lista">
        {items.map(i => (
          <li key={i.id}>
            <label htmlFor={`pn-${i.id}`}>{i.name}</label>
            <span className="pesos-notas-in">
              <input
                id={`pn-${i.id}`} className="finput" inputMode="decimal" value={valores[i.id] ?? ''}
                placeholder={(100 / n).toLocaleString(locale, { maximumFractionDigits: 1 })}
                onChange={e => onChange({ ...valores, [i.id]: e.target.value })}
              />%
            </span>
          </li>
        ))}
      </ul>
      <div className="pesos-notas-ft">
        <span className={ok ? 'ok' : 'warn'}>
          {ok ? '✓ ' : '⚠ '}{t('Suman {n}%', { n: (Math.round(suma * 10) / 10).toLocaleString(locale) })}
          {!ok && ` · ${t('lo ideal es 100%')}`}
        </span>
        <button type="button" className="btn-ghost" disabled={!hayElegidos} onClick={() => onChange({})}>
          {t('Repartir por igual')}
        </button>
      </div>
    </div>
  );
}
