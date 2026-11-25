/**
 * «Tirar de la cuerda» (25-11-2026): el juego del dueño, integrado en AulaPro. Dos equipos, cada uno con su
 * teclado, responden cuentas; cada acierto tira de la cuerda hacia su lado y gana quien la lleva hasta la meta.
 * Se abre a pantalla completa encima de la pizarra (`pages/SecClassroom.tsx`) o de Recursos, y al salir se vuelve
 * a donde se estaba.
 *
 * - Multitoque: cada tecla atiende su propio toque en `pointerdown` (no en `click`, que el navegador no da cuando hay
 *   dos dedos a la vez) y la partida es un reductor (`lib/juegos/cuerda.ts`), así que dos toques en el mismo instante
 *   se atienden los dos y en orden. `touch-action: none` en el juego: ni zoom ni desplazamiento con los dedos.
 *   Los botones que no son teclas (portada, ajustes, ganador, controles) actúan al soltar, como siempre: así se puede
 *   desplazar la lista de los ajustes con el dedo sin elegir lo que se toca. Salir o volver al inicio en mitad de una
 *   partida pide un segundo toque (los controles quedan entre los dos teclados).
 * - La vista se elige por el tamaño: en vertical, cara a cara (el equipo azul arriba, girado); en horizontal, en
 *   tres columnas. Un botón la cambia si la otra cabe (`vistasPosibles`).
 * - Tras un fallo, el equipo ve la respuesta de lo que ha fallado y su teclado espera un momento: teclear al azar
 *   no compensa.
 * - La música («Circuitos en Llamas») solo suena tras un gesto, en bucle y baja, y se para al salir; el silencio se
 *   recuerda en el dispositivo. Se pide al abrir el juego, no al instalar la app (`web/app/sw.js`).
 * - Mientras está abierto, la versión nueva de la app no se instala (`.cuerda` en `docenteOcupado`) y la pantalla
 *   no se apaga si el dispositivo lo permite.
 * Nada sale del dispositivo.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ArrowLeft, Columns3, Delete, Home, Maximize2, Minimize2, Pencil, Play, RotateCcw, Smartphone, Volume2, VolumeX, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import {
  IMAGENES_CUERDA, MAX_NOMBRE, MENOS, MUSICA_CUERDA, NIVELES, PUNTOS_PARA_GANAR, enunciado, escribirNombre, esEso, esNivel, nivelDeClase, nombreFinal,
  nuevaPartida, operacionesDe, preguntaEnPantalla, reducirPartida, resuelta, tipoParaNivel, vistaPara, vistasPosibles,
  type AccionPartida, type IndiceEquipo, type NivelCuerda, type Partida, type Pregunta, type PuntosParaGanar, type Tecla,
  type TipoCuerda, type Vista,
} from '../../lib/juegos/cuerda';

const IMG = IMAGENES_CUERDA;
const VOLUMEN = 0.25;
/** Lo que espera el teclado de un equipo tras fallar, con la respuesta a la vista. */
const ESPERA_FALLO = 1200;
/** Lo que tardan en poder pulsarse «Jugar otra vez» y «Cambiar el nivel»: quien sigue tecleando no los toca. */
const ESPERA_FIN = 1500;
/** Lo que vale el primer toque en salir o volver al inicio en mitad de una partida. */
const ESPERA_CONFIRMAR = 3000;

const CLAVE_AJUSTES = 'aulapro_cuerda';
const CLAVE_SILENCIO = 'aulapro_cuerda_silencio';

type Fase = 'inicio' | 'ajustes' | 'cuenta' | 'juego';

interface Ajustes { nivel: NivelCuerda; tipo: TipoCuerda; meta: PuntosParaGanar }

function leerAjustes(): Partial<Ajustes> {
  try {
    const a = JSON.parse(localStorage.getItem(CLAVE_AJUSTES) ?? '{}') as Record<string, unknown>;
    const nivel = esNivel(a.nivel) ? a.nivel : undefined;
    const meta = PUNTOS_PARA_GANAR.find(m => m === a.meta);
    return { nivel, tipo: nivel ? tipoParaNivel(nivel, a.tipo) : undefined, meta };
  } catch { return {}; }
}
function guardarAjustes(a: Ajustes) {
  try { localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(a)); } catch { /* sin almacenamiento */ }
}
function leerSilencio(): boolean {
  try { return localStorage.getItem(CLAVE_SILENCIO) === '1'; } catch { return false; }
}
function guardarSilencio(si: boolean) {
  try { localStorage.setItem(CLAVE_SILENCIO, si ? '1' : '0'); } catch { /* sin almacenamiento */ }
}

const semillaNueva = () => (Math.random() * 2 ** 32) >>> 0;

type Accion = AccionPartida | { tipo: 'nueva'; partida: Partida };
function reducir(p: Partida | null, a: Accion): Partida | null {
  if (a.tipo === 'nueva') return a.partida;
  return p ? reducirPartida(p, a) : p;
}

