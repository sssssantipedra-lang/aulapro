/**
 * Pestañas de un apartado del menú (Evaluar, Documentos, En clase): se ven
 * encima de la pantalla y permiten saltar entre sus pantallas hermanas sin
 * volver al menú. Al entrar en el apartado parpadea dos veces del color de la
 * app (ver App.tsx e index.css). Ver lib/navigation.ts.
 */
import { ClipboardCheck, FileText, Presentation, Volleyball } from 'lucide-react';
import type { Section } from '../../types';
import { hubEnMenu, type NavHub } from '../../lib/navigation';
import type { TipoDocente } from '../../lib/tipoDocente';
import { useI18n } from '../../i18n';

const HUB_ICON: Record<NavHub['id'], React.ReactNode> = {
  evaluate: <ClipboardCheck size={16} />,
  documents: <FileText size={16} />,
  inclass: <Presentation size={16} />,
  ef: <Volleyball size={16} />,
};

export function HubTabs({ section, tipo, onNav }: { section: Section; tipo: TipoDocente; onNav: (s: Section) => void }) {
  const { t } = useI18n();
  const hub = hubEnMenu(section, tipo);
  if (!hub) return null;
  // Con grupos (Educación Física): en la portada, solo ella (las tarjetas
  // llevan a todo lo demás); en una pantalla, la portada y las de su tema
  const grupo = hub.tabs.find(tab => tab.id === section)?.grupo;
  const tabs = !hub.grupos ? hub.tabs : hub.tabs.filter(tab => !tab.grupo || tab.grupo === grupo);

  return (
    <div className="hub-bar">
      <span className="hub-ttl" title={t(hub.hint)}>
        {HUB_ICON[hub.id]}{t(hub.label)}
        {hub.grupos && grupo && <span className="hub-grupo">{t(hub.grupos[grupo])}</span>}
      </span>
      <div className="hub-tabs" role="tablist" aria-label={t(hub.label)}>
        {tabs.map(tab => {
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
