/**
 * Evaluar por foto (petición del dueño, 18-10-2026, para el profesorado de
 * aula): se fotografía un examen o un trabajo, la IA propone los puntos de cada
 * pregunta y un comentario, el docente lo revisa y corrige y la nota pasa al
 * cuaderno. La suma y la nota las hace el código (`lib/evalFoto.ts`); a la IA
 * no le llega el nombre del alumno. Ver `docs/EVALUAR_FOTO.md`.
 */
import { useMemo, useRef, useState } from 'react';
import { useBorrador } from '../hooks/useBorrador';
import { AvisoBorrador } from '../components/AvisoBorrador';
import { Camera, ImagePlus, Sparkles, Trash2, Check, AlertTriangle, ClipboardCopy, UserRoundCheck, Lightbulb } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { AiKeyNotice } from '../components/ui/AiKeyNotice';
import { useI18n } from '../i18n';
import { useNombreCurso } from '../hooks/useNombreCurso';
import { compararAlumnos } from '../lib/alumnado';
import { calcularNota, cambiosDelDocente, ESTADOS_PREGUNTA, idColumnaFoto, leerPuntos, puntosValidos, type CorreccionFoto } from '../lib/evalFoto';
import { fotoParaIA, LADO_FOTO_EXAMEN } from '../lib/fotos';
import { requestSettingsPanel } from '../lib/settingsNav';
import { isoDate } from '../lib/utils';
import { hasApiKey, type InlineFile } from '../services/gemini';
import { corregirPorFoto, MAX_FOTOS_SOLUCIONES, MAX_FOTOS_TRABAJO, type TipoTrabajo } from '../services/evaluarFoto';
import type { Class, GradeCategory, GradeItem, Section, Student } from '../types';

interface Props {
  classes: Class[];
  students: Student[];
  gradeCategories: GradeCategory[];
  gradeItems: GradeItem[];
  onAddGradeItem: (i: GradeItem) => void;
  onSetGrade: (itemId: string, studentId: string, value: number | null) => void;
  onNav: (s: Section) => void;
}

const vista = (f: InlineFile) => `data:${f.mimeType};base64,${f.base64}`;

/** Lo que se autoguarda de una corrección a medias. Las fotos no: pesan demasiado y la corrección ya las ha leído. */
interface BorradorEvalFoto {
  claseId: string; asignatura: string; alumnoId: string; tipo: TipoTrabajo; total: string; nombre: string;
  categoriaId: string; criterios: string;
  correccion: CorreccionFoto; puntos: string[]; comentario: string; hechos: string[];
}

