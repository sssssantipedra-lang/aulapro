import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useI18n } from '../i18n';
import type { UpdateStatus } from '../types/electron';

/**
 * Aviso de actualización automática (solo Windows: ver electron/updater.cjs
 * y el porqué de que Mac se quede fuera por ahora).
 *
 * No hace nada solo — la descarga ya corre en segundo plano en el proceso
 * principal antes de que esto aparezca. Esto es únicamente el aviso: informa
 * mientras descarga, y cuando está lista deja pulsar «Reiniciar y
 * actualizar». Si el docente lo cierra con la X, la actualización sigue
 * lista igualmente y se instalará sola al cerrar la aplicación.
 */
export function UpdateBanner() {
  const { t } = useI18n();
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => window.electronAPI?.update?.onStatus(s => { setStatus(s); setDismissed(false); }), []);

  if (!status || status.state === 'error' || dismissed) return null;

  return (
    <div className="update-banner">
      {status.state === 'downloading' && (
        <span className="spin" style={{ flexShrink: 0 }} />
      )}
      <span style={{ flex: 1 }}>
        {status.state === 'downloading'
          ? t('Descargando la actualización {version}…', { version: status.version || '' })
          : t('Hay una versión nueva ({version}) lista para instalar', { version: status.version || '' })}
      </span>
      {status.state === 'ready' && (
        <button onClick={() => window.electronAPI?.update?.installNow()}>
          <RefreshCw size={13} />{t('Reiniciar y actualizar')}
        </button>
      )}
      <button className="update-close" onClick={() => setDismissed(true)} title={t('Cerrar')}>
        <X size={14} />
      </button>
    </div>
  );
}
