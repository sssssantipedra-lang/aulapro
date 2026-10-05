/**
 * Educación Física, «Equipos»: equipos equilibrados por el nivel de 1 a 3 que
 * marca el docente, con chicos y chicas mezclados y separando las parejas que
 * no conviene juntar (decisión del dueño, 5-10-2026). Quien está exento o
 * lesionado juega en su equipo con su adaptación. Los equipos se guardan por
 * clase hasta que se hagan otros, y se pueden retocar a mano y proyectar (sin
 * niveles ni limitaciones). Ver `docs/EF.md`.
 */
import { useMemo, useRef, useState } from 'react';
import { Shuffle, Maximize2, Bandage, X, Plus, Users } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { useI18n } from '../../i18n';
import { isoDate, fromIsoDate } from '../../lib/utils';
import { COLORES_EQUIPO, exentosDelDia, hacerEquipos, LIMITACIONES, MAX_EQUIPOS, parejasJuntas, type OpcionesEquipos } from '../../lib/ef';
import type { AttendanceMap, Class, Section, Student } from '../../types';
import type { EfData, SexoEF } from '../../types/ef';

interface Props {
  classes: Class[];
  students: Student[];
  attendance: AttendanceMap;
  ef: EfData;
  onChangeEf: (f: (d: EfData) => EfData) => void;
  onNav: (s: Section) => void;
}

const NIVELES = [1, 2, 3] as const;

