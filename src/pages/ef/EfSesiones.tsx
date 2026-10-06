/**
 * Educación Física, «Sesiones» (decisión del dueño, 5-10-2026): calentamiento,
 * parte principal y vuelta a la calma, con medidas DUA-A para quien ese día
 * tiene una limitación y un plan B si llueve o la instalación está ocupada. La
 * IA las prepara con el currículo de la clase, el material, las instalaciones y
 * el banco de actividades; de los exentos solo recibe lo que no pueden hacer,
 * sin nombre ni motivo. Se revisan, se guardan y se imprimen. Ver `docs/EF.md`.
 */
import { useMemo, useState } from 'react';
import { Plus, Sparkles, Trash2, FileDown, CalendarDays, MapPin, Bandage } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { CriteriosOficialesPicker } from '../../components/curriculum/CriteriosOficialesPicker';
import { useI18n } from '../../i18n';
import { useNombreCurso } from '../../hooks/useNombreCurso';
import { useMateriasOficiales } from '../../hooks/useNotasPorCompetencias';
import { isoDate, fromIsoDate } from '../../lib/utils';
import { MODALIDADES_EF, nuevoIdEF } from '../../lib/ef';
import { bancoEF } from '../../lib/bancoEF';
import { describirCriterio } from '../../lib/curriculum/criteriosParaIA';
import { esAsignaturaEF } from '../../services/classMarks';
import { hasApiKey } from '../../services/gemini';
import { limitacionesParaIA, prepararSesion } from '../../services/efIA';
import { guardarSesionPdf } from '../../services/exportSesionEF';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { Class, ScheduleBlock, Student } from '../../types';
import type { EfData, ModalidadEF, SesionEF } from '../../types/ef';

interface Props {
  classes: Class[];
  students: Student[];
  scheduleBlocks: ScheduleBlock[];
  ef: EfData;
  onChangeEf: (f: (d: EfData) => EfData) => void;
  comunidad?: ComunidadId;
}

const PARTES: readonly { id: keyof Pick<SesionEF, 'objetivo' | 'calentamiento' | 'principal' | 'calma' | 'material' | 'inclusion' | 'planB'>; label: string; filas: number }[] = [
  { id: 'objetivo', label: 'Objetivo', filas: 2 },
  { id: 'calentamiento', label: 'Calentamiento', filas: 4 },
  { id: 'principal', label: 'Parte principal', filas: 7 },
  { id: 'calma', label: 'Vuelta a la calma', filas: 3 },
  { id: 'material', label: 'Material', filas: 2 },
  { id: 'inclusion', label: 'Para que participe todo el grupo (DUA-A)', filas: 3 },
  { id: 'planB', label: 'Plan B', filas: 3 },
];

/** Los minutos de la clase en el horario, si tiene un tramo ese día de la semana. */
function minutosDeClase(blocks: ScheduleBlock[], claseId: string, fecha: string): number | null {
  const d = fromIsoDate(fecha).getDay() || 7;
  const b = blocks.find(x => x.class_id === claseId && x.day === d) ?? blocks.find(x => x.class_id === claseId);
  if (!b) return null;
  const [h1, m1] = b.time_start.split(':').map(Number);
  const [h2, m2] = b.time_end.split(':').map(Number);
  const min = h2 * 60 + m2 - (h1 * 60 + m1);
  return min > 0 ? min : null;
}

