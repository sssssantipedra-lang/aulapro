import { useState } from 'react';
import { Modal } from './ui/Modal';
import { CommunitySelect } from './CommunitySelect';
import { useI18n } from '../i18n';
import type { ComunidadId } from '../lib/curriculum/comunidades';

interface Props {
  /** El docente ha elegido comunidad. */
  onChoose: (c: ComunidadId) => void;
  /** Lo deja para después: no se le vuelve a preguntar. */
  onLater: () => void;
}

/**
 * El aviso que ven, una sola vez, los perfiles creados antes de que existiera
 * la comunidad. Hasta que la elijan se usa el currículo estatal; la pueden
 * cambiar cuando quieran en Configuración, y la insignia de la barra lateral
 * se lo recuerda mientras no la tengan.
 */
export function CommunityPrompt({ onChoose, onLater }: Props) {
  const { t } = useI18n();
  const [value, setValue] = useState<ComunidadId | ''>('');

  return (
    <Modal open onClose={onLater} title={t('Elige tu comunidad autónoma')}>
      <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 16px' }}>
        {t('Aula Pro usa el currículo oficial de tu comunidad en las situaciones de aprendizaje. Hasta que la elijas se usa el currículo estatal. Puedes cambiarla cuando quieras en Configuración.')}
      </p>
      <div className="fgroup">
        <label className="flabel" htmlFor="community-prompt">{t('Comunidad autónoma')}</label>
        <CommunitySelect id="community-prompt" value={value} onChange={setValue} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button
          className="btn-accent" style={{ flex: 1, justifyContent: 'center' }} type="button"
          disabled={!value} onClick={() => { if (value) onChoose(value); }}
        >
          {t('Guardar')}
        </button>
        <button className="btn-ghost" type="button" onClick={onLater}>{t('Ahora no')}</button>
      </div>
    </Modal>
  );
}
