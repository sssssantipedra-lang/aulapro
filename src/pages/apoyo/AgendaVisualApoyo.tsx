/**
 * PT y AL, «Agenda visual»: secuencias con pictogramas o con fotos del propio
 * docente para anticipar una sesión, un día o una rutina (decisión del dueño,
 * 5-10-2026). Los pictogramas son de Mulberry Symbols (CC BY-SA 4.0) y van
 * dentro de la aplicación; las fotos se quedan en el equipo. Nada se envía a
 * ninguna parte. Se enseña a pantalla completa, paso a paso, y se imprime en
 * PDF con la atribución al pie. Ver `lib/pictos.ts` y `docs/PTAL.md`.
 */
import { useMemo, useRef, useState } from 'react';
import {
  Plus, Pencil, Trash2, Copy, Printer, Play, X, Check, ArrowLeft, ArrowRight, ImagePlus, Search, RotateCcw, Images,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useI18n } from '../../i18n';
import { nuevoIdApoyo } from '../../lib/apoyo';
import { buscarPictos, CATEGORIAS_PICTO, pictoDe, urlPicto, type CategoriaPicto } from '../../lib/pictos';
import { nombreDeArchivo, reducirFoto } from '../../lib/fotos';
import { guardarAgendaPdf } from '../../services/exportAgenda';
import type { AgendaVisual, ApoyoData, FotoApoyo, PasoAgenda } from '../../types/apoyo';

interface Props {
  data: ApoyoData;
  onChange: (f: (d: ApoyoData) => ApoyoData) => void;
}

/** Para empezar sin partir de cero: se copian y se cambian. Los textos son los nombres de los pictogramas. */
const PLANTILLAS: { titulo: string; pictos: string[] }[] = [
  { titulo: 'Mi sesión de apoyo', pictos: ['hello', 'sit', 'worksheet', 'play', 'tidy-2', 'class-room'] },
  { titulo: 'Rutina de entrada', pictos: ['hang-coat', 'wash-hands', 'circle-time', 'calendar'] },
  { titulo: 'Ir al baño', pictos: ['toilet-go', 'wash-hands', 'dry-hands', 'class-room'] },
];

