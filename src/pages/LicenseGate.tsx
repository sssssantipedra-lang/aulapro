import { useEffect, useState } from 'react';
import { KeyRound, ExternalLink, ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n';
import { licenseBridge, LICENSE_ERROR_TEXT, LICENSE_STATUS_TEXT } from '../services/license';
import type { LicenseError, LicenseState } from '../types/electron';
import { LangSwitch } from './Welcome';
import { isAndroidApp, isWebApp } from '../lib/platform';
import { cerrarSesion, enlaceDePago, hayToken, leerCuenta, licenciaDeLaCuenta, type Cuenta } from '../platform/cuentaWeb';

interface Props {
  state: LicenseState;
  onChange: (s: LicenseState) => void;
}

/**
 * Pantalla de activación: sale antes que nada en un equipo sin licencia (ver
 * `electron/license.cjs`). Quien ya usaba AulaPro antes de la venta queda
 * como fundador y nunca la ve.
 */
export function LicenseGate({ state, onChange }: Props) {
  const { t } = useI18n();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LicenseError | null>(null);

  // Versión web: comprar desde aquí con el correo de la cuenta y activarse sola al pagar
  const [cuenta, setCuenta] = useState<Cuenta | undefined>();
  const [esperando, setEsperando] = useState(false);
  useEffect(() => { if (isWebApp()) leerCuenta().then(setCuenta); }, []);
  useEffect(() => {
    if (!esperando) return;
    let vivo = true;
    const mirar = async () => {
      const k = await licenciaDeLaCuenta();
      const r = k && vivo ? await licenseBridge()?.activate(k) : null;
      if (vivo && r?.ok) onChange(r.state);
    };
    const id = setInterval(mirar, 6000);
    window.addEventListener('focus', mirar);
    return () => { vivo = false; clearInterval(id); window.removeEventListener('focus', mirar); };
  }, [esperando, onChange]);

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
            <div className="lic-title">{t('Activa AulaPro')}</div>
            <div className="lic-sub">{t('Tu cuaderno docente, en tu ordenador')}</div>
          </div>
        </div>

        {cuenta ? (
          <div className="lic-compra">
            <p className="lic-text">{t('Con la cuenta {email} todavía no hay una licencia. Cómprala aquí y se activará sola en todos tus dispositivos.', { email: cuenta.email })}</p>
            <a className="btn-primary lic-compra-btn" href={enlaceDePago(cuenta.email)} target="_blank" rel="noreferrer" onClick={() => setEsperando(true)}>
              {t('Comprar AulaPro · 6,99 €')} <ExternalLink size={14} />
            </a>
            {esperando && (hayToken()
              ? <p className="lic-espera"><span className="spin" />{t('Cuando termines el pago, vuelve aquí: AulaPro se activará sola.')}</p>
              : <button type="button" className="btn-ghost" style={{ marginTop: 12 }} onClick={async () => { await cerrarSesion(); window.location.reload(); }}>{t('Ya he pagado: volver a entrar con Google')}</button>)}
            <p className="lic-sub" style={{ marginTop: 14 }}>{t('¿Ya tienes una clave (de otro correo o de un pack)? Escríbela aquí:')}</p>
          </div>
        ) : (
          <p className="lic-text">{t(LICENSE_STATUS_TEXT[state.status] ?? LICENSE_STATUS_TEXT['sin-licencia']!)}</p>
        )}

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

        {/* En Android, Google Play no deja enlazar a un pago: solo el texto, sin enlace. En la web, la misma regla (CLAUDE.md, regla 3) */}
        {cuenta ? null : isAndroidApp() || isWebApp() ? (
          <p className="lic-buy">{t('Consigue tu licencia en aulapro.app')}</p>
        ) : state.buyUrl && (
          <a className="lic-buy" href={state.buyUrl} target="_blank" rel="noreferrer">
            {t('¿Aún no la tienes? Comprar AulaPro')} <ExternalLink size={13} />
          </a>
        )}

        <p className="lic-note">
          <ShieldCheck size={15} color="var(--ok)" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <span>{t('La activación solo necesita internet una vez; después AulaPro funciona sin conexión y tus datos no salen de este dispositivo.')}</span>
        </p>
      </div>
    </div>
  );
}
