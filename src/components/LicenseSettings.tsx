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

  return (
    <div className="card lic-card">
      <div className="lic-badge ok"><BadgeCheck size={15} />{t('Licencia activa')}</div>
      <div className="lic-row">
        <KeyRound size={16} color="var(--accent-d)" />
        <span className="lic-key">{state.keyHint}</span>
        {since && <span className="lic-card-meta">· {t('activada el {d}', { d: since })}</span>}
      </div>
      <p className="lic-card-txt">
        {t('Tu clave sirve para un número limitado de ordenadores. Si cambias de ordenador, desactívala aquí antes y actívala en el nuevo con la misma clave.')}
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
