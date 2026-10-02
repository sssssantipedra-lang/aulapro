import { useEffect, useRef, useState } from 'react';
import { Pencil, Palette, Database, Download, Upload, Languages, UserCircle, Lock, ShieldCheck, ShieldOff, Monitor, Sun, Moon, Sparkles, ArrowLeft, ChevronRight, KeyRound } from 'lucide-react';
import { getApiKey } from '../services/gemini';
import { takeSettingsPanel, type SettingsPanel } from '../lib/settingsNav';
import { Avatar } from '../components/ui/Avatar';
import { Flag } from '../components/ui/Flag';
import { ApiKeySettings } from '../components/ApiKeySettings';
import { DataFolder } from '../components/DataFolder';
import { LicenseSettings } from '../components/LicenseSettings';
import { getLicenseState } from '../services/license';
import type { LicenseState } from '../types/electron';
import { THEMES, applyTheme, isoDate, applyAppearance, getAppearance, type ThemeKey, type Appearance } from '../lib/utils';
import type { User } from '../types';
import type { TeacherProfile } from '../services/storage';
import { createPasswordFields, verifyPassword } from '../lib/password';
import { useToast } from '../components/ui/Toast';
import { useI18n, LANGS } from '../i18n';
import { downloadFile } from '../lib/download';
import { CommunitySelect } from '../components/CommunitySelect';
import { nombreComunidad, type ComunidadId } from '../lib/curriculum/comunidades';

interface Props {
  user: User | null;
  profile: TeacherProfile | null;
  profileId: string | null;
  course: string;
  onUpdateUser: (u: { full_name?: string; school?: string; subject?: string; course?: string; community?: ComunidadId }) => void;
  onUpdateSecurity: (patch: { passwordHash?: string; passwordSalt?: string }) => void;
  onExportData: () => Record<string, unknown>;
  onImportData: (raw: string) => string | null;
  onClearSchoolYear: () => Promise<void>;
}

