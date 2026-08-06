import { useState } from 'react';
import type { DianaItem, AchievementLevel } from '../../types';
import { levelsOf, levelColor, gradeFromLevels } from '../../types';
import { useI18n } from '../../i18n';

/**
 * Diana de evaluación interactiva.
 *
 * Cada sector es un ítem y cada anillo un nivel de logro: el peor dentro y el
 * mejor fuera. Al hacer clic en un anillo se asigna ese nivel al ítem, así que
 * cuanto más llena queda la diana, mejor es el resultado.
 *
 * El número de anillos lo marca la escala del instrumento, que el docente
 * puede configurar: no son necesariamente cuatro.
 */

const SIZE = 340;
const CENTER = SIZE / 2;
const MAX_R = 116;

/** Mismos colores que la Diana Competencial, para que se lean como lo mismo. */
export const LEVEL_COLORS: Record<number, { fill: string; solid: string; label: string }> = {
  1: { fill: 'rgba(220,38,38,0.82)',  solid: '#dc2626', label: 'Insuficiente' },
  2: { fill: 'rgba(217,119,6,0.82)',  solid: '#d97706', label: 'Suficiente' },
  3: { fill: 'rgba(37,99,235,0.82)',  solid: '#2563eb', label: 'Bien' },
  4: { fill: 'rgba(22,163,74,0.82)',  solid: '#16a34a', label: 'Excelente' },
};

/**
 * Parte un nombre largo en varias líneas.
 *
 * SVG no ajusta el texto solo, así que antes se recortaba a 22 caracteres y
 * los ítems largos quedaban a medias. Se reparte por palabras, y solo si una
 * palabra sola no cabe se corta por dentro.
 */
function wrapLabel(text: string, maxChars = 17, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';

  for (const word of words) {
    // Palabra más larga que la línea entera: se trocea
    let w = word;
    while (w.length > maxChars) {
      if (cur) { lines.push(cur); cur = ''; }
      if (lines.length >= maxLines) break;
      lines.push(w.slice(0, maxChars - 1) + '-');
      w = w.slice(maxChars - 1);
    }
    if (lines.length >= maxLines) break;

    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) { cur = next; continue; }
    lines.push(cur);
    cur = w;
    if (lines.length >= maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);

  // Si aún sobra texto, se avisa del corte en la última línea
  const usado = lines.join(' ').replace(/-\s/g, '');
  if (usado.length < text.replace(/\s+/g, ' ').trim().length) {
    const last = lines[lines.length - 1] ?? '';
    lines[lines.length - 1] = last.slice(0, Math.max(0, maxChars - 1)) + '…';
  }
  return lines;
}

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
  /** Niveles de logro de esta diana. Ausente = los cuatro clásicos. */
  levels?: AchievementLevel[];
  /** Solo lectura: sin interacción ni cursor de clic. */
  readOnly?: boolean;
}

