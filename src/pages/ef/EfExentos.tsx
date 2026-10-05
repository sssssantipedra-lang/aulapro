/**
 * Educación Física, «Exentos y lesiones»: quién no puede hacer la clase o
 * parte de ella, hasta cuándo y qué hace mientras tanto (decisión del dueño,
 * 5-10-2026). Se ve en la pista, en el Inicio y al hacer equipos. El motivo es
 * un dato de salud: se queda en el equipo y no se envía nunca a la IA; a la IA
 * solo le llega la limitación, sin nombre, para proponer cómo incluirle
 * (DUA-A). Ver `docs/EF.md`.
 */
import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Bandage, FileCheck2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useI18n } from '../../i18n';
import { isoDate, fromIsoDate } from '../../lib/utils';
import { exentosDelDia, LIMITACIONES, nuevoIdEF } from '../../lib/ef';
import type { Class, Section, Student } from '../../types';
import type { EfData, ExentoEF } from '../../types/ef';

interface Props {
  classes: Class[];
  students: Student[];
  ef: EfData;
  onChangeEf: (f: (d: EfData) => EfData) => void;
  onNav: (s: Section) => void;
}

export function EfExentos({ classes, students, ef, onChangeEf, onNav }: Props) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const hoy = isoDate();
  const [editando, setEditando] = useState<ExentoEF | null>(null);
  const [verPasados, setVerPasados] = useState(false);
  const esNuevo = !!editando && !ef.exentos.some(e => e.id === editando.id);
  const alumnado = useMemo(() => [...students].sort((a, b) => a.name.localeCompare(b.name)), [students]);
  const alumno = (id: string) => students.find(s => s.id === id);
  const clase = (id: string) => classes.find(c => c.id === alumno(id)?.class_id)?.name ?? '';
  const dia = (f: string) => fromIsoDate(f).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  const activos = exentosDelDia(ef, hoy);
  const futuros = ef.exentos.filter(e => e.desde > hoy);
  const pasados = ef.exentos.filter(e => e.hasta && e.hasta < hoy);

  function nuevo() {
    setEditando({ id: nuevoIdEF('exe'), alumnoId: alumnado[0]?.id ?? '', limitaciones: [], otra: '', desde: hoy, tarea: '', justificante: false, motivo: '' });
  }

  function guardar() {
    if (!editando) return;
    if (!editando.alumnoId) { toast(t('Elige el alumno o la alumna.')); return; }
    if (!editando.limitaciones.length && !editando.otra.trim()) { toast(t('Marca qué no puede hacer, o escríbelo.')); return; }
    if (editando.hasta && editando.hasta < editando.desde) { toast(t('La fecha de fin es anterior a la de inicio.')); return; }
    const e = editando;
    onChangeEf(d => ({ ...d, exentos: [...d.exentos.filter(x => x.id !== e.id), e] }));
    setEditando(null);
    toast(t('✅ Guardado'));
  }

  function borrar(e: ExentoEF) {
    if (!window.confirm(t('¿Quitar a {nombre} de exentos y lesiones?', { nombre: alumno(e.alumnoId)?.name ?? '' }))) return;
    onChangeEf(d => ({ ...d, exentos: d.exentos.filter(x => x.id !== e.id) }));
    setEditando(null);
  }

  const fila = (e: ExentoEF) => {
    const s = alumno(e.alumnoId);
    if (!s) return null;
    const lims = e.limitaciones.map(l => t(LIMITACIONES.find(x => x.id === l)!.label)).concat(e.otra.trim() ? [e.otra.trim()] : []);
    return (
      <li key={e.id}>
        <span className="home-alert-dot warn" style={{ marginTop: 6 }} />
        <span className="ap-lista-txt">
          <strong>{s.name}</strong>
          <span className="ap-meta">
            <span>{clase(e.alumnoId)}</span>
            <span>{e.hasta ? t('Del {a} al {b}', { a: dia(e.desde), b: dia(e.hasta) }) : t('Desde el {a}', { a: dia(e.desde) })}</span>
            {e.justificante && <span className="sda-chip"><FileCheck2 size={11} style={{ verticalAlign: -1 }} /> {t('Con justificante')}</span>}
          </span>
          <span className="ap-meta">{lims.join(' · ')}</span>
          {e.tarea.trim() && <span className="ap-sub">{t('Mientras tanto')}: {e.tarea}</span>}
        </span>
        <button className="ico-btn" onClick={() => setEditando(e)} aria-label={t('Editar «{name}»', { name: s.name })} title={t('Editar')}><Pencil size={15} /></button>
      </li>
    );
  };

  if (students.length === 0) {
    return (
      <section className="sec active ap-page">
        <div className="pg-hd"><div><h1 className="pg-title">{t('Exentos y lesiones')}</h1></div></div>
        <div className="card">
          <p className="ap-vacio">{t('Para anotar exentos y lesiones, crea primero tus clases con su alumnado.')}</p>
          <button className="btn-accent" style={{ marginTop: 12 }} onClick={() => onNav('classes')}>{t('Ir a Mis Clases')}</button>
        </div>
      </section>
    );
  }

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Exentos y lesiones')}</h1>
          <p className="pg-sub">{t('Quién no puede hacer la clase o parte de ella, hasta cuándo y qué hace mientras tanto. Sale en la pista, en el Inicio y al hacer equipos.')}</p>
        </div>
        <button className="btn-accent" onClick={nuevo}><Plus size={15} />{t('Añadir')}</button>
      </div>

      <div className="card">
        <div className="home-card-ttl" style={{ marginBottom: 10 }}><Bandage size={15} />{t('Ahora')}</div>
        {activos.length === 0
          ? <p className="ap-vacio">{t('Hoy no hay nadie exento ni lesionado.')}</p>
          : <ul className="ap-lista">{activos.map(fila)}</ul>}
      </div>
      {futuros.length > 0 && (
        <div className="card">
          <div className="home-card-ttl" style={{ marginBottom: 10 }}>{t('Más adelante')}</div>
          <ul className="ap-lista">{futuros.map(fila)}</ul>
        </div>
      )}
      {pasados.length > 0 && (
        <button type="button" className="home-link" style={{ marginTop: 14 }} onClick={() => setVerPasados(v => !v)}>
          {verPasados ? t('Ocultar los que ya terminaron') : t('Ver los que ya terminaron ({n})', { n: pasados.length })}
        </button>
      )}
      {verPasados && pasados.length > 0 && <div className="card"><ul className="ap-lista">{pasados.map(fila)}</ul></div>}

      <Modal open={!!editando} onClose={() => setEditando(null)} wide title={esNuevo ? t('Exento o lesión') : alumno(editando?.alumnoId ?? '')?.name}>
        {editando && (
          <div className="ap-form">
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-x-alumno">{t('Alumno o alumna')}</label>
              <select id="ef-x-alumno" className="finput" value={editando.alumnoId} onChange={e => setEditando({ ...editando, alumnoId: e.target.value })}>
                {classes.map(c => (
                  <optgroup key={c.id} label={c.name}>
                    {alumnado.filter(s => s.class_id === c.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
              <legend className="flabel">{t('Qué no puede hacer')}</legend>
              <div className="chip-row">
                {LIMITACIONES.map(l => {
                  const on = editando.limitaciones.includes(l.id);
                  return (
                    <button key={l.id} type="button" className={`chip sm accent${on ? ' on' : ''}`} aria-pressed={on}
                      onClick={() => setEditando({ ...editando, limitaciones: on ? editando.limitaciones.filter(x => x !== l.id) : [...editando.limitaciones, l.id] })}>
                      {t(l.label)}
                    </button>
                  );
                })}
              </div>
              <input className="finput" style={{ marginTop: 8 }} value={editando.otra} placeholder={t('Otra, escrita por ti')} aria-label={t('Otra limitación')}
                onChange={e => setEditando({ ...editando, otra: e.target.value })} />
            </fieldset>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-x-desde">{t('Desde')}</label>
              <input id="ef-x-desde" type="date" className="finput" value={editando.desde} onChange={e => setEditando({ ...editando, desde: e.target.value })} />
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-x-hasta">{t('Hasta (si se sabe)')}</label>
              <input id="ef-x-hasta" type="date" className="finput" value={editando.hasta ?? ''}
                onChange={e => setEditando(e.target.value ? { ...editando, hasta: e.target.value } : (({ hasta: _h, ...r }) => { void _h; return r; })(editando))} />
            </div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-x-tarea">{t('Qué hace mientras tanto')}</label>
              <textarea id="ef-x-tarea" className="finput" rows={2} value={editando.tarea} placeholder={t('Ej: arbitrar, cronometrar, anotar los resultados de su equipo')}
                onChange={e => setEditando({ ...editando, tarea: e.target.value })} />
            </div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-x-motivo">{t('Motivo (solo para ti)')}</label>
              <input id="ef-x-motivo" className="finput" value={editando.motivo} placeholder={t('Ej: esguince de tobillo')}
                onChange={e => setEditando({ ...editando, motivo: e.target.value })} />
              <p className="ap-aviso">{t('Es un dato de salud: se queda en este equipo y nunca se envía a la IA. A la IA solo le llega lo que no puede hacer, sin su nombre.')}</p>
            </div>
            <label className="td-chk" style={{ gridColumn: '1 / -1' }}>
              <input type="checkbox" checked={editando.justificante} onChange={e => setEditando({ ...editando, justificante: e.target.checked })} />
              {t('Ha traído justificante')}
            </label>
            <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
              <button className="btn-accent" onClick={guardar}>{t('Guardar')}</button>
              <button className="btn-ghost" onClick={() => setEditando(null)}>{t('Cancelar')}</button>
              {!esNuevo && <button className="btn-ghost ap-borrar" onClick={() => borrar(editando)}><Trash2 size={14} />{t('Quitar')}</button>}
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
