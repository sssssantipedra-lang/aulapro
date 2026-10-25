/**
 * PT y AL, «Mi alumnado» (decisión del dueño, 6-10-2026): en una pestaña, el
 * alumnado que atiende el especialista, de cualquier clase del centro; al
 * pulsar uno se abre su página (`AlumnoApoyo.tsx`), con todo lo suyo. En la
 * otra, sus grupos de apoyo con su horario. Ver `docs/PTAL.md`.
 */
import { lazy, Suspense, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Users, Clock, ChevronRight, UserPlus, FileText } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Avatar } from '../../components/ui/Avatar';
import { useToast } from '../../components/ui/Toast';
import { Pestanas } from '../../components/apoyo/Pestanas';
import { HorarioEditor } from '../../components/apoyo/HorarioEditor';
import { useNombreCurso } from '../../hooks/useNombreCurso';
import { useI18n, weekdayLabel } from '../../i18n';
import { isoDate } from '../../lib/utils';
import { alumnoVacio, enEdicion, grupoVacio, horarioIncorrecto, horarioLimpio, PALETA_GRUPOS, sinGrupo, tieneDesfase, trimestreDe, type AlumnoEnEdicion } from '../../lib/apoyo';
import { avisosApoyo, avisosDelAlumno, evolucionDelTrimestre } from '../../lib/inicioApoyo';
import { requestAlumno, useGruposPedido } from '../../lib/apoyoNav';
import { EditarAlumno } from './EditarAlumno';
import type { AlumnoApoyo, ApoyoData, Especialidad, GrupoApoyo } from '../../types/apoyo';
import type { Section } from '../../types';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import { compararNombres } from '../../lib/alumnado';

const InformesLoteApoyo = lazy(() => import('./InformesLoteApoyo').then(m => ({ default: m.InformesLoteApoyo })));

interface Props {
  data: ApoyoData;
  onChange: (f: (d: ApoyoData) => ApoyoData) => void;
  especialidades: Especialidad[];
  comunidad: ComunidadId | undefined;
  onNav: (s: Section) => void;
}

type Pestana = 'alumnado' | 'grupos';

