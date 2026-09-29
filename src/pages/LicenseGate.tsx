import { useState } from 'react';
import { KeyRound, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n';
import { licenseBridge, LICENSE_ERROR_TEXT, LICENSE_STATUS_TEXT } from '../services/license';
import type { LicenseError, LicenseState } from '../types/electron';
import { LangSwitch } from './Welcome';

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
  const expired = state.status === 'caducada';

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

  async function recheck() {
    const bridge = licenseBridge();
    if (!bridge) return;
    setBusy(true);
    setError(null);
    const s = await bridge.recheck();
    setBusy(false);
    if (s.required) setError('sin-conexion');
    onChange(s);
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

        {expired ? (
          <button type="button" className="btn-primary" onClick={recheck} disabled={busy}>
            {busy ? <span className="spin" /> : <RefreshCw size={15} />}&nbsp;{t('Volver a comprobar')}
          </button>
        ) : (
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
        )}

        {state.buyUrl && !expired && (
          <a className="lic-buy" href={state.buyUrl} target="_blank" rel="noreferrer">
            {t('¿Aún no la tienes? Comprar Aula Pro')} <ExternalLink size={13} />
          </a>
        )}

        <p className="lic-note">
          <ShieldCheck size={15} color="var(--ok)" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <span>{t('Pago único. La activación solo necesita internet una vez; después Aula Pro funciona sin conexión y tus datos no salen de este ordenador.')}</span>
        </p>
      </div>
    </div>
  );
}
