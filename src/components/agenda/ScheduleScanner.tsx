import { useRef, useState } from 'react';
import {
  Upload, Sparkles, X, Check, FileSpreadsheet, Image as ImageIcon,
  AlertTriangle, Table2,
} from 'lucide-react';
import type { Class, ScheduleBlock } from '../../types';
import { callGemini, parseGeminiJson, hasApiKey, type InlineFile } from '../../services/gemini';
import { fileToBase64 } from '../../lib/utils';
import { PALETTE } from '../../lib/demoData';
import { useToast } from '../ui/Toast';

interface Props {
  open: boolean;
  classes: Class[];
  onClose: () => void;
  onImport: (blocks: ScheduleBlock[]) => void;
  onNav: (s: string) => void;
}

/** Fila que devuelve la IA antes de que el docente la revise. */
interface DetectedBlock {
  day: number;
  time_start: string;
  time_end: string;
  subject: string;
  room?: string;
  className?: string;
}

const DAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const MAX_FILE_BYTES = 19 * 1024 * 1024;

const SYSTEM_PROMPT =
  'Eres un asistente que lee horarios escolares españoles y los convierte en datos estructurados. ' +
  'Respondes SOLO con JSON válido, sin explicaciones ni marcas de código.';

/** Normaliza «9», «9:5», «09.30» a formato HH:MM. */
function normalizeTime(raw: unknown): string | null {
  const s = String(raw ?? '').trim().replace(/[.h]/g, ':');
  const m = s.match(/^(\d{1,2}):?(\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function ScheduleScanner({ open, classes, onClose, onImport, onNav }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [reading, setReading]   = useState(false);
  const [scanning, setScanning] = useState(false);
  const [detected, setDetected] = useState<DetectedBlock[] | null>(null);
  const [skipped, setSkipped]   = useState<Set<number>>(new Set());
  const [error, setError]       = useState('');

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
      const csv = XLSX.utils.sheet_to_csv(book.Sheets[name], { blankrows: false });
      return `--- Hoja: ${name} ---\n${csv}`;
    }).join('\n\n').slice(0, 24000);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setError('El archivo supera el límite de 19 MB.'); return; }

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
      setError('No se pudo leer el archivo. Prueba a guardarlo como CSV o hacerle una foto.');
      return;
    }
    setReading(false);
    await scan(textContent, inline);
  }

  async function scan(textContent: string, inline: InlineFile | null) {
    const known = classes.map(c => c.name).join(', ');
    const userPrompt =
      'Extrae el horario semanal de un docente a partir de lo que te paso.\n\n' +
      (textContent ? `CONTENIDO:\n${textContent}\n\n` : 'El horario está en el archivo adjunto.\n\n') +
      (known ? `GRUPOS QUE YA EXISTEN en la aplicación: ${known}. Usa exactamente estos nombres cuando coincidan.\n\n` : '') +
      'REGLAS:\n' +
      '- Devuelve una fila por cada sesión de clase del docente.\n' +
      '- "day": 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes.\n' +
      '- "time_start" y "time_end" en formato HH:MM de 24 horas.\n' +
      '- "subject": la asignatura. "className": el grupo (ej. «3º ESO A») si aparece. "room": el aula si aparece.\n' +
      '- Ignora recreos, guardias, reuniones y horas libres.\n' +
      '- Si una celda junta grupo y asignatura (ej. «3ºA Matemáticas»), sepáralos.\n' +
      '- Si no puedes deducir la hora de fin, calcula una sesión de 55 minutos.\n\n' +
      'Formato exacto:\n' +
      '{"blocks":[{"day":1,"time_start":"08:30","time_end":"09:25","subject":"Matemáticas","className":"3º ESO A","room":"Aula 12"}]}';

    const raw = await callGemini(SYSTEM_PROMPT, userPrompt, inline ? [inline] : [], {
      onStart: () => setScanning(true),
      onEnd: () => setScanning(false),
      onError: msg => setError(msg),
    });
    if (!raw) return;

    const parsed = parseGeminiJson<{ blocks: DetectedBlock[] }>(raw);
    const rows = (parsed?.blocks ?? [])
      .map(b => {
        const start = normalizeTime(b.time_start);
        const end = normalizeTime(b.time_end);
        const day = Number(b.day);
        if (!start || !String(b.subject ?? '').trim() || day < 1 || day > 5) return null;
        return {
          day,
          time_start: start,
          time_end: end && end > start ? end : addMinutes(start, 55),
          subject: String(b.subject).trim().slice(0, 60),
          room: String(b.room ?? '').trim().slice(0, 30),
          className: String(b.className ?? '').trim().slice(0, 40),
        } as DetectedBlock;
      })
      .filter((b): b is DetectedBlock => b !== null)
      .sort((a, b) => a.day - b.day || a.time_start.localeCompare(b.time_start));

    if (rows.length === 0) {
      setError('No se ha reconocido ningún horario. Prueba con una foto más nítida o con el archivo en CSV.');
      return;
    }
    setDetected(rows);
  }

  function addMinutes(hhmm: string, mins: number): string {
    const [h, m] = hhmm.split(':').map(Number);
    const total = h * 60 + m + mins;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  function confirm() {
    if (!detected) return;
    const rows = detected.filter((_, i) => !skipped.has(i));
    if (rows.length === 0) { toast('No has dejado ninguna sesión marcada'); return; }

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

    onImport(blocks);
    reset();
    onClose();
  }

  const busy = reading || scanning;

  return (
    <div className={`modal-overlay${open ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget && !busy) { reset(); onClose(); } }}>
      <div className="modal wide" style={{ maxHeight: '92vh' }}>
        <div className="modal-hd">
          <div>
            <div className="modal-title">Escanear mi horario</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3 }}>
              La IA lee tu horario y crea los bloques por ti
            </p>
          </div>
          <button className="ico-btn" onClick={() => { if (!busy) { reset(); onClose(); } }}><X size={18} /></button>
        </div>

        {!hasApiKey() ? (
          <div style={{ textAlign: 'center', padding: '26px 20px' }}>
            <Sparkles size={30} color="var(--warn)" style={{ margin: '0 auto 14px' }} />
            <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
              Para leer el horario hace falta la clave gratuita de Google que se configura en Mi Perfil.
            </p>
            <button className="btn-accent" onClick={() => { onClose(); onNav('profile'); }}>
              Configurar la IA
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
                Se han detectado {detected.length} sesiones. <strong>Revísalas antes de añadirlas</strong> y
                desmarca las que no sean tuyas.
              </span>
            </div>

            <div style={{ maxHeight: 360, overflowY: 'auto', border: '0.5px solid var(--border)', borderRadius: 10 }}>
              <table className="rtable" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }} />
                    <th style={{ textAlign: 'left' }}>Día</th>
                    <th style={{ textAlign: 'left' }}>Hora</th>
                    <th style={{ textAlign: 'left' }}>Asignatura</th>
                    <th style={{ textAlign: 'left' }}>Grupo</th>
                    <th style={{ textAlign: 'left' }}>Aula</th>
                  </tr>
                </thead>
                <tbody>
                  {detected.map((b, i) => {
                    const off = skipped.has(i);
                    return (
                      <tr key={i} style={{ opacity: off ? 0.4 : 1 }}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={!off}
                            onChange={() => setSkipped(prev => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i); else next.add(i);
                              return next;
                            })}
                            style={{ cursor: 'pointer', accentColor: 'var(--accent-d)', width: 15, height: 15 }}
                          />
                        </td>
                        <td style={{ fontSize: 12.5, fontWeight: 600 }}>{DAY_NAMES[b.day]}</td>
                        <td style={{ fontSize: 12.5, fontFamily: 'ui-monospace, Menlo, monospace' }}>
                          {b.time_start}–{b.time_end}
                        </td>
                        <td style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{b.subject}</td>
                        <td style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{b.className || '—'}</td>
                        <td style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{b.room || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
              <button className="btn-accent" onClick={confirm}>
                <Check size={14} />Añadir {detected.length - skipped.size} sesiones
              </button>
              <button className="btn-ghost" onClick={() => { reset(); fileRef.current?.click(); }}>
                Probar con otro archivo
              </button>
              <div style={{ flex: 1 }} />
              <p style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Se añaden a tu horario actual</p>
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
                    {reading ? 'Leyendo el archivo…' : 'La IA está interpretando tu horario…'}
                  </span>
                  {fileName && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{fileName}</span>}
                </>
              ) : (
                <>
                  <Upload size={28} color="var(--accent-d)" />
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>
                    Elige tu horario
                  </span>
                  <span style={{ fontSize: 12.5, color: 'var(--text-2)', textAlign: 'center', lineHeight: 1.55, maxWidth: 380 }}>
                    Vale una foto del papel, una captura, un PDF, un Excel o un CSV.
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
                { icon: <ImageIcon size={15} />, label: 'Foto o captura', desc: 'Del horario en papel' },
                { icon: <FileSpreadsheet size={15} />, label: 'Excel o CSV', desc: 'El del centro' },
                { icon: <Table2 size={15} />, label: 'PDF', desc: 'Tal cual te lo dieron' },
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
                border: '0.5px solid rgba(239,68,68,0.3)', fontSize: 12.5, color: '#dc2626', lineHeight: 1.5,
              }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}

            <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 16, lineHeight: 1.55 }}>
              El archivo se envía a Google para interpretarlo. Podrás revisar todo antes de que se añada nada.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
