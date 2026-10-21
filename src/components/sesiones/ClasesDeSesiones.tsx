/**
 * La portada de Sesiones (petición del dueño, 21-10-2026): una tarjeta por
 * clase, agrupadas por Primaria, ESO y otras, con cuántas sesiones tiene, cómo
 * va y cuál toca después. Se entra en la tarjeta para ver sus sesiones
 * agrupadas por situación de aprendizaje. Ver `lib/sesiones.ts`.
 */
import { CalendarDays, Plus } from 'lucide-react';
import { useI18n } from '../../i18n';
import { agruparPorEtapa } from '../../lib/etapas';
import { resumenDeClase } from '../../lib/sesiones';
import { fromIsoDate } from '../../lib/utils';
import type { Class } from '../../types';
import type { SesionEF } from '../../types/ef';

interface Props {
  classes: Class[];
  sesiones: SesionEF[];
  hoy: string;
  /** Una clase, o `''` para las sesiones sin clase. */
  onAbrir: (claseId: string) => void;
  onNueva: (claseId: string) => void;
}

export function ClasesDeSesiones({ classes, sesiones, hoy, onAbrir, onNueva }: Props) {
  const { t, locale } = useI18n();
  const dia = (f: string) => fromIsoDate(f).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const sinClase = sesiones.filter(s => !s.claseId || !classes.some(c => c.id === s.claseId));

  const tarjeta = (id: string, nombre: string, color: string | undefined, delasClase: SesionEF[]) => {
    const r = resumenDeClase(delasClase, hoy);
    return (
      <article key={id || 'sin-clase'} className="ses-clase" style={{ ['--ses-c' as string]: color ?? 'var(--text-3)' }}>
        <button type="button" className="ses-clase-main" onClick={() => onAbrir(id)} aria-label={t('Abrir las sesiones de {clase}', { clase: nombre })}>
          <span className="ses-clase-hd">
            <span className="sda-group-dot" style={{ background: color ?? 'var(--text-3)' }} aria-hidden="true" />
            <strong>{nombre}</strong>
            <span className="sda-count">{r.total}</span>
          </span>
          {r.total === 0 ? (
            <span className="ap-sub">{t('Todavía sin sesiones')}</span>
          ) : (
            <>
              <span className="ef-progreso-barra" aria-hidden="true"><span style={{ width: `${Math.round((r.hechas / r.total) * 100)}%` }} /></span>
              <span className="ap-sub">{t('{hechas} de {total} sesiones completadas', { hechas: r.hechas, total: r.total })}</span>
              {r.proxima && (
                <span className="ap-meta ses-clase-prox">
                  {r.proxima.fecha ? <><CalendarDays size={12} aria-hidden="true" />{dia(r.proxima.fecha)}</> : <span>{t('Sin fecha')}</span>}
                  <span className="ses-clase-prox-t">{r.proxima.titulo || t('Sin título')}</span>
                </span>
              )}
              {r.atrasadas > 0 && <span className="sda-chip ef-atrasada">{t('{n} por completar', { n: r.atrasadas })}</span>}
            </>
          )}
        </button>
        {id && (
          <button type="button" className="ico-btn ses-clase-nueva" onClick={() => onNueva(id)} title={t('Añadir una sesión a {clase}', { clase: nombre })}
            aria-label={t('Añadir una sesión a {clase}', { clase: nombre })}><Plus size={16} /></button>
        )}
      </article>
    );
  };

  return (
    <div className="ses-clases">
      {agruparPorEtapa(classes).map(g => (
        <section key={g.id} className="ses-etapa">
          <h2 className="ses-etapa-ttl">{t(g.label)}</h2>
          <div className="ses-grid">
            {g.clases.map(c => tarjeta(c.id, c.name, c.color, sesiones.filter(s => s.claseId === c.id)))}
          </div>
        </section>
      ))}
      {sinClase.length > 0 && (
        <section className="ses-etapa">
          <h2 className="ses-etapa-ttl">{t('Sin clase')}</h2>
          <div className="ses-grid">{tarjeta('', t('Sin clase concreta'), undefined, sinClase)}</div>
        </section>
      )}
    </div>
  );
}
