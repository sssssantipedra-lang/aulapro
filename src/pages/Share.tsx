import { useEffect, useState } from 'react';
import {
  Users2, Copy, Check, Send, Inbox, ShieldCheck, Wifi, WifiOff,
  RefreshCw, AlertTriangle, ArrowRight, QrCode,
} from 'lucide-react';
import { SessionQR } from '../components/share/SessionQR';
import { QRScanner } from '../components/share/QRScanner';
import type { Class } from '../types';
import type { ShareScope } from '../services/sync';
import type { useP2PSync } from '../hooks/useP2PSync';
import type { useLanSync } from '../hooks/useLanSync';
import { formatCode, isCompleteCode, normalizeCode, shareUrl, parseScannedCode } from '../services/p2p';
import { parseLanUrl } from '../services/lan';
import { takeShareCode } from '../lib/shareNav';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';

interface Counts {
  classes: number;
  students: number;
  grades: number;
  rubrics: number;
  evaluations: number;
}

interface Props {
  classes: Class[];
  scope: ShareScope;
  onScopeChange: (s: ShareScope) => void;
  session: ReturnType<typeof useP2PSync>;
  lan: ReturnType<typeof useLanSync>;
  counts: Counts;
}

/** Muestra el código de sesión en grande, listo para dictar o copiar. */
function CodeDisplay({ code, qrValue }: { code: string; qrValue: string }) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast(t('✅ Código copiado'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(t('No se pudo copiar. Dicta el código a tu compañero/a.'));
    }
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 12, fontWeight: 600 }}>
        {t('Tu compañero/a puede escanear el QR o escribir el código')}
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        <SessionQR value={qrValue} />

        <div>
          <div
            style={{
              display: 'inline-block', padding: '14px 24px', borderRadius: 16,
              background: 'var(--accent-l)', border: '1.5px solid rgba(var(--accent-rgb),0.35)',
              fontSize: 34, fontWeight: 800, letterSpacing: '0.14em',
              color: 'var(--accent-d)', fontVariantNumeric: 'tabular-nums',
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            }}
          >
            {formatCode(code)}
          </div>
          <div style={{ marginTop: 10 }}>
            <button className="btn-ghost" style={{ fontSize: 12.5 }} onClick={copy}>
              {copied ? <><Check size={13} />{t('Copiado')}</> : <><Copy size={13} />{t('Copiar código')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Share({ classes, scope, onScopeChange, session, lan, counts }: Props) {
  const { t, locale } = useI18n();
  const [codeInput, setCodeInput] = useState('');
  const [scanning, setScanning]   = useState(false);
  // Rol elegido en la interfaz: el invitado escoge su papel antes de tener código
  const [uiRole, setUiRole] = useState<'host' | 'guest' | null>(null);

  const { state, code, peerName, lastSyncAt, error, connected, busy } = session;
  const role = uiRole;
  const nothingSelected = scope.classIds.length === 0;
  // Conectado por PeerJS (internet) o por el canal local (misma wifi sin internet).
  const conectado = connected || lan.peer;

  // Si la app se abrió desde un enlace (aulapro://c/XXXXXX), se toma el código
  // y se conecta como invitado sin pedir clase.
  useEffect(() => {
    const unir = () => {
      const c = takeShareCode();
      if (!c) return;
      setUiRole('guest');
      setCodeInput(c);
      session.startJoin(c);
    };
    unir();
    window.addEventListener('aulapro:open-share', unir);
    return () => window.removeEventListener('aulapro:open-share', unir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function desconectar() {
    session.disconnect();
    lan.stop();
    setUiRole(null);
    setCodeInput('');
    setScanning(false);
  }

  function restart() {
    desconectar();
  }

  function toggleClass(id: string) {
    onScopeChange({
      ...scope,
      classIds: scope.classIds.includes(id)
        ? scope.classIds.filter(x => x !== id)
        : [...scope.classIds, id],
    });
  }

  /* ── Conectado ── */
  if (conectado) {
    return (
      <section className="sec active">
        <div className="pg-hd">
          <div>
            <h1 className="pg-title">{t('Trabajo compartido')}</h1>
            <p className="pg-sub">{t('Conexión activa con otro docente')}</p>
          </div>
          <button className="btn-ghost" style={{ color: 'var(--danger)' }} onClick={desconectar}>
            <WifiOff size={14} />{t('Desconectar')}
          </button>
        </div>

        <div className="card" style={{ maxWidth: 720, borderLeft: '3px solid var(--ok)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Wifi size={22} color="var(--ok)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                {t('Conectado con {name}', { name: peerName || t('tu compañero/a') })}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>
                {t('Los cambios de los dos se sincronizan automáticamente')}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-3)', flexShrink: 0 }}>
              <RefreshCw size={12} />
              {lastSyncAt ? lastSyncAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10 }}>
            {[
              { label: t('Clases'), val: counts.classes },
              { label: t('Alumnos'), val: counts.students },
              { label: t('Calificaciones'), val: counts.grades },
              { label: t('Rúbricas y dianas'), val: counts.rubrics },
              { label: t('Evaluaciones'), val: counts.evaluations },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>{s.val}</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 18, paddingTop: 14, borderTop: '0.5px solid var(--border)', lineHeight: 1.6 }}>
            {t('Puedes seguir trabajando con normalidad en cualquier sección: la conexión sigue viva mientras la app esté abierta.')}{' '}
            <strong>{t('Lo que borra uno de los dos también se borra en el otro equipo')}</strong>{t(', así los dos veis siempre los mismos datos.')}
          </p>
        </div>
      </section>
    );
  }

  /* ── Sin conectar ── */
  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Trabajo compartido')}</h1>
          <p className="pg-sub">{t('Trabaja a la vez con otro docente sobre las mismas clases')}</p>
        </div>
      </div>

      <div className="stack-sm" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ── Mandar datos ── */}
          <div className="card">
            <div className="card-hd">
              <div className="card-ttl"><Send size={16} color="var(--accent-d)" />{t('Mandar datos')}</div>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 14px' }}>
              {t('Eliges las clases y lo que se comparte, y te sale un código y un QR para dárselos a tu compañero/a.')}
            </p>

            {classes.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                {t('Todavía no tienes clases que compartir. Crea una en «Mis Clases».')}
              </p>
            ) : role === 'host' ? (
              <div>
                {busy || !code ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-2)', fontSize: 13, padding: '16px 0', justifyContent: 'center' }}>
                    <span className="spin" />{t('Creando la sesión…')}
                  </div>
                ) : (
                  <>
                    <CodeDisplay code={code} qrValue={lan.lanUrl ?? (code ? shareUrl(code) : '')} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 18, padding: '11px 14px', borderRadius: 9, background: 'var(--surface)', fontSize: 12.5, color: 'var(--text-2)' }}>
                      <span className="spin" style={{ flexShrink: 0 }} />
                      {t('Esperando a que se una… Deja esta ventana abierta.')}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {classes.map(c => {
                    const on = scope.classIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleClass(c.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 15px',
                          background: on ? c.color : 'var(--card)',
                          color: on ? 'white' : 'var(--text-2)',
                          border: `1.5px solid ${on ? c.color : 'var(--border)'}`,
                          borderRadius: 99, cursor: 'pointer', fontFamily: 'var(--font)',
                          fontSize: 13, fontWeight: on ? 700 : 500, transition: 'all 0.18s',
                        }}
                      >
                        {on && <Check size={13} />}
                        {c.name}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {([
                    { key: 'grades' as const,      label: t('Cuaderno de notas'), desc: t('Categorías, columnas y calificaciones') },
                    { key: 'rubrics' as const,     label: t('Rúbricas y dianas'), desc: t('Los instrumentos de evaluación') },
                    { key: 'evaluations' as const, label: t('Evaluaciones'),      desc: t('Los resultados ya guardados') },
                  ]).map(row => (
                    <label
                      key={row.key}
                      style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 10, background: 'var(--surface)', cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={scope[row.key]}
                        onChange={e => onScopeChange({ ...scope, [row.key]: e.target.checked })}
                        style={{ cursor: 'pointer', accentColor: 'var(--accent-d)', width: 16, height: 16, flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{row.label}</span>
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)' }}>{row.desc}</span>
                      </span>
                    </label>
                  ))}
                </div>

                <button
                  className="btn-accent"
                  style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}
                  disabled={nothingSelected || busy}
                  onClick={() => { setUiRole('host'); session.startHost(); lan.startHost(); }}
                >
                  <Send size={14} />{t('Crear código y QR')}
                </button>
              </>
            )}
          </div>

          {/* ── Recibir datos ── */}
          <div className="card">
            <div className="card-hd">
              <div className="card-ttl"><Inbox size={16} color="var(--accent-d)" />{t('Recibir datos')}</div>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 14px' }}>
              {t('Escaneas el QR o escribes el código que te han dado y recibes las clases y los datos que comparte el otro docente. No hace falta elegir clase.')}
            </p>

            {role === 'guest' ? (
              scanning ? (
                <QRScanner
                  onDetected={raw => {
                    setScanning(false);
                    const target = parseLanUrl(raw);
                    if (target) { lan.join(target); return; }
                    const c = parseScannedCode(raw);
                    if (c) { setCodeInput(c); session.startJoin(c); }
                  }}
                  onCancel={() => setScanning(false)}
                />
              ) : (
                <div>
                  <label className="flabel" htmlFor="share-f1">{t('Escribe el código que te han dado')}</label>
                  <input
                    id="share-f1"
                    className="finput"
                    value={codeInput}
                    onChange={e => setCodeInput(normalizeCode(e.target.value))}
                    onKeyDown={e => { if (e.key === 'Enter' && isCompleteCode(codeInput)) session.startJoin(codeInput); }}
                    placeholder="ABC123"
                    autoFocus
                    spellCheck={false}
                    style={{
                      textAlign: 'center', fontSize: 30, fontWeight: 800,
                      letterSpacing: '0.16em', padding: '14px 12px',
                      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                      textTransform: 'uppercase',
                    }}
                  />
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 7, textAlign: 'center' }}>
                    {t('6 caracteres. No distingue mayúsculas de minúsculas.')}
                  </p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button
                      className="btn-accent"
                      style={{ flex: 1, justifyContent: 'center' }}
                      disabled={!isCompleteCode(codeInput) || busy || state === 'connecting'}
                      onClick={() => session.startJoin(codeInput)}
                    >
                      {busy || state === 'connecting'
                        ? <><span className="spin" />{t('Conectando…')}</>
                        : <>{t('Conectar')} <ArrowRight size={14} /></>}
                    </button>
                    <button className="btn-ghost" onClick={() => setScanning(true)} title={t('Leer el QR con la cámara')}>
                      <QrCode size={15} />{t('Escanear QR')}
                    </button>
                  </div>
                </div>
              )
            ) : (
              <button
                className="btn-accent"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setUiRole('guest')}
              >
                <QrCode size={14} />{t('Escanear QR o escribir código')}
              </button>
            )}
          </div>

          {role !== null && (
            <button className="btn-ghost" style={{ alignSelf: 'flex-start', fontSize: 12.5 }} onClick={restart}>
              {t('Empezar de nuevo')}
            </button>
          )}

          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 14px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.3)', fontSize: 12.5, color: '#dc2626', lineHeight: 1.5 }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}
        </div>

        {/* Panel lateral explicativo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-hd">
              <div className="card-ttl"><Users2 size={14} color="var(--accent-d)" />{t('Cómo funciona')}</div>
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
              <li>{t('Quien manda elige las clases y lo que comparte, y le sale un código y un QR.')}</li>
              <li>{t('Quien recibe escanea el QR o escribe el código, sin elegir clase.')}</li>
              <li>{t('Los cambios de los dos se ven al momento.')}</li>
            </ol>
          </div>

          <div className="card">
            <div className="card-hd">
              <div className="card-ttl"><ShieldCheck size={14} color="var(--ok)" />{t('Privacidad')}</div>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
              <li>{t('Los datos de tus alumnos viajan')} <strong>{t('directos de un equipo a otro')}</strong>{t(' y cifrados.')}</li>
              <li>{t('El código solo sirve para que los dos ordenadores se encuentren; por ese servicio no pasan los datos.')}</li>
              <li>{t('Nunca se comparte tu perfil ni tu clave de la IA.')}</li>
              <li>{t('Si escaneas el QR, la cámara solo busca el código: no graba ni envía imágenes.')}</li>
              <li>{t('Compartes datos de alumnos: hazlo solo con docentes del centro que deban acceder a ellos.')}</li>
            </ul>
          </div>

          <div className="card" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)' }}>{t('¿No conecta?')}</strong> {t('Hacen falta internet en los dos equipos y que la red del centro no bloquee las conexiones directas. Si no hay manera, usa la copia de seguridad de «Configuración» para pasar los datos.')}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
