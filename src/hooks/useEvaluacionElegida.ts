import { useCallback, useMemo, useState } from 'react';
import { isoDate } from '../lib/utils';
import {
  conVecinos, cuentaEn, guardarPeriodoElegido, guardarRangos, periodoDeHoy, periodoElegido, rangoDe, rangosGuardados,
  type RangoDeFechas,
} from '../lib/periodos';

/**
 * La evaluación que se está viendo («1.ª · 2.ª · 3.ª · Curso») y sus fechas (20-11-2026). Es la misma en el
 * cuaderno y en las actas: se elige en una pantalla y la otra se abre en ella (`lib/periodos.ts`; se recuerda
 * en el dispositivo). Una pantalla nueva que dependa de la evaluación usa este hook y `SelectorEvaluacion`,
 * no su propio desplegable: así no hay dos nociones de evaluación.
 */
export interface EvaluacionElegida {
  hoy: string;
  /** Uno de `PERIODS`: «1ª evaluación», «2ª evaluación», «3ª evaluación» o «Final de curso». */
  periodo: string;
  elegir: (periodo: string) => void;
  /** La evaluación en la que cae hoy. */
  deHoy: string;
  /** Las fechas que el docente cambió, por evaluación. */
  rangos: Record<string, RangoDeFechas>;
  /** Las fechas de la evaluación elegida; `null` en «Final de curso». */
  rango: RangoDeFechas | null;
  /** Cambia las fechas de la evaluación elegida; las vecinas se ajustan para no dejar días en medio. */
  cambiarRango: (rango: RangoDeFechas) => void;
  /** Si algo con esa fecha cuenta en la evaluación elegida. */
  cuenta: (fecha: string | undefined | null) => boolean;
}

export function useEvaluacionElegida(): EvaluacionElegida {
  const [hoy] = useState(() => isoDate());
  const [rangos, setRangos] = useState(() => rangosGuardados(hoy));
  const [periodo, setPeriodo] = useState(() => periodoElegido(hoy));

  const elegir = useCallback((p: string) => {
    guardarPeriodoElegido(p, hoy);
    setPeriodo(p);
  }, [hoy]);

  const cambiarRango = useCallback((r: RangoDeFechas) => {
    if (!r.desde || !r.hasta || r.desde > r.hasta) return;
    const nuevos = conVecinos(periodo, r, hoy, rangos);
    guardarRangos(nuevos, hoy);
    setRangos(nuevos);
  }, [periodo, hoy, rangos]);

  return useMemo(() => ({
    hoy, periodo, elegir, rangos, cambiarRango,
    deHoy: periodoDeHoy(hoy, rangos),
    rango: rangoDe(periodo, hoy, rangos),
    cuenta: (fecha: string | undefined | null) => cuentaEn(fecha, periodo, hoy, rangos),
  }), [hoy, periodo, elegir, rangos, cambiarRango]);
}
