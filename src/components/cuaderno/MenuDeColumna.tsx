/**
 * El menú de una columna del cuaderno (22-11-2026): se abre al pulsar el nombre de la actividad. Desde aquí se
 * califica en lista («Calificar esta actividad»), se pone una nota a quien no tiene y se edita o se elimina la
 * actividad (lo que antes hacía el clic en la cabecera).
 */
import { useState } from 'react';
import { ListChecks, Pencil } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n';
import { leerNota, sinNota } from '../../lib/pegarNotas';
import type { GradeItem, Student } from '../../types';

interface Props {
  item: GradeItem;
  /** El nombre de su categoría y su fecha ya escrita, para la línea de debajo del título. */
  detalle: string;
  alumnado: Student[];
  notas: Record<string, number | null> | undefined;
  onCalificar: () => void;
  onEditar: () => void;
  /** Pone `valor` a quien no tiene nota en la actividad. */
  onRellenar: (valor: number) => void;
  onClose: () => void;
}

export function MenuDeColumna({ item, detalle, alumnado, notas, onCalificar, onEditar, onRellenar, onClose }: Props) {
  const { t } = useI18n();
  const [texto, setTexto] = useState('');
  const [error, setError] = useState(false);
  const faltan = sinNota(alumnado, notas);
  const uno = faltan.length === 1;
  const nombres = faltan.length > 4
    ? `${faltan.slice(0, 4).map(s => s.name).join(', ')} ${t('y {n} más', { n: faltan.length - 4 })}`
    : faltan.map(s => s.name).join(', ');

  function rellenar() {
    const leida = leerNota(texto);
    if (leida.tipo !== 'nota') { setError(true); return; }
    onRellenar(leida.valor);
  }

  return (
    <Modal open onClose={onClose} title={item.name}>
      <div className="pn-menu">
        <p className="pn-menu-detalle">
          {detalle} · {t('{n} de {total} con nota', { n: alumnado.length - faltan.length, total: alumnado.length })}
        </p>

        <button type="button" className="pn-menu-btn principal" onClick={onCalificar}>
          <ListChecks size={18} aria-hidden="true" />
          <span>
            <strong>{t('Calificar esta actividad')}</strong>
            <small>{t('El alumnado en una lista, con una casilla grande para cada nota.')}</small>
          </span>
        </button>

        <div className="pn-rellenar">
          <label className="flabel" htmlFor="pn-rellenar-nota">{t('Poner una nota a quien no tiene')}</label>
          {faltan.length === 0 ? (
            <p className="sda-note">{t('Toda la clase tiene nota en esta actividad.')}</p>
          ) : (
            <>
              <div className="pn-rellenar-fila">
                <input
                  id="pn-rellenar-nota" className="finput" inputMode="decimal" enterKeyHint="done" autoComplete="off"
                  value={texto} placeholder={t('Nota')} aria-invalid={error} aria-describedby="pn-rellenar-ayuda"
                  onChange={e => { setTexto(e.target.value); setError(false); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); rellenar(); } }}
                />
                <button type="button" className="btn-accent" onClick={rellenar} disabled={texto.trim() === ''}>
                  {t(uno ? 'Poner a 1 alumno' : 'Poner a {n} alumnos', { n: faltan.length })}
                </button>
              </div>
              {error && <p className="pn-error" role="alert">{t('Escribe una nota de 0 a 10.')}</p>}
              <p className="sda-note" id="pn-rellenar-ayuda">
                {t('Sin nota: {nombres}.', { nombres })} {t('Las notas que ya están no se tocan, y se puede deshacer.')}
              </p>
            </>
          )}
        </div>

        <button type="button" className="pn-menu-btn" onClick={onEditar}>
          <Pencil size={16} aria-hidden="true" />
          <span><strong>{t('Editar o eliminar esta actividad')}</strong><small>{t('Nombre, categoría, fecha y cuánto cuenta.')}</small></span>
        </button>
      </div>
    </Modal>
  );
}
