/**
 * Lo que se añade a una sesión de Educación Física al prepararla (petición
 * del dueño, 19-10-2026): el instrumento con el que se va a evaluar, que puede
 * ser uno que ya existe (rúbrica, diana o escala de registro) o una escala de
 * registro creada ahí mismo, y el circuito, que puede ser uno ya dibujado o
 * uno nuevo hecho con la pizarra de circuitos sin salir de la sesión.
 */
import { useState } from 'react';
import { ClipboardCheck, Plus, Route, ThumbsUp, Trash2, X } from 'lucide-react';
import type { EvalDiana, Evaluation, Rubric, Student } from '../../types';
import type { EfData, InstrumentoRefEF, SesionEF } from '../../types/ef';
import { useToast } from '../ui/Toast';
import { useI18n } from '../../i18n';
import { pizarraSvg } from '../../lib/pizarraEF';
import { esRegistro } from '../../lib/registro';
import { describirInstrumento, ETIQUETA_INSTRUMENTO } from '../../lib/instrumentosSesion';

interface Props {
  sesion: SesionEF;
  onChange: (s: SesionEF) => void;
  ef: EfData;
  rubrics: Rubric[];
  dianas: EvalDiana[];
  /** Para contar a quién se ha valorado ya con cada instrumento. */
  evaluations?: Evaluation[];
  students?: Student[];
  /** Abre la valoración de la clase con ese instrumento, sin salir de la sesión. */
  onEvaluar?: (r: InstrumentoRefEF) => void;
  onAddDiana?: (d: EvalDiana) => void;
  /** Para ir a crear o a usar un instrumento en Evaluar. */
  onNav?: (s: 'rubrics' | 'dianas' | 'registros') => void;
  onCerrarSesion?: () => void;
  /** Abre la pizarra de circuitos en una ventana (la tiene la pantalla de Sesiones): con el circuito que se pida o en blanco. */
  onDibujar: (id?: string) => void;
}

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const claveRef = (r: InstrumentoRefEF) => `${r.tipo}:${r.id}`;