/** La música: se crea al primer gesto que la pide, suena en bucle y baja, y se para y se suelta al salir. */
function useMusica(silencio: boolean) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const quiere = useRef(false);
  /** Suena si no está en silencio; `aunqueSilencio`, al quitar el silencio (el estado aún no ha cambiado). */
  const sonar = useCallback((aunqueSilencio = false) => {
    quiere.current = true;
    if ((silencio && !aunqueSilencio) || typeof Audio === 'undefined') return;
    if (!audio.current) {
      const a = new Audio(MUSICA_CUERDA);
      a.loop = true;
      a.volume = VOLUMEN;
      audio.current = a;
    }
    audio.current.play()?.catch(() => {});
  }, [silencio]);
  /** Si ya hubo un gesto que la pidió: entonces quitar el silencio la pone ya, también en la portada. */
  const pedida = useCallback(() => quiere.current, []);
  useEffect(() => {
    if (silencio) audio.current?.pause();
  }, [silencio]);
  useEffect(() => {
    // En otra pestaña o con la pantalla apagada, calla; al volver, sigue si sonaba
    const alCambiar = () => {
      if (document.visibilityState === 'hidden') audio.current?.pause();
      else if (quiere.current && !silencio) audio.current?.play()?.catch(() => {});
    };
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, [silencio]);
  useEffect(() => () => {
    const a = audio.current;
    if (!a) return;
    a.pause();
    a.removeAttribute('src');
    a.load();
    audio.current = null;
  }, []);
  return { sonar, pedida };
}

/**
 * Un botón. Las teclas de los equipos responden al tocarlas (`pointerdown`): con dos dedos a la vez, cada uno el
 * suyo. Los demás (`alSoltar`) actúan con el `click` de siempre, al soltar: un dedo que empieza a desplazar la lista
 * de los ajustes encima de una opción no la elige. Con el teclado (Intro o espacio) llega un `click` sin puntero
 * (`detail` 0), y ese vale siempre; `onPulsar` recibe si ha sido así.
 */
function Boton({ onPulsar, alSoltar, className, children, ...resto }: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'onPointerDown'> & {
  onPulsar: (porTeclado: boolean) => void; alSoltar?: boolean;
}) {
  return (
    <button
      type="button"
      {...resto}
      className={className}
      onPointerDown={e => {
        if (alSoltar || resto.disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
        // Sin foco ni selección, y sin los eventos de ratón de compatibilidad; los demás dedos no se enteran
        e.preventDefault();
        const b = e.currentTarget;
        b.classList.add('pulsada');
        window.setTimeout(() => b.classList.remove('pulsada'), 130);
        onPulsar(false);
      }}
      onClick={e => { if (alSoltar || e.detail === 0) onPulsar(e.detail === 0); }}
    >
      {children}
    </button>
  );
}

/** Las teclas de cada vista: en columnas, como una calculadora; cara a cara, en dos filas. */
function teclasDe(vista: Vista, eso: boolean): { teclas: Tecla[]; cols: number; go: number } {
  if (vista === 'columnas') {
    return eso
      ? { teclas: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0', 'C', 'go'], cols: 3, go: 3 }
      : { teclas: ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'go'], cols: 3, go: 1 };
  }
  return eso
    ? { teclas: ['1', '2', '3', '4', '5', '-', 'C', '6', '7', '8', '9', '0', 'go'], cols: 7, go: 2 }
    : { teclas: ['1', '2', '3', '4', '5', 'C', '6', '7', '8', '9', '0', 'go'], cols: 6, go: 1 };
}

function TecladoEquipo({ equipo, vista, eso, onTecla, nombre, espera }: {
  equipo: IndiceEquipo; vista: Vista; eso: boolean; nombre: string; espera: boolean;
  onTecla: (equipo: IndiceEquipo, tecla: Tecla) => void;
}) {
  const { t } = useI18n();
  const { teclas, cols, go } = teclasDe(vista, eso);
  const etiqueta = (k: Tecla) => (k === 'go' ? 'Go' : k === '-' ? MENOS : k);
  const nombreDe = (k: Tecla) => (k === 'go' ? t('Comprobar') : k === 'C' ? t('Borrar') : k === '-' ? t('Cambiar el signo') : k);
  return (
    <div className={`cu-teclado${espera ? ' espera' : ''}`} role="group" aria-label={t('Teclado de {nombre}', { nombre })} style={{ '--cu-cols': cols, '--cu-go': go } as CSSProperties}>
      {teclas.map(k => (
        <Boton
          key={k} className={`cu-tecla${k === 'go' ? ' go' : k === 'C' ? ' borrar' : k === '-' ? ' signo' : ''}`}
          aria-label={nombreDe(k)} data-tecla={k} onPulsar={() => onTecla(equipo, k)}
        >
          {etiqueta(k)}
        </Boton>
      ))}
    </div>
  );
}

/** Los exponentes («2⁴»), con `<sup>` y la letra del juego: los superíndices de Unicode salen de otra letra y diminutos. */
function conExponentes(texto: string): ReactNode[] {
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  return texto.split(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/).map((trozo, i) =>
    (i % 2 === 1 ? <sup key={i}>{[...trozo].map(c => SUP.indexOf(c)).join('')}</sup> : trozo));
}

const LETRA_MIN = 16;
const LETRA_MAX = 120;

/**
 * La pregunta, con la letra más grande con la que cabe en su caja en una línea (se mide de verdad; el CSS solo la
 * estima para el primer pintado). Si ni con la mínima cabe, se parte por donde se puede partir.
 */
function TextoPregunta({ p, oculta, fallada }: { p: Pregunta; oculta?: boolean; fallada?: Pregunta | null }) {
  const { t, lang } = useI18n();
  const traducida = (q: Pregunta) => (q.plantilla ? t(q.plantilla.clave, q.plantilla.valores) : q.texto);
  const texto = oculta ? '?' : preguntaEnPantalla(
    fallada ? resuelta(traducida(fallada), fallada.respuesta) : enunciado(traducida(p)), lang === 'en');
  const caja = useRef<HTMLDivElement>(null);
  const linea = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const c = caja.current, l = linea.current;
    if (!c || !l) return;
    const ajustar = () => {
      const cs = getComputedStyle(c);
      const ancho = c.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      if (!(ancho > 0)) return;
      l.style.whiteSpace = 'nowrap';
      l.style.fontSize = '100px';
      const natural = l.getBoundingClientRect().width;
      if (!(natural > 0)) { l.style.fontSize = ''; l.style.whiteSpace = ''; return; }
      const alto = (parseFloat(cs.minHeight) || 0) - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
      const tope = Math.max(LETRA_MIN, Math.min(LETRA_MAX, alto > 0 ? alto / 1.2 : LETRA_MAX));
      let px = Math.min(tope, Math.floor((ancho / natural) * 100 * 0.96));
      let blanco = 'nowrap';
      if (px < LETRA_MIN) { px = LETRA_MIN; blanco = 'normal'; }
      l.style.fontSize = `${px}px`;
      l.style.whiteSpace = blanco;
    };
    ajustar();
    if (typeof ResizeObserver !== 'function') return;
    const obs = new ResizeObserver(ajustar);
    obs.observe(c);
    return () => obs.disconnect();
  }, [texto]);
  return (
    <div ref={caja} className={`cu-pregunta${fallada ? ' fallada' : ''}${oculta ? ' oculta' : ''}`} aria-live="polite">
      <span ref={linea} className="cu-pregunta-t" style={{ '--cu-len': Math.max(6, [...texto].length) } as CSSProperties}>{conExponentes(texto)}</span>
    </div>
  );
}