export function AgendaVisualApoyo({ data, onChange }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [editando, setEditando] = useState<AgendaVisual | null>(null);
  const [mostrando, setMostrando] = useState<AgendaVisual | null>(null);
  const nombre = (id?: string) => data.alumnos.find(a => a.id === id)?.nombre;
  const imagen = (p: PasoAgenda) => (p.fotoId ? data.fotos.find(f => f.id === p.fotoId)?.datos : undefined) ?? (p.picto ? urlPicto(p.picto) : undefined);

  const guardarAgenda = (a: AgendaVisual) =>
    onChange(d => ({ ...d, agendas: d.agendas.some(x => x.id === a.id) ? d.agendas.map(x => (x.id === a.id ? a : x)) : [...d.agendas, a] }));

  function nueva(desde?: (typeof PLANTILLAS)[number]) {
    setEditando({
      id: nuevoIdApoyo('age'), titulo: desde ? t(desde.titulo) : '',
      pasos: (desde?.pictos ?? []).map(id => ({ id: nuevoIdApoyo('pas'), picto: id, texto: pictoDe(id)?.[lang] ?? '' })),
    });
  }

  function duplicar(a: AgendaVisual) {
    const copia = { ...a, id: nuevoIdApoyo('age'), titulo: `${a.titulo} (${t('copia')})`, pasos: a.pasos.map(p => ({ ...p, id: nuevoIdApoyo('pas') })) };
    guardarAgenda(copia);
    setEditando(copia);
  }

  function borrar(a: AgendaVisual) {
    if (!window.confirm(t('¿Eliminar la agenda «{titulo}»?', { titulo: a.titulo || t('Sin título') }))) return;
    onChange(d => ({ ...d, agendas: d.agendas.filter(x => x.id !== a.id) }));
  }

  async function imprimir(a: AgendaVisual) {
    const res = await guardarAgendaPdf(a, data.fotos, lang);
    if (res.error === 'not-desktop') toast(t('Guardar en PDF solo está disponible en la aplicación de escritorio.'));
    else if (res.error) toast(t('No se ha podido guardar el PDF.'));
  }

  if (editando) {
    return (
      <EditorAgenda
        agenda={editando} data={data} imagen={imagen}
        onCambiarFotos={f => onChange(d => f(d))}
        onGuardar={a => { guardarAgenda(a); setEditando(null); toast(t('✅ Guardado')); }}
        onCancelar={() => setEditando(null)}
      />
    );
  }

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Agenda visual')}</h1>
          <p className="pg-sub">{t('Secuencias con pictogramas o con tus fotos para anticipar la sesión, el día o una rutina. Se enseñan a pantalla completa y se imprimen.')}</p>
        </div>
        <button className="btn-accent" onClick={() => nueva()}><Plus size={15} />{t('Nueva agenda')}</button>
      </div>

      {data.agendas.length === 0 && (
        <div className="card">
          <p className="ap-vacio">{t('Todavía no tienes agendas. Empieza con una en blanco o a partir de una de estas:')}</p>
          <div className="chip-row" style={{ marginTop: 12 }}>
            {PLANTILLAS.map(p => (
              <button key={p.titulo} type="button" className="chip sm accent" onClick={() => nueva(p)}>{t(p.titulo)}</button>
            ))}
          </div>
        </div>
      )}

      <div className="ag-lista">
        {data.agendas.map(a => (
          <article key={a.id} className="card ag-card" aria-label={a.titulo || t('Sin título')}>
            <div className="ag-card-hd">
              <div style={{ minWidth: 0 }}>
                <strong>{a.titulo || t('Sin título')}</strong>
                <span className="ap-sub">{nombre(a.alumnoId) ?? t('Plantilla, sin alumno')} · {t(a.pasos.length === 1 ? '{n} paso' : '{n} pasos', { n: a.pasos.length })}</span>
              </div>
            </div>
            <div className="ag-mini" aria-hidden="true">
              {a.pasos.slice(0, 6).map(p => {
                const src = imagen(p);
                return src ? <img key={p.id} src={src} alt="" /> : <span key={p.id} className="ag-mini-txt">{p.texto}</span>;
              })}
              {a.pasos.length > 6 && <span className="ag-mini-mas">+{a.pasos.length - 6}</span>}
            </div>
            <div className="ag-card-acc">
              <button className="btn-accent" disabled={a.pasos.length === 0} onClick={() => setMostrando(a)}><Play size={14} />{t('Mostrar')}</button>
              <button className="ico-btn" onClick={() => setEditando(a)} aria-label={t('Editar')} title={t('Editar')}><Pencil size={15} /></button>
              <button className="ico-btn" onClick={() => imprimir(a)} aria-label={t('Guardar en PDF para imprimir')} title={t('Guardar en PDF para imprimir')}><Printer size={15} /></button>
              <button className="ico-btn" onClick={() => duplicar(a)} aria-label={t('Duplicar')} title={t('Duplicar')}><Copy size={15} /></button>
              <button className="ico-btn" onClick={() => borrar(a)} aria-label={t('Eliminar')} title={t('Eliminar')}><Trash2 size={15} /></button>
            </div>
          </article>
        ))}
      </div>

      {mostrando && <Mostrar agenda={mostrando} imagen={imagen} onCerrar={() => setMostrando(null)} />}
    </section>
  );
}

/* ── Editor ── */

