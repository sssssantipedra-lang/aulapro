/**
 * Asociar las sesiones elegidas a una situación de aprendizaje que ya existe
 * (o quitarles la que tengan). Primero salen las SdA de la clase de las
 * sesiones. Ver `lib/sesiones.ts`.
 */
import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n';
import type { LearningSituation } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Cuántas sesiones se van a asociar. */
  cuantas: number;
  /** Las SdA entre las que elegir: las de la clase primero. */
  sdas: LearningSituation[];
  claseId?: string;
  onElegir: (sdaId: string | undefined) => void;
}

const esDeClase = (s: LearningSituation, claseId?: string) => !!claseId && (s.class_id === claseId || !!s.otras_clases?.includes(claseId));

export function AsociarASda({ open, onClose, cuantas, sdas, claseId, onElegir }: Props) {
  const { t } = useI18n();
  const [elegida, setElegida] = useState<string>('');
  const ordenadas = [...sdas].sort((a, b) => Number(esDeClase(b, claseId)) - Number(esDeClase(a, claseId)) || a.title.localeCompare(b.title, 'es'));

  return (
    <Modal open={open} onClose={onClose} title={t(cuantas === 1 ? 'Asociar {n} sesión a una situación de aprendizaje' : 'Asociar {n} sesiones a una situación de aprendizaje', { n: cuantas })}>
      {sdas.length === 0 && <p className="ap-vacio">{t('Todavía no tienes situaciones de aprendizaje. Crea una en Documentos, o con las sesiones elegidas.')}</p>}
      <div role="radiogroup" aria-label={t('Situación de aprendizaje')} className="ses-sda-lista">
        {ordenadas.map(s => (
          <label key={s.id} className="td-chk">
            <input type="radio" name="ses-sda" checked={elegida === s.id} onChange={() => setElegida(s.id)} />
            <span>
              <strong>{s.request.numero ? `${s.request.numero}. ` : ''}{s.title}</strong>
              {s.class_name && <span className="ap-sub"> · {s.class_name}</span>}
            </span>
          </label>
        ))}
        <label className="td-chk">
          <input type="radio" name="ses-sda" checked={elegida === 'ninguna'} onChange={() => setElegida('ninguna')} />
          <span>{t('Ninguna: quitarlas de su situación de aprendizaje')}</span>
        </label>
      </div>
      <div className="ap-acciones" style={{ marginTop: 14 }}>
        <button type="button" className="btn-accent" disabled={!elegida} onClick={() => { onElegir(elegida === 'ninguna' ? undefined : elegida); setElegida(''); }}>{t('Asociar')}</button>
        <button type="button" className="btn-ghost" onClick={onClose}>{t('Cancelar')}</button>
      </div>
    </Modal>
  );
}
