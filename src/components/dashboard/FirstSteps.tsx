/**
 * Guía de «Primeros pasos» del Inicio. Con el perfil vacío ocupa el centro de
 * la pantalla; después se queda arriba hasta que se completa. El docente la
 * puede minimizar a una sola línea con el paso siguiente, y volver a abrirla.
 */
import { useState } from 'react';
import { Check, ArrowRight, Sparkles, Rocket, ChevronDown, ChevronUp } from 'lucide-react';
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

/** Perfiles con la guía minimizada. Se recuerda entre sesiones. */
const MIN_KEY = 'aulapro_first_steps_min';

function readMin(profileId: string): boolean {
  try { return (JSON.parse(localStorage.getItem(MIN_KEY) ?? '[]') as string[]).includes(profileId); } catch { return false; }
}
function writeMin(profileId: string, min: boolean) {
  try {
    const list = new Set(JSON.parse(localStorage.getItem(MIN_KEY) ?? '[]') as string[]);
    if (min) list.add(profileId); else list.delete(profileId);
    localStorage.setItem(MIN_KEY, JSON.stringify([...list]));
  } catch { /* sin almacenamiento: solo dura esta sesión */ }
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
  const [minimized, setMinimized] = useState(() => readMin(profileId));

  if (!hero && firstStepsComplete(steps)) return null;

  const required = steps.filter(s => !s.optional);
  const doneCount = required.filter(s => s.done).length;
  const next = steps.find(s => !s.done);
  const toggle = (min: boolean) => { writeMin(profileId, min); setMinimized(min); };

  // Minimizada: una sola línea con el progreso y el paso que toca
  if (!hero && minimized) {
    return (
      <div className="card fs-card fs-mini">
        <span className="fs-ico"><Rocket size={14} /></span>
        <button type="button" className="fs-mini-open" onClick={() => toggle(false)} aria-expanded={false}>
          <strong>{t('Primeros pasos')}</strong>
          <span className="fs-mini-count">{doneCount}/{required.length}</span>
          <span className="fs-bar fs-mini-bar" aria-hidden="true"><span style={{ width: `${(doneCount / required.length) * 100}%` }} /></span>
          {next && <span className="fs-mini-next">{t('Siguiente: {step}', { step: t(TEXT[next.id].title) })}</span>}
        </button>
        {next && (
          <button type="button" className="btn-accent fs-go" onClick={() => onNav(next.target)}>
            {t(TEXT[next.id].action)} <ArrowRight size={13} />
          </button>
        )}
        <button type="button" className="ico-btn" title={t('Mostrar la guía')} aria-label={t('Mostrar la guía')} onClick={() => toggle(false)}>
          <ChevronDown size={16} />
        </button>
      </div>
    );
  }

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
            type="button" className="ico-btn" title={t('Minimizar la guía')} aria-label={t('Minimizar la guía')}
            aria-expanded onClick={() => toggle(true)}
          >
            <ChevronUp size={16} />
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
