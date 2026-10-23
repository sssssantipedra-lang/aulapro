/**
 * Educación Física, «Actividades»: el banco de partida de AulaPro, las del
 * docente y las que guarda de la IA (decisión del dueño, 5-10-2026). Tipos:
 * juegos, deportes, días de lluvia, medio natural, calentamiento y vuelta a la
 * calma. Cada actividad dice cómo participa quien tiene una limitación
 * (DUA-A). A la IA solo le llega lo que no puede hacer cada alumno y su nivel
 * de apoyo (II o III) con lo que necesita, sin nombre, motivo ni diagnóstico. «Desde una foto» (6-10-2026): la IA reconoce el deporte o la
 * actividad de una foto y la redacta para la edad de la clase; la foto va
 * reducida y sin sus metadatos, y no se guarda. «Desde un manual» (17-10-2026):
 * la IA lee un PDF, saca sus actividades, las clasifica y el docente elige cuáles
 * guarda; el PDF va a Google y no se guarda. Ver `docs/EF.md`.
 */
import { useMemo, useRef, useState } from 'react';
import {
  Plus, Sparkles, Pencil, Trash2, Copy, Search, Save, Camera, ImagePlus, FileText, ArrowLeft, ArrowRight, Gamepad2, Trophy, CloudRain, TreePine, Flame, Wind,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useI18n } from '../../i18n';
import { useNombreCurso } from '../../hooks/useNombreCurso';
import { fileToBase64, isoDate } from '../../lib/utils';
import { bancoEF } from '../../lib/bancoEF';
import { deporteAlternativoDe, textoDe, TRANSVERSALES, type DeporteAlternativo, type ActividadGuia } from '../../lib/deportesAlternativos';
import { alumnadoParaIA, edadAproximada, MODALIDADES_EF, nuevoIdEF, TIPOS_ACTIVIDAD } from '../../lib/ef';
import { fotoParaIA } from '../../lib/fotos';
import { hasApiKey, type InlineFile } from '../../services/gemini';
import { actividadDesdeFoto, actividadesDesdeManual, MAX_ACTIVIDADES_MANUAL, proponerActividades } from '../../services/efIA';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { Class, Student } from '../../types';
import type { ActividadEF, EfData, ModalidadEF, TipoActividadEF } from '../../types/ef';

interface Props {
  classes: Class[];
  students: Student[];
  ef: EfData;
  onChangeEf: (f: (d: EfData) => EfData) => void;
  comunidad?: ComunidadId;
}

type Origen = 'todas' | ActividadEF['origen'];

/**
 * El banco se abre en una tarjeta por tipo de actividad (petición del dueño,
 * 18-10-2026: «en lugar de tenerlo todo ahí con tanta información, agrúpalo
 * por tarjetas»); cada una abre sus actividades, también en tarjetas, y la
 * ficha entera se lee al tocar una.
 */
const TARJETA_TIPO: Record<TipoActividadEF, { color: string; icono: React.ReactNode; texto: string }> = {
  juego: { color: '#16a34a', icono: <Gamepad2 size={26} />, texto: 'Juegos de pillar, de cooperación, de relevos y populares, para toda la clase.' },
  deporte: { color: '#2563eb', icono: <Trophy size={26} />, texto: 'Juegos modificados y tareas de iniciación a cada deporte.' },
  lluvia: { color: '#0891b2', icono: <CloudRain size={26} />, texto: 'Qué hacer en el pabellón, el porche o el aula cuando no se puede salir.' },
  natural: { color: '#65a30d', icono: <TreePine size={26} />, texto: 'Orientación, rutas y juegos en el patio, el parque o el entorno.' },
  calentamiento: { color: '#ea580c', icono: <Flame size={26} />, texto: 'Activación general y específica para empezar la sesión.' },
  calma: { color: '#7c3aed', icono: <Wind size={26} />, texto: 'Relajación, estiramientos y reflexión para cerrar la sesión.' },
};

