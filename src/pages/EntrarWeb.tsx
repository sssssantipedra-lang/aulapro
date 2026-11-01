import { useEffect, useRef, useState } from 'react';
import { FolderSync, ShieldAlert, ShieldCheck } from 'lucide-react';
import { DondeGuardar } from '../components/DondeGuardar';
import { useI18n } from '../i18n';
import { LangSwitch } from './Welcome';
import { cargarGoogle, cuentaActual, MICROSOFT_LISTO, type Cuenta } from '../platform/cuentaWeb';
import { entrarConGoogle, hayVueltaEntrada, terminarVueltaEntrada } from '../platform/googleDrive';
import { entrarConMicrosoft, hayVueltaEntradaMicrosoft, terminarVueltaEntradaMicrosoft } from '../platform/microsoft';
import { carpetaWeb } from '../platform/carpetaWeb';
import { DRIVE_LLENO } from '../platform/driveFs';

/** Logo de Google (los cuatro colores oficiales). */
function LogoGoogle() {
  return (
    <svg width="26" height="26" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.6 44 33 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** Logo de Microsoft (los cuatro cuadrados). */
function LogoMicrosoft() {
  return (
    <svg width="24" height="24" viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" /><path fill="#7FBA00" d="M12 1h10v10H12z" />
      <path fill="#00A4EF" d="M1 12h10v10H1z" /><path fill="#FFB900" d="M12 12h10v10H12z" />
    </svg>
  );
}

/** Tras entrar con Drive ya permitido: el paso de Drive solo termina de conectar (ver `ConectarDriveWeb`). */
export const CONECTAR_YA = 'aulapro_conectar_drive';

/**
 * Versión web: la entrada, antes que nada (ver `platform/cuentaWeb.ts`). El
 * logo grande y una tarjeta por cuenta. La de Google pide en la misma ventana
 * entrar y guardar en Drive (decisión del dueño, 29-10-2026: un solo paso en
 * cada dispositivo; `entrarConGoogle` en `platform/googleDrive.ts`). La de
 * Microsoft aún no funciona (decisión del dueño, 29-10-2026: que se vea ya).
 */
export function EntrarWeb({ onEntrar }: { onEntrar: (c: Cuenta) => void }) {
  const { t } = useI18n();
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function entrar(fn: () => Promise<{ cuenta: Cuenta; drive: boolean }>) {
    setOcupado(true); setError('');
    try {
      const { cuenta, drive } = await fn();
      if (drive) { try { sessionStorage.setItem(CONECTAR_YA, '1'); } catch { /* sin almacenamiento */ } }
      onEntrar(cuenta);
    } catch (err) {
      setError((err as DOMException)?.name === 'NotAllowedError'
        ? t('No se ha podido entrar con esa cuenta. Vuelve a probar.')
        : `${t('No se ha podido entrar con esa cuenta. Vuelve a probar.')} (${(err as Error)?.message || String(err)})`);
      setOcupado(false);
    }
  }

  // Google cargado antes del toque (la ventana solo se abre en el mismo instante), y de vuelta de su página (Safari)
  const vuelta = useRef(false);
  useEffect(() => {
    cargarGoogle().then(() => setListo(true))
      .catch(() => setError(t('Para entrar la primera vez hace falta internet. Conéctate y vuelve a probar.')));
    if (!vuelta.current && hayVueltaEntrada()) { vuelta.current = true; void entrar(terminarVueltaEntrada); }
    if (!vuelta.current && hayVueltaEntradaMicrosoft()) { vuelta.current = true; void entrar(terminarVueltaEntradaMicrosoft); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="lic-shell entrar">
      <div className="auth-orb" style={{ width: 560, height: 560, background: 'rgba(var(--accent-rgb),0.10)', top: -160, right: -120 }} />
      <div className="auth-orb" style={{ width: 420, height: 420, background: 'rgba(71,191,255,0.10)', bottom: -120, left: -100 }} />
      <LangSwitch claro />

      <div className="entrar-caja">
        <img className="entrar-logo" src="./favicon.svg" alt="AulaPro" width={148} height={148} />
        <h1 className="entrar-titulo">{t('Tu cuaderno docente')}</h1>
        <p className="entrar-sub">{t('Entra con tu cuenta y tendrás AulaPro en todos tus dispositivos.')}</p>

        {error && <div className="lic-err entrar-err" role="alert">{error}</div>}

        <div className="entrar-tarjetas">
          <button type="button" className={`entrar-tarjeta${listo ? '' : ' cargando'}`} disabled={!listo || ocupado} onClick={() => entrar(entrarConGoogle)}>
            <span className="entrar-ico"><LogoGoogle /></span>
            <span className="entrar-txt">
              <strong>{t('Continuar con Google')}</strong>
              <em>{t('Gmail o la cuenta de Google de tu centro')}</em>
            </span>
            {(!listo || ocupado) && !error && <span className="spin" aria-hidden="true" />}
          </button>

          {MICROSOFT_LISTO ? (
            <button type="button" className="entrar-tarjeta" disabled={ocupado} onClick={() => entrar(entrarConMicrosoft)}>
              <span className="entrar-ico"><LogoMicrosoft /></span>
              <span className="entrar-txt">
                <strong>{t('Continuar con Microsoft')}</strong>
                <em>{t('Outlook, Hotmail o Microsoft 365 de tu centro')}</em>
              </span>
            </button>
          ) : (
            <div className="entrar-tarjeta off" aria-disabled="true">
              <span className="entrar-ico"><LogoMicrosoft /></span>
              <span className="entrar-txt">
                <strong>{t('Continuar con Microsoft')}</strong>
                <em>{t('Outlook, Hotmail o Microsoft 365 de tu centro')}</em>
              </span>
              <span className="entrar-pronto">{t('Próximamente')}</span>
            </div>
          )}
        </div>

        <p className="entrar-nota">
          <ShieldCheck size={15} aria-hidden="true" />
          <span>{t('AulaPro solo guarda tu nombre y tu correo en este dispositivo. Tu trabajo no sale hacia ningún servidor de AulaPro.')}</span>
        </p>
        {/* Auditoría del 1-11-2026: quien entra sin comprar (los fundadores) también acepta las condiciones de uso */}
        <p className="entrar-legal" style={{ fontSize: 12, color: 'var(--text-3)', margin: '10px 0 0', textAlign: 'center' }}>
          {t('Al entrar aceptas las')}{' '}
          <a href="../condiciones.html" target="_blank" rel="noopener noreferrer">{t('condiciones de venta y de uso')}</a>{' '}
          {t('y la')}{' '}
          <a href="../privacidad.html" target="_blank" rel="noopener noreferrer">{t('política de privacidad')}</a>.
        </p>
      </div>
    </div>
  );
}

/** Logo de Google Drive. */
function LogoDrive() {
  return (
    <svg width="26" height="26" viewBox="0 0 87.3 78" aria-hidden="true">
      <path fill="#0066da" d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" />
      <path fill="#00ac47" d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44A9.06 9.06 0 0 0 0 53h27.5z" />
      <path fill="#ea4335" d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" />
      <path fill="#00832d" d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" />
      <path fill="#2684fc" d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" />
      <path fill="#ffba00" d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z" />
    </svg>
  );
}

/**
 * Versión web, segundo paso al entrar: guardar el trabajo en el Google Drive
 * de la cuenta (`platform/googleDrive.ts`, `driveFs.ts`). Un clic abre la
 * ventana de Google; si el Drive ya tiene trabajo de otro dispositivo, se trae.
 */
export function ConectarDriveWeb({ onListo }: { onListo: () => void }) {
  const { t } = useI18n();
  // Con una cuenta de Microsoft, la nube es OneDrive (`platform/microsoft.ts`)
  const ms = useState(() => cuentaActual()?.proveedor === 'microsoft')[0];
  const [ocupado, setOcupado] = useState(false);
  const [elegir, setElegir] = useState(false);
  /** Lo que se eligió fue una carpeta del ordenador (no la nube): cambia los textos de «¿con cuál te quedas?». */
  const [conCarpeta, setConCarpeta] = useState(false);
  /** Pulsó «Ahora no»: antes de dejarle seguir sin nube, se le explica lo que arriesga. */
  const [confirmandoLocal, setConfirmandoLocal] = useState(false);
  const [error, setError] = useState('');
  // Google cargado antes del toque: Safari bloquea la ventana si se abre después de esperar.
  useEffect(() => { if (!ms) cargarGoogle().catch(() => {}); }, [ms]);
  // De vuelta de la página de Google (Safari) o de Microsoft: se termina solo
  const vuelta = useRef(false);
  useEffect(() => {
    if (vuelta.current) return;
    let ya = false;
    try { ya = sessionStorage.getItem(CONECTAR_YA) === '1'; sessionStorage.removeItem(CONECTAR_YA); } catch { /* sin almacenamiento */ }
    if (ya) { vuelta.current = true; void correr(() => carpetaWeb.conectarYa()); return; }
    if (!carpetaWeb.hayVuelta()) return;
    vuelta.current = true;
    void correr(() => carpetaWeb.terminarVuelta());
  });

  async function correr(fn: () => Promise<{ elegir: boolean; cargados: number } | null>) {
    setOcupado(true); setError('');
    try {
      const r = await fn();
      if (r?.elegir) { setElegir(true); setOcupado(false); return; }
      // La app aún no se ha abierto (este paso va antes): lo traído de Drive se lee al abrirla, sin recargar
      onListo();
    } catch (err) {
      if ((err as Error)?.message === DRIVE_LLENO) {
        // El Drive o el OneDrive no tiene sitio: no se arregla dando permiso, y el trabajo puede seguir en este dispositivo
        setError(t(ms
          ? 'Tu OneDrive está lleno y AulaPro no puede guardar ahí. Libera espacio y vuelve a probar, o pulsa «Ahora no» para guardar solo en este dispositivo.'
          : 'Tu Google Drive está lleno y AulaPro no puede guardar ahí. Libera espacio y vuelve a probar, o pulsa «Ahora no» para guardar solo en este dispositivo.'));
        setOcupado(false);
        return;
      }
      setError((err as DOMException)?.name === 'NotAllowedError'
        ? t(ms ? 'Microsoft no ha dado el permiso. Vuelve a probar; si tu centro no lo permite, usa «Ahora no» y guarda en este dispositivo.' : 'Google no ha dado el permiso. Vuelve a probar y marca la casilla de Google Drive.')
        : `${t(ms ? 'No se ha podido conectar con OneDrive. Vuelve a probar en un momento.' : 'No se ha podido conectar con Google Drive. Vuelve a probar en un momento.')} (${(err as Error)?.message || String(err)})`);
    }
    setOcupado(false);
  }

  /** Una carpeta del ordenador (Chrome y Edge): cada cambio se copia ahí. Si se cierra el selector, no pasa nada. */
  async function elegirCarpeta() {
    setOcupado(true); setError('');
    try {
      const r = await carpetaWeb.elegir();
      if (!r) { setOcupado(false); return; }
      if (r.elegir) { setConCarpeta(true); setElegir(true); setOcupado(false); return; }
      onListo();
    } catch (err) {
      setError(`${t('No se ha podido guardar en esa carpeta.')} (${(err as Error)?.message || String(err)})`);
    }
    setOcupado(false);
  }

  return (
    <div className="lic-shell entrar">
      <div className="auth-orb" style={{ width: 560, height: 560, background: 'rgba(var(--accent-rgb),0.10)', top: -160, right: -120 }} />
      <div className="auth-orb" style={{ width: 420, height: 420, background: 'rgba(71,191,255,0.10)', bottom: -120, left: -100 }} />
      <LangSwitch claro />
      <div className="entrar-caja">
        <img className="entrar-logo" src="./favicon.svg" alt="AulaPro" width={148} height={148} />
        <h1 className="entrar-titulo">{t(ms ? 'Tu trabajo, en tu OneDrive' : 'Tu trabajo, en tu Google Drive')}</h1>
        <p className="entrar-sub">{t(ms ? 'AulaPro guardará todo en una carpeta «AulaPro» de tu OneDrive. Así lo tienes en todos tus dispositivos y no se pierde nunca. Solo ve los archivos que crea ella.' : 'AulaPro guardará todo en una carpeta «AulaPro» de tu Drive. Así lo tienes en todos tus dispositivos y no se pierde nunca. Solo ve los archivos que crea ella.')}</p>

        {error && <div className="lic-err entrar-err" role="alert">{error}</div>}

        {elegir ? (
          <div className="entrar-tarjetas">
            <p className="entrar-sub" style={{ margin: '0 0 4px' }}>{t(conCarpeta ? 'Esa carpeta ya tiene trabajo de AulaPro y este navegador también. ¿Con cuál te quedas?' : ms ? 'Tu OneDrive ya tiene trabajo de AulaPro y este navegador también. ¿Con cuál te quedas?' : 'Tu Drive ya tiene trabajo de AulaPro y este navegador también. ¿Con cuál te quedas?')}</p>
            <button type="button" className="entrar-tarjeta" disabled={ocupado} onClick={() => correr(() => carpetaWeb.confirmar('carpeta'))}>
              <span className="entrar-ico">{ms ? <LogoMicrosoft /> : <LogoDrive />}</span>
              <span className="entrar-txt"><strong>{t(conCarpeta ? 'Usar el de la carpeta' : ms ? 'Usar el de mi OneDrive' : 'Usar el de mi Drive')}</strong><em>{t('Lo que solo esté en este navegador también se conserva.')}</em></span>
            </button>
            <button type="button" className="entrar-tarjeta" disabled={ocupado} onClick={() => correr(() => carpetaWeb.confirmar('local'))}>
              <span className="entrar-ico"><ShieldCheck size={24} aria-hidden="true" /></span>
              <span className="entrar-txt"><strong>{t('Usar el de este navegador')}</strong><em>{t(conCarpeta ? 'Sustituye lo que hay en la carpeta.' : ms ? 'Sustituye lo que hay en tu OneDrive.' : 'Sustituye lo que hay en tu Drive.')}</em></span>
            </button>
          </div>
        ) : (
          <div className="entrar-tarjetas">
            <button type="button" className="entrar-tarjeta" disabled={ocupado} onClick={() => correr(() => carpetaWeb.conectarDrive())}>
              <span className="entrar-ico">{ms ? <LogoMicrosoft /> : <LogoDrive />}</span>
              <span className="entrar-txt"><strong>{t(ms ? 'Guardar en mi OneDrive' : 'Guardar en mi Google Drive')} <span className="donde-rec">{t('Recomendado')}</span></strong><em>{t(ms ? 'Un clic y Microsoft te pide permiso. Es lo más seguro.' : 'Un clic y Google te pide permiso. Es lo más seguro.')}</em></span>
              {ocupado && <span className="spin" aria-hidden="true" />}
            </button>
            {carpetaWeb.soportada() && (
              <button type="button" className="entrar-tarjeta" disabled={ocupado} onClick={elegirCarpeta}>
                <span className="entrar-ico"><FolderSync size={24} aria-hidden="true" /></span>
                <span className="entrar-txt"><strong>{t('Guardar en una carpeta de mi ordenador')}</strong><em>{t('Cada cambio se copia ahí. Mejor la de OneDrive o Google Drive de tu ordenador.')}</em></span>
              </button>
            )}
          </div>
        )}

        <DondeGuardar ms={ms} carpeta={carpetaWeb.soportada()} />

        {confirmandoLocal ? (
          <div className="entrar-confirma" role="alertdialog" aria-labelledby="entrar-confirma-ttl">
            <ShieldAlert size={20} aria-hidden="true" />
            <strong id="entrar-confirma-ttl">{t('¿Seguro que quieres guardar solo en este navegador?')}</strong>
            <p>{t(ms
              ? 'Si se borran los datos del navegador, cambias de dispositivo o se estropea, perderás tu trabajo y AulaPro no podrá recuperarlo. Guardarlo en tu OneDrive son dos clics y después se hace solo.'
              : 'Si se borran los datos del navegador, cambias de dispositivo o se estropea, perderás tu trabajo y AulaPro no podrá recuperarlo. Guardarlo en tu Google Drive son dos clics y después se hace solo.')}</p>
            <button type="button" className="entrar-tarjeta" disabled={ocupado} onClick={() => { setConfirmandoLocal(false); void correr(() => carpetaWeb.conectarDrive()); }}>
              <span className="entrar-ico">{ms ? <LogoMicrosoft /> : <LogoDrive />}</span>
              <span className="entrar-txt"><strong>{t(ms ? 'Guardar en mi OneDrive' : 'Guardar en mi Google Drive')}</strong><em>{t('Recomendado')}</em></span>
            </button>
            <button type="button" className="entrar-ahora-no" disabled={ocupado} onClick={onListo}>{t('Entiendo el riesgo: seguir sin guardar en la nube')}</button>
          </div>
        ) : (
          <>
            <button type="button" className="entrar-ahora-no" disabled={ocupado} onClick={() => setConfirmandoLocal(true)}>{t('Ahora no: guardar solo en este dispositivo')}</button>
            <p className="entrar-aviso-local">
              <ShieldAlert size={16} aria-hidden="true" />
              <span>{t('Si guardas solo en este dispositivo, tu trabajo se puede perder: si se borran los datos del navegador, si cambias de dispositivo o si se estropea. AulaPro te lo recordará y te dejará descargar copias.')}</span>
            </p>
          </>
        )}

        <p className="entrar-nota">
          <ShieldCheck size={15} aria-hidden="true" />
          <span>{t(ms ? 'Tu trabajo va de este dispositivo a tu OneDrive directamente. Nunca pasa por un servidor de AulaPro.' : 'Tu trabajo va de este dispositivo a tu Drive directamente. Nunca pasa por un servidor de AulaPro.')}</span>
        </p>
      </div>
    </div>
  );
}
