/**
 * «Sesiones» (decisión del dueño, 5-10-2026, en Educación Física; desde el
 * 21-10-2026, la misma pantalla para el docente de aula): calentamiento (inicio),
 * parte principal (desarrollo) y vuelta a la calma (cierre), con medidas de
 * inclusión para quien ese día tiene una limitación y un plan B. En EF, la IA las
 * prepara con el currículo de la clase, el material, las instalaciones y el
 * banco de actividades; de los exentos solo recibe lo que no pueden hacer, sin
 * nombre ni motivo. Se revisan, se guardan y se imprimen. Ver `docs/EF.md`.
 *
 * La portada es una tarjeta por clase; dentro de cada una, las sesiones van
 * agrupadas por su situación de aprendizaje y se pueden elegir varias para
 * eliminarlas, archivarlas, asociarlas a una SdA o crear una SdA con ellas.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Plus, Sparkles, Trash2, FileDown, CalendarDays, MapPin, Bandage, Copy, Circle, CheckCircle2, Eye, Check } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { DocPreview } from '../components/DocPreview';
import { CopiarAClases } from '../components/CopiarAClases';
import { clonarSesionEF } from '../lib/clonar';
import { useToast } from '../components/ui/Toast';
import { CriteriosOficialesPicker } from '../components/curriculum/CriteriosOficialesPicker';
import { useI18n } from '../i18n';
import { useNombreCurso } from '../hooks/useNombreCurso';
import { useBorradorVentana } from '../hooks/useBorrador';
import { AvisoBorrador } from '../components/AvisoBorrador';
import { useMateriasOficiales } from '../hooks/useNotasPorCompetencias';
import { isoDate, fromIsoDate } from '../lib/utils';
import { MODALIDADES_EF, nuevoIdEF } from '../lib/ef';
import { bancoEF } from '../lib/bancoEF';
import { todasLasActividades, textoDe } from '../lib/deportesAlternativos';
import { describirCriterio } from '../lib/curriculum/criteriosParaIA';
import { esAsignaturaEF } from '../services/classMarks';
import { hasApiKey } from '../services/gemini';
import { limitacionesParaIA, prepararSesion } from '../services/efIA';
import { alumnadoParaIA } from '../lib/ef';
import { guardarSesionPdf, buildSesionHtml } from '../services/exportSesionEF';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import type { Class, EvalDiana, Evaluation, LearningSituation, Rubric, ScheduleBlock, Student } from '../types';
import { SesionEvaluacionCircuito } from '../components/ef/SesionEvaluacionCircuito';
import { ETIQUETA_INSTRUMENTO } from '../lib/instrumentosSesion';
import { htmlInstrumento } from '../services/instrumentoEmbebido';
import { pizarraSvg } from '../lib/pizarraEF';
import { archivarSesiones, asociarASda, quitarSesiones } from '../lib/sesiones';
import { ClasesDeSesiones } from '../components/sesiones/ClasesDeSesiones';
import { SesionesDeClase } from '../components/sesiones/SesionesDeClase';
import { AsociarASda } from '../components/sesiones/AsociarASda';
import { CrearSdaDeSesiones } from '../components/sesiones/CrearSdaDeSesiones';
import type { EfData, InstrumentoRefEF, ModalidadEF, SesionEF } from '../types/ef';
import type { InlineFile } from '../services/gemini';
import { ValorarRegistro } from '../components/ValorarRegistro';

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
  /** Para valorar a la clase con un instrumento de la sesión, sin salir de ella. */
  evaluations?: Evaluation[];
  lawDocument?: InlineFile | null;
  onAddEvaluation?: (ev: Evaluation) => void;
  /** Educación Física (con su banco, circuitos e IA de sesiones) o docente de aula; por defecto, EF. */
  perfil?: 'ef' | 'aula';
  /** Las situaciones de aprendizaje, para asociarles sesiones o crear una con ellas. */
  learningSituations?: LearningSituation[];
  onSaveSda?: (s: LearningSituation) => void;
  /** Ir a Situaciones de aprendizaje. */
  onAbrirSda?: () => void;
}

