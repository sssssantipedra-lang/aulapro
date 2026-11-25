/**
 * Proyectar una ficha de ejercicios o una comprensión lectora, un ejercicio por pantalla
 * (decisión del dueño, 25-11-2026: se proyecta con una tableta o un móvil conectados al proyector,
 * y la clase ve lo mismo que el docente).
 *
 * - Una portada sencilla (el título, cuántos ejercicios hay y «Empezar»), el texto si es una
 *   comprensión lectora, un ejercicio en cada pantalla y el final con el trofeo.
 * - El ejercicio llena la pantalla: la letra crece hasta que cabe (`tamanoQueCabe`, en `lib/proyeccion.ts`)
 *   y, si ni con la letra mínima cabe, se desplaza dentro.
 * - «Ver solución» enseña la de ese ejercicio en una franja encima de su parte de abajo (no ocupa sitio,
 *   así que no encoge la letra ni descoloca lo escrito) y se oculta al pasar a otro. La tecla S hace lo mismo.
 * - El lápiz escribe encima con el dedo o el lápiz de la tableta (`Lienzo`, el de la pizarra). Lo
 *   escrito se borra al pasar de ejercicio (y el lápiz se apaga) y cuando la letra tiene que volver a
 *   ajustarse (girar la tableta, cambiar el tamaño de la ventana): ya no marcaría lo que marcaba.
 * - En una comprensión lectora, «Ver el texto» lo enseña en lugar del ejercicio, en su propia capa con su
 *   propio lápiz: el ejercicio no se vuelve a medir y lo escrito en cada uno se queda donde estaba.
 * - Se pasa de ejercicio deslizando el dedo (con el lápiz apagado), con los botones grandes de los
 *   lados, con los puntos de abajo y con las flechas del teclado.
 *
 * Sin «Marcar como completado»: pasando de uno en uno, el punto de cada ejercicio ya visto se queda
 * marcado. El escape room y las tarjetas siguen en `ChallengePresenter`.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { X, ChevronLeft, ChevronRight, Maximize2, Pencil, Eraser, Trash2, BookOpen, Eye, EyeOff, FileText } from 'lucide-react';
import type { Ficha } from '../../types';
import type { FichaExercise } from '../../services/resources';
import { fichaTheme } from '../../lib/fichaThemes';
import { useI18n } from '../../i18n';
import { partirNegritas, quitarNegritas, sinNegritasQueNoSePintan } from '../../lib/negritas';
import { sinEjerciciosSinEscribir } from '../../lib/fichaEnBlanco';
import { NOMBRE_DIFICULTAD } from '../../lib/escalera';
import {
  cabeceraDeBloque, direccionDeDeslizar, ejerciciosEnOrden, limitesDeLetra, marcaEnHoja, solucionDe, tamanoQueCabe,
} from '../../lib/proyeccion';
import { Lienzo, type EstadoLienzo, type LienzoHandle } from '../pizarra/Lienzo';
import { ATRIBUCION_MULBERRY, esMulberry } from '../../lib/pictos';
import { Ilus, ProjExercise } from './ProjExercise';
import './proyeccion.css';

/** Solo el texto de una comprensión lectora se pinta con negritas; en el resto, los asteriscos se quitan. */
const SOLO_LECTURA = new Set(['parrafos']);

/** Tres colores de lápiz que se ven en un proyector sobre la hoja blanca. */
const COLORES_LAPIZ = [
  { color: '#dc2626', nombre: 'Rojo' },
  { color: '#1d4ed8', nombre: 'Azul' },
  { color: '#15803d', nombre: 'Verde' },
] as const;
const ANCHO_LAPIZ = 6;
const ANCHO_BORRADOR = 44;

/** Lo que tiene que caber de ancho sin desplazarse: una tabla o una rejilla anchas no pueden quedarse cortadas. */
const ANCHOS = '.cp-table-wrap, .cp-rejilla-wrap';

