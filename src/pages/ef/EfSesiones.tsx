/**
 * Educación Física, «Sesiones» (decisión del dueño, 5-10-2026): calentamiento,
 * parte principal y vuelta a la calma, con medidas DUA-A para quien ese día
 * tiene una limitación y un plan B si llueve o la instalación está ocupada. La
 * IA las prepara con el currículo de la clase, el material, las instalaciones y
 * el banco de actividades; de los exentos solo recibe lo que no pueden hacer,
 * sin nombre ni motivo. Se revisan, se guardan y se imprimen. Ver `docs/EF.md`.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Plus, Sparkles, Trash2, FileDown, CalendarDays, MapPin, Bandage, Copy, Circle, CheckCircle2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { CopiarAClases } from '../../components/CopiarAClases';
import { clonarSesionEF } from '../../lib/clonar';
import { useToast } from '../../components/ui/Toast';
import { CriteriosOficialesPicker } from '../../components/curriculum/CriteriosOficialesPicker';
import { useI18n } from '../../i18n';
import { useNombreCurso } from '../../hooks/useNombreCurso';
import { useBorradorVentana } from '../../hooks/useBorrador';
import { AvisoBorrador } from '../../components/AvisoBorrador';
import { useMateriasOficiales } from '../../hooks/useNotasPorCompetencias';
import { isoDate, fromIsoDate } from '../../lib/utils';
import { MODALIDADES_EF, nuevoIdEF } from '../../lib/ef';
import { bancoEF } from '../../lib/bancoEF';
import { describirCriterio } from '../../lib/curriculum/criteriosParaIA';
import { esAsignaturaEF } from '../../services/classMarks';
import { hasApiKey } from '../../services/gemini';
import { limitacionesParaIA, prepararSesion } from '../../services/efIA';
import { alumnadoParaIA } from '../../lib/ef';
import { guardarSesionPdf } from '../../services/exportSesionEF';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { Class, EvalDiana, Rubric, ScheduleBlock, Student } from '../../types';
import { SesionEvaluacionCircuito } from '../../components/ef/SesionEvaluacionCircuito';
import { describirInstrumento, ETIQUETA_INSTRUMENTO } from '../../lib/instrumentosSesion';
import { pizarraSvg } from '../../lib/pizarraEF';
import type { EfData, ModalidadEF, SesionEF } from '../../types/ef';

interface Props {
  classes: Class[];
  students: Student[];
  scheduleBlocks: ScheduleBlock[];
  ef: EfData;
  onChangeEf: (f: (d: EfData) => EfData) => void;
  comunidad?: ComunidadId;
  /** Para adjuntar a la sesión un instrumento de evaluación que ya existe, o crear una escala de registro. */
  rubrics?: Rubric[];
  dianas?: EvalDiana[];
  onAddDiana?: (d: EvalDiana) => void;
  onNav?: (s: 'rubrics' | 'dianas' | 'registros') => void;
}

const EfPizarra = lazy(() => import('./EfPizarra').then(m => ({ default: m.EfPizarra })));

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

