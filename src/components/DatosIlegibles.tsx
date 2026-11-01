/**
 * Los datos del perfil no se han podido leer (auditoría del 1-11-2026; ver `DatosIlegibles` en `platform/profileStore.ts`).
 * La app no se abre vacía, porque el guardado automático escribiría el perfil vacío encima de los datos buenos: se queda
 * aquí, sin tocar nada, con dos salidas: volver a intentarlo (un fallo pasajero del navegador) o restaurar la copia
 * automática más reciente (el archivo está dañado).
 */
import { useState } from 'react';
import { AlertTriangle, RotateCcw, History } from 'lucide-react';
import { useI18n } from '../i18n';
import * as store from '../services/storage';

export function DatosIlegiblesPantalla({ profileId, causa }: { profileId: string | null; causa: 'lectura' | 'formato' }) {
  const { t } = useI18n();
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function restaurarLaUltima() {
    if (!profileId) return;
    setOcupado(true);
    try {
      const copias = await store.listBackups(profileId);
      for (const c of copias) {
        if (await store.restoreBackup(profileId, c.file)) { window.location.reload(); return; }
      }
      setMensaje(t('No hay ninguna copia automática que se pueda restaurar en este navegador. Si guardas en Google Drive, OneDrive o una carpeta, tu trabajo está también allí.'));
    } catch {
      setMensaje(t('El navegador tampoco deja leer las copias ahora. Cierra las demás pestañas de AulaPro, reinicia el navegador y vuelve a intentarlo.'));
    }
    setOcupado(false);
  }

  return (
    <div role="alert" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', padding: 16 }}>
      <div className="card" style={{ maxWidth: 520, width: '100%', display: 'grid', gap: 12 }}>
        <div className="card-ttl" style={{ fontSize: 17 }}>
          <AlertTriangle size={18} color="var(--warn, #d97706)" aria-hidden="true" />{t('No se han podido leer tus datos')}
        </div>
        <p style={{ margin: 0 }}>
          {t(causa === 'formato'
            ? 'El archivo con tu trabajo está dañado y no se puede abrir. No se ha tocado nada. Puedes restaurar la copia automática más reciente (se hace cada 10 minutos mientras trabajas).'
            : 'Tu trabajo sigue en este navegador, pero ahora no se ha podido leer. No se ha tocado nada: AulaPro no se abre vacía para no escribir encima. Vuelve a intentarlo; si sigue igual, cierra las demás pestañas de AulaPro o reinicia el navegador.')}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn-accent" disabled={ocupado} onClick={() => window.location.reload()}>
            <RotateCcw size={15} />{t('Volver a intentarlo')}
          </button>
          {causa === 'formato' && (
            <button type="button" className="btn-ghost" disabled={ocupado} onClick={restaurarLaUltima}>
              {ocupado ? <span className="spin" /> : <History size={15} />}{t('Restaurar la copia más reciente')}
            </button>
          )}
        </div>
        {mensaje && <p className="ap-sub" style={{ margin: 0 }}>{mensaje}</p>}
      </div>
    </div>
  );
}
