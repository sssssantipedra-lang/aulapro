/**
 * Educación Física, «Actividades»: el banco de partida de AulaPro, las del
 * docente y las que guarda de la IA (decisión del dueño, 5-10-2026). Tipos:
 * juegos, deportes, días de lluvia, medio natural, calentamiento y vuelta a la
 * calma. Cada actividad dice cómo participa quien tiene una limitación
 * (DUA-A). A la IA solo le llega lo que no puede hacer cada alumno, sin nombre
 * ni motivo. Ver `docs/EF.md`.
 */
import { useMemo, useState } from 'react';
import { Plus, Sparkles, Pencil, Trash2, Copy, Search, Save } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useI18n } from '../../i18n';
import { useNombreCurso } from '../../hooks/useNombreCurso';
import { isoDate } from '../../lib/utils';
import { bancoEF } from '../../lib/bancoEF';
import { nuevoIdEF, TIPOS_ACTIVIDAD } from '../../lib/ef';
import { hasApiKey } from '../../services/gemini';
import { limitacionesParaIA, proponerActividades } from '../../services/efIA';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { Class, Student } from '../../types';
import type { ActividadEF, EfData, TipoActividadEF } from '../../types/ef';

interface Props {
  classes: Class[];
  students: Student[];
  ef: EfData;
  onChangeEf: (f: (d: EfData) => EfData) => void;
  comunidad?: ComunidadId;
}

type Origen = 'todas' | ActividadEF['origen'];

const CAMPOS: readonly { id: keyof Pick<ActividadEF, 'descripcion' | 'organizacion' | 'material' | 'variantes' | 'inclusion'>; label: string }[] = [
  { id: 'descripcion', label: 'En qué consiste' },
  { id: 'organizacion', label: 'Organización' },
  { id: 'material', label: 'Material' },
  { id: 'variantes', label: 'Variantes' },
  { id: 'inclusion', label: 'Para que participe todo el grupo (DUA-A)' },
];

const ORIGEN: Record<ActividadEF['origen'], string> = { banco: 'Del banco', propia: 'Tuya', ia: 'De la IA' };

