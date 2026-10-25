/**
 * PT y AL, pestaña «Documentos» de un alumno: la adaptación de la programación de aula. Se elige el área y el
 * trimestre, se da la programación del tutor (pegada o en un archivo; es opcional) y la IA prepara la adaptación con el
 * nivel del alumno, sus objetivos y su informe. Es un documento, no materiales. Ver `docs/PTAL.md`.
 */
import { useRef, useState } from 'react';
import { Sparkles, Upload, ClipboardCheck } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { AiKeyNotice } from '../../components/ui/AiKeyNotice';
import { useI18n } from '../../i18n';
import { useNombreCurso } from '../../hooks/useNombreCurso';
import { hasApiKey } from '../../services/gemini';
import { adaptacionExistente, generarAdaptacion } from '../../services/apoyoAdaptacion';
import { EXTENSIONES_INFORME, leerArchivoInforme, type FuenteInforme } from '../../services/informeOrientacion';
import { isoDate } from '../../lib/utils';
import { nivelDe, trimestreDe } from '../../lib/apoyo';
import type { MateriaDeClase } from '../../lib/curriculum/criteriosParaIA';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { AlumnoApoyo, ApoyoData, Trimestre } from '../../types/apoyo';
import type { Section } from '../../types';

interface Props {
  alumno: AlumnoApoyo;
  data: ApoyoData;
  onChange: (f: (d: ApoyoData) => ApoyoData) => void;
  /** Las materias del curso del nivel del alumno. */
  materias: MateriaDeClase[];
  comunidad: ComunidadId | undefined;
  /** Abre el documento recién hecho para retocarlo. */
  onAbrir: (id: string) => void;
  onNav: (s: Section) => void;
}

export function AdaptacionApoyo({ alumno, data, onChange, materias, comunidad, onAbrir, onNav }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const nombreCurso = useNombreCurso();
  const entrada = useRef<HTMLInputElement>(null);
  const nivel = nivelDe(alumno);
  const [area, setArea] = useState('');
  const [trimestre, setTrimestre] = useState<Trimestre>(trimestreDe(isoDate()));
  const [fuente, setFuente] = useState<FuenteInforme>({});
  const [pegado, setPegado] = useState('');
  const [generando, setGenerando] = useState(false);
  const materia = materias.find(m => m.entry.nombre === area) ?? materias[0];
  const sinClave = !hasApiKey();

  async function elegirArchivo(file: File | undefined) {
    if (!file) return;
    try { setFuente(await leerArchivoInforme(file)); setPegado(''); }
    catch (e) { toast((e as Error).message === 'grande' ? t('El archivo pesa demasiado (19 MB como máximo).') : t('Formato no válido. Usa un PDF, un Word (.docx) o un texto.')); }
  }

  async function preparar() {
    if (!materia) return;
    const previa = adaptacionExistente(data, alumno.id, materia.entry.nombre, trimestre);
    if (previa && !window.confirm(t('Ya hay un documento «{name}». ¿Lo sustituyes por uno nuevo?', { name: previa.titulo }))) return;
    const doc = await generarAdaptacion(
      { alumno, materia, trimestre, programacion: pegado.trim() ? { texto: pegado } : fuente, data, comunidad, lang, nombreCurso, materias, hoy: isoDate() },
      { onStart: () => setGenerando(true), onEnd: () => setGenerando(false), onError: m => toast(t(m)) },
    );
    if (!doc) return;
    onChange(d => ({ ...d, documentos: [...d.documentos.filter(x => x.id !== doc.id), doc] }));
    onAbrir(doc.id);
  }

  return (
    <div className="card">
      <div className="card-hd"><div className="card-ttl"><ClipboardCheck size={14} color="var(--accent-d)" />{t('Adaptación de la programación de aula')}</div></div>
      <p className="ap-sub" style={{ margin: '0 0 12px' }}>
        {t('Adapta lo que programa el tutor en un área a este alumno, con su nivel, sus objetivos y su informe. Es el documento (ACI o ACIS); para los materiales, usa «Ficha adaptada».')}
      </p>
      {sinClave && <AiKeyNotice message={t('Para que la IA prepare los documentos necesitas una clave gratuita de Google (se configura en 2 minutos).')} action={t('Configurar ahora')} onAction={() => onNav('profile')} />}
      {!nivel || materias.length === 0 ? (
        <p className="ap-aviso">{t('Para adaptar con el currículo de su nivel, indica antes su nivel de competencia en la pestaña «Datos».')}</p>
      ) : (
        <>
          <div className="fgroup">
            <label className="flabel" htmlFor="ap-ad-area">{t('Área')}</label>
            <select id="ap-ad-area" className="finput" value={materia?.entry.nombre ?? ''} onChange={e => setArea(e.target.value)} disabled={generando}>
              {materias.map(m => <option key={m.entry.id} value={m.entry.nombre}>{m.entry.nombre}</option>)}
            </select>
            <span className="ap-sub">{t('Con el currículo de {curso}.', { curso: nombreCurso(nivel) })}</span>
          </div>
          <fieldset className="fgroup ap-fs">
            <legend className="flabel">{t('Trimestre')}</legend>
            <div className="chip-row">
              {([1, 2, 3] as const).map(n => (
                <button key={n} type="button" className={`chip sm accent${trimestre === n ? ' on' : ''}`} aria-pressed={trimestre === n} disabled={generando} onClick={() => setTrimestre(n)}>
                  {t('{n}º trimestre', { n })}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="fgroup">
            <span className="flabel">{t('Programación de aula del tutor (opcional)')}</span>
            <input ref={entrada} type="file" accept={EXTENSIONES_INFORME} hidden onChange={e => { void elegirArchivo(e.target.files?.[0]); e.target.value = ''; }} />
            <div>
              <button type="button" className="btn-ghost" disabled={generando} onClick={() => entrada.current?.click()}><Upload size={14} />{t('Elegir un PDF, un Word o un texto')}</button>
              {fuente.nombre && <span className="ap-sub" style={{ marginLeft: 10 }}>{fuente.nombre}</span>}
            </div>
            <textarea className="finput" rows={4} value={pegado} aria-label={t('O pega aquí su texto')} placeholder={t('O pega aquí su texto')} disabled={generando}
              onChange={e => { setPegado(e.target.value); if (e.target.value) setFuente({}); }} style={{ marginTop: 8 }} />
            <span className="ap-aviso">{t('Con un Word o un texto pegado, la IA recibe el texto con los nombres de alumnado cambiados por un código. Un PDF se envía tal cual. Sin programación del tutor, se adapta lo que dice el currículo.')}</span>
          </div>
          <button className="btn-ia" type="button" disabled={generando || sinClave} onClick={preparar}>
            {generando ? <span className="spin" /> : <Sparkles size={15} />}{generando ? t('Preparando…') : t('Preparar la adaptación con IA')}
          </button>
        </>
      )}
    </div>
  );
}
