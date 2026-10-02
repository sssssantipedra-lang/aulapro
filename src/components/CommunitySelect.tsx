import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { comunidadesOrdenadas, comunidadPorId, type ComunidadId } from '../lib/curriculum/comunidades';
import { etapasConCurriculoPropio } from '../lib/curriculum/cargar';

interface Props {
  id: string;
  value: ComunidadId | '';
  onChange: (v: ComunidadId | '') => void;
}

/**
 * Qué se le dice al docente de la comunidad que ha elegido: si AulaPro ya
 * lleva su decreto o todavía usa el estatal. Sirve a quien elige y también,
 * por escrito, a quien quiere saber por qué ve lo que ve en las situaciones de
 * aprendizaje.
 */
function useNotaCurriculo(value: ComunidadId | ''): string | null {
  const { t, lang } = useI18n();
  if (!value) return null;
  if (value === 'fuera') return t('Se usa el currículo estatal (LOMLOE).');

  const comunidad = comunidadPorId(value).nombre[lang];
  const etapas = etapasConCurriculoPropio(value);
  if (etapas.length === 2) return t('Currículo oficial de {comunidad} disponible en Primaria y ESO.', { comunidad });
  if (etapas.length === 1) {
    return t('Currículo de {comunidad} disponible en {etapa}; en {otra} se usa el estatal por ahora.', {
      comunidad,
      etapa: t(etapas[0] === 'primaria' ? 'Primaria' : 'ESO'),
      otra: t(etapas[0] === 'primaria' ? 'ESO' : 'Primaria'),
    });
  }
  return t('Todavía no tenemos el decreto de {comunidad}. Mientras tanto se usa el currículo estatal y la aplicación te lo avisará.', { comunidad });
}

/**
 * Selector de comunidad autónoma, el mismo al crear el perfil, al editarlo y en
 * el aviso a los perfiles antiguos. Las comunidades cuyo decreto aún no está
 * copiado se pueden elegir igualmente: salen marcadas y usan el estatal.
 */
export function CommunitySelect({ id, value, onChange }: Props) {
  const { t, lang } = useI18n();
  const lista = useMemo(() => comunidadesOrdenadas(lang), [lang]);
  const nota = useNotaCurriculo(value);

  return (
    <>
      <select
        id={id} className="finput" value={value} style={{ cursor: 'pointer' }}
        onChange={e => onChange(e.target.value as ComunidadId | '')}
      >
        <option value="">{t('Elige tu comunidad…')}</option>
        {lista.map(c => (
          <option key={c.id} value={c.id}>
            {c.nombre[lang]}
            {c.id !== 'fuera' && etapasConCurriculoPropio(c.id).length === 0 ? ` · ${t('próximamente')}` : ''}
          </option>
        ))}
      </select>
      {nota && <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, margin: '6px 0 0' }}>{nota}</p>}
    </>
  );
}
