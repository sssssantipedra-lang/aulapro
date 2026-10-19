/**
 * Valorar a una clase entera con una escala de registro: una tabla con un
 * pulgar arriba (bien hecho) y uno abajo (mejorable) por alumno y concepto.
 * La usan la pestaña «Escalas de registro» de Evaluar y las sesiones de EF
 * (donde se valora la clase sin salir de la sesión). Ver `lib/registro.ts`.
 */
import { useMemo, useState } from 'react';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import type { Class, EvalDiana, Evaluation, Student } from '../types';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import { useI18n } from '../i18n';
import { clasesDe, objetivoPara } from '../lib/objetivos';
import { BIEN, MEJORABLE, cuentaRegistro, notaRegistro } from '../lib/registro';
import { compararAlumnos } from '../lib/alumnado';
import { isoDate } from '../lib/utils';

interface Props {
  escala: EvalDiana;
  classes: Class[];
  students: Student[];
  evaluations: Evaluation[];
  /** La clase con la que se abre (la de la sesión, por ejemplo); si no está entre las de la escala, la primera. */
  claseInicial?: string;
  onAddEvaluation: (ev: Evaluation) => void;
  onClose: () => void;
}

type Marcas = Record<string, Record<string, number>>;

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export function ValorarRegistro({ escala, classes, students, evaluations, claseInicial, onAddEvaluation, onClose }: Props) {
  const { t, locale } = useI18n();
  const { toast } = useToast();

  const clasesEval = clasesDe(escala).length ? classes.filter(c => clasesDe(escala).includes(c.id)) : classes;

  /** Lo que ya se valoró la última vez, para seguir desde ahí. */
  function previas(alumnos: Student[]): Marcas {
    const m: Marcas = {};
    for (const s of alumnos) {
      const ultima = evaluations.filter(e => e.rubric_id === escala.id && e.student_id === s.id).sort((a, b) => b.date.localeCompare(a.date))[0];
      if (ultima) m[s.id] = { ...ultima.scores };
    }
    return m;
  }

  const [claseId, setClaseId] = useState(() =>
    (claseInicial && clasesEval.some(c => c.id === claseInicial) ? claseInicial : clasesEval[0]?.id) ?? '');
  const [marcas, setMarcas] = useState<Marcas>(() => previas(students.filter(s => s.class_id === claseId)));
  const alumnado = useMemo(() => students.filter(s => s.class_id === claseId).sort(compararAlumnos), [students, claseId]);

  function cambiarClase(id: string) {
    setClaseId(id);
    setMarcas(previas(students.filter(s => s.class_id === id)));
  }

  /** Pulsar el pulgar que ya está puesto lo quita. */
  function marcar(alumnoId: string, itemId: string, v: number) {
    setMarcas(prev => {
      const del = { ...(prev[alumnoId] ?? {}) };
      if (del[itemId] === v) delete del[itemId]; else del[itemId] = v;
      return { ...prev, [alumnoId]: del };
    });
  }

  function marcarTodos(itemId: string, v: number) {
    setMarcas(prev => {
      const next: Marcas = { ...prev };
      for (const s of alumnado) next[s.id] = { ...(next[s.id] ?? {}), [itemId]: v };
      return next;
    });
  }

  function guardarEvaluacion() {
    const hoy = isoDate();
    let n = 0;
    for (const s of alumnado) {
      const scores = marcas[s.id] ?? {};
      const valorados = escala.items.filter(i => scores[i.id] === BIEN || scores[i.id] === MEJORABLE);
      if (valorados.length === 0) continue;
      const lim: Record<string, number> = {};
      valorados.forEach(i => { lim[i.id] = scores[i.id]; });
      onAddEvaluation({
        id: 'ev' + uid(), rubric_id: escala.id, rubric_name: escala.name,
        student_id: s.id, student_name: s.name, class_id: claseId, date: hoy,
        scores: lim, notes: '', instrument: 'diana', max_level: BIEN,
        grade: notaRegistro(escala.items, lim) ?? undefined,
      });
      n++;
    }
    if (n === 0) { toast(t('Marca algún pulgar antes de guardar')); return; }
    toast(t(n === 1 ? '✅ Guardada la valoración de {n} alumno' : '✅ Guardada la valoración de {n} alumnos', { n }));
    onClose();
  }

  const total = escala.items.length;

  return (
    <Modal open onClose={onClose} wide title={escala.name}>
      <div className="frow" style={{ marginBottom: 12 }}>
        <div className="fgroup" style={{ marginBottom: 0 }}>
          <label className="flabel" htmlFor="reg-clase">{t('Clase')}</label>
          <select id="reg-clase" className="finput" value={claseId} onChange={e => cambiarClase(e.target.value)}>
            {clasesEval.map(c => <option key={c.id} value={c.id}>{c.name} – {objetivoPara(escala, c.id)?.subject || c.subject}</option>)}
          </select>
        </div>
      </div>
      <p className="reg-ayuda">
        <ThumbsUp size={13} /> {t('Bien hecho')} · <ThumbsDown size={13} /> {t('Mejorable')} · {t('pulsa otra vez para quitarlo')}
      </p>
      {alumnado.length === 0 ? (
        <p className="ap-vacio">{t('Esa clase todavía no tiene alumnos.')}</p>
      ) : (
        <div className="reg-tabla-wrap">
          <table className="reg-tabla">
            <thead>
              <tr>
                <th scope="col">{t('Alumno')}</th>
                {escala.items.map(i => (
                  <th key={i.id} scope="col">
                    <div className="reg-th">{i.name}</div>
                    <div className="reg-todos">
                      <button type="button" title={t('Bien hecho a toda la clase')} aria-label={t('Bien hecho a toda la clase: {nombre}', { nombre: i.name })} onClick={() => marcarTodos(i.id, BIEN)}><ThumbsUp size={12} /></button>
                    </div>
                  </th>
                ))}
                {total > 1 && <th scope="col">{t('Nota')}</th>}
              </tr>
            </thead>
            <tbody>
              {alumnado.map(s => {
                const m = marcas[s.id] ?? {};
                const nota = notaRegistro(escala.items, m);
                const { bien, mejorable } = cuentaRegistro(m, escala.items.map(i => i.id));
                return (
                  <tr key={s.id}>
                    <th scope="row" className="reg-alumno">{s.name}</th>
                    {escala.items.map(i => (
                      <td key={i.id}>
                        <span className="reg-pulgares">
                          <button type="button" className={`reg-pulgar bien${m[i.id] === BIEN ? ' on' : ''}`} aria-pressed={m[i.id] === BIEN}
                            aria-label={t('{alumno}, {concepto}: bien hecho', { alumno: s.name, concepto: i.name })} onClick={() => marcar(s.id, i.id, BIEN)}>
                            <ThumbsUp size={17} />
                          </button>
                          <button type="button" className={`reg-pulgar mejorable${m[i.id] === MEJORABLE ? ' on' : ''}`} aria-pressed={m[i.id] === MEJORABLE}
                            aria-label={t('{alumno}, {concepto}: mejorable', { alumno: s.name, concepto: i.name })} onClick={() => marcar(s.id, i.id, MEJORABLE)}>
                            <ThumbsDown size={17} />
                          </button>
                        </span>
                      </td>
                    ))}
                    {total > 1 && (
                      <td className="reg-nota" title={t('{bien} bien hechos y {mejorable} mejorables', { bien, mejorable })}>
                        {nota === null ? '—' : nota.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {escala.class_id && escala.category_id && (
        <p className="reg-ayuda" style={{ marginTop: 10 }}><Check size={13} /> {t('La nota va a la columna de esta escala en el cuaderno de la clase.')}</p>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn-accent" onClick={guardarEvaluacion} disabled={alumnado.length === 0}>{t('Guardar valoración')}</button>
        <button className="btn-ghost" onClick={onClose}>{t('Cancelar')}</button>
      </div>
    </Modal>
  );
}
