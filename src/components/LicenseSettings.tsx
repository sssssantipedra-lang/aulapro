import { useState } from 'react';
import { BadgeCheck, KeyRound, Heart, CalendarClock, RefreshCw } from 'lucide-react';
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
  const fecha = (iso: string) => iso ? new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'ca' ? 'ca-ES' : 'es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const since = fecha(state.since);
  const hasta = fecha(state.expiresAt);
  const caducada = state.status === 'caducada';
  // En Android la licencia es una compra de Google Play, sin clave (`platform/androidPlay.ts`)
  const play = licenseBridge()?.play;

  async function comprarAnual() {
    if (!play) return;
    setBusy(true);
    const r = await play.comprar('anual');
    setBusy(false);
    onChange(r.state);
    if (r.ok) toast(t('✅ Licencia renovada'));
    else toast(t(LICENSE_ERROR_TEXT[r.error ?? 'error-tienda']));
  }

  async function recheck() {
    const bridge = licenseBridge();
    if (!bridge) return;
    setBusy(true);
    const r = await bridge.recheck();
    setBusy(false);
    onChange(r.state);
    if (!r.ok) toast(t('Para comprobar la licencia hace falta internet. Conéctate y vuelve a probar.'));
    else if (r.state.status === 'caducada') toast(t(play ? 'La licencia sigue caducada. Renuévala en Google Play.' : 'La licencia sigue caducada. Renuévala en aulapro.app.'));
    else toast(t('✅ Licencia renovada'));
  }

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
      {caducada
        ? <div className="lic-badge caducada"><CalendarClock size={15} />{t('Licencia caducada')}</div>
        : <div className="lic-badge ok"><BadgeCheck size={15} />{t('Licencia activa')}</div>}
      <div className="lic-row">
        <KeyRound size={16} color="var(--accent-d)" />
        {play ? <span className="lic-key">Google Play</span> : <span className="lic-key">{state.keyHint}</span>}
        {since && <span className="lic-card-meta">· {t('activada el {d}', { d: since })}</span>}
      </div>
      {hasta && (
        <p className="lic-card-meta">
          {caducada ? t('Caducó el {d}', { d: hasta }) : t('Licencia anual, válida hasta el {d}', { d: hasta })}
        </p>
      )}
      {caducada && (
        <>
          <p className="lic-card-txt">
            {t('Puedes abrir y revisar todo lo que ya creaste, y exportarlo, pero no añadir ni cambiar nada. Tus datos no se borran nunca. Al renovar, todo vuelve a la normalidad.')}
          </p>
          <p className="lic-card-txt">
            {play || !state.buyUrl
              ? (play ? t('Renueva tu licencia en Google Play.') : t('Renueva tu licencia en aulapro.app'))
              : <a href={state.buyUrl} target="_blank" rel="noreferrer">{t('Renovar en aulapro.app')}</a>}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {play && (
              <button type="button" className="btn-primary" onClick={comprarAnual} disabled={busy}>{t('Renovar con Google Play')}</button>
            )}
            <button type="button" className="btn-accent" onClick={recheck} disabled={busy}>
              {busy ? <span className="spin" /> : <RefreshCw size={14} />}&nbsp;{t('Volver a comprobar')}
            </button>
          </div>
        </>
      )}
      {play ? (
        <>
          <p className="lic-card-txt">
            {t('Tu licencia está en tu cuenta de Google: en otro móvil con la misma cuenta, pulsa «Restaurar compra» al abrir Aula Pro.')}
          </p>
          <button type="button" className="btn-ghost" onClick={() => play.gestionar()}>{t('Gestionar en Google Play')}</button>
        </>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