export function EfSesiones({ classes, students, scheduleBlocks, ef, onChangeEf, comunidad, rubrics = [], dianas = [], onAddDiana, onNav }: Props) {
  const { t, lang, locale } = useI18n();
  const { toast } = useToast();
  const nombreCurso = useNombreCurso();
  const hoy = isoDate();
  const [editando, setEditando] = useState<SesionEF | null>(null);
  const [ia, setIa] = useState<{ claseId: string; fecha: string; instalacionId: string; tema: string; minutos: number; banco: boolean; modalidad: ModalidadEF | '' } | null>(null);
  const [pensando, setPensando] = useState(false);
  const [verCompletadas, setVerCompletadas] = useState(false);
  /** Copiar sesiones a otras clases: de qué clase, cuáles y si se conserva la fecha. */
  const [copiando, setCopiando] = useState<{ origenId: string; ids: string[]; conFecha: boolean } | null>(null);
  const esNueva = !!editando && !ef.sesiones.some(s => s.id === editando.id);
  /** La pizarra de circuitos, abierta desde la sesión: con el circuito que se edita, o en blanco. */
  const [dibujando, setDibujando] = useState<{ id?: string } | null>(null);

  /* Autoguardado: una sesión nueva (la prepare la IA o la escriba el docente) o con cambios, y sin guardar, se conserva */
  const borrador = useBorradorVentana<SesionEF>('sesion-ef', !!editando, s => s.titulo || s.objetivo);
  const { cambiar: cambiarBorrador } = borrador;
  const guardadaAntes = editando ? ef.sesiones.find(s => s.id === editando.id) : undefined;
  const hayCambios = !!editando && (!guardadaAntes || JSON.stringify(guardadaAntes) !== JSON.stringify(editando));
  useEffect(() => {
    if (editando && hayCambios && (editando.titulo.trim() || editando.objetivo.trim() || editando.principal.trim())) cambiarBorrador(editando);
  }, [editando, hayCambios, cambiarBorrador]);
  function continuarBorrador() {
    const d = borrador.continuar();
    if (d) { setIa(null); setEditando(d); }
  }

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
  // Lo completado sale aparte, y lo que ya pasó sin completarse se queda a la vista para no perder el hilo
  const proximas = ordenadas.filter(s => !s.completada && s.fecha && s.fecha >= hoy);
  const sinFecha = ordenadas.filter(s => !s.completada && !s.fecha);
  const atrasadas = ordenadas.filter(s => !s.completada && s.fecha && s.fecha < hoy);
  const completadas = ordenadas.filter(s => s.completada).reverse();
  const hechas = completadas.length;
  const nombreClase = (id?: string) => classes.find(c => c.id === id)?.name ?? '';
  const nombreInst = (id?: string) => ef.instalaciones.find(i => i.id === id)?.nombre ?? '';
  const dia = (f: string) => fromIsoDate(f).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });

  const limitacionesDe = (claseId: string, fecha: string) =>
    limitacionesParaIA(ef, students.filter(s => s.class_id === claseId).map(s => s.id), fecha);
  /** Lo que llega a la IA: las limitaciones del día y los niveles II y III, sin nombres. */
  const alumnadoDe = (claseId: string, fecha: string) =>
    alumnadoParaIA(ef, students.filter(s => s.class_id === claseId).map(s => s.id), fecha);

  /* ── Copiar a otras clases ── */
  const sesionesDe = (claseId: string) => ordenadas.filter(s => (s.claseId ?? '') === claseId);
  /** Las clases (y «sin clase») que tienen sesiones: de dónde se puede copiar. */
  const origenes = [...new Set(ordenadas.map(s => s.claseId ?? ''))];

  function abrirCopia(origenId?: string, ids?: string[]) {
    const origen = origenId ?? origenes[0];
    if (origen === undefined) { toast(t('Aún no hay sesiones que copiar. Prepara una con la IA o escríbela tú.')); return; }
    setEditando(null);
    setCopiando({ origenId: origen, ids: ids ?? sesionesDe(origen).map(s => s.id), conFecha: false });
  }

  function copiarSesiones(destinosIds: string[]) {
    if (!copiando) return;
    const elegidas = ordenadas.filter(s => copiando.ids.includes(s.id));
    const destinos = classes.filter(c => destinosIds.includes(c.id));
    const nuevas = destinos.flatMap(c => elegidas.map(s => clonarSesionEF(s, c, nuevoIdEF('ses'), copiando.conFecha)));
    onChangeEf(d => ({ ...d, sesiones: [...d.sesiones, ...nuevas] }));
    setCopiando(null);
    setEditando(null);
    toast(t('{n} sesiones copiadas a {clases}.', { n: nuevas.length, clases: destinos.map(c => c.name).join(', ') }));
  }

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
      limitaciones: claseIa ? alumnadoDe(claseIa.id, ia.fecha) : [],
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
    cambiarBorrador(null);
    setEditando(null);
    toast(t('✅ Guardado'));
  }

  /** Marca o desmarca una sesión como dada, sin abrirla. */
  function alternarCompletada(s: SesionEF) {
    const hecha = !s.completada;
    onChangeEf(d => ({ ...d, sesiones: d.sesiones.map(x => (x.id === s.id ? { ...x, completada: hecha } : x)) }));
    toast(hecha ? t('Sesión completada') : t('Sesión pendiente otra vez'));
  }

  function borrar(s: SesionEF) {
    if (!window.confirm(t('¿Borrar la sesión «{nombre}»?', { nombre: s.titulo }))) return;
    onChangeEf(d => ({ ...d, sesiones: d.sesiones.filter(x => x.id !== s.id) }));
    cambiarBorrador(null);
    setEditando(null);
  }

  function borrarTodas() {
    const n = ef.sesiones.length;
    if (n === 0) return;
    if (!window.confirm(t('¿Borrar las {n} sesiones de todas las clases? No se puede deshacer.', { n }))) return;
    onChangeEf(d => ({ ...d, sesiones: [] }));
    setEditando(null);
    toast(t('{n} sesiones borradas.', { n }));
  }

  async function pdf(s: SesionEF) {
    const criterios = (s.criterios ?? []).map(ref => describirCriterio(materiasEd, ref)).filter(Boolean)
      .map(c => `${c!.materia} ${c!.ref.codigo}: ${c!.texto}`);
    const res = await guardarSesionPdf(s, {
      clase: nombreClase(s.claseId) || undefined, fecha: s.fecha ? dia(s.fecha) : undefined,
      instalacion: nombreInst(s.instalacionId) || undefined, criterios,
      instrumentos: (s.instrumentos ?? []).map(r => describirInstrumento(r, rubrics, dianas)).filter(Boolean)
        .map(d => ({ nombre: d!.nombre, tipo: t(ETIQUETA_INSTRUMENTO[d!.tipo]), conceptos: d!.conceptos })),
      circuito: (() => { const p = ef.pizarras.find(x => x.id === s.pizarraId); return p ? { nombre: p.nombre, svg: pizarraSvg(p) } : undefined; })(),
    }, lang);
    if (res.error === 'not-desktop') toast(t('Guardar en PDF solo está disponible en la aplicación de escritorio.'));
    else if (res.error) toast(t('No se ha podido guardar el PDF.'));
  }

  const fila = (s: SesionEF) => {
    const lims = !s.completada && s.claseId && s.fecha && s.fecha >= hoy ? limitacionesDe(s.claseId, s.fecha).length : 0;
    return (
      <li key={s.id} className={`ef-sesion-fila${s.completada ? ' completada' : ''}`}>
        <button
          type="button" className="ef-sesion-check" onClick={() => alternarCompletada(s)} aria-pressed={!!s.completada}
          aria-label={s.completada ? t('Marcar «{nombre}» como pendiente', { nombre: s.titulo }) : t('Marcar «{nombre}» como completada', { nombre: s.titulo })}
          title={s.completada ? t('Completada: pulsa para volver a ponerla pendiente') : t('Marcar como completada')}
        >
          {s.completada ? <CheckCircle2 size={22} aria-hidden="true" /> : <Circle size={22} aria-hidden="true" />}
        </button>
        <button type="button" className="ef-sesion" onClick={() => setEditando(s)}>
          <strong>{s.titulo || t('Sin título')}</strong>
          <span className="ap-meta">
            {s.claseId && <span>{nombreClase(s.claseId)}</span>}
            {s.fecha && <span className="ap-hora"><CalendarDays size={12} aria-hidden="true" />{dia(s.fecha)}</span>}
            {s.instalacionId && <span className="ap-hora"><MapPin size={12} aria-hidden="true" />{nombreInst(s.instalacionId)}</span>}
            {s.modalidad && <span className="sda-chip ef-modalidad">{t(MODALIDADES_EF.find(m => m.id === s.modalidad)!.label)}</span>}
            {s.ia && <span className="sda-chip ef-origen-ia">{t('Con IA')}</span>}
            {(s.instrumentos?.length ?? 0) > 0 && <span className="sda-chip">{t('Evaluación')}</span>}
            {s.pizarraId && ef.pizarras.some(p => p.id === s.pizarraId) && <span className="sda-chip">{t('Circuito')}</span>}
            {lims > 0 && <span className="ef-exento"><Bandage size={11} aria-hidden="true" />{t(lims === 1 ? '{n} con barrera de aprendizaje' : '{n} con barreras de aprendizaje', { n: lims })}</span>}
          </span>
          {s.objetivo.trim() && <span className="ap-sub">{s.objetivo}</span>}
        </button>
      </li>
    );
  };

  const limsIa = ia && claseIa ? alumnadoDe(claseIa.id, ia.fecha) : [];

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Sesiones')}</h1>
          <p className="pg-sub">{t('Calentamiento, parte principal y vuelta a la calma, con medidas para quien tiene una limitación (DUA-A) y un plan B. Prepáralas con la IA o escríbelas tú.')}</p>
        </div>
        <div className="ap-prog-acc">
          <button className="btn-ghost" onClick={() => setEditando(vacia())}><Plus size={15} />{t('Nueva sesión')}</button>
          <button className="btn-ghost" onClick={() => abrirCopia()} disabled={ef.sesiones.length === 0}><Copy size={15} />{t('Copiar a otras clases')}</button>
          <button className="btn-ghost ap-borrar" onClick={borrarTodas} disabled={ef.sesiones.length === 0}><Trash2 size={15} />{t('Borrar todas')}</button>
          <button className="btn-accent" onClick={abrirIa} disabled={!hasApiKey() || classes.length === 0}
            title={hasApiKey() ? undefined : t('Configura tu clave API gratuita de Google en Configuración para usar la IA.')}>
            <Sparkles size={15} />{t('Preparar con IA')}
          </button>
        </div>
      </div>

      {borrador.restos && (
        <AvisoBorrador borrador={borrador.restos} queEra={t('una sesión')} onContinuar={continuarBorrador} onDescartar={borrador.descartar} />
      )}

      {ef.sesiones.length > 0 && (
        <div className="ef-progreso" role="status">
          <div className="ef-progreso-barra" aria-hidden="true"><span style={{ width: `${Math.round((hechas / ef.sesiones.length) * 100)}%` }} /></div>
          <span>{t('{hechas} de {total} sesiones completadas', { hechas, total: ef.sesiones.length })}</span>
        </div>
      )}

      {atrasadas.length > 0 && (
        <div className="card ef-atrasadas">
          <div className="home-card-ttl" style={{ marginBottom: 4 }}>{t('Por completar')}</div>
          <p className="ap-aviso" style={{ marginBottom: 10 }}>{t('Su día ya pasó y no están marcadas como completadas. Márcalas si ya las diste; si no, cámbiales el día.')}</p>
          <ul className="ap-lista ef-sesiones">{atrasadas.map(fila)}</ul>
        </div>
      )}
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
      {completadas.length > 0 && (
        <button type="button" className="home-link" style={{ marginTop: 14 }} onClick={() => setVerCompletadas(v => !v)} aria-expanded={verCompletadas}>
          {verCompletadas ? t('Ocultar las completadas') : t('Ver las completadas ({n})', { n: completadas.length })}
        </button>
      )}
      {verCompletadas && completadas.length > 0 && <div className="card"><ul className="ap-lista ef-sesiones">{completadas.map(fila)}</ul></div>}

      <CopiarAClases
        open={!!copiando} onClose={() => setCopiando(null)} titulo={t('Copiar sesiones a otras clases')}
        texto={t('Cada clase tendrá sus propias copias, que podrás retocar sin cambiar las demás. Por defecto, sin fecha: tú las repartes en el calendario de cada clase.')}
        classes={classes} origen={classes.find(c => c.id === copiando?.origenId)}
        yaLoTienen={new Set(ef.sesiones.filter(x => x.claseId && ordenadas.some(o => copiando?.ids.includes(o.id) && o.titulo === x.titulo)).map(x => x.claseId!))}
        deshabilitado={!copiando?.ids.length}
        boton={n => t(n === 1 ? 'Copiar a 1 clase' : 'Copiar a {n} clases', { n })} onConfirm={copiarSesiones}
        arriba={copiando && (
          <div className="ef-copia-ses">
            <label className="flabel" htmlFor="ef-cs-origen">{t('Sesiones de')}</label>
            <select id="ef-cs-origen" className="finput" value={copiando.origenId}
              onChange={e => setCopiando({ ...copiando, origenId: e.target.value, ids: sesionesDe(e.target.value).map(x => x.id) })}>
              {origenes.map(o => <option key={o || 'sin'} value={o}>{o ? nombreClase(o) : t('Sin clase')}</option>)}
            </select>
            <div className="copiar-grupo" role="group" aria-label={t('Sesiones que se copian')}>
              {sesionesDe(copiando.origenId).map(x => (
                <label key={x.id} className="td-chk">
                  <input type="checkbox" checked={copiando.ids.includes(x.id)}
                    onChange={() => setCopiando({ ...copiando, ids: copiando.ids.includes(x.id) ? copiando.ids.filter(i => i !== x.id) : [...copiando.ids, x.id] })} />
                  <span>{x.titulo || t('Sin título')}{x.fecha ? ` · ${dia(x.fecha)}` : ''}</span>
                </label>
              ))}
            </div>
            <label className="td-chk">
              <input type="checkbox" checked={copiando.conFecha} onChange={e => setCopiando({ ...copiando, conFecha: e.target.checked })} />
              {t('Conservar también la fecha')}
            </label>
          </div>
        )}
      />

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
              {limsIa.length === 0 ? t('Ese día no hay nadie exento, lesionado ni con medidas de nivel II o III en esta clase.')
                : limsIa.length === 1 ? t('Ese día hay un alumno o alumna con alguna limitación o con medidas de nivel II o III en esta clase: la sesión llevará medidas para que participe.')
                : t('Ese día hay {n} alumnos con alguna limitación o con medidas de nivel II o III en esta clase: la sesión llevará medidas para que participen.', { n: limsIa.length })}
              {' '}{t('A la IA solo le llega lo que no puede hacer cada alumno y su nivel de apoyo con lo que necesita, sin nombres, motivos ni diagnósticos.')}
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

      <Modal open={!!editando} onClose={() => { if (!dibujando) setEditando(null); }} wide title={esNueva ? (editando?.ia ? t('Sesión preparada con IA') : t('Nueva sesión')) : editando?.titulo}>
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
            <label className="td-chk" style={{ gridColumn: '1 / -1' }}>
              <input type="checkbox" checked={!!editando.completada} onChange={e => setEditando({ ...editando, completada: e.target.checked })} />
              {t('Sesión completada')}
            </label>
            <SesionEvaluacionCircuito
              sesion={editando} onChange={setEditando} ef={ef} rubrics={rubrics} dianas={dianas}
              onAddDiana={onAddDiana} onNav={onNav} onCerrarSesion={() => setEditando(null)} onDibujar={id => setDibujando({ id })}
            />
            <div style={{ gridColumn: '1 / -1' }}>
              <CriteriosOficialesPicker idPrefix="ef-s-co" cls={claseEd} comunidad={comunidad}
                value={editando.criterios ?? []} onChange={v => setEditando({ ...editando, criterios: v })} />
            </div>
            <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
              <button className="btn-accent" onClick={guardar}>{t('Guardar')}</button>
              <button className="btn-ghost" onClick={() => pdf(editando)}><FileDown size={14} />{t('PDF')}</button>
              {!esNueva && <button className="btn-ghost" onClick={() => abrirCopia(editando.claseId ?? '', [editando.id])}><Copy size={14} />{t('Copiar a otras clases')}</button>}
              <button className="btn-ghost" onClick={() => { cambiarBorrador(null); setEditando(null); }}>{t('Cancelar')}</button>
              {!esNueva && <button className="btn-ghost ap-borrar" onClick={() => borrar(editando)}><Trash2 size={14} />{t('Borrar')}</button>}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!dibujando} onClose={() => setDibujando(null)} wide title={t('Circuito de la sesión')}>
        {dibujando && editando && (
          <Suspense fallback={<p className="ap-vacio">{t('Cargando…')}</p>}>
            <EfPizarra
              embebida ef={ef} onChangeEf={onChangeEf} comunidad={comunidad} inicialId={dibujando.id}
              alGuardar={id => { setEditando(e => (e ? { ...e, pizarraId: id } : e)); setDibujando(null); }}
            />
          </Suspense>
        )}
      </Modal>
    </section>
  );
}
