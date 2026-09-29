import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, CalendarDays, ClipboardCheck, BookOpen, User, ChevronLeft, ChevronRight,
  Presentation, Users2, UserCheck, FileText, LogOut, Check, ScrollText, GraduationCap, ChevronDown, Share2,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useI18n } from '../../i18n';
import type { User as UserType } from '../../types';
import type { Section } from '../../types';
import { NAV_GROUPS, isCurrent, hubTarget, type NavIcon } from '../../lib/navigation';

const ICONS: Record<NavIcon, React.ReactNode> = {
  home: <LayoutDashboard size={18} />,
  classes: <Users size={18} />,
  agenda: <CalendarDays size={18} />,
  notebook: <BookOpen size={18} />,
  attendance: <UserCheck size={18} />,
  evaluate: <ClipboardCheck size={18} />,
  documents: <FileText size={18} />,
  inclass: <Presentation size={18} />,
  meetings: <Users2 size={18} />,
  trainings: <GraduationCap size={18} />,
  share: <Share2 size={18} />,
  audit: <ScrollText size={18} />,
  profile: <User size={18} />,
};

interface Props {
  mini: boolean;
  /** Abierto por encima del contenido (pantallas estrechas). */
  overlay?: boolean;
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

export function Sidebar({ mini, overlay, onToggle, current, onNav, user, sharing, saving, onLogout }: Props) {
  const { t } = useI18n();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '{}'); } catch { return {}; }
  });
  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed));
  }, [collapsed]);

  return (
    <aside className={`sidebar${mini ? ' mini' : ''}${overlay ? ' overlay' : ''}`} aria-label={t('Menú principal')}>
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
          aria-label={mini ? t('Expandir el menú') : t('Plegar el menú')}
          aria-expanded={!mini}
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
        {NAV_GROUPS.map(({ sect, items, collapsedByDefault }) => {
          const holdsCurrent = items.some(i => isCurrent(i, current));
          // Con la barra plegada no se ven las cabeceras, así que plegar un
          // grupo ahí escondería sus entradas sin dejar forma de recuperarlas.
          // «Más» empieza plegado, salvo que la pantalla abierta esté dentro.
          const isCollapsed = !mini && (collapsed[sect] ?? (!!collapsedByDefault && !holdsCurrent));

          return (
            <div key={sect}>
              <button
                className={`sb-sect-btn${isCollapsed && holdsCurrent ? ' has-current' : ''}`}
                onClick={() => setCollapsed(c => ({ ...c, [sect]: !isCollapsed }))}
                aria-expanded={!isCollapsed}
                title={t(isCollapsed ? 'Desplegar' : 'Plegar')}
                type="button"
              >
                <span className="sb-sect">{t(sect)}</span>
                <ChevronDown className="sb-sect-chev" size={12} style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none' }} />
              </button>

              {!isCollapsed && items.map(item => {
                const on = isCurrent(item, current);
                const tip = item.kind === 'hub'
                  ? `${t(item.label)}: ${item.tabs.map(tb => t(tb.label)).join(' · ')}`
                  : t(item.label);
                return (
                  <button
                    key={item.id}
                    className={`nav-item${on ? ' active' : ''}`}
                    onClick={() => onNav(item.kind === 'hub' ? hubTarget(item) : item.id)}
                    aria-current={on ? 'page' : undefined}
                    // Plegado solo se ve el icono: el nombre va en la etiqueta y el tooltip
                    aria-label={mini ? t(item.label) : undefined}
                    title={mini || item.kind === 'hub' ? tip : undefined}
                  >
                    <span className="ni-icon">{ICONS[item.icon]}</span>
                    <span className="ni-label">{t(item.label)}</span>
                    {item.id === 'share' && sharing && (
                      <span className="ni-live" title="Sesión compartida activa" />
                    )}
                  </button>
                );
              })}
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
