/**
 * Escalas de registro (Evaluar › «Escalas de registro», petición del dueño,
 * 19-10-2026): se elige un concepto concreto (o varios) y, por cada alumno,
 * un pulgar arriba (bien hecho) o un pulgar abajo (mejorable). Rápido, de
 * una clase entera en una sola tabla. La nota sale de los pulgares arriba y,
 * como en rúbricas y dianas, puede ir al cuaderno de una o de varias clases.
 * Ver `lib/registro.ts`.
 */
import { useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Copy, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { Class, EvalDiana, Evaluation, GradeCategory, GradeTarget, Student } from '../types';
import { GradeTargetsPicker } from '../components/GradeTargetPicker';
import { Modal } from '../components/ui/Modal';
import { ValorarRegistro } from '../components/ValorarRegistro';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';
import { clasesDe, conObjetivos } from '../lib/objetivos';
import { NIVELES_REGISTRO, esRegistro } from '../lib/registro';

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

export function EscalasRegistro({
  dianas, evaluations, classes, students, gradeCategories, onAddDiana, onUpdateDiana, onDeleteDiana, onAddEvaluation,
}: Props) {
  const { t } = useI18n();
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
                  <button className="btn-accent" onClick={() => setEvaluando(d)}><ThumbsUp size={14} />{t('Valorar a la clase')}</button>
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
      {evaluando && (
        <ValorarRegistro
          escala={evaluando} classes={classes} students={students} evaluations={evaluations}
          onAddEvaluation={onAddEvaluation} onClose={() => setEvaluando(null)}
        />
      )}

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
