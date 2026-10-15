/**
 * El recuadro lateral de un bloque (diseño «Cuaderno»): «Recuerda», «Reto» o
 * «Consejo». Sin tipo, el bloque no lleva recuadro. «Recuerda» admite además
 * una lista de equivalencias («CM = centena de millar»), una por línea.
 */
import type { FichaRecuadro, FichaRecuadroTipo } from '../../services/resources';
import { LinesField } from './ExerciseEditor';

type T = (k: string, v?: Record<string, string | number>) => string;

const OPCIONES: { id: FichaRecuadroTipo; emoji: string; label: string }[] = [
  { id: 'recuerda', emoji: '📌', label: 'Recuerda' },
  { id: 'reto', emoji: '⭐', label: 'Reto' },
  { id: 'consejo', emoji: '💡', label: 'Consejo' },
];

interface Props {
  recuadro: FichaRecuadro | undefined;
  onChange: (r: FichaRecuadro | undefined) => void;
  t: T;
}

export function RecuadroEditor({ recuadro, onChange, t }: Props) {
  return (
    <div className="fe-recuadro">
      <label className="fe-field">
        <span className="fe-lbl">{t('Recuadro del bloque')}</span>
        <select
          className="finput" value={recuadro?.tipo ?? ''} aria-label={t('Recuadro del bloque')}
          onChange={e => {
            const tipo = e.target.value as FichaRecuadroTipo | '';
            onChange(tipo ? { ...recuadro, tipo, texto: recuadro?.texto ?? '' } : undefined);
          }}
        >
          <option value="">{t('Ninguno')}</option>
          {OPCIONES.map(o => <option key={o.id} value={o.id}>{o.emoji} {t(o.label)}</option>)}
        </select>
      </label>
      {recuadro && (
        <>
          <label className="fe-field">
            <span className="fe-lbl">{t(recuadro.tipo === 'reto' ? 'La pregunta del reto' : 'Texto')}</span>
            <textarea
              className="finput" rows={2} value={recuadro.texto} aria-label={t('Texto del recuadro')}
              onChange={e => onChange({ ...recuadro, texto: e.target.value })}
            />
          </label>
          {recuadro.tipo === 'recuerda' && (
            <LinesField
              label={t('Lista')} hint={t('una por línea, «SIGLA = significado»')}
              value={recuadro.lista ?? []} onCommit={v => onChange({ ...recuadro, lista: v })}
            />
          )}
        </>
      )}
    </div>
  );
}
