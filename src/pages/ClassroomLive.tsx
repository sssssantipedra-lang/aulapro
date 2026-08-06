import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Smartphone, Play, Square, Users, MessageSquareText, BarChart3,
  ClipboardCheck, Plus, Trash2, Monitor, Wifi, ArrowRight, Save, Target,
} from 'lucide-react';
import type { Class, Student, Rubric, EvalDiana, SelfAssessmentSession } from '../types';
import { isoDate } from '../lib/utils';
import type { ClassroomActivity, ClassroomSnapshot } from '../types/electron';
import { SessionQR } from '../components/share/SessionQR';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';

interface Props {
  classes: Class[];
  students: Student[];
  rubrics: Rubric[];
  dianas: EvalDiana[];
  onNav: (s: string) => void;
  /** Guarda lo respondido. Se llama solo, en cuanto hay respuestas. */
  onSaveSelfAssessment: (session: SelfAssessmentSession) => void;
}

type ActivityKind = 'rubric' | 'brainstorm' | 'poll';

const KINDS: { id: ActivityKind; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'rubric',     label: 'Autoevaluación', desc: 'Se puntúan con tus criterios', icon: <ClipboardCheck size={17} /> },
  { id: 'brainstorm', label: 'Lluvia de ideas', desc: 'Envían ideas al mural',        icon: <MessageSquareText size={17} /> },
  { id: 'poll',       label: 'Votación',       desc: 'Eligen una opción',            icon: <BarChart3 size={17} /> },
];

const LEVEL_LABEL = ['Aún no', 'A veces', 'Casi siempre', 'Siempre'];
const LEVEL_COLOR = ['#dc2626', '#d97706', '#2563eb', '#047857'];