/**
 * La zona del ejercicio: mide el sitio que hay y pone la letra más grande con la que todo cabe; si
 * ni con la mínima cabe, deja desplazar. Encima, el lienzo del lápiz, que sigue al contenido si se
 * desplaza. Se monta de nuevo con cada pantalla (va dentro de la transición), así que mide al montarse.
 * Si después la letra o el sitio cambian (girar la tableta), lo escrito se borra: ya no marcaría lo mismo.
 */
function Ajustado({ children, facil, lienzo, lienzoRef, oculto }: {
  children: ReactNode;
  facil?: boolean;
  /** El lápiz encima, si lo hay. */
  lienzo?: { activo: boolean; borrador: boolean; color: string; onEstado: (e: EstadoLienzo) => void };
  lienzoRef?: React.MutableRefObject<LienzoHandle | null>;
  /** Una capa que está debajo de otra (el ejercicio mientras se ve el texto): sigue montada, sin verse. */
  oculto?: boolean;
}) {
  const cajaRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const antes = useRef<{ px: number; w: number; h: number } | null>(null);

  const ajustar = useCallback(() => {
    const caja = cajaRef.current, fit = fitRef.current;
    const marco = fit?.parentElement;
    if (!caja || !fit || !marco) return;
    const cs = getComputedStyle(marco);
    const alto = caja.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
    if (!(alto > 0) || !(fit.clientWidth > 0)) return;
    const lim = limitesDeLetra(alto);
    // Lectura fácil: la letra no baja tanto
    const min = facil ? Math.min(lim.max, Math.round(lim.min * 1.15)) : lim.min;
    const anchos = Array.from(fit.querySelectorAll<HTMLElement>(ANCHOS));
    const cabe = (px: number) => {
      fit.style.fontSize = `${px}px`;
      return fit.scrollHeight <= alto + 1 && fit.scrollWidth <= fit.clientWidth + 1
        && anchos.every(a => a.scrollWidth <= a.clientWidth + 1);
    };
    const r = tamanoQueCabe(cabe, min, lim.max);
    fit.style.fontSize = `${r.px}px`;
    // Ni con la mínima cabe a lo ancho: la tabla se desplaza dentro, y la sombra lo avisa
    for (const a of anchos) a.classList.toggle('ancha', a.scrollWidth > a.clientWidth + 1);
    caja.classList.toggle('desborda', r.desborda);
    const ahora = { px: r.px, w: caja.clientWidth, h: caja.clientHeight };
    const prev = antes.current;
    if (prev && (prev.px !== ahora.px || Math.abs(prev.w - ahora.w) > 2 || Math.abs(prev.h - ahora.h) > 2)) lienzoRef?.current?.borrarTodo();
    antes.current = ahora;
  }, [facil, lienzoRef]);

  useLayoutEffect(() => { ajustar(); }, [ajustar]);
  useEffect(() => {
    const caja = cajaRef.current;
    if (!caja) return;
    const RO = typeof ResizeObserver === 'function' ? ResizeObserver : null;
    const obs = RO ? new RO(() => ajustar()) : null;
    obs?.observe(caja);
    // Las letras de la ficha (Lexend, la del tema) pueden llegar después: con ellas cambia lo que ocupa
    let vivo = true;
    document.fonts?.ready?.then(() => { if (vivo) ajustar(); }).catch(() => {});
    return () => { vivo = false; obs?.disconnect(); };
  }, [ajustar]);

  return (
    <div className={`cp-uno-caja${oculto ? ' oculta' : ''}`} ref={cajaRef} aria-hidden={oculto || undefined}>
      <div className="cp-uno-marco">
        <div className="cp-uno-fit" ref={fitRef}>{children}</div>
        {lienzo && (
          <Lienzo
            ref={lienzoRef}
            activo={lienzo.activo}
            herramienta={lienzo.borrador ? 'borrador' : 'rotulador'}
            color={lienzo.color}
            ancho={lienzo.borrador ? ANCHO_BORRADOR : ANCHO_LAPIZ}
            onEstado={lienzo.onEstado}
          />
        )}
      </div>
    </div>
  );
}

