import { useEffect, useState } from 'react';
import { Sparkles, X, Check, AlertTriangle, ScanSearch } from 'lucide-react';
import type { Class, HorarioDocumento, ScheduleBlock } from '../../types';
import { callGemini, parseGeminiJson, hasApiKey } from '../../services/gemini';
import { gridToBlocks, SCHEDULE_GRID_SCHEMA, type DetectedBlock, type ScheduleGrid } from '../../services/scheduleGrid';
import { detectarClases } from '../../services/horarioPdf';
import { PALETTE } from '../../lib/demoData';
import { useToast } from '../ui/Toast';
import { useI18n, weekdayLabel } from '../../i18n';
import { requestSettingsPanel } from '../../lib/settingsNav';

interface Props {
  open: boolean;
  doc: HorarioDocumento | null;
  classes: Class[];
  onClose: () => void;
  /** Sesiones que ya tiene el horario: si hay, se ofrece sustituirlas. */
  existingCount: number;
  /** `replace`: las clases del documento sustituyen al horario actual en vez de sumarse. */
  onImport: (blocks: ScheduleBlock[], replace: boolean) => void;
  onNav: (s: string) => void;
}

const SYSTEM_PROMPT =
  'Eres un asistente que transcribe horarios escolares españoles a datos estructurados, ' +
  'copiando la tabla tal cual, celda a celda, sin reordenar ni resumir nada.';

/**
 * Las clases de la semana a partir del documento del horario. Primero se lee
 * el texto del PDF en el propio equipo (sin IA, `services/horarioPdf.ts`); la
 * IA solo entra si el docente la pide, para una foto o un PDF escaneado.
 */
export function ClasesDelHorario(props: Props) {
  // Se monta al abrir: cada apertura lee el documento de cero, con el estado limpio
  return props.open && props.doc ? <Dialogo {...props} doc={props.doc} /> : null;
}

