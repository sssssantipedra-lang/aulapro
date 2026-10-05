/**
 * PT y AL, «Programación e informes»: por alumno, su programación, sus
 * informes trimestrales a la familia y al tutor o al equipo y, en la
 * Comunitat Valenciana, el seguimiento del apartado I del PAP. Los prepara la
 * IA a partir de sus programas y del registro diario; el docente los retoca y
 * los exporta a PDF o a Word. Ver `docs/PTAL.md`, «Documentos».
 */
import { useMemo, useState } from 'react';
import { Sparkles, FileText, Download, Trash2, Pencil } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { AiKeyNotice } from '../../components/ui/AiKeyNotice';
import { useI18n } from '../../i18n';
import { useNombreCurso } from '../../hooks/useNombreCurso';
import { useMateriasDeNivel } from '../../hooks/useMateriasDeNivel';
import { hasApiKey } from '../../services/gemini';
import {
  NOMBRE_TIPO, cabecera, generarDocumento, guardarDocumentoDocx, guardarDocumentoPdf, papDe, tiposDe,
} from '../../services/apoyoDocumentos';
import { isoDate } from '../../lib/utils';
import { nivelDe, trimestreDe } from '../../lib/apoyo';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { ApoyoData, DocumentoApoyo, Especialidad, TipoDocumentoApoyo, Trimestre } from '../../types/apoyo';

interface Props {
  data: ApoyoData;
  onChange: (f: (d: ApoyoData) => ApoyoData) => void;
  especialidades: Especialidad[];
  comunidad: ComunidadId | undefined;
  docente: { nombre: string; centro: string; curso: string };
  onNav: (s: string) => void;
}

