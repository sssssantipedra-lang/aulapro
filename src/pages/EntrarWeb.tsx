import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, UserCircle } from 'lucide-react';
import { useI18n } from '../i18n';
import { LangSwitch } from './Welcome';
import { botonGoogle, type Cuenta } from '../platform/cuentaWeb';

/**
 * Versión web: antes que nada, entrar con la cuenta de Google (ver
 * `platform/cuentaWeb.ts`). Usa el mismo marco que la pantalla de licencia.
 */
export function EntrarWeb({ onEntrar }: { onEntrar: (c: Cuenta) => void }) {
  const { t, lang } = useI18n();
  const caja = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!caja.current) return;
    caja.current.innerHTML = '';
    botonGoogle(caja.current, lang, onEntrar, () => setError(t('No se ha podido entrar con esa cuenta. Vuelve a probar.')))
      .catch(() => setError(t('Para entrar la primera vez hace falta internet. Conéctate y vuelve a probar.')));
  }, [lang, onEntrar, t]);

  return (
    <div className="lic-shell">
      <div className="auth-orb" style={{ width: 500, height: 500, background: 'rgba(var(--accent-rgb),0.07)', top: -120, right: -80 }} />
      <div className="auth-orb" style={{ width: 300, height: 300, background: 'rgba(var(--accent-rgb),0.05)', bottom: -60, left: -40 }} />
      <LangSwitch />
      <div className="auth-card">
        <div className="lic-hd">
          <div className="lic-logo"><UserCircle size={22} color="#fff" /></div>
          <div>
            <div className="lic-title">{t('Entra en AulaPro')}</div>
            <div className="lic-sub">{t('Con tu cuenta de Google')}</div>
          </div>
        </div>

        <p className="lic-text">{t('Entra con la misma cuenta en todos tus dispositivos.')}</p>

        {error && <div className="lic-err" role="alert">{error}</div>}

        <div ref={caja} className="entrar-google" />

        <p className="lic-note">
          <ShieldCheck size={15} color="var(--ok)" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <span>{t('AulaPro solo guarda tu nombre y tu correo en este dispositivo. Tu trabajo no sale hacia ningún servidor de AulaPro.')}</span>
        </p>
      </div>
    </div>
  );
}
