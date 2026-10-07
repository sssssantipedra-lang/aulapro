/**
 * Cómo ha ido un objetivo sesión a sesión: una línea con tres alturas
 * (conseguido arriba, en proceso en medio, no conseguido abajo) y un punto
 * por sesión, del color de los botones del Registro diario. Pasando por
 * encima de un punto se ve su fecha. Se usa en el programa de cada alumno y en el Inicio.
 */
import { useI18n } from '../../i18n';
import { fromIsoDate } from '../../lib/utils';
import type { Logro } from '../../types/apoyo';

const ALTURA: Record<Logro, number> = { si: 8, proceso: 24, no: 40 };
const COLOR: Record<Logro, string> = { si: '#16a34a', proceso: '#f59e0b', no: '#dc2626' };
const NOMBRE: Record<Logro, string> = { si: 'Conseguido', proceso: 'En proceso', no: 'No conseguido' };
/** Cuántas sesiones se dibujan como mucho: las últimas. */
const MAX = 24;
const PASO = 22;
const IZQ = 22;

export function GraficaObjetivo({ puntos }: { puntos: { fecha: string; logro: Logro }[] }) {
  const { t, locale } = useI18n();
  if (puntos.length === 0) return null;
  const vistos = puntos.slice(-MAX);
  const ancho = IZQ + Math.max(vistos.length - 1, 1) * PASO + 10;
  const dia = (f: string) => fromIsoDate(f).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const cuenta = (l: Logro) => puntos.filter(p => p.logro === l).length;
  const resumen = t('{n} sesiones', { n: puntos.length }) + ': '
    + (['si', 'proceso', 'no'] as const).filter(cuenta).map(l => `${t(NOMBRE[l])} ${cuenta(l)}`).join(', ')
    + `. ${t('La última vez')}: ${t(NOMBRE[puntos[puntos.length - 1].logro])}.`;
  const x = (i: number) => IZQ + i * PASO;

  return (
    <figure className="ap-graf">
      <svg viewBox={`0 0 ${ancho} 48`} width={ancho} height={48} role="img" aria-label={resumen}>
        {(['si', 'proceso', 'no'] as const).map(l => (
          <g key={l}>
            <line x1={IZQ - 6} x2={ancho - 4} y1={ALTURA[l]} y2={ALTURA[l]} className="ap-graf-guia" />
            <text x={2} y={ALTURA[l] + 4} className="ap-graf-eje" fill={COLOR[l]}>{l === 'si' ? '✓' : l === 'proceso' ? '–' : '✗'}</text>
          </g>
        ))}
        {vistos.length > 1 && (
          <polyline className="ap-graf-linea" points={vistos.map((p, i) => `${x(i)},${ALTURA[p.logro]}`).join(' ')} />
        )}
        {vistos.map((p, i) => (
          <g key={`${p.fecha}-${i}`} className="ap-graf-p">
            <circle cx={x(i)} cy={ALTURA[p.logro]} r={5} fill={COLOR[p.logro]} className="ap-graf-punto" />
            {/* Más grande que el punto, para que sea fácil de señalar */}
            <circle cx={x(i)} cy={ALTURA[p.logro]} r={11} fill="transparent">
              <title>{`${dia(p.fecha)}: ${t(NOMBRE[p.logro])}`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <figcaption className="ap-sub">
        {puntos.length === 1 ? dia(puntos[0].fecha) : `${dia(vistos[0].fecha)} – ${dia(vistos[vistos.length - 1].fecha)}`}
        {puntos.length > MAX && ` · ${t('las {n} últimas', { n: MAX })}`}
      </figcaption>
    </figure>
  );
}