export function EfActividades({ classes, students, ef, onChangeEf, comunidad }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const nombreCurso = useNombreCurso();
  const [tipo, setTipo] = useState<TipoActividadEF | 'todas'>('todas');
  const [origen, setOrigen] = useState<Origen>('todas');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<ActividadEF | null>(null);
  const [ia, setIa] = useState<{ tipo: TipoActividadEF; claseId: string; tema: string; inventario: boolean; limitaciones: boolean } | null>(null);
  const [propuestas, setPropuestas] = useState<ActividadEF[]>([]);
  const [pensando, setPensando] = useState(false);
  const esNueva = !!editando && !ef.actividades.some(a => a.id === editando.id);

  const todas = useMemo(() => [...ef.actividades, ...bancoEF(lang)], [ef.actividades, lang]);
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const visibles = todas.filter(a =>
    (tipo === 'todas' || a.tipo === tipo) && (origen === 'todas' || a.origen === origen) &&
    (!busca.trim() || norm(`${a.titulo} ${a.descripcion} ${a.material}`).includes(norm(busca.trim()))));

  function guardar() {
    if (!editando) return;
    const a = { ...editando, titulo: editando.titulo.trim() };
    if (!a.titulo) { toast(t('Ponle un título a la actividad.')); return; }
    onChangeEf(d => ({ ...d, actividades: d.actividades.some(x => x.id === a.id) ? d.actividades.map(x => (x.id === a.id ? a : x)) : [a, ...d.actividades] }));
    setEditando(null);
    toast(t('✅ Guardado'));
  }

  function borrar(a: ActividadEF) {
    if (!window.confirm(t('¿Borrar la actividad «{nombre}»?', { nombre: a.titulo }))) return;
    onChangeEf(d => ({ ...d, actividades: d.actividades.filter(x => x.id !== a.id) }));
    setEditando(null);
  }

  const vacia = (): ActividadEF => ({
    id: nuevoIdEF('act'), titulo: '', tipo: tipo === 'todas' ? 'juego' : tipo, descripcion: '', organizacion: '',
    material: '', variantes: '', inclusion: '', origen: 'propia',
  });

  /* ── La IA ── */
  const claseIa = classes.find(c => c.id === ia?.claseId);
  const limitacionesHoy = claseIa
    ? limitacionesParaIA(ef, students.filter(s => s.class_id === claseIa.id).map(s => s.id), isoDate()) : [];
  const hayInventario = ef.material.length > 0 || ef.instalaciones.length > 0;

  async function proponer() {
    if (!ia) return;
    setPensando(true);
    const r = await proponerActividades({
      tipo: ia.tipo,
      curso: claseIa?.etapa && claseIa.curso ? nombreCurso({ etapa: claseIa.etapa, curso: claseIa.curso }) : undefined,
      etapa: claseIa?.etapa,
      tema: ia.tema,
      limitaciones: ia.limitaciones ? limitacionesHoy : [],
      conInventario: ia.inventario,
      yaTiene: todas.filter(a => a.tipo === ia.tipo).map(a => a.titulo),
    }, ef, comunidad, lang, { onError: m => toast(t(m)) });
    setPensando(false);
    if (r) setPropuestas(r.map(a => ({ ...a, id: nuevoIdEF('act') })));
  }

  function guardarPropuesta(a: ActividadEF) {
    onChangeEf(d => ({ ...d, actividades: [a, ...d.actividades] }));
    setPropuestas(p => p.filter(x => x.id !== a.id));
    toast(t('Guardada en tus actividades.'));
  }

  const ficha = (a: ActividadEF, acciones: React.ReactNode) => (
    <details key={a.id} className="ef-act">
      <summary>
        <span className="ef-act-ttl">{a.titulo}</span>
        <span className="ef-act-chips">
          <span className="sda-chip">{t(TIPOS_ACTIVIDAD.find(x => x.id === a.tipo)!.label)}</span>
          {a.origen !== 'banco' && <span className={`sda-chip ef-origen-${a.origen}`}>{t(ORIGEN[a.origen])}</span>}
        </span>
      </summary>
      <dl className="ef-act-campos">
        {CAMPOS.filter(c => a[c.id].trim()).map(c => (
          <div key={c.id}><dt>{t(c.label)}</dt><dd>{a[c.id]}</dd></div>
        ))}
      </dl>
      <div className="ef-act-acc">{acciones}</div>
    </details>
  );

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Actividades')}</h1>
          <p className="pg-sub">{t('El banco de partida de AulaPro, las tuyas y las que guardes de la IA. Cada una dice cómo participa quien tiene una limitación, según el DUA-A.')}</p>
        </div>
        <div className="ap-prog-acc">
          <button className="btn-ghost" onClick={() => { setPropuestas([]); setIa({ tipo: tipo === 'todas' ? 'juego' : tipo, claseId: classes[0]?.id ?? '', tema: '', inventario: hayInventario, limitaciones: true }); }}
            disabled={!hasApiKey()} title={hasApiKey() ? undefined : t('Configura tu clave API gratuita de Google en Configuración para usar la IA.')}>
            <Sparkles size={15} />{t('Proponer con IA')}
          </button>
          <button className="btn-accent" onClick={() => setEditando(vacia())}><Plus size={15} />{t('Nueva actividad')}</button>
        </div>
      </div>

      <div className="chip-row ap-alumnos" role="radiogroup" aria-label={t('Tipo de actividad')}>
        <button type="button" role="radio" aria-checked={tipo === 'todas'} className={`chip sm accent${tipo === 'todas' ? ' on' : ''}`} onClick={() => setTipo('todas')}>{t('Todas')}</button>
        {TIPOS_ACTIVIDAD.map(x => (
          <button key={x.id} type="button" role="radio" aria-checked={tipo === x.id} className={`chip sm accent${tipo === x.id ? ' on' : ''}`} onClick={() => setTipo(x.id)}>{t(x.label)}</button>
        ))}
      </div>
      <div className="ef-act-filtros">
        <label className="ef-busca">
          <Search size={15} aria-hidden="true" />
          <input className="finput" type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder={t('Buscar')} aria-label={t('Buscar actividades')} />
        </label>
        <select className="finput" value={origen} onChange={e => setOrigen(e.target.value as Origen)} aria-label={t('De dónde salen')}>
          <option value="todas">{t('Todas')}</option>
          <option value="banco">{t('Del banco')}</option>
          <option value="propia">{t('Tuyas')}</option>
          <option value="ia">{t('De la IA')}</option>
        </select>
      </div>

      <div className="card">
        {visibles.length === 0
          ? <p className="ap-vacio">{t('No hay actividades con estos filtros.')}</p>
          : (
            <div className="ef-acts">
              {visibles.map(a => ficha(a, a.origen === 'banco'
                ? <button className="btn-ghost" onClick={() => setEditando({ ...a, id: nuevoIdEF('act'), origen: 'propia' })}><Copy size={14} />{t('Copiar y adaptar')}</button>
                : <>
                    <button className="btn-ghost" onClick={() => setEditando(a)}><Pencil size={14} />{t('Editar')}</button>
                    <button className="btn-ghost ap-borrar" onClick={() => borrar(a)}><Trash2 size={14} />{t('Borrar')}</button>
                  </>))}
            </div>
          )}
        <p className="ap-sub" style={{ marginTop: 12 }}>{t('{n} actividades', { n: visibles.length })}</p>
      </div>

      <Modal open={!!editando} onClose={() => setEditando(null)} wide title={esNueva ? t('Nueva actividad') : editando?.titulo}>
        {editando && (
          <div className="ap-form">
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-a-titulo">{t('Título')}</label>
              <input id="ef-a-titulo" className="finput" value={editando.titulo} onChange={e => setEditando({ ...editando, titulo: e.target.value })} />
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-a-tipo">{t('Tipo')}</label>
              <select id="ef-a-tipo" className="finput" value={editando.tipo} onChange={e => setEditando({ ...editando, tipo: e.target.value as TipoActividadEF })}>
                {TIPOS_ACTIVIDAD.map(x => <option key={x.id} value={x.id}>{t(x.label)}</option>)}
              </select>
            </div>
            {CAMPOS.map(c => (
              <div key={c.id} className="fgroup" style={{ gridColumn: '1 / -1' }}>
                <label className="flabel" htmlFor={`ef-a-${c.id}`}>{t(c.label)}</label>
                <textarea id={`ef-a-${c.id}`} className="finput" rows={c.id === 'descripcion' ? 3 : 2} value={editando[c.id]}
                  onChange={e => setEditando({ ...editando, [c.id]: e.target.value })} />
              </div>
            ))}
            <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
              <button className="btn-accent" onClick={guardar}>{t('Guardar')}</button>
              <button className="btn-ghost" onClick={() => setEditando(null)}>{t('Cancelar')}</button>
              {!esNueva && <button className="btn-ghost ap-borrar" onClick={() => borrar(editando)}><Trash2 size={14} />{t('Borrar')}</button>}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!ia} onClose={() => setIa(null)} wide title={t('Proponer actividades con IA')}>
        {ia && (
          <div className="ap-form">
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-ia-tipo">{t('Tipo')}</label>
              <select id="ef-ia-tipo" className="finput" value={ia.tipo} onChange={e => setIa({ ...ia, tipo: e.target.value as TipoActividadEF })}>
                {TIPOS_ACTIVIDAD.map(x => <option key={x.id} value={x.id}>{t(x.label)}</option>)}
              </select>
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-ia-clase">{t('Clase')}</label>
              <select id="ef-ia-clase" className="finput" value={ia.claseId} onChange={e => setIa({ ...ia, claseId: e.target.value })}>
                <option value="">{t('Sin clase concreta')}</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-ia-tema">{t('Qué quieres trabajar')}</label>
              <input id="ef-ia-tema" className="finput" value={ia.tema} placeholder={t('Ej: cooperación, pase en baloncesto, orientación con plano')}
                onChange={e => setIa({ ...ia, tema: e.target.value })} />
            </div>
            {hayInventario && (
              <label className="td-chk" style={{ gridColumn: '1 / -1' }}>
                <input type="checkbox" checked={ia.inventario} onChange={e => setIa({ ...ia, inventario: e.target.checked })} />
                {t('Con mi material y mis instalaciones')}
              </label>
            )}
            {limitacionesHoy.length > 0 && (
              <label className="td-chk" style={{ gridColumn: '1 / -1' }}>
                <input type="checkbox" checked={ia.limitaciones} onChange={e => setIa({ ...ia, limitaciones: e.target.checked })} />
                {t('Que puedan participar quienes hoy tienen una limitación en esta clase ({n})', { n: limitacionesHoy.length })}
              </label>
            )}
            <p className="ap-aviso" style={{ gridColumn: '1 / -1' }}>{t('A la IA solo le llega lo que no puede hacer cada alumno, sin nombres ni motivos.')}</p>
            <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
              <button className="btn-accent" onClick={proponer} disabled={pensando}>
                {pensando ? <span className="spin" /> : <Sparkles size={15} />}{pensando ? t('Preparando…') : t('Proponer tres')}
              </button>
              <button className="btn-ghost" onClick={() => setIa(null)}>{t('Cerrar')}</button>
            </div>
            {propuestas.length > 0 && (
              <div className="ef-acts" style={{ gridColumn: '1 / -1' }}>
                {propuestas.map(a => ficha(a, <button className="btn-accent" onClick={() => guardarPropuesta(a)}><Save size={14} />{t('Guardar en mis actividades')}</button>))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
