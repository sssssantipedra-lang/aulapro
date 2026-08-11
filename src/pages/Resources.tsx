import { useState } from 'react';
import {
  Layers, Sparkles, Plus, Trash2, Check, FileDown, FileType2, Lightbulb, PenLine,
  Calculator, BookOpen, Languages, FlaskConical, Landmark, Music2, Dumbbell, Palette, Scale,
} from 'lucide-react';
import type { Class, Ficha } from '../types';
import { generateFicha, type FichaContent, type FichaExercise, type FichaExerciseType } from '../services/resources';
import { saveFichaPdf, saveFichaDocx } from '../services/exportFicha';
import { pickMotifKey, MOTIF_COLORS, type FichaMotifKey } from '../services/fichaMotifs';
import { hasApiKey } from '../services/gemini';
import { isoDate } from '../lib/utils';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';
import { isDesktop } from '../services/storage';

/** Mismo motivo que `fichaMotifs.ts`, pero con el componente React del icono en vez de su SVG crudo. */
const MOTIF_ICON_COMPONENT: Record<FichaMotifKey, typeof Sparkles> = {
  matematicas: Calculator,
  lengua: BookOpen,
  ingles: Languages,
  cienciasNaturales: FlaskConical,
  cienciasSociales: Landmark,
  musica: Music2,
  educacionFisica: Dumbbell,
  plastica: Palette,
  valores: Scale,
  general: Sparkles,
};

interface Props {
  classes: Class[];
  fichas: Ficha[];
  onSave: (f: Ficha) => void;
  onDelete: (id: string) => void;
  onNav: (s: string) => void;
}