/** El texto de una comprensión lectora, con sus dibujos y, en lectura fácil, sus negritas. */
function TextoLectura({ lectura, pista }: { lectura: NonNullable<Ficha['content']['lectura']>; pista: boolean }) {
  return (
    <div className="cp-lectura">
      {pista && lectura.pista && <div className="cp-lectura-pista">🔍 {lectura.pista}</div>}
      <div className="cp-lectura-texto">
        {lectura.parrafos.map((p, i) => {
          const dib = lectura.dibujos.find(d => d.parrafo === i)?.ilustracion;
          return (
            <p key={i} className={lectura.genero === 'poema' ? 'verso' : undefined}>
              {dib && <Ilus id={dib} className="cp-lectura-img" />}
              {quitarNegritas(p) === p ? p : partirNegritas(p).map((x, k) => (x.negrita ? <b key={k}>{x.texto}</b> : <span key={k}>{x.texto}</span>))}
            </p>
          );
        })}
      </div>
    </div>
  );
}

/** ¿Lleva el ejercicio algún pictograma de Mulberry (consigna, dibujos o filas de una tabla)? */
const conMulberry = (ex: FichaExercise): boolean =>
  [ex.consigna, ...(ex.imagenes ?? []).map(i => i.picto), ...(ex.pictosFilas ?? [])].some(id => !!id && esMulberry(id));

/**
 * ¿Empezó el gesto sobre algo que no hay que arrastrar: una tabla (petición del dueño), un botón o algo
 * que se desplaza a los lados? Lo que solo se desplaza hacia abajo (un ejercicio largo) no cuenta: el
 * dedo en horizontal pasa de ejercicio y en vertical lo desplaza. Los botones grandes de los lados
 * tampoco cuentan: desde el borde es donde empieza el gesto de pasar página.
 */
