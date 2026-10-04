import { useMemo } from 'react';
import { useI18n } from '../i18n';
import {
  citarNormas, comunidadesOrdenadas, comunidadPorId, normasDe, NORMAS_ESTATALES, type ComunidadId,
} from '../lib/curriculum/comunidades';
import { etapasConCurriculoPropio } from '../lib/curriculum/cargar';
import type { Etapa } from '../lib/curriculum/index';

interface Props {
  id: string;
  value: ComunidadId | '';
  onChange: (v: ComunidadId | '') => void;
}

const ETAPAS: Etapa[] = ['primaria', 'eso'];

/**
 * Qué se le dice al docente de la comunidad que ha elegido: de qué decreto
 * sale su currículo en cada etapa, el autonómico o el estatal (RD 157/2022 en
 * Primaria y RD 217/2022 en la ESO). Sirve a quien elige y también, por
 * escrito, a quien quiere saber por qué ve lo que ve en las situaciones de
 * aprendizaje.
 */
function useNotaCurriculo(value: ComunidadId | ''): { titular: string; etapas: string[] } | null {
  const { t, lang } = useI18n();
  if (!value) return null;
  const propias = value === 'fuera' ? [] : etapasConCurriculoPropio(value);
  const etapas = ETAPAS.map(e => {
    const etapa = t(e === 'primaria' ? 'Primaria' : 'ESO');
    if (propias.includes(e)) return t('{etapa}: {cita}.', { etapa, cita: citarNormas(normasDe(value, e)!, lang, { boletin: false }) });
    const cita = citarNormas(NORMAS_ESTATALES[e], lang, { boletin: false });
    return propias.length ? t('{etapa}: currículo estatal, {cita}.', { etapa, cita }) : t('{etapa}: {cita}.', { etapa, cita });
  });
  if (value === 'fuera') return { titular: t('Currículo estatal.'), etapas };
  const comunidad = comunidadPorId(value).nombre[lang];
  if (propias.length === 0) return { titular: t('{comunidad} sigue el currículo estatal.', { comunidad }), etapas };
  if (propias.length === 1) {
    return {
      titular: t('{comunidad}: decreto autonómico actualizado en {etapa}.', { comunidad, etapa: t(propias[0] === 'primaria' ? 'Primaria' : 'ESO') }),
      etapas,
    };
  }
  return { titular: t('{comunidad}: decreto autonómico actualizado.', { comunidad }), etapas };
}

/**
 * Selector de comunidad autónoma, el mismo al crear el perfil, al editarlo y en
 * el aviso a los perfiles antiguos. En dos grupos (decisión del dueño,
 * 3-10-2026): las comunidades cuyo decreto ya lleva Aula Pro, con la etapa si
 * solo es una, y las que siguen el estatal, con «Fuera de España» al final.
 */
export function CommunitySelect({ id, value, onChange }: Props) {
  const { t, lang } = useI18n();
  const { conDecreto, estatales } = useMemo(() => {
    const lista = comunidadesOrdenadas(lang);
    const propio = (c: ComunidadId) => c !== 'fuera' && etapasConCurriculoPropio(c).length > 0;
    return { conDecreto: lista.filter(c => propio(c.id)), estatales: lista.filter(c => !propio(c.id)) };
  }, [lang]);
  const nota = useNotaCurriculo(value);

  return (
    <>
      <select
        id={id} className="finput" value={value} style={{ cursor: 'pointer' }}
        onChange={e => onChange(e.target.value as ComunidadId | '')}
      >
        <option value="">{t('Elige tu comunidad…')}</option>
        <optgroup label={t('Decreto autonómico actualizado')}>
          {conDecreto.map(c => {
            const etapas = etapasConCurriculoPropio(c.id);
            return (
              <option key={c.id} value={c.id}>
                {c.nombre[lang]}
                {etapas.length === 1 ? ` (${t(etapas[0] === 'primaria' ? 'Primaria' : 'ESO')})` : ''}
              </option>
            );
          })}
        </optgroup>
        <optgroup label={t('Decreto estatal (RD 157/2022 y RD 217/2022)')}>
          {estatales.map(c => <option key={c.id} value={c.id}>{c.nombre[lang]}</option>)}
        </optgroup>
      </select>
      {nota && (
        <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, margin: '6px 0 0' }}>
          <strong style={{ color: 'var(--text-2)' }}>{nota.titular}</strong>
          {nota.etapas.map(linea => <span key={linea} style={{ display: 'block' }}>{linea}</span>)}
        </p>
      )}
    </>
  );
}
