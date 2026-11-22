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
import { BIEN, MEJORABLE, cuentaRegistro, notaRegistro, ultimaValoracion, yaGuardado } from '../lib/registro';
import { EN_FRASE, mismaEvaluacion, periodoDeFecha, periodoDeHoy } from '../lib/periodos';
import { compararAlumnos } from '../lib/alumnado';
import { isoDate } from '../lib/utils';
import { useClaseActiva } from '../hooks/useClaseActiva';

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

  const [hoy] = useState(() => isoDate());

  /** Lo que ya se valoró la última vez, para seguir desde ahí. */
  function previas(alumnos: Student[]): Marcas {
    const m: Marcas = {};
    for (const s of alumnos) {
      const ultima = ultimaValoracion(evaluations, escala.id, s.id);
      if (ultima) m[s.id] = { ...ultima.scores };
    }
    return m;
  }

  // La clase pedida por quien abre la ventana (la de la sesión) o, entre las de la escala, la de la regla
  // común: la de ahora, la última con la que se trabajó o la primera (`useClaseActiva`)
  const [claseId, setClaseId] = useClaseActiva(clasesEval, claseInicial);
  const [marcas, setMarcas] = useState<Marcas>(() => previas(students.filter(s => s.class_id === claseId)));
  const alumnado = useMemo(() => students.filter(s => s.class_id === claseId).sort(compararAlumnos), [students, claseId]);

  function cambiarClase(id: string) {
    setClaseId(id);
    setMarcas(previas(students.filter(s => s.class_id === id)));
    setEnBlanco(false);
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

  /**
   * La evaluación del curso de la que viene lo ya valorado, si no es la de hoy (20-11-2026): la columna del
   * cuaderno y lo que cuenta el acta son por evaluación, así que al guardar se guarda también a quien no
   * cambia, y se dice antes. Quien prefiera valorar de nuevo puede empezar en blanco.
   */
  const deOtra = useMemo(() => {
    for (const s of alumnado) {
      const ultima = ultimaValoracion(evaluations, escala.id, s.id);
      if (ultima && !mismaEvaluacion(ultima.date, hoy)) return periodoDeFecha(ultima.date, hoy) ?? 'otro curso';
    }
    return null;
  }, [alumnado, evaluations, escala.id, hoy]);
  const [enBlanco, setEnBlanco] = useState(false);

  function guardarEvaluacion() {
    // Lo que ya estaba guardado en esta evaluación del curso: quien no cambia no vuelve a guardarse
    // (19-11-2026; antes cada «Guardar» creaba otra evaluación por alumno aunque no se hubiera tocado nada,
    // y el Historial se llenaba de copias). Lo de otra evaluación sí se guarda: `yaGuardado`
    let n = 0, iguales = 0;
    for (const s of alumnado) {
      const scores = marcas[s.id] ?? {};
      const valorados = escala.items.filter(i => scores[i.id] === BIEN || scores[i.id] === MEJORABLE);
      if (valorados.length === 0) continue;
      const lim: Record<string, number> = {};
      valorados.forEach(i => { lim[i.id] = scores[i.id]; });
      if (yaGuardado(ultimaValoracion(evaluations, escala.id, s.id), lim, hoy)) { iguales++; continue; }
      onAddEvaluation({
        id: 'ev' + uid(), rubric_id: escala.id, rubric_name: escala.name,
        student_id: s.id, student_name: s.name, class_id: claseId, date: hoy,
        scores: lim, notes: '', instrument: 'diana', max_level: BIEN,
        grade: notaRegistro(escala.items, lim) ?? undefined,
      });
      n++;
    }
    if (n === 0 && iguales > 0) { toast(t('No has cambiado ninguna valoración')); onClose(); return; }
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
      {deOtra && !enBlanco && (
        <p className="reg-ayuda reg-otra" role="status">
          {deOtra === 'otro curso'
            ? t('Lo marcado viene de otro curso. Lo que guardes ahora cuenta en {actual}, con su propia nota: se guardará también a quien no cambies.', { actual: t(EN_FRASE[periodoDeHoy(hoy)]) })
            : t('Lo marcado viene de {anterior}. Lo que guardes ahora cuenta en {actual}, con su propia nota: se guardará también a quien no cambies.', { anterior: t(EN_FRASE[deOtra]), actual: t(EN_FRASE[periodoDeHoy(hoy)]) })}
          {' '}
          <button type="button" className="ev-enlace" onClick={() => { setMarcas({}); setEnBlanco(true); }}>{t('Empezar en blanco')}</button>
        </p>
      )}
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