export function EvalFoto({ classes, students, gradeCategories, gradeItems, onAddGradeItem, onSetGrade, onNav }: Props) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const nombreCurso = useNombreCurso();
  const [claseId, setClaseId] = useState(classes[0]?.id ?? '');
  const [asignatura, setAsignatura] = useState('');
  const [alumnoId, setAlumnoId] = useState('');
  const [tipo, setTipo] = useState<TipoTrabajo>('examen');
  const [total, setTotal] = useState('10');
  const [nombre, setNombre] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [criterios, setCriterios] = useState('');
  const [fotos, setFotos] = useState<InlineFile[]>([]);
  const [soluciones, setSoluciones] = useState<InlineFile[]>([]);
  const [pensando, setPensando] = useState(false);
  const [correccion, setCorreccion] = useState<CorreccionFoto | null>(null);
  const [puntos, setPuntos] = useState<string[]>([]);
  const [comentario, setComentario] = useState('');
  /** Los alumnos de esta clase que ya tienen su nota guardada en esta sesión. */
  const [hechos, setHechos] = useState<string[]>([]);
  const archivoTrabajo = useRef<HTMLInputElement>(null);
  const archivoSoluciones = useRef<HTMLInputElement>(null);

  const clase = classes.find(c => c.id === claseId);
  const asignaturas = clase?.subjects?.length ? clase.subjects : clase ? [clase.subject] : [];
  const asig = asignatura && asignaturas.includes(asignatura) ? asignatura : asignaturas[0] ?? '';
  const categorias = gradeCategories.filter(c => c.class_id === claseId && (c.subject ?? asignaturas[0] ?? '') === asig);
  const categoria = categorias.find(c => c.id === categoriaId) ?? categorias[0];
  const alumnos = useMemo(() => students.filter(s => s.class_id === claseId).sort(compararAlumnos), [students, claseId]);
  const alumno = alumnos.find(a => a.id === alumnoId);
  const totalNum = leerPuntos(total) ?? 0;

  // La nota sale de los puntos que quedan en cada pregunta, no de lo que diga la IA
  const preguntas = correccion?.preguntas.map((p, i) => ({ ...p, puntos: puntosValidos(leerPuntos(puntos[i] ?? '') ?? 0, p.puntosMax) })) ?? [];
  const resultado = calcularNota(preguntas);
  const cambios = correccion ? cambiosDelDocente(correccion.preguntas, preguntas) : 0;
  const fmt = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 2 });
  const sinClave = !hasApiKey();

  async function anadir(files: FileList | null, aQuien: 'trabajo' | 'soluciones') {
    const lista = [...(files ?? [])];
    if (aQuien === 'trabajo' && archivoTrabajo.current) archivoTrabajo.current.value = '';
    if (aQuien === 'soluciones' && archivoSoluciones.current) archivoSoluciones.current.value = '';
    if (!lista.length) return;
    const actuales = aQuien === 'trabajo' ? fotos : soluciones;
    const tope = aQuien === 'trabajo' ? MAX_FOTOS_TRABAJO : MAX_FOTOS_SOLUCIONES;
    if (actuales.length + lista.length > tope) toast(t('Como mucho {n} fotos. Se añaden las primeras.', { n: tope }));
    try {
      const nuevas = await Promise.all(lista.slice(0, Math.max(0, tope - actuales.length)).map(f => fotoParaIA(f, LADO_FOTO_EXAMEN)));
      (aQuien === 'trabajo' ? setFotos : setSoluciones)(x => [...x, ...nuevas].slice(0, tope));
      setCorreccion(null);
    } catch {
      toast(t('Alguno de esos archivos no es una imagen que se pueda usar.'));
    }
  }

  async function corregir() {
    if (!fotos.length) { toast(t('Añade al menos una foto del examen o del trabajo.')); return; }
    setPensando(true);
    const r = await corregirPorFoto({
      tipo, total: totalNum,
      contexto: [asig, clase?.etapa && clase.curso ? nombreCurso({ etapa: clase.etapa, curso: clase.curso }) : ''].filter(Boolean).join(', '),
      criterios,
    }, fotos, soluciones, { onError: m => toast(t(m)) });
    setPensando(false);
    if (!r) return;
    setCorreccion(r);
    setPuntos(r.preguntas.map(p => String(p.puntos)));
    setComentario(r.comentarioGeneral);
    if (!nombre.trim() && r.titulo) setNombre(r.titulo);
  }

  function guardar() {
    if (!clase || !alumno) { toast(t('Elige el alumno al que corresponde.')); return; }
    if (!categoria) { toast(t('Elige la categoría del cuaderno donde va la nota.')); return; }
    if (resultado.nota === null) return;
    const columna = nombre.trim() || (tipo === 'examen' ? t('Examen') : t('Trabajo'));
    // Si esa columna ya existe en la categoría (otro alumno del mismo examen), se usa; si no, se crea
    const existente = gradeItems.find(i => i.class_id === clase.id && i.category_id === categoria.id && i.name === columna);
    const item = existente ?? { id: idColumnaFoto(), class_id: clase.id, category_id: categoria.id, name: columna, date: isoDate() };
    if (!existente) onAddGradeItem(item);
    onSetGrade(item.id, alumno.id, resultado.nota);
    setHechos(h => [...new Set([...h, alumno.id])]);
    toast(t('✅ Nota guardada en el cuaderno: {nota} en «{columna}».', { nota: fmt(resultado.nota), columna }));
  }

  /** Para el siguiente alumno de la lista: mismas opciones y criterios, fotos y corrección vacías. */
  function siguiente() {
    const i = alumnos.findIndex(a => a.id === alumnoId);
    const sig = alumnos.slice(i + 1).find(a => !hechos.includes(a.id)) ?? alumnos.find(a => !hechos.includes(a.id) && a.id !== alumnoId);
    setAlumnoId(sig?.id ?? '');
    setFotos([]);
    setCorreccion(null);
    setPuntos([]);
    setComentario('');
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(comentario);
      toast(t('Comentario copiado.'));
    } catch {
      toast(t('No se pudo copiar el comentario.'));
    }
  }

  const guardadoYa = !!alumno && hechos.includes(alumno.id);

  /* Autoguardado: una corrección hecha por la IA y aún sin guardar en el cuaderno se conserva */
  const pendiente = useMemo<BorradorEvalFoto | null>(() => (correccion && !(alumnoId && hechos.includes(alumnoId)) ? {
    claseId, asignatura, alumnoId, tipo, total, nombre, categoriaId, criterios, correccion, puntos, comentario, hechos,
  } : null), [correccion, claseId, asignatura, alumnoId, tipo, total, nombre, categoriaId, criterios, puntos, comentario, hechos]);
  const borrador = useBorrador<BorradorEvalFoto>('evaluacion-foto', pendiente, `${alumno ? `${alumno.name}: ` : ''}${nombre || correccion?.titulo || ''}`.trim());
  function continuarBorrador() {
    const b = borrador.continuar();
    if (!b) return;
    // Solo si la clase sigue existiendo
    if (classes.some(c => c.id === b.claseId)) setClaseId(b.claseId);
    setAsignatura(b.asignatura); setAlumnoId(b.alumnoId); setTipo(b.tipo); setTotal(b.total); setNombre(b.nombre);
    setCategoriaId(b.categoriaId); setCriterios(b.criterios);
    setCorreccion(b.correccion); setPuntos(b.puntos); setComentario(b.comentario); setHechos(b.hechos);
    setFotos([]); setSoluciones([]);
  }

  if (!classes.length) {
    return (
      <section className="sec active ap-page">
        <div className="pg-hd"><div><h1 className="pg-title">{t('Evaluar por foto')}</h1></div></div>
        <div className="card">
          <p className="ap-vacio">{t('Para evaluar por foto, crea primero tus clases con su alumnado.')}</p>
          <button className="btn-accent" style={{ marginTop: 12 }} onClick={() => onNav('classes')}>{t('Ir a Mis Clases')}</button>
        </div>
      </section>
    );
  }

  const miniaturas = (lista: InlineFile[], quitar: (i: number) => void, etiqueta: string) => (
    <ul className="evf-fotos">
      {lista.map((f, i) => (
        <li key={i} className="evf-foto">
          <img src={vista(f)} alt={t('{etiqueta} {n}', { etiqueta, n: i + 1 })} />
          <button type="button" className="ico-btn" aria-label={t('Quitar la foto {n}', { n: i + 1 })} onClick={() => { quitar(i); setCorreccion(null); }}><Trash2 size={14} /></button>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Evaluar por foto')}</h1>
          <p className="pg-sub">{t('Haz una foto del examen o del trabajo: la IA propone los puntos de cada pregunta y un comentario, tú lo revisas y la nota va al cuaderno.')}</p>
        </div>
      </div>

      {sinClave && (
        <AiKeyNotice message={t('Para corregir por foto hace falta la clave gratuita de Google que se configura en Configuración.')} action={t('Configurar la IA')} onAction={() => { requestSettingsPanel('ia'); onNav('profile'); }} />
      )}

      {borrador.encontrado && (
        <AvisoBorrador borrador={borrador.encontrado} queEra={t('una corrección')} nota={t('Las fotos no se guardan.')} onContinuar={continuarBorrador} onDescartar={borrador.descartar} />
      )}

      <div className="card">
        <div className="home-card-ttl">{t('1. Qué vas a corregir')}</div>
        <div className="ap-form" style={{ marginTop: 10 }}>
          <div className="fgroup">
            <label className="flabel" htmlFor="evf-clase">{t('Clase')}</label>
            <select id="evf-clase" className="finput" value={claseId} onChange={e => { setClaseId(e.target.value); setAlumnoId(''); setCategoriaId(''); setAsignatura(''); setHechos([]); setCorreccion(null); }}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {asignaturas.length > 1 && (
            <div className="fgroup">
              <label className="flabel" htmlFor="evf-asig">{t('Asignatura')}</label>
              <select id="evf-asig" className="finput" value={asig} onChange={e => { setAsignatura(e.target.value); setCategoriaId(''); }}>
                {asignaturas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}
          <div className="fgroup">
            <label className="flabel" htmlFor="evf-alumno">{t('Alumno')}</label>
            <select id="evf-alumno" className="finput" value={alumnoId} onChange={e => setAlumnoId(e.target.value)}>
              <option value="">{t('Elige el alumno')}</option>
              {alumnos.map(a => <option key={a.id} value={a.id}>{hechos.includes(a.id) ? '✓ ' : ''}{a.name}</option>)}
            </select>
          </div>
          <div className="fgroup">
            <label className="flabel" htmlFor="evf-tipo">{t('Es un')}</label>
            <select id="evf-tipo" className="finput" value={tipo} onChange={e => { setTipo(e.target.value as TipoTrabajo); setCorreccion(null); }}>
              <option value="examen">{t('Examen')}</option>
              <option value="trabajo">{t('Trabajo')}</option>
            </select>
          </div>
          <div className="fgroup">
            <label className="flabel" htmlFor="evf-total">{t('Puntos en total (opcional)')}</label>
            <input id="evf-total" className="finput" inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} />
          </div>
          <div className="fgroup">
            <label className="flabel" htmlFor="evf-nombre">{t('Nombre en el cuaderno')}</label>
            <input id="evf-nombre" className="finput" value={nombre} placeholder={tipo === 'examen' ? t('Ej: Examen de fracciones') : t('Ej: Trabajo del otoño')} onChange={e => setNombre(e.target.value)} />
          </div>
          <div className="fgroup">
            <label className="flabel" htmlFor="evf-cat">{t('Categoría del cuaderno')}</label>
            {categorias.length === 0
              ? <p className="ap-aviso">{t('Esta asignatura todavía no tiene categorías en el cuaderno. Crea una (Exámenes, Trabajos…) y vuelve aquí.')}</p>
              : (
                <select id="evf-cat" className="finput" value={categoria?.id ?? ''} onChange={e => setCategoriaId(e.target.value)}>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.name} ({c.weight}%)</option>)}
                </select>
              )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="home-card-ttl">{t('2. Las fotos')}</div>
        <p className="ap-sub" style={{ margin: '4px 0 10px' }}>{t('Una por página, de cerca, con buena luz y sin sombras. Mejor tapar el nombre del alumno: a la IA no le hace falta.')}</p>
        <input ref={archivoTrabajo} type="file" accept="image/*" multiple hidden aria-label={t('Fotos del examen o del trabajo')} onChange={e => void anadir(e.target.files, 'trabajo')} />
        {miniaturas(fotos, i => setFotos(x => x.filter((_, j) => j !== i)), t('Página'))}
        <button type="button" className="btn-ghost" onClick={() => archivoTrabajo.current?.click()} disabled={fotos.length >= MAX_FOTOS_TRABAJO}>
          <Camera size={15} />{fotos.length ? t('Añadir otra página') : t('Hacer o elegir fotos')}
        </button>
      </div>

      <div className="card">
        <div className="home-card-ttl"><Lightbulb size={14} aria-hidden="true" /> {t('3. Soluciones o criterios (opcional)')}</div>
        <p className="ap-sub" style={{ margin: '4px 0 10px' }}>{t('Con la hoja de soluciones o con tus criterios, corrige como tú. Sin ellos, la IA corrige con su propio criterio y conviene mirarlo con más cuidado.')}</p>
        <label className="flabel" htmlFor="evf-crit">{t('Soluciones y criterios, escritos')}</label>
        <textarea id="evf-crit" className="finput" rows={3} value={criterios} placeholder={t('Ej: 1) 3/4. 2) 5/6. Cada error de cálculo resta 0,25.')} onChange={e => { setCriterios(e.target.value); setCorreccion(null); }} />
        <input ref={archivoSoluciones} type="file" accept="image/*" multiple hidden aria-label={t('Fotos de la hoja de soluciones')} onChange={e => void anadir(e.target.files, 'soluciones')} />
        <div style={{ marginTop: 10 }}>
          {miniaturas(soluciones, i => setSoluciones(x => x.filter((_, j) => j !== i)), t('Solución'))}
          <button type="button" className="btn-ghost" onClick={() => archivoSoluciones.current?.click()} disabled={soluciones.length >= MAX_FOTOS_SOLUCIONES}>
            <ImagePlus size={15} />{t('Foto de la hoja de soluciones')}
          </button>
        </div>
      </div>

      <p className="ap-aviso">{t('Las fotos se envían a Google para que la IA las lea, reducidas y sin su ubicación, y AulaPro no las guarda. A la IA no le llega el nombre del alumno: elígelo aquí, en la app.')}</p>
      <div className="ap-acciones" style={{ marginBottom: 16 }}>
        <button className="btn-accent" onClick={corregir} disabled={pensando || sinClave || !fotos.length}>
          {pensando ? <span className="spin" /> : <Sparkles size={15} />}{pensando ? t('Corrigiendo…') : t('Corregir con IA')}
        </button>
      </div>

      {correccion && (
        <div className="card evf-res" aria-live="polite">
          <div className="evf-nota">
            <div>
              <div className="home-card-ttl">{correccion.titulo || t('Corrección')}</div>
              <p className="ap-sub" style={{ margin: 0 }}>
                {t('{p} de {m} puntos', { p: fmt(resultado.puntos), m: fmt(resultado.max) })}
                {cambios > 0 && ` · ${t(cambios === 1 ? 'has cambiado {n} pregunta' : 'has cambiado {n} preguntas', { n: cambios })}`}
              </p>
            </div>
            <div className="evf-nota-num" aria-label={t('Nota')}>{resultado.nota === null ? '–' : fmt(resultado.nota)}<small>/10</small></div>
          </div>

          {correccion.avisos.length > 0 && (
            <div className="ap-aviso" role="status">
              <AlertTriangle size={14} aria-hidden="true" /> {correccion.avisos.join(' ')}
            </div>
          )}

          <div className="evf-preguntas">
            {correccion.preguntas.map((p, i) => (
              <div key={i} className={`evf-pregunta${p.dudosa ? ' dudosa' : ''}`}>
                <div className="evf-p-hd">
                  <strong>{p.n}</strong>
                  <span className="evf-p-enun">{p.enunciado}</span>
                  <span className={`sda-chip evf-estado-${p.estado}`}>{t(ESTADOS_PREGUNTA.find(e => e.id === p.estado)!.label)}</span>
                  {p.dudosa && <span className="evf-revisar"><AlertTriangle size={12} aria-hidden="true" />{t('Revísala')}</span>}
                  <label className="evf-puntos">
                    <input className="finput" inputMode="decimal" value={puntos[i] ?? ''} aria-label={t('Puntos de la pregunta {n}', { n: p.n })}
                      onChange={e => setPuntos(x => x.map((v, j) => (j === i ? e.target.value : v)))} />
                    <span>/ {fmt(p.puntosMax)}</span>
                  </label>
                </div>
                {p.respuesta && <p className="evf-p-resp"><em>{t('Ha escrito')}:</em> {p.respuesta}</p>}
                {p.comentario && <p className="evf-p-com">{p.comentario}</p>}
              </div>
            ))}
          </div>

          {(correccion.puntosFuertes.length > 0 || correccion.aMejorar.length > 0) && (
            <div className="evf-listas">
              {correccion.puntosFuertes.length > 0 && <div><strong>{t('Lo que hace bien')}</strong><ul>{correccion.puntosFuertes.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
              {correccion.aMejorar.length > 0 && <div><strong>{t('A mejorar')}</strong><ul>{correccion.aMejorar.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
            </div>
          )}

          <label className="flabel" htmlFor="evf-comentario">{t('Comentario para el alumno o su familia')}</label>
          <textarea id="evf-comentario" className="finput" rows={3} value={comentario} onChange={e => setComentario(e.target.value)} />

          <div className="ap-acciones">
            <button className="btn-accent" onClick={guardar} disabled={resultado.nota === null || !alumno || !categoria}>
              <Check size={15} />{guardadoYa ? t('Guardar de nuevo en el cuaderno') : t('Guardar la nota en el cuaderno')}
            </button>
            <button className="btn-ghost" onClick={copiar} disabled={!comentario.trim()}><ClipboardCopy size={15} />{t('Copiar el comentario')}</button>
            {guardadoYa && <button className="btn-ghost" onClick={siguiente}><UserRoundCheck size={15} />{t('Siguiente alumno')}</button>}
          </div>
          {!alumno && <p className="ap-aviso">{t('Elige arriba el alumno al que corresponde para poder guardar la nota.')}</p>}
          <p className="ap-sub">{t('La IA se equivoca a veces, sobre todo con letra difícil: repasa las preguntas marcadas y corrige los puntos que haga falta antes de guardar.')}</p>
        </div>
      )}
    </section>
  );
}