export function AlumnadoApoyo({ data, onChange, especialidades, comunidad, onNav }: Props) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const nombreCurso = useNombreCurso();
  // Desde la Agenda o el Registro se llega a los grupos, a veces con uno ya abierto
  const pedido = useGruposPedido();
  const [pestana, setPestana] = useState<Pestana>(pedido ? 'grupos' : 'alumnado');
  const [lote, setLote] = useState(false);
  const [edicion, setEdicion] = useState<AlumnoEnEdicion | null>(null);
  const [grupo, setGrupo] = useState<GrupoApoyo | null>(() => data.grupos.find(g => g.id === pedido?.grupoId) ?? null);
  // Alumnado creado desde la ventana del grupo: no existe hasta que se guarda el grupo
  const [nuevos, setNuevos] = useState<AlumnoApoyo[]>([]);
  const [rapido, setRapido] = useState({ nombre: '', clase: '' });
  const dosEspecialidades = especialidades.length > 1;
  const dia = (n: number) => weekdayLabel(n, locale, 'short');
  const esNuevoGrupo = !!grupo && !data.grupos.some(g => g.id === grupo.id);

  const hoy = isoDate();
  const T = trimestreDe(hoy);
  const alumnos = useMemo(() => [...data.alumnos].sort((a, b) => compararNombres(a.nombre, b.nombre)), [data.alumnos]);
  const evolucion = useMemo(() => new Map(evolucionDelTrimestre(data, T).map(e => [e.alumno.id, e])), [data, T]);
  const avisos = useMemo(() => avisosApoyo(data, hoy), [data, hoy]);

  function abrir(id: string) {
    requestAlumno(id);
    onNav('apoyo-alumno');
  }

  function cerrarGrupo() {
    setGrupo(null);
    setNuevos([]);
    setRapido({ nombre: '', clase: '' });
  }

  /** Un alumno nuevo, desde la ventana del grupo: queda marcado en él. */
  function anadirRapido() {
    const nombre = rapido.nombre.trim();
    if (!grupo || !nombre) return;
    const a = { ...alumnoVacio(), nombre, claseOrigen: rapido.clase.trim() };
    setNuevos(n => [...n, a]);
    setGrupo({ ...grupo, alumnos: [...grupo.alumnos, a.id] });
    setRapido({ nombre: '', clase: '' });
  }

  function guardarGrupo() {
    if (!grupo) return;
    const g = { ...grupo, nombre: grupo.nombre.trim(), horario: horarioLimpio(grupo.horario) };
    if (!g.nombre) { toast(t('Ponle un nombre al grupo')); return; }
    if (horarioIncorrecto(g.horario)) {
      toast(t('Revisa el horario: cada sesión tiene que acabar después de empezar'));
      return;
    }
    // Un nombre escrito y sin añadir se añade solo: es lo que se espera al pulsar «Guardar»
    const pendiente = rapido.nombre.trim() ? { ...alumnoVacio(), nombre: rapido.nombre.trim(), claseOrigen: rapido.clase.trim() } : null;
    const altas = [...nuevos.filter(a => g.alumnos.includes(a.id)), ...(pendiente ? [pendiente] : [])];
    const grupoFinal = pendiente ? { ...g, alumnos: [...g.alumnos, pendiente.id] } : g;
    onChange(d => ({
      ...d,
      alumnos: [...d.alumnos, ...altas],
      grupos: d.grupos.some(x => x.id === grupoFinal.id) ? d.grupos.map(x => (x.id === grupoFinal.id ? grupoFinal : x)) : [...d.grupos, grupoFinal],
    }));
    cerrarGrupo();
    toast(esNuevoGrupo ? t('✅ Grupo creado') : t('✅ Actualizado'));
  }

  function borrarGrupo() {
    if (!grupo) return;
    if (!window.confirm(t('¿Eliminar el grupo «{name}»? Se borran sus registros; el alumnado y sus programas se quedan.', { name: grupo.nombre }))) return;
    onChange(d => sinGrupo(d, grupo.id));
    cerrarGrupo();
    toast(t('Eliminado'));
  }

  const gruposDe = (id: string) => data.grupos.filter(g => g.alumnos.includes(id));
  const horarioTexto = (g: GrupoApoyo) =>
    [...g.horario].sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio))
      .map(f => `${dia(f.dia)} ${f.inicio}–${f.fin}`).join(' · ');

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Mi alumnado')}</h1>
          <p className="pg-sub">{t('Pulsa un alumno para ver todo lo suyo: su programa, sus sesiones, las coordinaciones y sus documentos. Al crear un alumno o un grupo puedes crear el otro en el mismo paso.')}</p>
        </div>
        <div className="ap-acciones" style={{ margin: 0 }}>
          {data.alumnos.length > 0 && (
            <button className="btn-ghost" onClick={() => setLote(true)}><FileText size={16} />{t('Documentos del trimestre')}</button>
          )}
          <button className={pestana === 'alumnado' ? 'btn-accent' : 'btn-ghost'} onClick={() => setEdicion(enEdicion(alumnoVacio(), data))}><Plus size={16} />{t('Nuevo alumno')}</button>
          <button className={pestana === 'grupos' ? 'btn-accent' : 'btn-ghost'} onClick={() => setGrupo(grupoVacio(especialidades[0] ?? 'PT', data.grupos.length))}><Plus size={16} />{t('Nuevo grupo')}</button>
        </div>
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
            <p className="ap-vacio">{t('Pulsa «Nuevo alumno»: con su nombre y su grupo de apoyo ya puedes empezar. Su curso, su nivel y sus necesidades se pueden completar después.')}</p>
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
            <p className="ap-vacio">{t('Todavía no hay grupos. Crea uno por cada sesión que das: «Lectoescritura, lunes 9:00», y añade su alumnado ahí mismo. Un alumno que atiendes solo es un grupo de uno.')}</p>
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

      <EditarAlumno edicion={edicion} onEdicion={setEdicion} data={data} onChange={onChange} especialidades={especialidades} />

      {/* ── Grupo de apoyo ── */}
      <Modal open={!!grupo} onClose={cerrarGrupo} wide title={esNuevoGrupo ? t('Nuevo grupo') : grupo?.nombre}>
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
                <HorarioEditor horario={grupo.horario} onChange={horario => setGrupo({ ...grupo, horario })} />
              </fieldset>
              <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
                <legend className="flabel">{t('Alumnado')}</legend>
                {data.alumnos.length + nuevos.length > 0 && (
                  <div className="chip-row">
                    {[...data.alumnos, ...nuevos].sort((a, b) => compararNombres(a.nombre, b.nombre)).map(a => {
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
                <div className="ap-neae-otra" style={{ marginTop: data.alumnos.length + nuevos.length > 0 ? 8 : 0 }}>
                  <input className="finput" value={rapido.nombre} aria-label={t('Nombre del alumno nuevo')} placeholder={t('Añadir un alumno nuevo: nombre y apellidos')}
                    onChange={e => setRapido({ ...rapido, nombre: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); anadirRapido(); } }} />
                  <input className="finput" value={rapido.clase} aria-label={t('Clase de origen')} placeholder={t('Ej: 2º B')} style={{ maxWidth: 110 }}
                    onChange={e => setRapido({ ...rapido, clase: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); anadirRapido(); } }} />
                  <button type="button" className="btn-ghost" onClick={anadirRapido} disabled={!rapido.nombre.trim()}><UserPlus size={14} />{t('Añadir')}</button>
                </div>
                <p className="ap-aviso" style={{ margin: '6px 0 0' }}>{t('Los demás datos del alumno (curso, nivel, necesidades) se completan después, en su página.')}</p>
              </fieldset>
              <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
                <legend className="flabel">{t('Color')}</legend>
                <div className="chip-row">
                  {PALETA_GRUPOS.map(c => (
                    <button key={c} type="button" className="ap-color" aria-label={c} aria-pressed={grupo.color === c}
                      style={{ background: c, outline: grupo.color === c ? '2px solid var(--text)' : 'none' }}
                      onClick={() => setGrupo({ ...grupo, color: c })} />
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="ap-acciones">
              <button className="btn-accent" onClick={guardarGrupo}>{t('Guardar')}</button>
              <button className="btn-ghost" onClick={cerrarGrupo}>{t('Cancelar')}</button>
              {!esNuevoGrupo && <button className="btn-ghost ap-borrar" onClick={borrarGrupo}><Trash2 size={15} />{t('Eliminar')}</button>}
            </div>
          </>
        )}
      </Modal>
      {lote && (
        <Suspense fallback={null}>
          <InformesLoteApoyo open={lote} onClose={() => setLote(false)} data={data} onChange={onChange} comunidad={comunidad} onNav={onNav} />
        </Suspense>
      )}
    </section>
  );
}