export function EfEquipos({ classes, students, attendance, ef, onChangeEf, onNav }: Props) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const hoy = isoDate();
  const ordenadas = useMemo(() => [...classes].sort((a, b) => a.name.localeCompare(b.name)), [classes]);
  const [claseId, setClaseId] = useState<string | null>(null);
  const clase = ordenadas.find(c => c.id === claseId) ?? ordenadas[0] ?? null;
  /** Sin elegir, los mismos que los guardados, o cuatro. */
  const [cuantos, setCuantos] = useState<number | null>(null);
  const [op, setOp] = useState<OpcionesEquipos>({ nivel: true, sexo: true, separar: true });
  const [sinAusentes, setSinAusentes] = useState(true);
  const [elegido, setElegido] = useState<string | null>(null);
  const [parA, setParA] = useState('');
  const [parB, setParB] = useState('');
  const pantallaRef = useRef<HTMLDivElement>(null);

  if (!clase) {
    return (
      <section className="sec active ap-page">
        <div className="pg-hd"><div><h1 className="pg-title">{t('Equipos')}</h1></div></div>
        <div className="card">
          <p className="ap-vacio">{t('Para hacer equipos, crea primero tus clases con su alumnado.')}</p>
          <button className="btn-accent" style={{ marginTop: 12 }} onClick={() => onNav('classes')}>{t('Ir a Mis Clases')}</button>
        </div>
      </section>
    );
  }

  const alumnos = students.filter(s => s.class_id === clase.id).sort((a, b) => a.name.localeCompare(b.name));
  const nombre = (id: string) => students.find(s => s.id === id)?.name ?? '';
  const faltaHoy = (id: string) => ['absent', 'justified'].includes(attendance[clase.id]?.[hoy]?.[id] ?? '');
  const ausentes = alumnos.filter(s => faltaHoy(s.id));
  const juegan = alumnos.filter(s => !(sinAusentes && faltaHoy(s.id)));
  const exentos = new Map(exentosDelDia(ef, hoy).map(e => [e.alumnoId, e]));
  const ids = new Set(alumnos.map(s => s.id));
  const guardados = ef.equipos[clase.id];
  const grupos = guardados?.grupos.map(g => g.filter(id => ids.has(id))) ?? null;
  const maxEquipos = Math.max(2, Math.min(MAX_EQUIPOS, juegan.length));
  const n = Math.max(2, Math.min(cuantos ?? grupos?.length ?? 4, maxEquipos));
  const sinEquipo = grupos ? juegan.filter(s => !grupos.some(g => g.includes(s.id))) : [];
  const parejas = ef.separar.filter(p => ids.has(p.a) && ids.has(p.b));
  const juntas = grupos ? parejasJuntas(grupos, parejas) : [];
  const porEquipo = juegan.length ? [Math.floor(juegan.length / n), Math.ceil(juegan.length / n)] : [0, 0];

  function guardar(nuevos: string[][]) {
    onChangeEf(d => ({ ...d, equipos: { ...d.equipos, [clase!.id]: { fecha: hoy, grupos: nuevos } } }));
  }

  function hacer() {
    if (juegan.length < 2) { toast(t('Hacen falta al menos dos alumnos para hacer equipos.')); return; }
    guardar(hacerEquipos(juegan.map(s => s.id), n, ef, op));
    setElegido(null);
  }

  /** Tocar a uno lo elige; tocar a otro los cambia de equipo. */
  function tocar(id: string) {
    if (!grupos) return;
    if (!elegido || elegido === id) { setElegido(elegido === id ? null : id); return; }
    const ga = grupos.findIndex(g => g.includes(elegido));
    const gb = grupos.findIndex(g => g.includes(id));
    if (ga === -1 || ga === gb) { setElegido(id); return; }
    guardar(grupos.map((g, i) => g.map(x => (i === ga && x === elegido ? id : i === gb && x === id ? elegido : x))));
    setElegido(null);
  }

  function moverA(destino: number) {
    if (!grupos || !elegido) return;
    guardar(grupos.map((g, i) => (i === destino ? [...g.filter(x => x !== elegido), elegido] : g.filter(x => x !== elegido))));
    setElegido(null);
  }

  function pantallaCompleta() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else pantallaRef.current?.requestFullscreen?.().catch(() => {});
  }

  const ponerNivel = (id: string, v: 1 | 2 | 3) => onChangeEf(d => ({ ...d, niveles: { ...d.niveles, [id]: v } }));
  const ponerSexo = (id: string, v: SexoEF) => onChangeEf(d => {
    const sexos = { ...d.sexos };
    if (sexos[id] === v) delete sexos[id]; else sexos[id] = v;
    return { ...d, sexos };
  });

  function anadirPareja() {
    if (!parA || !parB || parA === parB) { toast(t('Elige a dos alumnos distintos.')); return; }
    if (parejas.some(p => (p.a === parA && p.b === parB) || (p.a === parB && p.b === parA))) { toast(t('Esa pareja ya está.')); return; }
    onChangeEf(d => ({ ...d, separar: [...d.separar, { a: parA, b: parB }] }));
    setParA(''); setParB('');
  }

  const limitaciones = (id: string) => {
    const e = exentos.get(id);
    return e ? e.limitaciones.map(l => t(LIMITACIONES.find(x => x.id === l)!.label)).concat(e.otra.trim() ? [e.otra.trim()] : []).join(' · ') || t('Exento') : '';
  };

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Equipos')}</h1>
          <p className="pg-sub">{t('Equipos equilibrados por el nivel que marcas, con chicos y chicas mezclados y separando las parejas que no conviene juntar. Quien está exento o lesionado juega en su equipo con su adaptación.')}</p>
        </div>
      </div>

      <div className="chip-row ap-alumnos" role="tablist" aria-label={t('Clase')}>
        {ordenadas.map(c => (
          <button key={c.id} type="button" role="tab" aria-selected={c.id === clase.id}
            className={`chip sm accent${c.id === clase.id ? ' on' : ''}`} onClick={() => { setClaseId(c.id); setElegido(null); setCuantos(null); }}>{c.name}</button>
        ))}
      </div>

      {alumnos.length === 0 ? (
        <div className="card"><p className="ap-vacio">{t('Esta clase todavía no tiene alumnado.')}</p></div>
      ) : (
        <>
          <div className="card">
            <div className="ef-eq-ajustes">
              <div className="fgroup" style={{ marginBottom: 0 }}>
                <label className="flabel" htmlFor="ef-eq-n">{t('Número de equipos')}</label>
                <select id="ef-eq-n" className="finput" value={n} onChange={e => setCuantos(Number(e.target.value))}>
                  {Array.from({ length: maxEquipos - 1 }, (_, i) => i + 2).map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <p className="ap-sub" style={{ marginTop: 4 }}>
                  {porEquipo[0] === porEquipo[1]
                    ? t('{a} por equipo', { a: porEquipo[0] })
                    : t('De {a} a {b} por equipo', { a: porEquipo[0], b: porEquipo[1] })}
                </p>
              </div>
              <fieldset className="ap-fs ef-eq-ops">
                <legend className="flabel">{t('Tener en cuenta')}</legend>
                <label className="td-chk"><input type="checkbox" checked={op.nivel} onChange={e => setOp({ ...op, nivel: e.target.checked })} />{t('Igualar el nivel')}</label>
                <label className="td-chk"><input type="checkbox" checked={op.sexo} onChange={e => setOp({ ...op, sexo: e.target.checked })} />{t('Mezclar chicos y chicas')}</label>
                <label className="td-chk"><input type="checkbox" checked={op.separar} onChange={e => setOp({ ...op, separar: e.target.checked })} />{t('Separar las parejas')}</label>
                {ausentes.length > 0 && (
                  <label className="td-chk"><input type="checkbox" checked={sinAusentes} onChange={e => setSinAusentes(e.target.checked)} />
                    {t(ausentes.length === 1 ? 'Sin quien falta hoy ({n})' : 'Sin quienes faltan hoy ({n})', { n: ausentes.length })}</label>
                )}
              </fieldset>
            </div>
            <div className="ap-acciones">
              <button className="btn-accent" onClick={hacer}><Shuffle size={15} />{grupos ? t('Hacer otros') : t('Hacer equipos')}</button>
            </div>
          </div>

          {grupos && (
            <div className="card">
              <div className="ap-prog-hd" style={{ marginBottom: 10 }}>
                <div className="home-card-ttl"><Users size={15} />
                  {t('Equipos del {fecha}', { fecha: fromIsoDate(guardados!.fecha).toLocaleDateString(locale, { day: 'numeric', month: 'long' }) })}
                </div>
                <button className="btn-ghost" onClick={pantallaCompleta}><Maximize2 size={15} />{t('Proyectar')}</button>
              </div>
              <p className="ap-sub" style={{ marginBottom: 10 }}>
                {elegido
                  ? t('Toca a otro alumno para cambiarlos, o «Mover aquí» en otro equipo.')
                  : t('Para retocarlos, toca a un alumno y después a otro: se cambian de equipo.')}
              </p>
              {juntas.length > 0 && (
                <p className="ap-aviso ef-eq-aviso" role="status">
                  {juntas.map(p => t('{a} y {b} están en el mismo equipo.', { a: nombre(p.a), b: nombre(p.b) })).join(' ')}
                </p>
              )}
              <div className="ef-equipos" ref={pantallaRef}>
                {grupos.map((g, i) => {
                  const col = COLORES_EQUIPO[i % COLORES_EQUIPO.length];
                  const chicas = g.filter(id => ef.sexos[id] === 'F').length;
                  const chicos = g.filter(id => ef.sexos[id] === 'M').length;
                  const media = g.length ? g.reduce((s, id) => s + (ef.niveles[id] ?? 2), 0) / g.length : 0;
                  return (
                    <div key={i} className="ef-equipo" style={{ '--eq': col.color } as React.CSSProperties}>
                      <div className="ef-equipo-hd">
                        <span className="ef-equipo-dot" aria-hidden="true" />
                        <strong>{t(col.label)}</strong>
                        <span className="ef-equipo-n">{g.length}</span>
                      </div>
                      <p className="ap-sub ef-privado">
                        {t('Nivel medio {m}', { m: media.toLocaleString(locale, { maximumFractionDigits: 1 }) })}
                        {chicas > 0 && ` · ${t(chicas === 1 ? '{n} chica' : '{n} chicas', { n: chicas })}`}
                        {chicos > 0 && ` · ${t(chicos === 1 ? '{n} chico' : '{n} chicos', { n: chicos })}`}
                      </p>
                      <ul className="ef-equipo-lista">
                        {g.map(id => (
                          <li key={id}>
                            <button type="button" className={`ef-eq-alumno${elegido === id ? ' on' : ''}`} aria-pressed={elegido === id} onClick={() => tocar(id)}>
                              <span>{nombre(id)}</span>
                              {exentos.has(id) && (
                                <span className="ef-exento ef-privado" title={exentos.get(id)!.tarea}><Bandage size={12} aria-hidden="true" />{limitaciones(id)}</span>
                              )}
                              {exentos.get(id)?.tarea.trim() && <span className="ap-sub ef-privado">{exentos.get(id)!.tarea}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                      {elegido && !g.includes(elegido) && (
                        <button type="button" className="home-link ef-privado" onClick={() => moverA(i)}>{t('Mover aquí')}</button>
                      )}
                    </div>
                  );
                })}
              </div>
              {sinEquipo.length > 0 && (
                <div className="ef-sin-equipo">
                  <div className="ap-reg-sec">{t('Sin equipo')}</div>
                  <div className="chip-row">
                    {sinEquipo.map(s => (
                      <button key={s.id} type="button" className={`chip sm accent${elegido === s.id ? ' on' : ''}`} aria-pressed={elegido === s.id}
                        onClick={() => setElegido(elegido === s.id ? null : s.id)}>{s.name}</button>
                    ))}
                  </div>
                  <p className="ap-sub">{t('Elige a quien falta y toca «Mover aquí» en su equipo.')}</p>
                </div>
              )}
            </div>
          )}

          <div className="card">
            <div className="home-card-ttl" style={{ marginBottom: 6 }}>{t('Nivel y sexo del alumnado')}</div>
            <p className="ap-sub" style={{ marginBottom: 10 }}>
              {t('El nivel lo marcas tú (1, inicial; 2, medio; 3, avanzado) y solo sirve para equilibrar los equipos. El sexo sirve para mezclar chicos y chicas y, si lo usas, para el baremo de las pruebas físicas. No se proyecta nunca.')}
            </p>
            <div className="ef-tabla-wrap" style={{ marginTop: 0 }}>
              <table className="ef-tabla ef-tabla-niveles">
                <thead><tr><th scope="col">{t('Alumno o alumna')}</th><th scope="col">{t('Nivel')}</th><th scope="col">{t('Sexo')}</th></tr></thead>
                <tbody>
                  {alumnos.map(s => (
                    <tr key={s.id}>
                      <th scope="row">{s.name}</th>
                      <td>
                        <div className="ap-trim" role="radiogroup" aria-label={t('Nivel de {nombre}', { nombre: s.name })}>
                          {NIVELES.map(v => (
                            <button key={v} type="button" role="radio" aria-checked={ef.niveles[s.id] === v}
                              className={`chip sm accent${ef.niveles[s.id] === v ? ' on' : ''}`} onClick={() => ponerNivel(s.id, v)}>{v}</button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="ap-trim" role="radiogroup" aria-label={t('Sexo de {nombre}', { nombre: s.name })}>
                          {(['F', 'M'] as const).map(v => (
                            <button key={v} type="button" role="radio" aria-checked={ef.sexos[s.id] === v}
                              className={`chip sm accent${ef.sexos[s.id] === v ? ' on' : ''}`} onClick={() => ponerSexo(s.id, v)}>
                              {v === 'F' ? t('Chica') : t('Chico')}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="home-card-ttl" style={{ marginBottom: 6 }}>{t('Parejas que separar')}</div>
            <p className="ap-sub" style={{ marginBottom: 10 }}>{t('Al hacer equipos, estas parejas van en equipos distintos.')}</p>
            {parejas.length > 0 && (
              <ul className="ap-lista" style={{ marginBottom: 12 }}>
                {parejas.map(p => (
                  <li key={`${p.a}-${p.b}`}>
                    <span className="ap-lista-txt">{nombre(p.a)} · {nombre(p.b)}</span>
                    <button className="ico-btn" aria-label={t('Quitar la pareja {a} y {b}', { a: nombre(p.a), b: nombre(p.b) })} title={t('Quitar')}
                      onClick={() => onChangeEf(d => ({ ...d, separar: d.separar.filter(x => x !== p && !(x.a === p.a && x.b === p.b)) }))}><X size={15} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="ef-pareja">
              <select className="finput" value={parA} onChange={e => setParA(e.target.value)} aria-label={t('Primer alumno de la pareja')}>
                <option value="">{t('Elige…')}</option>
                {alumnos.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className="finput" value={parB} onChange={e => setParB(e.target.value)} aria-label={t('Segundo alumno de la pareja')}>
                <option value="">{t('Elige…')}</option>
                {alumnos.filter(s => s.id !== parA).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button className="btn-ghost" onClick={anadirPareja}><Plus size={15} />{t('Añadir')}</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