export function DianaBoard({ items, scores, onSetScore, levels, readOnly }: Props) {
  const { t } = useI18n();
  const [hover, setHover] = useState<{ itemId: string; level: number } | null>(null);
  const n = items.length;
  if (n === 0) return null;

  // Un anillo por nivel: la diana se adapta a la escala del instrumento.
  const scale = levelsOf({ levels });
  const rings = scale.length;
  const step = (2 * Math.PI) / n;
  const ringR = Array.from({ length: rings }, (_, r) => ((r + 1) / rings) * MAX_R);
  /** Separación entre pétalos: hace que cada ítem se lea como una pieza propia. */
  const gap = Math.min(step * 0.05, 0.035);

  return (
    <svg
      // El lienzo se amplía a los lados para que quepan las etiquetas de
      // varias líneas sin depender de `overflow`, que un contenedor con
      // scroll recortaría.
      width={SIZE + 170}
      height={SIZE + 60}
      viewBox={`-85 -30 ${SIZE + 170} ${SIZE + 60}`}
      style={{ userSelect: 'none', maxWidth: '100%', height: 'auto' }}
      role="img"
      aria-label={t('Diana de evaluación')}
    >
      {/* Lo que se puede llegar a llenar. Lo no alcanzado NO se pinta: si cada
          celda vacía fuese un bloque gris, la rejilla taparía el dato. */}
      <circle cx={CENTER} cy={CENTER} r={MAX_R} fill="var(--surface)" fillOpacity={0.5} />

      {/* Un pétalo por ítem, de una pieza desde el centro hasta su nivel */}
      {items.map((item, i) => {
        const current = scores[item.id] ?? 0;
        if (!current) return null;
        const a0 = i * step - Math.PI / 2;
        return (
          <path
            key={`fill-${item.id}`}
            d={sectorPath(a0 + gap, a0 + step - gap, 0, ringR[current - 1])}
            fill={levelColor(current, rings)}
            fillOpacity={0.82}
            style={{ transition: 'd 0.2s ease, fill 0.2s ease' }}
          />
        );
      })}

      {/* Nivel que se marcaría al soltar el clic */}
      {hover && !readOnly && (() => {
        const i = items.findIndex(x => x.id === hover.itemId);
        if (i < 0) return null;
        const a0 = i * step - Math.PI / 2;
        return (
          <path
            d={sectorPath(a0 + gap, a0 + step - gap, 0, ringR[hover.level - 1])}
            fill={levelColor(hover.level, rings)}
            fillOpacity={0.22}
            pointerEvents="none"
          />
        );
      })()}

      {/* Anillos de referencia, por encima y tenues: dejan contar el nivel
          sin partir el pétalo en cuatro bloques. */}
      {ringR.slice(0, rings - 1).map((r, ri) => (
        <circle key={`ring-${ri}`} cx={CENTER} cy={CENTER} r={r}
          fill="none" stroke="white" strokeWidth={1} strokeOpacity={0.5} pointerEvents="none" />
      ))}
      <circle cx={CENTER} cy={CENTER} r={MAX_R} fill="none"
        stroke="var(--border)" strokeWidth={1.5} pointerEvents="none" />

      {/* Separadores: marcan cuántos ítems hay aunque no haya ninguna nota */}
      {items.map((item, i) => {
        const a = i * step - Math.PI / 2;
        const [x, y] = polar(a, MAX_R);
        return <line key={`sep-${item.id}`} x1={CENTER} y1={CENTER} x2={x} y2={y}
          stroke="var(--border)" strokeWidth={1} strokeOpacity={0.55} pointerEvents="none" />;
      })}

      {/* Zonas de clic, invisibles y por encima de todo */}
      {!readOnly && items.map((item, i) => {
        const a0 = i * step - Math.PI / 2;
        return Array.from({ length: rings }, (_, r) => (
          <path
            key={`hit-${item.id}-${r}`}
            d={sectorPath(a0, a0 + step, (r / rings) * MAX_R, ringR[r])}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onClick={() => onSetScore(item.id, r + 1)}
            onMouseEnter={() => setHover({ itemId: item.id, level: r + 1 })}
            onMouseLeave={() => setHover(null)}
          >
            <title>{`${item.name} — ${t(scale[r].label)}`}</title>
          </path>
        ));
      })}

      {/* Etiquetas de los ítems */}
      {items.map((item, i) => {
        const mid = i * step - Math.PI / 2 + step / 2;
        const [lx, ly] = polar(mid, MAX_R + 26);
        const cos = Math.cos(mid);
        const anchor: 'start' | 'middle' | 'end' = cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle';
        const current = scores[item.id] ?? 0;
        const lines = wrapLabel(item.name);
        const LINE_H = 11.5;
        // El bloque se centra sobre el punto de la etiqueta, para que crecer
        // hacia abajo no lo despegue de su sector.
        const top = ly - ((lines.length - 1) * LINE_H) / 2;

        return (
          <g key={`lbl-${item.id}`}>
            <text
              x={lx} y={top} textAnchor={anchor}
              fontSize={11} fontWeight={700} fontFamily="var(--font)"
              fill={current > 0 ? 'var(--text)' : 'var(--text-3)'}
            >
              {lines.map((ln, k) => (
                <tspan key={k} x={lx} dy={k === 0 ? 0 : LINE_H}>{ln}</tspan>
              ))}
              {/* Por si aun así hubiera que recortar algo */}
              <title>{item.name}</title>
            </text>
            {current > 0 && (
              <text
                x={lx} y={top + (lines.length - 1) * LINE_H + 13} textAnchor={anchor}
                fontSize={10} fontWeight={800} fontFamily="var(--font)"
                fill={levelColor(current, rings)}
              >
                {t(scale[current - 1]?.label ?? '')}
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
export function dianaGrade(
  items: DianaItem[],
  scores: Record<string, number>,
  levels?: AchievementLevel[],
): number | null {
  const weights: Record<string, number> = {};
  items.forEach(i => { weights[i.id] = i.weight > 0 ? i.weight : 1; });
  return gradeFromLevels(scores, items.map(i => i.id), levelsOf({ levels }), weights);
}