const EvalRubricaModal = lazy(() => import('./Rubrics').then(m => ({ default: m.EvalModal })));
const EvalDianaModal = lazy(() => import('./EvalDianas').then(m => ({ default: m.DianaEvalModal })));
const EfPizarra = lazy(() => import('./ef/EfPizarra').then(m => ({ default: m.EfPizarra })));

type ParteId = keyof Pick<SesionEF, 'objetivo' | 'calentamiento' | 'principal' | 'calma' | 'material' | 'inclusion' | 'planB'>;

/** Las partes de una sesión: en EF, con sus nombres de siempre; en el aula, inicio, desarrollo y cierre (son los mismos campos). */
const partesDe = (esEF: boolean): readonly { id: ParteId; label: string; filas: number }[] => [
  { id: 'objetivo', label: 'Objetivo', filas: 2 },
  { id: 'calentamiento', label: esEF ? 'Calentamiento' : 'Inicio de la sesión', filas: 4 },
  { id: 'principal', label: esEF ? 'Parte principal' : 'Desarrollo de la sesión', filas: 7 },
  { id: 'calma', label: esEF ? 'Vuelta a la calma' : 'Cierre de la sesión', filas: 3 },
  { id: 'material', label: esEF ? 'Material' : 'Materiales', filas: 2 },
  { id: 'inclusion', label: esEF ? 'Para que participe todo el grupo (DUA-A)' : 'Medidas de inclusión (DUA)', filas: 3 },
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

export function Sesiones({
  classes, students, scheduleBlocks, ef, onChangeEf, comunidad, rubrics = [], dianas = [], onAddDiana, onNav, evaluations = [], lawDocument = null,
  onAddEvaluation, perfil = 'ef', learningSituations = [], onSaveSda, onAbrirSda,
}: Props) {
  const { t, lang, locale } = useI18n();
  const { toast } = useToast();
  const nombreCurso = useNombreCurso();
  const hoy = isoDate();
  const [editando, setEditando] = useState<SesionEF | null>(null);
  const [ia, setIa] = useState<{ claseId: string; fecha: string; instalacionId: string; tema: string; minutos: number; banco: boolean; modalidad: ModalidadEF | '' } | null>(null);
  const [pensando, setPensando] = useState(false);
  /** Selector de actividades de deportes alternativos para añadirlas a la sesión. */
  const [altPicker, setAltPicker] = useState(false);
  const [altSel, setAltSel] = useState<string[]>([]);
  const esEF = perfil === 'ef';
  /** La clase abierta (`''` = sesiones sin clase); `null`, la portada con las tarjetas. */
  const [claseVista, setClaseVista] = useState<string | null>(null);
  /** Sesiones por asociar a una SdA y sesiones con las que crear una SdA nueva. */
  const [asociando, setAsociando] = useState<string[] | null>(null);
  const [creandoSda, setCreandoSda] = useState<string[] | null>(null);
  /** Copiar sesiones a otras clases: de qué clase, cuáles y si se conserva la fecha. */
  const [copiando, setCopiando] = useState<{ origenId: string; ids: string[]; conFecha: boolean } | null>(null);
  const esNueva = !!editando && !ef.sesiones.some(s => s.id === editando.id);
  /** La pizarra de circuitos, abierta desde la sesión: con el circuito que se edita, o en blanco. */
  const [dibujando, setDibujando] = useState<{ id?: string } | null>(null);
  /** Valorar a la clase con un instrumento de la sesión, sin salir de ella. */
  const [evaluando, setEvaluando] = useState<InstrumentoRefEF | null>(null);
  const [preview, setPreview] = useState<{ html: string; title: string } | null>(null);

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

  const vacia = (claseId: string | undefined = claseVista || classes[0]?.id): SesionEF => ({
    id: nuevoIdEF('ses'), titulo: '', claseId, fecha: hoy, ...(esEF && ef.instalaciones[0] ? { instalacionId: ef.instalaciones[0].id } : {}),
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

  /** Añade las actividades elegidas del selector al desarrollo de la sesión. */
  function insertarActividades() {
    const texto = altSel.map(codigo => {
      const x = todasLasActividades().find(i => i.actividad.codigo === codigo);
      return x ? `${textoDe(x.actividad.titulo, lang)}: ${textoDe(x.actividad.desarrollo, lang)}` : '';
    }).filter(Boolean).join('\n\n');
    setEditando(e => (e ? { ...e, principal: (e.principal.trim() ? e.principal + '\n\n' : '') + texto } : e));
    setAltSel([]);
    setAltPicker(false);
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

  /* ── Acciones sobre varias sesiones ── */
  function eliminarVarias(ids: string[]) {
    if (ids.length === 0) return;
    if (!window.confirm(t(ids.length === 1 ? '¿Eliminar la sesión elegida? No se puede deshacer.' : '¿Eliminar las {n} sesiones elegidas? No se puede deshacer.', { n: ids.length }))) return;
    onChangeEf(d => ({ ...d, sesiones: quitarSesiones(d.sesiones, new Set(ids)) }));
    toast(t(ids.length === 1 ? '{n} sesión eliminada.' : '{n} sesiones eliminadas.', { n: ids.length }));
  }

  function archivarVarias(ids: string[], archivar: boolean) {
    if (ids.length === 0) return;
    onChangeEf(d => ({ ...d, sesiones: archivarSesiones(d.sesiones, new Set(ids), archivar) }));
    toast(t(archivar ? '{n} sesiones archivadas: las encuentras en «Ver las archivadas».' : '{n} sesiones restauradas.', { n: ids.length }));
  }

  function asociarVarias(sdaId: string | undefined) {
    if (!asociando) return;
    const ids = asociando;
    onChangeEf(d => ({ ...d, sesiones: asociarASda(d.sesiones, ids, sdaId) }));
    setAsociando(null);
    toast(sdaId ? t('{n} sesiones asociadas a la situación de aprendizaje.', { n: ids.length }) : t('{n} sesiones sin situación de aprendizaje.', { n: ids.length }));
  }

  /** La SdA nueva ya está guardada: se asocian las sesiones con las que se creó. */
  function sdaCreada(sda: LearningSituation, ids: string[]) {
    onSaveSda?.(sda);
    onChangeEf(d => ({ ...d, sesiones: asociarASda(d.sesiones, ids, sda.id) }));
  }

  async function pdf(s: SesionEF) {
    const res = await guardarSesionPdf(s, datosPdf(s), lang);
    if (res.error === 'not-desktop') toast(t('Guardar en PDF solo está disponible en la aplicación de escritorio.'));
    else if (res.error) toast(t('No se ha podido guardar el PDF.'));
  }

  /** Los datos de la sesión en el idioma de la app, para el visor y el PDF. */
  function datosPdf(s: SesionEF) {
    const criterios = (s.criterios ?? []).map(ref => describirCriterio(materiasEd, ref)).filter(Boolean)
      .map(c => `${c!.materia} ${c!.ref.codigo}: ${c!.texto}`);
    return {
      aula: !esEF,
      clase: nombreClase(s.claseId) || undefined, fecha: s.fecha ? dia(s.fecha) : undefined,
      instalacion: nombreInst(s.instalacionId) || undefined, criterios,
      instrumentos: (s.instrumentos ?? []).map(r => {
        const inst = r.tipo === 'rubrica' ? rubrics.find(y => y.id === r.id) : dianas.find(y => y.id === r.id);
        if (!inst) return null;
        return { nombre: inst.name, tipo: t(ETIQUETA_INSTRUMENTO[r.tipo]), html: htmlInstrumento(inst, lang) };
      }).filter((x): x is { nombre: string; tipo: string; html: string } => !!x),
      circuito: (() => { const p = ef.pizarras.find(x => x.id === s.pizarraId); return p ? { nombre: p.nombre, svg: pizarraSvg(p) } : undefined; })(),
    };
  }

  /** Abre el visor con el documento tal como se imprimiría. */
  function verPreview(s: SesionEF) {
    setPreview({ html: buildSesionHtml(s, datosPdf(s), lang), title: s.titulo || t('Sesión') });
  }

  const fila = (s: SesionEF, seleccion?: { marcada: boolean; alternar: () => void }) => {
    const lims = esEF && !s.completada && s.claseId && s.fecha && s.fecha >= hoy ? limitacionesDe(s.claseId, s.fecha).length : 0;
    return (
      <li key={s.id} className={`ef-sesion-fila${s.completada ? ' completada' : ''}${s.archivada ? ' archivada' : ''}${seleccion?.marcada ? ' elegida' : ''}`}>
        {seleccion && (
          <input type="checkbox" className="ses-elegir" checked={seleccion.marcada} onChange={seleccion.alternar}
            aria-label={t('Elegir «{nombre}»', { nombre: s.titulo || t('Sin título') })} />
        )}
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
            {s.fecha && <span className="ap-hora"><CalendarDays size={12} aria-hidden="true" />{dia(s.fecha)}</span>}
            {!s.completada && s.fecha && s.fecha < hoy && <span className="sda-chip ef-atrasada">{t('Por completar')}</span>}
            {s.archivada && <span className="sda-chip">{t('Archivada')}</span>}
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

  const claseAbierta = claseVista === null ? undefined : classes.find(c => c.id === claseVista);
  const sesionesAbiertas = claseVista === null ? [] : ordenadas.filter(s => (claseVista ? s.claseId === claseVista : !s.claseId || !classes.some(c => c.id === s.claseId)));
  const sdasDeLaClase = (id?: string) => learningSituations.filter(x => !id || x.class_id === id || !!x.otras_clases?.includes(id) || !x.class_id);
  const sesionesPorId = (ids: string[]) => ids.map(id => ef.sesiones.find(x => x.id === id)).filter((x): x is SesionEF => !!x);
  const sesionesDeSdaNueva = creandoSda ? sesionesPorId(creandoSda) : [];
  const claseDeSdaNueva = classes.find(c => c.id === sesionesDeSdaNueva[0]?.claseId);

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Sesiones')}</h1>
          <p className="pg-sub">{t(esEF
            ? 'Calentamiento, parte principal y vuelta a la calma, con medidas para quien tiene una limitación (DUA-A) y un plan B. Una tarjeta por clase y, dentro, agrupadas por situación de aprendizaje.'
            : 'Inicio, desarrollo y cierre de cada clase, con medidas de inclusión y un plan B. Una tarjeta por clase y, dentro, agrupadas por situación de aprendizaje.')}</p>
        </div>
        <div className="ap-prog-acc">
          {claseVista === null && <button className="btn-ghost" onClick={() => setEditando(vacia())}><Plus size={15} />{t('Nueva sesión')}</button>}
          <button className="btn-ghost" onClick={() => abrirCopia(claseVista ?? undefined)} disabled={ef.sesiones.length === 0}><Copy size={15} />{t('Copiar a otras clases')}</button>
          {esEF && (
            <button className="btn-accent" onClick={abrirIa} disabled={!hasApiKey() || classes.length === 0}
              title={hasApiKey() ? undefined : t('Configura tu clave API gratuita de Google en Configuración para usar la IA.')}>
              <Sparkles size={15} />{t('Preparar con IA')}
            </button>
          )}
        </div>
      </div>

      {borrador.restos && (
        <AvisoBorrador borrador={borrador.restos} queEra={t('una sesión')} onContinuar={continuarBorrador} onDescartar={borrador.descartar} />
      )}

      {claseVista === null ? (
        <>
          {ef.sesiones.length > 0 && (() => {
            const vivas = ef.sesiones.filter(x => !x.archivada);
            const hechas = vivas.filter(x => x.completada).length;
            return vivas.length > 0 && (
              <div className="ef-progreso" role="status">
                <div className="ef-progreso-barra" aria-hidden="true"><span style={{ width: `${Math.round((hechas / vivas.length) * 100)}%` }} /></div>
                <span>{t('{hechas} de {total} sesiones completadas', { hechas, total: vivas.length })}</span>
              </div>
            );
          })()}
          <ClasesDeSesiones classes={classes} sesiones={ef.sesiones} hoy={hoy} onAbrir={setClaseVista} onNueva={id => setEditando(vacia(id))} />
        </>
      ) : (
        <SesionesDeClase
          nombre={claseAbierta?.name ?? t('Sin clase concreta')} color={claseAbierta?.color}
          sesiones={sesionesAbiertas} sdas={sdasDeLaClase(claseAbierta?.id)} fila={fila}
          onVolver={() => setClaseVista(null)} onNueva={() => setEditando(vacia(claseAbierta?.id))}
          onEliminar={eliminarVarias} onArchivar={archivarVarias}
          onAsociar={ids => setAsociando(ids)} onCrearSda={ids => setCreandoSda(ids)}
          onAbrirSda={onAbrirSda} puedeCrearSda={!!onSaveSda}
        />
      )}

      <AsociarASda
        open={!!asociando} onClose={() => setAsociando(null)} cuantas={asociando?.length ?? 0}
        sdas={learningSituations} claseId={claseAbierta?.id} onElegir={asociarVarias}
      />
      <CrearSdaDeSesiones
        open={!!creandoSda} onClose={() => setCreandoSda(null)} sesiones={sesionesDeSdaNueva} clase={claseDeSdaNueva}
        comunidad={comunidad} perfil={perfil} ef={ef} numeroSiguiente={learningSituations.length + 1}
        onCreada={sdaCreada} onAbrirSda={onAbrirSda}
      />

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

      <Modal open={!!editando} onClose={() => { if (!dibujando && !evaluando) setEditando(null); }} wide title={esNueva ? (editando?.ia ? t('Sesión preparada con IA') : t('Nueva sesión')) : editando?.titulo}>
        {editando && (
          <div className="ap-form">
            <div className="ap-acciones" style={{ gridColumn: '1 / -1', marginBottom: 14, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <button className="btn-accent" onClick={guardar}><Check size={15} />{t('Guardar')}</button>
              <button className="btn-ghost" onClick={() => verPreview(editando)}><Eye size={15} />{t('Vista previa')}</button>
              <button className="btn-ghost" onClick={() => { setAltSel([]); setAltPicker(true); }}><Plus size={15} />{t('Añadir actividades')}</button>
              <button className="btn-ghost" onClick={() => pdf(editando)}><FileDown size={15} />{t('PDF')}</button>
              {!esNueva && <button className="btn-ghost" onClick={() => abrirCopia(editando.claseId ?? '', [editando.id])}><Copy size={15} />{t('Copiar a otras clases')}</button>}
              <div style={{ flex: 1, minWidth: 8 }} />
              <button className="btn-ghost" onClick={() => { cambiarBorrador(null); setEditando(null); }}>{t('Cancelar')}</button>
              {!esNueva && <button className="btn-ghost ap-borrar" onClick={() => borrar(editando)}><Trash2 size={15} />{t('Borrar')}</button>}
            </div>
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
            {learningSituations.length > 0 && (
              <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
                <label className="flabel" htmlFor="ef-s-sda">{t('Situación de aprendizaje')}</label>
                <select id="ef-s-sda" className="finput" value={editando.sdaId ?? ''}
                  onChange={e => setEditando(e.target.value
                    ? { ...editando, sdaId: e.target.value, sdaOrden: editando.sdaId === e.target.value ? editando.sdaOrden : Math.max(0, ...ef.sesiones.filter(x => x.sdaId === e.target.value && x.id !== editando.id).map(x => x.sdaOrden ?? 0)) + 1 }
                    : (({ sdaId: _i, sdaOrden: _o, ...r }) => { void _i; void _o; return r; })(editando))}>
                  <option value="">{t('Ninguna')}</option>
                  {sdasDeLaClase(editando.claseId).map(x => <option key={x.id} value={x.id}>{x.request.numero ? `${x.request.numero}. ` : ''}{x.title}</option>)}
                </select>
              </div>
            )}
            {esEF && (
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-s-inst">{t('Instalación')}</label>
              <select id="ef-s-inst" className="finput" value={editando.instalacionId ?? ''}
                onChange={e => setEditando({ ...editando, instalacionId: e.target.value || undefined })}>
                <option value="">{t('Sin indicar')}</option>
                {ef.instalaciones.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select>
            </div>
            )}
            {esEF && (
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-s-modalidad">{t('Modalidad del juego o deporte')}</label>
              <select id="ef-s-modalidad" className="finput" value={editando.modalidad ?? ''} onChange={e => setEditando(e.target.value ? { ...editando, modalidad: e.target.value as ModalidadEF } : (({ modalidad: _m, ...r }) => { void _m; return r; })(editando))}>
                <option value="">{t('Sin modalidad')}</option>
                {MODALIDADES_EF.map(m => <option key={m.id} value={m.id}>{t(m.label)}</option>)}
              </select>
            </div>
            )}
            {partesDe(esEF).map(p => (
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
              sesion={editando} onChange={setEditando} ef={ef} rubrics={rubrics} dianas={dianas} conCircuito={esEF}
              evaluations={evaluations} students={students} onEvaluar={onAddEvaluation ? setEvaluando : undefined}
              onAddDiana={onAddDiana} onNav={onNav} onCerrarSesion={() => setEditando(null)} onDibujar={id => setDibujando({ id })}
            />
            <div style={{ gridColumn: '1 / -1' }}>
              <CriteriosOficialesPicker idPrefix="ef-s-co" cls={claseEd} comunidad={comunidad}
                value={editando.criterios ?? []} onChange={v => setEditando({ ...editando, criterios: v })} />
            </div>
          </div>
        )}
      </Modal>

      <Modal open={altPicker} onClose={() => setAltPicker(false)} wide title={t('Añadir actividades de deportes alternativos')}>
        <div className="ap-form">
          <div className="ef-alt-sel">
            {todasLasActividades().map(({ deporte, actividad }) => (
              <label key={actividad.codigo} className="ef-alt-act">
                <input type="checkbox" className="ef-alt-chk" checked={altSel.includes(actividad.codigo)}
                  onChange={() => setAltSel(prev => (prev.includes(actividad.codigo) ? prev.filter(c => c !== actividad.codigo) : [...prev, actividad.codigo]))} />
                <div>
                  <strong>{deporte ? `${textoDe(deporte.nombre, lang)}: ` : ''}{textoDe(actividad.titulo, lang)}</strong>
                  <p className="ap-sub">{textoDe(actividad.desarrollo, lang)}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="ap-acciones">
            <button className="btn-accent" onClick={insertarActividades} disabled={altSel.length === 0}><Plus size={15} />{t('Añadir a la sesión')}</button>
            <button className="btn-ghost" onClick={() => setAltPicker(false)}>{t('Cerrar')}</button>
          </div>
        </div>
      </Modal>

      {evaluando && editando && (() => {
        const alGuardar = (ev: Evaluation) => onAddEvaluation?.(ev);
        const cerrar = () => setEvaluando(null);
        const rubrica = evaluando.tipo === 'rubrica' ? rubrics.find(r => r.id === evaluando.id) : undefined;
        const diana = evaluando.tipo !== 'rubrica' ? dianas.find(d => d.id === evaluando.id) : undefined;
        return (
          <Suspense fallback={null}>
            {evaluando.tipo === 'registro' && diana && (
              <ValorarRegistro escala={diana} classes={classes} students={students} evaluations={evaluations}
                claseInicial={editando.claseId} onAddEvaluation={alGuardar} onClose={cerrar} />
            )}
            {evaluando.tipo === 'rubrica' && rubrica && (
              <EvalRubricaModal open rubric={rubrica} classes={classes} students={students} lawDocument={lawDocument}
                defaultClassId={editando.claseId} onClose={cerrar} onSave={alGuardar} />
            )}
            {evaluando.tipo === 'diana' && diana && (
              <EvalDianaModal open diana={diana} classes={classes} students={students}
                defaultClassId={editando.claseId} onClose={cerrar} onSave={alGuardar} />
            )}
          </Suspense>
        );
      })()}

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

      <DocPreview open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ''} html={preview?.html ?? ''} />
    </section>
  );
}