export function ClassroomLive({ classes, students, rubrics, dianas, onNav, onSaveSelfAssessment }: Props) {
  const { toast } = useToast();
  const { t, lang, locale } = useI18n();
  const bridge = window.electronAPI?.classroom;

  const [snap, setSnap] = useState<ClassroomSnapshot | null>(null);
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [kind, setKind] = useState<ActivityKind>('rubric');
  const [busy, setBusy] = useState(false);

  // Formularios de cada tipo de actividad
  const [sourceId, setSourceId]   = useState('');
  const [title, setTitle]         = useState('');
  const [prompt, setPrompt]       = useState('');
  const [options, setOptions]     = useState<string[]>(['', '']);

  /** Lista de la clase, ordenada y numerada como el número de lista. */
  const roster = useMemo(() => {
    return students
      .filter(s => s.class_id === classId)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map((s, i) => ({ n: i + 1, name: s.name, id: s.id }));
  }, [students, classId]);

  /** Nombre con el que la sala se presenta al alumno antes de pedirle el código. */
  const roomLabel = useMemo(() => {
    const c = classes.find(x => x.id === classId);
    return c ? [c.name, c.subject].filter(Boolean).join(' · ') : '';
  }, [classes, classId]);

  /* ── Conexión con el proceso principal ── */
  useEffect(() => {
    if (!bridge) return;
    bridge.state().then(setSnap);
    return bridge.onUpdate(setSnap);
  }, [bridge]);

  // Si cambia la clase con la sala abierta, se actualizan lista y nombre al vuelo
  useEffect(() => {
    if (bridge && snap?.running) bridge.setRoster(roster, roomLabel).then(setSnap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, roomLabel]);

  const buildActivity = useCallback((): ClassroomActivity | null => {
    if (kind === 'rubric') {
      const rubric = rubrics.find(r => r.id === sourceId);
      const diana  = dianas.find(d => d.id === sourceId);
      if (rubric) {
        return { id: rubric.id, type: 'rubric', title: title.trim() || rubric.name, prompt: prompt.trim() || undefined,
          items: rubric.criteria.map(c => ({ id: c.id, name: c.name })) };
      }
      if (diana) {
        return { id: diana.id, type: 'rubric', title: title.trim() || diana.name, prompt: prompt.trim() || undefined,
          items: diana.items.map(i => ({ id: i.id, name: i.name })) };
      }
      return null;
    }
    if (kind === 'brainstorm') {
      if (!title.trim()) return null;
      return { id: 'bs' + Date.now(), type: 'brainstorm', title: title.trim(), prompt: prompt.trim() || undefined };
    }
    const clean = options.map(o => o.trim()).filter(Boolean);
    if (!title.trim() || clean.length < 2) return null;
    return { id: 'pl' + Date.now(), type: 'poll', title: title.trim(), prompt: prompt.trim() || undefined, options: clean };
  }, [kind, sourceId, title, prompt, options, rubrics, dianas]);

  const activity = buildActivity();

  /**
   * Qué falta para poder abrir la sala; `null` si ya está todo listo.
   * Se enseña siempre: un botón gris sin explicación deja al docente atascado.
   */
  function whatIsMissing(): string | null {
    if (classes.length === 0) return t('Crea antes una clase con sus alumnos en «Mis Clases».');
    if (roster.length === 0) return t('Esa clase todavía no tiene alumnos.');
    if (kind === 'rubric' && rubrics.length === 0 && dianas.length === 0) {
      return t('Necesitas crear antes una rúbrica o una diana en Evaluación.');
    }
    if (kind === 'rubric' && !sourceId) return t('Elige arriba la rúbrica o la diana con la que se autoevaluarán.');
    if (kind === 'brainstorm' && !title.trim()) return t('Escribe el tema de la lluvia de ideas.');
    if (kind === 'poll' && !title.trim()) return t('Escribe la pregunta de la votación.');
    if (kind === 'poll' && options.filter(o => o.trim()).length < 2) return t('La votación necesita dos opciones como mínimo.');
    if (!activity) return t('Revisa la configuración de la actividad.');
    return null;
  }
  const missing = whatIsMissing();

  async function openRoom() {
    if (!bridge) return;
    if (missing || !activity) { toast(missing ?? t('Configura antes la actividad')); return; }
    setBusy(true);
    const s = await bridge.start({ roster, activity, label: roomLabel });
    setBusy(false);
    if (s.error) { toast(s.error); return; }
    setSnap(s);
    toast(t('✅ Sala abierta'));
  }

  async function closeRoom() {
    if (!bridge) return;
    setSnap(await bridge.stop());
    toast(t('Sala cerrada'));
  }

  async function pushActivity() {
    if (!bridge || !activity) { toast(t('Configura antes la actividad')); return; }
    setSnap(await bridge.setActivity(activity));
    toast(t('✅ Nueva actividad enviada a los móviles'));
  }

  /* ── Fuera de la app de escritorio ── */
  if (!bridge) {
    return (
      <section className="sec active">
        <div className="pg-hd">
          <div>
            <h1 className="pg-title">{t('Sala de alumnos')}</h1>
            <p className="pg-sub">{t('Actividades desde el móvil, sin instalar nada')}</p>
          </div>
        </div>
        <div className="card" style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center', padding: '40px 34px' }}>
          <Monitor size={38} color="var(--text-3)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
            {t('Solo desde la aplicación de escritorio')}
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65 }}>
            {t('Para que los alumnos se conecten, Aula Pro tiene que abrir una sala en tu propio ordenador, y eso solo puede hacerlo la aplicación instalada (AulaPro.exe), no la versión de navegador.')}
          </p>
        </div>
      </section>
    );
  }

  /**
   * Guarda lo respondido en cuanto llega, sin pedir permiso.
   *
   * Antes las respuestas vivían solo en la memoria del servidor de la sala:
   * cerrarla, o que se cayera la aplicación, las borraba. Ahora se conservan
   * siempre y el docente decide después si las incluye en el Historial.
   *
   * El id se deriva del código de sala y de la actividad, así que ir
   * recibiendo respuestas actualiza la misma sesión en vez de crear una por
   * cada alumno que contesta.
   */
  useEffect(() => {
    const act = snap?.activity;
    if (!snap?.running || act?.type !== 'rubric') return;
    const answers = (snap.responses ?? []).filter(r => r.data?.scores);
    if (answers.length === 0) return;

    const items = act.items ?? [];
    const cls = classes.find(c => c.id === classId);

    onSaveSelfAssessment({
      id: `sa-${snap.code}-${act.id}`,
      at: new Date().toISOString(),
      date: isoDate(),
      class_id: classId,
      class_name: cls?.name ?? '',
      source_id: act.id,
      title: act.title,
      items: items.map(i => ({ id: i.id, name: i.name })),
      rows: answers.map(r => {
        const scores = r.data?.scores ?? {};
        const vals = items.map(i => scores[i.id]).filter((v): v is number => typeof v === 'number');
        // La página del alumno ofrece cuatro niveles fijos
        const grade = vals.length
          ? Math.round((vals.reduce((a, b) => a + b, 0) / (vals.length * 4)) * 10 * 10) / 10
          : null;
        return {
          student_id: roster.find(x => x.n === r.n)?.id ?? null,
          student_name: r.name,
          scores,
          grade,
        };
      }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap?.responses, snap?.activity, snap?.code, snap?.running]);

  const running = snap?.running === true;
  const address = snap?.addresses?.[0];
  const joinUrl = running && address ? `http://${address.ip}:${snap!.port}/r/${snap!.code}` : '';
  const responses = snap?.responses ?? [];

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Sala de alumnos')}</h1>
          <p className="pg-sub">
            {running
              ? t(responses.length === 1 ? 'Sala abierta · {n} respuesta recibida' : 'Sala abierta · {n} respuestas recibidas', { n: responses.length })
              : t('Actividades desde el móvil, sin instalar nada')}
          </p>
        </div>
        {running ? (
          <button className="btn-ghost" style={{ color: 'var(--danger)' }} onClick={closeRoom}>
            <Square size={14} />{t('Cerrar sala')}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button className="btn-accent" onClick={openRoom} disabled={busy}>
              {busy ? <><span className="spin" />{t('Abriendo…')}</> : <><Play size={15} />{t('Abrir sala')}</>}
            </button>
            {missing && (
              <span style={{ fontSize: 11.5, color: 'var(--text-3)', maxWidth: 272, textAlign: 'right', lineHeight: 1.45 }}>
                {missing}
              </span>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: running ? 'minmax(0,1fr) 330px' : 'minmax(0,1fr) 300px', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Clase */}
          <div className="card">
            <div className="card-hd">
              <div className="card-ttl"><Users size={14} color="var(--accent-d)" />{t('Clase')}</div>
            </div>
            {classes.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                {t('Crea antes una clase con sus alumnos en «Mis Clases».')}
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {classes.map(c => {
                    const on = c.id === classId;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setClassId(c.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7, padding: '8px 15px',
                          background: on ? c.color : 'white', color: on ? 'white' : 'var(--text-2)',
                          border: `1.5px solid ${on ? c.color : 'var(--border)'}`,
                          borderRadius: 99, cursor: 'pointer', fontFamily: 'var(--font)',
                          fontSize: 13, fontWeight: on ? 700 : 500, transition: 'all 0.18s',
                        }}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 10 }}>
                  {t(roster.length === 1 ? '{n} alumno numerado' : '{n} alumnos numerados', { n: roster.length })}{' '}
                  {t('por orden alfabético. Entrarán con su número de lista o su nombre.')}
                </p>
              </>
            )}
          </div>

          {/* Actividad */}
          <div className="card">
            <div className="card-hd">
              <div className="card-ttl">{t('Actividad')}</div>
              {running && (
                <button className="btn-accent" style={{ fontSize: 12, padding: '6px 12px' }} onClick={pushActivity}>
                  {t('Enviar a los móviles')} <ArrowRight size={13} />
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9, marginBottom: 16 }}>
              {KINDS.map(k => {
                const on = kind === k.id;
                return (
                  <button
                    key={k.id}
                    onClick={() => { setKind(k.id); setTitle(''); setPrompt(''); setSourceId(''); }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                      padding: '12px 13px', borderRadius: 11, cursor: 'pointer', textAlign: 'left',
                      background: on ? 'var(--accent-l)' : 'var(--surface)',
                      border: `1.5px solid ${on ? 'var(--accent-d)' : 'transparent'}`,
                      fontFamily: 'var(--font)',
                    }}
                  >
                    <span style={{ color: on ? 'var(--accent-d)' : 'var(--text-3)' }}>{k.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{t(k.label)}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{t(k.desc)}</span>
                  </button>
                );
              })}
            </div>

            {kind === 'rubric' ? (
              <>
                <div className="fgroup">
                  <label className="flabel">{t('¿Con qué se autoevalúan?')}</label>
                  <select className="finput" value={sourceId} onChange={e => setSourceId(e.target.value)} style={{ cursor: 'pointer' }}>
                    <option value="">{t('Elige una rúbrica o diana…')}</option>
                    {rubrics.length > 0 && (
                      <optgroup label={t('Rúbricas')}>
                        {rubrics.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </optgroup>
                    )}
                    {dianas.length > 0 && (
                      <optgroup label={t('Dianas')}>
                        {dianas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </optgroup>
                    )}
                  </select>
                </div>
                {rubrics.length === 0 && dianas.length === 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 9, background: 'var(--surface)', fontSize: 12.5, color: 'var(--text-2)' }}>
                    <Target size={15} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{t('Necesitas al menos una rúbrica o diana.')}</span>
                    <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 11px' }} onClick={() => onNav('rubrics')}>
                      {t('Crear')}
                    </button>
                  </div>
                )}
                <div className="fgroup">
                  <label className="flabel">{t('Instrucción para el alumno (opcional)')}</label>
                  <input className="finput" value={prompt} onChange={e => setPrompt(e.target.value)}
                    placeholder={t('Ej: Piensa en cómo has trabajado hoy con tu grupo.')} />
                </div>
              </>
            ) : (
              <>
                <div className="fgroup">
                  <label className="flabel">{t(kind === 'poll' ? 'Pregunta' : 'Tema')}</label>
                  <input className="finput" value={title} onChange={e => setTitle(e.target.value)}
                    placeholder={t(kind === 'poll' ? 'Ej: ¿Qué hemos entendido mejor?' : 'Ej: ¿Qué sabemos sobre los ecosistemas?')} />
                </div>
                <div className="fgroup">
                  <label className="flabel">{t('Aclaración (opcional)')}</label>
                  <input className="finput" value={prompt} onChange={e => setPrompt(e.target.value)}
                    placeholder={t('Una frase que les oriente')} />
                </div>
                {kind === 'poll' && (
                  <div className="fgroup">
                    <label className="flabel">{t('Opciones')}</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {options.map((o, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ width: 22, fontSize: 12.5, fontWeight: 800, color: 'var(--text-3)' }}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          <input className="finput" value={o} style={{ flex: 1 }}
                            onChange={e => setOptions(prev => prev.map((x, j) => j === i ? e.target.value : x))} />
                          {options.length > 2 && (
                            <button className="ico-btn" onClick={() => setOptions(prev => prev.filter((_, j) => j !== i))}>
                              <Trash2 size={14} color="var(--danger)" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {options.length < 6 && (
                      <button className="btn-ghost" style={{ marginTop: 9, fontSize: 12.5 }} onClick={() => setOptions(p => [...p, ''])}>
                        <Plus size={13} />{t('Añadir opción')}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Resultados */}
          {running && (
            <ResultsPanel snap={snap!} roster={roster} onNav={onNav} />
          )}
        </div>

        {/* Panel lateral */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {running && joinUrl ? (
            <div className="card" style={{ textAlign: 'center', borderLeft: '3px solid var(--ok)' }}>
              <div className="card-hd" style={{ justifyContent: 'center' }}>
                <div className="card-ttl"><Smartphone size={14} color="var(--ok)" />{t('Para proyectar')}</div>
              </div>
              <SessionQR code={joinUrl} size={186} />
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', fontWeight: 600, marginBottom: 4 }}>
                  {t('O escribid en el navegador')}
                </div>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: 'var(--text)',
                  fontFamily: 'ui-monospace, Menlo, monospace', wordBreak: 'break-all',
                }}>
                  {address!.ip}:{snap!.port}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 8, fontWeight: 600 }}>{t('Código')}</div>
                <div style={{
                  display: 'inline-block', marginTop: 3, padding: '6px 16px', borderRadius: 10,
                  background: 'var(--accent-l)', color: 'var(--accent-d)',
                  fontSize: 21, fontWeight: 800, letterSpacing: '0.12em',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                }}>
                  {snap!.code}
                </div>
              </div>
              {snap!.addresses.length > 1 && (
                <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 12, lineHeight: 1.5 }}>
                  {t('Si no conecta, prueba con {addresses}', { addresses: snap!.addresses.slice(1).map(a => `${a.ip}:${snap!.port}`).join(lang === 'en' ? ' or ' : ' o ') })}
                </p>
              )}
            </div>
          ) : (
            <div className="card">
              <div className="card-hd">
                <div className="card-ttl"><Smartphone size={14} color="var(--accent-d)" />{t('Cómo funciona')}</div>
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
                <li>{t('Eliges la clase y la actividad.')}</li>
                <li>{t('Abres la sala y proyectas el QR.')}</li>
                <li>{t('Los alumnos lo escanean con el móvil.')}</li>
                <li>{t('Entran con su número de lista.')}</li>
                <li>{t('Ves sus respuestas aquí en directo.')}</li>
              </ol>
            </div>
          )}

          <div className="card" style={{ background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
              <Wifi size={15} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                <strong style={{ color: 'var(--text)' }}>{t('Todos en la misma wifi.')}</strong>{t(' No hace falta internet: los móviles hablan solo con tu ordenador. Si no conectan, puede que la red del centro aísle los dispositivos; entonces comparte datos desde tu móvil y conectaos a esa red.')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════ Resultados en vivo ══════════════ */

function ResultsPanel({
  snap, roster, onNav,
}: {
  snap: ClassroomSnapshot;
  roster: { n: number; name: string; id: string }[];
  onNav: (s: string) => void;
}) {
  const { t } = useI18n();
  const activity = snap.activity;
  const responses = snap.responses;
  if (!activity) return null;

  const pending = roster.filter(r => !responses.some(x => x.n === r.n));

  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-ttl">{t('Respuestas en directo')}</div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>
          {responses.length}/{roster.length}
        </span>
      </div>

      {responses.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '22px 0' }}>
          {t('Aún no ha contestado nadie. Las respuestas aparecerán aquí solas.')}
        </p>
      ) : activity.type === 'poll' ? (
        <PollResults activity={activity} responses={responses} />
      ) : activity.type === 'brainstorm' ? (
        <BrainstormResults responses={responses} />
      ) : (
        <RubricResults activity={activity} responses={responses} roster={roster} onNav={onNav} />
      )}

      {pending.length > 0 && responses.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 14, paddingTop: 12, borderTop: '0.5px solid var(--border)', lineHeight: 1.5 }}>
          <strong>{t('Faltan:')}</strong> {pending.slice(0, 12).map(p => `${p.n}. ${p.name.split(' ')[0]}`).join(' · ')}
          {pending.length > 12 && t(' y {n} más', { n: pending.length - 12 })}
        </p>
      )}
    </div>
  );
}

function PollResults({ activity, responses }: { activity: ClassroomActivity; responses: ClassroomSnapshot['responses'] }) {
  const opts = activity.options ?? [];
  const counts = opts.map((_, i) => responses.filter(r => r.data?.choice === i).length);
  const total = counts.reduce((a, b) => a + b, 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {opts.map((o, i) => {
        const pct = Math.round((counts[i] / total) * 100);
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                <strong style={{ color: 'var(--accent-d)', marginRight: 7 }}>{String.fromCharCode(65 + i)}</strong>{o}
              </span>
              <span style={{ fontWeight: 800, color: 'var(--text-2)', flexShrink: 0, marginLeft: 10 }}>
                {counts[i]} · {pct}%
              </span>
            </div>
            <div style={{ height: 9, borderRadius: 5, background: 'var(--surface)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 5, background: 'var(--accent-d)', transition: 'width 0.4s' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BrainstormResults({ responses }: { responses: ClassroomSnapshot['responses'] }) {
  const all = responses.flatMap(r => (r.data?.ideas ?? []).map(idea => ({ idea, who: r.name })));
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
      {all.map((x, i) => (
        <div
          key={i}
          style={{
            background: 'var(--surface)', border: '0.5px solid var(--border)',
            borderRadius: 11, padding: '11px 13px', maxWidth: 260,
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45 }}>{x.idea}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>{x.who.split(' ')[0]}</div>
        </div>
      ))}
    </div>
  );
}

function RubricResults({
  activity, responses, roster, onNav,
}: {
  activity: ClassroomActivity;
  responses: ClassroomSnapshot['responses'];
  roster: { n: number; name: string; id: string }[];
  onNav: (s: string) => void;
}) {
  const { t, locale } = useI18n();
  const items = activity.items ?? [];

  const rows = responses.map(r => {
    const scores = r.data?.scores ?? {};
    const vals = items.map(i => scores[i.id]).filter((v): v is number => typeof v === 'number');
    const grade = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / (vals.length * 4)) * 10 * 10) / 10 : null;
    const match = roster.find(x => x.n === r.n);
    return { studentName: r.name, studentId: match?.id ?? null, scores, grade, n: r.n };
  }).sort((a, b) => (a.n ?? 0) - (b.n ?? 0));

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table className="rtable">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>{t('Alumno')}</th>
              {items.map(i => <th key={i.id} style={{ minWidth: 74, fontSize: 10 }}>{i.name.length > 16 ? i.name.slice(0, 15) + '…' : i.name}</th>)}
              <th style={{ minWidth: 62 }}>{t('Media')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.studentName}>
                <td style={{ fontWeight: 600, fontSize: 12.5 }}>{row.n}. {row.studentName}</td>
                {items.map(i => {
                  const v = row.scores[i.id];
                  return (
                    <td key={i.id} style={{ textAlign: 'center' }}>
                      {v ? (
                        <span title={t(LEVEL_LABEL[v - 1])} style={{
                          display: 'inline-block', minWidth: 24, padding: '3px 7px', borderRadius: 7,
                          background: `${LEVEL_COLOR[v - 1]}18`, color: LEVEL_COLOR[v - 1],
                          fontSize: 12.5, fontWeight: 800,
                        }}>{v}</span>
                      ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>
                  {row.grade !== null ? row.grade.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginTop: 14,
        padding: '11px 14px', background: 'var(--surface)', borderRadius: 11,
      }}>
        <Save size={15} color="var(--ok)" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
          {t('Se guarda solo, aunque cierres la sala. Decides después si lo pasas al historial de evaluaciones.')}
        </span>
        <button className="btn-ghost" style={{ fontSize: 12.5, flexShrink: 0 }}
          onClick={() => onNav('selfassess')}>
          {t('Ver autoevaluaciones')}
        </button>
      </div>
    </>
  );
}
