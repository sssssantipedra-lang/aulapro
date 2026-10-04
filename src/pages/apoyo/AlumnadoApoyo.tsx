/**
 * PT y AL, «Alumnado y grupos»: el alumnado que atiende el especialista, de
 * cualquier clase del centro, y sus grupos de apoyo con su horario. Ver
 * `docs/PTAL.md`.
 */
import { useState } from 'react';
import { Plus, Pencil, Trash2, Users, UserRound, Clock } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { CursoSelect } from '../../components/apoyo/CursoSelect';
import { useNombreCurso } from '../../hooks/useNombreCurso';
import { useI18n, weekdayLabel } from '../../i18n';
import {
  CATEGORIAS_NEAE, nuevoIdApoyo, sinAlumno, sinGrupo, tieneDesfase,
} from '../../lib/apoyo';
import type { AlumnoApoyo, ApoyoData, Especialidad, FranjaApoyo, GrupoApoyo } from '../../types/apoyo';

const PALETA = ['#6366f1', '#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'] as const;

interface Props {
  data: ApoyoData;
  onChange: (f: (d: ApoyoData) => ApoyoData) => void;
  especialidades: Especialidad[];
}

function alumnoVacio(): AlumnoApoyo {
  return {
    id: nuevoIdApoyo('alu'), nombre: '', claseOrigen: '',
    categoria: '', diagnostico: '', necesidades: '', notas: '',
  };
}

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

