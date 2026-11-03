import { useI18n } from '../i18n';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import { provinciasDe, type ProvinciaId } from '../lib/provincias';

interface Props {
  id: string;
  comunidad: ComunidadId | '';
  value: ProvinciaId | '';
  onChange: (v: ProvinciaId | '') => void;
}

/**
 * La provincia, solo en una comunidad cuyo calendario escolar es de cada
 * provincia (Andalucía). Es opcional: sin ella, la Agenda no pinta el
 * calendario escolar y lo pide. Sin provincias que elegir, no se ve.
 */
export function ProvinciaSelect({ id, comunidad, value, onChange }: Props) {
  const { t, lang } = useI18n();
  const provincias = provinciasDe(comunidad || null);
  if (provincias.length === 0) return null;
  return (
    <div className="fgroup">
      <label className="flabel" htmlFor={id}>{t('Provincia')}</label>
      <select id={id} className="finput" value={value} onChange={e => onChange(e.target.value as ProvinciaId | '')}>
        <option value="">{t('Elige tu provincia…')}</option>
        {provincias.map(p => <option key={p.id} value={p.id}>{p.nombre[lang]}</option>)}
      </select>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
        {t('En Andalucía el calendario escolar lo aprueba cada provincia: con ella, la Agenda marca tus vacaciones y días no lectivos.')}
      </div>
    </div>
  );
}
