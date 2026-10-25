/**
 * PT y AL, pestaña «Datos» de un alumno: su informe sociopsicopedagógico. Se sube (PDF o Word) o se pega, la IA lo
 * lee una vez y propone lo que va a su ficha (necesidades, nivel, fortalezas, orientaciones y programas); el docente
 * lo revisa y lo guarda. De ahí salen también sus programas con sus objetivos. El informe no se guarda, solo las
 * conclusiones. Ver `docs/PTAL.md`, «El informe del orientador».
 */
import { useRef, useState } from 'react';
import { FileText, Sparkles, Upload, ListChecks, Check } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { ObjetivosOrientacion } from '../../components/apoyo/ObjetivosOrientacion';
import { useToast } from '../../components/ui/Toast';
import { AiKeyNotice } from '../../components/ui/AiKeyNotice';
import { useI18n } from '../../i18n';
import { useNombreCurso } from '../../hooks/useNombreCurso';
import { useMateriasDeNivel } from '../../hooks/useMateriasDeNivel';
import { hasApiKey } from '../../services/gemini';
import { proponerObjetivos } from '../../services/apoyoIA';
import {
  analizarInforme, conInforme, EXTENSIONES_INFORME, leerArchivoInforme, type FuenteInforme, type PropuestaInforme,
} from '../../services/informeOrientacion';
import { isoDate } from '../../lib/utils';
import { ambitosDe, CATEGORIAS_NEAE, nivelDe, nuevoIdApoyo, objetivosPendientes, pasarAProgramas, yaEstaEnPrograma } from '../../lib/apoyo';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { AlumnoApoyo, ApoyoData, Especialidad, ObjetivoOrientacion, ProgramaApoyo } from '../../types/apoyo';
import type { Section } from '../../types';

interface Props {
  alumno: AlumnoApoyo;
  data: ApoyoData;
  onChange: (f: (d: ApoyoData) => ApoyoData) => void;
  especialidades: Especialidad[];
  comunidad: ComunidadId | undefined;
  onNav: (s: Section) => void;
}

