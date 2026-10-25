import {
  LayoutDashboard, Users, CalendarDays, ClipboardCheck, BookOpen, Settings, ChevronLeft, ChevronRight,
  Presentation, Users2, UserCheck, FileText, LogOut, Check, ScrollText, GraduationCap, Share2, MapPin,
  NotebookPen, Contact, Shapes, MonitorPlay, Images, Volleyball,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useI18n } from '../../i18n';
import { nombreComunidad } from '../../lib/curriculum/comunidades';
import { requestSettingsPanel } from '../../lib/settingsNav';
import type { User as UserType } from '../../types';
import type { Section } from '../../types';
import { navGroupsFor, isCurrent, hubTarget, type NavEntry, type NavIcon } from '../../lib/navigation';

const ICONS: Record<NavIcon, React.ReactNode> = {
  home: <LayoutDashboard size={16} />,
  classes: <Users size={16} />,
  agenda: <CalendarDays size={16} />,
  notebook: <BookOpen size={16} />,
  attendance: <UserCheck size={16} />,
  evaluate: <ClipboardCheck size={16} />,
  documents: <FileText size={16} />,
  inclass: <Presentation size={16} />,
  ef: <Volleyball size={16} />,
  session: <NotebookPen size={16} />,
  students: <Contact size={16} />,
  pictos: <Images size={16} />,
  resources: <Shapes size={16} />,
  live: <MonitorPlay size={16} />,
  meetings: <Users2 size={16} />,
  trainings: <GraduationCap size={16} />,
  share: <Share2 size={16} />,
  audit: <ScrollText size={16} />,
  profile: <Settings size={16} />,
};

/**
 * El color de cada entrada: el cuadradito de su icono. Ayuda a reconocerla de
 * un vistazo; el nombre sigue al lado, así que el color nunca es lo único que
 * la distingue. Las de la cuenta (abajo) no llevan.
 */
const COLOR: Partial<Record<NavIcon, string>> = {
  home: '#f97316',
  classes: '#8b5cf6',
  agenda: '#ef4444',
  notebook: '#10b981',
  attendance: '#0ea5e9',
  evaluate: '#f59e0b',
  documents: '#6366f1',
  inclass: '#ec4899',
  ef: '#65a30d',
  session: '#10b981',
  students: '#8b5cf6',
  pictos: '#ec4899',
  resources: '#6366f1',
  live: '#0ea5e9',
  meetings: '#14b8a6',
  trainings: '#ca8a04',
  share: '#64748b',
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
  /** Se está escribiendo en disco ahora mismo. */
  saving?: boolean;
  onLogout: () => void;
}

export function Sidebar({ mini, overlay, onToggle, current, onNav, user, saving, onLogout }: Props) {
  const { t, lang } = useI18n();

  const groups = navGroupsFor(user?.tipo ?? 'aula');

  const renderItem = (item: NavEntry, quiet = false) => {
    const on = isCurrent(item, current);
    const tip = item.kind === 'hub'
      ? `${t(item.label)}: ${item.tabs.map(tb => t(tb.label)).join(' · ')}`
      : t(item.label);
    return (
      <button
        key={item.id}
        className={`nav-item${on ? ' active' : ''}${quiet ? ' quiet' : ''}`}
        onClick={() => onNav(item.kind === 'hub' ? hubTarget(item) : item.id)}
        aria-current={on ? 'page' : undefined}
        // Plegado solo se ve el icono: el nombre va en la etiqueta y el tooltip
        aria-label={mini ? t(item.label) : undefined}
        title={mini || item.kind === 'hub' ? tip : undefined}
      >
        <span className="ni-icon" style={quiet ? undefined : { '--ni-c': COLOR[item.icon] } as React.CSSProperties}>{ICONS[item.icon]}</span>
        <span className="ni-label">{t(item.label)}</span>
      </button>
    );
  };

  return (
    <aside className={`sidebar${mini ? ' mini' : ''}${overlay ? ' overlay' : ''}`} aria-label={t('Menú principal')}>
      <div className="sb-logo">
        <img className="sb-logo-box" src={`${import.meta.env.BASE_URL}favicon-mini.svg`} width={34} height={34} alt="" />
        <span className="sb-title">Aula Pro</span>
        <button
          className="ico-btn sb-toggle"
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
            <div className="sb-teacher-name">{user.full_name}</div>
            <div className="sb-teacher-sub">{user.subject || user.school}</div>
          </div>
        </button>
      )}

      {/* La comunidad lleva directa a su apartado en Perfil. Sin ella, avisa. */}
      {user && (
        <button
          type="button"
          className={`sb-community${user.community ? '' : ' unset'}`}
          onClick={() => { requestSettingsPanel('perfil'); onNav('profile'); }}
          title={user.community ? t('Tu comunidad autónoma. Púlsala para cambiarla en el perfil.') : t('Elige tu comunidad autónoma')}
          aria-label={user.community
            ? `${t('Comunidad autónoma')}: ${nombreComunidad(user.community, lang)}`
            : t('Elige tu comunidad autónoma')}
        >
          <MapPin size={12} />
          <span className="sb-community-name">
            {user.community ? nombreComunidad(user.community, lang) : t('Elige tu comunidad')}
          </span>
        </button>
      )}

      <div className="sb-div" />

      <nav className="sb-nav">
        {groups.filter(g => !g.pie).map(({ sect, items }) => (
          <div key={sect}>
            <div className="sb-sect">{t(sect)}</div>
            {items.map(item => renderItem(item))}
          </div>
        ))}
      </nav>

      <div className="sb-div" />

      {/* Lo de la cuenta y el estado de guardado, siempre abajo. Los créditos
          y la versión están en Configuración. */}
      <div className="sb-foot">
        {groups.filter(g => g.pie).flatMap(g => g.items).map(item => renderItem(item, true))}
        <button className="nav-item quiet" onClick={onLogout} aria-label={mini ? t('Cerrar sesión') : undefined} title={mini ? t('Cerrar sesión') : undefined}>
          <span className="ni-icon"><LogOut size={16} /></span>
          <span className="ni-label">{t('Cerrar sesión')}</span>
        </button>
        <div className="sb-saved" role="status">
          {saving
            ? <><span className="spin" style={{ width: 10, height: 10, borderWidth: 1.5 }} /><span>{t('Guardando…')}</span></>
            : <><Check size={11} /><span>{t('Todo guardado')}</span></>}
        </div>
      </div>
    </aside>
  );
}
