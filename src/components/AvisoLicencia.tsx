import { useState } from 'react';
import { Clock, FlaskConical, ExternalLink } from 'lucide-react';
import { useI18n } from '../i18n';
import { AVISO_DIAS, useAcceso } from '../lib/acceso';

/**
 * Franja fina sobre la app: modo de prueba, anual a punto de caducar o anual
 * caducada. Nunca tapa los datos. En Android solo lleva el texto «aulapro.app»,
 * sin enlace: Google Play no deja enlazar a un pago (docs/WEB.md, apartado 3).
 */
export function AvisoLicencia() {
  const { t } = useI18n();
  const { acceso, activar, buyUrl } = useAcceso();
  const [oculto, setOculto] = useState(false);

  const porCaducar = acceso.modo === 'completo' && acceso.daysLeft !== null && acceso.daysLeft <= AVISO_DIAS;
  if (acceso.modo === 'completo' && !porCaducar) return null;
  if (porCaducar && oculto) return null;

  const mensaje = acceso.modo === 'prueba'
    ? t('Modo de prueba: exploras con datos de ejemplo. Activa tu licencia para crear tu perfil y usar la IA.')
    : acceso.modo === 'caducada'
      ? t('Tu licencia anual ha caducado. Tus datos siguen disponibles; renueva para volver a usar la IA y crear perfiles.')
      : acceso.daysLeft === 0
        ? t('Tu licencia anual caduca hoy.')
        : acceso.daysLeft === 1
          ? t('Tu licencia anual caduca mañana.')
          : t('Tu licencia anual caduca en {n} días.', { n: String(acceso.daysLeft) });

  return (
    <div className="ai-notice lic-franja" role="note">
      {acceso.modo === 'prueba' ? <FlaskConical size={15} style={{ flexShrink: 0 }} aria-hidden="true" /> : <Clock size={15} style={{ flexShrink: 0 }} aria-hidden="true" />}
      <span className="ai-notice-txt">{mensaje}</span>
      {acceso.modo === 'prueba' && (
        <button type="button" className="ai-notice-btn" onClick={activar}>{t('Activar licencia')}</button>
      )}
      {acceso.modo !== 'prueba' && (buyUrl
        ? <a className="ai-notice-btn" href={buyUrl} target="_blank" rel="noreferrer">{t('Renovar')} <ExternalLink size={12} /></a>
        : <span className="ai-notice-btn" style={{ cursor: 'default' }}>{t('Renueva tu licencia en aulapro.app')}</span>)}
      {porCaducar && <button type="button" className="ai-notice-btn" onClick={() => setOculto(true)}>{t('Cerrar')}</button>}
    </div>
  );
}