function newId() {
  return 'fic' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const TIPO_LABEL: Record<FichaExerciseType, string> = {
  abierta: 'Respuesta abierta',
  completar: 'Completar',
  opcion_multiple: 'Opción múltiple',
  problema: 'Problema',
  tabla_rellenar: 'Tabla para rellenar',
  relacionar: 'Relacionar',
  colorear: 'Colorear según el resultado',
};

/** Vista previa de solo lectura de un ejercicio, adaptada a su tipo. */
function ExercisePreview({ ex, i, t }: { ex: FichaExercise; i: number; t: (k: string, v?: Record<string, string | number>) => string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--surface)', border: '0.5px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{
          width: 24, height: 24, borderRadius: 7, flexShrink: 0,
          background: 'var(--accent-l)', color: 'var(--accent-d)', fontSize: 11, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{i + 1}</span>
        <span style={{
          fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 99,
          background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--border)',
        }}>{t(TIPO_LABEL[ex.tipo])}</span>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{ex.enunciado}</div>

      {!!ex.opciones?.length && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 12.5, color: 'var(--text-2)' }}>
          {ex.opciones.map((o, j) => <li key={j}>{String.fromCharCode(97 + j)}) {o}</li>)}
        </ul>
      )}

      {ex.tipo === 'tabla_rellenar' && !!ex.columnas?.length && !!ex.filas?.length && (
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table className="rtable" style={{ fontSize: 12 }}>
            <thead><tr>{ex.columnas.map((col, j) => <th key={j}>{col}</th>)}</tr></thead>
            <tbody>
              {ex.filas.map((fila, fi) => (
                <tr key={fi}>{fila.map((celda, ci) => <td key={ci} style={{ color: celda ? undefined : 'var(--text-3)' }}>{celda || '—'}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ex.tipo === 'relacionar' && !!ex.izquierda?.length && !!ex.derecha?.length && (
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12.5, color: 'var(--text-2)' }}>
          <div style={{ flex: 1 }}>{ex.izquierda.map((it, j) => <div key={j}>{j + 1}. {it}</div>)}</div>
          <div style={{ flex: 1 }}>{ex.derecha.map((it, j) => <div key={j}>{String.fromCharCode(65 + j)}. {it}</div>)}</div>
        </div>
      )}

      {ex.tipo === 'colorear' && (
        <div style={{ marginTop: 8 }}>
          {!!ex.leyenda?.length && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              {ex.leyenda.map((l, j) => (
                <span key={j} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                  {l.color}: {l.criterio}
                </span>
              ))}
            </div>
          )}
          {!!ex.itemsColorear?.length && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 12.5, color: 'var(--text-2)' }}>
              {ex.itemsColorear.map((it, j) => <span key={j}>{it}</span>)}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
        <strong>{t('Solución')}:</strong> {ex.solucion}
      </div>
      {(ex.apoyo || ex.ampliacion) && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
          {ex.apoyo && <div><strong>{t('Apoyo')}:</strong> {ex.apoyo}</div>}
          {ex.ampliacion && <div><strong>{t('Ampliación')}:</strong> {ex.ampliacion}</div>}
        </div>
      )}
    </div>
  );
}

export function Resources({ classes, fichas, onSave, onDelete, onNav }: Props) {
  const { toast } = useToast();
  const { t, lang, locale } = useI18n();

  /* ── Formulario ── */
  const [classId, setClassId] = useState('');
  const [tema, setTema] = useState('');
  const [area, setArea] = useState('');
  const [nivel, setNivel] = useState('');
  const [numEjercicios, setNumEjercicios] = useState(6);
  const [niveles, setNiveles] = useState(false);
  const [contextoClase, setContextoClase] = useState('');

  /* ── Resultado ── */
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState<FichaContent | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const activeClass = classes.find(c => c.id === classId) ?? null;

  function pickClass(id: string) {
    setClassId(id);
    const cls = classes.find(c => c.id === id);
    if (cls) setArea(cls.subject);
  }

  /* ── Generar ── */
  async function handleGenerate() {
    if (!tema.trim()) { toast(t('Escribe el tema de la ficha')); return; }

    const result = await generateFicha({
      tema: tema.trim(), area, nivel, numEjercicios, niveles, contextoClase,
    }, lang, {
      onStart: () => setGenerating(true),
      onEnd: () => setGenerating(false),
      onError: m => toast(m),
    });

    if (!result) { toast(t('La IA no devolvió una ficha válida. Vuelve a intentarlo.')); return; }
    setContent(result);
    setEditingId(null);
  }

  function patch(k: 'titulo' | 'explicacion' | 'instrucciones', v: string) {
    setContent(c => (c ? { ...c, [k]: v } : c));
  }

  function currentFicha(): Ficha | null {
    if (!content) return null;
    return {
      id: editingId ?? newId(),
      at: new Date().toISOString(),
      date: isoDate(),
      class_id: classId || undefined,
      class_name: activeClass?.name,
      title: content.titulo || t('Ficha de trabajo'),
      request: { tema, area, nivel, numEjercicios, niveles, contextoClase },
      content,
    };
  }

  /* ── Guardar ── */
  function handleSave() {
    const f = currentFicha();
    if (!f) return;
    onSave(f);
    setEditingId(f.id);
    toast(t('Ficha guardada'));
  }

  /* ── Exportar ── */
  const CURRENT_KEY = '__current__';
  const [exporting, setExporting] = useState<{ key: string; kind: 'pdf' | 'docx' } | null>(null);

  async function handleExportPdf(f: Ficha | null, key: string) {
    if (!f) return;
    setExporting({ key, kind: 'pdf' });
    const res = await saveFichaPdf(f, lang);
    setExporting(null);
    if (res.error === 'not-desktop') { toast(t('Guardar en PDF solo está disponible en la aplicación de escritorio.')); return; }
    if (res.canceled) return;
    if (res.error) { toast(t('No se pudo generar el PDF: {error}', { error: res.error })); return; }
    toast(t('✅ PDF guardado'));
  }

  async function handleExportDocx(f: Ficha | null, key: string) {
    if (!f) return;
    setExporting({ key, kind: 'docx' });
    try {
      await saveFichaDocx(f, lang);
      toast(t('✅ Word descargado'));
    } catch {
      toast(t('No se pudo generar el documento Word.'));
    } finally {
      setExporting(null);
    }
  }

  function openSaved(f: Ficha) {
    setEditingId(f.id);
    setContent(f.content);
    setClassId(f.class_id ?? '');
    setTema(f.request.tema);
    setArea(f.request.area);
    setNivel(f.request.nivel);
    setNumEjercicios(f.request.numEjercicios);
    setNiveles(f.request.niveles);
    setContextoClase(f.request.contextoClase);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetAll() {
    setContent(null); setEditingId(null); setTema('');
  }

  const sinClave = !hasApiKey();
  /** Fichas guardadas antes de que existieran los bloques de actividad. */
  const actividades = content
    ? (content.actividades?.length ? content.actividades : (
      (content as unknown as { ejercicios?: FichaExercise[] }).ejercicios?.length
        ? [{ titulo: '', ejercicios: (content as unknown as { ejercicios: FichaExercise[] }).ejercicios }]
        : []
    ))
    : [];

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Recursos')}</h1>
          <p className="pg-sub">{t('Genera fichas de trabajo con ayuda de la IA')}</p>
        </div>
        {content && (
          <button className="btn-ghost" onClick={resetAll}>
            <Plus size={14} />{t('Empezar otra')}
          </button>
        )}
      </div>

      {sinClave && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--warn)' }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
            {t('Para generar recursos hace falta la clave gratuita de Google que se configura en Mi Perfil.')}
          </p>
          <button className="btn-accent" style={{ marginTop: 12 }} onClick={() => onNav('profile')}>
            {t('Configurar la IA')}
          </button>
        </div>
      )}

      {/* ══ Formulario ══ */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-hd">
          <div className="card-ttl"><Sparkles size={14} color="var(--accent-d)" />{t('Qué ficha quieres generar')}</div>
        </div>

        <div className="fgroup">
          <label className="flabel">{t('Tema de la ficha')} *</label>
          <input
            className="finput" value={tema} onChange={e => setTema(e.target.value)}
            placeholder={t('Ej: las fracciones equivalentes')}
          />
        </div>

        <div className="frow">
          <div className="fgroup">
            <label className="flabel">{t('Clase')}</label>
            <select className="finput" value={classId} onChange={e => pickClass(e.target.value)}>
              <option value="">{t('Sin clase concreta')}</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="fgroup">
            <label className="flabel">{t('Área o asignatura')}</label>
            <input className="finput" value={area} onChange={e => setArea(e.target.value)} />
          </div>
        </div>

        <div className="frow">
          <div className="fgroup">
            <label className="flabel">{t('Nivel o curso')}</label>
            <input
              className="finput" value={nivel} onChange={e => setNivel(e.target.value)}
              placeholder={t('Ej: 5º de Primaria')}
            />
          </div>
          <div className="fgroup">
            <label className="flabel">{t('Nº de ejercicios')}</label>
            <input
              className="finput" type="number" min={1} max={20} value={numEjercicios}
              onChange={e => setNumEjercicios(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            />
          </div>
        </div>

        <div className="fgroup">
          <label className="flabel">{t('Cómo es el grupo (opcional)')}</label>
          <textarea
            className="finput" rows={2} value={contextoClase}
            onChange={e => setContextoClase(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer', marginBottom: 4 }}>
          <input type="checkbox" checked={niveles} onChange={e => setNiveles(e.target.checked)} />
          {t('Incluir variantes de apoyo y ampliación por ejercicio')}
        </label>
        <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 12 }}>
          {t('Útil como referencia para atender distintos ritmos; no se exportan en la ficha impresa, solo se ven aquí.')}
        </p>

        <div style={{ paddingTop: 14, borderTop: '0.5px solid var(--border)' }}>
          <button className="btn-accent" disabled={generating || sinClave} onClick={handleGenerate}>
            {generating
              ? <><span className="spin" />{t('Generando la ficha…')}</>
              : <><Sparkles size={14} />{t('Generar ficha')}</>}
          </button>
        </div>
      </div>

      {/* ══ Resultado ══ */}
      {content && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-hd">
            <div className="card-ttl"><Layers size={14} color="var(--accent-d)" />{t('Ficha de trabajo')}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {isDesktop() && (
                <button
                  className="btn-ghost" disabled={exporting !== null}
                  onClick={() => handleExportPdf(currentFicha(), CURRENT_KEY)} title={t('Guardar en PDF')}
                >
                  {exporting?.key === CURRENT_KEY && exporting.kind === 'pdf' ? <span className="spin" /> : <FileDown size={14} />}{t('PDF')}
                </button>
              )}
              <button
                className="btn-ghost" disabled={exporting !== null}
                onClick={() => handleExportDocx(currentFicha(), CURRENT_KEY)} title={t('Descargar en Word')}
              >
                {exporting?.key === CURRENT_KEY && exporting.kind === 'docx' ? <span className="spin" /> : <FileType2 size={14} />}{t('Word')}
              </button>
              <button className="btn-accent" onClick={handleSave}>
                <Check size={14} />{t('Guardar')}
              </button>
            </div>
          </div>

          {(() => {
            const motifKey = pickMotifKey(tema, area);
            const motif = MOTIF_COLORS[motifKey];
            const MotifIcon = MOTIF_ICON_COMPONENT[motifKey];
            return (
              <div style={{
                width: 76, height: 76, borderRadius: 16, background: `#${motif.bg}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                float: 'right', marginLeft: 12,
              }}>
                <MotifIcon size={34} color={`#${motif.accent}`} />
              </div>
            );
          })()}

          <div className="fgroup">
            <label className="flabel">{t('Título')}</label>
            <input className="finput" value={content.titulo ?? ''} onChange={e => patch('titulo', e.target.value)} />
          </div>

          <div style={{
            background: 'linear-gradient(135deg, var(--accent-l), rgba(14,165,233,0.05))',
            border: '1.5px solid rgba(14,165,233,0.35)', borderLeft: '4px solid var(--accent-d)',
            borderRadius: 10, padding: '12px 14px 14px', marginBottom: 16,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-d)', marginBottom: 6,
            }}>
              <Lightbulb size={13} />{t('Antes de empezar')}
            </div>
            <textarea
              rows={3} value={content.explicacion ?? ''}
              onChange={e => patch('explicacion', e.target.value)}
              style={{
                width: '100%', resize: 'vertical', background: 'transparent', border: 'none', padding: 0,
                fontFamily: 'var(--font)', fontSize: 13, lineHeight: 1.6, color: 'var(--text)', outline: 'none',
              }}
            />
          </div>

          <div className="fgroup">
            <label className="flabel">{t('Instrucciones')}</label>
            <textarea
              className="finput" rows={2} value={content.instrucciones ?? ''}
              onChange={e => patch('instrucciones', e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          {actividades.map((act, ai) => (
            <div key={ai} className="fgroup">
              <label className="flabel" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {act.titulo ? <><PenLine size={12} />{t('Actividad {n}', { n: ai + 1 })}: {act.titulo}</> : t('Ejercicios')}
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {act.ejercicios.map((ex, i) => <ExercisePreview key={i} ex={ex} i={i} t={t} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ Guardadas ══ */}
      <div className="card">
        <div className="card-hd">
          <div className="card-ttl"><Layers size={14} color="var(--accent-d)" />{t('Mis fichas')}</div>
          {fichas.length > 0 && (
            <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 700 }}>{fichas.length}</span>
          )}
        </div>
        {fichas.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>
            {t('Todavía no has guardado ninguna.')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fichas.map(f => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px',
                borderRadius: 10, background: 'var(--surface)', border: '0.5px solid var(--border)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                    {[f.class_name, f.sda_title ? t('desde «{title}»', { title: f.sda_title }) : f.request.area,
                      new Date(f.at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })]
                      .filter(Boolean).join(' · ')}
                  </div>
                </div>
                {isDesktop() && (
                  <button
                    className="ico-btn" title={t('Guardar en PDF')} disabled={exporting !== null}
                    onClick={() => handleExportPdf(f, f.id)}
                  >
                    {exporting?.key === f.id && exporting.kind === 'pdf' ? <span className="spin" /> : <FileDown size={15} />}
                  </button>
                )}
                <button
                  className="ico-btn" title={t('Descargar en Word')} disabled={exporting !== null}
                  onClick={() => handleExportDocx(f, f.id)}
                >
                  {exporting?.key === f.id && exporting.kind === 'docx' ? <span className="spin" /> : <FileType2 size={15} />}
                </button>
                <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => openSaved(f)}>
                  {t('Abrir')}
                </button>
                <button
                  className="ico-btn" title={t('Eliminar')}
                  onClick={() => {
                    if (!window.confirm(t('¿Eliminar «{name}»?', { name: f.title }))) return;
                    onDelete(f.id);
                    if (editingId === f.id) resetAll();
                  }}
                >
                  <Trash2 size={14} color="var(--danger)" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
