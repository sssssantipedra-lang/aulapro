import { useState } from 'react';
import { BadgeCheck, KeyRound, Heart } from 'lucide-react';
import { useI18n } from '../i18n';
import { licenseBridge, LICENSE_ERROR_TEXT } from '../services/license';
import { useToast } from './ui/Toast';
import type { LicenseState } from '../types/electron';

/** Estado de la licencia de este equipo en Configuración › Licencia. */
export function LicenseSettings({ state, onChange }: { state: LicenseState; onChange: (s: LicenseState) => void }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const since = state.since ? new Date(state.since).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'ca' ? 'ca-ES' : 'es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  async function deactivate() {
    const bridge = licenseBridge();
    if (!bridge) return;
    setBusy(true);
    const r = await bridge.deactivate();
    setBusy(false);
    setConfirm(false);
    if (r.ok) { toast(t('Licencia desactivada en este equipo')); onChange(r.state); }
    else toast(t(LICENSE_ERROR_TEXT[r.error ?? 'error-tienda']));
  }

  const fecha = (ms: number | string | undefined) => (ms ? new Date(ms).toLocaleString(lang === 'en' ? 'en-GB' : lang === 'ca' ? 'ca-ES' : 'es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  // Para saber por qué entra este navegador: de dónde viene la licencia, cuándo se comprobó y qué versión de la app corre
  const detalle = (
    <p className="lic-card-meta" style={{ marginTop: 8 }}>
      {state.origen && <>{t(state.status === 'fundador' ? 'Fundador/a por tu correo' : state.origen === 'cuenta' ? 'Licencia de tu cuenta' : 'Clave escrita a mano')} · </>}
      {state.comprobada && <>{t('comprobada el {d}', { d: fecha(state.comprobada) })} · </>}
      {state.firmaHasta ? <>{t('sin conexión, vale hasta el {d}', { d: fecha(state.firmaHasta) })} · </> : null}
      {t('versión del {d}', { d: __APP_BUILD__ })}
    </p>
  );

  if (state.status === 'fundador') {
    return (
      <div className="card lic-card">
        <div className="lic-badge"><Heart size={15} />{t('Docente fundador/a')}</div>
        <p className="lic-card-txt">
          {t('Usas AulaPro desde antes de que saliera a la venta, así que en este ordenador es gratis para siempre. ¡Gracias por ayudar a mejorarla!')}
        </p>
        {since && <p className="lic-card-meta">{t('En este equipo desde el {d}', { d: since })}</p>}
        {detalle}
      </div>
    );
  }

  return (
    <div className="card lic-card">
      <div className="lic-badge ok"><BadgeCheck size={15} />{t('Licencia activa')}</div>
      <div className="lic-row">
        <KeyRound size={16} color="var(--accent-d)" />
        <span className="lic-key">{state.keyHint}</span>
        {since && <span className="lic-card-meta">· {t('activada el {d}', { d: since })}</span>}
      </div>
      {detalle}
      <p className="lic-card-txt">
        {t('Si cambias de dispositivo, desactiva la licencia aquí antes y actívala en el nuevo con la misma clave: así no gastas una activación.')}
      </p>
      {confirm ? (
        <div className="lic-confirm">
          <span>{t('AulaPro pedirá la clave la próxima vez que se abra en este equipo. Tus datos no se borran.')}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-accent lic-danger" onClick={deactivate} disabled={busy}>
              {busy ? <span className="spin" /> : null}{t('Sí, desactivar')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>{t('Cancelar')}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-ghost" onClick={() => setConfirm(true)}>{t('Desactivar en este equipo')}</button>
      )}
    </div>
  );
}