function TarjetaEquipo({ equipo, partida, nombre, vista, fallada, oculta, onTecla }: {
  equipo: IndiceEquipo; partida: Partida; nombre: string; vista: Vista;
  /** La pregunta que acaba de fallar, mientras se enseña su respuesta. */
  fallada: Pregunta | null;
  /** Durante la cuenta atrás no se ve la pregunta. */
  oculta: boolean;
  onTecla: (equipo: IndiceEquipo, tecla: Tecla) => void;
}) {
  const { t } = useI18n();
  const eq = partida.equipos[equipo];
  const escrito = eq.escrito.replace('-', MENOS);
  return (
    <section className={`cu-tarjeta ${equipo === 0 ? 'rojo' : 'azul'}${fallada ? ' mal' : ''}`} aria-label={nombre}>
      <div className="cu-nombre">
        <span className="cu-nombre-t">{nombre}</span>
        <span className="cu-aciertos" title={t('Aciertos')} aria-label={t('{n} aciertos', { n: eq.aciertos })}>✓ {eq.aciertos}</span>
      </div>
      <div className="cu-qa">
        <TextoPregunta p={eq.pregunta} oculta={oculta} fallada={fallada} />
        <div className={`cu-respuesta${escrito ? '' : ' vacia'}`} aria-label={t('Respuesta')}><span className="cu-respuesta-t">{escrito || '?'}</span></div>
      </div>
      <TecladoEquipo equipo={equipo} vista={vista} eso={esEso(partida.nivel)} onTecla={onTecla} nombre={nombre} espera={!!fallada} />
    </section>
  );
}

/** El teclado de los nombres: QWERTY si cabe con teclas de 44 px; si no, en orden alfabético. */
const QWERTY = ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNMÇ', 'ÁÉÍÓÚÜÀÈÒ'];
const ABC = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZÁÉÍÓÚÜÀÈÒÇ';