export function SesionEvaluacionCircuito({ sesion, onChange, ef, rubrics, dianas, evaluations = [], students = [], onEvaluar, onAddDiana, onNav, onCerrarSesion, onDibujar }: Props) {
  const { t } = useI18n();
  const { toast } = useToast();
  const refs = sesion.instrumentos ?? [];
  const puestos = new Set(refs.map(claveRef));

  /* ── Instrumentos ── */
  const [elegido, setElegido] = useState('');
  const [nueva, setNueva] = useState<{ nombre: string; conceptos: string } | null>(null);

  const disponibles: { ref: InstrumentoRefEF; nombre: string }[] = [
    ...rubrics.map(r => ({ ref: { tipo: 'rubrica' as const, id: r.id }, nombre: r.name })),
    ...dianas.filter(d => !esRegistro(d)).map(d => ({ ref: { tipo: 'diana' as const, id: d.id }, nombre: d.name })),
    ...dianas.filter(esRegistro).map(d => ({ ref: { tipo: 'registro' as const, id: d.id }, nombre: d.name })),
  ].filter(x => !puestos.has(claveRef(x.ref)));

  const poner = (r: InstrumentoRefEF) => onChange({ ...sesion, instrumentos: [...refs, r] });
  /** A cuántos alumnos de la clase de la sesión se ha valorado ya con ese instrumento. */
  const valorados = (r: InstrumentoRefEF) => {
    if (!sesion.claseId) return null;
    const total = students.filter(a => a.class_id === sesion.claseId).length;
    if (total === 0) return null;
    const hechos = new Set(evaluations.filter(e => e.rubric_id === r.id && e.class_id === sesion.claseId).map(e => e.student_id));
    return { hechos: hechos.size, total };
  };
  const quitar = (r: InstrumentoRefEF) => onChange({ ...sesion, instrumentos: refs.filter(x => claveRef(x) !== claveRef(r)) });

  function adjuntar() {
    const x = disponibles.find(d => claveRef(d.ref) === elegido);
    if (!x) return;
    poner(x.ref);
    setElegido('');
  }

  function crearEscala() {
    if (!nueva || !onAddDiana) return;
    const nombre = nueva.nombre.trim();
    const items = nueva.conceptos.split('\n').map(x => x.trim()).filter(Boolean).map(name => ({ id: 'it' + uid(), name, weight: 1 }));
    if (!nombre) { toast(t('Ponle un nombre a la escala')); return; }
    if (items.length === 0) { toast(t('Escribe al menos un concepto que se valore')); return; }
    const d: EvalDiana = {
      id: 'reg' + uid(), tipo: 'registro', name: nombre, items,
      levels: [{ value: 1, label: 'Mejorable' }, { value: 2, label: 'Bien hecho' }],
      ...(sesion.claseId ? { class_id: sesion.claseId } : {}),
    };
    onAddDiana(d);
    poner({ tipo: 'registro', id: d.id });
    setNueva(null);
    toast(t('✅ Escala de registro creada y añadida a la sesión'));
  }

  /** Crear una rúbrica o una diana se hace en Evaluar: la sesión se queda como borrador y se retoma con «Continuar». */
  function irACrear(destino: 'rubrics' | 'dianas') {
    toast(t('Al volver a Sesiones, pulsa «Continuar» para seguir con esta sesión.'));
    onCerrarSesion?.();
    onNav?.(destino);
  }

  /* ── Circuito ── */
  const circuito = sesion.pizarraId ? ef.pizarras.find(p => p.id === sesion.pizarraId) : undefined;

  return (
    <>
      <div className="ef-ses-extra" style={{ gridColumn: '1 / -1' }}>
        <div className="flabel"><ClipboardCheck size={13} aria-hidden="true" /> {t('Cómo se evalúa')}</div>
        {refs.length === 0 && <p className="ap-sub" style={{ margin: '0 0 8px' }}>{t('Adjunta una rúbrica, una diana o una escala de registro que ya tengas, o crea una escala nueva.')}</p>}
        <ul className="ef-ses-instr">
          {refs.map(r => {
            const d = describirInstrumento(r, rubrics, dianas);
            return (
              <li key={claveRef(r)}>
                <span className="ef-ses-instr-ico" aria-hidden="true">{r.tipo === 'registro' ? <ThumbsUp size={14} /> : <ClipboardCheck size={14} />}</span>
                <span className="ef-ses-instr-txt">
                  <strong>{d?.nombre ?? t('Instrumento eliminado')}</strong>
                  <em>{t(ETIQUETA_INSTRUMENTO[r.tipo])}{d && d.conceptos.length > 0 ? ` · ${d.conceptos.slice(0, 3).join(', ')}${d.conceptos.length > 3 ? '…' : ''}` : ''}</em>
                  {d && valorados(r) && <em className="ef-ses-instr-n">{t('{hechos} de {total} alumnos valorados', valorados(r)!)}</em>}
                </span>
                {d && (onEvaluar || onNav) && (
                  <button type="button" className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => {
                      if (onEvaluar) { onEvaluar(r); return; }
                      onCerrarSesion?.();
                      onNav?.(r.tipo === 'rubrica' ? 'rubrics' : r.tipo === 'diana' ? 'dianas' : 'registros');
                    }}>
                    {t('Evaluar')}
                  </button>
                )}
                <button type="button" className="ico-btn" onClick={() => quitar(r)} title={t('Quitar de la sesión')} aria-label={t('Quitar «{nombre}» de la sesión', { nombre: d?.nombre ?? '' })}><X size={14} /></button>
              </li>
            );
          })}
        </ul>

        {disponibles.length > 0 && (
          <div className="ef-ses-fila">
            <select className="finput" value={elegido} onChange={e => setElegido(e.target.value)} aria-label={t('Instrumento que ya tienes')}>
              <option value="">{t('Adjuntar un instrumento que ya tengo…')}</option>
              {(['rubrica', 'diana', 'registro'] as const).map(tp => {
                const lista = disponibles.filter(x => x.ref.tipo === tp);
                return lista.length ? <optgroup key={tp} label={t(tp === 'rubrica' ? 'Rúbricas' : tp === 'diana' ? 'Dianas' : 'Escalas de registro')}>
                  {lista.map(x => <option key={claveRef(x.ref)} value={claveRef(x.ref)}>{x.nombre}</option>)}
                </optgroup> : null;
              })}
            </select>
            <button type="button" className="btn-ghost" onClick={adjuntar} disabled={!elegido}><Plus size={14} />{t('Adjuntar')}</button>
          </div>
        )}

        {nueva ? (
          <div className="ef-ses-nueva">
            <label className="flabel" htmlFor="ef-ses-reg-n">{t('Nombre de la escala')}</label>
            <input id="ef-ses-reg-n" className="finput" value={nueva.nombre} placeholder={t('Ej: Técnica del saque')} onChange={e => setNueva({ ...nueva, nombre: e.target.value })} />
            <label className="flabel" htmlFor="ef-ses-reg-c">{t('Conceptos que se valoran, uno por línea')}</label>
            <textarea id="ef-ses-reg-c" className="finput" rows={3} value={nueva.conceptos} placeholder={t('Ej: Golpea con la palma abierta')} onChange={e => setNueva({ ...nueva, conceptos: e.target.value })} />
            <p className="ap-sub" style={{ margin: '4px 0 8px' }}>{t('Cada concepto se valora con un pulgar arriba (bien hecho) o abajo (mejorable).')}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-accent" onClick={crearEscala}>{t('Crear y añadir')}</button>
              <button type="button" className="btn-ghost" onClick={() => setNueva(null)}>{t('Cancelar')}</button>
            </div>
          </div>
        ) : (
          <div className="ef-ses-fila">
            {onAddDiana && <button type="button" className="btn-ghost" onClick={() => setNueva({ nombre: '', conceptos: '' })}><ThumbsUp size={14} />{t('Crear una escala de registro')}</button>}
            {onNav && <button type="button" className="btn-ghost" onClick={() => irACrear('rubrics')}><Plus size={14} />{t('Crear una rúbrica')}</button>}
            {onNav && <button type="button" className="btn-ghost" onClick={() => irACrear('dianas')}><Plus size={14} />{t('Crear una diana')}</button>}
          </div>
        )}
      </div>

      <div className="ef-ses-extra" style={{ gridColumn: '1 / -1' }}>
        <div className="flabel"><Route size={13} aria-hidden="true" /> {t('Circuito')}</div>
        {circuito ? (
          <div className="ef-ses-circuito">
            <img alt={t('Circuito «{nombre}»', { nombre: circuito.nombre })} src={`data:image/svg+xml;utf8,${encodeURIComponent(pizarraSvg(circuito))}`} />
            <div className="ef-ses-circuito-acc">
              <strong>{circuito.nombre}</strong>
              <button type="button" className="btn-ghost" onClick={() => onDibujar(circuito.id)}>{t('Editar el circuito')}</button>
              <button type="button" className="btn-ghost ap-borrar" onClick={() => onChange({ ...sesion, pizarraId: undefined })}><Trash2 size={14} />{t('Quitar de la sesión')}</button>
            </div>
          </div>
        ) : (
          <>
            {ef.pizarras.length === 0 && <p className="ap-sub" style={{ margin: '0 0 8px' }}>{t('Dibuja el circuito con la pizarra de circuitos y se queda en la sesión.')}</p>}
            <div className="ef-ses-fila">
              {ef.pizarras.length > 0 && (
                <select className="finput" value="" onChange={e => e.target.value && onChange({ ...sesion, pizarraId: e.target.value })} aria-label={t('Circuito ya dibujado')}>
                  <option value="">{t('Adjuntar un circuito que ya dibujé…')}</option>
                  {ef.pizarras.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              )}
              <button type="button" className="btn-ghost" onClick={() => onDibujar()}><Plus size={14} />{t('Dibujar un circuito nuevo')}</button>
            </div>
          </>
        )}
      </div>

    </>
  );
}
