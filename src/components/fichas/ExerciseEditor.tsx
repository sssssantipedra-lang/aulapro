/**
 * Un ejercicio de la ficha como bloque editable: enunciado, los campos
 * propios de su tipo, la solución y las acciones (subir, bajar, borrar y
 * rehacer con IA siguiendo una indicación: «más fácil», «otro distinto»…).
 */
import { useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, Wand2, ChevronDown, ChevronRight } from 'lucide-react';
import { prepareExercise, shuffleApart, TIPOS, type FichaExercise, type FichaExerciseType } from '../../services/resources';
import { TIPO_LABEL, TIPO_EMOJI } from './tipos';

const QUICK = ['Más fácil', 'Más difícil', 'Otro distinto', 'Más visual y motivador'];

type T = (k: string, v?: Record<string, string | number>) => string;

const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);

/** Lista de una línea por elemento; se aplica al salir del campo para no rehacer rejillas a cada tecla. */
function LinesField({ label, value, onCommit, hint }: { label: string; value: string[]; onCommit: (v: string[]) => void; hint?: string }) {
  const joined = value.join('\n');
  const [text, setText] = useState(joined);
  const [base, setBase] = useState(joined);
  if (base !== joined) { setBase(joined); setText(joined); }
  return (
    <label className="fe-field">
      <span className="fe-lbl">{label}{hint && <em> · {hint}</em>}</span>
      <textarea
        className="finput" rows={Math.min(8, Math.max(2, value.length + 1))} value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => { if (text !== joined) onCommit(lines(text)); }}
      />
    </label>
  );
}

interface Props {
  ex: FichaExercise;
  n: number;
  id: string;
  selected: boolean;
  first: boolean;
  last: boolean;
  busy: boolean;
  aiDisabled: boolean;
  t: T;
  onSelect: () => void;
  onChange: (ex: FichaExercise) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onRegenerate: (instruccion: string, tipo?: FichaExerciseType) => void;
}