export function Profile({ user, profile, profileId, course, onUpdateUser, onUpdateSecurity, onExportData, onImportData, onClearSchoolYear }: Props) {
  const { toast } = useToast();
  const { lang, setLang, t } = useI18n();
  const [nombre, setNombre] = useState(user?.full_name.split(' ')[0] ?? '');
  const [apell,  setApell]  = useState(user?.full_name.split(' ').slice(1).join(' ') ?? '');
  const [centro, setCentro] = useState(user?.school ?? '');
  const [espec,  setEspec]  = useState(user?.subject ?? '');
  const [curso,  setCurso]  = useState(course ?? '');
  const [comunidad, setComunidad] = useState<ComunidadId | ''>(user?.community ?? '');
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>(
    (localStorage.getItem('aulapro_theme') as ThemeKey) ?? 'sky'
  );
  const [appearance, setAppearance] = useState<Appearance>(getAppearance);
  const importRef = useRef<HTMLInputElement>(null);
  /** Apartado abierto; sin ninguno se ve la cuadrícula de tarjetas. */
  const [panel, setPanel] = useState<SettingsPanel | null>(() => takeSettingsPanel());
  const open = (p: SettingsPanel | null) => { setPanel(p); window.scrollTo?.({ top: 0 }); };

  /** Licencia de este equipo (solo en escritorio). */
  const [license, setLicense] = useState<LicenseState | null>(null);
  useEffect(() => { getLicenseState().then(setLicense); }, []);

  /* ── Contraseña del perfil ── */
  const hasPassword = !!profile?.passwordHash;
  const [secMode, setSecMode] = useState<'view' | 'set' | 'change' | 'remove'>('view');
  const [secCurrent, setSecCurrent] = useState('');
  const [secNew, setSecNew] = useState('');
  const [secRepeat, setSecRepeat] = useState('');
  const [secError, setSecError] = useState('');
  const [secBusy, setSecBusy] = useState(false);

  function resetSecForm() {
    setSecMode('view');
    setSecCurrent(''); setSecNew(''); setSecRepeat(''); setSecError('');
  }

  /** La contraseña actual solo se pide si ya había una que proteger. */
  async function currentPasswordOk(): Promise<boolean> {
    if (!hasPassword) return true;
    if (!profile?.passwordSalt || !profile.passwordHash) return true;
    return verifyPassword(secCurrent, profile.passwordSalt, profile.passwordHash);
  }

  async function submitSetOrChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!(await currentPasswordOk())) { setSecError(t('La contraseña actual no es correcta.')); return; }
    if (secNew.length < 4) { setSecError(t('La contraseña debe tener al menos 4 caracteres.')); return; }
    if (secNew !== secRepeat) { setSecError(t('Las dos contraseñas no coinciden.')); return; }
    setSecBusy(true);
    const fields = await createPasswordFields(secNew);
    onUpdateSecurity(fields);
    setSecBusy(false);
    resetSecForm();
    toast(t(hasPassword ? 'Contraseña cambiada' : 'Contraseña fijada'));
  }

  async function submitRemovePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!(await currentPasswordOk())) { setSecError(t('La contraseña actual no es correcta.')); return; }
    setSecBusy(true);
    onUpdateSecurity({ passwordHash: undefined, passwordSalt: undefined });
    setSecBusy(false);
    resetSecForm();
    toast(t('Contraseña quitada'));
  }

  function saveProfile() {
    if (!nombre.trim()) { toast('El nombre no puede quedar vacío'); return; }
    onUpdateUser({
      full_name: `${nombre} ${apell}`.trim(), school: centro, subject: espec, course: curso,
      ...(comunidad ? { community: comunidad } : {}),
    });
    // Quien ya tenía comunidad y la cambia: las SdA que guardó siguen citando
    // el decreto con el que se hicieron, no se reescriben.
    const cambio = !!comunidad && !!user?.community && comunidad !== user.community;
    toast(cambio
      ? t('✅ Perfil actualizado. Las situaciones de aprendizaje que ya guardaste conservan su decreto.')
      : '✅ Perfil actualizado');
  }

  function handleAppearance(mode: Appearance) {
    applyAppearance(mode);
    setAppearance(mode);
  }

  function handleTheme(key: ThemeKey) {
    applyTheme(key);
    setCurrentTheme(key);
  }

  function handleExport() {
    const data = onExportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    void downloadFile(blob, `aulapro-copia-${isoDate()}.json`);
    toast('✅ Copia de seguridad descargada');
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const raw = await file.text();
    const err = onImportData(raw);
    toast(err ?? '✅ Datos cargados');
  }

  const themeLabel = THEMES[currentTheme]?.label ?? '';
  const appearanceLabel = appearance === 'auto' ? 'Automática' : appearance === 'light' ? 'Clara' : 'Oscura';
  const TILES: { id: SettingsPanel; icon: React.ReactNode; title: string; desc: string; status: string; ok?: boolean }[] = [
    { id: 'perfil', icon: <UserCircle size={22} />, title: 'Perfil', desc: 'Tu nombre, centro, especialidad y curso escolar.', status: [user?.full_name, user?.school].filter(Boolean).join(' · ') },
    { id: 'ia', icon: <Sparkles size={22} />, title: 'Clave de la IA', desc: 'La clave gratuita de Google y cuánto da de sí.', status: t(getApiKey() ? 'Configurada ✓' : 'Sin configurar'), ok: !!getApiKey() },
    { id: 'idioma', icon: <Languages size={22} />, title: 'Idioma', desc: 'Castellano, catalán o inglés internacional.', status: LANGS.find(l => l.id === lang)?.label ?? '' },
    { id: 'apariencia', icon: <Palette size={22} />, title: 'Apariencia', desc: 'Color de la aplicación y modo claro u oscuro.', status: `${t(themeLabel)} · ${t(appearanceLabel)}` },
    { id: 'seguridad', icon: <Lock size={22} />, title: 'Seguridad', desc: 'Contraseña para abrir tu perfil.', status: t(hasPassword ? 'Con contraseña' : 'Sin contraseña'), ok: hasPassword },
    { id: 'datos', icon: <Database size={22} />, title: 'Datos y copias', desc: 'Copias de seguridad, llevar a otro equipo y fin de curso.', status: t('En este equipo') },
    ...(license ? [{
      id: 'licencia' as const, icon: <KeyRound size={22} />, title: 'Licencia', desc: 'Tu licencia de Aula Pro en este ordenador.',
      status: t(license.status === 'fundador' ? 'Docente fundador/a' : license.status === 'activa' ? 'Licencia activa' : 'Sin activar'),
      ok: license.status === 'fundador' || license.status === 'activa',
    }] : []),
  ];
  const current = TILES.find(x => x.id === panel);

  return (
    <section className="sec active">
      <div className="pg-hd">
        {current ? (
          <div className="st-hd">
            <button type="button" className="btn-ghost sm" onClick={() => open(null)}><ArrowLeft size={14} />{t('Configuración')}</button>
            <h1 className="pg-title"><span className="st-hd-ico">{current.icon}</span>{t(current.title)}</h1>
          </div>
        ) : (
          <div>
            <h1 className="pg-title">{t('Configuración')}</h1>
            <p className="pg-sub">{t('Elige qué quieres cambiar')}</p>
          </div>
        )}
      </div>

      {!current && (
        <div className="st-grid">
          {TILES.map(tile => (
            <button key={tile.id} type="button" className="st-tile" onClick={() => open(tile.id)}>
              <span className="st-ico">{tile.icon}</span>
              <span className="st-body">
                <span className="st-ttl">{t(tile.title)}</span>
                <span className="st-desc">{t(tile.desc)}</span>
                {tile.status && <span className={`st-status${tile.ok ? ' ok' : ''}`}>{tile.status}</span>}
              </span>
              <ChevronRight size={18} className="st-chev" />
            </button>
          ))}
        </div>
      )}

      {/* ── Perfil ── */}
      {panel === 'perfil' && (
      <div className="profile-grid">
        {/* Tarjeta de avatar */}
        <div className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
          {user && <Avatar name={user.full_name} size={72} fontSize={26} style={{ margin: '0 auto 14px' } as React.CSSProperties} />}
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{user?.full_name}</div>
          {user?.subject && <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 3 }}>{user.subject}</div>}
          {user?.school && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{user.school}</div>}
          {user?.community && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{nombreComunidad(user.community, lang)}</div>}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
            {course && <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>{t('Curso')} {course}</div>}
            <div style={{ fontSize: 11.5, color: 'var(--ok)', fontWeight: 700 }}>{t('Perfil local · datos en este equipo')}</div>
          </div>
        </div>

        {/* Editar datos */}
        <div className="card">
          <div className="card-hd">
            <div className="card-ttl"><Pencil size={14} color="var(--accent-d)" />{t('Editar datos')}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="fgroup"><label className="flabel" htmlFor="profile-f1">{t('Nombre')}</label><input id="profile-f1" className="finput" value={nombre} onChange={e => setNombre(e.target.value)} /></div>
            <div className="fgroup"><label className="flabel" htmlFor="profile-f2">{t('Apellidos')}</label><input id="profile-f2" className="finput" value={apell} onChange={e => setApell(e.target.value)} /></div>
            <div className="fgroup"><label className="flabel" htmlFor="profile-f3">{t('Centro educativo')}</label><input id="profile-f3" className="finput" value={centro} onChange={e => setCentro(e.target.value)} placeholder={t('Ej: IES Ejemplo')} /></div>
            <div className="fgroup"><label className="flabel" htmlFor="profile-f4">{t('Especialidad')}</label><input id="profile-f4" className="finput" value={espec} onChange={e => setEspec(e.target.value)} placeholder={t('Ej: Matemáticas')} /></div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}><label className="flabel" htmlFor="profile-f5">{t('Curso escolar')}</label><input id="profile-f5" className="finput" value={curso} onChange={e => setCurso(e.target.value)} placeholder="2025-2026" /></div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="profile-f6">{t('Comunidad autónoma')}</label>
              <CommunitySelect id="profile-f6" value={comunidad} onChange={setComunidad} />
            </div>
          </div>
          <div style={{ marginTop: 4, paddingTop: 14, borderTop: '0.5px solid var(--border)' }}>
            <button className="btn-accent" onClick={saveProfile}>{t('Guardar cambios')}</button>
          </div>
        </div>
      </div>
      )}

      {/* ── Idioma ── */}
      {panel === 'idioma' && (
        <div className="card st-panel">
          <div className="card-hd">
            <div className="card-ttl"><Languages size={14} color="var(--accent-d)" />{t('Idioma · Language')}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {LANGS.map(l => {
              const on = l.id === lang;
              return (
                <button
                  key={l.id}
                  onClick={() => setLang(l.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '9px 16px',
                    borderRadius: 11, cursor: 'pointer', fontFamily: 'var(--font)',
                    fontSize: 13.5, fontWeight: on ? 800 : 500,
                    background: on ? 'var(--accent-l)' : 'transparent',
                    border: `1.5px solid ${on ? 'var(--accent-d)' : 'var(--border)'}`,
                    color: on ? 'var(--accent-d)' : 'var(--text-2)',
                  }}
                >
                  <Flag lang={l.id} size={20} />{l.label}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10, lineHeight: 1.5 }}>
            {t('En inglés se usa terminología internacional (Units of Inquiry, Learning Outcomes, Formative Assessment), no una traducción literal. Los datos que tú escribes no se traducen.')}
          </p>
        </div>
      )}

      {/* ── Apariencia ── */}
      {panel === 'apariencia' && (
        <div className="card st-panel">
          <div className="card-hd">
            <div className="card-ttl"><Palette size={14} color="var(--accent-d)" />{t('Color de la interfaz')}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', gap: 10 }}>
            {(Object.entries(THEMES) as [ThemeKey, typeof THEMES[ThemeKey]][]).map(([key, th]) => {
              const active = currentTheme === key;
              return (
                <button
                  key={key}
                  onClick={() => handleTheme(key)}
                  title={th.label}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                    padding: '10px 6px 8px', background: active ? 'var(--surface)' : 'transparent',
                    border: `1.5px solid ${active ? th.accentD : 'var(--border)'}`,
                    borderRadius: 13, cursor: 'pointer', fontFamily: 'var(--font)',
                    transition: 'all 0.18s',
                    boxShadow: active ? `0 3px 12px rgba(${th.accentRgb},0.28)` : 'none',
                  }}
                >
                  <span style={{
                    position: 'relative', width: 34, height: 34, borderRadius: '50%',
                    background: `linear-gradient(135deg,${th.accent},${th.accentD})`,
                    boxShadow: `0 2px 8px rgba(${th.accentRgb},0.45), inset 0 0 0 2px rgba(255,255,255,0.35)`,
                  }}>
                    {active && (
                      <span style={{
                        position: 'absolute', inset: -4, borderRadius: '50%',
                        border: `2px solid ${th.accentD}`,
                      }} />
                    )}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: active ? 800 : 600, color: active ? th.accentD : 'var(--text-2)', textAlign: 'center', lineHeight: 1.2 }}>
                    {t(th.label)}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="flabel" id="appearance-label">{t('Apariencia')}</div>
            <div role="radiogroup" aria-labelledby="appearance-label" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([
                { id: 'auto', label: t('Automática'), icon: <Monitor size={14} aria-hidden="true" /> },
                { id: 'light', label: t('Clara'), icon: <Sun size={14} aria-hidden="true" /> },
                { id: 'dark', label: t('Oscura'), icon: <Moon size={14} aria-hidden="true" /> },
              ] as const).map(opt => {
                const on = appearance === opt.id;
                return (
                  <button
                    key={opt.id} type="button" role="radio" aria-checked={on}
                    onClick={() => handleAppearance(opt.id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                      borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13,
                      fontWeight: on ? 700 : 600,
                      background: on ? 'var(--accent-l)' : 'var(--card)',
                      color: on ? 'var(--accent-d)' : 'var(--text-2)',
                      border: `1.5px solid ${on ? 'var(--accent-d)' : 'var(--border)'}`,
                    }}
                  >
                    {opt.icon}{opt.label}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8 }}>
              {t('«Automática» sigue el modo claro u oscuro de tu sistema.')}
            </p>
          </div>
        </div>
      )}

      {/* ── Seguridad ── */}
      {panel === 'seguridad' && (
      <div className="card st-panel">
        <div className="card-hd">
          <div className="card-ttl">
            {hasPassword
              ? <><ShieldCheck size={14} color="var(--ok)" />{t('Perfil protegido con contraseña')}</>
              : <><ShieldOff size={14} color="var(--text-3)" />{t('Sin contraseña')}</>}
          </div>
        </div>

        {secMode === 'view' && (
          <>
            <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14 }}>
              {hasPassword
                ? t('Se pedirá al elegir este perfil desde la pantalla de inicio. Es una cortina para que quien comparta el equipo no vea tus datos de un vistazo: no cifra el archivo en disco.')
                : t('Opcional. Útil si compartes el ordenador con otros docentes: sin ella, cualquiera que abra la app puede elegir este perfil.')}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {hasPassword ? (
                <>
                  <button className="btn-ghost" onClick={() => setSecMode('change')}>{t('Cambiar contraseña')}</button>
                  <button className="btn-ghost" style={{ color: 'var(--danger)', borderColor: '#fca5a5' }} onClick={() => setSecMode('remove')}>{t('Quitar contraseña')}</button>
                </>
              ) : (
                <button className="btn-accent" onClick={() => setSecMode('set')}><Lock size={14} />{t('Fijar contraseña')}</button>
              )}
            </div>
          </>
        )}

        {(secMode === 'set' || secMode === 'change') && (
          <form onSubmit={submitSetOrChangePassword} style={{ maxWidth: 360 }}>
            {hasPassword && (
              <div className="fgroup">
                <label className="flabel" htmlFor="profile-f6">{t('Contraseña actual')}</label>
                <input id="profile-f6" className="finput" type="password" autoFocus value={secCurrent}
                  onChange={e => { setSecCurrent(e.target.value); if (secError) setSecError(''); }} />
              </div>
            )}
            <div className="fgroup">
              <label className="flabel" htmlFor="profile-f7">{t('Contraseña nueva')}</label>
              <input id="profile-f7" className="finput" type="password" autoFocus={!hasPassword} value={secNew}
                onChange={e => { setSecNew(e.target.value); if (secError) setSecError(''); }} />
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="profile-f8">{t('Repite la contraseña')}</label>
              <input id="profile-f8" className="finput" type="password" value={secRepeat}
                onChange={e => { setSecRepeat(e.target.value); if (secError) setSecError(''); }} />
            </div>
            {secError && <div style={{ fontSize: 12.5, color: '#ef4444', marginBottom: 12 }}>{secError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-accent" type="submit" disabled={secBusy}>
                {secBusy ? <><span className="spin" />&nbsp;{t('Guardando…')}</> : t(hasPassword ? 'Cambiar contraseña' : 'Fijar contraseña')}
              </button>
              <button className="btn-ghost" type="button" onClick={resetSecForm}>{t('Cancelar')}</button>
            </div>
          </form>
        )}

        {secMode === 'remove' && (
          <form onSubmit={submitRemovePassword} style={{ maxWidth: 360 }}>
            <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 12 }}>
              {t('A partir de ahora cualquiera podrá elegir este perfil desde la pantalla de inicio sin que se le pida nada.')}
            </p>
            <div className="fgroup">
              <label className="flabel" htmlFor="profile-f9">{t('Contraseña actual')}</label>
              <input id="profile-f9" className="finput" type="password" autoFocus value={secCurrent}
                onChange={e => { setSecCurrent(e.target.value); if (secError) setSecError(''); }} />
            </div>
            {secError && <div style={{ fontSize: 12.5, color: '#ef4444', marginBottom: 12 }}>{secError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" type="submit" style={{ color: 'var(--danger)', borderColor: '#fca5a5' }} disabled={secBusy}>
                {secBusy ? <><span className="spin" />&nbsp;{t('Quitando…')}</> : t('Sí, quitar la contraseña')}
              </button>
              <button className="btn-ghost" type="button" onClick={resetSecForm}>{t('Cancelar')}</button>
            </div>
          </form>
        )}
      </div>
      )}

      {/* ── Clave de la IA ── */}
      {panel === 'ia' && <ApiKeySettings />}

      {/* ── Licencia ── */}
      {panel === 'licencia' && license && <LicenseSettings state={license} onChange={setLicense} />}

      {/* ── Datos y copias ── */}
      {panel === 'datos' && (<>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-hd">
          <div className="card-ttl"><Database size={14} color="var(--accent-d)" />{t('Llevar a otro equipo')}</div>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14 }}>
          {t('Descarga un archivo con todo tu trabajo para pasarlo a otro ordenador o guardarlo aparte.')}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn-accent" onClick={handleExport}>
            <Download size={14} />{t('Descargar mis datos')}
          </button>
          <button className="btn-ghost" onClick={() => importRef.current?.click()}>
            <Upload size={14} />{t('Cargar desde archivo')}
          </button>
          <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportFile} />
        </div>
      </div>

      {/* Carpeta de datos, copias y fin de curso */}
      <DataFolder profileId={profileId} courseLabel={course} onClearSchoolYear={onClearSchoolYear} />
      </>)}
    </section>
  );
}
