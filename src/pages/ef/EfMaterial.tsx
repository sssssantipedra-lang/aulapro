/**
 * Educación Física, «Material e instalaciones» (decisión del dueño,
 * 5-10-2026): el inventario del material (cantidad, estado y dónde está) y las
 * instalaciones, con si son cubiertas, para el plan B cuando llueve. La IA lo
 * usa al proponer actividades y sesiones. Ver `docs/EF.md`.
 */
import { useState } from 'react';
import { Plus, Pencil, Trash2, Package, Warehouse, Umbrella, Sun } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useI18n } from '../../i18n';
import { nuevoIdEF } from '../../lib/ef';
import type { EfData, InstalacionEF, MaterialEF } from '../../types/ef';

interface Props {
  ef: EfData;
  onChangeEf: (f: (d: EfData) => EfData) => void;
}

const ESTADOS: readonly { id: MaterialEF['estado']; label: string }[] = [
  { id: 'bien', label: 'Bien' },
  { id: 'regular', label: 'Regular' },
  { id: 'reponer', label: 'Para reponer' },
];

export function EfMaterial({ ef, onChangeEf }: Props) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [material, setMaterial] = useState<MaterialEF | null>(null);
  const [instalacion, setInstalacion] = useState<InstalacionEF | null>(null);
  const nuevoMaterial = !!material && !ef.material.some(m => m.id === material.id);
  const nuevaInstalacion = !!instalacion && !ef.instalaciones.some(i => i.id === instalacion.id);
  const reponer = ef.material.filter(m => m.estado === 'reponer');
  const ordenado = [...ef.material].sort((a, b) => a.nombre.localeCompare(b.nombre));

  function guardarMaterial() {
    if (!material) return;
    const m = { ...material, nombre: material.nombre.trim(), ubicacion: material.ubicacion.trim() };
    if (!m.nombre) { toast(t('Escribe qué material es.')); return; }
    onChangeEf(d => ({ ...d, material: d.material.some(x => x.id === m.id) ? d.material.map(x => (x.id === m.id ? m : x)) : [...d.material, m] }));
    setMaterial(null);
  }

  function guardarInstalacion() {
    if (!instalacion) return;
    const i = { ...instalacion, nombre: instalacion.nombre.trim() };
    if (!i.nombre) { toast(t('Escribe el nombre de la instalación.')); return; }
    onChangeEf(d => ({ ...d, instalaciones: d.instalaciones.some(x => x.id === i.id) ? d.instalaciones.map(x => (x.id === i.id ? i : x)) : [...d.instalaciones, i] }));
    setInstalacion(null);
  }

  /** Cambiar el estado desde la tabla, sin abrir el formulario. */
  const ponerEstado = (id: string, estado: MaterialEF['estado']) =>
    onChangeEf(d => ({ ...d, material: d.material.map(x => (x.id === id ? { ...x, estado } : x)) }));

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Material e instalaciones')}</h1>
          <p className="pg-sub">{t('El inventario del material y tus instalaciones, con las cubiertas para el plan B. La IA los tiene en cuenta al proponer actividades y sesiones.')}</p>
        </div>
      </div>

      <div className="card">
        <div className="ap-prog-hd" style={{ marginBottom: 10 }}>
          <div className="home-card-ttl"><Package size={15} />{t('Material')}</div>
          <button className="btn-accent" onClick={() => setMaterial({ id: nuevoIdEF('mat'), nombre: '', cantidad: 1, estado: 'bien', ubicacion: '' })}><Plus size={15} />{t('Añadir material')}</button>
        </div>
        {reponer.length > 0 && (
          <p className="ap-aviso ef-eq-aviso" role="status">
            {t('Para reponer: {lista}.', { lista: reponer.map(m => m.nombre).join(', ') })}
          </p>
        )}
        {ordenado.length === 0 ? (
          <p className="ap-vacio">{t('Todavía no hay material. Añade lo que tienes: balones, conos, petos, raquetas…')}</p>
        ) : (
          <div className="ef-tabla-wrap" style={{ marginTop: 0 }}>
            <table className="ef-tabla ef-tabla-material">
              <thead><tr>
                <th scope="col">{t('Material')}</th><th scope="col">{t('Cantidad')}</th><th scope="col">{t('Estado')}</th>
                <th scope="col" className="ef-col-ubic">{t('Dónde está')}</th><th scope="col"><span className="sr-only">{t('Editar')}</span></th>
              </tr></thead>
              <tbody>
                {ordenado.map(m => (
                  <tr key={m.id}>
                    <th scope="row">{m.nombre}{m.ubicacion && <span className="ap-sub ef-ubic-movil">{m.ubicacion}</span>}</th>
                    <td className="ef-num">{m.cantidad}</td>
                    <td>
                      <select className={`finput ef-estado ${m.estado}`} value={m.estado} aria-label={t('Estado de {nombre}', { nombre: m.nombre })}
                        onChange={e => ponerEstado(m.id, e.target.value as MaterialEF['estado'])}>
                        {ESTADOS.map(x => <option key={x.id} value={x.id}>{t(x.label)}</option>)}
                      </select>
                    </td>
                    <td className="ef-col-ubic">{m.ubicacion}</td>
                    <td><button className="ico-btn" onClick={() => setMaterial(m)} aria-label={t('Editar «{name}»', { name: m.nombre })} title={t('Editar')}><Pencil size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="ap-prog-hd" style={{ marginBottom: 10 }}>
          <div className="home-card-ttl"><Warehouse size={15} />{t('Instalaciones')}</div>
          <button className="btn-accent" onClick={() => setInstalacion({ id: nuevoIdEF('ins'), nombre: '', cubierta: false, notas: '' })}><Plus size={15} />{t('Añadir instalación')}</button>
        </div>
        {ef.instalaciones.length === 0 ? (
          <p className="ap-vacio">{t('Añade el pabellón, la pista, el porche… y marca cuáles son cubiertas: así la IA prepara el plan B para los días de lluvia.')}</p>
        ) : (
          <ul className="ap-lista">
            {ef.instalaciones.map(i => (
              <li key={i.id}>
                {i.cubierta ? <Umbrella size={18} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--accent-d)' }} /> : <Sun size={18} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--warn-fg)' }} />}
                <span className="ap-lista-txt">
                  <strong>{i.nombre}</strong>
                  <span className="ap-meta">{i.cubierta ? t('Cubierta: sirve con lluvia') : t('Al aire libre')}</span>
                  {i.notas.trim() && <span className="ap-sub">{i.notas}</span>}
                </span>
                <button className="ico-btn" onClick={() => setInstalacion(i)} aria-label={t('Editar «{name}»', { name: i.nombre })} title={t('Editar')}><Pencil size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={!!material} onClose={() => setMaterial(null)} title={nuevoMaterial ? t('Añadir material') : material?.nombre}>
        {material && (
          <div className="ap-form">
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-m-nombre">{t('Material')}</label>
              <input id="ef-m-nombre" className="finput" value={material.nombre} placeholder={t('Ej: balones de voleibol')} onChange={e => setMaterial({ ...material, nombre: e.target.value })} />
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-m-cant">{t('Cantidad')}</label>
              <input id="ef-m-cant" type="number" min={0} className="finput" value={material.cantidad}
                onChange={e => setMaterial({ ...material, cantidad: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-m-estado">{t('Estado')}</label>
              <select id="ef-m-estado" className="finput" value={material.estado} onChange={e => setMaterial({ ...material, estado: e.target.value as MaterialEF['estado'] })}>
                {ESTADOS.map(x => <option key={x.id} value={x.id}>{t(x.label)}</option>)}
              </select>
            </div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-m-ubic">{t('Dónde está')}</label>
              <input id="ef-m-ubic" className="finput" value={material.ubicacion} placeholder={t('Ej: almacén del pabellón')} onChange={e => setMaterial({ ...material, ubicacion: e.target.value })} />
            </div>
            <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
              <button className="btn-accent" onClick={guardarMaterial}>{t('Guardar')}</button>
              <button className="btn-ghost" onClick={() => setMaterial(null)}>{t('Cancelar')}</button>
              {!nuevoMaterial && (
                <button className="btn-ghost ap-borrar" onClick={() => {
                  if (!window.confirm(t('¿Quitar «{nombre}» del inventario?', { nombre: material.nombre }))) return;
                  onChangeEf(d => ({ ...d, material: d.material.filter(x => x.id !== material.id) }));
                  setMaterial(null);
                }}><Trash2 size={14} />{t('Quitar')}</button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!instalacion} onClose={() => setInstalacion(null)} title={nuevaInstalacion ? t('Añadir instalación') : instalacion?.nombre}>
        {instalacion && (
          <div className="ap-form">
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-i-nombre">{t('Nombre')}</label>
              <input id="ef-i-nombre" className="finput" value={instalacion.nombre} placeholder={t('Ej: pabellón, pista exterior, porche')} onChange={e => setInstalacion({ ...instalacion, nombre: e.target.value })} />
            </div>
            <label className="td-chk" style={{ gridColumn: '1 / -1' }}>
              <input type="checkbox" checked={instalacion.cubierta} onChange={e => setInstalacion({ ...instalacion, cubierta: e.target.checked })} />
              {t('Es cubierta: sirve los días de lluvia')}
            </label>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-i-notas">{t('Notas')}</label>
              <textarea id="ef-i-notas" className="finput" rows={2} value={instalacion.notas} placeholder={t('Ej: compartida los martes; espacio reducido')}
                onChange={e => setInstalacion({ ...instalacion, notas: e.target.value })} />
            </div>
            <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
              <button className="btn-accent" onClick={guardarInstalacion}>{t('Guardar')}</button>
              <button className="btn-ghost" onClick={() => setInstalacion(null)}>{t('Cancelar')}</button>
              {!nuevaInstalacion && (
                <button className="btn-ghost ap-borrar" onClick={() => {
                  if (!window.confirm(t('¿Quitar la instalación «{nombre}»?', { nombre: instalacion.nombre }))) return;
                  onChangeEf(d => ({ ...d, instalaciones: d.instalaciones.filter(x => x.id !== instalacion.id) }));
                  setInstalacion(null);
                }}><Trash2 size={14} />{t('Quitar')}</button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
