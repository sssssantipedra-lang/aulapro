/**
 * PT y AL, pestaña «Coordinaciones» de la página de un alumno: lo que el
 * especialista habla con la tutoría, la familia, orientación o el equipo
 * sobre él, y lo que se acuerda (decisión del dueño, 5-10-2026). Las del
 * trimestre llegan a la IA al preparar los informes, y se copian de una vez
 * para el PAP. Ver `docs/PTAL.md`.
 */
import { useState } from 'react';
import { Plus, Pencil, Trash2, Copy, Handshake } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useI18n } from '../../i18n';
import { isoDate, fromIsoDate } from '../../lib/utils';
import { CON_QUIEN, coordinacionesDe, nuevoIdApoyo } from '../../lib/apoyo';
import type { AlumnoApoyo, ApoyoData, ConQuien, CoordinacionApoyo } from '../../types/apoyo';

interface Props {
  alumno: AlumnoApoyo;
  data: ApoyoData;
  onChange: (f: (d: ApoyoData) => ApoyoData) => void;
}

const CONES: ConQuien[] = ['tutoria', 'familia', 'orientacion', 'equipo', 'otros'];

/** La fecha larga, con mayúscula: «Lunes, 5 de octubre de 2026». */
function fechaCoordinacion(f: string, locale: string, sinFecha: string): string {
  if (!f) return sinFecha;
  const s = fromIsoDate(f).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
}

