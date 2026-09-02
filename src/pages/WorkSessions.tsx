/**
 * Reuniones y Formaciones.
 *
 * Una sola pantalla para los dos módulos: el trabajo es idéntico —anotar
 * durante el acto y pedirle a la IA el documento final— y lo único que cambia
 * son las etiquetas y qué apartados tiene ese documento. Se distinguen por la
 * prop `kind`, y en la barra lateral aparecen como dos entradas separadas.
 *
 * El documento generado se puede editar a mano antes de exportarlo: lo que se
 * guarda es siempre lo que el docente dio por bueno, no lo que propuso la
 * máquina (mismo criterio que en las situaciones de aprendizaje).
 */

import { useMemo, useState } from 'react';
import {
  Plus, Users2, GraduationCap, Sparkles, FileText, Download, Trash2, Pencil,
  Calendar, MapPin, Clock, X, Save, ChevronRight, ListChecks,
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { useI18n } from '../i18n';
import { isoDate } from '../lib/utils';
import { hasApiKey } from '../services/gemini';
import { generateWorkSessionDoc } from '../services/workSessions';
import { saveWorkSessionPdf, saveWorkSessionDocx } from '../services/exportWorkSession';
import type { WorkSession, WorkSessionDoc, WorkSessionKind } from '../types';

interface Props {
  kind: WorkSessionKind;
  sessions: WorkSession[];
  onSave: (s: WorkSession) => void;
  onDelete: (id: string) => void;
  onNav: (s: string) => void;
}

function newId() {
  return 'ws' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function emptySession(kind: WorkSessionKind): WorkSession {
  return {
    id: newId(), kind, at: new Date().toISOString(), date: isoDate(),
    title: '', notes: '',
  };
}

export function WorkSessions({ kind, sessions, onSave, onDelete, onNav }: Props) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorkSession | null>(null);

  // Abrir y cerrar va por bandera, no por vaciar el borrador: el modal tarda
  // un momento en desvanecerse y, si el contenido desapareciera de golpe, se
  // vería una tarjeta blanca vacía durante la animación de cierre.
  const [formOpen, setFormOpen] = useState(false);
  // Si el borrador viene de algo ya guardado. Se decide al abrir y no mirando
  // si hay título: en un alta nueva, la cabecera cambiaba de «Nueva reunión» a
  // «Editar anotaciones» en cuanto se escribía la primera letra.
  const [editando, setEditando] = useState(false);

  /** Cambia un campo del borrador. Con el modal ya cerrado no hace nada. */
  const patch = (p: Partial<WorkSession>) => setDraft(d => (d ? { ...d, ...p } : d));

  const esReunion = kind === 'meeting';
  const mias = useMemo(
    () => sessions.filter(s => s.kind === kind).sort((a, b) => b.date.localeCompare(a.date)),
    [sessions, kind],
  );

  const abierta = openId ? mias.find(s => s.id === openId) ?? null : null;

  function empezar(base?: WorkSession) {
    setDraft(base ? { ...base } : emptySession(kind));
    setEditando(!!base);
    setFormOpen(true);
  }

  function guardarBorrador() {
    if (!draft) return;
    if (!draft.title.trim()) { toast(t('Ponle un título antes de guardar')); return; }
    onSave({ ...draft, title: draft.title.trim(), at: new Date().toISOString() });
    toast(t('✅ Guardado'));
    setFormOpen(false);
  }

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{esReunion ? t('Reuniones') : t('Formaciones')}</h1>
          <p className="pg-sub">
            {esReunion
              ? t('Anota lo que se dice y la IA te redacta el acta lista para exportar')
              : t('Anota lo que aprendes y la IA te redacta la memoria lista para exportar')}
          </p>
        </div>
        <button className="btn-accent" onClick={() => empezar()}>
          <Plus size={16} />{esReunion ? t('Nueva reunión') : t('Nueva formación')}
        </button>
      </div>

      {!hasApiKey() && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', marginBottom: 16,
          background: 'rgba(245,158,11,0.09)', border: '0.5px solid rgba(245,158,11,0.35)',
          borderRadius: 12, fontSize: 13, color: '#92400e',
        }}>
          <Sparkles size={17} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, lineHeight: 1.5 }}>
            {t('Para usar la IA necesitas una clave gratuita de Google (se configura en 2 minutos).')}
          </span>
          <button className="btn-accent" style={{ fontSize: 12.5, padding: '7px 14px', flexShrink: 0 }} onClick={() => onNav('profile')}>
            {t('Configurar ahora')}
          </button>
        </div>
      )}

      {mias.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '46px 20px' }}>
          {esReunion ? <Users2 size={32} color="var(--accent-d)" style={{ opacity: 0.5 }} />
            : <GraduationCap size={32} color="var(--accent-d)" style={{ opacity: 0.5 }} />}
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '12px 0 4px' }}>
            {esReunion ? t('Todavía no has anotado ninguna reunión') : t('Todavía no has anotado ninguna formación')}
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '0 0 18px', lineHeight: 1.6 }}>
            {esReunion
              ? t('Claustros, departamento, evaluación, tutorías con familias… apunta lo que se diga y luego pide el acta.')
              : t('Cursos, jornadas, seminarios… apunta lo que te llevas y luego pide la memoria.')}
          </p>
          <button className="btn-accent" onClick={() => empezar()}>
            <Plus size={16} />{esReunion ? t('Nueva reunión') : t('Nueva formación')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {mias.map(s => (
            <button
              key={s.id}
              className="card"
              onClick={() => setOpenId(s.id)}
              style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35 }}>{s.title}</span>
                <ChevronRight size={15} color="var(--text-3)" style={{ flexShrink: 0, marginTop: 2 }} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11.5, color: 'var(--text-3)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={11} />{new Date(s.date + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {s.place && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} />{s.place}</span>}
                {s.hours ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{t('{n} h', { n: s.hours })}</span> : null}
              </div>
              <p style={{
                fontSize: 12, color: 'var(--text-2)', margin: 0, lineHeight: 1.5, overflow: 'hidden',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {s.notes || t('Sin anotaciones todavía')}
              </p>
              <span style={{
                alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
                background: s.document ? 'rgba(4,120,87,0.1)' : 'var(--surface)',
                color: s.document ? '#047857' : 'var(--text-3)',
                border: '0.5px solid var(--border)',
              }}>
                {s.document
                  ? (esReunion ? t('Acta generada') : t('Memoria generada'))
                  : t('Sin documento')}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Alta y edición de las anotaciones */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        wide
        title={editando
          ? t('Editar anotaciones')
          : (esReunion ? t('Nueva reunión') : t('Nueva formación'))}
      >
        {draft && (
          <>
            <div className="fgroup">
              <label className="flabel">{esReunion ? t('Asunto de la reunión') : t('Nombre de la formación')}</label>
              <input
                className="finput" value={draft.title} autoFocus
                onChange={e => patch({ title: e.target.value })}
                placeholder={esReunion ? t('Ej: Claustro de octubre') : t('Ej: Evaluación competencial en secundaria')}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <div className="fgroup">
                <label className="flabel">{t('Fecha')}</label>
                <input className="finput" type="date" value={draft.date} onChange={e => patch({ date: e.target.value })} />
              </div>
              <div className="fgroup">
                <label className="flabel">{t('Hora de inicio')}</label>
                <input className="finput" type="time" value={draft.timeStart ?? ''} onChange={e => patch({ timeStart: e.target.value })} />
              </div>
              <div className="fgroup">
                <label className="flabel">{t('Hora de fin')}</label>
                <input className="finput" type="time" value={draft.timeEnd ?? ''} onChange={e => patch({ timeEnd: e.target.value })} />
              </div>
              {!esReunion && (
                <div className="fgroup">
                  <label className="flabel">{t('Horas certificadas')}</label>
                  <input
                    className="finput" type="number" min={0} step={1} value={draft.hours ?? ''}
                    onChange={e => patch({ hours: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div className="fgroup">
                <label className="flabel">{esReunion ? t('Convoca') : t('Entidad y ponente')}</label>
                <input
                  className="finput" value={draft.organizer ?? ''}
                  onChange={e => patch({ organizer: e.target.value })}
                  placeholder={esReunion ? t('Ej: Jefatura de estudios') : t('Ej: CEFIRE · Marta Ruiz')}
                />
              </div>
              <div className="fgroup">
                <label className="flabel">{t('Lugar')}</label>
                <input
                  className="finput" value={draft.place ?? ''}
                  onChange={e => patch({ place: e.target.value })}
                  placeholder={esReunion ? t('Ej: Sala de profesores') : t('Ej: En línea')}
                />
              </div>
            </div>

            {esReunion && (
              <div className="fgroup">
                <label className="flabel">{t('Asistentes')}</label>
                <input
                  className="finput" value={draft.attendees ?? ''}
                  onChange={e => patch({ attendees: e.target.value })}
                  placeholder={t('Ej: equipo docente de 1º ESO, orientación')}
                />
              </div>
            )}

            <div className="fgroup">
              <label className="flabel">{t('Anotaciones')}</label>
              <textarea
                className="finput" rows={10} value={draft.notes}
                onChange={e => patch({ notes: e.target.value })}
                placeholder={esReunion
                  ? t('Escribe como te salga: frases sueltas, nombres, acuerdos, quién se encarga de qué… La IA lo ordenará después.')
                  : t('Escribe como te salga: ideas del ponente, ejemplos, cosas que quieres probar en clase… La IA lo ordenará después.')}
                style={{ resize: 'vertical', minHeight: 200, lineHeight: 1.6 }}
              />
              <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '6px 0 0', lineHeight: 1.5 }}>
                {t('Cuanto más apuntes, mejor será el documento. La IA no añade nada que no esté aquí.')}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button className="btn-accent" style={{ flex: 1, justifyContent: 'center' }} onClick={guardarBorrador}>
                <Save size={15} />{t('Guardar')}
              </button>
              <button className="btn-ghost" onClick={() => setFormOpen(false)}>{t('Cancelar')}</button>
            </div>
          </>
        )}
      </Modal>

      {abierta && (
        <SessionDetail
          session={abierta}
          onClose={() => setOpenId(null)}
          onEdit={() => { empezar(abierta); setOpenId(null); }}
          onSave={onSave}
          onDelete={id => { onDelete(id); setOpenId(null); }}
        />
      )}
    </section>
  );
}

/* ══════════════════ Detalle: generar, revisar y exportar ══════════════════ */

function SessionDetail({ session, onClose, onEdit, onSave, onDelete }: {
  session: WorkSession;
  onClose: () => void;
  onEdit: () => void;
  onSave: (s: WorkSession) => void;
  onDelete: (id: string) => void;
}) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [editing, setEditing] = useState<WorkSessionDoc | null>(null);

  // Igual que en la lista: la bandera cierra, el documento se queda puesto.
  const [docOpen, setDocOpen] = useState(false);

  const patchDoc = (p: Partial<WorkSessionDoc>) => setEditing(d => (d ? { ...d, ...p } : d));

  const esReunion = session.kind === 'meeting';
  const doc = session.document;

  async function generar() {
    if (!session.notes.trim()) { toast(t('Añade anotaciones antes de pedir el documento')); return; }
    const generated = await generateWorkSessionDoc(session, lang, {
      onStart: () => setLoading(true),
      onEnd: () => setLoading(false),
      onError: msg => toast(msg),
    });
    if (!generated) return;
    onSave({ ...session, document: generated, at: new Date().toISOString() });
    toast(esReunion ? t('✅ Acta generada') : t('✅ Memoria generada'));
  }

  async function exportPdf() {
    const res = await saveWorkSessionPdf(session, lang);
    if ('error' in res && res.error === 'not-desktop') {
      toast(t('El PDF solo está disponible en la aplicación de escritorio. Puedes exportar a Word.'));
    } else if ('error' in res && res.error) {
      toast(res.error);
    }
  }

  function guardarEdicion() {
    if (!editing) return;
    onSave({ ...session, document: editing, at: new Date().toISOString() });
    setDocOpen(false);
    toast(t('✅ Guardado'));
  }

  return (
    <Modal open onClose={onClose} wide stickyHeader title={session.title}>
      {/* Acciones */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginBottom: 16 }}>
        <button className="btn-ia" onClick={generar} disabled={loading} type="button">
          {loading
            ? <><span className="spin" /><span className="ia-generating">{t('Redactando…')}</span></>
            : <><Sparkles size={14} />{doc
                ? t('Volver a generar')
                : (esReunion ? t('Generar acta con IA') : t('Generar memoria con IA'))}</>}
        </button>
        <button className="btn-ghost" onClick={onEdit} type="button">
          <Pencil size={14} />{t('Editar anotaciones')}
        </button>
        {doc && (
          <>
            <button className="btn-ghost" onClick={() => { setEditing({ ...doc }); setDocOpen(true); }} type="button">
              <ListChecks size={14} />{t('Retocar el documento')}
            </button>
            <button className="btn-ghost" onClick={exportPdf} type="button">
              <FileText size={14} />{t('PDF')}
            </button>
            <button className="btn-ghost" onClick={() => saveWorkSessionDocx(session, lang)} type="button">
              <Download size={14} />{t('Word')}
            </button>
          </>
        )}
        <div style={{ flex: 1 }} />
        {confirmDel ? (
          <button className="btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => onDelete(session.id)} type="button">
            <Trash2 size={14} />{t('¿Seguro? Se borra')}
          </button>
        ) : (
          <button className="btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDel(true)} type="button">
            <Trash2 size={14} />{t('Eliminar')}
          </button>
        )}
      </div>

      {/* Anotaciones en bruto */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-hd">
          <div className="card-ttl"><Pencil size={14} color="var(--accent-d)" />{t('Anotaciones')}</div>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>
          {session.notes || t('Sin anotaciones todavía')}
        </div>
      </div>

      {/* Documento generado */}
      {doc ? (
        <div className="card">
          <div className="card-hd">
            <div className="card-ttl">
              <FileText size={14} color="var(--accent-d)" />
              {esReunion ? t('Acta de reunión') : t('Memoria de formación')}
            </div>
          </div>
          <DocView doc={doc} kind={session.kind} />
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
          <Sparkles size={24} color="var(--accent-d)" style={{ opacity: 0.5 }} />
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '10px 0 0', lineHeight: 1.6 }}>
            {esReunion
              ? t('Cuando tengas las anotaciones, pide el acta y la tendrás lista para exportar.')
              : t('Cuando tengas las anotaciones, pide la memoria y la tendrás lista para exportar.')}
          </p>
        </div>
      )}

      {/* Retoque a mano del documento */}
      <Modal open={docOpen} onClose={() => setDocOpen(false)} wide title={t('Retocar el documento')}>
        {editing && (
          <>
            <div className="fgroup">
              <label className="flabel">{t('Título')}</label>
              <input className="finput" value={editing.titulo} onChange={e => patchDoc({ titulo: e.target.value })} />
            </div>
            <div className="fgroup">
              <label className="flabel">{t('Resumen')}</label>
              <textarea className="finput" rows={3} value={editing.resumen}
                onChange={e => patchDoc({ resumen: e.target.value })} style={{ resize: 'vertical' }} />
            </div>

            <label className="flabel">{esReunion ? t('Puntos tratados') : t('Contenidos trabajados')}</label>
            {editing.apartados.map((a, i) => (
              <div key={i} className="fgroup" style={{ border: '0.5px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    className="finput" value={a.titulo} placeholder={t('Título del punto')}
                    onChange={e => patchDoc({ apartados: editing.apartados.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)) })}
                  />
                  <button className="ico-btn" type="button" aria-label={t('Quitar')}
                    onClick={() => patchDoc({ apartados: editing.apartados.filter((_, j) => j !== i) })}>
                    <X size={15} />
                  </button>
                </div>
                <textarea
                  className="finput" rows={3} value={a.contenido} style={{ resize: 'vertical' }}
                  onChange={e => patchDoc({ apartados: editing.apartados.map((x, j) => (j === i ? { ...x, contenido: e.target.value } : x)) })}
                />
              </div>
            ))}

            <ListEditor
              label={esReunion ? t('Acuerdos') : t('Ideas clave')}
              items={editing.acuerdos}
              onChange={acuerdos => patchDoc({ acuerdos })}
            />

            {!esReunion && (
              <ListEditor
                label={t('Aplicación en el aula')}
                items={editing.aplicacionAula}
                onChange={aplicacionAula => patchDoc({ aplicacionAula })}
              />
            )}

            <div className="fgroup">
              <label className="flabel">{esReunion ? t('Cierre') : t('Valoración')}</label>
              <textarea className="finput" rows={3} value={editing.cierre}
                onChange={e => patchDoc({ cierre: e.target.value })} style={{ resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button className="btn-accent" style={{ flex: 1, justifyContent: 'center' }} onClick={guardarEdicion}>
                <Save size={15} />{t('Guardar')}
              </button>
              <button className="btn-ghost" onClick={() => setDocOpen(false)}>{t('Cancelar')}</button>
            </div>
          </>
        )}
      </Modal>
    </Modal>
  );
}

/** Lista de frases sueltas (acuerdos, ideas clave), editable línea a línea. */
function ListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  const { t } = useI18n();
  return (
    <div className="fgroup">
      <label className="flabel">{label}</label>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7 }}>
          <input className="finput" value={it} onChange={e => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button className="ico-btn" type="button" aria-label={t('Quitar')} onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <X size={15} />
          </button>
        </div>
      ))}
      <button className="btn-ghost" style={{ fontSize: 12.5, padding: '6px 11px' }} type="button" onClick={() => onChange([...items, ''])}>
        <Plus size={13} />{t('Añadir')}
      </button>
    </div>
  );
}

