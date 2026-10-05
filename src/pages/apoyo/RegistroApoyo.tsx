/**
 * PT y AL, «Registro diario»: lo que se trabaja en cada sesión y cómo
 * responde cada alumno. Fácil, sencillo y accesible (decisión del dueño,
 * 4-10-2026): por alumno, sus objetivos del trimestre con tres botones
 * (conseguido, en proceso, no conseguido), cuatro filas de cómo ha respondido
 * con tres caras y una nota. En el móvil, un alumno por pantalla; en el
 * ordenador, el grupo en una tabla. Se guarda solo. Ver `docs/PTAL.md`.
 */
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Minus, Mic, Clock, CalendarDays, Sparkles } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { useI18n } from '../../i18n';
import { useNarrowScreen } from '../../hooks/useNarrowScreen';
import { useNombreCurso } from '../../hooks/useNombreCurso';
import { hasApiKey } from '../../services/gemini';
import { adaptarTema } from '../../services/apoyoIA';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import { isoDate } from '../../lib/utils';
import { isAndroidApp } from '../../lib/platform';
import { takeRegistro } from '../../lib/apoyoNav';
import {
  ASPECTOS, diaDeLaSemana, gruposDelDia, objetivosDelTrimestre, sesionConDatos, sesionDe, trimestreDe,
} from '../../lib/apoyo';
import type {
  AlumnoApoyo, ApoyoData, AspectoRespuesta, Cara, GrupoApoyo, Logro, ProgramaApoyo, RegistroAlumno, SesionApoyo,
} from '../../types/apoyo';

interface Props {
  data: ApoyoData;
  onChange: (f: (d: ApoyoData) => ApoyoData) => void;
  comunidad?: ComunidadId;
  onNav: (s: string) => void;
}

const LOGROS: { id: Logro; label: string; icon: React.ReactNode }[] = [
  { id: 'si', label: 'Conseguido', icon: <Check size={18} strokeWidth={3} /> },
  { id: 'proceso', label: 'En proceso', icon: <Minus size={18} strokeWidth={3} /> },
  { id: 'no', label: 'No conseguido', icon: <X size={18} strokeWidth={3} /> },
];

const CARAS: { id: Cara; cara: string; label: string }[] = [
  { id: 3, cara: '🙂', label: 'Ha ido bien' },
  { id: 2, cara: '😐', label: 'Ha ido regular' },
  { id: 1, cara: '🙁', label: 'Ha ido mal' },
];

const ASPECTO_LABEL: Record<AspectoRespuesta, string> = {
  atencion: 'Atención', motivacion: 'Motivación', conducta: 'Conducta', autonomia: 'Autonomía',
};

function sumarDias(fecha: string, n: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + n));
}