function Dialogo({ doc, classes, existingCount, onClose, onImport, onNav }: Props & { doc: HorarioDocumento }) {
  const { toast } = useToast();
  const { t, locale } = useI18n();

  const [leyendo, setLeyendo]   = useState(true);
  const [scanning, setScanning] = useState(false);
  const [detected, setDetected] = useState<DetectedBlock[] | null>(null);
  const [skipped, setSkipped]   = useState<Set<number>>(new Set());
  const [error, setError]       = useState('');
  const [replace, setReplace]   = useState(false);
  // Los grupos que ya existen ayudan a reconocer cada celda
  const [grupos] = useState(() => classes.map(c => c.name));

  function cerrar() { onClose(); }

  // Al abrir, se leen las clases del documento sin gastar IA
  useEffect(() => {
    let vivo = true;
    detectarClases(doc, grupos).then(bloques => {
      if (!vivo) return;
      setLeyendo(false);
      setDetected(bloques.length > 0 ? bloques : null);
    });
    return () => { vivo = false; };
  }, [doc, grupos]);

  async function conIA() {
    setError('');
    const known = classes.map(c => c.name).join(', ');
    const userPrompt =
      'Transcribe el horario semanal de un docente que te paso.\n\n' +
      'El horario está en el archivo adjunto.\n\n' +
      (known ? `GRUPOS QUE YA EXISTEN en la aplicación: ${known}. Si un grupo del horario es uno de estos, escríbelo exactamente así.\n\n` : '') +
      'NO calcules tú en qué día u hora cae cada clase: limítate a copiar la tabla y la aplicación lo calcula por la posición de cada celda. Por eso es imprescindible que ninguna celda cambie de sitio.\n\n' +
      'CÓMO TRANSCRIBIR:\n' +
      '- "dayHeaders": las cabeceras de las columnas de días, de izquierda a derecha, tal como aparecen. No incluyas la columna de las horas.\n' +
      '- "rows": una fila por cada franja horaria, de arriba abajo, en el mismo orden que en el horario. Incluye también las filas de recreo (con "isBreak": true) y las franjas en las que el docente no tiene clase ningún día.\n' +
      '- "start" y "end": la hora de inicio y de fin de esa fila (HH:MM, 24 horas). Léelas de la columna de horas de ESA fila; si solo aparece una hora, déjala en "start" y "end" vacío.\n' +
      '- "cells": EXACTAMENTE una celda por cabecera de "dayHeaders", en el mismo orden. Si la celda está vacía, pon todos sus campos a "". Nunca te saltes una celda vacía ni juntes dos.\n' +
      '- Si una celda combinada ocupa varias filas (una clase de dos horas), repite su contenido en cada una de esas filas.\n' +
      '- Si el horario pone los días en filas y las horas en columnas, gíralo: cada franja horaria sigue siendo una entrada de "rows".\n' +
      '- En cada celda separa "subject" (la asignatura), "group" (el grupo o curso, p. ej. «3º ESO A») y "room" (el aula). Si una celda junta grupo y asignatura (p. ej. «3ºA MAT»), sepáralos. Copia las guardias, reuniones y horas libres como "subject"; ya se descartan después.\n' +
      '- Si el archivo trae varios horarios, transcribe solo el del docente (el que tiene sus clases).';

    const raw = await callGemini(SYSTEM_PROMPT, userPrompt, [{ name: doc.name, mimeType: doc.mimeType, base64: doc.base64 }], {
      onStart: () => setScanning(true),
      onEnd: () => setScanning(false),
      onError: msg => setError(msg),
    }, {
      responseSchema: SCHEDULE_GRID_SCHEMA,
      // Leer bien una tabla de una foto es justo donde razonar compensa: un
      // horario mal colocado cuesta más que unos segundos de espera.
      thinkingLevel: 'high',
      maxOutputTokens: 16384,
    });
    if (!raw) return;

    const rows = gridToBlocks(parseGeminiJson<ScheduleGrid>(raw));
    if (rows.length === 0) {
      setError(t('No se ha reconocido ningún horario. Prueba con una foto más nítida.'));
      return;
    }
    setDetected(rows);
  }

  function confirm() {
    if (!detected) return;
    const rows = detected.filter((_, i) => !skipped.has(i));
    if (rows.length === 0) { toast(t('No has dejado ninguna sesión marcada')); return; }

    const blocks: ScheduleBlock[] = rows.map((b, i) => {
      // Se intenta encajar con un grupo que ya exista para heredar su color
      const match = classes.find(c =>
        c.name.toLowerCase().replace(/\s+/g, '') === (b.className ?? '').toLowerCase().replace(/\s+/g, ''));
      return {
        id: 'blk' + Date.now() + '_' + i,
        day: b.day,
        time_start: b.time_start,
        time_end: b.time_end,
        subject: b.className ? `${b.className} - ${b.subject}` : b.subject,
        room: b.room ?? '',
        class_id: match?.id ?? '',
        color: match?.color ?? PALETTE[i % PALETTE.length],
      };
    });

    onImport(blocks, replace && existingCount > 0);
    cerrar();
  }

  const busy = leyendo || scanning;

  // Franjas y días que aparecen en lo detectado, para pintar la semana.
  const weekDays = [1, 2, 3, 4, 5];
  const slots = detected
    ? [...new Map(detected.map(b => [`${b.time_start}-${b.time_end}`, { key: `${b.time_start}-${b.time_end}`, start: b.time_start, end: b.time_end }])).values()]
        .sort((x, y) => x.start.localeCompare(y.start) || x.end.localeCompare(y.end))
    : [];

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget && !busy) cerrar(); }}>
      <div className="modal wide" style={{ maxHeight: '92vh' }}>
        <div className="modal-hd">
          <div>
            <div className="modal-title">{t('Detectar mis clases')}</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3 }}>
              {t('La aplicación lee tu horario y coloca las clases de cada día para el Inicio')}
            </p>
          </div>
          <button className="ico-btn" onClick={() => { if (!busy) cerrar(); }} aria-label={t('Cerrar')} title={t('Cerrar')}><X size={18} /></button>
        </div>

        {busy ? (
          <div style={{ textAlign: 'center', padding: '34px 20px' }}>
            <span className="spin" />
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 12 }}>
              {t(leyendo ? 'Leyendo tu horario…' : 'La IA está interpretando tu horario…')}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{doc.name}</p>
          </div>
        ) : detected ? (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', marginBottom: 14,
              background: 'var(--accent-l)', borderRadius: 10, fontSize: 12.5, color: 'var(--accent-d)',
            }}>
              <Check size={15} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, lineHeight: 1.5 }}>
                {t('Se han detectado {n} sesiones.', { n: detected.length })} <strong>{t('Revísalas antes de añadirlas')}</strong>{' '}
                {t('Pulsa una sesión para quitarla si no es tuya.')}
              </span>
            </div>

            {error && (
              <p role="alert" style={{ fontSize: 12.5, color: 'var(--danger)', margin: '0 0 12px', lineHeight: 1.5 }}>{error}</p>
            )}

            {/* La semana como en el papel: así salta a la vista si algo cae en otra hora u otro día */}
            <div className="scan-week" role="grid" aria-label={t('Horario detectado')}>
              <div className="scan-week-row scan-week-hd" role="row">
                <span role="columnheader" />
                {weekDays.map(d => <span key={d} role="columnheader">{weekdayLabel(d - 1, locale)}</span>)}
              </div>
              {slots.map(slot => (
                <div key={slot.key} className="scan-week-row" role="row">
                  <span className="scan-week-time" role="rowheader">{slot.start}<br />{slot.end}</span>
                  {weekDays.map(d => (
                    <span key={d} className="scan-week-cell" role="gridcell">
                      {detected.map((b, i) => (b.day === d && `${b.time_start}-${b.time_end}` === slot.key) ? (
                        <button
                          key={i} type="button"
                          className={`scan-block${skipped.has(i) ? ' off' : ''}`}
                          aria-pressed={!skipped.has(i)}
                          title={skipped.has(i) ? t('No se añadirá. Pulsa para recuperarla.') : t('Pulsa para no añadirla')}
                          onClick={() => setSkipped(prev => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i); else next.add(i);
                            return next;
                          })}
                        >
                          <strong>{b.subject}</strong>
                          {(b.className || b.room) && (
                            <small>{[b.className, b.room].filter(Boolean).join(' · ')}</small>
                          )}
                        </button>
                      ) : null)}
                    </span>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn-accent" onClick={confirm}>
                <Check size={14} />
                {t(detected.length - skipped.size === 1 ? 'Añadir {n} sesión' : 'Añadir {n} sesiones', { n: detected.length - skipped.size })}
              </button>
              {hasApiKey() && (
                <button className="btn-ghost" onClick={conIA} title={t('El documento se enviaría a Google para interpretarlo. Podrás revisar todo antes de que se añada nada.')}>
                  <Sparkles size={14} /> {t('No es esto: probar con la IA')}
                </button>
              )}
              <div style={{ flex: 1 }} />
              {existingCount > 0 ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer' }}>
                  <input
                    type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)}
                    style={{ width: 15, height: 15, accentColor: 'var(--accent-d)' }}
                  />
                  {t('Sustituir mi horario actual ({n} sesiones)', { n: existingCount })}
                </label>
              ) : (
                <p style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{t('Se añaden a tu horario actual')}</p>
              )}
            </div>
          </>
        ) : (
          /* ── No se han podido leer las clases del documento ── */
          <div style={{ padding: '10px 4px 4px' }}>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 10,
              background: 'var(--warn-bg)', color: 'var(--warn-fg)', fontSize: 13, lineHeight: 1.55,
            }}>
              <ScanSearch size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                {t(doc.mimeType === 'application/pdf'
                  ? 'No he podido leer las clases de este PDF: puede ser una imagen dentro del PDF o una tabla con otro formato.'
                  : 'Una foto no se puede leer sin IA: la aplicación no distingue el texto de una imagen.')}
              </span>
            </div>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 14,
                padding: '11px 14px', borderRadius: 9, background: 'rgba(239,68,68,0.08)',
                border: '0.5px solid rgba(239,68,68,0.3)', fontSize: 12.5, color: 'var(--danger)', lineHeight: 1.5,
              }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}

            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: '16px 0 14px' }}>
              {t('Puedes apuntar las clases a mano con «Nuevo bloque» en el menú Horario, o, si quieres, pedirle a la IA que lea el documento.')}
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {hasApiKey() ? (
                <button className="btn-accent" onClick={conIA}>
                  <Sparkles size={14} /> {t('Leer con la IA')}
                </button>
              ) : (
                <button className="btn-ghost" onClick={() => { cerrar(); requestSettingsPanel('ia'); onNav('profile'); }}>
                  <Sparkles size={14} /> {t('Configurar la IA')}
                </button>
              )}
              <button className="btn-ghost" onClick={cerrar}>{t('Las apunto a mano')}</button>
            </div>
            {hasApiKey() && (
              <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 14, lineHeight: 1.55 }}>
                {t('El documento se enviaría a Google para interpretarlo. Podrás revisar todo antes de que se añada nada.')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
