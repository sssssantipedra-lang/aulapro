/**
 * «Desde un modelo» (20-11-2026): la lista de rúbricas o de escalas de registro ya escritas (`lib/modelosInstrumentos.ts`)
 * que se enseña al crear un instrumento. Cada tarjeta dice qué es, para qué sirve y de qué habla, deja ver los
 * descriptores antes de elegir y «Usar y adaptar» rellena el editor de siempre. Aquí no hay IA.
 */
import { useState, type ReactNode } from 'react';
import { ChevronDown, FilePenLine } from 'lucide-react';
import { useI18n } from '../../i18n';
import type { EtapaModelo, ResumenDeModelo } from '../../lib/modelosInstrumentos';

interface Props {
  modelos: ResumenDeModelo[];
  onUsar: (id: string) => void;
  /** Hay algo escrito en el editor que el modelo va a sustituir: se pregunta antes. */
  avisar?: boolean;
  /** Lo que se enseña al abrir «Ver los descriptores» (las rúbricas; una escala ya enseña sus conceptos). */
  detalle?: (id: string) => ReactNode;
  /** La etapa elegida, para decir en cada tarjeta para cuál está escrita la versión que se va a usar. */
  etapa?: EtapaModelo;
}

export function ModelosDeInstrumento({ modelos, onUsar, avisar = false, detalle, etapa }: Props) {
  const { t } = useI18n();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aConfirmar, setAConfirmar] = useState<string | null>(null);

  const usar = (id: string) => {
    if (avisar && aConfirmar !== id) { setAConfirmar(id); return; }
    setAConfirmar(null);
    onUsar(id);
  };

  return (
    <ul className="mi-lista">
      {modelos.map(m => {
        const abiertoEste = abierto === m.id;
        return (
          <li key={m.id} className={`mi-tarjeta${abiertoEste ? ' abierta' : ''}`} data-modelo={m.id}>
            <div className="mi-tit">
              <strong>{m.nombre}</strong>
              {m.ambito === 'ef' && <span className="mi-chip ef">{t('Educación Física')}</span>}
              {etapa && (
                <span className="mi-chip">{m.cambiaConLaEtapa ? t(etapa === 'primaria' ? 'Versión de Primaria' : 'Versión de ESO') : t('Primaria y ESO')}</span>
              )}
            </div>
            <p className="mi-uso">{m.uso}</p>
            <p className="mi-partes">{m.partes.join(' · ')}</p>
            {aConfirmar === m.id ? (
              <div className="mi-aviso" role="alert">
                <span>{t('Sustituirá lo que ya tienes escrito.')}</span>
                <button type="button" className="btn-accent" onClick={() => usar(m.id)}>{t('Sustituir')}</button>
                <button type="button" className="btn-ghost" onClick={() => setAConfirmar(null)}>{t('Cancelar')}</button>
              </div>
            ) : (
              <div className="mi-acc">
                {detalle && (
                  <button type="button" className="mi-ver" aria-expanded={abiertoEste} onClick={() => setAbierto(abiertoEste ? null : m.id)}>
                    <ChevronDown size={14} aria-hidden="true" />{t(abiertoEste ? 'Ocultar los descriptores' : 'Ver los descriptores')}
                  </button>
                )}
                <button type="button" className="btn-accent mi-usar" onClick={() => usar(m.id)} aria-label={t('Usar y adaptar «{nombre}»', { nombre: m.nombre })}>
                  <FilePenLine size={14} aria-hidden="true" />{t('Usar y adaptar')}
                </button>
              </div>
            )}
            {detalle && abiertoEste && <div className="mi-detalle">{detalle(m.id)}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/** Primaria o ESO: en los modelos que cambian con la etapa, qué versión se enseña y se usa. */
export function EtapaDeModelos({ etapa, onEtapa }: { etapa: EtapaModelo; onEtapa: (e: EtapaModelo) => void }) {
  const { t } = useI18n();
  return (
    <div className="mi-etapa" role="group" aria-label={t('Etapa de los modelos')}>
      {(['primaria', 'eso'] as const).map(e => (
        <button key={e} type="button" className={etapa === e ? 'sel' : ''} aria-pressed={etapa === e} onClick={() => onEtapa(e)}>
          {t(e === 'primaria' ? 'Primaria' : 'ESO')}
        </button>
      ))}
    </div>
  );
}

/** Los criterios de una rúbrica modelo con el descriptor de cada nivel, para verlos antes de elegirla. */
export function DescriptoresDeModelo({ criterios, niveles }: {
  criterios: { name: string; descriptors: Record<number, string> }[];
  niveles: { value: number; label: string }[];
}) {
  return (
    <div className="mi-criterios">
      {criterios.map((c, i) => (
        <div key={c.name} className="mi-criterio">
          <div className="mi-criterio-nombre">{i + 1}. {c.name}</div>
          <div className="mi-niveles">
            {niveles.map(n => (
              <div key={n.value} className="mi-nivel">
                <span>{n.label}</span>
                {c.descriptors[n.value] ?? ''}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
