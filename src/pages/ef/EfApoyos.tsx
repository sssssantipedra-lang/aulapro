/**
 * Educación Física, en «Exentos y lesiones»: el alumnado con medidas de nivel
 * II o III de respuesta para la inclusión (Decreto 104/2018 de la Comunitat
 * Valenciana, art. 14; decisión del dueño, 6-10-2026) y lo que necesita en EF.
 * Es para todo el curso, no tiene fechas. A la IA le llegan el nivel y lo que
 * necesita, sin el nombre ni el diagnóstico, para ajustar el DUA-A de
 * actividades, sesiones y situaciones de aprendizaje. Ver `docs/EF.md`.
 */
import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, HandHelping, Check } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useI18n } from '../../i18n';
import { NECESIDADES_EF, NIVELES_APOYO, nuevoIdEF } from '../../lib/ef';
import type { Class, Student } from '../../types';
import type { ApoyoEF, EfData } from '../../types/ef';

interface Props {
  classes: Class[];
  students: Student[];
  ef: EfData;
  onChangeEf: (f: (d: EfData) => EfData) => void;
}

export function EfApoyos({ classes, students, ef, onChangeEf }: Props) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [editando, setEditando] = useState<ApoyoEF | null>(null);
  const esNuevo = !!editando && !ef.apoyos.some(a => a.id === editando.id);
  const alumnado = useMemo(() => [...students].sort((a, b) => a.name.localeCompare(b.name)), [students]);
  const alumno = (id: string) => students.find(s => s.id === id);
  const clase = (id: string) => classes.find(c => c.id === alumno(id)?.class_id)?.name ?? '';
  // Uno por alumno: en el desplegable, los que ya tienen nivel no salen (salvo el que se edita)
  const libres = (actual?: string) => alumnado.filter(s => s.id === actual || !ef.apoyos.some(a => a.alumnoId === s.id));
  const lista = ef.apoyos
    .filter(a => alumno(a.alumnoId))
    .sort((a, b) => b.nivel - a.nivel || alumno(a.alumnoId)!.name.localeCompare(alumno(b.alumnoId)!.name));

  function nuevo() {
    const primero = libres()[0];
    if (!primero) { toast(t('Todo tu alumnado tiene ya su nivel.')); return; }
    setEditando({ id: nuevoIdEF('apo'), alumnoId: primero.id, nivel: 3, necesidades: [], otra: '' });
  }

  function guardar() {
    if (!editando) return;
    if (!editando.alumnoId) { toast(t('Elige el alumno o la alumna.')); return; }
    const a = { ...editando, otra: editando.otra.trim() };
    onChangeEf(d => ({ ...d, apoyos: [...d.apoyos.filter(x => x.id !== a.id && x.alumnoId !== a.alumnoId), a] }));
    setEditando(null);
    toast(t('✅ Guardado'));
  }

  function quitar(a: ApoyoEF) {
    if (!window.confirm(t('¿Quitar el nivel de apoyo de {nombre}?', { nombre: alumno(a.alumnoId)?.name ?? '' }))) return;
    onChangeEf(d => ({ ...d, apoyos: d.apoyos.filter(x => x.id !== a.id) }));
    setEditando(null);
  }

  const nivel = (n: ApoyoEF['nivel']) => NIVELES_APOYO.find(x => x.id === n)!;

  return (
    <div className="card">
      <div className="ap-prog-hd" style={{ marginBottom: 6 }}>
        <div className="home-card-ttl"><HandHelping size={15} />{t('Niveles de respuesta II y III')}</div>
        <button className="btn-ghost" onClick={nuevo}><Plus size={15} />{t('Añadir alumno')}</button>
      </div>
      <p className="ap-sub" style={{ margin: '0 0 10px' }}>
        {t('El alumnado con medidas de nivel II o III para todo el curso (Decreto 104/2018), y lo que necesita en EF. La IA lo tiene en cuenta en el DUA-A de las actividades, las sesiones y las situaciones de aprendizaje.')}
      </p>
      {lista.length === 0
        ? <p className="ap-vacio">{t('Nadie todavía. Añade al alumnado que tiene medidas de nivel II o III.')}</p>
        : (
          <ul className="ap-lista">
            {lista.map(a => {
              const s = alumno(a.alumnoId)!;
              const que = a.necesidades.map(n => t(NECESIDADES_EF.find(x => x.id === n)!.label)).concat(a.otra ? [a.otra] : []);
              return (
                <li key={a.id}>
                  <span className={`sda-chip ef-nivel ef-nivel-${a.nivel}`}>{t(nivel(a.nivel).corto)}</span>
                  <span className="ap-lista-txt">
                    <strong>{s.name}</strong>
                    <span className="ap-meta"><span>{clase(a.alumnoId)}</span><span>{t(nivel(a.nivel).label)}</span></span>
                    {que.length > 0 && <span className="ap-sub">{que.join(' · ')}</span>}
                  </span>
                  <button className="ico-btn" onClick={() => setEditando(a)} aria-label={t('Editar «{name}»', { name: s.name })} title={t('Editar')}><Pencil size={15} /></button>
                </li>
              );
            })}
          </ul>
        )}

      <Modal open={!!editando} onClose={() => setEditando(null)} wide title={esNuevo ? t('Nivel de respuesta') : alumno(editando?.alumnoId ?? '')?.name}>
        {editando && (
          <div className="ap-form">
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-ap-alumno">{t('Alumno o alumna')}</label>
              <select id="ef-ap-alumno" className="finput" value={editando.alumnoId} onChange={e => setEditando({ ...editando, alumnoId: e.target.value })}>
                {classes.map(c => {
                  const deLaClase = libres(editando.alumnoId).filter(s => s.class_id === c.id);
                  return deLaClase.length > 0 && (
                    <optgroup key={c.id} label={c.name}>
                      {deLaClase.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <div className="flabel" id="ef-ap-nivel-l">{t('Nivel de respuesta para la inclusión')}</div>
              <div className="td-opts" role="radiogroup" aria-labelledby="ef-ap-nivel-l">
                {NIVELES_APOYO.map(n => {
                  const on = editando.nivel === n.id;
                  return (
                    <button key={n.id} type="button" role="radio" aria-checked={on} className={`td-opt${on ? ' on' : ''}`}
                      onClick={() => setEditando({ ...editando, nivel: n.id })}>
                      <span className="td-txt">
                        <strong>{t(n.corto)}: {t(n.label)}</strong>
                        <span>{t(n.ayuda)}</span>
                      </span>
                      {on && <Check size={16} className="td-check" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
              <legend className="flabel">{t('Qué necesita en EF')}</legend>
              <div className="chip-row">
                {NECESIDADES_EF.map(n => {
                  const on = editando.necesidades.includes(n.id);
                  return (
                    <button key={n.id} type="button" className={`chip sm accent${on ? ' on' : ''}`} aria-pressed={on}
                      onClick={() => setEditando({ ...editando, necesidades: on ? editando.necesidades.filter(x => x !== n.id) : [...editando.necesidades, n.id] })}>
                      {t(n.label)}
                    </button>
                  );
                })}
              </div>
              <input className="finput" style={{ marginTop: 8 }} value={editando.otra} aria-label={t('Otra necesidad')}
                placeholder={t('Otra, sin el diagnóstico. Ej: le cuesta esperar su turno')}
                onChange={e => setEditando({ ...editando, otra: e.target.value })} />
            </fieldset>
            <p className="ap-aviso" style={{ gridColumn: '1 / -1' }}>{t('A la IA le llegan el nivel y lo que necesita, sin su nombre ni su diagnóstico. No escribas aquí el diagnóstico.')}</p>
            <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
              <button className="btn-accent" onClick={guardar}>{t('Guardar')}</button>
              <button className="btn-ghost" onClick={() => setEditando(null)}>{t('Cancelar')}</button>
              {!esNuevo && <button className="btn-ghost ap-borrar" onClick={() => quitar(editando)}><Trash2 size={14} />{t('Quitar')}</button>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
