/**
 * PT y AL, pestaña «Documentos» de un alumno, en Andalucía, la Comunitat Valenciana, Cataluña y Madrid: sus
 * adaptaciones curriculares significativas, una por área, con los apartados del modelo de su comunidad
 * (`lib/acsModelos.ts`): la ACS de Séneca, la ACIS del PAP, el PI o la ACS de Raíces. Cada apartado se arma con
 * piezas (`Pieza`), las mismas que el documento. La lógica está en `lib/acs.ts`, el documento en
 * `services/acsDocumento.ts` y la propuesta de la IA en `services/acsIA.ts`. Ver `docs/PTAL.md`.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, BookMarked, Download, FileText, Pencil, Plus, Sparkles, Trash2, TriangleAlert } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { EnviarAcs } from '../../components/apoyo/EnviarAcs';
import { useToast } from '../../components/ui/Toast';
import { useI18n } from '../../i18n';
import { useNombreCurso } from '../../hooks/useNombreCurso';
import { useMateriasDeNivel } from '../../hooks/useMateriasDeNivel';
import { hasApiKey } from '../../services/gemini';
import {
  APOYOS_VACIOS, ESTRATEGIAS_ACS, GRADOS_ACS, alternarCompetencia, alternarCriterio, alternarSaber, avisosAcs, conCamposDelModelo,
  conFila, desfaseCursos, filasSeguimiento, nuevaAcs, progresoTrimestre, seleccionValida, textoAviso,
} from '../../lib/acs';
import { etiquetaResponsable, modeloAcs, type ModeloAcs, type PiezaAcs } from '../../lib/acsModelos';
import {
  contenidoAcs, firmasAcs, guardarAcsDocx, guardarAcsPdf, nombreArchivoAcs, nombreFila, tituloAcs, type DocenteAcs,
} from '../../services/acsDocumento';
import { proponerAcs, proponerObjetivosAcs } from '../../services/acsIA';
import { alumnoParaIA } from '../../services/apoyoIA';
import { ambitoDeAcs, objetivosAcsAProgramas } from '../../lib/acsProgramas';
import { competenciasDe } from '../../lib/curriculum';
import { nivelDe, nuevoIdApoyo, trimestreDe } from '../../lib/apoyo';
import { isoDate } from '../../lib/utils';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { MateriaDeClase } from '../../lib/curriculum/criteriosParaIA';
import type { AcsApoyo as Acs, AlumnoApoyo, ApoyoData, CursoDe, GradoAcs, ObjetivoAcs, Trimestre } from '../../types/apoyo';

interface Props {
  alumno: AlumnoApoyo;
  data: ApoyoData;
  onChange: (f: (d: ApoyoData) => ApoyoData) => void;
  /** Las materias del curso del nivel del alumno: con ellas se elige el área de una ACS nueva. */
  materias: MateriaDeClase[];
  comunidad: ComunidadId | undefined;
  docente: DocenteAcs;
  /**
   * `apoyo` (por defecto): la del especialista de PT y AL, en `data.acs`, con el paso a sus programas. `aula`: la de un
   * docente de aula o de EF para un alumno de «Mis clases», en `data.acsAula`; sus necesidades se marcan en la propia
   * adaptación, y quien la firma es el profesorado de la materia.
   */
  modo?: 'apoyo' | 'aula';
  /** Un botón más en la tarjeta (en el aula, «Recibir del especialista»). */
  extra?: React.ReactNode;
}

type Clave = 'acs' | 'acsAula';

const CURSOS: CursoDe[] = [
  ...[1, 2, 3, 4, 5, 6].map(curso => ({ etapa: 'primaria' as const, curso })),
  ...[1, 2, 3, 4].map(curso => ({ etapa: 'eso' as const, curso })),
];
const claveCurso = (c: CursoDe) => `${c.etapa}-${c.curso}`;

