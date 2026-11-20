/**
 * Lo que la Agenda enseña además de los eventos (20-11-2026): las capas de solo lectura con lo que ya tiene fecha
 * en otras pantallas (`lib/capasAgenda.ts`). Aquí, los interruptores de las capas con el filtro por clase, y la
 * lista de apuntes de un día; cada apunte abre su pantalla.
 */
import { ArrowRight, Check } from 'lucide-react';
import { useI18n } from '../../i18n';
import { CAPAS, colorDeCapa, type ApunteDeAgenda, type CapaAgenda } from '../../lib/capasAgenda';
import type { Class } from '../../types';

interface BarraProps {
  /** Las capas que este perfil tiene. */
  capas: CapaAgenda[];
  apagadas: ReadonlySet<CapaAgenda>;
  onAlternar: (capa: CapaAgenda) => void;
  classes: Class[];
  /** La clase por la que se filtra; vacío, todas. */
  claseId: string;
  onClase: (id: string) => void;
}

export function BarraDeCapas({ capas, apagadas, onAlternar, classes, claseId, onClase }: BarraProps) {
  const { t } = useI18n();
  if (capas.length === 0 && classes.length === 0) return null;
  return (
    <div className="ag-capas">
      {capas.length > 0 && (
        <div className="ag-capas-chips" role="group" aria-label={t('Qué se ve además de tus eventos')}>
          <span className="ag-capas-ttl">{t('También se ve:')}</span>
          {capas.map(id => {
            const capa = CAPAS.find(c => c.id === id)!;
            const on = !apagadas.has(id);
            return (
              <button key={id} type="button" className={`ag-capa${on ? ' on' : ''}`} aria-pressed={on}
                style={{ '--ag-c': capa.color } as React.CSSProperties} onClick={() => onAlternar(id)}>
                <span className="ag-capa-marca" aria-hidden="true" />{t(capa.label)}
              </button>
            );
          })}
        </div>
      )}
      {classes.length > 0 && (
        <div className="ag-filtro">
          <label htmlFor="ag-filtro-clase">{t('Clase')}</label>
          <select id="ag-filtro-clase" className="finput" value={claseId} onChange={e => onClase(e.target.value)}>
            <option value="">{t('Todas las clases')}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

interface ListaProps {
  apuntes: ApunteDeAgenda[];
  classes: Class[];
  onAbrir: (a: ApunteDeAgenda) => void;
}

/** Los apuntes de un día: cada uno dice de dónde viene y lleva a su pantalla. */
export function ApuntesDelDia({ apuntes, classes, onAbrir }: ListaProps) {
  const { t } = useI18n();
  if (apuntes.length === 0) return null;
  const tipo = (a: ApunteDeAgenda) => (
    a.tipo === 'sesion' ? t('Sesión') : a.tipo === 'actividad' ? t('Cuaderno') : a.tipo === 'reunion' ? t('Reunión')
      : a.tipo === 'formacion' ? t('Formación') : t('Prueba física')
  );
  return (
    <ul className="ag-apuntes" aria-label={t('De otras pantallas')}>
      {apuntes.map(a => {
        const clase = classes.find(c => c.id === a.claseId)?.name;
        const datos = [tipo(a), clase, a.extra, a.cuantas ? t(a.cuantas === 1 ? '{n} marca' : '{n} marcas', { n: a.cuantas }) : undefined].filter(Boolean);
        return (
          <li key={a.id}>
            <button type="button" className={`ag-apunte${a.hecho ? ' hecho' : ''}`} style={{ '--ag-c': colorDeCapa(a.capa) } as React.CSSProperties}
              onClick={() => onAbrir(a)} title={t('Abrir en su pantalla')}>
              <span className="ag-apunte-hora">{a.hora ?? ''}</span>
              <span className="ag-apunte-txt">
                <strong>{a.titulo || t('Sin título')}</strong>
                <span>{datos.join(' · ')}{a.hecho && <span className="ag-apunte-hecho"><Check size={12} aria-hidden="true" />{t('Completada')}</span>}</span>
              </span>
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