export function CoordinacionesApoyo({ alumno, data, onChange }: Props) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [editando, setEditando] = useState<CoordinacionApoyo | null>(null);
  const esNueva = !!editando && !data.coordinaciones.some(c => c.id === editando.id);

  const lista = [...coordinacionesDe(data, alumno.id)].reverse();
  const fecha = (f: string) => fechaCoordinacion(f, locale, t('Sin fecha'));

  function nueva() {
    setEditando({
      id: nuevoIdApoyo('coo'), alumnoId: alumno.id, fecha: isoDate(), con: 'tutoria',
      asistentes: '', temas: '', acuerdos: '',
    });
  }

  function guardar() {
    if (!editando) return;
    if (!editando.temas.trim() && !editando.acuerdos.trim()) { toast(t('Escribe de qué se habló o qué se acordó.')); return; }
    const c = editando;
    onChange(d => ({ ...d, coordinaciones: [...d.coordinaciones.filter(x => x.id !== c.id), c] }));
    setEditando(null);
    toast(t('✅ Guardado'));
  }

  function borrar(c: CoordinacionApoyo) {
    if (!window.confirm(t('¿Eliminar esta coordinación?'))) return;
    onChange(d => ({ ...d, coordinaciones: d.coordinaciones.filter(x => x.id !== c.id) }));
    setEditando(null);
  }

  /** Todas las del alumno, para pegarlas en el PAP o en un acta. */
  async function copiar() {
    const texto = coordinacionesDe(data, alumno.id).map(c => [
      `${fecha(c.fecha)} · ${t(CON_QUIEN[c.con])}${c.asistentes.trim() ? ` (${c.asistentes.trim()})` : ''}`,
      c.temas.trim(),
      c.acuerdos.trim() ? `${t('Acuerdos')}: ${c.acuerdos.trim()}` : '',
    ].filter(Boolean).join('\n')).join('\n\n');
    try {
      await navigator.clipboard.writeText(texto);
      toast(t('✅ Copiado. Pégalo en el PAP o donde lo necesites.'));
    } catch {
      toast(t('No se ha podido copiar.'));
    }
  }

  return (
    <div className="al-panel">
      <div className="al-barra">
        <p className="ap-sub" style={{ margin: 0 }}>{t('Lo que hablas con la tutoría, la familia u orientación, y lo que se acuerda. Las del trimestre salen en sus informes.')}</p>
        <div className="al-barra-acc">
          {lista.length > 0 && <button type="button" className="btn-ghost" onClick={copiar}><Copy size={14} />{t('Copiar todas para el PAP')}</button>}
          <button className="btn-accent" onClick={nueva}><Plus size={15} />{t('Nueva coordinación')}</button>
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="card"><p className="ap-vacio">{t('Todavía no hay coordinaciones de este alumno.')}</p></div>
      ) : lista.map(c => (
        <article className="card ap-coord" key={c.id} aria-label={fecha(c.fecha)}>
          <div className="ap-prog-hd">
            <div style={{ minWidth: 0 }}>
              <div className="ap-prog-ttl"><Handshake size={15} color="var(--accent-d)" aria-hidden="true" />{fecha(c.fecha)}</div>
              <div className="ap-meta" style={{ marginTop: 6 }}>
                <span className="sda-chip">{t(CON_QUIEN[c.con])}</span>
                {c.asistentes.trim() && <span>{c.asistentes}</span>}
              </div>
            </div>
            <div className="ap-prog-acc">
              <button className="ico-btn" onClick={() => setEditando(c)} aria-label={t('Editar')} title={t('Editar')}><Pencil size={15} /></button>
              <button className="ico-btn" onClick={() => borrar(c)} aria-label={t('Eliminar')} title={t('Eliminar')}><Trash2 size={15} /></button>
            </div>
          </div>
          {c.temas.trim() && <p className="ap-coord-txt">{c.temas}</p>}
          {c.acuerdos.trim() && (
            <div className="ap-coord-acuerdos">
              <div className="ap-reg-sec">{t('Acuerdos')}</div>
              <p className="ap-coord-txt">{c.acuerdos}</p>
            </div>
          )}
        </article>
      ))}

      <Modal open={!!editando} onClose={() => setEditando(null)} wide title={esNueva ? t('Nueva coordinación') : t('Coordinación')}>
        {editando && (
          <div className="ap-form">
            <div className="fgroup">
              <label className="flabel" htmlFor="ap-c-fecha">{t('Fecha')}</label>
              <input id="ap-c-fecha" type="date" className="finput" value={editando.fecha} onChange={e => setEditando({ ...editando, fecha: e.target.value })} />
            </div>
            <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
              <legend className="flabel">{t('Con quién')}</legend>
              <div className="chip-row">
                {CONES.map(x => (
                  <button key={x} type="button" className={`chip sm accent${editando.con === x ? ' on' : ''}`} aria-pressed={editando.con === x}
                    onClick={() => setEditando({ ...editando, con: x })}>{t(CON_QUIEN[x])}</button>
                ))}
              </div>
            </fieldset>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ap-c-asis">{t('Quiénes estuvieron')}</label>
              <input id="ap-c-asis" className="finput" value={editando.asistentes} placeholder={t('Ej: la tutora y la orientadora')}
                onChange={e => setEditando({ ...editando, asistentes: e.target.value })} />
            </div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ap-c-temas">{t('De qué se habló')}</label>
              <textarea id="ap-c-temas" className="finput" rows={3} value={editando.temas}
                onChange={e => setEditando({ ...editando, temas: e.target.value })} />
            </div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ap-c-acuerdos">{t('Acuerdos')}</label>
              <textarea id="ap-c-acuerdos" className="finput" rows={3} value={editando.acuerdos}
                placeholder={t('Ej: en clase, las mismas fichas con letra más grande')}
                onChange={e => setEditando({ ...editando, acuerdos: e.target.value })} />
            </div>
            <p className="ap-aviso" style={{ gridColumn: '1 / -1' }}>
              {t('Al preparar sus informes con IA, la IA recibe las coordinaciones del trimestre con el nombre cambiado por un código.')}
            </p>
            <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
              <button className="btn-accent" onClick={guardar}>{t('Guardar')}</button>
              <button className="btn-ghost" onClick={() => setEditando(null)}>{t('Cancelar')}</button>
              {!esNueva && <button className="btn-ghost ap-borrar" onClick={() => borrar(editando)}><Trash2 size={14} />{t('Eliminar')}</button>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
