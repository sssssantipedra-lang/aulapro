/**
 * El radar de una clase, encima de su alumnado en «Mis clases» (18-11-2026):
 * quién necesita atención y quién va especialmente bien en las últimas 4
 * semanas, con el motivo. Al pulsar un nombre se abre su ficha. Las reglas, en
 * `lib/radarClase.ts`.
 */
import { useState } from 'react';
import { Radar as IconoRadar, Sparkles, TriangleAlert } from 'lucide-react';
import { useI18n } from '../../i18n';
import { textoDeDato } from '../../lib/resumenAlumno';
import type { AlumnoEnRadar, Radar } from '../../lib/radarClase';
import type { Student } from '../../types';

const VISIBLES = 4;

export function RadarDeClase({ radar, onAbrir }: { radar: Radar; onAbrir: (s: Student) => void }) {
  const { t, locale } = useI18n();
  const [todos, setTodos] = useState(false);
  if (!radar.atencion.length && !radar.destacan.length) return null;

  const fila = (clase: 'neg' | 'pos', titulo: string, lista: AlumnoEnRadar[]) => lista.length > 0 && (
    <div className={`rc-fila ${clase}`}>
      <h4>{clase === 'neg' ? <TriangleAlert size={13} aria-hidden="true" /> : <Sparkles size={13} aria-hidden="true" />}{t(titulo)} <span>{lista.length}</span></h4>
      <ul>
        {(todos ? lista : lista.slice(0, VISIBLES)).map(x => (
          <li key={x.student.id}>
            <button type="button" onClick={() => onAbrir(x.student)}>
              <b>{x.student.name}</b>
              <small>{textoDeDato(x.dato, t, locale)}{x.cuantos > 1 ? ` · ${t('y {n} más', { n: x.cuantos - 1 })}` : ''}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
  const ocultos = Math.max(0, radar.atencion.length - VISIBLES) + Math.max(0, radar.destacan.length - VISIBLES);

  return (
    <section className="rc" aria-label={t('Radar de la clase')}>
      <div className="rc-hd">
        <strong><IconoRadar size={14} aria-hidden="true" />{t('Radar de la clase')}</strong>
        <span>{t('Últimas 4 semanas')}</span>
      </div>
      <div className="rc-cols">
        {fila('neg', 'Necesitan atención', radar.atencion)}
        {fila('pos', 'Van especialmente bien', radar.destacan)}
      </div>
      {ocultos > 0 && (
        <button type="button" className="rc-mas" aria-expanded={todos} onClick={() => setTodos(v => !v)}>
          {todos ? t('Ver menos') : t('Ver todos ({n} más)', { n: ocultos })}
        </button>
      )}
    </section>
  );
}
