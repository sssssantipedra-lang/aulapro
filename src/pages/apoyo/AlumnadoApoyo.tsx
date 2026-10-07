/**
 * PT y AL, «Mi alumnado» (decisión del dueño, 6-10-2026): en una pestaña, el
 * alumnado que atiende el especialista, de cualquier clase del centro; al
 * pulsar uno se abre su página (`AlumnoApoyo.tsx`), con todo lo suyo. En la
 * otra, sus grupos de apoyo con su horario. Ver `docs/PTAL.md`.
 */
import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Users, Clock, ChevronRight } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Avatar } from '../../components/ui/Avatar';
import { useToast } from '../../components/ui/Toast';
import { Pestanas } from '../../components/apoyo/Pestanas';
import { useNombreCurso } from '../../hooks/useNombreCurso';
import { useI18n, weekdayLabel } from '../../i18n';
import { isoDate } from '../../lib/utils';
import { alumnoVacio, enEdicion, nuevoIdApoyo, sinGrupo, tieneDesfase, trimestreDe, type AlumnoEnEdicion } from '../../lib/apoyo';
import { avisosApoyo, avisosDelAlumno, evolucionDelTrimestre } from '../../lib/inicioApoyo';
import { requestAlumno, useGruposPedido } from '../../lib/apoyoNav';
import { EditarAlumno } from './EditarAlumno';
import type { ApoyoData, Especialidad, FranjaApoyo, GrupoApoyo } from '../../types/apoyo';
import type { Section } from '../../types';

const PALETA = ['#6366f1', '#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'] as const;

interface Props {
  data: ApoyoData;
  onChange: (f: (d: ApoyoData) => ApoyoData) => void;
  especialidades: Especialidad[];
  onNav: (s: Section) => void;
}

type Pestana = 'alumnado' | 'grupos';

/** La sesión que se añade: la misma hora, el día siguiente al de la última. */
function otraFranja(horario: FranjaApoyo[]): FranjaApoyo {
  const ultima = horario[horario.length - 1];
  if (!ultima) return { dia: 0, inicio: '09:00', fin: '09:45' };
  return { ...ultima, dia: Math.min(ultima.dia + 1, 4) };
}

function grupoVacio(especialidad: Especialidad, n: number): GrupoApoyo {
  return {
    id: nuevoIdApoyo('gru'), nombre: '', especialidad, modalidad: 'fuera',
    horario: [{ dia: 0, inicio: '09:00', fin: '09:45' }], alumnos: [],
    color: PALETA[n % PALETA.length],
  };
}

