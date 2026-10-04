/**
 * Pestañas de un apartado del menú (Evaluar, Documentos, En clase): se ven
 * encima de la pantalla y permiten saltar entre sus pantallas hermanas sin
 * volver al menú. Al entrar en el apartado parpadea dos veces del color de la
 * app (ver App.tsx e index.css). Ver lib/navigation.ts.
 */
import { ClipboardCheck, FileText, Presentation, HeartHandshake } from 'lucide-react';
import type { Section } from '../../types';
import { hubOf, type NavHub } from '../../lib/navigation';
import { useI18n } from '../../i18n';

const HUB_ICON: Record<NavHub['id'], React.ReactNode> = {
  evaluate: <ClipboardCheck size={16} />,
  documents: <FileText size={16} />,
  inclass: <Presentation size={16} />,
  apoyo: <HeartHandshake size={16} />,
};

export function HubTabs({ section, onNav }: { section: Section; onNav: (s: Section) => void }) {
  const { t } = useI18n();
  const hub = hubOf(section);
  if (!hub) return null;

  return (
    <div className="hub-bar">
      <span className="hub-ttl" title={t(hub.hint)}>{HUB_ICON[hub.id]}{t(hub.label)}</span>
      <div className="hub-tabs" role="tablist" aria-label={t(hub.label)}>
        {hub.tabs.map(tab => {
          const on = tab.id === section;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={`hub-tab${on ? ' on' : ''}`}
              onClick={() => onNav(tab.id)}
            >
              {t(tab.label)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