export function InformeOrientacionApoyo({ alumno, data, onChange, especialidades, comunidad, onNav }: Props) {
  const { t, lang, locale } = useI18n();
  const { toast } = useToast();
  const nombreCurso = useNombreCurso();
  const { materias } = useMateriasDeNivel(comunidad, nivelDe(alumno));
  const entrada = useRef<HTMLInputElement>(null);

  const { oficial, ambitos } = ambitosDe(comunidad, lang);
  const visibles = ambitos.filter(a => especialidades.length === 0 || especialidades.includes(a.especialidad));
  const nombreAmbito = (n: string) => (oficial ? n : t(n));
  const nombres = visibles.map(a => nombreAmbito(a.nombre));

  const [abierto, setAbierto] = useState(false);
  const [fuente, setFuente] = useState<FuenteInforme>({});
  const [pegado, setPegado] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [propuesta, setPropuesta] = useState<PropuestaInforme | null>(null);
  const [crearAbierto, setCrearAbierto] = useState(false);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [creando, setCreando] = useState<string | null>(null);

  const informe = alumno.informe;
  const yaTiene = new Set(data.programas.filter(p => p.alumnoId === alumno.id).map(p => p.ambito));
  const delaOrientacion = alumno.objetivosOrientacion ?? [];
  const porPasar = objetivosPendientes(data, alumno).filter(o => o.ambito);
  /** Programas que aún no existen y que el informe sugiere o a los que van objetivos de la orientación. */
  const pendientes = [...new Set([...(informe?.ambitos ?? []), ...porPasar.map(o => o.ambito!)])].filter(a => !yaTiene.has(a));
  const especialidadDe = (ambito: string): Especialidad => visibles.find(a => nombreAmbito(a.nombre) === ambito)?.especialidad ?? especialidades[0] ?? 'PT';
  const cambiarOrientacion = (lista: ObjetivoOrientacion[]) =>
    onChange(d => ({ ...d, alumnos: d.alumnos.map(a => (a.id === alumno.id ? { ...a, objetivosOrientacion: lista.length ? lista : undefined } : a)) }));

  function pasar() {
    const r = pasarAProgramas(data, alumno.id, porPasar, especialidadDe);
    onChange(d => pasarAProgramas(d, alumno.id, porPasar, especialidadDe).data);
    toast(t('✅ {n} objetivos pasados a sus programas. Revísalos en la pestaña «Programa».', { n: r.pasados }));
  }

  function abrir() { setFuente({}); setPegado(''); setPropuesta(null); setAbierto(true); }

  async function elegirArchivo(file: File | undefined) {
    if (!file) return;
    try { setFuente(await leerArchivoInforme(file)); setPegado(''); }
    catch (e) { toast((e as Error).message === 'grande' ? t('El archivo pesa demasiado (19 MB como máximo).') : t('Formato no válido. Usa un PDF, un Word (.docx) o un texto.')); }
  }

  async function leer() {
    const f: FuenteInforme = pegado.trim() ? { texto: pegado } : fuente;
    const p = await analizarInforme({ fuente: f, alumno, ambitos: nombres, comunidad, lang }, {
      onStart: () => setLeyendo(true), onEnd: () => setLeyendo(false), onError: m => toast(t(m)),
    });
    if (!p) return;
    if (!fuente.nombre || pegado.trim()) setFuente({ texto: pegado, nombre: undefined });
    setPropuesta(p);
  }

  function guardar() {
    if (!propuesta) return;
    const nuevo = conInforme(alumno, propuesta, fuente.nombre, isoDate());
    onChange(d => ({ ...d, alumnos: d.alumnos.map(a => (a.id === alumno.id ? nuevo : a)) }));
    setAbierto(false);
    setElegidos(propuesta.ambitos.filter(a => !yaTiene.has(a)));
    toast(t('✅ Guardado en su ficha. Ahora puedes crear sus programas con sus objetivos.'));
  }

  /**
   * Los programas elegidos: primero los objetivos de la orientación que van a cada uno (son los importantes) y,
   * después, los que la IA propone además. Todo se guarda de una vez al final.
   */
  async function crearProgramas() {
    const complementos: { ambito: string; objetivos: ProgramaApoyo['objetivos'] }[] = [];
    for (const nombre of elegidos) {
      const propios = delaOrientacion.filter(o => o.ambito === nombre);
      const programa: ProgramaApoyo = {
        id: nuevoIdApoyo('pro'), alumnoId: alumno.id, ambito: nombre, especialidad: especialidadDe(nombre),
        objetivos: propios.map(o => ({ id: nuevoIdApoyo('obj'), texto: o.texto, trimestres: o.trimestres, criterios: [], origen: o.origen })),
      };
      setCreando(nombre);
      const propuestos = await proponerObjetivos(
        { alumno, programa, actuales: programa.objetivos, materias, comunidad, lang, nombreCurso }, { onError: m => toast(t(m)) },
      );
      complementos.push({ ambito: nombre, objetivos: (propuestos ?? []).map(o => ({ id: nuevoIdApoyo('obj'), ...o, origen: 'ia' as const })) });
    }
    setCreando(null);
    if (!complementos.length) return;
    onChange(d => {
      let r = pasarAProgramas(d, alumno.id, delaOrientacion.filter(o => o.ambito && elegidos.includes(o.ambito)), especialidadDe).data;
      for (const c of complementos) {
        const existe = r.programas.some(p => p.alumnoId === alumno.id && p.ambito === c.ambito);
        r = {
          ...r,
          programas: existe
            ? r.programas.map(p => (p.alumnoId === alumno.id && p.ambito === c.ambito ? { ...p, objetivos: [...p.objetivos, ...c.objetivos] } : p))
            : [...r.programas, { id: nuevoIdApoyo('pro'), alumnoId: alumno.id, ambito: c.ambito, especialidad: especialidadDe(c.ambito), objetivos: c.objetivos }],
        };
      }
      return r;
    });
    setCrearAbierto(false);
    toast(t('✅ Programas creados con sus objetivos. Revísalos en la pestaña «Programa».'));
  }

  const edit = (c: Partial<PropuestaInforme>) => setPropuesta(p => (p ? { ...p, ...c } : p));
  const sinClave = !hasApiKey();
  const hayTexto = !!(pegado.trim() || fuente.texto?.trim() || fuente.archivo);

  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-ttl"><FileText size={14} color="var(--accent-d)" />{t('Informe del orientador')}</div>
        <button className="btn-ghost" onClick={abrir}><Upload size={14} />{informe ? t('Leer otro informe') : t('Subir o pegar el informe')}</button>
      </div>

      {!informe ? (
        <p className="ap-vacio">{t('Sube el informe sociopsicopedagógico (PDF o Word) o pega su texto: la IA propone su ficha, sus programas y sus objetivos, y tú lo revisas.')}</p>
      ) : (
        <>
          <p className="ap-aviso" style={{ margin: '0 0 10px' }}>
            {t('Leído el {fecha}', { fecha: new Date(informe.fecha + 'T00:00:00').toLocaleDateString(locale) })}{informe.archivo ? ` · ${informe.archivo}` : ''}
          </p>
          <table className="ap-ficha al-datos"><tbody>
            <tr><th>{t('Fortalezas')}</th><td>{informe.fortalezas || <span className="ap-sub">{t('Sin indicar')}</span>}</td></tr>
            <tr><th>{t('Orientaciones del informe')}</th><td>{informe.orientaciones || <span className="ap-sub">{t('Sin indicar')}</span>}</td></tr>
            <tr><th>{t('Programas que sugiere')}</th><td>{informe.ambitos.length ? informe.ambitos.join('; ') : <span className="ap-sub">{t('Sin indicar')}</span>}</td></tr>
          </tbody></table>
        </>
      )}

      <div className="ap-oo-sec">
        <div className="ap-reg-sec">{t('Objetivos de la orientación')}</div>
        <p className="ap-sub" style={{ margin: '0 0 8px' }}>
          {t('Los que plantea el informe y los que te indica la orientadora, aunque no estén en el informe. Pasan a sus programas tal cual; la IA propone otros además.')}
        </p>
        <ObjetivosOrientacion
          objetivos={delaOrientacion} onChange={cambiarOrientacion} ambitos={nombres}
          enPrograma={o => yaEstaEnPrograma(data, alumno.id, o)}
        />
        <div className="ap-acciones" style={{ marginTop: 12 }}>
          {porPasar.length > 0 && (
            <button className="btn-ghost" onClick={pasar}><ListChecks size={15} />{t(porPasar.length === 1 ? 'Pasar 1 objetivo a su programa' : 'Pasar {n} objetivos a sus programas', { n: porPasar.length })}</button>
          )}
          {pendientes.length > 0 && (
            <button className="btn-accent" onClick={() => { setElegidos(pendientes); setCrearAbierto(true); }}>
              <Sparkles size={15} />{t('Crear sus programas con IA, con estos objetivos y otros')}
            </button>
          )}
        </div>
      </div>

      <Modal open={abierto} onClose={() => setAbierto(false)} wide title={t('Informe del orientador')}>
        {!propuesta ? (
          <div className="ap-form">
            {sinClave && <AiKeyNotice message={t('Para que la IA lea el informe necesitas una clave gratuita de Google (se configura en 2 minutos).')} action={t('Configurar ahora')} onAction={() => onNav('profile')} />}
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <input ref={entrada} type="file" accept={EXTENSIONES_INFORME} hidden onChange={e => { void elegirArchivo(e.target.files?.[0]); e.target.value = ''; }} />
              <button type="button" className="btn-ghost" onClick={() => entrada.current?.click()}><Upload size={14} />{t('Elegir un PDF, un Word o un texto')}</button>
              {fuente.nombre && <span className="ap-sub" style={{ marginLeft: 10 }}>{fuente.nombre}</span>}
            </div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ap-inf-txt">{t('O pega aquí su texto')}</label>
              <textarea id="ap-inf-txt" className="finput" rows={8} value={pegado} onChange={e => { setPegado(e.target.value); if (e.target.value) setFuente({}); }} />
            </div>
            <p className="ap-aviso" style={{ gridColumn: '1 / -1' }}>
              {t('Es un dato muy sensible. Con un Word o un texto pegado, la IA recibe el texto con el nombre del alumno cambiado por un código. Un PDF se envía tal cual, con el nombre que lleve: si prefieres evitarlo, pega su texto. El informe no se guarda en la aplicación: solo lo que revises y aceptes.')}
            </p>
            <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
              <button className="btn-ia" disabled={leyendo || sinClave || !hayTexto} onClick={leer}>
                {leyendo ? <span className="spin" /> : <Sparkles size={15} />}{leyendo ? t('Leyendo…') : t('Leer con IA')}
              </button>
              <button className="btn-ghost" onClick={() => setAbierto(false)}>{t('Cancelar')}</button>
            </div>
          </div>
        ) : (
          <div className="ap-form">
            <p className="ap-aviso" style={{ gridColumn: '1 / -1' }}>{t('Esto es lo que ha entendido la IA. Revísalo y cámbialo: al guardar sustituye lo que hubiera en estos campos de su ficha.')}</p>
            <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
              <legend className="flabel">{t('Necesidades específicas de apoyo educativo')}</legend>
              <div className="chip-row">
                {[...new Set([...propuesta.categorias, ...CATEGORIAS_NEAE.filter(c => alumno.categorias.includes(c))])].map(c => {
                  const on = propuesta.categorias.includes(c);
                  return <button key={c} type="button" className={`chip sm accent${on ? ' on' : ''}`} aria-pressed={on}
                    onClick={() => edit({ categorias: on ? propuesta.categorias.filter(x => x !== c) : [...propuesta.categorias, c] })}>{on && <Check size={12} />}{t(c)}</button>;
                })}
                {propuesta.categorias.length === 0 && alumno.categorias.length === 0 && <span className="ap-sub">{t('El informe no dice ninguna.')}</span>}
              </div>
            </fieldset>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ap-inf-diag">{t('Diagnóstico')}</label>
              <input id="ap-inf-diag" className="finput" value={propuesta.diagnostico} onChange={e => edit({ diagnostico: e.target.value })} />
            </div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ap-inf-nec">{t('Necesidades educativas')}</label>
              <textarea id="ap-inf-nec" className="finput" rows={4} value={propuesta.necesidades} onChange={e => edit({ necesidades: e.target.value })} />
            </div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ap-inf-for">{t('Fortalezas')}</label>
              <textarea id="ap-inf-for" className="finput" rows={2} value={propuesta.fortalezas} onChange={e => edit({ fortalezas: e.target.value })} />
            </div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ap-inf-ori">{t('Orientaciones del informe')}</label>
              <textarea id="ap-inf-ori" className="finput" rows={4} value={propuesta.orientaciones} onChange={e => edit({ orientaciones: e.target.value })} />
            </div>
            <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
              <legend className="flabel">{t('Programas que sugiere')}</legend>
              <div className="chip-row">
                {nombres.map(n => {
                  const on = propuesta.ambitos.includes(n);
                  return <button key={n} type="button" className={`chip sm accent${on ? ' on' : ''}`} aria-pressed={on}
                    onClick={() => edit({ ambitos: on ? propuesta.ambitos.filter(x => x !== n) : [...propuesta.ambitos, n] })}>{on && <Check size={12} />}{n}</button>;
                })}
              </div>
            </fieldset>
            <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
              <legend className="flabel">{t('Objetivos que plantea el informe')}</legend>
              <ObjetivosOrientacion objetivos={propuesta.objetivos} onChange={objetivos => edit({ objetivos })} ambitos={nombres} />
            </fieldset>
            <p className="ap-aviso" style={{ gridColumn: '1 / -1' }}>
              {propuesta.nivel ? t('Nivel de competencia que dice el informe: {curso}. Se guardará en su ficha.', { curso: nombreCurso(propuesta.nivel) }) : t('El informe no dice su nivel de competencia: se queda el que tenga.')}
            </p>
            <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
              <button className="btn-accent" onClick={guardar}>{t('Guardar en su ficha')}</button>
              <button className="btn-ghost" onClick={() => setPropuesta(null)}>{t('Volver')}</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={crearAbierto} onClose={() => !creando && setCrearAbierto(false)} wide title={t('Sus programas y objetivos')}>
        <div className="ap-form">
          <p className="ap-aviso" style={{ gridColumn: '1 / -1' }}>{t('Primero entran los objetivos de la orientación que van a cada programa; después la IA propone otros además, repartidos por trimestres y enlazados con los criterios de su nivel. Los revisas después en la pestaña «Programa».')}</p>
          <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
            <legend className="flabel">{t('Programas que se crean')}</legend>
            <div className="chip-row">
              {pendientes.map(n => {
                const on = elegidos.includes(n);
                return <button key={n} type="button" className={`chip sm accent${on ? ' on' : ''}`} aria-pressed={on} disabled={!!creando}
                  onClick={() => setElegidos(on ? elegidos.filter(x => x !== n) : [...elegidos, n])}>{on && <Check size={12} />}{n}</button>;
              })}
            </div>
          </fieldset>
          <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
            <button className="btn-ia" disabled={!!creando || elegidos.length === 0 || sinClave} onClick={crearProgramas}>
              {creando ? <span className="spin" /> : <Sparkles size={15} />}{creando ? t('Preparando «{name}»…', { name: creando }) : t('Crear con IA')}
            </button>
            <button className="btn-ghost" disabled={!!creando} onClick={() => setCrearAbierto(false)}>{t('Cancelar')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