export function DocumentosApoyo({ data, onChange, especialidades, comunidad, docente, onNav }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const nombreCurso = useNombreCurso();
  const alumnos = useMemo(() => [...data.alumnos].sort((a, b) => a.nombre.localeCompare(b.nombre)), [data.alumnos]);
  const [alumnoId, setAlumnoId] = useState<string | null>(null);
  const alumno = alumnos.find(a => a.id === alumnoId) ?? alumnos[0] ?? null;
  const { materias } = useMateriasDeNivel(comunidad, alumno ? nivelDe(alumno) : undefined);
  const tipos = tiposDe(comunidad);
  const [tipo, setTipo] = useState<TipoDocumentoApoyo>('familia');
  const [trimestre, setTrimestre] = useState<Trimestre>(trimestreDe(isoDate()));
  const [generando, setGenerando] = useState(false);
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const abierto = data.documentos.find(d => d.id === abiertoId) ?? null;
  const conPdf = typeof window !== 'undefined' && !!window.electronAPI?.docs;
  const pap = papDe(lang);

  const docsDelAlumno = data.documentos
    .filter(d => d.alumnoId === alumno?.id)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  /** El que se sustituye al generar: la programación y el PAP son uno por alumno; los informes, uno por trimestre. */
  const existente = (tp: TipoDocumentoApoyo) => docsDelAlumno.find(d => d.tipo === tp && (tp === 'programacion' || tp === 'pap' || d.trimestre === trimestre));

  async function generar() {
    if (!alumno) return;
    const anterior = existente(tipo);
    if (anterior && tipo !== 'pap' && !window.confirm(t('Ya hay un documento «{name}». ¿Lo sustituyes por uno nuevo?', { name: anterior.titulo }))) return;
    if (!data.programas.some(p => p.alumnoId === alumno.id)) { toast(t('Este alumno todavía no tiene programas: créalos primero en «Programas».')); return; }
    setGenerando(true);
    const doc = await generarDocumento(
      { tipo, alumno, trimestre, data, materias, comunidad, lang, nombreCurso, anterior, hoy: isoDate() },
      { onError: m => toast(t(m)) },
    );
    setGenerando(false);
    if (!doc) return;
    onChange(d => ({ ...d, documentos: [...d.documentos.filter(x => x.id !== doc.id), doc] }));
    setAbiertoId(doc.id);
  }

  const cambiar = (f: (d: DocumentoApoyo) => DocumentoApoyo) => {
    if (!abierto) return;
    onChange(d => ({ ...d, documentos: d.documentos.map(x => (x.id === abierto.id ? { ...f(x), fecha: isoDate() } : x)) }));
  };

  function borrar(doc: DocumentoApoyo) {
    if (!window.confirm(t('¿Eliminar «{name}»?', { name: doc.titulo }))) return;
    onChange(d => ({ ...d, documentos: d.documentos.filter(x => x.id !== doc.id) }));
    if (abiertoId === doc.id) setAbiertoId(null);
  }

  const filasDe = (doc: DocumentoApoyo) => {
    const a = data.alumnos.find(x => x.id === doc.alumnoId);
    return a ? cabecera(doc, a, data, docente, nombreCurso, t, lang) : [];
  };
  const firmaDe = (doc: DocumentoApoyo) => (doc.tipo === 'pap'
    ? { nombre: docente.nombre, como: `${pap.profesorado}${especialidades.length ? ` (${especialidades.join(', ')})` : ''}` }
    : undefined);

  async function exportar(doc: DocumentoApoyo, formato: 'pdf' | 'docx') {
    if (formato === 'pdf') {
      const r = await guardarDocumentoPdf(doc, filasDe(doc), lang, firmaDe(doc));
      if ('error' in r && r.error === 'not-desktop') toast(t('El PDF solo está disponible en la aplicación de escritorio. Puedes exportar a Word.'));
      else if ('error' in r && r.error) toast(t('No se pudo guardar el PDF.'));
    } else {
      await guardarDocumentoDocx(doc, filasDe(doc), lang, firmaDe(doc));
    }
  }

  if (!alumno) {
    return (
      <section className="sec active ap-page">
        <div className="pg-hd"><div><h1 className="pg-title">{t('Programación e informes')}</h1></div></div>
        <div className="card">
          <p className="ap-vacio">{t('Primero añade a tu alumnado en «Alumnado y grupos»: cada alumno tiene aquí sus programas.')}</p>
          <button className="btn-accent" style={{ marginTop: 12 }} onClick={() => onNav('apoyo-alumnado')}>{t('Ir a Alumnado y grupos')}</button>
        </div>
      </section>
    );
  }

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Programación e informes')}</h1>
          <p className="pg-sub">{t('La IA los prepara con sus programas y el registro diario, sin inventar nada; tú los retocas y los sacas en PDF o en Word.')}</p>
        </div>
      </div>

      {!hasApiKey() && (
        <AiKeyNotice message={t('Para que la IA prepare los documentos necesitas una clave gratuita de Google (se configura en 2 minutos).')} action={t('Configurar ahora')} onAction={() => onNav('profile')} />
      )}

      <div className="chip-row ap-alumnos" role="tablist" aria-label={t('Alumnado')}>
        {alumnos.map(a => (
          <button key={a.id} type="button" role="tab" aria-selected={a.id === alumno.id}
            className={`chip sm accent${a.id === alumno.id ? ' on' : ''}`} onClick={() => setAlumnoId(a.id)}>
            {a.nombre}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-hd"><div className="card-ttl"><Sparkles size={14} color="var(--accent-d)" />{t('Nuevo documento')}</div></div>
        <fieldset className="fgroup ap-fs">
          <legend className="flabel">{t('Documento')}</legend>
          <div className="chip-row">
            {tipos.map(tp => (
              <button key={tp} type="button" className={`chip sm accent${tipo === tp ? ' on' : ''}`} aria-pressed={tipo === tp} onClick={() => setTipo(tp)}>
                {t(NOMBRE_TIPO[tp])}
              </button>
            ))}
          </div>
        </fieldset>
        {tipo !== 'programacion' && (
          <fieldset className="fgroup ap-fs">
            <legend className="flabel">{t('Trimestre')}</legend>
            <div className="chip-row">
              {([1, 2, 3] as const).map(n => (
                <button key={n} type="button" className={`chip sm accent${trimestre === n ? ' on' : ''}`} aria-pressed={trimestre === n} onClick={() => setTrimestre(n)}>
                  {t('{n}º trimestre', { n })}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <p className="ap-aviso" style={{ marginBottom: 12 }}>
          {tipo === 'pap'
            ? t('Rellena la columna del trimestre elegido en el apartado I del PAP; las de los otros trimestres se conservan.')
            : tipo === 'programacion'
              ? t('Los objetivos salen tal cual de sus programas; la IA redacta el resto.')
              : t('Los recuentos salen del registro diario de ese trimestre; la IA los redacta.')}
        </p>
        <button className="btn-ia" type="button" disabled={generando || !hasApiKey()} onClick={generar}>
          {generando ? <span className="spin" /> : <Sparkles size={15} />}
          {generando ? t('Preparando…') : existente(tipo) && tipo === 'pap' ? t('Rellenar el {n}º trimestre', { n: trimestre }) : t('Preparar con IA')}
        </button>
      </div>

      <div className="card">
        <div className="card-hd"><div className="card-ttl"><FileText size={14} color="var(--accent-d)" />{t('Documentos de {name}', { name: alumno.nombre })}</div></div>
        {docsDelAlumno.length === 0 ? (
          <p className="ap-vacio">{t('Todavía no hay ninguno.')}</p>
        ) : (
          <ul className="ap-lista">
            {docsDelAlumno.map(d => (
              <li key={d.id}>
                <div className="ap-lista-txt">
                  <strong>{d.titulo}</strong>
                  <span className="ap-sub">{t('Actualizado el {fecha}', { fecha: d.fecha.split('-').reverse().join('/') })}</span>
                </div>
                <button className="ico-btn" onClick={() => setAbiertoId(d.id)} aria-label={t('Abrir «{name}»', { name: d.titulo })} title={t('Abrir y retocar')}><Pencil size={15} /></button>
                {conPdf && <button className="ico-btn" onClick={() => exportar(d, 'pdf')} aria-label={t('PDF')} title={t('Exportar PDF')}><Download size={15} /></button>}
                <button className="ico-btn" onClick={() => exportar(d, 'docx')} aria-label={t('Word')} title={t('Exportar Word')}><FileText size={15} /></button>
                <button className="ico-btn" onClick={() => borrar(d)} aria-label={t('Eliminar «{name}»', { name: d.titulo })} title={t('Eliminar')}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={!!abierto} onClose={() => setAbiertoId(null)} wide stickyHeader title={abierto?.titulo}>
        {abierto && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {conPdf && <button className="btn-accent" onClick={() => exportar(abierto, 'pdf')}><Download size={15} />{t('Exportar PDF')}</button>}
              <button className="btn-ghost" onClick={() => exportar(abierto, 'docx')}><FileText size={15} />{t('Exportar Word')}</button>
            </div>
            <table className="ap-ficha"><tbody>
              {filasDe(abierto).map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}
            </tbody></table>
            {abierto.tipo === 'pap' && abierto.tabla && (
              <>
                <h3 className="ap-doc-h">I. {pap.seccion}</h3>
                <div className="ap-pap">
                  {abierto.tabla.map((fila, i) => (
                    <div key={i} className="ap-pap-fila">
                      <strong>{fila[0]}</strong>
                      {[1, 2, 3, 4].map(c => (
                        <label key={c} className="fgroup" style={{ marginBottom: 8 }}>
                          <span className="flabel">{pap.columnas[c]}</span>
                          <textarea className="finput" rows={2} value={fila[c] ?? ''}
                            onChange={e => cambiar(d => ({ ...d, tabla: d.tabla?.map((f, j) => (j === i ? f.map((x, k) => (k === c ? e.target.value : x)) : f)) }))} />
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
            {abierto.apartados.map(a => (
              <div className="fgroup" key={a.id}>
                <label className="flabel" htmlFor={`ap-doc-${a.id}`}>{a.titulo}</label>
                <textarea id={`ap-doc-${a.id}`} className="finput ap-doc-txt" rows={Math.min(14, Math.max(3, a.texto.split('\n').length + 1))} value={a.texto}
                  onChange={e => cambiar(d => ({ ...d, apartados: d.apartados.map(x => (x.id === a.id ? { ...x, texto: e.target.value } : x)) }))} />
              </div>
            ))}
            <div className="ap-acciones">
              <button className="btn-accent" onClick={() => setAbiertoId(null)}>{t('Hecho')}</button>
              <button className="btn-ghost ap-borrar" onClick={() => borrar(abierto)}><Trash2 size={15} />{t('Eliminar')}</button>
            </div>
          </>
        )}
      </Modal>
    </section>
  );
}