function sobreZonaQueSeDesplaza(el: Element | null, hasta: Element | null): boolean {
  for (let n = el; n && n !== hasta; n = n.parentElement) {
    if (n.matches('table, input, textarea, select, .cp-table-wrap')) return true;
    if (n.matches('button') && !n.classList.contains('cp-lado')) return true;
    const h = n as HTMLElement;
    if (h.scrollWidth > h.clientWidth + 1) {
      const ox = getComputedStyle(h).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
}

interface Props {
  ficha: Ficha;
  onClose: () => void;
}

export function ProyeccionEjercicios({ ficha, onClose }: Props) {
  const { t } = useI18n();
  const reducir = useReducedMotion();
  const c = useMemo(() => sinNegritasQueNoSePintan(sinEjerciciosSinEscribir(ficha.content), SOLO_LECTURA), [ficha.content]);
  const theme = fichaTheme(c.estilo);
  const story = theme.historia ? c.historia : undefined;
  const acts = useMemo(() => c.actividades ?? [], [c.actividades]);
  const lista = useMemo(() => ejerciciosEnOrden(acts), [acts]);
  const lectura = c.lectura;
  const facil = c.variante === 'lectura_facil';
  // Una comprensión lectora tiene una pantalla más, antes de los ejercicios: el texto para leerlo entre todos
  const off = lectura ? 1 : 0;
  const primero = 1 + off;
  const final = lista.length + off + 1;
  // Sin nada que proyectar (una ficha empezada en blanco), la portada lo dice y no lleva a ninguna parte
  const vacia = !lectura && lista.length === 0;

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [solVisible, setSolVisible] = useState(false);
  const [verTexto, setVerTexto] = useState(false);
  // La capa del texto se queda montada (oculta) una vez abierta, para no perder lo escrito en ella
  const [textoAbierto, setTextoAbierto] = useState(false);
  const [lapiz, setLapiz] = useState(false);
  const [borrador, setBorrador] = useState(false);
  const [color, setColor] = useState<string>(COLORES_LAPIZ[0].color);
  // Lo escrito en el ejercicio y, en una lectura, en la capa del texto: cada uno tiene su lienzo
  const [trazos, setTrazos] = useState({ ej: false, tx: false });
  const [vistos, setVistos] = useState<Set<number>>(() => new Set());
  const ejRef = useRef<LienzoHandle | null>(null);
  const txRef = useRef<LienzoHandle | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const item = step >= primero && step < final ? lista[step - primero] : undefined;
  const ex = item?.ex;
  const sol = ex ? solucionDe(ex) : '';
  const enTexto = ex?.tipo === 'en_texto';
  // «Ver el texto»: en los ejercicios de una lectura que no lo llevan ya dentro
  const conCapaTexto = !!lectura && !!item && !enTexto;
  const capaTexto = conCapaTexto && verTexto;
  const conLienzo = !!item || (!!lectura && step === 1);
  const hayTrazos = capaTexto ? trazos.tx : trazos.ej;
  const lienzoActivo = () => (capaTexto ? txRef : ejRef).current;
  const cuaderno = theme.id === 'cuaderno';

  function celebrate() {
    const colors = theme.bloques.map(b => `#${b.bg}`).concat(`#${theme.claro}`);
    confetti({ particleCount: 220, spread: 120, origin: { y: 0.6 }, colors, zIndex: 100000, disableForReducedMotion: true });
  }

  function go(s: number) {
    const next = Math.max(0, Math.min(final, s));
    if (next === step || vacia) return;
    setDir(next > step ? 1 : -1);
    setStep(next);
    // Cada ejercicio empieza limpio: sin la solución, sin el texto, sin lo escrito y con el lápiz apagado
    setSolVisible(false);
    setVerTexto(false);
    setTextoAbierto(false);
    setLapiz(false);
    setBorrador(false);
    setTrazos({ ej: false, tx: false });
    if (next >= primero && next < final) setVistos(v => new Set(v).add(next - primero));
    if (next === final) celebrate();
  }

  function verSolucion() {
    // La solución es del ejercicio: si se estaba viendo el texto, se vuelve a él
    if (!solVisible) setVerTexto(false);
    setSolVisible(v => !v);
  }

  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  }

  // El manejador cambia en cada render (usa el paso actual); se escucha una sola vez y se llama al último
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyRef.current = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) { onClose(); return; }
      // Ctrl+S, Ctrl+F, Alt+flecha (atrás del navegador)… son del navegador, no de la proyección
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') go(step + 1);
      else if (e.key === 'ArrowLeft') go(step - 1);
      else if (e.key.toLowerCase() === 's' && item && sol) verSolucion();
      else if (e.key.toLowerCase() === 'f') toggleFull();
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Mientras se proyecta: la página de debajo no se mueve con el dedo (movía la barra de direcciones del
  // navegador y, con ella, el alto de la proyección), la pantalla no se apaga si el dispositivo lo permite
  // y, al salir, no se queda el confeti cayendo encima.
  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const antes = [html.style.overflow, body.style.overflow, html.style.overscrollBehavior];
    html.style.overflow = 'hidden'; body.style.overflow = 'hidden'; html.style.overscrollBehavior = 'none';
    let lock: WakeLockSentinel | null = null;
    let fuera = false;
    const pedir = () => {
      if (fuera || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      navigator.wakeLock.request('screen').then(l => { if (fuera) l.release().catch(() => {}); else lock = l; }).catch(() => {});
    };
    // El sistema suelta el bloqueo al ocultar la pestaña: se vuelve a pedir al volver
    const alVolver = () => { if (document.visibilityState === 'visible') pedir(); };
    pedir();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      fuera = true;
      [html.style.overflow, body.style.overflow, html.style.overscrollBehavior] = antes;
      document.removeEventListener('visibilitychange', alVolver);
      lock?.release().catch(() => {});
      (confetti as { reset?: () => void }).reset?.();
    };
  }, []);

  /* ── Deslizar el dedo: a la izquierda, el siguiente; a la derecha, el anterior ── */
  const gesto = useRef<{ id: number; x: number; y: number; t: number } | null>(null);
  // Un deslizamiento que acaba sobre un botón de los lados no es además un toque en él
  const deslizado = useRef(0);
  function alBajar(e: React.PointerEvent) {
    gesto.current = null;
    if (lapiz || e.pointerType === 'mouse') return;
    if (sobreZonaQueSeDesplaza(e.target as Element, e.currentTarget)) return;
    gesto.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp || performance.now() };
  }
  function alSubir(e: React.PointerEvent) {
    const g = gesto.current;
    gesto.current = null;
    if (!g || g.id !== e.pointerId || lapiz) return;
    const d = direccionDeDeslizar(e.clientX - g.x, e.clientY - g.y, (e.timeStamp || performance.now()) - g.t);
    if (d && step > 0) { deslizado.current = performance.now(); go(step + d); }
  }
  const lado = (d: 1 | -1) => () => { if (performance.now() - deslizado.current > 500) go(step + d); };

  const vars = {
    '--cp-c': `#${theme.color}`, '--cp-cd': `#${theme.oscuro}`, '--cp-cl': `#${theme.claro}`,
    '--cp-font': theme.fuenteTitulo,
  } as React.CSSProperties;
  const blockColor = (i: number) => `#${theme.bloques[i % theme.bloques.length].bg}`;
  const paso = theme.paso;
  const lienzoDe = (capa: 'ej' | 'tx', visible: boolean) => conLienzo ? {
    activo: lapiz && visible, borrador, color,
    onEstado: (e: EstadoLienzo) => setTrazos(v => (v[capa] === e.hayTrazos ? v : { ...v, [capa]: e.hayTrazos })),
  } : undefined;

  const act = item ? acts[item.bloque] : undefined;
  const cuenta = vacia
    ? t('Esta ficha aún no tiene ejercicios escritos.')
    : lectura
      ? lista.length === 0 ? t('Un texto') : lista.length === 1 ? t('Un texto y 1 ejercicio') : t('Un texto y {n} ejercicios', { n: lista.length })
      : lista.length === 1 ? t('1 ejercicio') : t('{n} ejercicios', { n: lista.length });

  const transicion = reducir ? { duration: 0 } : { duration: 0.28 };
  const desde = reducir ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 * dir };

  return (
    <div ref={rootRef} className={`cp cp-uno${facil ? ' facil' : ''}`} style={vars} role="dialog" aria-modal="true" aria-label={c.titulo}>
      {/* Barra superior: el título y, en cada ejercicio, el lápiz */}
      <div className="cp-top">
        <span className="cp-kicker">{t(theme.nombre)}</span>
        <span className="cp-top-title">{c.titulo}</span>
        <span style={{ flex: 1 }} />
        {conLienzo && (
          <div className="cp-lapiz" role="group" aria-label={t('Lápiz')}>
            <button type="button" className={`cp-ico${lapiz && !borrador ? ' on' : ''}`} aria-pressed={lapiz && !borrador}
              onClick={() => { if (lapiz && !borrador) setLapiz(false); else { setLapiz(true); setBorrador(false); } }}
              title={t(lapiz && !borrador ? 'Desactivar lápiz' : 'Escribir encima con el lápiz')} aria-label={t('Lápiz')}>
              <Pencil size={18} />
            </button>
            {lapiz && !borrador && COLORES_LAPIZ.map(k => (
              <button key={k.color} type="button" className={`cp-color${color === k.color ? ' on' : ''}`} style={{ background: k.color }}
                onClick={() => setColor(k.color)} aria-pressed={color === k.color} aria-label={t(k.nombre)} title={t(k.nombre)} />
            ))}
            <button type="button" className={`cp-ico${lapiz && borrador ? ' on' : ''}`} aria-pressed={lapiz && borrador}
              onClick={() => { if (lapiz && borrador) { setLapiz(false); setBorrador(false); } else { setLapiz(true); setBorrador(true); } }}
              title={t('Borrador')} aria-label={t('Borrador')} disabled={!hayTrazos && !(lapiz && borrador)}>
              <Eraser size={18} />
            </button>
            {/* Borrado todo, el borrador ya no sirve: se vuelve al lápiz para escribir de nuevo */}
            <button type="button" className="cp-ico" onClick={() => { lienzoActivo()?.borrarTodo(); if (borrador) setBorrador(false); }} disabled={!hayTrazos}
              title={t('Borrar todo lo escrito')} aria-label={t('Borrar todo lo escrito')}>
              <Trash2 size={18} />
            </button>
          </div>
        )}
        <button type="button" className="cp-ico" onClick={toggleFull} title={t('Pantalla completa (F)')} aria-label={t('Pantalla completa (F)')}><Maximize2 size={18} /></button>
        <button type="button" className="cp-ico" onClick={onClose} title={t('Salir (Esc)')} aria-label={t('Salir')}><X size={20} /></button>
      </div>

      {/* El bloque y el número del ejercicio, discretos */}
      {item && act && (
        <div className="cp-uno-hd">
          <span className="cp-uno-bloque">
            <span className="cp-uno-mancha" style={{ background: blockColor(item.bloque) }} />
            {cabeceraDeBloque([t(paso), paso], item.bloque + 1, act.titulo)}
            {act.dificultad && (
              <span className="cp-uno-nivel" title={t('Nivel {n} de 3', { n: act.dificultad })}>
                <span className="cp-estrellas" aria-hidden="true">{[1, 2, 3].map(k => <span key={k} className={k <= act.dificultad! ? 'on' : undefined}>★</span>)}</span>
                <i>{t(NOMBRE_DIFICULTAD[act.dificultad])}</i>
              </span>
            )}
          </span>
          <span className="cp-uno-cuenta">{t('Ejercicio {n} de {m}', { n: item.n, m: lista.length })}</span>
        </div>
      )}

      <div className="cp-uno-medio" onPointerDown={alBajar} onPointerUp={alSubir} onPointerCancel={() => { gesto.current = null; }}>
        <button type="button" className="cp-lado" onClick={lado(-1)} aria-label={t('Anterior')} title={t('Anterior')} style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>
          <ChevronLeft size={34} />
        </button>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            className="cp-uno-pantalla"
            initial={desde} animate={{ opacity: 1, x: 0 }} exit={reducir ? { opacity: 1 } : { opacity: 0, x: -40 * dir }}
            transition={transicion}
          >
            {/* Portada sencilla: el título, cuántos ejercicios y empezar */}
            {step === 0 && (
              <div className="cp-cover cp-uno-portada">
                <h1 className="cp-h1">{c.titulo}</h1>
                <div className="cp-uno-n">{cuenta}</div>
                {!vacia && <button type="button" className="cp-start" onClick={() => go(1)}>{t('Empezar')}</button>}
              </div>
            )}

            {/* El texto de una comprensión lectora, para leerlo entre todos */}
            {lectura && step === 1 && (
              <div className="cp-uno-capas">
                <Ajustado facil={facil} lienzo={lienzoDe('ej', true)} lienzoRef={ejRef}>
                  <TextoLectura lectura={lectura} pista />
                </Ajustado>
              </div>
            )}

            {/* Un ejercicio y, encima, la solución o (en una lectura) el texto */}
            {item && ex && (
              <div className="cp-uno-capas">
                <Ajustado facil={facil} lienzo={lienzoDe('ej', !capaTexto)} lienzoRef={ejRef} oculto={capaTexto}>
                  <ProjExercise
                    ex={ex} n={marcaEnHoja(acts, item.bloque, item.enBloque, cuaderno)} showSol={false} color={blockColor(item.bloque)} solo uid={`u${step}`}
                    texto={lectura && enTexto ? <TextoLectura lectura={lectura} pista={false} /> : undefined}
                  />
                </Ajustado>
                {conCapaTexto && (verTexto || textoAbierto) && (
                  <Ajustado facil={facil} lienzo={lienzoDe('tx', verTexto)} lienzoRef={txRef} oculto={!verTexto}>
                    <TextoLectura lectura={lectura!} pista={false} />
                  </Ajustado>
                )}
                {sol && solVisible && !capaTexto && (
                  <div className="cp-sol-franja" data-testid="cp-solucion" role="status">✅ {sol}</div>
                )}
              </div>
            )}
            {/* Los pictogramas de Mulberry piden su atribución allí donde se enseñan */}
            {ex && conMulberry(ex) && <div className="cp-atribucion">{ATRIBUCION_MULBERRY}</div>}

            {/* Final */}
            {step === final && (
              <div className="cp-final">
                <motion.div className="cp-badge" initial={reducir ? false : { scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 12 }}>
                  <span>{story?.emoji || '🏆'}</span>
                </motion.div>
                <h1 className="cp-h1">{t('¡Misión cumplida!')}</h1>
                {story?.insignia && <div className="cp-insignia">{story.insignia}</div>}
                {story?.cierre && <p className="cp-cierre">{story.cierre}</p>}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <button type="button" className="cp-lado" onClick={lado(1)} aria-label={t('Siguiente')} title={t('Siguiente')} style={{ visibility: step === final || vacia ? 'hidden' : 'visible' }}>
          <ChevronRight size={34} />
        </button>
      </div>

      {/* Abajo: los puntos de los ejercicios por bloque y la solución del que se ve */}
      {step > 0 && (
        <div className="cp-uno-pie">
          <nav className="cp-puntos" aria-label={t('Ejercicios')}>
            {lectura && (
              <button type="button" className={`cp-punto texto${step === 1 ? ' cur' : ''}`} onClick={() => go(1)} title={t('El texto')} aria-label={t('El texto')}>
                <BookOpen size={14} />
              </button>
            )}
            {acts.map((a, b) => {
              const delBloque = lista.filter(x => x.bloque === b);
              if (!delBloque.length) return null;
              return (
                <span key={b} className="cp-puntos-grupo" style={{ '--pc': blockColor(b) } as React.CSSProperties} title={cabeceraDeBloque([t(paso), paso], b + 1, a.titulo)}>
                  {delBloque.map(x => {
                    const s = x.n - 1 + primero;
                    return (
                      <button
                        key={x.n} type="button" className={`cp-punto${step === s ? ' cur' : ''}${vistos.has(x.n - 1) ? ' visto' : ''}`}
                        onClick={() => go(s)} aria-label={t('Ejercicio {n} de {m}', { n: x.n, m: lista.length })} aria-current={step === s ? 'step' : undefined}
                      />
                    );
                  })}
                </span>
              );
            })}
            <button type="button" className={`cp-punto fin${step === final ? ' cur' : ''}`} onClick={() => go(final)} title={t('Final')} aria-label={t('Final')}>🏆</button>
          </nav>
          <div className="cp-uno-acciones">
            {conCapaTexto && (
              <button type="button" className={`cp-chip${verTexto ? ' on' : ''}`} onClick={() => { setVerTexto(v => !v); setTextoAbierto(true); }} aria-pressed={verTexto}>
                {verTexto ? <FileText size={16} /> : <BookOpen size={16} />}{t(verTexto ? 'Volver al ejercicio' : 'Ver el texto')}
              </button>
            )}
            {item && sol && (
              <button type="button" className={`cp-chip cp-ver-sol${solVisible ? ' on' : ''}`} onClick={verSolucion} aria-pressed={solVisible} title={t('Tecla S')}>
                {solVisible ? <EyeOff size={16} /> : <Eye size={16} />}{t(solVisible ? 'Ocultar solución' : 'Ver solución')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
