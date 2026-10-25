/**
 * PT y AL, «Mi alumnado» › «Documentos del trimestre»: la programación, los informes a la familia y al tutor o el
 * seguimiento del PAP de todo el alumnado de una vez, con la IA. Se eligen el documento, el trimestre y el alumnado,
 * y se van preparando de uno en uno; después se revisa cada uno en la pestaña «Documentos» del alumno. Ver
 * `docs/PTAL.md`, «Documentos de todo el alumnado».
 */
import { useRef, useState } from 'react';
import { Sparkles, Lock, FileText, ArrowRight } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { AiKeyNotice } from '../../components/ui/AiKeyNotice';
import { useI18n } from '../../i18n';
import { useNombreCurso } from '../../hooks/useNombreCurso';
import { hasApiKey } from '../../services/gemini';
import { NOMBRE_TIPO, tiposDe } from '../../services/apoyoDocumentos';
import { filasDeLote, generarLote } from '../../services/apoyoLote';
import { requestAlumno } from '../../lib/apoyoNav';
import { isoDate } from '../../lib/utils';
import { trimestreDe } from '../../lib/apoyo';
import { compararNombres } from '../../lib/alumnado';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { ApoyoData, TipoDocumentoGenerable, Trimestre } from '../../types/apoyo';
import type { Section } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  data: ApoyoData;
  onChange: (f: (d: ApoyoData) => ApoyoData) => void;
  comunidad: ComunidadId | undefined;
  onNav: (s: Section) => void;
}

