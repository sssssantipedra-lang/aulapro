import { useRef, useState } from 'react';
import {
  Upload, Sparkles, X, Check, FileSpreadsheet, Image as ImageIcon,
  AlertTriangle, Table2,
} from 'lucide-react';
import type { Class, ScheduleBlock } from '../../types';
import { callGemini, parseGeminiJson, hasApiKey, type InlineFile } from '../../services/gemini';
import {
  gridToBlocks, fillMergedCells, SCHEDULE_GRID_SCHEMA, type DetectedBlock, type ScheduleGrid,
} from '../../services/scheduleGrid';
import { fileToBase64 } from '../../lib/utils';
import { PALETTE } from '../../lib/demoData';
import { useToast } from '../ui/Toast';
import { useI18n, weekdayLabel } from '../../i18n';
import { requestSettingsPanel } from '../../lib/settingsNav';

interface Props {
  open: boolean;
  classes: Class[];
  onClose: () => void;
  /** Sesiones que ya tiene el horario: si hay, se ofrece sustituirlas. */
  existingCount: number;
  /** `replace`: el horario escaneado sustituye al actual en vez de sumarse. */
  onImport: (blocks: ScheduleBlock[], replace: boolean) => void;
  onNav: (s: string) => void;
}

const MAX_FILE_BYTES = 19 * 1024 * 1024;

const SYSTEM_PROMPT =
  'Eres un asistente que transcribe horarios escolares españoles a datos estructurados, ' +
  'copiando la tabla tal cual, celda a celda, sin reordenar ni resumir nada.';