export function AcsApoyo({ alumno, data, onChange, materias, comunidad, docente, modo = 'apoyo', extra }: Props) {
  const clave: Clave = modo === 'aula' ? 'acsAula' : 'acs';
  const { t, lang } = useI18n();
  const nombreCurso = useNombreCurso();
  const nivel = nivelDe(alumno);
  const [area, setArea] = useState('');
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const suyas = data[clave].filter(a => a.alumnoId === alumno.id);
  const abierta = suyas.find(a => a.id === abiertaId) ?? null;
  const trimestre = trimestreDe(isoDate());
  const elegida = materias.find(m => m.entry.nombre === area) ?? materias[0];
  const modelo = modeloAcs(comunidad);

  function crear() {
    if (!nivel || !elegida) return;
    const ya = suyas.find(a => a.area === elegida.entry.nombre);
    if (ya) { setAbiertaId(ya.id); return; }
    const acs = conCamposDelModelo(nuevaAcs(alumno, elegida.entry.nombre, nivel, isoDate(), k => t(k)), modelo, alumno);
    if (modo === 'aula') acs.responsables.materia = docente.nombre;
    else acs.responsables.especialista = docente.nombre;
    onChange(d => ({ ...d, [clave]: [...d[clave], acs] }));
    setAbiertaId(acs.id);
  }

  function borrar(acs: Acs) {
    if (!window.confirm(t('¿Eliminar «{name}»?', { name: tituloAcs(acs, t, modelo) }))) return;
    onChange(d => ({ ...d, [clave]: d[clave].filter(x => x.id !== acs.id) }));
    if (abiertaId === acs.id) setAbiertaId(null);
  }

  return (
    <div className="card">
      <div className="card-hd"><div className="card-ttl"><BookMarked size={14} color="var(--accent-d)" />{t(modelo.tarjeta)}</div></div>
      <p className="ap-sub" style={{ margin: '0 0 12px' }}>{t(modelo.explicacion)}</p>
      {suyas.length > 0 && (
        <ul className="ap-lista" style={{ marginBottom: 12 }}>
          {suyas.map(a => {
            const p = progresoTrimestre(a, trimestre);
            return (
              <li key={a.id}>
                <div className="ap-lista-txt">
                  <strong>{tituloAcs(a, t, modelo)}</strong>
                  <span className="ap-sub">
                    {t('Con el currículo de {curso}.', { curso: nombreCurso(a.nivel) })}{' '}
                    {p.total > 0 && t('{n}º trimestre: {hechas} de {total} valorados.', { n: trimestre, hechas: p.hechas, total: p.total })}
                  </span>
                </div>
                <button className="ico-btn" onClick={() => setAbiertaId(a.id)} aria-label={t('Abrir «{name}»', { name: tituloAcs(a, t, modelo) })} title={t('Abrir y retocar')}><Pencil size={15} /></button>
                <button className="ico-btn" onClick={() => borrar(a)} aria-label={t('Eliminar «{name}»', { name: tituloAcs(a, t, modelo) })} title={t('Eliminar')}><Trash2 size={15} /></button>
              </li>
            );
          })}
        </ul>
      )}
      {!nivel || materias.length === 0 ? (
        <p className="ap-aviso">{t('Para adaptar con el currículo de su nivel, indica antes su nivel de competencia en la pestaña «Datos».')}</p>
      ) : (
        <div className="acs-nueva">
          <div className="fgroup" style={{ margin: 0 }}>
            <label className="flabel" htmlFor="acs-area">{t('Área')}</label>
            <select id="acs-area" className="finput" value={elegida?.entry.nombre ?? ''} onChange={e => setArea(e.target.value)}>
              {materias.map(m => <option key={m.entry.id} value={m.entry.nombre}>{m.entry.nombre}</option>)}
            </select>
          </div>
          <button type="button" className="btn-accent" onClick={crear}>
            <Plus size={15} />{suyas.some(a => a.area === elegida?.entry.nombre) ? t('Abrir la de esta área') : t(modelo.nuevo)}
          </button>
        </div>
      )}
      {extra && <div className="acs-extra">{extra}</div>}
      <Modal open={!!abierta} onClose={() => setAbiertaId(null)} wide stickyHeader title={abierta ? tituloAcs(abierta, t, modelo) : ''}>
        {abierta && (
          <EditorAcs
            key={abierta.id} acs={abierta} alumno={alumno} data={data} comunidad={comunidad} modelo={modelo} docente={docente} lang={lang}
            modo={modo} onData={onChange}
            onCambio={f => onChange(d => ({ ...d, [clave]: d[clave].map(x => (x.id === abierta.id ? { ...f(x), fecha: isoDate() } : x)) }))}
            onCerrar={() => setAbiertaId(null)} onBorrar={() => borrar(abierta)}
          />
        )}
      </Modal>
    </div>
  );
}

interface EditorProps {
  acs: Acs;
  alumno: AlumnoApoyo;
  data: ApoyoData;
  comunidad: ComunidadId | undefined;
  modelo: ModeloAcs;
  docente: DocenteAcs;
  lang: 'es' | 'en' | 'ca';
  modo: 'apoyo' | 'aula';
  /** Para pasar los objetivos a sus programas (solo PT y AL). */
  onData: (f: (d: ApoyoData) => ApoyoData) => void;
  onCambio: (f: (a: Acs) => Acs) => void;
  onCerrar: () => void;
  onBorrar: () => void;
}

