/**
 * El aviso de que quedó algo a medias (ver `services/borradores.ts`): lo que
 * era, a qué hora se autoguardó y dos botones, «Continuar» y «Descartar».
 */
import { History } from 'lucide-react';
import { useI18n } from '../i18n';
import type { Borrador } from '../services/borradores';

interface Props {
  borrador: Borrador<unknown>;
  /** Qué era, en minúscula y con su artículo: «una ficha», «una situación de aprendizaje». */
  queEra: string;
  /** Algo que conviene saber de lo que se recupera («Las fotos no se guardan»). */
  nota?: string;
  onContinuar: () => void;
  onDescartar: () => void;
}

export function AvisoBorrador({ borrador, queEra, nota, onContinuar, onDescartar }: Props) {
  const { t, locale } = useI18n();
  return (
    <div className="autosave-banner" role="status">
      <History size={17} style={{ flexShrink: 0 }} aria-hidden="true" />
      <span style={{ flex: 1, lineHeight: 1.5 }}>
        {t('Te quedó {que} sin guardar: «{titulo}» (autoguardado el {dia} a las {hora}).', {
          que: queEra,
          titulo: borrador.titulo.trim() || t('sin título'),
          dia: new Date(borrador.guardadoEn).toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
          hora: new Date(borrador.guardadoEn).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
        })}
        {nota && <> {nota}</>}
      </span>
      <button type="button" className="btn-accent" style={{ fontSize: 12.5, padding: '7px 14px' }} onClick={onContinuar}>
        {t('Continuar')}
      </button>
      <button type="button" className="btn-ghost" style={{ fontSize: 12.5, padding: '7px 14px' }} onClick={onDescartar}>
        {t('Descartar')}
      </button>
    </div>
  );
}

/** «Borrador guardado a las 11:32», pequeño, junto a lo que se está editando. */
export function EstadoBorrador({ guardadoEn }: { guardadoEn: string | null }) {
  const { t, locale } = useI18n();
  if (!guardadoEn) return null;
  return (
    <span className="borrador-estado" role="status">
      {t('Borrador guardado a las {hora}', { hora: new Date(guardadoEn).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}
    </span>
  );
}
