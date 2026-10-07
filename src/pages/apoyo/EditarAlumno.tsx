/**
 * PT y AL: la ventana con los datos de un alumno de apoyo (nombre, clase,
 * curso, nivel, necesidades, diagnóstico, notas y sus grupos). Se abre desde
 * «Mi alumnado» para uno nuevo y desde la pestaña «Datos» de su página para
 * cambiarlo o eliminarlo. Ver `docs/PTAL.md`.
 */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { CursoSelect } from '../../components/apoyo/CursoSelect';
import { useI18n } from '../../i18n';
import { CATEGORIAS_NEAE, GRUPOS_NEAE, sinAlumno, type AlumnoEnEdicion } from '../../lib/apoyo';
import type { AlumnoApoyo, ApoyoData } from '../../types/apoyo';

export function EditarAlumno({ edicion, onEdicion, data, onChange }: {
  /** Cerrada si no hay nada. */
  edicion: AlumnoEnEdicion | null;
  onEdicion: (e: AlumnoEnEdicion | null) => void;
  data: ApoyoData;
  onChange: (f: (d: ApoyoData) => ApoyoData) => void;
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
    onChange(d => ({
      ...d,
      alumnos: d.alumnos.some(x => x.id === a.id) ? d.alumnos.map(x => (x.id === a.id ? a : x)) : [...d.alumnos, a],
      grupos: d.grupos.map(g => {
        const dentro = g.alumnos.includes(a.id);
        const quiere = edicion.grupos.includes(g.id);
        if (dentro === quiere) return g;
        return { ...g, alumnos: quiere ? [...g.alumnos, a.id] : g.alumnos.filter(id => id !== a.id) };
      }),
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
            <NecesidadesPicker value={alumno.categorias} onChange={categorias => setAlumno({ ...alumno, categorias })} />
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
                    const on = edicion.grupos.includes(g.id);
                    return (
                      <button key={g.id} type="button" className={`chip sm accent${on ? ' on' : ''}`} aria-pressed={on}
                        onClick={() => onEdicion({ ...edicion, grupos: on ? edicion.grupos.filter(x => x !== g.id) : [...edicion.grupos, g.id] })}>
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
 * Sus necesidades específicas de apoyo educativo: se marcan las que tenga, en
 * dos grupos, y las que no estén en la lista se añaden a mano.
 */
function NecesidadesPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useI18n();
  const [otra, setOtra] = useState('');
  const propias = value.filter(c => !CATEGORIAS_NEAE.includes(c));
  const alternar = (c: string) => onChange(value.includes(c) ? value.filter(x => x !== c) : [...value, c]);
  function anadir() {
    const c = otra.trim();
    if (c && !value.some(x => x.toLocaleLowerCase() === c.toLocaleLowerCase())) onChange([...value, c]);
    setOtra('');
  }
  return (
    <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
      <legend className="flabel">{t('Necesidades específicas de apoyo educativo')}</legend>
      <p className="ap-aviso" style={{ margin: '0 0 8px' }}>{t('Marca todas las que tenga.')}</p>
      {GRUPOS_NEAE.map(g => (
        <div key={g.titulo} className="ap-neae">
          <div className="ap-neae-ttl">{t(g.titulo)}</div>
          <div className="chip-row">
            {g.categorias.map(c => {
              const on = value.includes(c);
              return (
                <button key={c} type="button" className={`chip sm accent${on ? ' on' : ''}`} aria-pressed={on} onClick={() => alternar(c)}>{t(c)}</button>
              );
            })}
          </div>
        </div>
      ))}
      {propias.length > 0 && (
        <div className="chip-row" style={{ marginTop: 8 }}>
          {propias.map(c => (
            <button key={c} type="button" className="chip sm accent on" aria-pressed="true" onClick={() => alternar(c)}
              aria-label={t('Quitar «{name}»', { name: c })} title={t('Quitar')}>{c} ×</button>
          ))}
        </div>
      )}
      <div className="ap-neae-otra">
        <input id="ap-a-otra" className="finput" value={otra} aria-label={t('Otra necesidad')}
          placeholder={t('Otra que no esté en la lista')} onChange={e => setOtra(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); anadir(); } }} />
        <button type="button" className="btn-ghost" onClick={anadir} disabled={!otra.trim()}><Plus size={14} />{t('Añadir')}</button>
      </div>
    </fieldset>
  );
}
