import { Check } from 'lucide-react';
import { useI18n } from '../../i18n';
import { APOYOS_AULA } from '../../lib/apoyo';

/**
 * Los apoyos que el alumno necesita en el aula (`APOYOS_AULA`): lo que se deriva de su diagnóstico sin decirlo. Es lo
 * que recibe la IA para adaptar, en vez de la categoría o el diagnóstico, que se quedan en el dispositivo (3-11-2026,
 * revisión del abogado del dueño).
 */
export function ApoyosAula({ value, onChange }: { value: readonly string[]; onChange: (v: string[]) => void }) {
  const { t } = useI18n();
  const alternar = (x: string) => onChange(value.includes(x) ? value.filter(y => y !== x) : [...value, x]);
  return (
    <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
      <legend className="flabel">{t('Apoyos que necesita en el aula')}</legend>
      <p className="ap-aviso" style={{ margin: '0 0 8px' }}>
        {t('Marca lo que le ayuda. Es lo que la IA tiene en cuenta para adaptar: su diagnóstico y su categoría no salen de tu dispositivo.')}
      </p>
      <div className="chip-row">
        {APOYOS_AULA.map(x => {
          const on = value.includes(x);
          return (
            <button key={x} type="button" className={`chip sm accent${on ? ' on' : ''}`} aria-pressed={on} onClick={() => alternar(x)}>
              {on && <Check size={12} />}{t(x)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