export function AlumnadoApoyo({ data, onChange, especialidades, onNav }: Props) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const nombreCurso = useNombreCurso();
  // Desde la Agenda o el Registro se llega a los grupos, a veces con uno ya abierto
  const pedido = useGruposPedido();
  const [pestana, setPestana] = useState<Pestana>(pedido ? 'grupos' : 'alumnado');
  const [edicion, setEdicion] = useState<AlumnoEnEdicion | null>(null);
  const [grupo, setGrupo] = useState<GrupoApoyo | null>(() => data.grupos.find(g => g.id === pedido?.grupoId) ?? null);
  const dosEspecialidades = especialidades.length > 1;
  const dia = (n: number) => weekdayLabel(n, locale, 'short');
  const esNuevoGrupo = !!grupo && !data.grupos.some(g => g.id === grupo.id);

  const hoy = isoDate();
  const T = trimestreDe(hoy);
  const alumnos = useMemo(() => [...data.alumnos].sort((a, b) => a.nombre.localeCompare(b.nombre)), [data.alumnos]);
  const evolucion = useMemo(() => new Map(evolucionDelTrimestre(data, T).map(e => [e.alumno.id, e])), [data, T]);
  const avisos = useMemo(() => avisosApoyo(data, hoy), [data, hoy]);

  function abrir(id: string) {
    requestAlumno(id);
    onNav('apoyo-alumno');
  }

  function guardarGrupo() {
    if (!grupo) return;
    const vistas = new Set<string>();
    const horario = grupo.horario.filter(f => {
      const k = `${f.dia}|${f.inicio}|${f.fin}`;
      if (vistas.has(k)) return false;
      vistas.add(k);
      return true;
    });
    const g = { ...grupo, nombre: grupo.nombre.trim(), horario };
    if (!g.nombre) { toast(t('Ponle un nombre al grupo')); return; }
    if (g.horario.some(f => !f.inicio || !f.fin || f.fin <= f.inicio)) {
      toast(t('Revisa el horario: cada sesión tiene que acabar después de empezar'));
      return;
    }
    onChange(d => ({
      ...d,
      grupos: d.grupos.some(x => x.id === g.id) ? d.grupos.map(x => (x.id === g.id ? g : x)) : [...d.grupos, g],
    }));
    setGrupo(null);
    toast(esNuevoGrupo ? t('✅ Grupo creado') : t('✅ Actualizado'));
  }

  function borrarGrupo() {
    if (!grupo) return;
    if (!window.confirm(t('¿Eliminar el grupo «{name}»? Se borran sus registros; el alumnado y sus programas se quedan.', { name: grupo.nombre }))) return;
    onChange(d => sinGrupo(d, grupo.id));
    setGrupo(null);
    toast(t('Eliminado'));
  }

  const patchFranja = (i: number, p: Partial<FranjaApoyo>) =>
    setGrupo(g => (g ? { ...g, horario: g.horario.map((f, j) => (j === i ? { ...f, ...p } : f)) } : g));

  const gruposDe = (id: string) => data.grupos.filter(g => g.alumnos.includes(id));
  const horarioTexto = (g: GrupoApoyo) =>
    [...g.horario].sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio))
      .map(f => `${dia(f.dia)} ${f.inicio}–${f.fin}`).join(' · ');

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Mi alumnado')}</h1>
          <p className="pg-sub">{t('Pulsa un alumno para ver todo lo suyo: su programa, sus sesiones, las coordinaciones y sus documentos.')}</p>
        </div>
        {pestana === 'alumnado'
          ? <button className="btn-accent" onClick={() => setEdicion(enEdicion(alumnoVacio(), data))}><Plus size={16} />{t('Nuevo alumno')}</button>
          : <button className="btn-accent" onClick={() => setGrupo(grupoVacio(especialidades[0] ?? 'PT', data.grupos.length))}><Plus size={16} />{t('Nuevo grupo')}</button>}
      </div>

      <Pestanas
        label={t('Mi alumnado')} value={pestana} onChange={setPestana}
        items={[
          { id: 'alumnado', label: t('Alumnado'), n: data.alumnos.length },
          { id: 'grupos', label: t('Grupos'), n: data.grupos.length },
        ]}
      />

      {pestana === 'alumnado' && (
        <div className="card" role="tabpanel" aria-label={t('Alumnado')}>
          {alumnos.length === 0 ? (
            <p className="ap-vacio">{t('Añade a cada alumno con su clase, su curso y su nivel de competencia curricular. De ahí salen sus programas y los criterios que trabaja.')}</p>
          ) : (
            <ul className="ap-lista al-lista">
              {alumnos.map(a => {
                const ev = evolucion.get(a.id);
                const total = ev?.objetivos.length ?? 0;
                const nAvisos = avisosDelAlumno(avisos, a).length;
                return (
                  <li key={a.id}>
                    {/* El nombre que se lee: el del alumno, su clase y sus avisos, sin juntar todos los textos */}
                    <button
                      type="button" className="al-fila" onClick={() => abrir(a.id)}
                      aria-label={[a.nombre, a.claseOrigen, nAvisos ? t(nAvisos === 1 ? '{n} aviso' : '{n} avisos', { n: nAvisos }) : ''].filter(Boolean).join(', ')}
                    >
                      <span aria-hidden="true"><Avatar name={a.nombre} size={38} className="av al-av" /></span>
                      <span className="ap-lista-txt">
                        <strong>{a.nombre}</strong>
                        <span className="ap-meta">
                          {a.claseOrigen && <span>{a.claseOrigen}</span>}
                          {a.matricula && <span>{nombreCurso(a.matricula)}</span>}
                          {a.nivel && (
                            <span className={`sda-chip${tieneDesfase(a) ? ' shared' : ''}`}>{t('Nivel de {curso}', { curso: nombreCurso(a.nivel) })}</span>
                          )}
                          {a.categorias.map(c => <span key={c} className="sda-chip">{t(c)}</span>)}
                        </span>
                        {gruposDe(a.id).length > 0 && (
                          <span className="ap-sub">{gruposDe(a.id).map(g => g.nombre).join(' · ')}</span>
                        )}
                      </span>
                      <span className="al-fila-der">
                        {total > 0 && ev && (
                          <span className="al-progreso" title={t('Sus objetivos del {n}º trimestre', { n: T })}>
                            <span className="ap-barra" aria-hidden="true">
                              {(['si', 'proceso', 'no', 'sin'] as const).filter(e => ev.cuenta[e]).map(e => (
                                <span key={e} className={`ap-barra-s ${e}`} style={{ flexGrow: ev.cuenta[e] }} />
                              ))}
                            </span>
                            <span className="ap-evol-n">{t('{a} de {b}', { a: ev.cuenta.si, b: total })}</span>
                          </span>
                        )}
                        {nAvisos > 0 && (
                          <span className="home-pill warn">{t(nAvisos === 1 ? '{n} aviso' : '{n} avisos', { n: nAvisos })}</span>
                        )}
                        <ChevronRight size={16} className="al-chev" aria-hidden="true" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {pestana === 'grupos' && (
        <div className="card" role="tabpanel" aria-label={t('Grupos')}>
          <div className="card-hd"><div className="card-ttl"><Users size={14} color="var(--accent-d)" />{t('Grupos de apoyo')}</div></div>
          {data.grupos.length === 0 ? (
            <p className="ap-vacio">{t('Todavía no hay grupos. Crea uno por cada sesión que das: «Lectoescritura, lunes 9:00». Un alumno que atiendes solo es un grupo de uno.')}</p>
          ) : (
            <ul className="ap-lista">
              {data.grupos.map(g => (
                <li key={g.id}>
                  <span className="chip-dot" style={{ background: g.color }} aria-hidden="true" />
                  <div className="ap-lista-txt">
                    <strong>{g.nombre}</strong>
                    <span className="ap-meta">
                      {dosEspecialidades && <span className="sda-chip">{g.especialidad}</span>}
                      <span className="sda-chip">{g.modalidad === 'dentro' ? t('Dentro del aula') : t('Fuera del aula')}</span>
                      {g.horario.length > 0 && <span className="ap-hora"><Clock size={12} aria-hidden="true" />{horarioTexto(g)}</span>}
                    </span>
                    <span className="ap-sub">
                      {g.alumnos.length
                        ? g.alumnos.map(id => data.alumnos.find(a => a.id === id)?.nombre).filter(Boolean).join(', ')
                        : t('Sin alumnado todavía')}
                    </span>
                  </div>
                  <button className="ico-btn" onClick={() => setGrupo(g)} aria-label={t('Editar «{name}»', { name: g.nombre })} title={t('Editar')}><Pencil size={15} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <EditarAlumno edicion={edicion} onEdicion={setEdicion} data={data} onChange={onChange} />

      {/* ── Grupo de apoyo ── */}
      <Modal open={!!grupo} onClose={() => setGrupo(null)} wide title={esNuevoGrupo ? t('Nuevo grupo') : grupo?.nombre}>
        {grupo && (
          <>
            <div className="ap-form">
              <div className="fgroup" style={{ gridColumn: '1 / -1' }}><label className="flabel" htmlFor="ap-g-nombre">{t('Nombre')}</label>
                <input id="ap-g-nombre" className="finput" value={grupo.nombre} autoFocus placeholder={t('Ej: Lectoescritura, lunes 9:00')} onChange={e => setGrupo({ ...grupo, nombre: e.target.value })} /></div>
              {dosEspecialidades && (
                <fieldset className="fgroup ap-fs">
                  <legend className="flabel">{t('Especialidad')}</legend>
                  <div className="chip-row">
                    {especialidades.map(e => (
                      <button key={e} type="button" className={`chip sm accent${grupo.especialidad === e ? ' on' : ''}`} aria-pressed={grupo.especialidad === e}
                        onClick={() => setGrupo({ ...grupo, especialidad: e })}>{e}</button>
                    ))}
                  </div>
                </fieldset>
              )}
              <fieldset className="fgroup ap-fs">
                <legend className="flabel">{t('Dónde')}</legend>
                <div className="chip-row">
                  {(['fuera', 'dentro'] as const).map(m => (
                    <button key={m} type="button" className={`chip sm accent${grupo.modalidad === m ? ' on' : ''}`} aria-pressed={grupo.modalidad === m}
                      onClick={() => setGrupo({ ...grupo, modalidad: m })}>{m === 'dentro' ? t('Dentro del aula') : t('Fuera del aula')}</button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
                <legend className="flabel">{t('Horario')}</legend>
                {grupo.horario.map((f, i) => (
                  <div key={i} className="ap-franja">
                    <select className="finput" aria-label={t('Día')} value={f.dia} onChange={e => patchFranja(i, { dia: Number(e.target.value) })}>
                      {[0, 1, 2, 3, 4].map(n => <option key={n} value={n}>{weekdayLabel(n, locale)}</option>)}
                    </select>
                    <input type="time" className="finput" aria-label={t('Empieza')} value={f.inicio} onChange={e => patchFranja(i, { inicio: e.target.value })} />
                    <input type="time" className="finput" aria-label={t('Acaba')} value={f.fin} onChange={e => patchFranja(i, { fin: e.target.value })} />
                    <button type="button" className="ico-btn" aria-label={t('Quitar esta sesión')} title={t('Quitar')}
                      onClick={() => setGrupo({ ...grupo, horario: grupo.horario.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
                  </div>
                ))}
                <button type="button" className="btn-ghost" style={{ fontSize: 12.5 }}
                  onClick={() => setGrupo({ ...grupo, horario: [...grupo.horario, otraFranja(grupo.horario)] })}>
                  <Plus size={14} />{t('Otra sesión a la semana')}
                </button>
              </fieldset>
              <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
                <legend className="flabel">{t('Alumnado')}</legend>
                {data.alumnos.length === 0 ? (
                  <p className="ap-vacio" style={{ margin: 0 }}>{t('Primero añade al alumnado en la pestaña «Alumnado».')}</p>
                ) : (
                  <div className="chip-row">
                    {[...data.alumnos].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(a => {
                      const on = grupo.alumnos.includes(a.id);
                      return (
                        <button key={a.id} type="button" className={`chip sm accent${on ? ' on' : ''}`} aria-pressed={on}
                          onClick={() => setGrupo({ ...grupo, alumnos: on ? grupo.alumnos.filter(x => x !== a.id) : [...grupo.alumnos, a.id] })}>
                          {a.nombre}{a.claseOrigen ? ` · ${a.claseOrigen}` : ''}
                        </button>
                      );
                    })}
                  </div>
                )}
              </fieldset>
              <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
                <legend className="flabel">{t('Color')}</legend>
                <div className="chip-row">
                  {PALETA.map(c => (
                    <button key={c} type="button" className="ap-color" aria-label={c} aria-pressed={grupo.color === c}
                      style={{ background: c, outline: grupo.color === c ? '2px solid var(--text)' : 'none' }}
                      onClick={() => setGrupo({ ...grupo, color: c })} />
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="ap-acciones">
              <button className="btn-accent" onClick={guardarGrupo}>{t('Guardar')}</button>
              <button className="btn-ghost" onClick={() => setGrupo(null)}>{t('Cancelar')}</button>
              {!esNuevoGrupo && <button className="btn-ghost ap-borrar" onClick={borrarGrupo}><Trash2 size={15} />{t('Eliminar')}</button>}
            </div>
          </>
        )}
      </Modal>
    </section>
  );
}