function EditorAcs({ acs, alumno: alumnoFicha, data, comunidad, modelo, docente, lang, modo, onData, onCambio, onCerrar, onBorrar }: EditorProps) {
  const alumno = alumnoFicha;
  const { t } = useI18n();
  const { toast } = useToast();
  const nombreCurso = useNombreCurso();
  const { estado, materias } = useMateriasDeNivel(comunidad, acs.nivel);
  const materia = materias.find(m => m.entry.nombre === acs.area);
  const [trimestre, setTrimestre] = useState<Trimestre>(trimestreDe(isoDate()));
  const [proponiendo, setProponiendo] = useState(false);
  const [objetivando, setObjetivando] = useState(false);
  const avisos = avisosAcs(acs, alumno, modelo);
  const desfase = desfaseCursos(alumno.matricula, acs.nivel);
  const conPdf = typeof window !== 'undefined' && !!window.electronAPI?.docs;
  const suma = acs.instrumentos.reduce((s, i) => s + i.peso, 0);
  const set = <K extends keyof Acs>(k: K, v: Acs[K]) => onCambio(a => ({ ...a, [k]: v }));

  // Al cambiar el curso de referencia o el área, lo elegido que no existe en el currículo nuevo se cae
  const valida = useMemo(() => (materia ? seleccionValida(acs, materia.entry, materia.grupo) : null), [acs, materia]);
  useEffect(() => {
    if (!valida) return;
    const igual = (x: unknown[], y: unknown[]) => x.length === y.length && x.every((v, i) => v === y[i]);
    if (!igual(valida.criterios, acs.criterios) || !igual(valida.competencias, acs.competencias) || !igual(valida.saberes, acs.saberes)) {
      onCambio(a => ({ ...a, competencias: valida.competencias, criterios: valida.criterios, saberes: valida.saberes }));
    }
  }, [valida, acs.criterios, acs.competencias, acs.saberes, onCambio]);

  async function proponer() {
    if (!materia) return;
    if (acs.criterios.length && !window.confirm(t('La IA sustituirá los criterios, los saberes y las estrategias marcados. ¿Sigues?'))) return;
    const r = await proponerAcs({ acs, alumno, materia, data, lang, nombreCurso, comunidad, modelo },
      { onStart: () => setProponiendo(true), onEnd: () => setProponiendo(false), onError: m => toast(t(m)) });
    if (r) onCambio(() => r);
  }

  async function proponerObjetivos() {
    if (!materia) return;
    const nuevos = await proponerObjetivosAcs({
      acs, materia, alumnoTexto: alumnoParaIA(alumno, nombreCurso), nombreCurso, modelo, comunidad, lang, idNuevo: nuevoIdApoyo,
    }, { onStart: () => setObjetivando(true), onEnd: () => setObjetivando(false), onError: m => toast(t(m)) });
    if (nuevos?.length) onCambio(a => ({ ...a, objetivos: [...(a.objetivos ?? []), ...nuevos] }));
  }

  function pasarAProgramas() {
    const ambito = ambitoDeAcs(acs, modelo, comunidad, lang, t);
    let pasados = 0;
    onData(d => { const r = objetivosAcsAProgramas(d, acs, ambito, materia?.entry.nombre ?? acs.area, nuevoIdApoyo); pasados = r.pasados; return r.data; });
    // `onData` se aplica al momento; si no, el aviso dice cero
    setTimeout(() => toast(pasados ? t('Objetivos pasados al programa «{name}»: {n}.', { name: ambito, n: pasados }) : t('Ya estaban todos en sus programas.')), 0);
  }

  const setObjetivo = (id: string, cambio: Partial<ObjetivoAcs>) =>
    set('objetivos', (acs.objetivos ?? []).map(o => (o.id === id ? { ...o, ...cambio } : o)));

  async function exportar(formato: 'pdf' | 'docx') {
    const c = contenidoAcs(acs, alumno, materia, docente, nombreCurso, lang, modelo);
    const nombre = nombreArchivoAcs(c, alumno, acs.fecha);
    if (formato === 'docx') { await guardarAcsDocx(c, lang, firmasAcs(lang, modelo), nombre); return; }
    const r = await guardarAcsPdf(c, lang, firmasAcs(lang, modelo), nombre);
    if ('error' in r && r.error === 'not-desktop') toast(t('El PDF solo está disponible en la aplicación de escritorio. Puedes exportar a Word.'));
    else if ('error' in r && r.error) toast(t('No se pudo guardar el PDF.'));
  }

  const comps = materia ? competenciasDe(materia.entry, materia.grupo) : [];
  const crits = materia?.entry.criterios[materia.grupo] ?? [];
  const bloques = materia?.entry.saberes[materia.grupo] ?? [];


  const apoyos = acs.apoyos ?? APOYOS_VACIOS;
  const setApoyos = (cambio: Partial<typeof apoyos>) => set('apoyos', { ...apoyos, ...cambio });
  const setFecha = (k: keyof NonNullable<Acs['fechas']>, v: string) => set('fechas', { ...acs.fechas, [k]: v });
  const ajusteDe = (cod: string) => acs.ajusteCriterios?.[cod] ?? { aula: '' };
  const setAjuste = (cod: string, cambio: Partial<{ tipo?: 'priorizado' | 'modificado'; aula: string }>) =>
    set('ajusteCriterios', { ...acs.ajusteCriterios, [cod]: { ...ajusteDe(cod), ...cambio } });
  const horas = (v: string) => Math.min(40, Math.max(0, Math.round((Number(v.replace(',', '.')) || 0) * 2) / 2));

  function pieza(p: PiezaAcs) {
    switch (p) {
      case 'informe': return (
        <div className="acs-rejilla">
          <div className="fgroup">
            <label className="flabel" htmlFor="acs-informe">{t(modelo.informe)}</label>
            <input id="acs-informe" type="date" className="finput" value={acs.fechaInforme} onChange={e => set('fechaInforme', e.target.value)} />
          </div>
          {modelo.fechas.map(f => (
            <div className="fgroup" key={f.id}>
              <label className="flabel" htmlFor={`acs-f-${f.id}`}>{t(f.texto)}</label>
              <input id={`acs-f-${f.id}`} type="date" className="finput" value={acs.fechas?.[f.id] ?? ''} onChange={e => setFecha(f.id, e.target.value)} />
            </div>
          ))}
          {modelo.id === 'madrid' && (
            <div className="fgroup">
              <label className="flabel" htmlFor="acs-organismo">{t('Evaluación y dictamen de')}</label>
              <select id="acs-organismo" className="finput" value={acs.organismo ?? 'eoep'} onChange={e => set('organismo', e.target.value as Acs['organismo'])}>
                <option value="eoep">{t('Equipo de orientación educativa y psicopedagógica (EOEP)')}</option>
                <option value="orientacion">{t('Departamento de orientación')}</option>
              </select>
            </div>
          )}
        </div>
      );
      case 'nivel': return (
        <>
          <div className="acs-rejilla">
            <div className="fgroup">
              <label className="flabel" htmlFor="acs-nivel">{t(modelo.cursoReferencia)}</label>
              <select id="acs-nivel" className="finput" value={claveCurso(acs.nivel)}
                onChange={e => { const c = CURSOS.find(x => claveCurso(x) === e.target.value); if (c) set('nivel', c); }}>
                {CURSOS.map(c => <option key={claveCurso(c)} value={claveCurso(c)}>{nombreCurso(c)}</option>)}
              </select>
              {desfase !== null && <span className="ap-sub">{t('Cursos de desfase respecto a {curso}: {n}.', { n: desfase, curso: nombreCurso(alumno.matricula!) })}</span>}
            </div>
          </div>
          <div className="fgroup">
            <label className="flabel" htmlFor="acs-just">{t(modelo.id === 'cataluna' ? 'Por qué se prioriza o se modifica' : 'Justificación del desfase')}</label>
            <textarea id="acs-just" className="finput" rows={2} value={acs.justificacion} onChange={e => set('justificacion', e.target.value)}
              placeholder={t(modelo.id === 'cataluna' ? 'Qué competencias se priorizan o se modifican respecto a su grupo de edad, y por qué.' : 'Su nivel de competencia curricular en el área y cómo se valoró.')} />
          </div>
        </>
      );
      case 'responsables': return (
        <>
          <div className="acs-rejilla acs-tres">
            {modelo.responsables.map(k => (
              <div className="fgroup" key={k}>
                <label className="flabel" htmlFor={`acs-r-${k}`}>{t(etiquetaResponsable(modelo, k))}</label>
                <input id={`acs-r-${k}`} className="finput" value={acs.responsables[k] ?? ''} onChange={e => set('responsables', { ...acs.responsables, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <p className="ap-aviso">{t('Los nombres del profesorado salen en el documento y nunca se envían a la IA.')}</p>
        </>
      );
      case 'barreras': return (
        <>
          <div className="fgroup">
            <label className="flabel" htmlFor="acs-barreras">{t('Barreras para el aprendizaje y la participación')}</label>
            <textarea id="acs-barreras" className="finput" rows={3} value={acs.barreras ?? ''} onChange={e => set('barreras', e.target.value)}
              placeholder={t('Qué le dificulta aprender y participar en el aula: del contexto, de los materiales, de la organización.')} />
          </div>
          <div className="fgroup">
            <label className="flabel" htmlFor="acs-fortalezas">{t('Fortalezas')}</label>
            <textarea id="acs-fortalezas" className="finput" rows={2} value={acs.fortalezas ?? ''} onChange={e => set('fortalezas', e.target.value)} />
          </div>
          <p className="ap-aviso">{t('Se empiezan con sus necesidades y las fortalezas del informe del orientador, si las tiene. No se envían a la IA.')}</p>
        </>
      );
      case 'area': return (
        <>
          <div className="acs-rejilla">
            <div className="fgroup">
              <label className="flabel" htmlFor="acs-area-ed">{t('Área o materia del curso de referencia')}</label>
              <select id="acs-area-ed" className="finput" value={materia ? acs.area : ''} onChange={e => set('area', e.target.value)} disabled={estado !== 'listo'}>
                {!materia && <option value="">{estado === 'listo' ? t('Elige un área') : t('Cargando…')}</option>}
                {materias.map(m => <option key={m.entry.id} value={m.entry.nombre}>{m.entry.nombre}</option>)}
              </select>
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="acs-aula">{t('Materia en su clase, si se llama de otra forma')}</label>
              <input id="acs-aula" className="finput" value={acs.materiaAula} placeholder={acs.area} onChange={e => set('materiaAula', e.target.value)} />
            </div>
          </div>
          {estado === 'listo' && !materia && <p className="ap-aviso">{t('«{area}» no está en el currículo de {curso}: elige otra área.', { area: acs.area, curso: nombreCurso(acs.nivel) })}</p>}
        </>
      );
      case 'curriculo': return materia && (
        <>
          <button className="btn-ia" type="button" disabled={proponiendo || !hasApiKey()} onClick={proponer} style={{ marginBottom: 12 }}>
            {proponiendo ? <span className="spin" /> : <Sparkles size={15} />}{proponiendo ? t('Preparando…') : t('Proponer la selección con IA')}
          </button>
          <p className="flabel">{t('Competencias específicas y criterios de evaluación')} <span className="ap-sub">({t('{a} criterios de {b}', { a: acs.criterios.length, b: crits.length })})</span></p>
          <div className="acs-comps">
            {comps.map(c => {
              const suyos = crits.filter(cr => cr.competencia === c.n);
              return (
                <div key={c.n} className="acs-comp">
                  <label className="acs-chk">
                    <input type="checkbox" checked={acs.competencias.includes(c.n)} onChange={() => onCambio(a => alternarCompetencia(a, materia.entry, materia.grupo, c.n))} />
                    <span><strong>CE{c.n}.</strong> {c.texto}</span>
                  </label>
                  {suyos.map(cr => (
                    <label key={cr.codigo} className="acs-chk acs-crit">
                      <input type="checkbox" checked={acs.criterios.includes(cr.codigo)} onChange={() => onCambio(a => alternarCriterio(a, materia.entry, materia.grupo, cr.codigo))} />
                      <span><strong>{cr.codigo}.</strong> {cr.texto}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
          <p className="flabel" style={{ marginTop: 12 }}>{t('Saberes básicos mínimos imprescindibles')}</p>
          <div className="acs-comps">
            {bloques.map(b => (
              <label key={b.bloque} className="acs-chk">
                <input type="checkbox" checked={acs.saberes.includes(b.bloque)} onChange={() => onCambio(a => alternarSaber(a, materia.entry, materia.grupo, b.bloque))} />
                <span><strong>{b.bloque}.</strong> {b.tituloBloque}</span>
              </label>
            ))}
          </div>
        </>
      );
      case 'objetivos': return materia && (
        <fieldset className="fgroup ap-fs" style={{ marginTop: 12 }}>
          <legend className="flabel">{t('Objetivos concretos')} <span className="ap-sub">({t('de los criterios elegidos, por trimestre')})</span></legend>
          {(acs.objetivos ?? []).length === 0 && <p className="ap-vacio">{t('Todavía no hay ninguno. La IA los propone a partir de los criterios elegidos, o escríbelos tú.')}</p>}
          <ul className="acs-seg">
            {(acs.objetivos ?? []).map(o => (
              <li key={o.id}>
                <textarea className="finput" rows={1} aria-label={t('Objetivo')} value={o.texto} onChange={e => setObjetivo(o.id, { texto: e.target.value })} />
                <div className="acs-obj-fila">
                  <div className="chip-row" role="group" aria-label={t('Trimestres')}>
                    {([1, 2, 3] as const).map(n => {
                      const on = o.trimestres.includes(n);
                      return (
                        <button key={n} type="button" className={`chip sm accent${on ? ' on' : ''}`} aria-pressed={on}
                          onClick={() => { const ts = on ? o.trimestres.filter(x => x !== n) : [...o.trimestres, n].sort(); if (ts.length) setObjetivo(o.id, { trimestres: ts }); }}>
                          {t('{n}º trimestre', { n })}
                        </button>
                      );
                    })}
                  </div>
                  <select className="finput acs-obj-crit" aria-label={t('Criterio')} value={o.criterio ?? ''} onChange={e => setObjetivo(o.id, { criterio: e.target.value || undefined })}>
                    <option value="">{t('Sin criterio')}</option>
                    {acs.criterios.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button type="button" className="ico-btn" aria-label={t('Quitar «{name}»', { name: o.texto })}
                    onClick={() => set('objetivos', (acs.objetivos ?? []).filter(x => x.id !== o.id))}><Trash2 size={15} /></button>
                </div>
              </li>
            ))}
          </ul>
          <div className="acs-obj-acciones">
            <button className="btn-ia" type="button" disabled={objetivando || !hasApiKey() || acs.criterios.length === 0} onClick={proponerObjetivos}>
              {objetivando ? <span className="spin" /> : <Sparkles size={15} />}{objetivando ? t('Preparando…') : t('Proponer objetivos con IA')}
            </button>
            <button type="button" className="btn-ghost"
              onClick={() => set('objetivos', [...(acs.objetivos ?? []), { id: nuevoIdApoyo('obj'), texto: '', trimestres: [trimestre], ...(acs.criterios[0] ? { criterio: acs.criterios[0] } : {}) }])}>
              <Plus size={14} />{t('Añadir objetivo')}
            </button>
            {modo === 'apoyo' && (acs.objetivos ?? []).some(o => o.texto.trim()) && (
              <button type="button" className="btn-ghost" onClick={pasarAProgramas}><ArrowRightLeft size={14} />{t('Pasar a sus programas')}</button>
            )}
          </div>
        </fieldset>
      );
      case 'ajusteCriterios': return acs.criterios.length > 0 && (
        <fieldset className="fgroup ap-fs" style={{ marginTop: 12 }}>
          <legend className="flabel">{t('Los criterios respecto a su grupo de edad')}</legend>
          <ul className="acs-seg">
            {acs.criterios.map(cod => {
              const a = ajusteDe(cod);
              return (
                <li key={cod}>
                  <span className="acs-seg-txt">{nombreFila({ tipo: 'criterio', clave: cod }, materia, t)}</span>
                  <div className="chip-row" role="group" aria-label={t('Priorizado o modificado')}>
                    {(['priorizado', 'modificado'] as const).map(tipo => (
                      <button key={tipo} type="button" className={`chip sm accent${a.tipo === tipo ? ' on' : ''}`} aria-pressed={a.tipo === tipo}
                        onClick={() => setAjuste(cod, { tipo: a.tipo === tipo ? undefined : tipo })}>
                        {t(tipo === 'priorizado' ? 'Priorizado' : 'Modificado')}
                      </button>
                    ))}
                  </div>
                  <textarea className="finput" rows={1} aria-label={t('Qué hace en relación con la actividad del aula')} placeholder={t('Qué hace en relación con la actividad del aula')}
                    value={a.aula} onChange={e => setAjuste(cod, { aula: e.target.value })} />
                </li>
              );
            })}
          </ul>
        </fieldset>
      );
      case 'estrategias': return (
        <>
          {(['metodologica', 'organizativa'] as const).map(g => (
            <fieldset key={g} className="fgroup ap-fs">
              <legend className="flabel">{t(g === 'metodologica' ? 'Estrategias metodológicas' : 'Estrategias organizativas')}</legend>
              <div className="acs-estr">
                {ESTRATEGIAS_ACS.filter(e => e.grupo === g).map(e => (
                  <label key={e.id} className="acs-chk">
                    <input type="checkbox" checked={acs.estrategias.includes(e.id)}
                      onChange={() => set('estrategias', acs.estrategias.includes(e.id) ? acs.estrategias.filter(x => x !== e.id) : [...acs.estrategias, e.id])} />
                    <span>{t(e.texto)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="fgroup">
            <label className="flabel" htmlFor="acs-otras">{t('Otras estrategias')}</label>
            <textarea id="acs-otras" className="finput" rows={2} value={acs.otrasEstrategias} onChange={e => set('otrasEstrategias', e.target.value)} />
          </div>
        </>
      );
      case 'apoyos': {
        const ap = modelo.apoyos;
        if (!ap) return null;
        return (
          <fieldset className="fgroup ap-fs">
            <legend className="flabel">{t('Horas semanales de apoyo')}</legend>
            {ap.siei && (
              <label className="acs-chk" style={{ marginBottom: 8 }}>
                <input type="checkbox" checked={!!apoyos.siei} onChange={e => setApoyos({ siei: e.target.checked })} />
                <span>{t('Con el apoyo de una SIEI (apoyo intensivo a la escolarización inclusiva)')}</span>
              </label>
            )}
            <div className="acs-horas">
              <span />
              <span className="ap-sub">{t('Dentro del aula')}</span>
              <span className="ap-sub">{t('Fuera del aula')}</span>
              {([['pt', ap.pt, 'ptDentro', 'ptFuera'], ['al', ap.al, 'alDentro', 'alFuera']] as const).map(([id, nombre, dentro, fuera]) => (
                <Fragment key={id}>
                  <span className="acs-horas-n">{t(nombre)}</span>
                  {([dentro, fuera] as const).map(k => (
                    <input key={k} type="number" min={0} max={40} step={0.5} className="finput"
                      aria-label={`${t(nombre)}, ${t(k === dentro ? 'Dentro del aula' : 'Fuera del aula')}`}
                      value={apoyos[k]} onChange={e => setApoyos({ [k]: horas(e.target.value) })} />
                  ))}
                </Fragment>
              ))}
            </div>
            <div className="fgroup" style={{ marginTop: 10 }}>
              <label className="flabel" htmlFor="acs-org">{t('Organización de los apoyos y horario')}</label>
              <textarea id="acs-org" className="finput" rows={2} value={apoyos.organizacion} onChange={e => setApoyos({ organizacion: e.target.value })} />
            </div>
          </fieldset>
        );
      }
      case 'calificacion': return (
        <>
          <fieldset className="fgroup ap-fs">
            <legend className="flabel">{t('Instrumentos de evaluación adaptados')} <span className="ap-sub">({t('suman {n} %', { n: suma })})</span></legend>
            {acs.instrumentos.map(i => (
              <div key={i.id} className="acs-instr">
                <input className="finput" aria-label={t('Instrumento')} value={i.nombre}
                  onChange={e => set('instrumentos', acs.instrumentos.map(x => (x.id === i.id ? { ...x, nombre: e.target.value } : x)))} />
                <span className="acs-peso">
                  <input type="number" min={0} max={100} step={5} className="finput" aria-label={t('Peso en la calificación')} value={i.peso}
                    onChange={e => set('instrumentos', acs.instrumentos.map(x => (x.id === i.id ? { ...x, peso: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))) } : x)))} />
                  %
                </span>
                <button type="button" className="ico-btn" aria-label={t('Quitar «{name}»', { name: i.nombre })} onClick={() => set('instrumentos', acs.instrumentos.filter(x => x.id !== i.id))}><Trash2 size={15} /></button>
              </div>
            ))}
            <button type="button" className="btn-ghost" onClick={() => set('instrumentos', [...acs.instrumentos, { id: nuevoIdApoyo('ins'), nombre: '', peso: 0 }])}>
              <Plus size={14} />{t('Añadir instrumento')}
            </button>
          </fieldset>
          <div className="fgroup">
            <label className="flabel" htmlFor="acs-cal">{t('Criterios de calificación')}</label>
            <textarea id="acs-cal" className="finput" rows={3} value={acs.calificacion} onChange={e => set('calificacion', e.target.value)} />
          </div>
        </>
      );
      case 'seguimiento': return (
        <>
          <div className="chip-row" style={{ marginBottom: 10 }}>
            {([1, 2, 3] as const).map(n => (
              <button key={n} type="button" className={`chip sm accent${trimestre === n ? ' on' : ''}`} aria-pressed={trimestre === n} onClick={() => setTrimestre(n)}>
                {t('{n}º trimestre', { n })}
              </button>
            ))}
          </div>
          {filasSeguimiento(acs, trimestre).length === 0 ? (
            <p className="ap-vacio">{t('Elige antes los criterios y los saberes: cada uno tendrá aquí su fila.')}</p>
          ) : (
            <ul className="acs-seg">
              {filasSeguimiento(acs, trimestre).map(f => (
                <li key={`${f.tipo}-${f.clave}`}>
                  <span className="acs-seg-txt">{nombreFila(f, materia, t)}</span>
                  <div className="chip-row" role="group" aria-label={t('Grado de consecución')}>
                    {GRADOS_ACS.map(g => (
                      <button key={g.id} type="button" className={`chip sm accent${f.grado === g.id ? ' on' : ''}`} aria-pressed={f.grado === g.id}
                        onClick={() => onCambio(a => conFila(a, { ...f, grado: f.grado === g.id ? undefined : g.id as GradoAcs }))}>
                        {t(g.texto)}
                      </button>
                    ))}
                  </div>
                  <textarea className="finput" rows={1} aria-label={t('Observaciones')} placeholder={t('Observaciones')} value={f.observaciones}
                    onChange={e => onCambio(a => conFila(a, { ...f, observaciones: e.target.value }))} />
                </li>
              ))}
            </ul>
          )}
          {modelo.nota && (
            <div className="fgroup">
              <label className="flabel" htmlFor="acs-nota">{t('Calificación del {n}º trimestre', { n: trimestre })}</label>
              <input id="acs-nota" className="finput" style={{ maxWidth: 220 }} value={acs.notas?.[trimestre] ?? ''}
                onChange={e => set('notas', { ...acs.notas, [trimestre]: e.target.value })} />
              <span className="ap-sub">{t(modelo.nota.ayuda)}</span>
            </div>
          )}
          <div className="fgroup">
            <label className="flabel" htmlFor="acs-ajuste">{t('Medidas de ajuste del {n}º trimestre', { n: trimestre })}</label>
            <textarea id="acs-ajuste" className="finput" rows={2} value={acs.ajustes[trimestre] ?? ''}
              onChange={e => set('ajustes', { ...acs.ajustes, [trimestre]: e.target.value })} />
          </div>
          {modelo.promocion && trimestre === 3 && (
            <div className="fgroup">
              <label className="flabel" htmlFor="acs-promo">{t('Decisión de promoción al final del curso o del ciclo')}</label>
              <textarea id="acs-promo" className="finput" rows={2} value={acs.promocion ?? ''} onChange={e => set('promocion', e.target.value)} />
            </div>
          )}
        </>
      );
      case 'acuerdos': return (
        <>
          <label className="acs-chk" style={{ marginBottom: 10 }}>
            <input type="checkbox" checked={!!acs.familiaConforme} onChange={e => set('familiaConforme', e.target.checked)} />
            <span>{t('La familia está conforme con el PI')}</span>
          </label>
          <div className="fgroup">
            <label className="flabel" htmlFor="acs-acuerdos">{t('Acuerdos con la familia y el alumno')}</label>
            <textarea id="acs-acuerdos" className="finput" rows={3} value={acs.acuerdos ?? ''} onChange={e => set('acuerdos', e.target.value)} />
          </div>
          <p className="ap-aviso">{t('El documento lleva las firmas de la familia y el visto bueno de la dirección, tras aprobarlo la CAD.')}</p>
        </>
      );
    }
  }

  return (
    <div className="acs">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {conPdf && <button className="btn-accent" onClick={() => exportar('pdf')}><Download size={15} />{t('Exportar PDF')}</button>}
        <button className="btn-ghost" onClick={() => exportar('docx')}><FileText size={15} />{t('Exportar Word')}</button>
        {modo === 'apoyo' && <EnviarAcs acs={acs} alumno={alumno} de={docente.nombre} />}
      </div>

      {avisos.length > 0 && (
        <div className="acs-avisos" role="status">
          <TriangleAlert size={15} />
          <ul>{avisos.map(a => <li key={textoAviso(a, t)}>{textoAviso(a, t)}</li>)}</ul>
        </div>
      )}

      {modelo.apartados.map((ap, i) => (
        <section key={ap.titulo}>
          <h3 className="ap-doc-h">{i + 1}. {t(ap.titulo)}</h3>
          {ap.piezas.map(p => <Fragment key={p}>{pieza(p)}</Fragment>)}
        </section>
      ))}

      <div className="ap-acciones">
        <button className="btn-accent" onClick={onCerrar}>{t('Hecho')}</button>
        <button className="btn-ghost ap-borrar" onClick={onBorrar}><Trash2 size={15} />{t('Eliminar')}</button>
      </div>
    </div>
  );
}