/** Encabezado de sección dentro de la vista del documento. */
function H({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: 12, fontWeight: 700, color: 'var(--accent-d)', textTransform: 'uppercase',
      letterSpacing: '0.04em', margin: '18px 0 6px', paddingBottom: 3, borderBottom: '1px solid var(--border)',
    }}>{children}</h3>
  );
}

/** El documento tal y como se leerá en el PDF, para revisarlo antes de exportar. */
function DocView({ doc, kind }: { doc: WorkSessionDoc; kind: WorkSessionKind }) {
  const { t } = useI18n();
  const esReunion = kind === 'meeting';

  return (
    <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)' }}>
      <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 8px' }}>{doc.titulo}</p>
      {doc.resumen && <p style={{ margin: 0, color: 'var(--text-2)' }}>{doc.resumen}</p>}

      {doc.apartados.length > 0 && (
        <>
          <H>{esReunion ? t('Puntos tratados') : t('Contenidos trabajados')}</H>
          {doc.apartados.map((a, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <p style={{ fontWeight: 700, margin: '0 0 2px' }}>{a.titulo}</p>
              <p style={{ margin: 0, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{a.contenido}</p>
            </div>
          ))}
        </>
      )}

      {doc.acuerdos.length > 0 && (
        <>
          <H>{esReunion ? t('Acuerdos') : t('Ideas clave')}</H>
          <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-2)' }}>
            {doc.acuerdos.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </>
      )}

      {doc.tareas.length > 0 && (
        <>
          <H>{t('Tareas pendientes')}</H>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-3)' }}>
                <th style={{ padding: '4px 6px' }}>{t('Tarea')}</th>
                <th style={{ padding: '4px 6px', width: '26%' }}>{t('Responsable')}</th>
                <th style={{ padding: '4px 6px', width: '22%' }}>{t('Plazo')}</th>
              </tr>
            </thead>
            <tbody>
              {doc.tareas.map((x, i) => (
                <tr key={i} style={{ borderTop: '0.5px solid var(--border)' }}>
                  <td style={{ padding: '6px' }}>{x.tarea}</td>
                  <td style={{ padding: '6px', color: 'var(--text-2)' }}>{x.responsable || '—'}</td>
                  <td style={{ padding: '6px', color: 'var(--text-2)' }}>{x.plazo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {doc.aplicacionAula.length > 0 && (
        <>
          <H>{t('Aplicación en el aula')}</H>
          <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-2)' }}>
            {doc.aplicacionAula.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </>
      )}

      {doc.cierre && (
        <>
          <H>{esReunion ? t('Cierre') : t('Valoración')}</H>
          <p style={{ margin: 0, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{doc.cierre}</p>
        </>
      )}
    </div>
  );
}