function EditorNombre({ inicial, color, titulo, ancho, onListo }: {
  inicial: string; color: string; titulo: string; ancho: number; onListo: (nombre: string) => void;
}) {
  const { t } = useI18n();
  const [nombre, setNombre] = useState(inicial);
  const pulsar = (k: string) => setNombre(n => escribirNombre(n, k));
  const listo = useCallback(() => onListo(nombre), [onListo, nombre]);

  // Con teclado de verdad también se escribe
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Escape cierra el nombre, no el juego: el juego escucha después
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); listo(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); setNombre(n => escribirNombre(n, 'borrar')); return; }
      if (e.key.length === 1) { e.preventDefault(); setNombre(n => escribirNombre(n, e.key)); }
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [listo]);

  const qwerty = ancho >= 600;
  return (
    <div className="cu-editor" role="dialog" aria-modal="true" aria-label={titulo} onPointerDown={e => { if (e.target === e.currentTarget) listo(); }}>
      <div className="cu-editor-caja" style={{ '--cu-c': color } as CSSProperties}>
        <div className="cu-editor-hd">
          <span>{titulo}</span>
          <Boton className="cu-ico" aria-label={t('Cerrar')} title={t('Cerrar')} onPulsar={listo}><X size={22} /></Boton>
        </div>
        <div className="cu-editor-vista" aria-live="polite">{nombre}<span className="cu-cursor">_</span></div>
        <div className="cu-editor-cuenta">{t('{n} de {m} letras', { n: [...nombre].length, m: MAX_NOMBRE })}</div>
        {qwerty ? (
          <div className="cu-letras qwerty">
            {QWERTY.map(fila => (
              <div key={fila} className="cu-letras-fila">
                {[...fila].map(c => <Boton key={c} className="cu-letra" onPulsar={() => pulsar(c)}>{c}</Boton>)}
              </div>
            ))}
          </div>
        ) : (
          <div className="cu-letras abc">
            {[...ABC].map(c => <Boton key={c} className="cu-letra" onPulsar={() => pulsar(c)}>{c}</Boton>)}
          </div>
        )}
        <div className="cu-editor-pie">
          <Boton className="cu-letra ancha" aria-label={t('Borrar la última letra')} onPulsar={() => pulsar('borrar')}><Delete size={22} /></Boton>
          <Boton className="cu-letra espacio" onPulsar={() => pulsar(' ')}>{t('Espacio')}</Boton>
          <Boton className="cu-letra listo" onPulsar={listo}>{t('Listo')}</Boton>
        </div>
      </div>
    </div>
  );
}

export interface ClaseDelJuego { name: string; etapa?: string; curso?: number }

interface Props {
  onClose: () => void;
  /** La clase activa, si la hay: de ella sale el nivel que se propone. */
  clase?: ClaseDelJuego | null;
}

