/**
 * PT y AL, pestaña «Programa» de la página de un alumno: su plan individual.
 * Por ámbito (en la Comunitat Valenciana, los programas del PAP), sus
 * objetivos de cada trimestre, enlazables con los criterios oficiales del
 * curso de su nivel de competencia. La IA los propone y el docente los
 * cambia. Ver `docs/PTAL.md`.
 */
import { useState } from 'react';
import { Plus, Pencil, Trash2, Sparkles, Target, Link2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { AiKeyNotice } from '../../components/ui/AiKeyNotice';
import { CriteriosPicker } from '../../components/curriculum/CriteriosOficialesPicker';
import { useI18n, priorityLabel } from '../../i18n';
import { useNombreCurso } from '../../hooks/useNombreCurso';
import { useMateriasDeNivel } from '../../hooks/useMateriasDeNivel';
import { hasApiKey } from '../../services/gemini';
import { proponerObjetivos } from '../../services/apoyoIA';
import { describirCriterio } from '../../lib/curriculum/criteriosParaIA';
import { claveCriterioOficial } from '../../lib/curriculum/evaluacionPorCriterios';
import { ambitosDe, nivelDe, nuevoIdApoyo } from '../../lib/apoyo';
import { puntosDe } from '../../lib/inicioApoyo';
import { GraficaObjetivo } from '../../components/apoyo/GraficaObjetivo';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { MateriaDeClase } from '../../lib/curriculum/criteriosParaIA';
import type { EstadoCurriculoClase } from '../../hooks/useNotasPorCompetencias';
import type { AlumnoApoyo, ApoyoData, Especialidad, Logro, ObjetivoApoyo, ProgramaApoyo, Trimestre } from '../../types/apoyo';
import type { Section } from '../../types';

interface Props {
  alumno: AlumnoApoyo;
  data: ApoyoData;
  onChange: (f: (d: ApoyoData) => ApoyoData) => void;
  especialidades: Especialidad[];
  comunidad: ComunidadId | undefined;
  onNav: (s: Section) => void;
}

const TRIMESTRES: Trimestre[] = [1, 2, 3];
const INTENSIDADES = ['baja', 'media', 'alta'] as const;
const OTRO = '__otro__';

export function ProgramasApoyo({ alumno, data, onChange, especialidades, comunidad, onNav }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const nombreCurso = useNombreCurso();
  const nivel = nivelDe(alumno);
  const { estado, materias } = useMateriasDeNivel(comunidad, nivel);
  const programas = data.programas.filter(p => p.alumnoId === alumno.id);
  const [generando, setGenerando] = useState<string | null>(null);

  /** Programa que se está creando o cambiando de ámbito. */
  const [editando, setEditando] = useState<ProgramaApoyo | null>(null);
  const [eleccion, setEleccion] = useState('');
  const [otroAmbito, setOtroAmbito] = useState('');
  const { oficial, ambitos } = ambitosDe(comunidad, lang);
  const ambitosVisibles = ambitos.filter(a => especialidades.length === 0 || especialidades.includes(a.especialidad));
  const nombreAmbito = (n: string) => (oficial ? n : t(n));
  const esNuevo = !!editando && !data.programas.some(p => p.id === editando.id);

  const cambiarPrograma = (id: string, f: (p: ProgramaApoyo) => ProgramaApoyo) =>
    onChange(d => ({ ...d, programas: d.programas.map(p => (p.id === id ? f(p) : p)) }));
  const cambiarObjetivo = (pid: string, oid: string, f: (o: ObjetivoApoyo) => ObjetivoApoyo) =>
    cambiarPrograma(pid, p => ({ ...p, objetivos: p.objetivos.map(o => (o.id === oid ? f(o) : o)) }));

  function abrirNuevo() {
    const primero = ambitosVisibles[0];
    setEditando({
      id: nuevoIdApoyo('pro'), alumnoId: alumno.id, ambito: '', objetivos: [],
      especialidad: primero?.especialidad ?? especialidades[0] ?? 'PT',
    });
    setEleccion(primero ? nombreAmbito(primero.nombre) : OTRO);
    setOtroAmbito('');
  }

  function abrirEdicion(p: ProgramaApoyo) {
    setEditando(p);
    const conocido = ambitosVisibles.find(a => nombreAmbito(a.nombre) === p.ambito);
    setEleccion(conocido ? p.ambito : OTRO);
    setOtroAmbito(conocido ? '' : p.ambito);
  }

  function guardarPrograma() {
    if (!editando) return;
    const ambito = (eleccion === OTRO ? otroAmbito : eleccion).trim();
    if (!ambito) { toast(t('Escribe el ámbito del programa')); return; }
    const p = { ...editando, ambito };
    onChange(d => ({
      ...d,
      programas: d.programas.some(x => x.id === p.id) ? d.programas.map(x => (x.id === p.id ? p : x)) : [...d.programas, p],
    }));
    setEditando(null);
  }

  function borrarPrograma(p: ProgramaApoyo) {
    if (!window.confirm(t('¿Eliminar el programa «{name}» y sus objetivos?', { name: p.ambito }))) return;
    onChange(d => ({ ...d, programas: d.programas.filter(x => x.id !== p.id) }));
    toast(t('Eliminado'));
  }

  async function proponer(p: ProgramaApoyo) {
    setGenerando(p.id);
    const propuestos = await proponerObjetivos(
      { alumno, programa: p, actuales: p.objetivos, materias, comunidad, lang, nombreCurso },
      { onError: m => toast(t(m)) },
    );
    setGenerando(null);
    if (!propuestos?.length) return;
    cambiarPrograma(p.id, x => ({
      ...x,
      objetivos: [...x.objetivos, ...propuestos.map(o => ({ id: nuevoIdApoyo('obj'), ...o }))],
    }));
    toast(t('✅ La IA ha añadido {n} objetivos. Revísalos y cambia lo que haga falta.', { n: propuestos.length }));
  }

  return (
    <div className="al-panel">
      <div className="al-barra">
        <p className="ap-sub" style={{ margin: 0 }}>
          {nivel
            ? t('Por ámbito, sus objetivos de cada trimestre, enlazados con los criterios de {curso}. La IA los propone y tú los cambias.', { curso: nombreCurso(nivel) })
            : t('Sin nivel de competencia: indícalo en la pestaña «Datos» para enlazar los objetivos con el currículo.')}
        </p>
        <button className="btn-accent" onClick={abrirNuevo}><Plus size={16} />{t('Nuevo programa')}</button>
      </div>

      {!hasApiKey() && (
        <AiKeyNotice message={t('Para que la IA proponga objetivos necesitas una clave gratuita de Google (se configura en 2 minutos).')} action={t('Configurar ahora')} onAction={() => onNav('profile')} />
      )}

      {programas.length === 0 && (
        <div className="card"><p className="ap-vacio">{t('Todavía no tiene programas. Crea uno por cada ámbito que trabajas con este alumno.')}</p></div>
      )}

      {programas.map(p => (
        <div className="card" key={p.id}>
          <div className="ap-prog-hd">
            <div style={{ minWidth: 0 }}>
              <div className="ap-prog-ttl"><Target size={15} color="var(--accent-d)" aria-hidden="true" />{p.ambito}</div>
              <div className="ap-meta" style={{ marginTop: 6 }}>
                {especialidades.length > 1 && <span className="sda-chip">{p.especialidad}</span>}
                <label className="ap-intensidad">
                  {t('Intensidad del apoyo')}
                  <select className="finput" value={p.intensidad ?? ''} onChange={e => {
                    const v = e.target.value as ProgramaApoyo['intensidad'] | '';
                    cambiarPrograma(p.id, x => ({ ...x, intensidad: v || undefined }));
                  }}>
                    <option value="">{t('Sin indicar')}</option>
                    {INTENSIDADES.map(i => <option key={i} value={i}>{priorityLabel(i === 'baja' ? 'low' : i === 'media' ? 'medium' : 'high', lang)}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="ap-prog-acc">
              <button className="btn-ia" type="button" disabled={generando !== null || !hasApiKey()} onClick={() => proponer(p)}>
                {generando === p.id ? <span className="spin" /> : <Sparkles size={15} />}
                {generando === p.id ? t('Proponiendo…') : t('Proponer objetivos con IA')}
              </button>
              <button className="ico-btn" onClick={() => abrirEdicion(p)} aria-label={t('Cambiar el ámbito')} title={t('Cambiar el ámbito')}><Pencil size={15} /></button>
              <button className="ico-btn" onClick={() => borrarPrograma(p)} aria-label={t('Eliminar el programa')} title={t('Eliminar')}><Trash2 size={15} /></button>
            </div>
          </div>

          {p.objetivos.length === 0
            ? <p className="ap-vacio" style={{ marginTop: 10 }}>{t('Sin objetivos todavía. Pide una propuesta a la IA o añádelos tú.')}</p>
            : (
              <ul className="ap-objetivos">
                {p.objetivos.map(o => (
                  <ObjetivoFila
                    key={o.id} objetivo={o} estado={estado} materias={materias}
                    puntos={puntosDe(data, alumno.id, o.id)}
                    onChange={f => cambiarObjetivo(p.id, o.id, f)}
                    onDelete={() => cambiarPrograma(p.id, x => ({ ...x, objetivos: x.objetivos.filter(y => y.id !== o.id) }))}
                  />
                ))}
              </ul>
            )}
          <button type="button" className="btn-ghost" style={{ marginTop: 10, fontSize: 12.5 }}
            onClick={() => cambiarPrograma(p.id, x => ({ ...x, objetivos: [...x.objetivos, { id: nuevoIdApoyo('obj'), texto: '', trimestres: [1, 2, 3], criterios: [] }] }))}>
            <Plus size={14} />{t('Añadir objetivo')}
          </button>
        </div>
      ))}

      <Modal open={!!editando} onClose={() => setEditando(null)} wide title={esNuevo ? t('Nuevo programa') : t('Cambiar el ámbito')}>
        {editando && (
          <>
            <div className="fgroup">
              <label className="flabel" htmlFor="ap-p-ambito">{oficial ? t('Programa del PAP') : t('Ámbito')}</label>
              <select id="ap-p-ambito" className="finput" value={eleccion} onChange={e => {
                setEleccion(e.target.value);
                const a = ambitosVisibles.find(x => nombreAmbito(x.nombre) === e.target.value);
                if (a && especialidades.includes(a.especialidad)) setEditando({ ...editando, especialidad: a.especialidad });
              }}>
                {ambitosVisibles.map(a => <option key={a.nombre} value={nombreAmbito(a.nombre)}>{nombreAmbito(a.nombre)}</option>)}
                <option value={OTRO}>{t('Otro ámbito…')}</option>
              </select>
            </div>
            {eleccion === OTRO && (
              <div className="fgroup">
                <label className="flabel" htmlFor="ap-p-otro">{t('Nombre del ámbito')}</label>
                <input id="ap-p-otro" className="finput" value={otroAmbito} autoFocus onChange={e => setOtroAmbito(e.target.value)} placeholder={t('Ej: Habilidades metafonológicas')} />
              </div>
            )}
            {especialidades.length > 1 && (
              <fieldset className="fgroup ap-fs">
                <legend className="flabel">{t('Especialidad')}</legend>
                <div className="chip-row">
                  {especialidades.map(e => (
                    <button key={e} type="button" className={`chip sm accent${editando.especialidad === e ? ' on' : ''}`} aria-pressed={editando.especialidad === e}
                      onClick={() => setEditando({ ...editando, especialidad: e })}>{e}</button>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="ap-acciones">
              <button className="btn-accent" onClick={guardarPrograma}>{t('Guardar')}</button>
              <button className="btn-ghost" onClick={() => setEditando(null)}>{t('Cancelar')}</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

function ObjetivoFila({ objetivo, estado, materias, puntos, onChange, onDelete }: {
  objetivo: ObjetivoApoyo;
  /** Lo registrado de este objetivo, sesión a sesión. */
  puntos: { fecha: string; logro: Logro }[];
  estado: EstadoCurriculoClase;
  materias: MateriaDeClase[];
  onChange: (f: (o: ObjetivoApoyo) => ObjetivoApoyo) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [abierto, setAbierto] = useState(false);
  const hayCurriculo = estado === 'listo' && materias.length > 0;

  return (
    <li className="ap-obj">
      <div className="ap-obj-fila">
        <input
          className="finput ap-obj-txt" value={objetivo.texto} aria-label={t('Objetivo')}
          placeholder={t('Ej: Leer sílabas directas con fluidez')}
          onChange={e => onChange(o => ({ ...o, texto: e.target.value }))}
        />
        <div className="ap-trim" role="group" aria-label={t('Trimestres')}>
          {TRIMESTRES.map(n => {
            const on = objetivo.trimestres.includes(n);
            return (
              <button key={n} type="button" className={`chip sm accent${on ? ' on' : ''}`} aria-pressed={on}
                title={t('{n}º trimestre', { n })}
                onClick={() => onChange(o => {
                  const sig = on ? o.trimestres.filter(x => x !== n) : [...o.trimestres, n].sort();
                  return sig.length ? { ...o, trimestres: sig } : o;
                })}>
                {t('{n}º', { n })}
              </button>
            );
          })}
        </div>
        {hayCurriculo && (
          <button type="button" className={`ico-btn${objetivo.criterios.length ? ' ap-con' : ''}`} aria-expanded={abierto}
            onClick={() => setAbierto(v => !v)} aria-label={t('Criterios oficiales')} title={t('Criterios oficiales')}>
            <Link2 size={15} />{objetivo.criterios.length > 0 && <span className="ap-n">{objetivo.criterios.length}</span>}
          </button>
        )}
        <button type="button" className="ico-btn" onClick={onDelete} aria-label={t('Quitar el objetivo')} title={t('Quitar')}><Trash2 size={15} /></button>
      </div>
      {!abierto && objetivo.criterios.length > 0 && (
        <div className="ap-crit">
          {objetivo.criterios.map(r => {
            const d = describirCriterio(materias, r);
            return <span key={claveCriterioOficial(r)} className="sda-chip" title={d?.texto}>{d ? `${d.materia} ${r.codigo}` : r.codigo}</span>;
          })}
        </div>
      )}
      <GraficaObjetivo puntos={puntos} />
      {abierto && (
        <CriteriosPicker
          idPrefix={`ap-${objetivo.id}`} estado={estado} materias={materias}
          titulo={t('Criterios del curso de su nivel')}
          value={objetivo.criterios} onChange={v => onChange(o => ({ ...o, criterios: v }))}
        />
      )}
    </li>
  );
}
