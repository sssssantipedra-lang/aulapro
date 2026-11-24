/**
 * Corregir desde el Historial la valoración de un alumno con una escala de registro (20-11-2026): los
 * conceptos con sus dos pulgares y lo que se marcó; al guardar se actualiza esa evaluación, no se crea otra.
 * Las rúbricas y las dianas se corrigen con su propia ventana (`EvalModal`, `DianaEvalModal`).
 */
import { useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import type { EvalDiana, Evaluation } from '../../types';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { useI18n } from '../../i18n';
import { BIEN, MEJORABLE, notaRegistro } from '../../lib/registro';
import { fromIsoDate } from '../../lib/utils';
import { mismasMarcas } from '../../lib/evaluarClase';

interface Props {
  escala: EvalDiana;
  evaluacion: Evaluation;
  onGuardar: (ev: Evaluation) => void;
  onClose: () => void;
}

export function CorregirRegistro({ escala, evaluacion, onGuardar, onClose }: Props) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [marcas, setMarcas] = useState<Record<string, number>>(() => ({ ...evaluacion.scores }));

  /** Pulsar el pulgar que ya está puesto lo quita. */
  function marcar(itemId: string, v: number) {
    setMarcas(prev => {
      const next = { ...prev };
      if (next[itemId] === v) delete next[itemId]; else next[itemId] = v;
      return next;
    });
  }

  const valorados = escala.items.filter(i => marcas[i.id] === BIEN || marcas[i.id] === MEJORABLE).length;
  const igual = mismasMarcas({ scores: marcas, notes: '' }, { scores: evaluacion.scores, notes: '' });
  const nota = notaRegistro(escala.items, marcas);

  function guardar() {
    onGuardar({ ...evaluacion, scores: marcas, max_level: BIEN, grade: nota ?? undefined });
    toast(t('✅ Valoración de {name} corregida', { name: evaluacion.student_name }));
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={escala.name}>
      <p className="evc-corrigiendo">
        {t('Corrigiendo la evaluación de')} <strong>{evaluacion.student_name}</strong> · {fromIsoDate(evaluacion.date).toLocaleDateString(locale)}
      </p>
      <p className="evc-aviso">{t('Al guardar se actualiza esta evaluación, no se crea otra.')}</p>
      <ul className="evc-registro">
        {escala.items.map(i => (
          <li key={i.id}>
            <span>{i.name}</span>
            <span className="reg-pulgares">
              <button type="button" className={`reg-pulgar bien${marcas[i.id] === BIEN ? ' on' : ''}`} aria-pressed={marcas[i.id] === BIEN}
                aria-label={t('{alumno}, {concepto}: bien hecho', { alumno: evaluacion.student_name, concepto: i.name })} onClick={() => marcar(i.id, BIEN)}>
                <ThumbsUp size={17} />
              </button>
              <button type="button" className={`reg-pulgar mejorable${marcas[i.id] === MEJORABLE ? ' on' : ''}`} aria-pressed={marcas[i.id] === MEJORABLE}
                aria-label={t('{alumno}, {concepto}: mejorable', { alumno: evaluacion.student_name, concepto: i.name })} onClick={() => marcar(i.id, MEJORABLE)}>
                <ThumbsDown size={17} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="evc-pie evc-pie-suelto">
        <div className="evc-pie-dato">
          {nota !== null && <>
            <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{t('Nota')}</span>
            <span className="score-pill">{nota.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
          </>}
        </div>
        <div className="evc-pie-btns">
          <button type="button" className="btn-ghost" onClick={onClose}>{t('Cancelar')}</button>
          <button type="button" className="btn-accent" disabled={igual || valorados === 0} onClick={guardar}>{t('Guardar cambios')}</button>
        </div>
      </div>
    </Modal>
  );
}
