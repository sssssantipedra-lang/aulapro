import { useState } from 'react';
import { BadgeCheck, KeyRound, Heart } from 'lucide-react';
import { useI18n } from '../i18n';
import { licenseBridge, LICENSE_ERROR_TEXT } from '../services/license';
import { useToast } from './ui/Toast';
import type { LicenseState } from '../types/electron';
import { useAcceso } from '../lib/acceso';

/** Estado de la licencia de este equipo en Configuración › Licencia. */
export function LicenseSettings({ state, onChange }: { state: LicenseState; onChange: (s: LicenseState) => void }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { activar } = useAcceso();
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

  // Modo de prueba: aún no hay licencia que enseñar
  if (state.status === 'sin-licencia' || state.status === 'otro-equipo') {
    return (
      <div className="card lic-card">
        <div className="lic-badge"><KeyRound size={15} />{t('Modo de prueba')}</div>
        <p className="lic-card-txt">{t('Sin licencia puedes explorar Aula Pro con datos de ejemplo. Para crear tu perfil y usar la IA, activa tu licencia.')}</p>
        <button type="button" className="btn-accent" onClick={activar}>{t('Activar licencia')}</button>
      </div>
    );
  }

  if (state.status === 'fundador') {
    return (
      <div className="card lic-card">
        <div className="lic-badge"><Heart size={15} />{t('Docente fundador/a')}</div>
        <p className="lic-card-txt">
          {t('Usas Aula Pro desde antes de que saliera a la venta, así que en este ordenador es gratis para siempre. ¡Gracias por ayudar a mejorarla!')}
        </p>
        {since && <p className="lic-card-meta">{t('En este equipo desde el {d}', { d: since })}</p>}
      </div>
    );
  }

  const expira = state.expiresAt ? new Date(state.expiresAt).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'ca' ? 'ca-ES' : 'es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const caducada = state.status === 'caducada';

  return (
    <div className="card lic-card">
      <div className="lic-badge ok" style={caducada ? { color: 'var(--danger, #ef4444)' } : undefined}>
        <BadgeCheck size={15} />{caducada ? t('Licencia anual caducada') : t('Licencia activa')}
      </div>
      {expira && !caducada && <p className="lic-card-meta">{t('Licencia anual · caduca el {d}', { d: expira })}</p>}
      {caducada && <p className="lic-card-txt">{t('Tu licencia anual caducó el {d}. Tus datos siguen disponibles y se pueden exportar. Renueva para volver a usar la IA y crear perfiles; al renovar, Aula Pro lo detecta sola.', { d: expira })}</p>}
      <div className="lic-row">
        <KeyRound size={16} color="var(--accent-d)" />
        <span className="lic-key">{state.keyHint}</span>
        {since && <span className="lic-card-meta">· {t('activada el {d}', { d: since })}</span>}
      </div>
      {expira && !caducada && state.daysLeft != null && state.daysLeft <= 14 && <p className="lic-card-txt">{t('Renueva antes de esa fecha para no perder el acceso a la IA. Tus datos nunca se bloquean.')}</p>}
      <p className="lic-card-txt">
        {t('Si cambias de dispositivo, desactiva la licencia aquí antes y actívala en el nuevo con la misma clave: así no gastas una activación.')}
      </p>
      {confirm ? (
        <div className="lic-confirm">
          <span>{t('Aula Pro pedirá la clave la próxima vez que se abra en este equipo. Tus datos no se borran.')}</span>
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
