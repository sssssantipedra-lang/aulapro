import { useState } from 'react';
import type { DianaItem } from '../../types';

/**
 * Diana de evaluación interactiva.
 *
 * Cada sector es un ítem y cada anillo un nivel de logro (1 dentro → 4 fuera).
 * Al hacer clic en un anillo se asigna ese nivel al ítem: cuanto más llena
 * queda la diana, mejor es el resultado.
 */

const SIZE = 340;
const CENTER = SIZE / 2;
const MAX_R = 116;
const RINGS = 4;

export const LEVEL_COLORS: Record<number, { fill: string; solid: string; label: string }> = {
  1: { fill: 'rgba(239,68,68,0.75)',  solid: '#dc2626', label: 'Insuficiente' },
  2: { fill: 'rgba(245,158,11,0.75)', solid: '#d97706', label: 'Suficiente' },
  3: { fill: 'rgba(59,130,246,0.75)', solid: '#2563eb', label: 'Bien' },
  4: { fill: 'rgba(16,185,129,0.78)', solid: '#059669', label: 'Excelente' },
};

function polar(angle: number, radius: number): [number, number] {
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)];
}

/** Path de un sector anular (porción de anillo entre dos ángulos). */
function sectorPath(a0: number, a1: number, rIn: number, rOut: number): string {
  const [x0o, y0o] = polar(a0, rOut);
  const [x1o, y1o] = polar(a1, rOut);
  const large = a1 - a0 > Math.PI ? 1 : 0;

  if (rIn <= 0.01) {
    return `M ${CENTER} ${CENTER} L ${x0o} ${y0o} A ${rOut} ${rOut} 0 ${large} 1 ${x1o} ${y1o} Z`;
  }
  const [x0i, y0i] = polar(a0, rIn);
  const [x1i, y1i] = polar(a1, rIn);
  return `M ${x0o} ${y0o} A ${rOut} ${rOut} 0 ${large} 1 ${x1o} ${y1o} ` +
         `L ${x1i} ${y1i} A ${rIn} ${rIn} 0 ${large} 0 ${x0i} ${y0i} Z`;
}

interface Props {
  items: DianaItem[];
  scores: Record<string, number>;
  onSetScore: (itemId: string, level: number) => void;
  /** Solo lectura: sin interacción ni cursor de clic. */
  readOnly?: boolean;
}

export function DianaBoard({ items, scores, onSetScore, readOnly }: Props) {
  const [hover, setHover] = useState<{ itemId: string; level: number } | null>(null);
  const n = items.length;
  if (n === 0) return null;

  const step = (2 * Math.PI) / n;

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ overflow: 'visible', userSelect: 'none', maxWidth: '100%' }}
      role="img"
      aria-label="Diana de evaluación"
    >
      {items.map((item, i) => {
        // Empieza arriba y avanza en sentido horario
        const a0 = i * step - Math.PI / 2;
        const a1 = a0 + step;
        const current = scores[item.id] ?? 0;

        return (
          <g key={item.id}>
            {Array.from({ length: RINGS }, (_, r) => {
              const level = r + 1;
              const rIn = (r / RINGS) * MAX_R;
              const rOut = ((r + 1) / RINGS) * MAX_R;
              const reached = current >= level;
              const isHover = hover?.itemId === item.id && hover.level === level;

              return (
                <path
                  key={level}
                  d={sectorPath(a0, a1, rIn, rOut)}
                  fill={reached ? LEVEL_COLORS[current].fill : isHover ? 'rgba(var(--accent-rgb),0.16)' : 'var(--surface)'}
                  stroke="white"
                  strokeWidth={1.5}
                  style={{ cursor: readOnly ? 'default' : 'pointer', transition: 'fill 0.15s' }}
                  onClick={readOnly ? undefined : () => onSetScore(item.id, level)}
                  onMouseEnter={readOnly ? undefined : () => setHover({ itemId: item.id, level })}
                  onMouseLeave={readOnly ? undefined : () => setHover(null)}
                >
                  {!readOnly && <title>{`${item.name} — ${LEVEL_COLORS[level].label}`}</title>}
                </path>
              );
            })}
          </g>
        );
      })}

      {/* Separadores radiales */}
      {items.map((item, i) => {
        const a = i * step - Math.PI / 2;
        const [x, y] = polar(a, MAX_R);
        return <line key={`sep-${item.id}`} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="white" strokeWidth={1.5} />;
      })}

      {/* Etiquetas de los ítems */}
      {items.map((item, i) => {
        const mid = i * step - Math.PI / 2 + step / 2;
        const [lx, ly] = polar(mid, MAX_R + 26);
        const cos = Math.cos(mid);
        const anchor: 'start' | 'middle' | 'end' = cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle';
        const current = scores[item.id] ?? 0;
        const short = item.name.length > 22 ? item.name.slice(0, 21) + '…' : item.name;

        return (
          <g key={`lbl-${item.id}`}>
            <text
              x={lx} y={ly} textAnchor={anchor}
              fontSize={11} fontWeight={700} fontFamily="var(--font)"
              fill={current > 0 ? 'var(--text)' : 'var(--text-3)'}
            >
              {short}
            </text>
            {current > 0 && (
              <text
                x={lx} y={ly + 13} textAnchor={anchor}
                fontSize={10} fontWeight={800} fontFamily="var(--font)"
                fill={LEVEL_COLORS[current].solid}
              >
                {LEVEL_COLORS[current].label}
              </text>
            )}
          </g>
        );
      })}

      <circle cx={CENTER} cy={CENTER} r={3} fill="white" />
    </svg>
  );
}

/**
 * Nota sobre 10 a partir de los niveles de logro, ponderada por el peso
 * de cada ítem. Solo cuentan los ítems ya evaluados.
 */
export function dianaGrade(items: DianaItem[], scores: Record<string, number>): number | null {
  let sum = 0;
  let weight = 0;
  for (const item of items) {
    const level = scores[item.id];
    if (!level) continue;
    const w = item.weight > 0 ? item.weight : 1;
    sum += (level / RINGS) * w;
    weight += w;
  }
  if (weight === 0) return null;
  return Math.round((sum / weight) * 10 * 10) / 10;
}
