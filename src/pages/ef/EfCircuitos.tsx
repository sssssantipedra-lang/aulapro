/**
 * Educación Física, «Circuitos»: el cronómetro de estaciones, series y
 * descansos (tipo tabata), a pantalla completa y con aviso sonoro (decisión
 * del dueño, 5-10-2026). Tres pitidos cortos en los tres últimos segundos de
 * cada fase y uno largo al cambiar. Mientras corre, la pantalla no se apaga
 * si el dispositivo lo permite. Ver `docs/EF.md`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Play, Pause, Pencil, Trash2, SkipForward, SkipBack, Volume2, VolumeX, Maximize2, X, RotateCcw, Timer } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useI18n } from '../../i18n';
import { duracionCircuito, fasesCircuito, nuevoIdEF, PREPARADOS, type FaseCircuito } from '../../lib/ef';
import type { CircuitoEF, EfData } from '../../types/ef';

interface Props {
  ef: EfData;
  onChangeEf: (f: (d: EfData) => EfData) => void;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** El circuito en edición: las estaciones, una por línea. */
type Borrador = Omit<CircuitoEF, 'estaciones'> & { estaciones: string };

export function EfCircuitos({ ef, onChangeEf }: Props) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [editando, setEditando] = useState<Borrador | null>(null);
  const [enMarcha, setEnMarcha] = useState<CircuitoEF | null>(null);
  const esNuevo = !!editando && !ef.circuitos.some(c => c.id === editando.id);

  const resumen = (c: CircuitoEF) => t('{n} estaciones · {w} s de trabajo · {d} s de descanso · {r} rondas · {total} en total', {
    n: c.estaciones.length, w: c.trabajo, d: c.descanso, r: c.rondas, total: mmss(duracionCircuito(c)),
  });

  function nuevo() {
    setEditando({ id: nuevoIdEF('cir'), nombre: '', estaciones: '', trabajo: 30, descanso: 15, rondas: 2, descansoRondas: 60 });
  }

  function editar(c: CircuitoEF) {
    setEditando({ ...c, estaciones: c.estaciones.join('\n') });
  }

  const deBorrador = (b: Borrador): CircuitoEF => ({
    ...b,
    nombre: b.nombre.trim(),
    estaciones: b.estaciones.split('\n').map(x => x.trim()).filter(Boolean),
  });

  function guardar() {
    if (!editando) return;
    const c = deBorrador(editando);
    if (!c.nombre) { toast(t('Ponle un nombre al circuito.')); return; }
    if (!c.estaciones.length) { toast(t('Escribe al menos una estación.')); return; }
    if (c.trabajo < 1) { toast(t('El tiempo de trabajo tiene que ser de al menos un segundo.')); return; }
    onChangeEf(d => ({ ...d, circuitos: d.circuitos.some(x => x.id === c.id) ? d.circuitos.map(x => (x.id === c.id ? c : x)) : [...d.circuitos, c] }));
    setEditando(null);
    toast(t('✅ Guardado'));
  }

  function borrar(c: CircuitoEF) {
    if (!window.confirm(t('¿Borrar el circuito «{nombre}»?', { nombre: c.nombre }))) return;
    onChangeEf(d => ({ ...d, circuitos: d.circuitos.filter(x => x.id !== c.id) }));
    setEditando(null);
  }

  const num = (v: string, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
  const previa = editando ? deBorrador(editando) : null;

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Circuitos')}</h1>
          <p className="pg-sub">{t('Cronómetro de estaciones, series y descansos, a pantalla completa y con aviso sonoro: tres pitidos cortos antes de cada cambio y uno largo al cambiar.')}</p>
        </div>
        <button className="btn-accent" onClick={nuevo}><Plus size={15} />{t('Nuevo circuito')}</button>
      </div>

      {ef.circuitos.length === 0 ? (
        <div className="card"><p className="ap-vacio">{t('Todavía no tienes circuitos. Crea uno con sus estaciones, el tiempo de trabajo y de descanso, y las rondas.')}</p></div>
      ) : (
        <div className="card">
          <ul className="ap-lista">
            {ef.circuitos.map(c => (
              <li key={c.id}>
                <Timer size={18} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--accent-d)' }} />
                <span className="ap-lista-txt">
                  <strong>{c.nombre}</strong>
                  <span className="ap-meta">{resumen(c)}</span>
                  <span className="ap-sub">{c.estaciones.join(' · ')}</span>
                </span>
                <button className="btn-accent" onClick={() => setEnMarcha(c)}><Play size={15} />{t('Empezar')}</button>
                <button className="ico-btn" onClick={() => editar(c)} aria-label={t('Editar «{name}»', { name: c.nombre })} title={t('Editar')}><Pencil size={15} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={!!editando} onClose={() => setEditando(null)} wide title={esNuevo ? t('Nuevo circuito') : editando?.nombre}>
        {editando && previa && (
          <div className="ap-form">
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-ci-nombre">{t('Nombre')}</label>
              <input id="ef-ci-nombre" className="finput" value={editando.nombre} placeholder={t('Ej: circuito de fuerza')}
                onChange={e => setEditando({ ...editando, nombre: e.target.value })} />
            </div>
            <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
              <label className="flabel" htmlFor="ef-ci-est">{t('Estaciones, una por línea')}</label>
              <textarea id="ef-ci-est" className="finput" rows={5} value={editando.estaciones} placeholder={t('Sentadillas\nPlancha\nSaltos a la comba')}
                onChange={e => setEditando({ ...editando, estaciones: e.target.value })} />
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-ci-w">{t('Trabajo (segundos)')}</label>
              <input id="ef-ci-w" type="number" min={1} max={3600} className="finput" value={editando.trabajo}
                onChange={e => setEditando({ ...editando, trabajo: num(e.target.value, 0, 3600) })} />
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-ci-d">{t('Descanso entre estaciones (segundos)')}</label>
              <input id="ef-ci-d" type="number" min={0} max={3600} className="finput" value={editando.descanso}
                onChange={e => setEditando({ ...editando, descanso: num(e.target.value, 0, 3600) })} />
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-ci-r">{t('Rondas')}</label>
              <input id="ef-ci-r" type="number" min={1} max={20} className="finput" value={editando.rondas}
                onChange={e => setEditando({ ...editando, rondas: num(e.target.value, 1, 20) })} />
            </div>
            <div className="fgroup">
              <label className="flabel" htmlFor="ef-ci-dr">{t('Descanso entre rondas (segundos)')}</label>
              <input id="ef-ci-dr" type="number" min={0} max={3600} className="finput" value={editando.descansoRondas}
                onChange={e => setEditando({ ...editando, descansoRondas: num(e.target.value, 0, 3600) })} />
            </div>
            <p className="ap-aviso" style={{ gridColumn: '1 / -1' }}>
              {t('En total, {total}, más {p} segundos para colocarse al empezar.', { total: mmss(duracionCircuito(previa)), p: PREPARADOS })}
            </p>
            <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
              <button className="btn-accent" onClick={guardar}>{t('Guardar')}</button>
              <button className="btn-ghost" onClick={() => setEditando(null)}>{t('Cancelar')}</button>
              {!esNuevo && <button className="btn-ghost ap-borrar" onClick={() => borrar(deBorrador(editando))}><Trash2 size={14} />{t('Borrar')}</button>}
            </div>
          </div>
        )}
      </Modal>

      {enMarcha && <Cronometro circuito={enMarcha} onClose={() => setEnMarcha(null)} />}
    </section>
  );
}

/* ── El cronómetro a pantalla completa ── */

interface Reloj {
  /** La fase en curso. */
  i: number;
  /** Cuándo acaba la fase, si está en marcha (milisegundos). */
  finAt: number | null;
  /** Lo que queda de la fase si está parado (milisegundos). */
  quedan: number;
  /** La última vez que se miró la hora, para pintar lo que queda. */
  ahora: number;
  terminado: boolean;
}

/** Pasa a la fase que toque a esta hora; las que ya pasaron se saltan. */
function avanzar(r: Reloj, fases: FaseCircuito[], ahora: number): Reloj {
  if (r.finAt === null) return r;
  let { i, finAt } = r;
  while (ahora >= finAt) {
    if (i + 1 >= fases.length) return { ...r, finAt: null, quedan: 0, ahora, terminado: true };
    i += 1;
    finAt += fases[i].segundos * 1000;
  }
  return { ...r, i, finAt, ahora };
}

/** Pitidos con el altavoz del dispositivo; sin audio, basta lo que se ve. */
function pitar(ctx: AudioContext | null, tipo: 'corto' | 'largo' | 'final') {
  if (!ctx) return;
  try {
    const notas = tipo === 'corto' ? [[880, 0, 0.15]] : tipo === 'largo' ? [[1320, 0, 0.6]] : [[1320, 0, 0.35], [1320, 0.45, 0.35], [1760, 0.9, 0.8]];
    for (const [f, desde, dura] of notas) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = f;
      const t0 = ctx.currentTime + desde;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.35, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dura);
      osc.start(t0);
      osc.stop(t0 + dura + 0.02);
    }
  } catch { /* sin audio */ }
}

const ETIQUETA: Record<FaseCircuito['tipo'], string> = {
  preparados: 'Preparados',
  trabajo: 'Trabajo',
  descanso: 'Descanso',
  descansoRondas: 'Descanso entre rondas',
};

function Cronometro({ circuito, onClose }: { circuito: CircuitoEF; onClose: () => void }) {
  const { t } = useI18n();
  const fases = useMemo(() => fasesCircuito(circuito), [circuito]);
  const [r, setR] = useState<Reloj>(() => ({ i: 0, finAt: null, quedan: fases[0].segundos * 1000, ahora: 0, terminado: false }));
  const [sonido, setSonido] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const corriendo = r.finAt !== null;
  const fase = fases[r.i];
  const quedanMs = corriendo ? Math.max(0, r.finAt! - r.ahora) : r.quedan;
  const segundos = Math.ceil(quedanMs / 1000);
  const n = circuito.estaciones.length;
  const estacion = circuito.estaciones[fase.estacion] ?? '';
  const siguiente = fases.slice(r.i + 1).find(f => f.tipo === 'trabajo');

  // El reloj: cada décima mira la hora y pasa de fase si toca
  useEffect(() => {
    if (!corriendo) return;
    const id = window.setInterval(() => setR(x => avanzar(x, fases, Date.now())), 100);
    return () => window.clearInterval(id);
  }, [corriendo, fases]);

  // Los avisos: pitidos cortos en los tres últimos segundos, largo al cambiar de fase y al terminar
  // (solo cuando cambia el segundo, la fase o el final; el sonido se lee entonces)
  useEffect(() => { if (corriendo && segundos >= 1 && segundos <= 3) pitar(sonido ? audioRef.current : null, 'corto'); }, [segundos]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (r.i > 0) pitar(sonido ? audioRef.current : null, 'largo'); }, [r.i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (r.terminado) pitar(sonido ? audioRef.current : null, 'final'); }, [r.terminado]); // eslint-disable-line react-hooks/exhaustive-deps

  // Que no se apague la pantalla mientras corre, si el dispositivo lo permite
  useEffect(() => {
    if (!corriendo || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let fuera = false;
    navigator.wakeLock.request('screen').then(l => { if (fuera) l.release().catch(() => {}); else lock = l; }).catch(() => {});
    return () => { fuera = true; lock?.release().catch(() => {}); };
  }, [corriendo]);

  // A pantalla completa al abrir; al cerrar, se sale
  useEffect(() => {
    rootRef.current?.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      audioRef.current?.close().catch(() => {});
    };
  }, []);

  function marcha() {
    // El audio se crea con un toque, que es cuando los navegadores lo dejan sonar
    if (!audioRef.current) {
      try { audioRef.current = new AudioContext(); } catch { /* sin audio */ }
    }
    audioRef.current?.resume().catch(() => {});
    const ahora = Date.now();
    if (r.terminado) { setR({ i: 0, finAt: ahora + fases[0].segundos * 1000, quedan: 0, ahora, terminado: false }); return; }
    setR(x => (x.finAt === null
      ? { ...x, finAt: ahora + x.quedan, ahora }
      : { ...x, finAt: null, quedan: Math.max(0, x.finAt - ahora), ahora }));
  }

  function ir(paso: number) {
    const ahora = Date.now();
    setR(x => {
      const i = Math.max(0, Math.min(fases.length - 1, x.i + paso));
      const ms = fases[i].segundos * 1000;
      return { i, finAt: x.finAt === null ? null : ahora + ms, quedan: ms, ahora, terminado: false };
    });
  }

  function pantallaCompleta() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  }

  // Teclado: espacio para y sigue, flechas para saltar, Escape cierra
  const teclaRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    teclaRef.current = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); marcha(); }
      else if (e.key === 'ArrowRight') ir(1);
      else if (e.key === 'ArrowLeft') ir(-1);
      else if (e.key === 'Escape' && !document.fullscreenElement) onClose();
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => teclaRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const total = fase.segundos * 1000;
  const hecho = r.terminado ? 1 : total ? 1 - quedanMs / total : 1;

  return (
    <div className={`ef-crono ${r.terminado ? 'fin' : fase.tipo}`} ref={rootRef} role="dialog" aria-modal="true" aria-label={circuito.nombre}>
      <div className="ef-crono-top">
        <div className="ef-crono-info">
          <span className="ef-crono-nom">{circuito.nombre}</span>
          <span className="ef-crono-pos">
            {t('Ronda {a} de {b}', { a: fase.ronda, b: circuito.rondas })}
            {n > 0 && ` · ${t('Estación {a} de {b}', { a: fase.estacion + 1, b: n })}`}
          </span>
        </div>
        <button className="ef-crono-btn" onClick={onClose} aria-label={t('Cerrar')} title={t('Cerrar')}><X size={22} /></button>
      </div>

      <div className="ef-crono-centro" aria-live="polite">
        {r.terminado ? (
          <div className="ef-crono-fase">{t('¡Circuito terminado!')}</div>
        ) : (
          <>
            <div className="ef-crono-fase">{t(ETIQUETA[fase.tipo])}</div>
            <div className="ef-crono-est">
              {fase.tipo === 'trabajo' ? estacion : t('Ahora: {e}', { e: estacion })}
            </div>
            <div className="ef-crono-num" aria-hidden={corriendo}>{segundos >= 60 ? mmss(segundos) : segundos}</div>
            {fase.tipo === 'trabajo' && siguiente && (
              <div className="ef-crono-sig">{t('Después: {e}', { e: circuito.estaciones[siguiente.estacion] ?? '' })}</div>
            )}
          </>
        )}
      </div>

      <div className="ef-crono-barra" aria-hidden="true"><span style={{ width: `${Math.round(hecho * 100)}%` }} /></div>

      <div className="ef-crono-ctrl">
        <button className="ef-crono-btn" onClick={() => ir(-1)} disabled={r.i === 0 && !r.terminado} aria-label={t('Fase anterior')} title={t('Fase anterior')}><SkipBack size={24} /></button>
        <button className="ef-crono-btn grande" onClick={marcha}>
          {r.terminado ? <><RotateCcw size={26} />{t('Otra vez')}</>
            : corriendo ? <><Pause size={26} />{t('Pausa')}</>
            : <><Play size={26} />{r.i === 0 && r.quedan === fases[0].segundos * 1000 ? t('Empezar') : t('Seguir')}</>}
        </button>
        <button className="ef-crono-btn" onClick={() => ir(1)} disabled={r.i >= fases.length - 1 || r.terminado} aria-label={t('Fase siguiente')} title={t('Fase siguiente')}><SkipForward size={24} /></button>
        <button className="ef-crono-btn" onClick={() => setSonido(s => !s)} aria-pressed={sonido} aria-label={sonido ? t('Quitar el sonido') : t('Poner el sonido')} title={sonido ? t('Quitar el sonido') : t('Poner el sonido')}>
          {sonido ? <Volume2 size={24} /> : <VolumeX size={24} />}
        </button>
        <button className="ef-crono-btn" onClick={pantallaCompleta} aria-label={t('Pantalla completa')} title={t('Pantalla completa')}><Maximize2 size={24} /></button>
      </div>
    </div>
  );
}
