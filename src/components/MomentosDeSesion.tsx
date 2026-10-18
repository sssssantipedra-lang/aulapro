/**
 * Una sesión de EF de la situación de aprendizaje, explicada en sus tres
 * momentos (preimpacto, impacto y postimpacto), cada uno con sus actividades
 * reales: cómo se hacen, cómo se organizan y con qué material. Ver
 * `lib/sesionSda.ts` y `docs/EF.md`.
 */
import { Clock } from 'lucide-react';
import { MOMENTOS, minutosDeSesion } from '../lib/sesionSda';
import type { MomentosSesionEF } from '../services/learningSituations';
import { useI18n } from '../i18n';

export function MomentosDeSesion({ momentos }: { momentos: MomentosSesionEF }) {
  const { t } = useI18n();
  const total = minutosDeSesion(momentos);
  return (
    <details className="sda-momentos" open>
      <summary>
        {t('Preimpacto, impacto y postimpacto')}
        {total > 0 && <span className="sda-momentos-min"><Clock size={12} aria-hidden="true" />{t('{n} min', { n: total })}</span>}
      </summary>
      <div className="sda-momentos-cols">
        {MOMENTOS.map(m => {
          const x = momentos[m.id];
          const min = x.actividades.reduce((s, a) => s + a.minutos, 0);
          return (
            <section key={m.id} className={`sda-momento ${m.id}`} aria-label={t(m.label)}>
              <h5>{t(m.label)}{min > 0 && <small>{t('{n} min', { n: min })}</small>}</h5>
              <p className="sda-momento-ayuda">{t(m.ayuda)}</p>
              {x.texto && <p className="sda-momento-txt">{x.texto}</p>}
              {x.actividades.map((a, i) => (
                <article key={i} className="sda-act">
                  <div className="sda-act-hd"><strong>{a.nombre}</strong>{a.minutos > 0 && <span>{t('{n} min', { n: a.minutos })}</span>}</div>
                  <p>{a.descripcion}</p>
                  {a.organizacion && <p className="sda-act-meta"><b>{t('Organización')}:</b> {a.organizacion}</p>}
                  {a.material && <p className="sda-act-meta"><b>{t('Material')}:</b> {a.material}</p>}
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </details>
  );
}
