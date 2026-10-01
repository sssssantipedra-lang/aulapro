import { useState } from 'react';
import { KeyRound, ExternalLink, ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n';
import { licenseBridge, LICENSE_ERROR_TEXT, LICENSE_STATUS_TEXT } from '../services/license';
import type { LicenseError, LicenseState } from '../types/electron';
import { LangSwitch } from './Welcome';
import { isAndroidApp } from '../lib/platform';

interface Props {
  state: LicenseState;
  onChange: (s: LicenseState) => void;
}

/**
 * Pantalla de activación: sale antes que nada en un equipo sin licencia (ver
 * `electron/license.cjs`). Quien ya usaba Aula Pro antes de la venta queda
 * como fundador y nunca la ve.
 */
export function LicenseGate({ state, onChange }: Props) {
  const { t } = useI18n();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LicenseError | null>(null);

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    const bridge = licenseBridge();
    if (!bridge || !key.trim()) { setError('clave-no-valida'); return; }
    setBusy(true);
    setError(null);
    const r = await bridge.activate(key.trim());
    setBusy(false);
    if (r.ok) onChange(r.state);
    else setError(r.error ?? 'error-tienda');
  }

  return (
    <div className="lic-shell">
      <div className="auth-orb" style={{ width: 500, height: 500, background: 'rgba(var(--accent-rgb),0.07)', top: -120, right: -80 }} />
      <div className="auth-orb" style={{ width: 300, height: 300, background: 'rgba(var(--accent-rgb),0.05)', bottom: -60, left: -40 }} />
      <LangSwitch />
      <div className="auth-card">
        <div className="lic-hd">
          <div className="lic-logo"><KeyRound size={22} color="#fff" /></div>
          <div>
            <div className="lic-title">{t('Activa Aula Pro')}</div>
            <div className="lic-sub">{t('Tu cuaderno docente, en tu ordenador')}</div>
          </div>
        </div>

        <p className="lic-text">{t(LICENSE_STATUS_TEXT[state.status] ?? LICENSE_STATUS_TEXT['sin-licencia']!)}</p>

        {error && <div className="lic-err" role="alert">{t(LICENSE_ERROR_TEXT[error])}</div>}

        <form onSubmit={activate}>
          <div className="fgroup">
            <label className="flabel" htmlFor="lic-key">{t('Clave de licencia')}</label>
            <input
              id="lic-key" className="finput lic-input" value={key} autoFocus
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              autoComplete="off" spellCheck={false}
              onChange={e => { setKey(e.target.value); if (error) setError(null); }}
            />
          </div>
          <button className="btn-primary" type="submit" disabled={busy || !key.trim()}>
            {busy ? <><span className="spin" />&nbsp;{t('Activando…')}</> : t('Activar')}
          </button>
        </form>

        {/* En Android, Google Play no deja enlazar a un pago: solo el texto, sin enlace */}
        {isAndroidApp() ? (
          <p className="lic-buy">{t('Consigue tu licencia en aulapro.app')}</p>
        ) : state.buyUrl && (
          <a className="lic-buy" href={state.buyUrl} target="_blank" rel="noreferrer">
            {t('¿Aún no la tienes? Comprar Aula Pro')} <ExternalLink size={13} />
          </a>
        )}

        <p className="lic-note">
          <ShieldCheck size={15} color="var(--ok)" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <span>{t('La activación solo necesita internet una vez; después Aula Pro funciona sin conexión y tus datos no salen de este dispositivo.')}</span>
        </p>
      </div>
    </div>
  );
}