export function RegistroApoyo({ data, onChange, comunidad, onNav }: Props) {
  const { t, locale, lang } = useI18n();
  const { toast } = useToast();
  const nombreCurso = useNombreCurso();
  const [adaptando, setAdaptando] = useState(false);
  const estrecha = useNarrowScreen();
  // Desde el Inicio se llega con el grupo y el día ya elegidos
  const [pedido] = useState(takeRegistro);
  const [fecha, setFecha] = useState(pedido?.fecha ?? isoDate());
  const [elegido, setElegido] = useState<string | null>(pedido?.grupoId ?? null);
  const [indice, setIndice] = useState(0);

  const delDia = useMemo(() => gruposDelDia(data.grupos, fecha), [data.grupos, fecha]);
  const grupo = data.grupos.find(g => g.id === elegido) ?? delDia[0] ?? null;
  const trimestre = trimestreDe(fecha);
  const sesion = grupo ? sesionDe(data.sesiones, grupo, fecha) : null;
  const registros = sesion
    ? sesion.alumnos.filter(r => data.alumnos.some(a => a.id === r.alumnoId))
    : [];

  function guardar(s: SesionApoyo) {
    onChange(d => {
      const otras = d.sesiones.filter(x => x.id !== s.id && !(x.grupoId === s.grupoId && x.fecha === s.fecha));
      return { ...d, sesiones: sesionConDatos(s) ? [...otras, s] : otras };
    });
  }
  const cambiarRegistro = (alumnoId: string, f: (r: RegistroAlumno) => RegistroAlumno) => {
    if (!sesion) return;
    guardar({ ...sesion, alumnos: sesion.alumnos.map(r => (r.alumnoId === alumnoId ? f(r) : r)) });
  };

  async function adaptar() {
    if (!grupo || !sesion || !sesion.temaClase.trim()) return;
    const presentes = registros.filter(r => !r.ausente);
    setAdaptando(true);
    const propuestas = await adaptarTema({
      tema: sesion.temaClase.trim(), especialidad: grupo.especialidad, comunidad, lang, nombreCurso,
      alumnos: presentes.map(r => ({
        alumno: data.alumnos.find(a => a.id === r.alumnoId)!,
        objetivos: objetivosDelTrimestre(data.programas, r.alumnoId, grupo.especialidad, trimestre).map(x => x.objetivo.texto),
      })),
    }, { onError: m => toast(t(m)) });
    setAdaptando(false);
    if (!propuestas) return;
    guardar({ ...sesion, adaptaciones: { ...(sesion.adaptaciones ?? {}), ...propuestas } });
  }

  function dictar(campo: HTMLTextAreaElement | null) {
    campo?.focus();
    const mac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
    toast(isAndroidApp()
      ? t('Para dictar, toca el micrófono del teclado.')
      : mac
        ? t('Para dictar, pulsa dos veces la tecla Fn o la tecla de dictado.')
        : t('Para dictar, pulsa la tecla Windows + H.'));
  }

  const fechaTexto = new Date(`${fecha}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const fechaLarga = fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1);
  const horaDe = (g: GrupoApoyo) => g.horario.filter(f => f.dia === diaDeLaSemana(fecha)).map(f => f.inicio).sort()[0];

  if (data.grupos.length === 0) {
    return (
      <section className="sec active ap-page">
        <div className="pg-hd"><div><h1 className="pg-title">{t('Registro diario')}</h1></div></div>
        <div className="card">
          <p className="ap-vacio">{t('Para registrar las sesiones, crea primero tus grupos de apoyo con su alumnado y su horario.')}</p>
          <button className="btn-accent" style={{ marginTop: 12 }} onClick={() => onNav('apoyo-alumnado')}>{t('Ir a Alumnado y grupos')}</button>
        </div>
      </section>
    );
  }

  const otros = data.grupos.filter(g => !delDia.includes(g));
  const actual = registros[Math.min(indice, Math.max(registros.length - 1, 0))];

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Registro diario')}</h1>
          <p className="pg-sub">{t('Lo que trabaja cada alumno en la sesión y cómo responde. Se guarda solo.')}</p>
        </div>
        <div className="ap-fecha">
          <button className="ico-btn" onClick={() => { setFecha(f => sumarDias(f, -1)); setElegido(null); setIndice(0); }} aria-label={t('Día anterior')} title={t('Día anterior')}><ChevronLeft size={18} /></button>
          <label className="ap-fecha-txt">
            <CalendarDays size={15} aria-hidden="true" />
            <span>{fechaLarga}</span>
            <input type="date" value={fecha} aria-label={t('Fecha')} onChange={e => { if (e.target.value) { setFecha(e.target.value); setElegido(null); setIndice(0); } }} />
          </label>
          <button className="ico-btn" onClick={() => { setFecha(f => sumarDias(f, 1)); setElegido(null); setIndice(0); }} aria-label={t('Día siguiente')} title={t('Día siguiente')}><ChevronRight size={18} /></button>
          <span className="sda-chip accent">{t('{n}º trimestre', { n: trimestre })}</span>
        </div>
      </div>

      <div className="chip-row ap-grupos" role="tablist" aria-label={t('Grupos')}>
        {delDia.map(g => (
          <button key={g.id} type="button" role="tab" aria-selected={g.id === grupo?.id}
            className={`chip accent${g.id === grupo?.id ? ' on' : ''}`} onClick={() => { setElegido(g.id); setIndice(0); }}>
            <span className="chip-dot" style={{ background: g.color }} aria-hidden="true" />
            {horaDe(g) && <span className="ap-hora"><Clock size={12} aria-hidden="true" />{horaDe(g)}</span>}
            {g.nombre}
          </button>
        ))}
        {otros.length > 0 && (
          <select
            className="finput ap-otro-grupo" aria-label={t('Otro grupo')}
            value={grupo && !delDia.includes(grupo) ? grupo.id : ''}
            onChange={e => { if (e.target.value) { setElegido(e.target.value); setIndice(0); } }}
          >
            <option value="">{delDia.length ? t('Otro grupo…') : t('Hoy no tienes grupos en el horario. Elige uno…')}</option>
            {otros.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        )}
      </div>

      {grupo && sesion && (
        <>
          <div className="card ap-tema">
            <label className="flabel" htmlFor="ap-tema">{t('Qué trabaja hoy su clase')}</label>
            <input
              id="ap-tema" className="finput" value={sesion.temaClase}
              placeholder={t('Ej: Las fracciones; un cuento sobre el otoño')}
              onChange={e => guardar({ ...sesion, temaClase: e.target.value })}
            />
            <button className="btn-ia" type="button" style={{ marginTop: 10 }}
              disabled={adaptando || !sesion.temaClase.trim() || !hasApiKey()} onClick={adaptar}
              title={hasApiKey() ? undefined : t('Necesitas la clave gratuita de Google para usar la IA.')}>
              {adaptando ? <span className="spin" /> : <Sparkles size={15} />}
              {adaptando ? t('Preparando…') : t('Cómo adaptarlo a cada alumno, con IA')}
            </button>
          </div>

          {registros.length === 0 && (
            <div className="card"><p className="ap-vacio">{t('Este grupo no tiene alumnado. Añádelo en «Alumnado y grupos».')}</p></div>
          )}

          {estrecha && actual && (
            <>
              <div className="ap-paso" aria-live="polite">
                <button className="ico-btn" disabled={indice === 0} onClick={() => setIndice(i => Math.max(0, i - 1))} aria-label={t('Alumno anterior')}><ChevronLeft size={20} /></button>
                <span>{t('{n} de {total}', { n: Math.min(indice, registros.length - 1) + 1, total: registros.length })}</span>
                <button className="ico-btn" disabled={indice >= registros.length - 1} onClick={() => setIndice(i => Math.min(registros.length - 1, i + 1))} aria-label={t('Alumno siguiente')}><ChevronRight size={20} /></button>
              </div>
              <TarjetaAlumno
                registro={actual} alumno={data.alumnos.find(a => a.id === actual.alumnoId)!}
                programas={data.programas} grupo={grupo} trimestre={trimestre}
                adaptacion={sesion.adaptaciones?.[actual.alumnoId]}
                onAdaptacion={v => guardar({ ...sesion, adaptaciones: { ...(sesion.adaptaciones ?? {}), [actual.alumnoId]: v } })}
                onChange={f => cambiarRegistro(actual.alumnoId, f)} onDictar={dictar} onNav={onNav}
              />
            </>
          )}

          {!estrecha && registros.length > 0 && (
            <div className="ap-tabla">
              {registros.map(r => (
                <TarjetaAlumno
                  key={r.alumnoId} registro={r} alumno={data.alumnos.find(a => a.id === r.alumnoId)!}
                  programas={data.programas} grupo={grupo} trimestre={trimestre}
                  adaptacion={sesion.adaptaciones?.[r.alumnoId]}
                  onAdaptacion={v => guardar({ ...sesion, adaptaciones: { ...(sesion.adaptaciones ?? {}), [r.alumnoId]: v } })}
                  onChange={f => cambiarRegistro(r.alumnoId, f)} onDictar={dictar} onNav={onNav}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TarjetaAlumno({ registro, alumno, programas, grupo, trimestre, adaptacion, onAdaptacion, onChange, onDictar, onNav }: {
  registro: RegistroAlumno;
  adaptacion?: string;
  onAdaptacion: (v: string) => void;
  alumno: AlumnoApoyo;
  programas: ProgramaApoyo[];
  grupo: GrupoApoyo;
  trimestre: 1 | 2 | 3;
  onChange: (f: (r: RegistroAlumno) => RegistroAlumno) => void;
  onDictar: (campo: HTMLTextAreaElement | null) => void;
  onNav: (s: string) => void;
}) {
  const { t } = useI18n();
  const [nota, setNota] = useState<HTMLTextAreaElement | null>(null);
  const objetivos = objetivosDelTrimestre(programas, alumno.id, grupo.especialidad, trimestre);

  return (
    <article className={`card ap-reg${registro.ausente ? ' ausente' : ''}`} aria-label={alumno.nombre}>
      <div className="ap-reg-hd">
        <div>
          <strong>{alumno.nombre}</strong>
          {alumno.claseOrigen && <span className="ap-sub"> · {alumno.claseOrigen}</span>}
        </div>
        <label className="ap-ausente">
          <input type="checkbox" checked={!!registro.ausente}
            onChange={e => onChange(r => ({ ...r, ausente: e.target.checked || undefined }))} />
          {t('No ha venido')}
        </label>
      </div>

      {!registro.ausente && (
        <>
          {adaptacion !== undefined && (
            <div className="ap-adapt">
              <div className="ap-reg-sec">{t('Propuesta para hoy')}</div>
              <textarea className="finput" rows={3} value={adaptacion} aria-label={t('Propuesta para hoy')}
                onChange={e => onAdaptacion(e.target.value)} />
            </div>
          )}
          <div className="ap-reg-sec">{t('Objetivos de este trimestre')}</div>
          {objetivos.length === 0 ? (
            <p className="ap-vacio">
              {t('No tiene objetivos para este trimestre.')}{' '}
              <button type="button" className="ap-enlace" onClick={() => onNav('apoyo-programas')}>{t('Añádelos en Programas')}</button>
            </p>
          ) : (
            <ul className="ap-reg-objs">
              {objetivos.map(({ objetivo }) => {
                const actual = registro.objetivos[objetivo.id];
                return (
                  <li key={objetivo.id}>
                    <span className="ap-reg-obj">{objetivo.texto}</span>
                    <span className="ap-logros" role="group" aria-label={objetivo.texto}>
                      {LOGROS.map(l => (
                        <button
                          key={l.id} type="button" className={`ap-logro ${l.id}${actual === l.id ? ' on' : ''}`}
                          aria-pressed={actual === l.id} aria-label={t(l.label)} title={t(l.label)}
                          onClick={() => onChange(r => {
                            const objetivosR = { ...r.objetivos };
                            if (actual === l.id) delete objetivosR[objetivo.id];
                            else objetivosR[objetivo.id] = l.id;
                            return { ...r, objetivos: objetivosR };
                          })}
                        >{l.icon}</button>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="ap-reg-sec">{t('Cómo ha respondido')}</div>
          <ul className="ap-respuesta">
            {ASPECTOS.map(a => {
              const actual = registro.respuesta[a];
              return (
                <li key={a}>
                  <span>{t(ASPECTO_LABEL[a])}</span>
                  <span className="ap-caras" role="group" aria-label={t(ASPECTO_LABEL[a])}>
                    {CARAS.map(c => (
                      <button
                        key={c.id} type="button" className={`ap-cara${actual === c.id ? ' on' : ''}`}
                        aria-pressed={actual === c.id} aria-label={`${t(ASPECTO_LABEL[a])}: ${t(c.label)}`} title={t(c.label)}
                        onClick={() => onChange(r => {
                          const respuesta = { ...r.respuesta };
                          if (actual === c.id) delete respuesta[a];
                          else respuesta[a] = c.id;
                          return { ...r, respuesta };
                        })}
                      ><span aria-hidden="true">{c.cara}</span></button>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="ap-nota">
        <textarea
          ref={setNota} className="finput" rows={2} value={registro.nota} aria-label={t('Nota de {name}', { name: alumno.nombre })}
          placeholder={t('Nota: qué ha funcionado, qué le ha costado…')}
          onChange={e => onChange(r => ({ ...r, nota: e.target.value }))}
        />
        <button type="button" className="ico-btn" onClick={() => onDictar(nota)} aria-label={t('Dictar la nota')} title={t('Dictar la nota')}><Mic size={17} /></button>
      </div>
    </article>
  );
}
