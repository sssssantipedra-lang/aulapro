import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import type { Etapa } from '../lib/curriculum';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import {
  cargarCurriculo, curriculoEstatal, tieneCurriculoPropio, type CurriculoActivo,
} from '../lib/curriculum/cargar';

/**
 * El currículo que corresponde a la comunidad del perfil para una etapa, para
 * las pantallas. Sin etapa, `null`. Si la comunidad no tiene decreto propio,
 * el estatal está disponible al momento (no hay que esperar ni parpadear); si
 * lo tiene, `null` mientras se abre su archivo. Sin comunidad, como «Fuera de
 * España»: el estatal.
 */
export function useCurriculo(comunidad: ComunidadId | undefined, etapa: Etapa | '' | undefined): CurriculoActivo | null {
  const { lang } = useI18n();
  const id = comunidad ?? 'fuera';
  const propio = !!etapa && tieneCurriculoPropio(id, etapa);
  const estatal = useMemo(() => (etapa && !propio ? curriculoEstatal(id, etapa) : null), [id, etapa, propio]);
  const [abierto, setAbierto] = useState<CurriculoActivo | null>(null);

  useEffect(() => {
    if (!etapa || !propio) return;
    let vigente = true;
    cargarCurriculo(id, etapa, lang).then(c => { if (vigente) setAbierto(c); });
    return () => { vigente = false; };
  }, [id, etapa, propio, lang]);

  if (!etapa) return null;
  if (!propio) return estatal;
  // Lo abierto antes para otra comunidad o etapa no vale mientras llega lo nuevo
  return abierto && abierto.comunidad === id && abierto.etapa === etapa ? abierto : null;
}

/** «5º de Primaria», «3º de ESO», en el idioma de la app. */
export function useNivelTexto() {
  const { t } = useI18n();
  return (e: Etapa, c: number) => (e === 'primaria'
    ? t('{curso}º de Primaria', { curso: c })
    : t('{curso}º de ESO', { curso: c }));
}
