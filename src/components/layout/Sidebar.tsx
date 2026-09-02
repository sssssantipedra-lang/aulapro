import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, CalendarDays, ClipboardList,
  Target, History, BookOpen, User, ChevronLeft, ChevronRight, Presentation, Users2, Smartphone,
  UserCheck, FileText, LogOut, Check, ScrollText, Stamp, Smartphone as Phone, BookMarked, Layers,
  GraduationCap, ChevronDown,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useI18n } from '../../i18n';
import type { User as UserType } from '../../types';
import type { Section } from '../../types';

interface NavEntry {
  id: Section;
  label: string;
  icon: React.ReactNode;
}

const NAV: { sect: string; items: NavEntry[] }[] = [
  {
    sect: 'Principal',
    items: [
      { id: 'dashboard', label: 'Inicio',            icon: <LayoutDashboard size={18} /> },
      { id: 'classes',   label: 'Mis Clases',        icon: <Users size={18} /> },
      { id: 'agenda',    label: 'Agenda',            icon: <CalendarDays size={18} /> },
      { id: 'notebook',   label: 'Cuaderno de Notas', icon: <BookOpen size={18} /> },
      { id: 'attendance', label: 'Asistencia',        icon: <UserCheck size={18} /> },
    ],
  },
  {
    sect: 'Evaluación',
    items: [
      { id: 'rubrics',   label: 'Rúbricas',           icon: <ClipboardList size={18} /> },
      { id: 'diana',     label: 'Diana Competencial', icon: <Target size={18} /> },
      { id: 'reports',   label: 'Informes',           icon: <FileText size={18} /> },
      { id: 'records',   label: 'Actas',              icon: <Stamp size={18} /> },
      { id: 'selfassess', label: 'Autoevaluaciones',  icon: <Phone size={18} /> },
      { id: 'history',   label: 'Historial',          icon: <History size={18} /> },
    ],
  },
  {
    sect: 'Recursos',
    items: [
      { id: 'learning-situations', label: 'Situaciones de aprendizaje', icon: <BookMarked size={18} /> },
      { id: 'resources',           label: 'Recursos',                   icon: <Layers size={18} /> },
    ],
  },
  {
    sect: 'Mi actividad docente',
    items: [
      { id: 'meetings',  label: 'Reuniones',   icon: <Users2 size={18} /> },
      { id: 'trainings', label: 'Formaciones', icon: <GraduationCap size={18} /> },
    ],
  },
  {
    sect: 'Herramientas',
    items: [
      { id: 'sec-classroom',  label: 'Aula Live',          icon: <Presentation size={18} /> },
      { id: 'classroom-live', label: 'Sala de alumnos',    icon: <Smartphone size={18} /> },
      { id: 'share',          label: 'Trabajo compartido', icon: <Users2 size={18} /> },
      { id: 'audit',          label: 'Registro de cambios', icon: <ScrollText size={18} /> },
      { id: 'profile',        label: 'Mi Perfil',          icon: <User size={18} /> },
    ],
  },
];

interface Props {
  mini: boolean;
  onToggle: () => void;
  current: Section;
  onNav: (s: Section) => void;
  user: UserType | null;
  /** Hay una sesión compartida activa con otro docente. */
  sharing?: boolean;
  /** Se está escribiendo en disco ahora mismo. */
  saving?: boolean;
  onLogout: () => void;
}

/** Qué grupos ha plegado el docente. Se recuerda entre sesiones. */
const COLLAPSED_KEY = 'aulapro_nav_collapsed';

export function Sidebar({ mini, onToggle, current, onNav, user, sharing, saving, onLogout }: Props) {
  const { t } = useI18n();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '{}'); } catch { return {}; }
  });
  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed));
  }, [collapsed]);

  return (
    <aside className={`sidebar${mini ? ' mini' : ''}`}>
      <div className="sb-logo">
        <div className="sb-logo-box">
          <svg width="18" height="18" fill="white" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <span className="sb-title">Aula Pro</span>
        <button
          className="ico-btn"
          style={{ marginLeft: mini ? 0 : 'auto', color: '#475569' }}
          onClick={onToggle}
          title={mini ? t('Expandir') : t('Colapsar')}
        >
          {mini ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {user && (
        <button className="sb-teacher" onClick={() => onNav('profile')}>
          <Avatar name={user.full_name} size={32} fontSize={12} />
          <div className="sb-teacher-info">
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 148 }}>{user.full_name}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{user.subject || user.school}</div>
          </div>
        </button>
      )}

      <div className="sb-div" />

      <nav className="sb-nav">
        {NAV.map(({ sect, items }) => {
          // Con la barra plegada no se ven las cabeceras, así que plegar un
          // grupo ahí escondería sus entradas sin dejar forma de recuperarlas.
          const isCollapsed = !mini && !!collapsed[sect];
          const holdsCurrent = items.some(i => i.id === current);

          return (
            <div key={sect}>
              <button
                className={`sb-sect-btn${isCollapsed && holdsCurrent ? ' has-current' : ''}`}
                onClick={() => setCollapsed(c => ({ ...c, [sect]: !c[sect] }))}
                aria-expanded={!isCollapsed}
                title={t(isCollapsed ? 'Desplegar' : 'Plegar')}
                type="button"
              >
                <span className="sb-sect">{t(sect)}</span>
                <ChevronDown className="sb-sect-chev" size={12} style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none' }} />
              </button>

              {!isCollapsed && items.map(item => (
                <button
                  key={item.id}
                  className={`nav-item${current === item.id ? ' active' : ''}`}
                  onClick={() => onNav(item.id)}
                >
                  <span className="ni-icon">{item.icon}</span>
                  <span className="ni-label">{t(item.label)}</span>
                  {item.id === 'share' && sharing && (
                    <span className="ni-live" title="Sesión compartida activa" />
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="sb-div" />

      {/* Estado de guardado y cerrar sesión */}
      <div style={{ padding: '2px 8px 10px' }}>
        <div
          className="ni-label"
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px 8px',
            fontSize: 11, color: saving ? '#94a3b8' : '#475569',
          }}
        >
          {saving
            ? <><span className="spin" style={{ width: 10, height: 10, borderWidth: 1.5 }} />{t('Guardando…')}</>
            : <><Check size={11} />{t('Todo guardado')}</>}
        </div>
        <button className="nav-item" style={{ color: '#64748b', width: '100%' }} onClick={onLogout}>
          <span className="ni-icon"><LogOut size={18} /></span>
          <span className="ni-label">{t('Cerrar sesión')}</span>
        </button>

        {/* Sobre qué currículo está construida la aplicación. Importa para
            quien la use fuera de España, o en otra etapa educativa. */}
        {!mini && (
          <p style={{
            fontSize: 10.5, lineHeight: 1.45, color: 'rgba(255,255,255,0.38)',
            margin: '10px 4px 0', textAlign: 'center',
          }}>
            {t('Diseñada sobre el currículo educativo español (LOMLOE)')}
          </p>
        )}

        {/* Versión instalada — útil sobre todo para saber si hace falta
            actualizar a mano (Mac, o si la auto-actualización aún no llegó). */}
        {!mini && (
          <p style={{
            fontSize: 10, color: 'rgba(255,255,255,0.28)',
            margin: '4px 4px 0', textAlign: 'center',
          }}>
            Aula Pro v{__APP_VERSION__}
          </p>
        )}
      </div>
    </aside>
  );
}