export function ExerciseEditor({ ex, n, id, selected, first, last, busy, aiDisabled, t, onSelect, onChange, onMove, onDelete, onRegenerate }: Props) {
  const [redo, setRedo] = useState(false);
  const [instr, setInstr] = useState('');
  const [tipo, setTipo] = useState<FichaExerciseType | ''>('');
  const [showSol, setShowSol] = useState(false);
  const set = (p: Partial<FichaExercise>) => onChange({ ...ex, ...p });

  const run = (instruccion: string) => {
    onRegenerate(instruccion, tipo || undefined);
    setRedo(false); setInstr(''); setTipo('');
  };

  return (
    <div className={`fe-ex${selected ? ' sel' : ''}${busy ? ' busy' : ''}`} data-block={id} onFocusCapture={onSelect} onClick={onSelect}>
      <div className="fe-ex-hd">
        <span className="fe-ex-n">{n}</span>
        <span className="fe-type">{TIPO_EMOJI[ex.tipo]} {t(TIPO_LABEL[ex.tipo])}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className={`fe-redo-btn${redo ? ' on' : ''}`} disabled={aiDisabled || busy} onClick={() => setRedo(r => !r)}>
          {busy ? <span className="spin" /> : <Wand2 size={13} />}{t('Rehacer')}
        </button>
        <button type="button" className="ico-btn sm" title={t('Subir')} aria-label={t('Subir')} disabled={first} onClick={() => onMove(-1)}><ArrowUp size={14} /></button>
        <button type="button" className="ico-btn sm" title={t('Bajar')} aria-label={t('Bajar')} disabled={last} onClick={() => onMove(1)}><ArrowDown size={14} /></button>
        <button type="button" className="ico-btn sm" title={t('Eliminar')} aria-label={t('Eliminar')} onClick={onDelete}><Trash2 size={14} color="var(--danger)" /></button>
      </div>

      {redo && (
        <div className="fe-redo">
          <div className="fe-redo-quick">
            {QUICK.map(q => <button key={q} type="button" className="chip sm" onClick={() => run(q)}>{t(q)}</button>)}
          </div>
          <div className="fe-redo-row">
            <input
              className="finput" value={instr} onChange={e => setInstr(e.target.value)}
              placeholder={t('O dile qué cambiar: «con números más pequeños»…')}
              onKeyDown={e => { if (e.key === 'Enter' && (instr.trim() || tipo)) run(instr.trim()); }}
            />
            <select className="finput" value={tipo} onChange={e => setTipo(e.target.value as FichaExerciseType | '')} aria-label={t('Tipo de ejercicio')}>
              <option value="">{t('Mismo tipo')}</option>
              {TIPOS.map(x => <option key={x} value={x}>{TIPO_EMOJI[x]} {t(TIPO_LABEL[x])}</option>)}
            </select>
            <button type="button" className="btn-accent" disabled={!instr.trim() && !tipo} onClick={() => run(instr.trim())}>
              <Wand2 size={14} />{t('Rehacer')}
            </button>
          </div>
        </div>
      )}

      <textarea
        className="finput fe-enun" rows={2} value={ex.enunciado}
        aria-label={t('Enunciado')}
        onChange={e => set({ enunciado: e.target.value })}
      />

      {ex.tipo === 'opcion_multiple' && (
        <LinesField label={t('Opciones')} value={ex.opciones ?? []} onCommit={v => set({ opciones: v })} />
      )}
      {ex.tipo === 'verdadero_falso' && (
        <LinesField label={t('Afirmaciones')} value={ex.afirmaciones ?? []} onCommit={v => set({ afirmaciones: v })} />
      )}
      {ex.tipo === 'ordenar' && (
        <LinesField
          label={t('En su orden correcto')} hint={t('en la ficha salen desordenados')}
          value={ex.ordenCorrecto ?? ex.elementos ?? []}
          onCommit={v => set({ ordenCorrecto: v, elementos: shuffleApart(v) })}
        />
      )}
      {ex.tipo === 'sopa_letras' && (
        <LinesField
          label={t('Palabras')} hint={t('la sopa se rehace al cambiarlas')} value={ex.palabras ?? []}
          onCommit={v => onChange(prepareExercise({ ...ex, palabras: v }))}
        />
      )}
      {ex.tipo === 'crucigrama' && (
        <LinesField
          label={t('Palabra: pista')} hint={t('el crucigrama se rehace al cambiarlas')}
          value={(ex.pistas ?? []).map(p => `${p.palabra}: ${p.pista}`)}
          onCommit={v => onChange(prepareExercise({
            ...ex,
            pistas: v.map(l => { const i = l.indexOf(':'); return i < 0 ? { palabra: l, pista: '' } : { palabra: l.slice(0, i).trim(), pista: l.slice(i + 1).trim() }; }),
          }))}
        />
      )}
      {ex.tipo === 'relacionar' && (
        <div className="fe-two">
          <LinesField label={t('Columna izquierda')} value={ex.izquierda ?? []} onCommit={v => set({ izquierda: v })} />
          <LinesField label={t('Columna derecha')} value={ex.derecha ?? []} onCommit={v => set({ derecha: v })} />
        </div>
      )}
      {ex.tipo === 'colorear' && (
        <div className="fe-two">
          <LinesField
            label={t('Leyenda (color: criterio)')} value={(ex.leyenda ?? []).map(l => `${l.color}: ${l.criterio}`)}
            onCommit={v => set({ leyenda: v.map(l => { const i = l.indexOf(':'); return i < 0 ? { color: l, criterio: '' } : { color: l.slice(0, i).trim(), criterio: l.slice(i + 1).trim() }; }) })}
          />
          <LinesField label={t('Elementos para colorear')} value={ex.itemsColorear ?? []} onCommit={v => set({ itemsColorear: v })} />
        </div>
      )}
      {ex.tipo === 'comic' && (
        <div className="fe-comic">
          {(ex.vinetas ?? []).map((v, i) => (
            <div key={i} className="fe-comic-row">
              <input
                className="finput fe-emoji" value={v.personaje} aria-label={t('Personaje')}
                onChange={e => set({ vinetas: ex.vinetas!.map((x, j) => (j === i ? { ...x, personaje: e.target.value } : x)) })}
              />
              <input
                className="finput" value={v.texto} placeholder={t('Vacío: lo escribe el alumnado')} aria-label={t('Bocadillo {n}', { n: i + 1 })}
                onChange={e => set({ vinetas: ex.vinetas!.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })}
              />
            </div>
          ))}
        </div>
      )}
      {ex.tipo === 'tabla_rellenar' && !!ex.columnas?.length && (
        <div className="fe-table" style={{ gridTemplateColumns: `repeat(${ex.columnas.length}, minmax(0, 1fr))` }}>
          {ex.columnas.map((c, ci) => (
            <input
              key={`h${ci}`} className="finput th" value={c} aria-label={t('Columna {n}', { n: ci + 1 })}
              onChange={e => set({ columnas: ex.columnas!.map((x, j) => (j === ci ? e.target.value : x)) })}
            />
          ))}
          {(ex.filas ?? []).flatMap((fila, fi) => fila.map((celda, ci) => (
            <input
              key={`${fi}-${ci}`} className="finput" value={celda} placeholder="—"
              aria-label={t('Fila {r}, columna {c}', { r: fi + 1, c: ci + 1 })}
              onChange={e => set({ filas: ex.filas!.map((f, r) => (r === fi ? f.map((x, c) => (c === ci ? e.target.value : x)) : f)) })}
            />
          )))}
        </div>
      )}

      <button type="button" className="fe-sol-toggle" onClick={() => setShowSol(s => !s)} aria-expanded={showSol}>
        {showSol ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {t('Solución')}{(ex.apoyo || ex.ampliacion) ? ` · ${t('Apoyo')} · ${t('Ampliación')}` : ''}
        <em>{t('solo para ti, no se imprime')}</em>
      </button>
      {showSol && (
        <div className="fe-sol">
          <textarea className="finput" rows={2} value={ex.solucion} aria-label={t('Solución')} onChange={e => set({ solucion: e.target.value })} />
          {ex.apoyo !== undefined && (
            <label className="fe-field"><span className="fe-lbl">{t('Apoyo')}</span>
              <textarea className="finput" rows={2} value={ex.apoyo} onChange={e => set({ apoyo: e.target.value })} />
            </label>
          )}
          {ex.ampliacion !== undefined && (
            <label className="fe-field"><span className="fe-lbl">{t('Ampliación')}</span>
              <textarea className="finput" rows={2} value={ex.ampliacion} onChange={e => set({ ampliacion: e.target.value })} />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
