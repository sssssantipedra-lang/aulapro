/**
 * Guía de «Primeros pasos» del Inicio. Con el perfil vacío ocupa el centro de
 * la pantalla; después se queda arriba, compacta, hasta que se completa o el
 * docente la oculta.
 */
import { useState } from 'react';
import { Check, ArrowRight, Sparkles, X, Rocket } from 'lucide-react';
import type { Section } from '../../types';
import { firstStepsComplete, type FirstStep, type FirstStepId } from '../../lib/firstSteps';
import { useI18n } from '../../i18n';

const TEXT: Record<FirstStepId, { title: string; desc: string; action: string }> = {
  classes: {
    title: 'Crea tu primera clase y añade a tu alumnado',
    desc: 'Un grupo (por ejemplo «3º ESO A») con su lista. Puedes pegarla de una hoja de cálculo.',
    action: 'Ir a Mis clases',
  },
  schedule: {
    title: 'Añade tu horario',
    desc: 'Hazle una foto al horario del centro y la aplicación lo coloca solo en la Agenda.',
    action: 'Ir a la Agenda',
  },
  notebook: {
    title: 'Decide cómo evalúas',
    desc: 'En el Cuaderno, elige las categorías de nota y cuánto pesa cada una (por ejemplo 60/30/10).',
    action: 'Ir al Cuaderno',
  },
  attendance: {
    title: 'Pasa lista por primera vez',
    desc: 'Marca solo las faltas y los retrasos: el resto queda como presente.',
    action: 'Ir a Asistencia',
  },
  ai: {
    title: 'Conecta la IA (opcional)',
    desc: 'Con una clave gratuita de Google, la aplicación redacta informes, crea rúbricas y lee tu horario.',
    action: 'Configurar',
  },
};

const HIDDEN_KEY = 'aulapro_first_steps_hidden';

function readHidden(profileId: string): boolean {
  try { return (JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as string[]).includes(profileId); } catch { return false; }
}
function writeHidden(profileId: string) {
  try {
    const list = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as string[];
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...new Set([...list, profileId])]));
  } catch { /* sin almacenamiento: se oculta solo en esta sesión */ }
}

interface Props {
  steps: FirstStep[];
  /** Perfil vacío: la guía es lo único que hay en el Inicio. */
  hero: boolean;
  profileId: string;
  onNav: (s: Section) => void;
  onLoadDemo: () => void;
}

export function FirstSteps({ steps, hero, profileId, onNav, onLoadDemo }: Props) {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(() => readHidden(profileId));

  if (!hero && (hidden || firstStepsComplete(steps))) return null;

  const required = steps.filter(s => !s.optional);
  const doneCount = required.filter(s => s.done).length;
  const next = steps.find(s => !s.done);

  return (
    <div className={`card fs-card${hero ? ' hero' : ''}`}>
      <div className="fs-hd">
        <span className="fs-ico"><Rocket size={hero ? 22 : 16} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="fs-ttl">{t(hero ? 'Te damos la bienvenida a Aula Pro: empieza por aquí' : 'Primeros pasos')}</h2>
          <p className="fs-sub">
            {t('{done} de {total} hechos. Cada paso se marca solo en cuanto lo haces.', { done: doneCount, total: required.length })}
          </p>
        </div>
        {!hero && (
          <button
            type="button" className="ico-btn" title={t('Ocultar la guía')} aria-label={t('Ocultar la guía')}
            onClick={() => { writeHidden(profileId); setHidden(true); }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="fs-bar" aria-hidden="true"><span style={{ width: `${(doneCount / required.length) * 100}%` }} /></div>

      <ol className="fs-list">
        {steps.map((s, i) => {
          const txt = TEXT[s.id];
          const isNext = s === next;
          return (
            <li key={s.id} className={`fs-step${s.done ? ' done' : ''}${isNext ? ' next' : ''}`}>
              <span className="fs-num" aria-hidden="true">{s.done ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
              <div className="fs-body">
                <span className="fs-step-ttl">{t(txt.title)}</span>
                {!s.done && <span className="fs-step-desc">{t(txt.desc)}</span>}
              </div>
              {!s.done && (
                <button
                  type="button"
                  className={isNext ? 'btn-accent fs-go' : 'btn-ghost fs-go'}
                  onClick={() => onNav(s.target)}
                >
                  {t(txt.action)} <ArrowRight size={13} />
                </button>
              )}
              {s.done && <span className="sr-only">{t('Hecho')}</span>}
            </li>
          );
        })}
      </ol>

      {hero && (
        <div className="fs-demo">
          <span>{t('¿Prefieres curiosear antes?')}</span>
          <button type="button" className="btn-ghost" onClick={onLoadDemo}>
            <Sparkles size={14} color="var(--accent-d)" />{t('Cargar datos de ejemplo')}
          </button>
        </div>
      )}
    </div>
  );
}
