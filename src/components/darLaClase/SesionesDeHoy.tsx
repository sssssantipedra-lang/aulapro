/**
 * Las sesiones con fecha de hoy que aún no se han dado, en «Tu jornada» del Inicio, cada una con su botón
 * «Dar la clase» (20-11-2026). Solo se enseña si hay alguna.
 */
import { useI18n } from '../../i18n';
import { BotonDarLaClase } from './BotonDarLaClase';

export interface SesionDeHoy { id: string; titulo: string; clase: string; color: string }

const MAXIMO = 4;

export function SesionesDeHoy({ sesiones, onDar }: { sesiones: SesionDeHoy[]; onDar: (id: string) => void }) {
  const { t } = useI18n();
  if (sesiones.length === 0) return null;
  return (
    <ul className="dlc-hoy" aria-label={t('Sesiones de hoy')}>
      {sesiones.slice(0, MAXIMO).map(s => (
        <li key={s.id}>
          <span className="home-class-dot" style={{ background: s.color }} aria-hidden="true" />
          <span className="dlc-hoy-txt">
            <small>{[t('Sesión de hoy'), s.clase].filter(Boolean).join(' · ')}</small>
            <strong>{s.titulo || t('Sin título')}</strong>
          </span>
          <BotonDarLaClase onClick={() => onDar(s.id)} titulo={s.titulo} />
        </li>
      ))}
      {sesiones.length > MAXIMO && <li className="home-muted">{t('y {n} más', { n: sesiones.length - MAXIMO })}</li>}
    </ul>
  );
}
