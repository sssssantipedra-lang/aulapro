import { useState } from 'react';
import { Globe, X } from 'lucide-react';
import { useI18n } from '../i18n';

const CLAVE = 'aulapro_aviso_web_cerrado';

/**
 * Apps de Windows y Android: AulaPro pasa a ser solo web (decisión del dueño,
 * 29-10-2026). Estas apps no reciben más versiones; el aviso explica cómo
 * llevarse el trabajo a aulapro.app/app. Se puede cerrar (preferencia del dispositivo).
 */
export function AvisoPasarAWeb() {
  const { t } = useI18n();
  const [cerrado, setCerrado] = useState(() => { try { return localStorage.getItem(CLAVE) === '1'; } catch { return false; } });
  if (cerrado) return null;
  const cerrar = () => { try { localStorage.setItem(CLAVE, '1'); } catch { /* sin almacenamiento */ } setCerrado(true); };
  return (
    <div className="update-banner carpeta-aviso" role="status">
      <Globe size={18} color="var(--accent-d)" style={{ flexShrink: 0 }} aria-hidden="true" />
      <span style={{ flex: 1 }}>{t('AulaPro ahora funciona en el navegador, en aulapro.app/app, y esta app ya no recibirá versiones nuevas. Para llevarte tu trabajo, pulsa «Descargar mis datos» en «Llevar a otro equipo» y cárgalo en la web.')}</span>
      <a className="carpeta-aviso-enlace" href="https://aulapro.app/app/" target="_blank" rel="noreferrer">{t('Abrir aulapro.app')}</a>
      <button type="button" aria-label={t('Cerrar')} onClick={cerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={16} /></button>
    </div>
  );
}
