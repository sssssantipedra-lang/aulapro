/**
 * PT y AL: la ventana con los datos de un alumno de apoyo (nombre, clase,
 * curso, nivel, su grupo y, plegados, necesidades, diagnóstico y notas). Se
 * abre desde «Mi alumnado» para uno nuevo y desde la pestaña «Datos» de su
 * página para cambiarlo o eliminarlo. Lo mínimo es el nombre y el grupo, y el
 * grupo se puede crear aquí mismo, sin salir de la ventana (decisión del
 * dueño, 18-10-2026). Ver `docs/PTAL.md`.
 */
import { claveDeNombre } from '../../lib/alumnado';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { CursoSelect } from '../../components/apoyo/CursoSelect';
import { ApoyosAula } from '../../components/apoyo/ApoyosAula';
import { HorarioEditor } from '../../components/apoyo/HorarioEditor';
import { useI18n } from '../../i18n';
import { grupoVacio, horarioIncorrecto, horarioLimpio, sinAlumno, type AlumnoEnEdicion } from '../../lib/apoyo';
import type { AlumnoApoyo, ApoyoData, Especialidad } from '../../types/apoyo';

export function EditarAlumno({ edicion, onEdicion, data, onChange, especialidades }: {
  /** Cerrada si no hay nada. */
  edicion: AlumnoEnEdicion | null;
  onEdicion: (e: AlumnoEnEdicion | null) => void;
  data: ApoyoData;
  onChange: (f: (d: ApoyoData) => ApoyoData) => void;
  especialidades: Especialidad[];
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const alumno = edicion?.alumno ?? null;
  const esNuevo = !!alumno && !data.alumnos.some(a => a.id === alumno.id);
  const setAlumno = (a: AlumnoApoyo) => edicion && onEdicion({ ...edicion, alumno: a });
  const cerrar = () => onEdicion(null);

  function guardar() {
    if (!edicion) return;
    const a = { ...edicion.alumno, nombre: edicion.alumno.nombre.trim(), claseOrigen: edicion.alumno.claseOrigen.trim() };
    if (!a.nombre) { toast(t('Escribe el nombre del alumno o la alumna')); return; }
    // Dos alumnos de apoyo de la misma clase con el mismo nombre no se distinguirían (tampoco para la IA)
    const igual = data.alumnos.find(x => x.id !== a.id && claveDeNombre(x.claseOrigen) === claveDeNombre(a.claseOrigen) && claveDeNombre(x.nombre) === claveDeNombre(a.nombre));
    if (igual) { toast(t('Ya hay un alumno que se llama «{name}» en esta clase. Añade el segundo apellido o una inicial para diferenciarlos.', { name: igual.nombre })); return; }
    // El grupo nuevo solo se crea si tiene nombre; entonces el alumno entra en él
    const nuevo = edicion.grupoNuevo && edicion.grupoNuevo.nombre.trim()
      ? { ...edicion.grupoNuevo, nombre: edicion.grupoNuevo.nombre.trim(), horario: horarioLimpio(edicion.grupoNuevo.horario), alumnos: [a.id] }
      : null;
    if (nuevo && horarioIncorrecto(nuevo.horario)) {
      toast(t('Revisa el horario: cada sesión tiene que acabar después de empezar'));
      return;
    }
    onChange(d => ({
      ...d,
      alumnos: d.alumnos.some(x => x.id === a.id) ? d.alumnos.map(x => (x.id === a.id ? a : x)) : [...d.alumnos, a],
      grupos: [
        ...d.grupos.map(g => {
          const dentro = g.alumnos.includes(a.id);
          const quiere = edicion.grupos.includes(g.id);
          if (dentro === quiere) return g;
          return { ...g, alumnos: quiere ? [...g.alumnos, a.id] : g.alumnos.filter(id => id !== a.id) };
        }),
        ...(nuevo ? [nuevo] : []),
      ],
    }));
    cerrar();
    toast(esNuevo ? t('✅ Alumno añadido') : t('✅ Actualizado'));
  }

  function borrar() {
    if (!alumno) return;
    if (!window.confirm(t('¿Eliminar a {name}? Se borran también sus programas y sus registros.', { name: alumno.nombre }))) return;
    onChange(d => sinAlumno(d, alumno.id));
    cerrar();
    toast(t('Eliminado'));
  }

  return (
    <Modal open={!!alumno} onClose={cerrar} wide title={esNuevo ? t('Nuevo alumno') : alumno?.nombre}>
      {edicion && alumno && (
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
            <GrupoDelAlumno edicion={edicion} onEdicion={onEdicion} data={data} especialidades={especialidades} />
            <details className="ap-mas" open={!esNuevo} style={{ gridColumn: '1 / -1' }}>
              <summary><ChevronDown size={15} aria-hidden="true" />{t('Barreras de aprendizaje, apoyos y notas')}<span className="ap-sub">{esNuevo ? t('Se pueden completar después') : ''}</span></summary>
              <div className="ap-form" style={{ marginTop: 10 }}>
                <ApoyosAula value={alumno.apoyos ?? []} onChange={apoyos => setAlumno({ ...alumno, apoyos: apoyos.length ? apoyos : undefined })} />
                <div className="fgroup" style={{ gridColumn: '1 / -1' }}><label className="flabel" htmlFor="ap-a-nec">{t('Barreras de aprendizaje')}</label>
                  <textarea id="ap-a-nec" className="finput" rows={3} value={alumno.necesidades} placeholder={t('Qué le cuesta, qué le ayuda y sus fortalezas: «le cuesta la lectoescritura y mantener la atención más de 10 minutos; aprende mejor con apoyo visual»')} onChange={e => setAlumno({ ...alumno, necesidades: e.target.value })} /></div>
                <div className="fgroup" style={{ gridColumn: '1 / -1' }}><label className="flabel" htmlFor="ap-a-notas">{t('Notas')}</label>
                  <textarea id="ap-a-notas" className="finput" rows={2} value={alumno.notas} onChange={e => setAlumno({ ...alumno, notas: e.target.value })} /></div>
              </div>
            </details>
          </div>
          <p className="ap-aviso">{t('Todo se guarda en este equipo. AulaPro no guarda el diagnóstico ni la categoría: describe las barreras de aprendizaje (qué le cuesta y qué le ayuda). Si usas la IA, recibe los apoyos que necesita, sus barreras y tus notas, con el nombre cambiado por un código y sin datos de salud.')}</p>
          <div className="ap-acciones">
            <button className="btn-accent" onClick={guardar}>{t('Guardar')}</button>
            <button className="btn-ghost" onClick={cerrar}>{t('Cancelar')}</button>
            {!esNuevo && <button className="btn-ghost ap-borrar" onClick={borrar}><Trash2 size={15} />{t('Eliminar')}</button>}
          </div>
        </>
      )}
    </Modal>
  );
}

/**
 * El grupo de apoyo del alumno: se marcan los que hay o se crea uno aquí mismo
 * (nombre y horario), y el alumno entra en él al guardar.
 */
function GrupoDelAlumno({ edicion, onEdicion, data, especialidades }: {
  edicion: AlumnoEnEdicion;
  onEdicion: (e: AlumnoEnEdicion) => void;
  data: ApoyoData;
  especialidades: Especialidad[];
}) {
  const { t } = useI18n();
  const nuevo = edicion.grupoNuevo;
  const setNuevo = (g: AlumnoEnEdicion['grupoNuevo']) => onEdicion({ ...edicion, grupoNuevo: g });
  return (
    <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
      <legend className="flabel">{t('Grupo de apoyo')}</legend>
      {data.grupos.length > 0 && (
        <div className="chip-row">
          {data.grupos.map(g => {
            const on = edicion.grupos.includes(g.id);
            return (
              <button key={g.id} type="button" className={`chip sm accent${on ? ' on' : ''}`} aria-pressed={on}
                onClick={() => onEdicion({ ...edicion, grupos: on ? edicion.grupos.filter(x => x !== g.id) : [...edicion.grupos, g.id] })}>
                <span className="chip-dot" style={{ background: g.color }} aria-hidden="true" />{g.nombre}
              </button>
            );
          })}
        </div>
      )}
      {!nuevo ? (
        <button type="button" className="btn-ghost" style={{ fontSize: 12.5, marginTop: data.grupos.length ? 8 : 0 }}
          onClick={() => setNuevo(grupoVacio(especialidades[0] ?? 'PT', data.grupos.length))}>
          <Plus size={14} />{data.grupos.length ? t('Crear un grupo nuevo') : t('Crear su grupo de apoyo')}
        </button>
      ) : (
        <div className="ap-grupo-nuevo">
          <div className="fgroup"><label className="flabel" htmlFor="ap-gn-nombre">{t('Nombre del grupo')}</label>
            <input id="ap-gn-nombre" className="finput" value={nuevo.nombre} placeholder={t('Ej: Lectoescritura, lunes 9:00')} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} /></div>
          {especialidades.length > 1 && (
            <div className="chip-row" role="group" aria-label={t('Especialidad')}>
              {especialidades.map(e => (
                <button key={e} type="button" className={`chip sm accent${nuevo.especialidad === e ? ' on' : ''}`} aria-pressed={nuevo.especialidad === e}
                  onClick={() => setNuevo({ ...nuevo, especialidad: e })}>{e}</button>
              ))}
            </div>
          )}
          <div className="chip-row" role="group" aria-label={t('Dónde')}>
            {(['fuera', 'dentro'] as const).map(m => (
              <button key={m} type="button" className={`chip sm accent${nuevo.modalidad === m ? ' on' : ''}`} aria-pressed={nuevo.modalidad === m}
                onClick={() => setNuevo({ ...nuevo, modalidad: m })}>{m === 'dentro' ? t('Dentro del aula') : t('Fuera del aula')}</button>
            ))}
          </div>
          <HorarioEditor horario={nuevo.horario} onChange={horario => setNuevo({ ...nuevo, horario })} />
          <button type="button" className="btn-ghost" style={{ fontSize: 12.5 }} onClick={() => setNuevo(undefined)}>{t('No crear este grupo')}</button>
        </div>
      )}
    </fieldset>
  );
}