export function ScheduleScanner({ open, classes, existingCount, onClose, onImport, onNav }: Props) {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [reading, setReading]   = useState(false);
  const [scanning, setScanning] = useState(false);
  const [detected, setDetected] = useState<DetectedBlock[] | null>(null);
  const [skipped, setSkipped]   = useState<Set<number>>(new Set());
  const [error, setError]       = useState('');
  const [replace, setReplace]   = useState(false);

  function reset() {
    setFileName('');
    setDetected(null);
    setSkipped(new Set());
    setError('');
  }

  /** Convierte una hoja de cálculo en texto para que la IA pueda leerla. */
  async function sheetToText(file: File): Promise<string> {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const book = XLSX.read(buffer, { type: 'array' });
    return book.SheetNames.map(name => {
      // Las celdas combinadas solo guardan el texto en su esquina: sin
      // rellenarlas, una clase de dos horas o el recreo dejarían huecos y la
      // tabla llegaría descuadrada.
      fillMergedCells(book.Sheets[name] as never, XLSX.utils.encode_cell);
      const csv = XLSX.utils.sheet_to_csv(book.Sheets[name], { blankrows: false });
      return `--- Hoja: ${name} ---\n${csv}`;
    }).join('\n\n').slice(0, 24000);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setError(t('El archivo supera el límite de 19 MB.')); return; }

    reset();
    setFileName(file.name);
    setReading(true);

    let textContent = '';
    let inline: InlineFile | null = null;
    const lower = file.name.toLowerCase();

    try {
      if (/\.(xlsx|xlsm|xls)$/.test(lower)) {
        textContent = await sheetToText(file);
      } else if (/\.(csv|txt|tsv)$/.test(lower)) {
        textContent = (await file.text()).slice(0, 24000);
      } else {
        // Imagen o PDF: se le manda tal cual a la IA
        inline = await fileToBase64(file);
      }
    } catch {
      setReading(false);
      setError(t('No se pudo leer el archivo. Prueba a guardarlo como CSV o hacerle una foto.'));
      return;
    }
    setReading(false);
    await scan(textContent, inline);
  }

  async function scan(textContent: string, inline: InlineFile | null) {
    const known = classes.map(c => c.name).join(', ');
    const userPrompt =
      'Transcribe el horario semanal de un docente que te paso.\n\n' +
      (textContent ? `CONTENIDO (hoja de cálculo en CSV):\n${textContent}\n\n` : 'El horario está en el archivo adjunto.\n\n') +
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

    const raw = await callGemini(SYSTEM_PROMPT, userPrompt, inline ? [inline] : [], {
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
      setError(t('No se ha reconocido ningún horario. Prueba con una foto más nítida o con el archivo en CSV.'));
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
    reset();
    onClose();
  }

  const busy = reading || scanning;

  // Franjas y días que aparecen en lo detectado, para pintar la semana.
  const weekDays = [1, 2, 3, 4, 5];
  const slots = detected
    ? [...new Map(detected.map(b => [`${b.time_start}-${b.time_end}`, { key: `${b.time_start}-${b.time_end}`, start: b.time_start, end: b.time_end }])).values()]
        .sort((x, y) => x.start.localeCompare(y.start) || x.end.localeCompare(y.end))
    : [];

  return (
    <div className={`modal-overlay${open ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget && !busy) { reset(); onClose(); } }}>
      <div className="modal wide" style={{ maxHeight: '92vh' }}>
        <div className="modal-hd">
          <div>
            <div className="modal-title">{t('Escanear mi horario')}</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3 }}>
              {t('La IA lee tu horario y crea los bloques por ti')}
            </p>
          </div>
          <button className="ico-btn" onClick={() => { if (!busy) { reset(); onClose(); } }} aria-label={t('Cerrar')} title={t('Cerrar')}><X size={18} /></button>
        </div>

        {!hasApiKey() ? (
          <div style={{ textAlign: 'center', padding: '26px 20px' }}>
            <Sparkles size={30} color="var(--warn)" style={{ margin: '0 auto 14px' }} />
            <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
              {t('Para leer el horario hace falta la clave gratuita de Google que se configura en Configuración.')}
            </p>
            <button className="btn-accent" onClick={() => { onClose(); requestSettingsPanel('ia'); onNav('profile'); }}>
              {t('Configurar la IA')}
            </button>
          </div>
        ) : detected ? (
          /* ── Revisión antes de importar ── */
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
              <button className="btn-ghost" onClick={() => { reset(); fileRef.current?.click(); }}>
                {t('Probar con otro archivo')}
              </button>
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
          /* ── Subir archivo ── */
          <>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              style={{
                width: '100%', padding: '34px 20px', borderRadius: 14, cursor: busy ? 'default' : 'pointer',
                background: 'var(--surface)', border: '1.5px dashed var(--border)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                fontFamily: 'var(--font)',
              }}
            >
              {busy ? (
                <>
                  <span className="spin" />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    {t(reading ? 'Leyendo el archivo…' : 'La IA está interpretando tu horario…')}
                  </span>
                  {fileName && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{fileName}</span>}
                </>
              ) : (
                <>
                  <Upload size={28} color="var(--accent-d)" />
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>
                    {t('Elige tu horario')}
                  </span>
                  <span style={{ fontSize: 12.5, color: 'var(--text-2)', textAlign: 'center', lineHeight: 1.55, maxWidth: 380 }}>
                    {t('Vale una foto del papel, una captura, un PDF, un Excel o un CSV.')}
                  </span>
                </>
              )}
            </button>

            <input
              ref={fileRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFile}
              accept=".xlsx,.xlsm,.xls,.csv,.tsv,.txt,.pdf,image/*"
            />

            <div style={{ display: 'flex', gap: 16, marginTop: 18, flexWrap: 'wrap' }}>
              {[
                { icon: <ImageIcon size={15} />, label: t('Foto o captura'), desc: t('Del horario en papel') },
                { icon: <FileSpreadsheet size={15} />, label: t('Excel o CSV'), desc: t('El del centro') },
                { icon: <Table2 size={15} />, label: 'PDF', desc: t('Tal cual te lo dieron') },
              ].map(x => (
                <div key={x.label} style={{ display: 'flex', alignItems: 'center', gap: 9, flex: '1 1 150px' }}>
                  <span style={{
                    width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                    background: 'var(--accent-l)', color: 'var(--accent-d)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {x.icon}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{x.label}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)' }}>{x.desc}</span>
                  </span>
                </div>
              ))}
            </div>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 16,
                padding: '11px 14px', borderRadius: 9, background: 'rgba(239,68,68,0.08)',
                border: '0.5px solid rgba(239,68,68,0.3)', fontSize: 12.5, color: 'var(--danger)', lineHeight: 1.5,
              }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}

            <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 16, lineHeight: 1.55 }}>
              {t('El archivo se envía a Google para interpretarlo. Podrás revisar todo antes de que se añada nada.')}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
