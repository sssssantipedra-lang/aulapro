import { useEffect, useRef, useState } from 'react';
import { KeyRound, ExternalLink, ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n';
import { licenseBridge, LICENSE_ERROR_TEXT, LICENSE_STATUS_TEXT } from '../services/license';
import type { LicenseError, LicenseState } from '../types/electron';
import { LangSwitch } from './Welcome';
import { isAndroidApp, isWebApp } from '../lib/platform';
import { botonGoogle, enlaceDePago, hayToken, leerCuenta, licenciaDeLaCuenta, VENTA_ABIERTA, type Cuenta } from '../platform/cuentaWeb';

/** Por qué no se ha podido buscar la compra (`licenciaDeLaCuenta`). */
const AVISO_BUSQUEDA: Record<string, string> = {
  'sin-cuenta': 'Google no ha confirmado tu cuenta. Vuelve a entrar con Google para buscar tu compra.',
  'sin-configurar': 'La búsqueda de compras aún no está configurada en el servidor. Escribe tu clave abajo o avísanos en contacto@aulapro.app.',
  'token': 'Google no ha confirmado tu cuenta. Vuelve a entrar con Google para buscar tu compra.',
  'tienda': 'La tienda no responde ahora mismo. Vuelve a probar en un rato o escribe tu clave abajo.',
  'sin-conexion': 'Para buscar tu compra hace falta internet. Conéctate y vuelve a probar.',
};
/** Con una cuenta de Microsoft: algunas cuentas de centros no dejan comprobar el correo, y entonces se escribe la clave. */
const AVISO_MICROSOFT = 'No hemos podido confirmar tu correo con Microsoft (las cuentas de algunos centros no lo permiten). Si compraste con ese correo, usa «¿Compraste con otro correo o tienes un pack? Escribe tu clave».';
const avisoDe = (proveedor: string | undefined, error: string) => (proveedor === 'microsoft' && ['sin-cuenta', 'token'].includes(error) ? AVISO_MICROSOFT : AVISO_BUSQUEDA[error]);

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
  const { t, lang } = useI18n();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LicenseError | null>(null);

  // Versión web: comprar desde aquí con el correo de la cuenta y activarse sola al pagar
  const [cuenta, setCuenta] = useState<Cuenta | undefined>();
  const [esperando, setEsperando] = useState(false);
  const [mirando, setMirando] = useState(false);
  const [aviso, setAviso] = useState('');
  // Con la cuenta, la clave escrita a mano es lo raro: queda detrás de un enlace pequeño
  // Con la venta cerrada no hay nada que comprar: la clave a mano sale ya a la vista
  const [conClave, setConClave] = useState(!VENTA_ABIERTA);

  /** Busca la compra de esta cuenta y, si la hay, activa la licencia. */
  async function comprobarCompra(manual: boolean) {
    if (manual) { setMirando(true); setAviso(''); }
    const b = await licenciaDeLaCuenta();
    const bridge = licenseBridge();
    if (manual) setMirando(false);
    if (b.key && bridge?.porCuenta) { onChange(await bridge.porCuenta(b.key, b.firma)); return; }
    if (!manual) return;
    if (!('error' in b) || !b.error) setAviso(t('Todavía no aparece ninguna compra con {email}. Si acabas de pagar, espera un minuto y vuelve a comprobar.', { email: cuenta?.email ?? '' }));
    else setAviso(t(avisoDe(cuenta?.proveedor, b.error)));
  }
  useEffect(() => { if (isWebApp()) leerCuenta().then(setCuenta); }, []);

  // Sin el token de Google de esta sesión (la app se abrió otro día, y Safari no lo da solo),
  // «Ya he pagado» lleva encima el botón de Google: un toque confirma la cuenta y busca la compra.
  const [conToken, setConToken] = useState(hayToken);
  const botonReal = useRef<HTMLDivElement>(null);
  const buscar = useRef(comprobarCompra);
  useEffect(() => { buscar.current = comprobarCompra; });
  useEffect(() => {
    if (!cuenta || cuenta.proveedor === 'microsoft' || conToken || !botonReal.current) return;
    const el = botonReal.current;
    el.innerHTML = '';
    botonGoogle(el, lang, () => { setConToken(true); void buscar.current(true); }, () => setAviso(t(AVISO_BUSQUEDA['token'])))
      .catch(() => setConToken(true));
  }, [cuenta, conToken, lang, t]);
  useEffect(() => {
    if (!esperando) return;
    let vivo = true;
    const mirar = async () => {
      const b = await licenciaDeLaCuenta();
      const bridge = licenseBridge();
      if (vivo && b.key && bridge?.porCuenta) onChange(await bridge.porCuenta(b.key, b.firma));
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
    if (r.ok) {
      // Versión web: la clave a mano queda en el Drive de la cuenta, para los demás dispositivos
      if (isWebApp()) import('../platform/carpetaWeb').then(m => m.guardarClaveEnNube(key.trim())).catch(() => {});
      onChange(r.state);
    }
    else setError(r.error ?? 'error-tienda');
  }

  return (
    <div className="lic-shell">
      <div className="auth-orb" style={{ width: 500, height: 500, background: 'rgba(var(--accent-rgb),0.07)', top: -120, right: -80 }} />
      <div className="auth-orb" style={{ width: 300, height: 300, background: 'rgba(var(--accent-rgb),0.05)', bottom: -60, left: -40 }} />
      <LangSwitch claro />
      <div className="auth-card">
        <div className="lic-hd">
          <div className="lic-logo"><KeyRound size={22} color="#fff" /></div>
          <div>
            <div className="lic-title">{t('Activa AulaPro')}</div>
            <div className="lic-sub">{t(isWebApp() ? 'Tu cuaderno docente, en todos tus dispositivos' : 'Tu cuaderno docente, en tu ordenador')}</div>
          </div>
        </div>

        {cuenta ? (
          <div className="lic-compra">
            <p className="lic-text">{VENTA_ABIERTA
              ? t('Con la cuenta {email} todavía no hay una licencia. Suscríbete aquí y se activará sola en todos tus dispositivos.', { email: cuenta.email })
              : t('Con la cuenta {email} todavía no hay una licencia. AulaPro sale a la venta el 10 de noviembre de 2026. Si ya tienes una clave, escríbela abajo.', { email: cuenta.email })}</p>
            {VENTA_ABIERTA && (
              <a className="btn-primary lic-compra-btn" href={enlaceDePago(cuenta.email)} target="_blank" rel="noreferrer" onClick={() => setEsperando(true)}>
                {t('Suscribirme · 9,90 € el primer año')} <ExternalLink size={14} />
              </a>
            )}
            {esperando && <p className="lic-espera"><span className="spin" />{t('Cuando termines el pago, vuelve aquí: AulaPro se activará sola.')}</p>}
            <div style={{ position: 'relative', marginTop: 10, overflow: 'hidden', borderRadius: 'var(--r)' }}>
              <button type="button" className="btn-ghost" style={{ width: '100%', justifyContent: 'center' }} disabled={mirando} onClick={() => comprobarCompra(true)}>
                {mirando ? <><span className="spin" />&nbsp;{t('Comprobando…')}</> : t('Ya he pagado: comprobar mi compra')}
              </button>
              {!conToken && cuenta.proveedor !== 'microsoft' && <div ref={botonReal} className="entrar-google-real" aria-label={t('Ya he pagado: comprobar mi compra')} />}
            </div>
            {aviso && <div className="lic-err" role="status" style={{ marginTop: 10 }}>{aviso}</div>}
            {!conClave && (
              <button type="button" className="lic-link" style={{ display: 'block', margin: '16px auto 0', fontSize: 12.5 }} onClick={() => setConClave(true)}>
                {t('¿Compraste con otro correo o tienes un pack? Escribe tu clave')}
              </button>
            )}
          </div>
        ) : (
          <p className="lic-text">{t(LICENSE_STATUS_TEXT[state.status] ?? LICENSE_STATUS_TEXT['sin-licencia']!)}</p>
        )}

        {error && <div className="lic-err" role="alert">{t(LICENSE_ERROR_TEXT[error])}</div>}

        {(!cuenta || conClave) && <form onSubmit={activate} style={cuenta ? { marginTop: 14 } : undefined}>
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
        </form>}

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
          <span>{t(isWebApp() ? 'La licencia va con tu cuenta de Google. Tu trabajo nunca pasa por un servidor de AulaPro: se queda en tu dispositivo y, si lo eliges, en tu Google Drive.' : 'La activación solo necesita internet una vez; después AulaPro funciona sin conexión y tus datos no salen de este dispositivo.')}</span>
        </p>
      </div>
    </div>
  );
}
