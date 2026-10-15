/**
 * Edición a mano de las pizzas y tartas de un ejercicio (ver `lib/fraccionesDibujo.ts`): cuántos trozos
 * tiene cada una, cuántos se cogen y cómo se ven los cogidos. En el ejercicio «fracciones» además se
 * elige qué se hace (escribir la fracción, colorear, unir) y si se pide el decimal; en un problema o una
 * pregunta, las pizzas son la figura del enunciado. El dibujo sale siempre de estos números.
 */
import { Plus, Trash2 } from 'lucide-react';
import {
  COGIDOS_FRACCION, MAX_PARTES, MIN_PARTES, MODOS_FRACCIONES, OBJETOS_FRACCION, fraccionSvg, solucionFracciones, tieneDecimalExacto,
  type CogidosFraccion, type FraccionDibujo, type ModoFracciones, type ObjetoFraccion,
} from '../../lib/fraccionesDibujo';
import { useI18n } from '../../i18n';
import type { FichaExercise } from '../../services/resources';

type T = (k: string, v?: Record<string, string | number>) => string;

const MAX_DEDICADO = 4;
const MAX_AMBIENTE = 3;

const MODO_LABEL: Record<ModoFracciones, string> = {
  leer: 'Escribir la fracción de cada pizza',
  colorear: 'Colorear los trozos de cada fracción',
  unir: 'Unir cada pizza con su valor',
};

const COGIDOS_LABEL: Record<CogidosFraccion, string> = {
  ambos: 'En blanco y negro y separados',
  bn: 'En blanco y negro',
  separados: 'Separados',
};

const OBJETO_LABEL: Record<ObjetoFraccion, string> = { pizza: 'Pizza', tarta: 'Tarta' };

/** Un número entero dentro de unos límites. */
const entre = (v: string, min: number, max: number, defecto: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : defecto;
};

export function FraccionesEditor({ ex, uid, dedicado, onChange, t }: {
  ex: FichaExercise;
  /** Para que los ids del dibujo de una pizza no choquen con los de otra en la pantalla. */
  uid: string;
  /** El ejercicio «fracciones» (con modo y decimal) o la figura del enunciado de otro tipo. */
  dedicado: boolean;
  onChange: (p: Partial<FichaExercise>) => void;
  t: T;
}) {
  const { lang } = useI18n();
  const figuras = ex.fracciones ?? [];
  const max = dedicado ? MAX_DEDICADO : MAX_AMBIENTE;
  const modo: ModoFracciones = ex.modo ?? 'leer';
  const decimalPosible = figuras.length > 0 && figuras.every(tieneDecimalExacto);

  /** Aplica el cambio y, en el ejercicio «fracciones», recalcula la solución con los nuevos números. */
  const aplicar = (p: Partial<FichaExercise>) => {
    const siguiente = { ...ex, ...p };
    if (siguiente.decimal && (siguiente.modo === 'colorear' || !(siguiente.fracciones ?? []).every(tieneDecimalExacto))) siguiente.decimal = false;
    onChange(dedicado ? { ...p, decimal: siguiente.decimal, solucion: solucionFracciones(siguiente, lang) } : p);
  };
  const cambiar = (i: number, p: Partial<FraccionDibujo>) => {
    const f = { ...figuras[i], ...p };
    f.tomadas = Math.min(f.tomadas, f.partes);
    aplicar({ fracciones: figuras.map((x, k) => (k === i ? f : x)) });
  };
  const quitar = (i: number) => aplicar({ fracciones: figuras.filter((_, k) => k !== i) });
  const anadir = () => {
    // La siguiente con un número de trozos que aún no esté, para que no salgan todas iguales
    const usados = new Set(figuras.map(f => f.partes));
    const partes = [4, 8, 5, 6, 3, 10, 2, 9, 7, 12, 11].find(n => !usados.has(n)) ?? 8;
    aplicar({ fracciones: [...figuras, { partes, tomadas: Math.max(1, Math.floor(partes / 3)) }] });
  };

  return (
    <div className="fe-fr">
      <span className="fe-lbl">{t(dedicado ? 'Pizzas y tartas' : 'Pizzas del enunciado')}</span>
      {dedicado && (
        <div className="fe-fr-fila">
          <select className="finput" value={modo} aria-label={t('Qué se hace')} onChange={e => aplicar({ modo: e.target.value as ModoFracciones })}>
            {MODOS_FRACCIONES.map(m => <option key={m} value={m}>{t(MODO_LABEL[m])}</option>)}
          </select>
          {modo !== 'colorear' && (
            <label className="fe-fr-chk" title={t('Solo con 2, 4, 5, 8 o 10 trozos')}>
              <input type="checkbox" checked={!!ex.decimal && decimalPosible} disabled={!decimalPosible} onChange={e => aplicar({ decimal: e.target.checked })} />
              {t('Pedir también el decimal')}
            </label>
          )}
        </div>
      )}
      <div className="fe-fr-fila">
        <select className="finput" value={ex.cogidos ?? 'ambos'} aria-label={t('Trozos cogidos')} onChange={e => aplicar({ cogidos: e.target.value as CogidosFraccion })}>
          {COGIDOS_FRACCION.map(c => <option key={c} value={c}>{t(COGIDOS_LABEL[c])}</option>)}
        </select>
      </div>
      <div className="fe-fr-lista">
        {figuras.map((f, i) => (
          <div className="fe-fr-fig" key={i}>
            <span
              className="fe-fr-svg" aria-hidden="true"
              // Lo genera `fraccionSvg` con enteros ya acotados: nunca hay texto del docente ni de la IA dentro
              dangerouslySetInnerHTML={{ __html: fraccionSvg(f, { cogidos: ex.cogidos, vacia: dedicado && modo === 'colorear', uid: `${uid}-${i}` }) }}
            />
            <select className="finput" value={f.objeto ?? 'pizza'} aria-label={t('Qué es')} onChange={e => cambiar(i, { objeto: e.target.value as ObjetoFraccion })}>
              {OBJETOS_FRACCION.map(o => <option key={o} value={o}>{t(OBJETO_LABEL[o])}</option>)}
            </select>
            <label className="fe-fr-num"><span>{t('Trozos')}</span>
              <input className="finput" type="number" min={MIN_PARTES} max={MAX_PARTES} value={f.partes} onChange={e => cambiar(i, { partes: entre(e.target.value, MIN_PARTES, MAX_PARTES, f.partes) })} />
            </label>
            <label className="fe-fr-num"><span>{t('Cogidos')}</span>
              <input className="finput" type="number" min={0} max={f.partes} value={f.tomadas} onChange={e => cambiar(i, { tomadas: entre(e.target.value, 0, f.partes, f.tomadas) })} />
            </label>
            <button type="button" className="ico-btn sm" title={t('Quitar')} aria-label={t('Quitar')} onClick={() => quitar(i)}><Trash2 size={14} color="var(--danger)" /></button>
          </div>
        ))}
      </div>
      {figuras.length < max && (
        <button type="button" className="chip sm" onClick={anadir}><Plus size={12} />{t('Añadir una pizza')}</button>
      )}
    </div>
  );
}