export function AlumnadoApoyo({ data, onChange, especialidades }: Props) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const nombreCurso = useNombreCurso();
  const [alumno, setAlumno] = useState<AlumnoApoyo | null>(null);
  const [grupo, setGrupo] = useState<GrupoApoyo | null>(null);
  /** Grupos marcados en la ficha del alumno que se está editando. */
  const [gruposDelAlumno, setGruposDelAlumno] = useState<string[]>([]);
  const dosEspecialidades = especialidades.length > 1;
  const dia = (n: number) => weekdayLabel(n, locale, 'short');

  const esNuevoAlumno = !!alumno && !data.alumnos.some(a => a.id === alumno.id);
  const esNuevoGrupo = !!grupo && !data.grupos.some(g => g.id === grupo.id);

  function abrirAlumno(a: AlumnoApoyo) {
    setAlumno(a);
    setGruposDelAlumno(data.grupos.filter(g => g.alumnos.includes(a.id)).map(g => g.id));
  }

  function guardarAlumno() {
    if (!alumno) return;
    const a = { ...alumno, nombre: alumno.nombre.trim(), claseOrigen: alumno.claseOrigen.trim() };
    if (!a.nombre) { toast(t('Escribe el nombre del alumno o la alumna')); return; }
    onChange(d => ({
      ...d,
      alumnos: d.alumnos.some(x => x.id === a.id) ? d.alumnos.map(x => (x.id === a.id ? a : x)) : [...d.alumnos, a],
      grupos: d.grupos.map(g => {
        const dentro = g.alumnos.includes(a.id);
        const quiere = gruposDelAlumno.includes(g.id);
        if (dentro === quiere) return g;
        return { ...g, alumnos: quiere ? [...g.alumnos, a.id] : g.alumnos.filter(id => id !== a.id) };
      }),
    }));
    setAlumno(null);
    toast(esNuevoAlumno ? t('✅ Alumno añadido') : t('✅ Actualizado'));
  }

  function borrarAlumno() {
    if (!alumno) return;
    if (!window.confirm(t('¿Eliminar a {name}? Se borran también sus programas y sus registros.', { name: alumno.nombre }))) return;
    onChange(d => sinAlumno(d, alumno.id));
    setAlumno(null);
    toast(t('Eliminado'));
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
          <h1 className="pg-title">{t('Alumnado y grupos')}</h1>
          <p className="pg-sub">{t('El alumnado que atiendes, de cualquier clase del centro, y tus grupos de apoyo con su horario.')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-ghost" onClick={() => abrirAlumno(alumnoVacio())}><UserRound size={16} />{t('Nuevo alumno')}</button>
          <button className="btn-accent" onClick={() => setGrupo(grupoVacio(especialidades[0] ?? 'PT', data.grupos.length))}><Plus size={16} />{t('Nuevo grupo')}</button>
        </div>
      </div>

      <div className="card">
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

      <div className="card">
        <div className="card-hd"><div className="card-ttl"><UserRound size={14} color="var(--accent-d)" />{t('Alumnado')}</div></div>
        {data.alumnos.length === 0 ? (
          <p className="ap-vacio">{t('Añade a cada alumno con su clase, su curso y su nivel de competencia curricular. De ahí salen sus programas y los criterios que trabaja.')}</p>
        ) : (
          <ul className="ap-lista">
            {[...data.alumnos].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(a => (
              <li key={a.id}>
                <div className="ap-lista-txt">
                  <strong>{a.nombre}</strong>
                  <span className="ap-meta">
                    {a.claseOrigen && <span>{a.claseOrigen}</span>}
                    {a.matricula && <span>{nombreCurso(a.matricula)}</span>}
                    {a.nivel && (
                      <span className={`sda-chip${tieneDesfase(a) ? ' shared' : ''}`}>{t('Nivel de {curso}', { curso: nombreCurso(a.nivel) })}</span>
                    )}
                    {a.categoria && <span className="sda-chip">{a.categoria}</span>}
                  </span>
                  {gruposDe(a.id).length > 0 && (
                    <span className="ap-sub">{gruposDe(a.id).map(g => g.nombre).join(' · ')}</span>
                  )}
                </div>
                <button className="ico-btn" onClick={() => abrirAlumno(a)} aria-label={t('Editar «{name}»', { name: a.nombre })} title={t('Editar')}><Pencil size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Ficha del alumno ── */}
      <Modal open={!!alumno} onClose={() => setAlumno(null)} wide title={esNuevoAlumno ? t('Nuevo alumno') : alumno?.nombre}>
        {alumno && (
          <>
            <div className="ap-form">
              <div className="fgroup"><label className="flabel" htmlFor="ap-a-nombre">{t('Nombre y apellidos')}</label>
                <input id="ap-a-nombre" className="finput" value={alumno.nombre} autoFocus onChange={e => setAlumno({ ...alumno, nombre: e.target.value })} /></div>
              <div className="fgroup"><label className="flabel" htmlFor="ap-a-clase">{t('Clase de origen')}</label>
                <input id="ap-a-clase" className="finput" value={alumno.claseOrigen} placeholder={t('Ej: 2º B')} onChange={e => setAlumno({ ...alumno, claseOrigen: e.target.value })} /></div>
              <div className="fgroup"><label className="flabel" htmlFor="ap-a-mat">{t('Curso en que está matriculado')}</label>
                <CursoSelect id="ap-a-mat" value={alumno.matricula} vacio={t('Sin indicar')} onChange={c => setAlumno({ ...alumno, matricula: c })} /></div>
              <div className="fgroup"><label className="flabel" htmlFor="ap-a-nivel">{t('Nivel de competencia curricular')}</label>
                <CursoSelect id="ap-a-nivel" value={alumno.nivel} vacio={t('El de su curso')} onChange={c => setAlumno({ ...alumno, nivel: c })} /></div>
              <div className="fgroup" style={{ gridColumn: '1 / -1' }}><label className="flabel" htmlFor="ap-a-cat">{t('Necesidad específica de apoyo educativo')}</label>
                <input id="ap-a-cat" className="finput" list="ap-categorias" value={alumno.categoria} placeholder={t('Elige o escribe la categoría')} onChange={e => setAlumno({ ...alumno, categoria: e.target.value })} />
                <datalist id="ap-categorias">{CATEGORIAS_NEAE.map(c => <option key={c} value={t(c)} />)}</datalist>
              </div>
              <div className="fgroup" style={{ gridColumn: '1 / -1' }}><label className="flabel" htmlFor="ap-a-diag">{t('Diagnóstico')}</label>
                <textarea id="ap-a-diag" className="finput" rows={2} value={alumno.diagnostico} onChange={e => setAlumno({ ...alumno, diagnostico: e.target.value })} /></div>
              <div className="fgroup" style={{ gridColumn: '1 / -1' }}><label className="flabel" htmlFor="ap-a-nec">{t('Necesidades educativas')}</label>
                <textarea id="ap-a-nec" className="finput" rows={3} value={alumno.necesidades} placeholder={t('Barreras, fortalezas y qué le ayuda: «le cuesta mantener la atención más de 10 minutos; aprende mejor con apoyo visual»')} onChange={e => setAlumno({ ...alumno, necesidades: e.target.value })} /></div>
              <div className="fgroup" style={{ gridColumn: '1 / -1' }}><label className="flabel" htmlFor="ap-a-notas">{t('Notas')}</label>
                <textarea id="ap-a-notas" className="finput" rows={2} value={alumno.notas} onChange={e => setAlumno({ ...alumno, notas: e.target.value })} /></div>
              {data.grupos.length > 0 && (
                <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
                  <legend className="flabel">{t('Grupos')}</legend>
                  <div className="chip-row">
                    {data.grupos.map(g => {
                      const on = gruposDelAlumno.includes(g.id);
                      return (
                        <button key={g.id} type="button" className={`chip sm accent${on ? ' on' : ''}`} aria-pressed={on}
                          onClick={() => setGruposDelAlumno(prev => (on ? prev.filter(x => x !== g.id) : [...prev, g.id]))}>
                          <span className="chip-dot" style={{ background: g.color }} aria-hidden="true" />{g.nombre}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </div>
            <p className="ap-aviso">{t('Todo se guarda en este equipo. Si usas la IA, recibe también lo que escribes aquí, incluido el diagnóstico, con el nombre cambiado por un código. El diagnóstico es un dato de salud: si no quieres que llegue a Google, déjalo en blanco.')}</p>
            <div className="ap-acciones">
              <button className="btn-accent" onClick={guardarAlumno}>{t('Guardar')}</button>
              <button className="btn-ghost" onClick={() => setAlumno(null)}>{t('Cancelar')}</button>
              {!esNuevoAlumno && <button className="btn-ghost ap-borrar" onClick={borrarAlumno}><Trash2 size={15} />{t('Eliminar')}</button>}
            </div>
          </>
        )}
      </Modal>

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
                  <p className="ap-vacio" style={{ margin: 0 }}>{t('Primero añade al alumnado con «Nuevo alumno».')}</p>
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