function EditorAgenda({ agenda, data, imagen, onCambiarFotos, onGuardar, onCancelar }: {
  agenda: AgendaVisual;
  data: ApoyoData;
  imagen: (p: PasoAgenda) => string | undefined;
  onCambiarFotos: (f: (d: ApoyoData) => ApoyoData) => void;
  onGuardar: (a: AgendaVisual) => void;
  onCancelar: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [a, setA] = useState(agenda);
  const [eligiendo, setEligiendo] = useState(false);
  const alumnos = useMemo(() => [...data.alumnos].sort((x, y) => x.nombre.localeCompare(y.nombre)), [data.alumnos]);

  const mover = (i: number, d: number) => setA(x => {
    const pasos = [...x.pasos];
    const [p] = pasos.splice(i, 1);
    pasos.splice(i + d, 0, p);
    return { ...x, pasos };
  });
  const cambiarPaso = (id: string, f: (p: PasoAgenda) => PasoAgenda) => setA(x => ({ ...x, pasos: x.pasos.map(p => (p.id === id ? f(p) : p)) }));

  function guardar() {
    if (!a.titulo.trim()) { toast(t('Ponle un título a la agenda.')); return; }
    if (a.pasos.length === 0) { toast(t('Añade al menos un paso.')); return; }
    onGuardar({ ...a, titulo: a.titulo.trim() });
  }

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          <button type="button" className="btn-ghost" style={{ marginBottom: 10 }} onClick={onCancelar}><ArrowLeft size={14} />{t('Agenda visual')}</button>
          <h1 className="pg-title">{agenda.titulo ? t('Editar la agenda') : t('Nueva agenda')}</h1>
        </div>
      </div>

      <div className="card">
        <div className="ap-form">
          <div className="fgroup">
            <label className="flabel" htmlFor="ag-titulo">{t('Título')}</label>
            <input id="ag-titulo" className="finput" value={a.titulo} placeholder={t('Ej: Mi sesión de los lunes')}
              onChange={e => setA({ ...a, titulo: e.target.value })} />
          </div>
          <div className="fgroup">
            <label className="flabel" htmlFor="ag-alumno">{t('Para quién')}</label>
            <select id="ag-alumno" className="finput" value={a.alumnoId ?? ''}
              onChange={e => setA(e.target.value ? { ...a, alumnoId: e.target.value } : { id: a.id, titulo: a.titulo, pasos: a.pasos })}>
              <option value="">{t('Plantilla, sin alumno')}</option>
              {alumnos.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          </div>
        </div>

        <div className="ap-reg-sec" style={{ margin: '6px 0 10px' }}>{t('Pasos, en orden')}</div>
        <ol className="ag-pasos">
          {a.pasos.map((p, i) => {
            const src = imagen(p);
            return (
              <li key={p.id} className="ag-paso">
                <span className="ag-paso-n">{i + 1}</span>
                <div className="ag-paso-img">{src ? <img src={src} alt="" /> : <Images size={28} />}</div>
                <input className="finput" value={p.texto} aria-label={t('Texto del paso {n}', { n: i + 1 })}
                  onChange={e => cambiarPaso(p.id, x => ({ ...x, texto: e.target.value }))} />
                <div className="ag-paso-acc">
                  <button type="button" className="ico-btn" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={t('Antes')} title={t('Antes')}><ArrowLeft size={14} /></button>
                  <button type="button" className="ico-btn" disabled={i === a.pasos.length - 1} onClick={() => mover(i, 1)} aria-label={t('Después')} title={t('Después')}><ArrowRight size={14} /></button>
                  <button type="button" className="ico-btn" onClick={() => setA(x => ({ ...x, pasos: x.pasos.filter(y => y.id !== p.id) }))} aria-label={t('Quitar el paso')} title={t('Quitar')}><Trash2 size={14} /></button>
                </div>
              </li>
            );
          })}
          <li>
            <button type="button" className="ag-anadir" onClick={() => setEligiendo(true)}><Plus size={22} />{t('Añadir paso')}</button>
          </li>
        </ol>

        <div className="ap-acciones">
          <button className="btn-accent" onClick={guardar}>{t('Guardar')}</button>
          <button className="btn-ghost" onClick={onCancelar}>{t('Cancelar')}</button>
        </div>
      </div>

      <Selector
        open={eligiendo} fotos={data.fotos}
        onCerrar={() => setEligiendo(false)}
        onElegir={paso => setA(x => ({ ...x, pasos: [...x.pasos, { id: nuevoIdApoyo('pas'), ...paso }] }))}
        onCambiarFotos={onCambiarFotos}
        usadas={new Set(data.agendas.flatMap(x => x.pasos.map(p => p.fotoId)).concat(a.pasos.map(p => p.fotoId)).filter((x): x is string => !!x))}
      />
    </section>
  );
}

/* ── Elegir un pictograma o una foto ── */

function Selector({ open, fotos, usadas, onCerrar, onElegir, onCambiarFotos }: {
  open: boolean;
  fotos: FotoApoyo[];
  usadas: Set<string>;
  onCerrar: () => void;
  onElegir: (p: Omit<PasoAgenda, 'id'>) => void;
  onCambiarFotos: (f: (d: ApoyoData) => ApoyoData) => void;
}) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [pestana, setPestana] = useState<'pictos' | 'fotos'>('pictos');
  const [texto, setTexto] = useState('');
  const [cat, setCat] = useState<CategoriaPicto | undefined>('rutinas');
  const [anadidos, setAnadidos] = useState(0);
  const archivo = useRef<HTMLInputElement>(null);
  const resultado = useMemo(() => buscarPictos(texto, lang, texto.trim() ? undefined : cat), [texto, lang, cat]);

  const elegir = (p: Omit<PasoAgenda, 'id'>) => { onElegir(p); setAnadidos(n => n + 1); };
  const cerrar = () => { setAnadidos(0); setTexto(''); onCerrar(); };

  async function subir(files: FileList | null) {
    if (!files?.length) return;
    const nuevas: FotoApoyo[] = [];
    for (const f of Array.from(files)) {
      try {
        nuevas.push({ id: nuevoIdApoyo('fot'), nombre: nombreDeArchivo(f.name), datos: await reducirFoto(f) });
      } catch {
        toast(t('«{nombre}» no es una imagen que se pueda usar.', { nombre: f.name }));
      }
    }
    if (nuevas.length) onCambiarFotos(d => ({ ...d, fotos: [...d.fotos, ...nuevas] }));
    if (archivo.current) archivo.current.value = '';
  }

  function quitarFoto(f: FotoApoyo) {
    const aviso = usadas.has(f.id)
      ? t('Esta foto está en alguna agenda: esos pasos se quedarán sin imagen. ¿Quitarla?')
      : t('¿Quitar esta foto?');
    if (!window.confirm(aviso)) return;
    onCambiarFotos(d => ({
      ...d,
      fotos: d.fotos.filter(x => x.id !== f.id),
      agendas: d.agendas.map(a => ({ ...a, pasos: a.pasos.map(p => (p.fotoId === f.id ? { id: p.id, ...(p.picto ? { picto: p.picto } : {}), texto: p.texto } : p)) })),
    }));
  }

  return (
    <Modal open={open} onClose={cerrar} wide title={t('Añadir paso')}>
      <div className="tab-bar" role="tablist" style={{ width: 'fit-content', marginBottom: 14 }}>
        <button role="tab" aria-selected={pestana === 'pictos'} className={`tab-btn${pestana === 'pictos' ? ' active' : ''}`} onClick={() => setPestana('pictos')}>{t('Pictogramas')}</button>
        <button role="tab" aria-selected={pestana === 'fotos'} className={`tab-btn${pestana === 'fotos' ? ' active' : ''}`} onClick={() => setPestana('fotos')}>{t('Mis fotos')}</button>
      </div>

      {pestana === 'pictos' ? (
        <>
          <div className="ag-buscar">
            <Search size={15} aria-hidden="true" />
            <input className="finput" value={texto} onChange={e => setTexto(e.target.value)} placeholder={t('Buscar: lavarse, recreo, contento…')} aria-label={t('Buscar un pictograma')} />
          </div>
          {!texto.trim() && (
            <div className="chip-row" style={{ margin: '10px 0' }}>
              {CATEGORIAS_PICTO.map(c => (
                <button key={c.id} type="button" className={`chip sm accent${cat === c.id ? ' on' : ''}`} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c[lang]}</button>
              ))}
            </div>
          )}
          {resultado.length === 0
            ? <p className="ap-vacio" style={{ margin: '12px 0' }}>{t('No hay ningún pictograma con ese nombre. Prueba con otra palabra o usa una foto tuya.')}</p>
            : (
              <div className="ag-grid">
                {resultado.map(p => (
                  <button key={p.id} type="button" className="ag-op" onClick={() => elegir({ picto: p.id, texto: p[lang] })}>
                    <img src={urlPicto(p.id)} alt="" loading="lazy" />
                    <span>{p[lang]}</span>
                  </button>
                ))}
              </div>
            )}
        </>
      ) : (
        <>
          <p className="ap-aviso" style={{ marginBottom: 10 }}>{t('Tus fotos se guardan reducidas en este equipo, dentro de tu perfil, y no se envían a ninguna parte.')}</p>
          <input ref={archivo} type="file" accept="image/*" multiple hidden onChange={e => subir(e.target.files)} />
          <div className="ag-grid">
            <button type="button" className="ag-op ag-op-nueva" onClick={() => archivo.current?.click()}>
              <ImagePlus size={30} /><span>{t('Añadir una foto')}</span>
            </button>
            {fotos.map(f => (
              <div key={f.id} className="ag-op ag-op-foto">
                <button type="button" className="ag-op-foto-sel" onClick={() => elegir({ fotoId: f.id, texto: f.nombre })}>
                  <img src={f.datos} alt="" />
                  <span>{f.nombre || t('Sin nombre')}</span>
                </button>
                <button type="button" className="ico-btn ag-op-quitar" onClick={() => quitarFoto(f)} aria-label={t('Quitar la foto')} title={t('Quitar')}><X size={13} /></button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="ap-acciones">
        <button className="btn-accent" onClick={cerrar}><Check size={15} />{t('Listo')}</button>
        {anadidos > 0 && <span className="ap-sub" role="status">{t(anadidos === 1 ? '{n} paso añadido' : '{n} pasos añadidos', { n: anadidos })}</span>}
      </div>
    </Modal>
  );
}

/* ── Mostrar al alumno ── */

function Mostrar({ agenda, imagen, onCerrar }: { agenda: AgendaVisual; imagen: (p: PasoAgenda) => string | undefined; onCerrar: () => void }) {
  const { t } = useI18n();
  const [hechos, setHechos] = useState<Set<string>>(new Set());
  const actual = agenda.pasos.find(p => !hechos.has(p.id))?.id;
  const cambiar = (id: string) => setHechos(s => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <div className="ag-show" role="dialog" aria-modal="true" aria-label={agenda.titulo}>
      <div className="ag-show-hd">
        <h2>{agenda.titulo}</h2>
        <div className="ag-show-acc">
          <button type="button" className="btn-ghost" onClick={() => setHechos(new Set())}><RotateCcw size={15} />{t('Volver a empezar')}</button>
          <button type="button" className="btn-accent" onClick={onCerrar}><X size={15} />{t('Cerrar')}</button>
        </div>
      </div>
      <p className="ag-show-ayuda">{t('Toca cada paso cuando esté hecho.')}</p>
      <ol className="ag-show-pasos">
        {agenda.pasos.map(p => {
          const src = imagen(p);
          const hecho = hechos.has(p.id);
          return (
            <li key={p.id}>
              <button type="button" className={`ag-show-paso${hecho ? ' hecho' : ''}${p.id === actual ? ' ahora' : ''}`}
                aria-pressed={hecho} onClick={() => cambiar(p.id)}>
                {src ? <img src={src} alt="" /> : <span className="ag-show-sin" />}
                <span className="ag-show-txt">{p.texto}</span>
                {hecho && <span className="ag-show-check"><Check size={40} strokeWidth={3} /></span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