export function TirarDeLaCuerda({ onClose, clase }: Props) {
  const { t } = useI18n();
  const reducirMov = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);

  /* ── Tamaño y vista ── */
  const [tam, setTam] = useState(() => ({ w: typeof window !== 'undefined' ? window.innerWidth : 1280, h: typeof window !== 'undefined' ? window.innerHeight : 720 }));
  const vistaAuto = vistaPara(tam.w, tam.h);
  const posibles = vistasPosibles(tam.w, tam.h);
  const [vistaElegida, setVistaElegida] = useState<{ vista: Vista; desde: Vista } | null>(null);
  // Lo elegido a mano vale mientras no se gire la pantalla y quepa
  const vista: Vista = vistaElegida && vistaElegida.desde === vistaAuto && posibles.includes(vistaElegida.vista)
    ? vistaElegida.vista
    : posibles.includes(vistaAuto) ? vistaAuto : posibles[0];
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    let visto = false;
    const obs = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      // Oculto (la pizarra se queda montada al ir a otra pantalla): el juego se cierra y la música se para
      if (r.width === 0 && r.height === 0) { if (visto) onCloseRef.current(); return; }
      visto = true;
      setTam(v => (Math.abs(v.w - r.width) < 1 && Math.abs(v.h - r.height) < 1 ? v : { w: r.width, h: r.height }));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ── Ajustes ── */
  const nivelClase = useMemo(() => nivelDeClase(clase), [clase]);
  const [ajustes, setAjustes] = useState<Ajustes>(() => {
    const g = leerAjustes();
    const nivel = nivelClase ?? g.nivel ?? 'p34';
    return { nivel, tipo: g.nivel === nivel && g.tipo ? g.tipo : 'mezcla', meta: g.meta ?? 3 };
  });
  const [nombres, setNombres] = useState<[string | null, string | null]>([null, null]);
  const nombreDe = (i: IndiceEquipo) => nombres[i] ?? t(i === 0 ? 'Equipo rojo' : 'Equipo azul');
  const [editando, setEditando] = useState<IndiceEquipo | null>(null);

  const [fase, setFase] = useState<Fase>('inicio');
  const [cuenta, setCuenta] = useState(3);
  const [partida, despachar] = useReducer(reducir, null);

  /* ── Música ── */
  const [silencio, setSilencio] = useState(leerSilencio);
  const { sonar, pedida } = useMusica(silencio);
  const alternarMusica = () => {
    const si = !silencio;
    setSilencio(si);
    guardarSilencio(si);
    // Quitar el silencio es un gesto: suena ya, salvo en la portada antes de la primera partida, donde aún no ha empezado
    if (!si && (fase !== 'inicio' || pedida())) sonar(true);
  };

  /* ── Pantalla completa ── */
  const [completa, setCompleta] = useState(false);
  const puedeCompleta = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  useEffect(() => {
    const alCambiar = () => setCompleta(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);
  const alternarCompleta = () => {
    if (document.fullscreenElement === rootRef.current) document.exitFullscreen?.().catch(() => {});
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  };

  /*
   * El confeti, en un lienzo dentro del juego: el de `canvas-confetti` va al `body`, y con el juego (o la pizarra) en
   * pantalla completa solo se ve lo que hay dentro del elemento en pantalla completa.
   */
  const lienzoRef = useRef<HTMLCanvasElement>(null);
  const confeti = useRef<((o: confetti.Options) => unknown) & { reset?: () => void } | null>(null);
  useEffect(() => {
    const c = lienzoRef.current;
    const crear = (confetti as { create?: typeof confetti.create }).create;
    confeti.current = c && typeof crear === 'function' ? crear(c, { resize: true, disableForReducedMotion: true }) : confetti;
    return () => { confeti.current?.reset?.(); confeti.current = null; };
  }, []);

  /* ── Mientras está abierto: sin desplazar lo de debajo, sin apagar la pantalla y, al salir, sin confeti ── */
  useEffect(() => {
    const raiz = rootRef.current;
    const html = document.documentElement, body = document.body;
    const antes = [html.style.overflow, body.style.overflow, html.style.overscrollBehavior];
    html.style.overflow = 'hidden'; body.style.overflow = 'hidden'; html.style.overscrollBehavior = 'none';
    let lock: WakeLockSentinel | null = null;
    let fuera = false;
    const pedir = () => {
      if (fuera || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      navigator.wakeLock.request('screen').then(l => { if (fuera) l.release().catch(() => {}); else lock = l; }).catch(() => {});
    };
    const alVolver = () => { if (document.visibilityState === 'visible') pedir(); };
    pedir();
    document.addEventListener('visibilitychange', alVolver);
    // Precarga de los fotogramas: al tirar no parpadean
    for (const src of [IMG.izquierda, IMG.derecha, IMG.neutral]) { const i = new Image(); i.src = src; }
    return () => {
      fuera = true;
      [html.style.overflow, body.style.overflow, html.style.overscrollBehavior] = antes;
      document.removeEventListener('visibilitychange', alVolver);
      lock?.release().catch(() => {});
      if (document.fullscreenElement && raiz?.contains(document.fullscreenElement)) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  /*
   * Los atajos de la app (Ctrl+K abre el buscador, Ctrl+Z deshace un borrado) escuchan en la ventana: con el juego
   * delante harían algo que no se ve. Mientras está abierto, no les llegan.
   */
  useEffect(() => {
    const atajo = (e: KeyboardEvent) => { if (e.ctrlKey || e.metaKey) e.stopPropagation(); };
    window.addEventListener('keydown', atajo, true);
    return () => window.removeEventListener('keydown', atajo, true);
  }, []);

  /* ── Escape: cierra el nombre si se está escribiendo; si no, sale del juego ── */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      // Con el propio juego en pantalla completa, Escape la quita (lo hace el navegador); con la pizarra en pantalla
      // completa y el juego encima, Escape sale del juego
      if (e.key !== 'Escape' || (document.fullscreenElement && document.fullscreenElement === rootRef.current)) return;
      onCloseRef.current();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  /* ── La cuenta atrás: 3, 2, 1, ¡ya! ── */
  useEffect(() => {
    if (fase !== 'cuenta') return;
    const id = window.setTimeout(() => {
      if (cuenta > 0) setCuenta(c => c - 1);
      else setFase('juego');
    }, 800);
    return () => window.clearTimeout(id);
  }, [fase, cuenta]);

  function empezar() {
    guardarAjustes(ajustes);
    despachar({ tipo: 'nueva', partida: nuevaPartida(ajustes.nivel, ajustes.tipo, ajustes.meta, semillaNueva()) });
    setCuenta(3);
    setFase('cuenta');
    setFrame('neutral');
    setFalladas([null, null]);
    setAviso(null);
    sonar();
  }

  /* ── Tirar y fallar: los efectos de la última respuesta ── */
  const [frame, setFrame] = useState<'neutral' | 'izquierda' | 'derecha'>('neutral');
  /** La pregunta que cada equipo acaba de fallar, mientras se enseña su respuesta y su teclado espera. */
  const [falladas, setFalladas] = useState<[Pregunta | null, Pregunta | null]>([null, null]);
  const enEspera = useRef<[boolean, boolean]>([false, false]);
  const tirando = useRef<number | null>(null);
  const temblores = useRef<[number | null, number | null]>([null, null]);
  const ultima = partida?.ultima;
  useEffect(() => {
    if (!ultima) return;
    const i = ultima.equipo;
    if (!ultima.acierto) {
      if (temblores.current[i] !== null) window.clearTimeout(temblores.current[i]!);
      const fallada = ultima.fallada ?? null;
      enEspera.current[i] = true;
      setFalladas(m => (i === 0 ? [fallada, m[1]] : [m[0], fallada]));
      temblores.current[i] = window.setTimeout(() => {
        temblores.current[i] = null;
        enEspera.current[i] = false;
        setFalladas(m => (i === 0 ? [null, m[1]] : [m[0], null]));
      }, ESPERA_FALLO);
      return;
    }
    const lado = i === 0 ? 'izquierda' : 'derecha';
    if (tirando.current !== null) window.clearInterval(tirando.current);
    if (reducirMov) {
      // Sin parpadeo: el fotograma de tirar, quieto, un momento
      setFrame(lado);
      tirando.current = window.setTimeout(() => { setFrame('neutral'); tirando.current = null; }, 450) as unknown as number;
      return;
    }
    let n = 0;
    setFrame(lado);
    tirando.current = window.setInterval(() => {
      n++;
      setFrame(n % 2 === 0 ? lado : 'neutral');
      if (n >= 9) { window.clearInterval(tirando.current!); tirando.current = null; setFrame('neutral'); }
    }, 150);
  }, [ultima, reducirMov]);
  useEffect(() => () => {
    if (tirando.current !== null) { window.clearInterval(tirando.current); window.clearTimeout(tirando.current); }
    for (const x of temblores.current) if (x !== null) window.clearTimeout(x);
  }, []);

  const ganador = partida?.ganador ?? null;
  // Los botones del ganador valen un momento después de ganar (se apunta la respuesta que ganó)
  const respuestaQueGana = ganador === null ? null : partida?.ultima?.n ?? null;
  const [listoTras, setListoTras] = useState<number | null>(null);
  const finListo = respuestaQueGana !== null && listoTras === respuestaQueGana;
  useEffect(() => {
    if (respuestaQueGana === null) return;
    const id = window.setTimeout(() => setListoTras(respuestaQueGana), ESPERA_FIN);
    return () => window.clearTimeout(id);
  }, [respuestaQueGana]);
  useEffect(() => {
    if (ganador === null) return;
    confeti.current?.({
      particleCount: 200, spread: 110, origin: { y: 0.55 }, zIndex: 100000, disableForReducedMotion: true,
      colors: ganador === 0 ? ['#ef4444', '#f87171', '#fde047', '#ffffff'] : ['#3b82f6', '#60a5fa', '#fde047', '#ffffff'],
    });
  }, [ganador]);

  // Durante la cuenta atrás (y con la partida acabada, que ya lo ignora el reductor) las teclas no cuentan
  const faseRef = useRef(fase);
  useLayoutEffect(() => { faseRef.current = fase; }, [fase]);
  const alTeclear = useCallback((equipo: IndiceEquipo, tecla: Tecla) => {
    if (faseRef.current === 'juego' && !enEspera.current[equipo]) despachar({ tipo: 'tecla', equipo, tecla });
  }, []);

  /* ── Salir o volver al inicio en mitad de una partida: con un segundo toque ── */
  const [aviso, setAviso] = useState<'salir' | 'inicio' | null>(null);
  useEffect(() => {
    if (!aviso) return;
    const id = window.setTimeout(() => setAviso(null), ESPERA_CONFIRMAR);
    return () => window.clearTimeout(id);
  }, [aviso]);
  const enPartida = fase === 'juego' && ganador === null;
  /** Con el teclado (o desde el botón de atrás, que pulsa «Salir»), sale a la primera; con el dedo, al segundo toque. */
  const pedir = (que: 'salir' | 'inicio', porTeclado: boolean) => {
    if (enPartida && !porTeclado && aviso !== que) { setAviso(que); return; }
    setAviso(null);
    if (que === 'salir') onCloseRef.current();
    else setFase('inicio');
  };

  /* ── Piezas ── */
  const barra = (
    <div className="cu-barra" role="toolbar" aria-label={t('Controles del juego')}>
      {fase !== 'inicio' && (
        <Boton alSoltar className={`cu-ico${aviso === 'inicio' ? ' armada' : ''}`} aria-label={t('Volver al inicio del juego')} title={t('Volver al inicio del juego')} onPulsar={k => pedir('inicio', k)}><Home size={22} /></Boton>
      )}
      <Boton alSoltar className="cu-ico" aria-label={t(silencio ? 'Poner la música' : 'Quitar la música')} title={t(silencio ? 'Poner la música' : 'Quitar la música')} aria-pressed={!silencio} onPulsar={alternarMusica}>
        {silencio ? <VolumeX size={22} /> : <Volume2 size={22} />}
      </Boton>
      {(fase === 'juego' || fase === 'cuenta') && posibles.length > 1 && (
        <Boton
          alSoltar className="cu-ico"
          aria-label={t(vista === 'cara' ? 'Ver en tres columnas' : 'Ver cara a cara')} title={t(vista === 'cara' ? 'Ver en tres columnas' : 'Ver cara a cara')}
          onPulsar={() => setVistaElegida({ vista: vista === 'cara' ? 'columnas' : 'cara', desde: vistaAuto })}
        >
          {vista === 'cara' ? <Columns3 size={22} /> : <Smartphone size={22} />}
        </Boton>
      )}
      {puedeCompleta && (
        <Boton alSoltar className="cu-ico" aria-label={t(completa ? 'Salir de la pantalla completa' : 'Pantalla completa')} title={t(completa ? 'Salir de la pantalla completa' : 'Pantalla completa')} onPulsar={alternarCompleta}>
          {completa ? <Minimize2 size={22} /> : <Maximize2 size={22} />}
        </Boton>
      )}
      <Boton alSoltar className={`cu-ico salir${aviso === 'salir' ? ' armada' : ''}`} aria-label={t('Salir')} title={t('Salir (Esc)')} onPulsar={k => pedir('salir', k)}><X size={24} /></Boton>
      {aviso && (
        <span className="cu-confirmar" role="status">
          {t(aviso === 'salir' ? 'Toca otra vez la X para salir de la partida' : 'Toca otra vez para volver al inicio')}
        </span>
      )}
    </div>
  );

  const eso = esEso(ajustes.nivel);
  const ops = operacionesDe(ajustes.nivel);
  const nivelDeLaClase = nivelClase ? NIVELES.find(n => n.id === nivelClase) : undefined;

  return (
    <div
      ref={rootRef} className={`cuerda${reducirMov ? ' quieta' : ''}`} role="dialog" aria-modal="true" aria-label={t('Tirar de la cuerda')}
      data-vista={vista} data-fase={fase} data-eso={eso ? 'si' : undefined}
      // Una pulsación larga (Android, una pantalla táctil con Windows) no abre el menú del navegador
      onContextMenu={e => e.preventDefault()}
    >
      <canvas ref={lienzoRef} className="cu-confeti" aria-hidden="true" />
      {fase !== 'juego' && fase !== 'cuenta' && <div className="cu-barra-fija">{barra}</div>}

      {fase === 'inicio' && (
        <div className="cu-inicio">
          <h1 className="cu-titulo">{t('Tirar de la cuerda')}</h1>
          <p className="cu-sub">{t('Toca el nombre de un equipo para cambiarlo')}</p>
          <div className="cu-equipos">
            {([0, 1] as const).map(i => (
              <div key={i} className={`cu-equipo ${i === 0 ? 'rojo' : 'azul'}`}>
                <img src={i === 0 ? IMG.rojo : IMG.azul} alt="" draggable={false} />
                <Boton alSoltar className="cu-equipo-nombre" aria-label={t('Cambiar el nombre: {nombre}', { nombre: nombreDe(i) })} onPulsar={() => setEditando(i)}>
                  <span>{nombreDe(i)}</span><Pencil size={16} aria-hidden="true" />
                </Boton>
              </div>
            ))}
            <span className="cu-vs" aria-hidden="true">VS</span>
          </div>
          <Boton alSoltar className="cu-jugar" onPulsar={() => { sonar(); setFase('ajustes'); }}>{t('¡A jugar!')}</Boton>
          <p className="cu-credito">Santi Pedra - AulaPro</p>
        </div>
      )}

      {fase === 'ajustes' && (
        <div className="cu-ajustes">
          <div className="cu-ajustes-lista">
          <div className="cu-ajustes-in">
            <h2 className="cu-h2">{t('Elige el nivel')}</h2>
            {nivelDeLaClase && clase && (
              <p className="cu-pista">{t('Propuesto por la clase {clase}: {nivel}', { clase: clase.name, nivel: t(nivelDeLaClase.nombre) })}</p>
            )}
            <div className="cu-opciones" role="radiogroup" aria-label={t('Nivel')}>
              {NIVELES.map(n => (
                <Boton
                  alSoltar
                  key={n.id} role="radio" aria-checked={ajustes.nivel === n.id} className={`cu-opcion${ajustes.nivel === n.id ? ' sel' : ''}`}
                  onPulsar={() => setAjustes(a => ({ ...a, nivel: n.id, tipo: tipoParaNivel(n.id, a.tipo) }))}
                >
                  {t(n.nombre)}
                </Boton>
              ))}
            </div>
            <h2 className="cu-h2">{t('Elige la operación')}</h2>
            <div className="cu-opciones" role="radiogroup" aria-label={t('Operación')}>
              {[...ops, { id: 'mezcla' as const, nombre: 'Mezcla', signo: '🔀' }].map(o => (
                <Boton
                  alSoltar
                  key={o.id} role="radio" aria-checked={ajustes.tipo === o.id} className={`cu-opcion${ajustes.tipo === o.id ? ' sel' : ''}`}
                  onPulsar={() => setAjustes(a => ({ ...a, tipo: o.id }))}
                >
                  <span className="cu-signo" aria-hidden="true">{o.signo}</span>{t(o.nombre)}
                </Boton>
              ))}
            </div>
            <h2 className="cu-h2">{t('Puntos para ganar')}</h2>
            <div className="cu-opciones" role="radiogroup" aria-label={t('Puntos para ganar')}>
              {PUNTOS_PARA_GANAR.map(m => (
                <Boton
                  alSoltar
                  key={m} role="radio" aria-checked={ajustes.meta === m} className={`cu-opcion corta${ajustes.meta === m ? ' sel' : ''}`}
                  onPulsar={() => setAjustes(a => ({ ...a, meta: m }))}
                >
                  {m}
                </Boton>
              ))}
            </div>
          </div>
          </div>
          <div className="cu-ajustes-pie">
            <Boton alSoltar className="cu-secundario" onPulsar={() => setFase('inicio')}><ArrowLeft size={20} aria-hidden="true" />{t('Cambiar equipos')}</Boton>
            <Boton alSoltar className="cu-jugar" onPulsar={empezar}><Play size={22} aria-hidden="true" />{t('Empezar')}</Boton>
          </div>
        </div>
      )}

      {(fase === 'juego' || fase === 'cuenta') && partida && (
        <div className="cu-juego" data-vista={vista}>
          <TarjetaEquipo equipo={0} partida={partida} nombre={nombreDe(0)} vista={vista} fallada={falladas[0]} oculta={fase === 'cuenta'} onTecla={alTeclear} />
          <div className="cu-centro">
            {ganador === null ? barra : <div className="cu-barra-hueco" aria-hidden="true" />}
            {vista === 'columnas' && <div className="cu-centro-titulo">{t('Tirar de la cuerda')}</div>}
            <div className="cu-zona">
              <div className="cu-cuerda" style={{ '--cu-b': partida.balance / partida.meta } as CSSProperties}>
                <img src={IMG[frame]} alt={t('Los dos robots tiran de la cuerda')} draggable={false} />
              </div>
            </div>
            <div className="cu-pista-marcador" aria-label={t('La cuerda: {n} de {m} hacia {equipo}', {
              n: Math.abs(partida.balance), m: partida.meta, equipo: partida.balance <= 0 ? nombreDe(0) : nombreDe(1),
            })}>
              {Array.from({ length: partida.meta * 2 + 1 }, (_, k) => {
                const pos = k - partida.meta;
                return <span key={k} className={`cu-marca${pos === partida.balance ? ' aqui' : ''}${pos < 0 ? ' rojo' : pos > 0 ? ' azul' : ''}`} />;
              })}
            </div>
            {vista === 'columnas' && <div className="cu-ayuda">{t('¡Responde para tirar!')}</div>}
          </div>
          <TarjetaEquipo equipo={1} partida={partida} nombre={nombreDe(1)} vista={vista} fallada={falladas[1]} oculta={fase === 'cuenta'} onTecla={alTeclear} />

          {fase === 'cuenta' && (
            <div className="cu-cuenta" aria-live="assertive">
              {/* Cara a cara, también derecha para el equipo azul, que lee desde el otro lado */}
              {vista === 'cara' && <span key={`a${cuenta}`} className="cu-cuenta-n girada" aria-hidden="true">{cuenta > 0 ? cuenta : t('¡Ya!')}</span>}
              <span key={cuenta} className="cu-cuenta-n">{cuenta > 0 ? cuenta : t('¡Ya!')}</span>
            </div>
          )}

          {ganador !== null && (
            <div className="cu-fin" role="status">
              <div className="cu-barra-fija">{barra}</div>
              {vista === 'cara' && (
                <div className={`cu-fin-espejo ${ganador === 0 ? 'rojo' : 'azul'}`} aria-hidden="true">
                  <span className="cu-trofeo">🏆</span>
                  <span className="cu-fin-t">{t('¡Victoria de {nombre}!', { nombre: nombreDe(ganador) })}</span>
                </div>
              )}
              <div className={`cu-fin-caja ${ganador === 0 ? 'rojo' : 'azul'}${finListo ? '' : ' espera'}`}>
                <div className="cu-trofeo" aria-hidden="true">🏆</div>
                <img src={ganador === 0 ? IMG.rojo : IMG.azul} alt="" className="cu-fin-img" draggable={false} />
                <h2 className="cu-fin-t">{t('¡Victoria de {nombre}!', { nombre: nombreDe(ganador) })}</h2>
                <p className="cu-fin-datos">
                  {([0, 1] as const).map(i => (
                    <span key={i}>{t('{nombre}: {n} aciertos', { nombre: nombreDe(i), n: partida.equipos[i].aciertos })}</span>
                  ))}
                </p>
                <div className="cu-fin-botones">
                  <Boton alSoltar disabled={!finListo} className="cu-jugar" onPulsar={empezar}><RotateCcw size={22} aria-hidden="true" />{t('Jugar otra vez')}</Boton>
                  <Boton alSoltar disabled={!finListo} className="cu-secundario" onPulsar={() => setFase('ajustes')}>{t('Cambiar el nivel')}</Boton>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {editando !== null && (
        <EditorNombre
          inicial={nombres[editando] ?? ''}
          color={editando === 0 ? '#dc2626' : '#2563eb'}
          titulo={t(editando === 0 ? 'Nombre del equipo rojo' : 'Nombre del equipo azul')}
          ancho={tam.w}
          onListo={n => {
            const i = editando;
            setNombres(v => (i === 0 ? [nombreFinal(n), v[1]] : [v[0], nombreFinal(n)]));
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

export default TirarDeLaCuerda;
