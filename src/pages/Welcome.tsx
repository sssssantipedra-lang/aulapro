import { useEffect, useState } from 'react';
import { Sparkles, Plus, ArrowRight, Trash2, HardDrive } from 'lucide-react';
import { listProfiles, deleteProfile, isDesktop, type TeacherProfile } from '../services/storage';
import { initials } from '../lib/utils';

interface Props {
  onOpenProfile: (id: string) => void;
  onCreateProfile: (
    input: { name: string; school: string; subject: string; course: string },
    options?: { importLegacy?: boolean },
  ) => Promise<unknown>;
  onExploreDemo: (input: { name: string; school: string; subject: string; course: string }) => void;
}

/** Curso escolar actual: de septiembre a agosto. */
function currentCourse(): string {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/** ¿Hay trabajo de una versión anterior sin perfiles? */
function hasLegacyData(): boolean {
  try {
    const raw = localStorage.getItem('aulapro_classes');
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) && list.length > 0;
  } catch {
    return false;
  }
}

export function Welcome({ onOpenProfile, onCreateProfile, onExploreDemo }: Props) {
  const [profiles, setProfiles] = useState<TeacherProfile[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName]       = useState('');
  const [school, setSchool]   = useState('');
  const [subject, setSubject] = useState('');
  const [course, setCourse]   = useState(currentCourse());
  const [error, setError]     = useState('');
  const [importLegacy, setImportLegacy] = useState(true);

  const legacy = hasLegacyData();

  const refresh = () => listProfiles().then(list => {
    setProfiles(list);
    // Sin perfiles todavía: se va directo a crear el primero
    if (list.length === 0) setCreating(true);
  });

  useEffect(() => { refresh(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Escribe tu nombre para empezar.'); return; }
    setBusy(true);
    await onCreateProfile(
      { name: name.trim(), school: school.trim(), subject: subject.trim(), course: course.trim() },
      { importLegacy: legacy && importLegacy && profiles?.length === 0 },
    );
    setBusy(false);
  }

  const shell = (children: React.ReactNode) => (
    <div
      style={{
        background: 'var(--sb-bg)', minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
        padding: 24, position: 'relative', overflow: 'hidden',
      }}
    >
      <div className="auth-orb" style={{ width: 500, height: 500, background: 'rgba(var(--accent-rgb),0.07)', top: -120, right: -80 }} />
      <div className="auth-orb" style={{ width: 300, height: 300, background: 'rgba(var(--accent-rgb),0.05)', bottom: -60, left: -40 }} />
      <div className="auth-card">{children}</div>
      {/* Sobre qué currículo está construida: importa saberlo antes de
          empezar a usarla, sobre todo fuera de España. */}
      <p style={{
        fontSize: 11.5, color: 'rgba(255,255,255,0.4)', marginTop: 18,
        textAlign: 'center', lineHeight: 1.5, maxWidth: 380,
      }}>
        Diseñada sobre el currículo educativo español (LOMLOE): competencias
        clave, criterios de evaluación y niveles de logro.
      </p>
    </div>
  );

  const header = (title: string, sub: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
      <div style={{ width: 46, height: 46, background: 'linear-gradient(135deg,var(--accent-d),var(--accent))', borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(var(--accent-rgb),0.4)', flexShrink: 0 }}>
        <svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 19, color: 'var(--text)', letterSpacing: -0.4 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{sub}</div>
      </div>
    </div>
  );

  if (profiles === null) {
    return shell(
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: '30px 0', color: 'var(--text-2)', fontSize: 14 }}>
        <span className="spin" />Cargando perfiles…
      </div>
    );
  }

  /* ── Crear perfil ── */
  if (creating) {
    return shell(
      <>
        {header(profiles.length === 0 ? 'Bienvenido/a a Aula Pro' : 'Nuevo perfil', 'Tu cuaderno docente, en tu ordenador')}

        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20 }}>
          {isDesktop()
            ? 'Cada perfil guarda su propio trabajo en una carpeta separada de este equipo. Sin cuentas ni contraseñas.'
            : 'Los datos se guardan en este navegador. Sin cuentas ni contraseñas.'}
        </p>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="fgroup">
            <label className="flabel">Tu nombre *</label>
            <input className="finput" value={name} autoFocus placeholder="Ana García Ruiz"
              onChange={e => { setName(e.target.value); if (error) setError(''); }} />
          </div>
          <div className="frow fgroup">
            <div>
              <label className="flabel">Centro educativo</label>
              <input className="finput" value={school} placeholder="IES Ejemplo" onChange={e => setSchool(e.target.value)} />
            </div>
            <div>
              <label className="flabel">Especialidad</label>
              <input className="finput" value={subject} placeholder="Matemáticas" onChange={e => setSubject(e.target.value)} />
            </div>
          </div>
          <div className="fgroup">
            <label className="flabel">Curso escolar</label>
            <input className="finput" value={course} placeholder="2025-2026" onChange={e => setCourse(e.target.value)} />
          </div>

          {legacy && profiles.length === 0 && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 10, background: 'var(--surface)', cursor: 'pointer', marginBottom: 16 }}>
              <input type="checkbox" checked={importLegacy} onChange={e => setImportLegacy(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: 'var(--accent-d)', width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--text)' }}>Traer mis datos anteriores.</strong> Hemos
                encontrado trabajo guardado por una versión anterior. Se copiará a este perfil.
              </span>
            </label>
          )}

          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? <><span className="spin" />&nbsp;Creando…</> : 'Empezar a usar Aula Pro'}
          </button>
        </form>

        {profiles.length === 0 ? (
          <button
            type="button"
            onClick={() => onExploreDemo({ name: 'Ana García Ruiz', school: 'IES Ejemplo', subject: 'Matemáticas', course: currentCourse() })}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              width: '100%', marginTop: 14, padding: '11px 0', background: 'none',
              border: '1px dashed var(--border)', borderRadius: 10, cursor: 'pointer',
              fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, color: 'var(--text-2)',
            }}
          >
            <Sparkles size={14} color="var(--accent-d)" />Explorar con datos de ejemplo
          </button>
        ) : (
          <button className="btn-ghost" style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}
            onClick={() => setCreating(false)}>
            Volver a la lista
          </button>
        )}
      </>
    );
  }

  /* ── Elegir perfil ── */
  return shell(
    <>
      {header('¿Quién va a trabajar?', 'Elige tu perfil para continuar')}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 16 }}>
        {profiles.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => onOpenProfile(p.id)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px',
                background: 'white', border: '1.5px solid var(--border)', borderRadius: 12,
                cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left', minWidth: 0,
                transition: 'border-color 0.18s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-d)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <span style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg,var(--accent-d),var(--accent))',
                color: 'white', fontSize: 13.5, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {initials(p.name)}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[p.subject, p.school, p.course].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
                </span>
              </span>
              <ArrowRight size={16} color="var(--text-3)" />
            </button>
            <button
              className="ico-btn"
              title="Eliminar este perfil"
              onClick={() => setConfirmDelete(p.id)}
              style={{ flexShrink: 0 }}
            >
              <Trash2 size={15} color="var(--danger)" />
            </button>
          </div>
        ))}
      </div>

      {confirmDelete && (
        <div style={{ background: 'rgba(239,68,68,0.07)', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '13px 15px', marginBottom: 16 }}>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 12 }}>
            Se borrará <strong>toda la carpeta</strong> de{' '}
            <strong>{profiles.find(p => p.id === confirmDelete)?.name}</strong>: clases, notas,
            evaluaciones y copias de seguridad. No se puede deshacer.
          </p>
          <div style={{ display: 'flex', gap: 9 }}>
            <button
              className="btn-ghost"
              style={{ color: 'white', background: 'var(--danger)', border: 'none', fontSize: 12.5 }}
              onClick={async () => { await deleteProfile(confirmDelete); setConfirmDelete(null); refresh(); }}
            >
              Sí, borrar el perfil
            </button>
            <button className="btn-ghost" style={{ fontSize: 12.5 }} onClick={() => setConfirmDelete(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <button className="btn-primary" onClick={() => { setCreating(true); setName(''); setSchool(''); setSubject(''); setError(''); }}>
        <Plus size={16} style={{ display: 'inline', verticalAlign: -3, marginRight: 6 }} />
        Añadir otro perfil
      </button>

      {isDesktop() && (
        <p style={{ fontSize: 11.5, color: 'var(--text-3)', textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
          <HardDrive size={12} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
          Cada perfil guarda sus datos en su propia carpeta de este equipo.
        </p>
      )}
    </>
  );
}