/** Lo que admite Gemini en línea es 20 MB en total; se deja margen para el resto de la petición. */
const MAX_MANUAL_BYTES = 19 * 1024 * 1024;

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
  const [modalidad, setModalidad] = useState<ModalidadEF | 'todas'>('todas');
  const [origen, setOrigen] = useState<Origen>('todas');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<ActividadEF | null>(null);
  const [ia, setIa] = useState<{ tipo: TipoActividadEF; modalidad: ModalidadEF | ''; claseId: string; tema: string; inventario: boolean; limitaciones: boolean } | null>(null);
  const [propuestas, setPropuestas] = useState<ActividadEF[]>([]);
  const [pensando, setPensando] = useState(false);
  const [foto, setFoto] = useState<{ claseId: string; nota: string; inventario: boolean; limitaciones: boolean; archivo: InlineFile | null } | null>(null);
  const [deFoto, setDeFoto] = useState<{ visto: string; actividad: ActividadEF | null } | null>(null);
  const archivoFoto = useRef<HTMLInputElement>(null);
  const [manual, setManual] = useState<{ claseId: string; paginas: string; nota: string; archivo: InlineFile | null } | null>(null);
  /** Lo que sacó la IA del manual y cuáles se guardan. */
  const [delManual, setDelManual] = useState<{ actividades: ActividadEF[]; elegidas: string[] } | null>(null);
  const archivoManual = useRef<HTMLInputElement>(null);
  /** La actividad que se está leyendo entera. */
  const [leyendo, setLeyendo] = useState<ActividadEF | null>(null);
  /** Deporte alternativo abierto, con su progresión de sesiones. */
  const [deporte, setDeporte] = useState<DeporteAlternativo | null>(null);
  const esNueva = !!editando && !ef.actividades.some(a => a.id === editando.id);

  const todas = useMemo(() => [...ef.actividades, ...bancoEF(lang)], [ef.actividades, lang]);
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const visibles = todas.filter(a =>
    (tipo === 'todas' || a.tipo === tipo) && (modalidad === 'todas' || a.modalidad === modalidad) && (origen === 'todas' || a.origen === origen) &&
    (!busca.trim() || norm(`${a.titulo} ${a.descripcion} ${a.material}`).includes(norm(busca.trim()))));

  const enTipo = tipo !== 'todas';
  const buscando = busca.trim() !== '';
  /** La portada de tarjetas por tipo: sin tipo elegido ni búsqueda. */
  const portada = !enTipo && !buscando;
  const delTipo = enTipo ? todas.filter(a => a.tipo === tipo) : [];
  const modalidadesDelTipo = MODALIDADES_EF.filter(m => delTipo.some(a => a.modalidad === m.id));

  function volver() {
    setTipo('todas');
    setModalidad('todas');
    setOrigen('todas');
    setBusca('');
  }

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
    material: '', variantes: '', inclusion: '', origen: 'propia', ...(modalidad !== 'todas' ? { modalidad } : {}),
  });

  /* ── La IA ── */
  const claseIa = classes.find(c => c.id === ia?.claseId);
  const limitacionesDe = (c: Class | undefined) =>
    (c ? alumnadoParaIA(ef, students.filter(s => s.class_id === c.id).map(s => s.id), isoDate()) : []);
  const limitacionesHoy = limitacionesDe(claseIa);
  const hayInventario = ef.material.length > 0 || ef.instalaciones.length > 0;
  const cursoDe = (c: Class | undefined) => (c?.etapa && c.curso ? nombreCurso({ etapa: c.etapa, curso: c.curso }) : undefined);

  async function proponer() {
    if (!ia) return;
    setPensando(true);
    const r = await proponerActividades({
      tipo: ia.tipo,
      modalidad: ia.modalidad || undefined,
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

  /* ── Desde una foto ── */
  const claseFoto = classes.find(c => c.id === foto?.claseId);
  const limitacionesFoto = limitacionesDe(claseFoto);
  const edadFoto = claseFoto?.etapa && claseFoto.curso ? edadAproximada(claseFoto.etapa, claseFoto.curso) : undefined;
  const vistaFoto = foto?.archivo ? `data:${foto.archivo.mimeType};base64,${foto.archivo.base64}` : '';

  async function elegirFoto(files: FileList | null) {
    const f = files?.[0];
    if (archivoFoto.current) archivoFoto.current.value = '';
    if (!f || !foto) return;
    try {
      const archivo = await fotoParaIA(f);
      setFoto(x => (x ? { ...x, archivo } : x));
      setDeFoto(null);
    } catch {
      toast(t('«{nombre}» no es una imagen que se pueda usar.', { nombre: f.name }));
    }
  }

  async function reconocer() {
    if (!foto?.archivo) return;
    setPensando(true);
    const r = await actividadDesdeFoto({
      curso: cursoDe(claseFoto) ?? claseFoto?.name,
      etapa: claseFoto?.etapa,
      edad: edadFoto ? `${edadFoto.desde} a ${edadFoto.hasta} años` : undefined,
      nota: foto.nota,
      limitaciones: foto.limitaciones ? limitacionesFoto : [],
      conInventario: foto.inventario,
    }, foto.archivo, ef, comunidad, lang, { onError: m => toast(t(m)) });
    setPensando(false);
    if (r) setDeFoto({ visto: r.visto, actividad: r.actividad ? { ...r.actividad, id: nuevoIdEF('act') } : null });
  }

  function guardarDeFoto(a: ActividadEF) {
    onChangeEf(d => ({ ...d, actividades: [a, ...d.actividades] }));
    setDeFoto(x => (x ? { ...x, actividad: null } : x));
    setFoto(null);
    toast(t('Guardada en tus actividades.'));
  }

  /* ── Desde un manual en PDF ── */
  const claseManual = classes.find(c => c.id === manual?.claseId);
  const edadManual = claseManual?.etapa && claseManual.curso ? edadAproximada(claseManual.etapa, claseManual.curso) : undefined;

  async function elegirManual(files: FileList | null) {
    const f = files?.[0];
    if (archivoManual.current) archivoManual.current.value = '';
    if (!f || !manual) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { toast(t('«{nombre}» no es un PDF.', { nombre: f.name })); return; }
    if (f.size > MAX_MANUAL_BYTES) { toast(t('El archivo supera el límite de 19 MB')); return; }
    try {
      const archivo = await fileToBase64(f);
      setManual(x => (x ? { ...x, archivo: { ...archivo, mimeType: 'application/pdf' } } : x));
      setDelManual(null);
    } catch {
      toast(t('No se pudo leer el archivo'));
    }
  }

  async function leerManual() {
    if (!manual?.archivo) return;
    setPensando(true);
    const r = await actividadesDesdeManual({
      curso: cursoDe(claseManual) ?? claseManual?.name,
      etapa: claseManual?.etapa,
      edad: edadManual ? `${edadManual.desde} a ${edadManual.hasta} años` : undefined,
      paginas: manual.paginas,
      nota: manual.nota,
      yaTiene: todas.map(a => a.titulo),
    }, manual.archivo, comunidad, lang, { onError: m => toast(t(m)) });
    setPensando(false);
    if (!r) return;
    const actividades = r.map(a => ({ ...a, id: nuevoIdEF('act') }));
    const tiene = new Set(todas.map(a => norm(a.titulo.trim())));
    setDelManual({ actividades, elegidas: actividades.filter(a => !tiene.has(norm(a.titulo))).map(a => a.id) });
  }

  function guardarDelManual() {
    if (!delManual) return;
    const elegidas = delManual.actividades.filter(a => delManual.elegidas.includes(a.id));
    if (!elegidas.length) { toast(t('Elige al menos una actividad.')); return; }
    onChangeEf(d => ({ ...d, actividades: [...elegidas, ...d.actividades] }));
    setDelManual(null);
    setManual(null);
    toast(t('{n} actividades guardadas en las tuyas.', { n: elegidas.length }));
  }

  const ficha = (a: ActividadEF, acciones: React.ReactNode) => (
    <details key={a.id} className="ef-act">
      <summary>
        <span className="ef-act-ttl">{a.titulo}</span>
        <span className="ef-act-chips">
          <span className="sda-chip">{t(TIPOS_ACTIVIDAD.find(x => x.id === a.tipo)!.label)}</span>
          {a.modalidad && <span className="sda-chip ef-modalidad">{t(MODALIDADES_EF.find(m => m.id === a.modalidad)!.label)}</span>}
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

  if (deporte) {
    const actividadDe = (codigo: string): ActividadGuia | undefined =>
      deporte.especificas.find(e => e.codigo === codigo) ?? TRANSVERSALES.find(x => x.codigo === codigo);
    return (
      <section className="sec active ap-page">
        <div className="pg-hd">
          <div>
            <h1 className="pg-title">{textoDe(deporte.nombre, lang)}</h1>
            <p className="pg-sub">{textoDe(deporte.rasgos, lang)}</p>
          </div>
          <button className="btn-ghost" onClick={() => setDeporte(null)}><ArrowLeft size={15} />{t('Volver a Deportes')}</button>
        </div>
        <div className="ef-alt-sesiones">
          {deporte.sesiones.map((s, i) => (
            <div key={i} className="card">
              <div className="home-card-ttl">{t('Sesión {n}', { n: i + 1 })} · {textoDe(s.titulo, lang)}</div>
              <div className="ef-alt-acts">
                {s.actividades.map(codigo => {
                  const a = actividadDe(codigo);
                  if (!a) return null;
                  return (
                    <div key={codigo} className="ef-alt-act">
                      <span className="ef-alt-cod">{codigo}</span>
                      <div>
                        <strong>{textoDe(a.titulo, lang)}</strong>
                        <p className="ap-sub"><em>{t('Objetivo')}:</em> {textoDe(a.objetivo, lang)}</p>
                        <p>{textoDe(a.desarrollo, lang)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Actividades')}</h1>
          <p className="pg-sub">{t('El banco de partida de AulaPro, las tuyas y las que guardes de la IA. Cada una dice cómo participa quien tiene una limitación, según el DUA-A.')}</p>
        </div>
        <div className="ap-prog-acc">
          <button className="btn-ghost" onClick={() => { setDelManual(null); setManual({ claseId: classes[0]?.id ?? '', paginas: '', nota: '', archivo: null }); }}
            disabled={!hasApiKey()} title={hasApiKey() ? undefined : t('Configura tu clave API gratuita de Google en Configuración para usar la IA.')}>
            <FileText size={15} />{t('Desde un manual (PDF)')}
          </button>
          <button className="btn-ghost" onClick={() => { setDeFoto(null); setFoto({ claseId: classes[0]?.id ?? '', nota: '', inventario: hayInventario, limitaciones: true, archivo: null }); }}
            disabled={!hasApiKey()} title={hasApiKey() ? undefined : t('Configura tu clave API gratuita de Google en Configuración para usar la IA.')}>
            <Camera size={15} />{t('Desde una foto')}
          </button>
          <button className="btn-ghost" onClick={() => { setPropuestas([]); setIa({ tipo: tipo === 'todas' ? 'juego' : tipo, modalidad: modalidad === 'todas' ? '' : modalidad, claseId: classes[0]?.id ?? '', tema: '', inventario: hayInventario, limitaciones: true }); }}
            disabled={!hasApiKey()} title={hasApiKey() ? undefined : t('Configura tu clave API gratuita de Google en Configuración para usar la IA.')}>
            <Sparkles size={15} />{t('Proponer con IA')}
          </button>
          <button className="btn-accent" onClick={() => setEditando(vacia())}><Plus size={15} />{t('Nueva actividad')}</button>
        </div>
      </div>

      <div className="ef-act-barra">
        {enTipo && <button type="button" className="btn-ghost" onClick={volver}><ArrowLeft size={15} />{t('Todas las actividades')}</button>}
        <label className="ef-busca">
          <Search size={15} aria-hidden="true" />
          <input className="finput" type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder={t('Buscar en todas las actividades')} aria-label={t('Buscar actividades')} />
        </label>
        {!portada && (
          <select className="finput" value={origen} onChange={e => setOrigen(e.target.value as Origen)} aria-label={t('De dónde salen')}>
            <option value="todas">{t('Todas')}</option>
            <option value="banco">{t('Del banco')}</option>
            <option value="propia">{t('Tuyas')}</option>
            <option value="ia">{t('De la IA')}</option>
          </select>
        )}
      </div>

      {portada && (
        <div className="ef-tipos">
          {TIPOS_ACTIVIDAD.map(x => {
            const c = TARJETA_TIPO[x.id];
            const lista = todas.filter(a => a.tipo === x.id);
            const cuenta = (o: ActividadEF['origen']) => lista.filter(a => a.origen === o).length;
            return (
              <button key={x.id} type="button" className="ev-card ef-tipo" style={{ '--ev-c': c.color } as React.CSSProperties} onClick={() => setTipo(x.id)}>
                <span className="ev-card-ico">{c.icono}</span>
                <span className="ev-card-ttl">{t(x.label)}</span>
                <span className="ev-card-txt">{t(c.texto)}</span>
                <span className="ef-tipo-ej">{lista.slice(0, 3).map(a => a.titulo).join(' · ')}{lista.length > 3 ? '…' : ''}</span>
                <span className="ev-card-ft">
                  <span className="ev-card-dato">
                    {t('{n} actividades', { n: lista.length })}
                    {(cuenta('propia') > 0 || cuenta('ia') > 0) && ` · ${t('Tuyas')} ${cuenta('propia') + cuenta('ia')}`}
                  </span>
                  <span className="ev-card-go">{t('Abrir')}<ArrowRight size={15} /></span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!portada && (
        <>
          {enTipo && (
            <div className="ef-tipo-hd" style={{ '--ev-c': TARJETA_TIPO[tipo].color } as React.CSSProperties}>
              <span className="ev-card-ico">{TARJETA_TIPO[tipo].icono}</span>
              <div>
                <h2 className="ef-tipo-ttl">{t(TIPOS_ACTIVIDAD.find(x => x.id === tipo)!.label)}</h2>
                <p className="ap-sub" style={{ margin: 0 }}>{t(TARJETA_TIPO[tipo].texto)}</p>
              </div>
            </div>
          )}
          {enTipo && modalidadesDelTipo.length > 0 && (
            <div className="chip-row ap-alumnos" role="radiogroup" aria-label={t('Modalidad')}>
              <button type="button" role="radio" aria-checked={modalidad === 'todas'} className={`chip sm${modalidad === 'todas' ? ' on' : ''}`} onClick={() => setModalidad('todas')}>{t('Todas las modalidades')}</button>
              {modalidadesDelTipo.map(m => (
                <button key={m.id} type="button" role="radio" aria-checked={modalidad === m.id} className={`chip sm${modalidad === m.id ? ' on' : ''}`} onClick={() => setModalidad(m.id)}>{t(m.label)}</button>
              ))}
            </div>
          )}
          {enTipo && modalidad !== 'todas' && (() => {
            const m = MODALIDADES_EF.find(x => x.id === modalidad)!;
            return (
              <div className="card ef-modalidad-info">
                <div className="home-card-ttl">{t(m.label)}</div>
                <p><strong>{t('Lógica')}:</strong> {t(m.logica)}</p>
                <p><strong>{t('Preparación')}:</strong> {t(m.preparacion)}</p>
              </div>
            );
          })()}

          {visibles.length === 0
            ? <div className="card"><p className="ap-vacio">{t('No hay actividades con estos filtros.')}</p></div>
            : (
              <div className="ef-act-grid">
                {visibles.map(a => (
                  <button key={a.id} type="button" className="ef-act-card" style={{ '--ev-c': TARJETA_TIPO[a.tipo].color } as React.CSSProperties} onClick={() => { const d = deporteAlternativoDe(a.id); if (d) setDeporte(d); else setLeyendo(a); }}>
                    <span className="ef-act-card-ttl">{a.titulo}</span>
                    <span className="ef-act-chips">
                      {!enTipo && <span className="sda-chip">{t(TIPOS_ACTIVIDAD.find(x => x.id === a.tipo)!.label)}</span>}
                      {a.modalidad && <span className="sda-chip ef-modalidad">{t(MODALIDADES_EF.find(m => m.id === a.modalidad)!.label)}</span>}
                      {a.origen !== 'banco' && <span className={`sda-chip ef-origen-${a.origen}`}>{t(ORIGEN[a.origen])}</span>}
                    </span>
                    <span className="ef-act-card-txt">{a.descripcion}</span>
                  </button>
                ))}
              </div>
            )}
          <p className="ap-sub" style={{ marginTop: 10 }}>{t('{n} actividades', { n: visibles.length })}</p>
        </>
      )}

      <Modal open={!!leyendo} onClose={() => setLeyendo(null)} wide title={leyendo?.titulo}>
        {leyendo && (
          <div className="ef-act-ficha">
            <span className="ef-act-chips">
              <span className="sda-chip">{t(TIPOS_ACTIVIDAD.find(x => x.id === leyendo.tipo)!.label)}</span>
              {leyendo.modalidad && <span className="sda-chip ef-modalidad">{t(MODALIDADES_EF.find(m => m.id === leyendo.modalidad)!.label)}</span>}
              {leyendo.origen !== 'banco' && <span className={`sda-chip ef-origen-${leyendo.origen}`}>{t(ORIGEN[leyendo.origen])}</span>}
            </span>
            <dl className="ef-act-campos">
              {CAMPOS.filter(c => leyendo[c.id].trim()).map(c => (
                <div key={c.id}><dt>{t(c.label)}</dt><dd>{leyendo[c.id]}</dd></div>
              ))}
            </dl>
            <div className="ap-acciones">
              {leyendo.origen === 'banco'
                ? <button className="btn-accent" onClick={() => { setEditando({ ...leyendo, id: nuevoIdEF('act'), origen: 'propia' }); setLeyendo(null); }}><Copy size={14} />{t('Copiar y adaptar')}</button>
                : (
                  <>
                    <button className="btn-accent" onClick={() => { setEditando(leyendo); setLeyendo(null); }}><Pencil size={14} />{t('Editar')}</button>
                    <button className="btn-ghost ap-borrar" onClick={() => { borrar(leyendo); setLeyendo(null); }}><Trash2 size={14} />{t('Borrar')}</button>
                  </>
                )}
              <button className="btn-ghost" onClick={() => setLeyendo(null)}>{t('Cerrar')}</button>
            </div>
          </div>
        )}
      </Modal>

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
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-a-modalidad">{t('Modalidad')}</label>
              <select id="ef-a-modalidad" className="finput" value={editando.modalidad ?? ''}
                onChange={e => setEditando(e.target.value
                  ? { ...editando, modalidad: e.target.value as ModalidadEF }
                  : (({ modalidad: _m, ...r }) => { void _m; return r; })(editando))}>
                <option value="">{t('Sin modalidad')}</option>
                {MODALIDADES_EF.map(m => <option key={m.id} value={m.id}>{t(m.label)}</option>)}
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
              <label className="flabel" htmlFor="ef-ia-modalidad">{t('Modalidad')}</label>
              <select id="ef-ia-modalidad" className="finput" value={ia.modalidad} onChange={e => setIa({ ...ia, modalidad: e.target.value as ModalidadEF | '' })}>
                <option value="">{t('Sin modalidad')}</option>
                {MODALIDADES_EF.map(m => <option key={m.id} value={m.id}>{t(m.label)}</option>)}
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
                {t('Que puedan participar quienes tienen hoy una limitación o medidas de nivel II o III en esta clase ({n})', { n: limitacionesHoy.length })}
              </label>
            )}
            <p className="ap-aviso" style={{ gridColumn: '1 / -1' }}>{t('A la IA solo le llega lo que no puede hacer cada alumno y su nivel de apoyo con lo que necesita, sin nombres, motivos ni diagnósticos.')}</p>
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

      <Modal open={!!manual} onClose={() => setManual(null)} wide title={t('Actividades desde un manual')}>
        {manual && (
          <div className="ap-form">
            <div className="fgroup ef-foto" style={{ gridColumn: '1 / -1' }}>
              <input ref={archivoManual} type="file" accept=".pdf,application/pdf" hidden aria-label={t('Manual en PDF')} onChange={e => elegirManual(e.target.files)} />
              <button type="button" className="ef-foto-vacia" onClick={() => archivoManual.current?.click()}>
                <FileText size={30} aria-hidden="true" /><span>{manual.archivo ? manual.archivo.name : t('Elige el PDF del manual')}</span>
              </button>
              <div className="ef-foto-txt">
                <p className="ap-sub">{t('El manual de un libro, de tu departamento o de un curso. La IA saca las actividades prácticas, las clasifica por tipo y por modalidad, las redacta con sus palabras, para la edad de la clase, y añade cómo participa todo el grupo (DUA-A). Tú eliges cuáles guardas.')}</p>
                {manual.archivo && <button type="button" className="btn-ghost" onClick={() => archivoManual.current?.click()}><FileText size={14} />{t('Cambiar el PDF')}</button>}
              </div>
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-man-clase">{t('Clase')}</label>
              <select id="ef-man-clase" className="finput" value={manual.claseId} onChange={e => setManual({ ...manual, claseId: e.target.value })}>
                <option value="">{t('Sin clase concreta')}</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {edadManual && <span className="ap-sub">{t('{curso}: de {desde} a {hasta} años', { curso: cursoDe(claseManual) ?? '', desde: edadManual.desde, hasta: edadManual.hasta })}</span>}
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-man-pags">{t('Páginas (opcional)')}</label>
              <input id="ef-man-pags" className="finput" value={manual.paginas} placeholder={t('Ej: 20-45')}
                onChange={e => setManual({ ...manual, paginas: e.target.value })} />
            </div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-man-nota">{t('Algo que quieras que tenga en cuenta (opcional)')}</label>
              <input id="ef-man-nota" className="finput" value={manual.nota} placeholder={t('Ej: solo las de baloncesto, o las que valgan para el patio')}
                onChange={e => setManual({ ...manual, nota: e.target.value })} />
            </div>
            <p className="ap-aviso" style={{ gridColumn: '1 / -1' }}>{t('El PDF se envía a Google para que la IA lo lea y AulaPro no lo guarda. Saca como mucho {n} actividades cada vez: si el manual es largo, indica las páginas. No uses documentos con datos de tu alumnado.', { n: MAX_ACTIVIDADES_MANUAL })}</p>
            <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
              <button className="btn-accent" onClick={leerManual} disabled={pensando || !manual.archivo}>
                {pensando ? <span className="spin" /> : <Sparkles size={15} />}{pensando ? t('Leyendo el manual…') : t('Leer y clasificar')}
              </button>
              <button className="btn-ghost" onClick={() => setManual(null)}>{t('Cerrar')}</button>
            </div>
            {delManual && (
              <div className="ef-foto-res" style={{ gridColumn: '1 / -1' }}>
                {delManual.actividades.length === 0
                  ? <p className="ap-aviso" role="status">{t('En el PDF no se encontraron actividades prácticas de Educación Física. Prueba con otras páginas u otro manual.')}</p>
                  : (
                    <>
                      <p className="ef-foto-visto">
                        <strong>{t('Clasificadas')}:</strong>{' '}
                        {TIPOS_ACTIVIDAD.map(x => ({ x, n: delManual.actividades.filter(a => a.tipo === x.id).length })).filter(g => g.n > 0)
                          .map(g => `${t(g.x.label)} (${g.n})`).join(' · ')}
                      </p>
                      {TIPOS_ACTIVIDAD.map(x => {
                        const grupo = delManual.actividades.filter(a => a.tipo === x.id);
                        if (!grupo.length) return null;
                        return (
                          <div key={x.id} className="ef-manual-grupo">
                            <div className="home-card-ttl">{t(x.label)}</div>
                            {grupo.map(a => {
                              const tiene = todas.some(o => norm(o.titulo.trim()) === norm(a.titulo));
                              return (
                                <div key={a.id} className="ef-manual-fila">
                                  <input type="checkbox" aria-label={t('Guardar «{nombre}»', { nombre: a.titulo })} checked={delManual.elegidas.includes(a.id)}
                                    onChange={e => setDelManual(m => (m ? { ...m, elegidas: e.target.checked ? [...m.elegidas, a.id] : m.elegidas.filter(i => i !== a.id) } : m))} />
                                  <div className="ef-acts">{ficha(a, tiene ? <span className="ap-sub">{t('Ya tienes una con este título.')}</span> : null)}</div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                      <div className="ap-acciones">
                        <button className="btn-accent" onClick={guardarDelManual}><Save size={14} />{t('Guardar {n} en mis actividades', { n: delManual.elegidas.length })}</button>
                        <button className="btn-ghost" onClick={() => setDelManual(m => (m ? { ...m, elegidas: m.actividades.map(a => a.id) } : m))}>{t('Elegir todas')}</button>
                        <button className="btn-ghost" onClick={() => setDelManual(m => (m ? { ...m, elegidas: [] } : m))}>{t('Quitar todas')}</button>
                      </div>
                    </>
                  )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!foto} onClose={() => setFoto(null)} wide title={t('Actividad desde una foto')}>
        {foto && (
          <div className="ap-form">
            <div className="fgroup ef-foto" style={{ gridColumn: '1 / -1' }}>
              <input ref={archivoFoto} type="file" accept="image/*" hidden aria-label={t('Foto de la actividad')} onChange={e => elegirFoto(e.target.files)} />
              {vistaFoto
                ? <img className="ef-foto-img" src={vistaFoto} alt={t('La foto elegida')} />
                : (
                  <button type="button" className="ef-foto-vacia" onClick={() => archivoFoto.current?.click()}>
                    <ImagePlus size={30} aria-hidden="true" /><span>{t('Elige una foto o haz una')}</span>
                  </button>
                )}
              <div className="ef-foto-txt">
                <p className="ap-sub">{t('Un deporte, un juego, un circuito, un esquema dibujado o la página de un libro. La IA reconoce la actividad y la redacta para la edad de la clase.')}</p>
                {vistaFoto && <button type="button" className="btn-ghost" onClick={() => archivoFoto.current?.click()}><ImagePlus size={14} />{t('Cambiar la foto')}</button>}
              </div>
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-foto-clase">{t('Clase')}</label>
              <select id="ef-foto-clase" className="finput" value={foto.claseId} onChange={e => { setFoto({ ...foto, claseId: e.target.value }); setDeFoto(null); }}>
                <option value="">{t('Sin clase concreta')}</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {edadFoto && <span className="ap-sub">{t('{curso}: de {desde} a {hasta} años', { curso: cursoDe(claseFoto) ?? '', desde: edadFoto.desde, hasta: edadFoto.hasta })}</span>}
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-foto-nota">{t('Algo que quieras que tenga en cuenta (opcional)')}</label>
              <input id="ef-foto-nota" className="finput" value={foto.nota} placeholder={t('Ej: somos 24, en media pista')}
                onChange={e => setFoto({ ...foto, nota: e.target.value })} />
            </div>
            {hayInventario && (
              <label className="td-chk" style={{ gridColumn: '1 / -1' }}>
                <input type="checkbox" checked={foto.inventario} onChange={e => setFoto({ ...foto, inventario: e.target.checked })} />
                {t('Con mi material y mis instalaciones')}
              </label>
            )}
            {limitacionesFoto.length > 0 && (
              <label className="td-chk" style={{ gridColumn: '1 / -1' }}>
                <input type="checkbox" checked={foto.limitaciones} onChange={e => setFoto({ ...foto, limitaciones: e.target.checked })} />
                {t('Que puedan participar quienes tienen hoy una limitación o medidas de nivel II o III en esta clase ({n})', { n: limitacionesFoto.length })}
              </label>
            )}
            <p className="ap-aviso" style={{ gridColumn: '1 / -1' }}>{t('La foto se envía a Google para que la IA la vea, reducida y sin su ubicación, y AulaPro no la guarda. No uses fotos en las que se reconozca a tu alumnado.')}</p>
            <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
              <button className="btn-accent" onClick={reconocer} disabled={pensando || !foto.archivo}>
                {pensando ? <span className="spin" /> : <Sparkles size={15} />}{pensando ? t('Mirando la foto…') : t('Reconocer y redactar')}
              </button>
              <button className="btn-ghost" onClick={() => setFoto(null)}>{t('Cerrar')}</button>
            </div>
            {deFoto && (
              <div className="ef-foto-res" style={{ gridColumn: '1 / -1' }}>
                {deFoto.visto && <p className="ef-foto-visto"><strong>{t('Lo que ve la IA')}:</strong> {deFoto.visto}</p>}
                {deFoto.actividad
                  ? <div className="ef-acts">{ficha(deFoto.actividad, <button className="btn-accent" onClick={() => guardarDeFoto(deFoto.actividad!)}><Save size={14} />{t('Guardar en mis actividades')}</button>)}</div>
                  : <p className="ap-aviso" role="status">{t('En la foto no se ve una actividad física que se pueda hacer en clase. Prueba con otra.')}</p>}
              </div>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