export function EfSesiones({ classes, students, scheduleBlocks, ef, onChangeEf, comunidad }: Props) {
  const { t, lang, locale } = useI18n();
  const { toast } = useToast();
  const nombreCurso = useNombreCurso();
  const hoy = isoDate();
  const [editando, setEditando] = useState<SesionEF | null>(null);
  const [ia, setIa] = useState<{ claseId: string; fecha: string; instalacionId: string; tema: string; minutos: number; banco: boolean; modalidad: ModalidadEF | '' } | null>(null);
  const [pensando, setPensando] = useState(false);
  const [verAnteriores, setVerAnteriores] = useState(false);
  const esNueva = !!editando && !ef.sesiones.some(s => s.id === editando.id);

  // El currículo de la clase que toca: la de la IA o la de la sesión abierta
  const claseIa = classes.find(c => c.id === ia?.claseId) ?? null;
  const claseEd = classes.find(c => c.id === editando?.claseId) ?? null;
  const { materias: materiasIa } = useMateriasOficiales(claseIa, comunidad);
  const { materias: materiasEd } = useMateriasOficiales(claseEd, comunidad);
  const deEF = (m: typeof materiasIa) => {
    const soloEF = m.filter(x => esAsignaturaEF(x.asignatura) || esAsignaturaEF(x.entry.nombre));
    return soloEF.length ? soloEF : m;
  };

  const ordenadas = useMemo(() => [...ef.sesiones].sort((a, b) => (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999')), [ef.sesiones]);
  const proximas = ordenadas.filter(s => s.fecha && s.fecha >= hoy);
  const sinFecha = ordenadas.filter(s => !s.fecha);
  const anteriores = ordenadas.filter(s => s.fecha && s.fecha < hoy).reverse();
  const nombreClase = (id?: string) => classes.find(c => c.id === id)?.name ?? '';
  const nombreInst = (id?: string) => ef.instalaciones.find(i => i.id === id)?.nombre ?? '';
  const dia = (f: string) => fromIsoDate(f).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });

  const limitacionesDe = (claseId: string, fecha: string) =>
    limitacionesParaIA(ef, students.filter(s => s.class_id === claseId).map(s => s.id), fecha);

  const vacia = (): SesionEF => ({
    id: nuevoIdEF('ses'), titulo: '', claseId: classes[0]?.id, fecha: hoy, instalacionId: ef.instalaciones[0]?.id,
    objetivo: '', calentamiento: '', principal: '', calma: '', material: '', inclusion: '', planB: '',
  });

  function abrirIa() {
    const claseId = classes[0]?.id ?? '';
    setIa({ claseId, fecha: hoy, instalacionId: ef.instalaciones[0]?.id ?? '', tema: '', minutos: minutosDeClase(scheduleBlocks, claseId, hoy) ?? 55, banco: true, modalidad: '' });
  }

  async function preparar() {
    if (!ia) return;
    if (!ia.tema.trim()) { toast(t('Escribe qué quieres trabajar en la sesión.')); return; }
    const instalacion = ef.instalaciones.find(i => i.id === ia.instalacionId);
    setPensando(true);
    const r = await prepararSesion({
      curso: claseIa?.etapa && claseIa.curso ? nombreCurso({ etapa: claseIa.etapa, curso: claseIa.curso }) : undefined,
      etapa: claseIa?.etapa,
      tema: ia.tema,
      modalidad: ia.modalidad || undefined,
      minutos: ia.minutos,
      instalacion,
      cubiertas: ef.instalaciones.filter(i => i.cubierta && i.id !== instalacion?.id),
      limitaciones: claseIa ? limitacionesDe(claseIa.id, ia.fecha) : [],
      materias: deEF(materiasIa),
      // Con modalidad, del banco solo las suyas: así la sesión aprovecha juegos de la misma lógica
      banco: ia.banco ? [...ef.actividades, ...bancoEF(lang)].filter(a => !ia.modalidad || a.modalidad === ia.modalidad) : [],
    }, ef, comunidad, lang, { onError: m => toast(t(m)) });
    setPensando(false);
    if (!r) return;
    setIa(null);
    setEditando({
      id: nuevoIdEF('ses'), ...r, ia: true, ...(ia.modalidad ? { modalidad: ia.modalidad } : {}),
      ...(ia.claseId ? { claseId: ia.claseId } : {}), fecha: ia.fecha, ...(ia.instalacionId ? { instalacionId: ia.instalacionId } : {}),
    });
  }

  function guardar() {
    if (!editando) return;
    const s = { ...editando, titulo: editando.titulo.trim() };
    if (!s.titulo) { toast(t('Ponle un título a la sesión.')); return; }
    onChangeEf(d => ({ ...d, sesiones: d.sesiones.some(x => x.id === s.id) ? d.sesiones.map(x => (x.id === s.id ? s : x)) : [...d.sesiones, s] }));
    setEditando(null);
    toast(t('✅ Guardado'));
  }

  function borrar(s: SesionEF) {
    if (!window.confirm(t('¿Borrar la sesión «{nombre}»?', { nombre: s.titulo }))) return;
    onChangeEf(d => ({ ...d, sesiones: d.sesiones.filter(x => x.id !== s.id) }));
    setEditando(null);
  }

  async function pdf(s: SesionEF) {
    const criterios = (s.criterios ?? []).map(ref => describirCriterio(materiasEd, ref)).filter(Boolean)
      .map(c => `${c!.materia} ${c!.ref.codigo}: ${c!.texto}`);
    const res = await guardarSesionPdf(s, {
      clase: nombreClase(s.claseId) || undefined, fecha: s.fecha ? dia(s.fecha) : undefined,
      instalacion: nombreInst(s.instalacionId) || undefined, criterios,
    }, lang);
    if (res.error === 'not-desktop') toast(t('Guardar en PDF solo está disponible en la aplicación de escritorio.'));
    else if (res.error) toast(t('No se ha podido guardar el PDF.'));
  }

  const fila = (s: SesionEF) => {
    const lims = s.claseId && s.fecha && s.fecha >= hoy ? limitacionesDe(s.claseId, s.fecha).length : 0;
    return (
      <li key={s.id}>
        <button type="button" className="ef-sesion" onClick={() => setEditando(s)}>
          <strong>{s.titulo || t('Sin título')}</strong>
          <span className="ap-meta">
            {s.claseId && <span>{nombreClase(s.claseId)}</span>}
            {s.fecha && <span className="ap-hora"><CalendarDays size={12} aria-hidden="true" />{dia(s.fecha)}</span>}
            {s.instalacionId && <span className="ap-hora"><MapPin size={12} aria-hidden="true" />{nombreInst(s.instalacionId)}</span>}
            {s.modalidad && <span className="sda-chip ef-modalidad">{t(MODALIDADES_EF.find(m => m.id === s.modalidad)!.label)}</span>}
            {s.ia && <span className="sda-chip ef-origen-ia">{t('Con IA')}</span>}
            {lims > 0 && <span className="ef-exento"><Bandage size={11} aria-hidden="true" />{t(lims === 1 ? '{n} con limitación' : '{n} con limitaciones', { n: lims })}</span>}
          </span>
          {s.objetivo.trim() && <span className="ap-sub">{s.objetivo}</span>}
        </button>
      </li>
    );
  };

  const limsIa = ia && claseIa ? limitacionesDe(claseIa.id, ia.fecha) : [];

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Sesiones')}</h1>
          <p className="pg-sub">{t('Calentamiento, parte principal y vuelta a la calma, con medidas para quien tiene una limitación (DUA-A) y un plan B. Prepáralas con la IA o escríbelas tú.')}</p>
        </div>
        <div className="ap-prog-acc">
          <button className="btn-ghost" onClick={() => setEditando(vacia())}><Plus size={15} />{t('Nueva sesión')}</button>
          <button className="btn-accent" onClick={abrirIa} disabled={!hasApiKey() || classes.length === 0}
            title={hasApiKey() ? undefined : t('Configura tu clave API gratuita de Google en Configuración para usar la IA.')}>
            <Sparkles size={15} />{t('Preparar con IA')}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="home-card-ttl" style={{ marginBottom: 10 }}>{t('Próximas')}</div>
        {proximas.length === 0
          ? <p className="ap-vacio">{t('No tienes sesiones previstas. Prepara una con la IA o escríbela tú.')}</p>
          : <ul className="ap-lista ef-sesiones">{proximas.map(fila)}</ul>}
      </div>
      {sinFecha.length > 0 && (
        <div className="card">
          <div className="home-card-ttl" style={{ marginBottom: 10 }}>{t('Sin fecha')}</div>
          <ul className="ap-lista ef-sesiones">{sinFecha.map(fila)}</ul>
        </div>
      )}
      {anteriores.length > 0 && (
        <button type="button" className="home-link" style={{ marginTop: 14 }} onClick={() => setVerAnteriores(v => !v)}>
          {verAnteriores ? t('Ocultar las anteriores') : t('Ver las anteriores ({n})', { n: anteriores.length })}
        </button>
      )}
      {verAnteriores && anteriores.length > 0 && <div className="card"><ul className="ap-lista ef-sesiones">{anteriores.map(fila)}</ul></div>}

      <Modal open={!!ia} onClose={() => setIa(null)} wide title={t('Preparar una sesión con IA')}>
        {ia && (
          <div className="ap-form">
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-si-clase">{t('Clase')}</label>
              <select id="ef-si-clase" className="finput" value={ia.claseId}
                onChange={e => setIa({ ...ia, claseId: e.target.value, minutos: minutosDeClase(scheduleBlocks, e.target.value, ia.fecha) ?? ia.minutos })}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-si-fecha">{t('Día')}</label>
              <input id="ef-si-fecha" type="date" className="finput" value={ia.fecha}
                onChange={e => e.target.value && setIa({ ...ia, fecha: e.target.value, minutos: minutosDeClase(scheduleBlocks, ia.claseId, e.target.value) ?? ia.minutos })} />
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-si-inst">{t('Instalación')}</label>
              <select id="ef-si-inst" className="finput" value={ia.instalacionId} onChange={e => setIa({ ...ia, instalacionId: e.target.value })}>
                <option value="">{t('Sin indicar')}</option>
                {ef.instalaciones.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select>
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-si-min">{t('Minutos')}</label>
              <input id="ef-si-min" type="number" min={20} max={120} className="finput" value={ia.minutos}
                onChange={e => setIa({ ...ia, minutos: Math.max(20, Math.min(120, Math.round(Number(e.target.value) || 55))) })} />
            </div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-si-modalidad">{t('Modalidad del juego o deporte')}</label>
              <select id="ef-si-modalidad" className="finput" value={ia.modalidad} onChange={e => setIa({ ...ia, modalidad: e.target.value as ModalidadEF | '' })}>
                <option value="">{t('Sin modalidad')}</option>
                {MODALIDADES_EF.map(m => <option key={m.id} value={m.id}>{t(m.label)}</option>)}
              </select>
            </div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-si-tema">{t('Qué quieres trabajar')}</label>
              <textarea id="ef-si-tema" className="finput" rows={2} value={ia.tema}
                placeholder={t('Ej: iniciación al voleibol, el toque de dedos; o la tercera sesión de la unidad de orientación')}
                onChange={e => setIa({ ...ia, tema: e.target.value })} />
            </div>
            <label className="td-chk" style={{ gridColumn: '1 / -1' }}>
              <input type="checkbox" checked={ia.banco} onChange={e => setIa({ ...ia, banco: e.target.checked })} />
              {t('Que aproveche actividades de mi banco si encajan')}
            </label>
            <p className="ap-aviso" style={{ gridColumn: '1 / -1' }}>
              {limsIa.length === 0 ? t('Ese día no hay nadie exento ni lesionado en esta clase.')
                : limsIa.length === 1 ? t('Ese día hay un alumno o alumna con alguna limitación en esta clase: la sesión llevará medidas para que participe.')
                : t('Ese día hay {n} alumnos con alguna limitación en esta clase: la sesión llevará medidas para que participen.', { n: limsIa.length })}
              {' '}{t('A la IA solo le llega lo que no puede hacer cada alumno, sin nombres ni motivos.')}
            </p>
            <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
              <button className="btn-accent" onClick={preparar} disabled={pensando}>
                {pensando ? <span className="spin" /> : <Sparkles size={15} />}{pensando ? t('Preparando…') : t('Preparar la sesión')}
              </button>
              <button className="btn-ghost" onClick={() => setIa(null)}>{t('Cancelar')}</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!editando} onClose={() => setEditando(null)} wide title={esNueva ? (editando?.ia ? t('Sesión preparada con IA') : t('Nueva sesión')) : editando?.titulo}>
        {editando && (
          <div className="ap-form">
            {esNueva && editando.ia && (
              <p className="ap-aviso" style={{ gridColumn: '1 / -1', marginBottom: 10 }}>{t('Revísala y cambia lo que quieras antes de guardarla.')}</p>
            )}
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-s-titulo">{t('Título')}</label>
              <input id="ef-s-titulo" className="finput" value={editando.titulo} onChange={e => setEditando({ ...editando, titulo: e.target.value })} />
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-s-clase">{t('Clase')}</label>
              <select id="ef-s-clase" className="finput" value={editando.claseId ?? ''}
                onChange={e => setEditando({ ...editando, claseId: e.target.value || undefined, criterios: [] })}>
                <option value="">{t('Sin clase concreta')}</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-s-fecha">{t('Día')}</label>
              <input id="ef-s-fecha" type="date" className="finput" value={editando.fecha ?? ''}
                onChange={e => setEditando({ ...editando, fecha: e.target.value || undefined })} />
            </div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-s-inst">{t('Instalación')}</label>
              <select id="ef-s-inst" className="finput" value={editando.instalacionId ?? ''}
                onChange={e => setEditando({ ...editando, instalacionId: e.target.value || undefined })}>
                <option value="">{t('Sin indicar')}</option>
                {ef.instalaciones.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select>
            </div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-s-modalidad">{t('Modalidad del juego o deporte')}</label>
              <select id="ef-s-modalidad" className="finput" value={editando.modalidad ?? ''} onChange={e => setEditando(e.target.value ? { ...editando, modalidad: e.target.value as ModalidadEF } : (({ modalidad: _m, ...r }) => { void _m; return r; })(editando))}>
                <option value="">{t('Sin modalidad')}</option>
                {MODALIDADES_EF.map(m => <option key={m.id} value={m.id}>{t(m.label)}</option>)}
              </select>
            </div>
            {PARTES.map(p => (
              <div key={p.id} className="fgroup" style={{ gridColumn: '1 / -1' }}>
                <label className="flabel" htmlFor={`ef-s-${p.id}`}>{t(p.label)}</label>
                <textarea id={`ef-s-${p.id}`} className="finput" rows={p.filas} value={editando[p.id]}
                  onChange={e => setEditando({ ...editando, [p.id]: e.target.value })} />
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1' }}>
              <CriteriosOficialesPicker idPrefix="ef-s-co" cls={claseEd} comunidad={comunidad}
                value={editando.criterios ?? []} onChange={v => setEditando({ ...editando, criterios: v })} />
            </div>
            <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
              <button className="btn-accent" onClick={guardar}>{t('Guardar')}</button>
              <button className="btn-ghost" onClick={() => pdf(editando)}><FileDown size={14} />{t('PDF')}</button>
              <button className="btn-ghost" onClick={() => setEditando(null)}>{t('Cancelar')}</button>
              {!esNueva && <button className="btn-ghost ap-borrar" onClick={() => borrar(editando)}><Trash2 size={14} />{t('Borrar')}</button>}
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
