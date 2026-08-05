import { useRef, useState } from 'react';
import { Pencil, Palette, Database, Download, Upload } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { ApiKeySettings } from '../components/ApiKeySettings';
import { DataFolder } from '../components/DataFolder';
import { THEMES, applyTheme, isoDate, type ThemeKey } from '../lib/utils';
import type { User } from '../types';
import { useToast } from '../components/ui/Toast';

interface Props {
  user: User | null;
  profileId: string | null;
  course: string;
  onUpdateUser: (u: { full_name?: string; school?: string; subject?: string; course?: string }) => void;
  onExportData: () => Record<string, unknown>;
  onImportData: (raw: string) => string | null;
  onClearSchoolYear: () => Promise<void>;
}

export function Profile({ user, profileId, course, onUpdateUser, onExportData, onImportData, onClearSchoolYear }: Props) {
  const { toast } = useToast();
  const [nombre, setNombre] = useState(user?.full_name.split(' ')[0] ?? '');
  const [apell,  setApell]  = useState(user?.full_name.split(' ').slice(1).join(' ') ?? '');
  const [centro, setCentro] = useState(user?.school ?? '');
  const [espec,  setEspec]  = useState(user?.subject ?? '');
  const [curso,  setCurso]  = useState(course ?? '');
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>(
    (localStorage.getItem('aulapro_theme') as ThemeKey) ?? 'sky'
  );
  const importRef = useRef<HTMLInputElement>(null);

  function saveProfile() {
    if (!nombre.trim()) { toast('El nombre no puede quedar vacío'); return; }
    onUpdateUser({ full_name: `${nombre} ${apell}`.trim(), school: centro, subject: espec, course: curso });
    toast('✅ Perfil actualizado');
  }

  function handleTheme(key: ThemeKey) {
    applyTheme(key);
    setCurrentTheme(key);
  }

  function handleExport() {
    const data = onExportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aulapro-copia-${isoDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">Mi Perfil</h1>
          <p className="pg-sub">Datos personales, IA y copia de seguridad</p>
        </div>
      </div>

      <div className="profile-grid">
        {/* Tarjeta de avatar */}
        <div className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
          {user && <Avatar name={user.full_name} size={72} fontSize={26} style={{ margin: '0 auto 14px' } as React.CSSProperties} />}
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{user?.full_name}</div>
          {user?.subject && <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 3 }}>{user.subject}</div>}
          {user?.school && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{user.school}</div>}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
            {course && <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>Curso {course}</div>}
            <div style={{ fontSize: 11.5, color: 'var(--ok)', fontWeight: 700 }}>Perfil local · datos en este equipo</div>
          </div>
        </div>

        {/* Selector de tema */}
        <div className="card">
          <div className="card-hd">
            <div className="card-ttl"><Palette size={14} color="var(--accent-d)" />Color de la interfaz</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {(Object.entries(THEMES) as [ThemeKey, typeof THEMES[ThemeKey]][]).map(([key, t]) => {
              const active = currentTheme === key;
              return (
                <button
                  key={key}
                  onClick={() => handleTheme(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '9px 16px',
                    background: 'white', border: `1.5px solid ${active ? t.accentD : 'var(--border)'}`,
                    borderRadius: 99, cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13,
                    fontWeight: 600, color: 'var(--text)', transition: 'all 0.18s',
                    boxShadow: active ? `0 2px 10px rgba(${t.accentRgb},0.25)` : 'none',
                  }}
                >
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: `linear-gradient(135deg,${t.accent},${t.accentD})`, flexShrink: 0 }} />
                  {t.label}
                  {active && <span style={{ marginLeft: 4, color: t.accentD }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Editar datos */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-hd">
            <div className="card-ttl"><Pencil size={14} color="var(--accent-d)" />Editar datos</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="fgroup"><label className="flabel">Nombre</label><input className="finput" value={nombre} onChange={e => setNombre(e.target.value)} /></div>
            <div className="fgroup"><label className="flabel">Apellidos</label><input className="finput" value={apell} onChange={e => setApell(e.target.value)} /></div>
            <div className="fgroup"><label className="flabel">Centro educativo</label><input className="finput" value={centro} onChange={e => setCentro(e.target.value)} placeholder="IES Ejemplo" /></div>
            <div className="fgroup"><label className="flabel">Especialidad</label><input className="finput" value={espec} onChange={e => setEspec(e.target.value)} placeholder="Matemáticas" /></div>
            <div className="fgroup"><label className="flabel">Curso escolar</label><input className="finput" value={curso} onChange={e => setCurso(e.target.value)} placeholder="2025-2026" /></div>
          </div>
          <div style={{ marginTop: 4, paddingTop: 14, borderTop: '0.5px solid var(--border)' }}>
            <button className="btn-accent" onClick={saveProfile}>Guardar cambios</button>
          </div>
        </div>

        {/* Asistente IA */}
        <ApiKeySettings />

        {/* Archivo para llevar a otro equipo */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-hd">
            <div className="card-ttl"><Database size={14} color="var(--accent-d)" />Llevar a otro equipo</div>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14 }}>
            Descarga un archivo con todo tu trabajo para pasarlo a otro ordenador o guardarlo aparte.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn-accent" onClick={handleExport}>
              <Download size={14} />Descargar mis datos
            </button>
            <button className="btn-ghost" onClick={() => importRef.current?.click()}>
              <Upload size={14} />Cargar desde archivo
            </button>
            <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportFile} />
          </div>
        </div>

        {/* Carpeta de datos, copias y fin de curso */}
        <DataFolder profileId={profileId} courseLabel={course} onClearSchoolYear={onClearSchoolYear} />
      </div>
    </section>
  );
}
