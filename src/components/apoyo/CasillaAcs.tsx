/**
 * La casilla para usar la adaptación curricular significativa como contexto de la IA, desmarcada por defecto
 * (decisión del dueño, 3-11-2026: «a petición»). Al marcarla enseña tal cual lo que se envía (`lib/acsContexto.ts`).
 * Si no hay adaptación, no sale.
 */
import { useI18n } from '../../i18n';

interface Props {
  /** El texto que se añadiría a la petición; vacío, la casilla no sale. */
  texto: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  /** La etiqueta, ya traducida. */
  etiqueta: string;
}

export function CasillaAcs({ texto, checked, onChange, etiqueta }: Props) {
  const { t } = useI18n();
  if (!texto.trim()) return null;
  return (
    <div className="fgroup casilla-acs">
      <label className="td-chk">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        {etiqueta}
      </label>
      {checked && (
        <details className="casilla-acs-ver">
          <summary>{t('Ver lo que se envía a la IA')}</summary>
          <pre>{texto}</pre>
          <p className="ap-sub">{t('Sin el nombre del alumno, ni el profesorado, ni las fechas, ni las observaciones.')}</p>
        </details>
      )}
    </div>
  );
}