export function InformesLoteApoyo({ open, onClose, data, onChange, comunidad, onNav }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const nombreCurso = useNombreCurso();
  const tipos = tiposDe(comunidad);
  const [tipo, setTipo] = useState<TipoDocumentoGenerable>(tipos.includes('familia') ? 'familia' : tipos[0]);
  const [trimestre, setTrimestre] = useState<Trimestre>(trimestreDe(isoDate()));
  /** Alumnado desmarcado a mano; lo demás, marcado si puede prepararse. */
  const [quitados, setQuitados] = useState<Set<string>>(new Set());
  const [progreso, setProgreso] = useState<{ nombre: string; n: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<{ hechos: string[]; fallidos: string[]; cancelado: boolean } | null>(null);
  const parar = useRef(false);

  const filas = filasDeLote(data, tipo, trimestre).sort((a, b) => compararNombres(a.alumno.nombre, b.alumno.nombre));
  const elegidas = filas.filter(f => f.conProgramas && !quitados.has(f.alumno.id));
  const sustituye = elegidas.filter(f => f.existente && tipo !== 'pap').length;
  const ocupado = progreso !== null;
  const sinClave = !hasApiKey();

  const alternar = (id: string) => setQuitados(q => { const n = new Set(q); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function preparar() {
    if (sustituye > 0 && !window.confirm(t('{n} de ellos ya tienen este documento y se sustituirá por uno nuevo. ¿Continúas?', { n: sustituye }))) return;
    parar.current = false;
    setResultado(null);
    const hechos: string[] = [];
    const r = await generarLote({
      data, tipo, trimestre, alumnoIds: elegidas.map(f => f.alumno.id), comunidad, lang, nombreCurso, hoy: isoDate(),
      cancelado: () => parar.current,
      alEmpezar: (a, n, total) => setProgreso({ nombre: a.nombre, n, total }),
      alTerminar: doc => {
        hechos.push(data.alumnos.find(a => a.id === doc.alumnoId)?.nombre ?? '');
        onChange(d => ({ ...d, documentos: [...d.documentos.filter(x => x.id !== doc.id), doc] }));
      },
    });
    setProgreso(null);
    setResultado({ hechos, fallidos: r.fallidos, cancelado: r.cancelado });
    toast(r.fallidos.length
      ? t('Preparados {n}. Fallaron: {lista}.', { n: r.hechos, lista: r.fallidos.join(', ') })
      : t('✅ Preparados {n} documentos. Revísalos uno a uno antes de entregarlos.', { n: r.hechos }));
  }

  function abrirAlumno(id: string) {
    requestAlumno(id, 'documentos');
    onClose();
    onNav('apoyo-alumno');
  }

  return (
    <Modal open={open} onClose={() => !ocupado && onClose()} wide title={t('Documentos del trimestre')}>
      <div className="ap-form">
        {sinClave && <AiKeyNotice message={t('Para que la IA prepare los documentos necesitas una clave gratuita de Google (se configura en 2 minutos).')} action={t('Configurar ahora')} onAction={() => onNav('profile')} />}
        <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
          <legend className="flabel">{t('Documento')}</legend>
          <div className="chip-row">
            {tipos.map(x => (
              <button key={x} type="button" className={`chip sm accent${tipo === x ? ' on' : ''}`} aria-pressed={tipo === x} disabled={ocupado} onClick={() => setTipo(x)}>
                {t(NOMBRE_TIPO[x])}
              </button>
            ))}
          </div>
        </fieldset>
        {tipo !== 'programacion' && (
          <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
            <legend className="flabel">{t('Trimestre')}</legend>
            <div className="chip-row">
              {([1, 2, 3] as const).map(n => (
                <button key={n} type="button" className={`chip sm accent${trimestre === n ? ' on' : ''}`} aria-pressed={trimestre === n} disabled={ocupado} onClick={() => setTrimestre(n)}>
                  {t('{n}º trimestre', { n })}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <ul className="ap-lote" style={{ gridColumn: '1 / -1' }} aria-label={t('Alumnado')}>
          {filas.map(f => {
            const marcado = f.conProgramas && !quitados.has(f.alumno.id);
            return (
              <li key={f.alumno.id}>
                <label className={`ap-lote-fila${f.conProgramas ? '' : ' off'}`}>
                  <input type="checkbox" checked={marcado} disabled={!f.conProgramas || ocupado} onChange={() => alternar(f.alumno.id)} />
                  <span className="ap-lote-nom">{f.alumno.nombre}</span>
                  <span className="ap-lote-est">
                    {!f.conProgramas
                      ? <span className="ap-sub">{t('Sin programas')}</span>
                      : <>
                        {tipo !== 'programacion' && (f.cerrado
                          ? <span className="sda-chip"><Lock size={11} aria-hidden="true" /> {t('Cerrado')}</span>
                          : <span className="sda-chip shared">{t('Sin cerrar')}</span>)}
                        {f.existente ? <span className="sda-chip"><FileText size={11} aria-hidden="true" /> {t('Ya tiene')}</span> : <span className="sda-chip accent">{t('Falta')}</span>}
                      </>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {tipo !== 'programacion' && elegidas.some(f => !f.cerrado) && (
          <p className="ap-aviso" style={{ gridColumn: '1 / -1' }}>
            {t('A quien no tiene el trimestre cerrado, el informe le usará lo último que registraste. Cierra antes el trimestre en la pestaña «Evaluación» de cada alumno si quieres que cuente tu valoración.')}
          </p>
        )}

        {resultado && (
          <div className="ap-lote-res" style={{ gridColumn: '1 / -1' }} role="status">
            <strong>{resultado.cancelado ? t('Parado: {n} preparados.', { n: resultado.hechos.length }) : t('{n} preparados.', { n: resultado.hechos.length })}</strong>
            <ul>
              {resultado.hechos.map(nombre => {
                const a = data.alumnos.find(x => x.nombre === nombre);
                return a ? (
                  <li key={a.id}><button type="button" className="home-link" onClick={() => abrirAlumno(a.id)}>{nombre} <ArrowRight size={12} /></button></li>
                ) : null;
              })}
            </ul>
            {resultado.fallidos.length > 0 && <p className="ap-aviso">{t('No se pudieron preparar: {lista}. Vuelve a intentarlo con ellos.', { lista: resultado.fallidos.join(', ') })}</p>}
          </div>
        )}

        <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
          {!ocupado ? (
            <button className="btn-ia" disabled={elegidas.length === 0 || sinClave} onClick={preparar}>
              <Sparkles size={15} />{t(elegidas.length === 1 ? 'Preparar 1 documento con IA' : 'Preparar {n} documentos con IA', { n: elegidas.length })}
            </button>
          ) : (
            <>
              <button className="btn-ia" disabled><span className="spin" />{t('Preparando a {nombre} ({n} de {total})…', { nombre: progreso.nombre, n: progreso.n, total: progreso.total })}</button>
              <button className="btn-ghost" onClick={() => { parar.current = true; }}>{t('Parar al acabar este')}</button>
            </>
          )}
          <button className="btn-ghost" disabled={ocupado} onClick={onClose}>{t('Cerrar')}</button>
        </div>
      </div>
    </Modal>
  );
}
