/**
 * Escalas de registro (Evaluar › «Escalas de registro», petición del dueño,
 * 19-10-2026): se elige un concepto concreto (o varios) y, por cada alumno,
 * un pulgar arriba (bien hecho) o un pulgar abajo (mejorable). Rápido, de
 * una clase entera en una sola tabla. La nota sale de los pulgares arriba y,
 * como en rúbricas y dianas, puede ir al cuaderno de una o de varias clases.
 * Ver `lib/registro.ts`.
 */
import { useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Copy, ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import type { Class, EvalDiana, Evaluation, GradeCategory, GradeTarget, Student } from '../types';
import { GradeTargetsPicker } from '../components/GradeTargetPicker';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';
import { clasesDe, conObjetivos, objetivoPara } from '../lib/objetivos';
import { BIEN, MEJORABLE, NIVELES_REGISTRO, cuentaRegistro, esRegistro, notaRegistro } from '../lib/registro';
import { compararAlumnos } from '../lib/alumnado';
import { isoDate } from '../lib/utils';

interface Props {
  dianas: EvalDiana[];
  evaluations: Evaluation[];
  classes: Class[];
  students: Student[];
  gradeCategories: GradeCategory[];
  onAddDiana: (d: EvalDiana) => void;
  onUpdateDiana: (d: EvalDiana) => void;
  onDeleteDiana: (id: string) => void;
  onAddEvaluation: (ev: Evaluation) => void;
}

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

type Marcas = Record<string, Record<string, number>>;

export function EscalasRegistro({
  dianas, evaluations, classes, students, gradeCategories, onAddDiana, onUpdateDiana, onDeleteDiana, onAddEvaluation,
}: Props) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const escalas = useMemo(() => dianas.filter(esRegistro), [dianas]);

  /* ── Crear y editar ── */
  const [editando, setEditando] = useState<EvalDiana | null>(null);
  const [esNueva, setEsNueva] = useState(false);
  const [aBorrar, setABorrar] = useState<EvalDiana | null>(null);

  function nueva() {
    setEsNueva(true);
    setEditando({ id: 'reg' + uid(), tipo: 'registro', name: '', items: [{ id: 'it' + uid(), name: '', weight: 1 }], levels: NIVELES_REGISTRO });
  }

  function guardar() {
    if (!editando) return;
    const nombre = editando.name.trim();
    const items = editando.items.filter(i => i.name.trim()).map(i => ({ ...i, name: i.name.trim() }));
    if (!nombre) { toast(t('Ponle un nombre a la escala')); return; }
    if (items.length === 0) { toast(t('Escribe al menos un concepto que se valore')); return; }
    const e = conObjetivos({ ...editando, name: nombre, items });
    if (esNueva) { onAddDiana(e); toast(t('✅ Escala de registro creada')); }
    else { onUpdateDiana(e); toast(t('✅ Escala actualizada')); }
    setEditando(null);
  }

  function duplicar(d: EvalDiana) {
    onAddDiana({ ...d, id: 'reg' + uid(), name: `${d.name} (${t('copia')})`, items: d.items.map(i => ({ ...i, id: 'it' + uid() })) });
    toast(t('✅ Escala duplicada, con su propia columna en el cuaderno'));
  }

  /* ── Evaluar ── */
  const [evaluando, setEvaluando] = useState<EvalDiana | null>(null);
  const [claseId, setClaseId] = useState('');
  const [marcas, setMarcas] = useState<Marcas>({});

  const clasesEval = evaluando
    ? (clasesDe(evaluando).length ? classes.filter(c => clasesDe(evaluando).includes(c.id)) : classes)
    : [];
  const alumnado = useMemo(() => students.filter(s => s.class_id === claseId).sort(compararAlumnos), [students, claseId]);

  /** Lo que ya se valoró la última vez, para seguir desde ahí. */
  function previas(d: EvalDiana, alumnos: Student[]): Marcas {
    const m: Marcas = {};
    for (const s of alumnos) {
      const ultima = evaluations.filter(e => e.rubric_id === d.id && e.student_id === s.id).sort((a, b) => b.date.localeCompare(a.date))[0];
      if (ultima) m[s.id] = { ...ultima.scores };
    }
    return m;
  }

  function abrirEvaluar(d: EvalDiana) {
    const cs = clasesDe(d).length ? classes.filter(c => clasesDe(d).includes(c.id)) : classes;
    const c = cs[0]?.id ?? '';
    setEvaluando(d);
    setClaseId(c);
    setMarcas(previas(d, students.filter(s => s.class_id === c)));
  }

  function cambiarClase(id: string) {
    setClaseId(id);
    if (evaluando) setMarcas(previas(evaluando, students.filter(s => s.class_id === id)));
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
    if (!evaluando) return;
    const hoy = isoDate();
    let n = 0;
    for (const s of alumnado) {
      const scores = marcas[s.id] ?? {};
      const valorados = evaluando.items.filter(i => scores[i.id] === BIEN || scores[i.id] === MEJORABLE);
      if (valorados.length === 0) continue;
      const lim: Record<string, number> = {};
      valorados.forEach(i => { lim[i.id] = scores[i.id]; });
      onAddEvaluation({
        id: 'ev' + uid(), rubric_id: evaluando.id, rubric_name: evaluando.name,
        student_id: s.id, student_name: s.name, class_id: claseId, date: hoy,
        scores: lim, notes: '', instrument: 'diana', max_level: BIEN,
        grade: notaRegistro(evaluando.items, lim) ?? undefined,
      });
      n++;
    }
    if (n === 0) { toast(t('Marca algún pulgar antes de guardar')); return; }
    toast(t(n === 1 ? '✅ Guardada la valoración de {n} alumno' : '✅ Guardada la valoración de {n} alumnos', { n }));
    setEvaluando(null);
  }

  const total = evaluando?.items.length ?? 0;

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Escalas de registro')}</h1>
          <p className="pg-sub">{t('Un concepto concreto y, por cada alumno, un pulgar arriba (bien hecho) o abajo (mejorable)')}</p>
        </div>
        <button className="btn-accent" onClick={nueva}><Plus size={15} />{t('Nueva escala')}</button>
      </div>

      {escalas.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
          <div className="reg-vacio-ico" aria-hidden="true"><ThumbsUp size={26} /><ThumbsDown size={26} /></div>
          <h2 style={{ fontSize: 17, margin: '10px 0 6px' }}>{t('Todavía no tienes ninguna escala de registro')}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', maxWidth: 460, margin: '0 auto 16px', lineHeight: 1.5 }}>
            {t('Sirve para anotar de un vistazo si cada alumno ha hecho bien un concepto concreto: el saque, la entrega a tiempo, el trabajo en equipo…')}
          </p>
          <button className="btn-accent" onClick={nueva}><Plus size={15} />{t('Crear la primera')}</button>
        </div>
      ) : (
        <div className="reg-cards">
          {escalas.map(d => {
            const n = evaluations.filter(e => e.rubric_id === d.id).length;
            return (
              <div key={d.id} className="card reg-card">
                <div className="reg-card-hd">
                  <span className="reg-card-ico" aria-hidden="true"><ThumbsUp size={18} /></span>
                  <strong>{d.name}</strong>
                  <span className="reg-card-acc">
                    <button className="ico-btn" onClick={() => { setEsNueva(false); setEditando(d); }} title={t('Editar')} aria-label={t('Editar «{nombre}»', { nombre: d.name })}><Pencil size={14} /></button>
                    <button className="ico-btn" onClick={() => duplicar(d)} title={t('Duplicar')} aria-label={t('Duplicar «{nombre}»', { nombre: d.name })}><Copy size={14} /></button>
                    <button className="ico-btn" onClick={() => setABorrar(d)} title={t('Eliminar')} aria-label={t('Eliminar «{nombre}»', { nombre: d.name })}><Trash2 size={14} color="var(--danger)" /></button>
                  </span>
                </div>
                <ul className="reg-conceptos">
                  {d.items.slice(0, 4).map(i => <li key={i.id}>{i.name}</li>)}
                  {d.items.length > 4 && <li className="mas">{t('+{n} más', { n: d.items.length - 4 })}</li>}
                </ul>
                {clasesDe(d).length > 0 && (
                  <div className="reg-clases">
                    {clasesDe(d).map(id => classes.find(c => c.id === id)).filter(Boolean).map(c => <span key={c!.id}>{c!.name}</span>)}
                  </div>
                )}
                <div className="reg-card-ft">
                  <span className="reg-dato">{t(n === 1 ? '{n} valoración' : '{n} valoraciones', { n })}</span>
                  <button className="btn-accent" onClick={() => abrirEvaluar(d)}><ThumbsUp size={14} />{t('Valorar a la clase')}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Crear o editar ── */}
      <Modal open={!!editando} onClose={() => setEditando(null)} wide title={esNueva ? t('Nueva escala de registro') : t('Editar escala de registro')}>
        {editando && (
          <>
            <div className="fgroup">
              <label className="flabel" htmlFor="reg-nombre">{t('Nombre *')}</label>
              <input id="reg-nombre" className="finput" value={editando.name} placeholder={t('Ej: Técnica del saque de voleibol')}
                onChange={e => setEditando({ ...editando, name: e.target.value })} />
            </div>
            <div className="fgroup">
              <label className="flabel">{t('Conceptos que se valoran')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {editando.items.map((it, i) => (
                  <div key={it.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input className="finput" style={{ flex: 1 }} value={it.name} aria-label={t('Concepto {n}', { n: i + 1 })}
                      placeholder={t('Ej: Golpea con la palma abierta')}
                      onChange={e => setEditando({ ...editando, items: editando.items.map(x => (x.id === it.id ? { ...x, name: e.target.value } : x)) })} />
                    {editando.items.length > 1 && (
                      <button className="ico-btn" title={t('Quitar concepto')} aria-label={t('Quitar concepto {n}', { n: i + 1 })}
                        onClick={() => setEditando({ ...editando, items: editando.items.filter(x => x.id !== it.id) })}>
                        <Trash2 size={14} color="var(--danger)" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button className="btn-ghost" style={{ marginTop: 9, fontSize: 12.5 }}
                onClick={() => setEditando({ ...editando, items: [...editando.items, { id: 'it' + uid(), name: '', weight: 1 }] })}>
                <Plus size={13} />{t('Añadir concepto')}
              </button>
            </div>
            <GradeTargetsPicker
              value={editando as GradeTarget}
              onChange={n => setEditando({ ...editando, ...n, class_id: n.class_id, subject: n.subject, category_id: n.category_id, otras_clases: n.otras_clases })}
              classes={classes} gradeCategories={gradeCategories}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-accent" onClick={guardar}>{t(esNueva ? 'Crear escala' : 'Guardar cambios')}</button>
              <button className="btn-ghost" onClick={() => setEditando(null)}>{t('Cancelar')}</button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Valorar a la clase ── */}
      <Modal open={!!evaluando} onClose={() => setEvaluando(null)} wide title={evaluando?.name}>
        {evaluando && (
          <>
            <div className="frow" style={{ marginBottom: 12 }}>
              <div className="fgroup" style={{ marginBottom: 0 }}>
                <label className="flabel" htmlFor="reg-clase">{t('Clase')}</label>
                <select id="reg-clase" className="finput" value={claseId} onChange={e => cambiarClase(e.target.value)}>
                  {clasesEval.map(c => <option key={c.id} value={c.id}>{c.name} – {objetivoPara(evaluando, c.id)?.subject || c.subject}</option>)}
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
                      {evaluando.items.map(i => (
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
                      const nota = notaRegistro(evaluando.items, m);
                      const { bien, mejorable } = cuentaRegistro(m, evaluando.items.map(i => i.id));
                      return (
                        <tr key={s.id}>
                          <th scope="row" className="reg-alumno">{s.name}</th>
                          {evaluando.items.map(i => (
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
            {evaluando.class_id && evaluando.category_id && (
              <p className="reg-ayuda" style={{ marginTop: 10 }}><Check size={13} /> {t('La nota va a la columna de esta escala en el cuaderno de la clase.')}</p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn-accent" onClick={guardarEvaluacion} disabled={alumnado.length === 0}>{t('Guardar valoración')}</button>
              <button className="btn-ghost" onClick={() => setEvaluando(null)}>{t('Cancelar')}</button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Eliminar ── */}
      <Modal open={!!aBorrar} onClose={() => setABorrar(null)} title={t('Eliminar escala de registro')}>
        {aBorrar && (
          <>
            <p style={{ fontSize: 13.5, lineHeight: 1.5, marginBottom: 14 }}>{t('¿Eliminar «{nombre}»? Las valoraciones ya guardadas se quedan en el Historial.', { nombre: aBorrar.name })}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-accent" style={{ background: 'var(--danger)' }} onClick={() => { onDeleteDiana(aBorrar.id); setABorrar(null); }}>{t('Eliminar')}</button>
              <button className="btn-ghost" onClick={() => setABorrar(null)}>{t('Cancelar')}</button>
            </div>
          </>
        )}
      </Modal>
    </section>
  );
}
