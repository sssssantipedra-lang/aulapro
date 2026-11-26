/**
 * «La recta numérica» (26-11-2026), el segundo juego de matemáticas. Sale un número; cada equipo tiene su propia
 * recta (su mitad de la pantalla o, en vertical, cara a cara) y lleva su marcador con el dedo hasta donde cree que
 * está; lo fija con «¡Aquí!». Cuando lo han fijado los dos, o se acaba el tiempo (la barra de abajo), el número cae en
 * su sitio, una regla mide lo lejos que ha quedado cada uno y gana el punto quien está más cerca (empate exacto,
 * punto para los dos). Se juega a 5, 7 o 10 rondas, con desempate. La lógica está en `lib/juegos/recta.ts`.
 *
 * - Multitoque: cada recta atiende a su propio dedo (`setPointerCapture` con su `pointerId`), así que los dos equipos
 *   arrastran a la vez; `touch-action: none` en todo el juego. Con el teclado: el rojo, A y D para mover y S para
 *   fijar; el azul, ← y → y ↓ (con Mayúsculas, a saltos grandes).
 * - Que nadie copie: al fijarlo, el marcador se esconde hasta revelar («¡Listo!»).
 * - En Primaria, un escenario con cielo, un puente que es la recta y una mascota por equipo; en ESO, el mismo juego
 *   más sobrio. Los dibujos importantes son «huecos de imagen» (`useHueco`): si el dueño deja el suyo en
 *   `public/juegos/recta/`, se usa; si no, el de código (docs/JUEGOS.md, tabla de huecos).
 * - Con «reducir movimiento», sin saltos ni caídas: el número aparece en su sitio.
 * Nada sale del dispositivo.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowLeft, Home, Maximize2, Minimize2, Pencil, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { nombreFinal, vistaPara, type Vista } from '../../lib/juegos/cuerda';
import { TRAMOS, esEso, esTramo, tramoDeClase, type ClaseDelJuego, type Tramo } from '../../lib/juegos/tramos';
import {
  DIANA, MEZCLA, RONDAS, TIEMPOS, VARIANTES, distanciaEnTexto, escribir, etiquetaDeMarca, fraccionDe, longitud, marcasDe,
  nuevaPartidaRecta, reducirRecta, tiempoDeTramo, valorEn, valorEnTexto, varianteParaTramo,
  type AccionRecta, type IndiceEquipo, type Muestra, type PartidaRecta, type RondasRecta, type TiempoRecta,
} from '../../lib/juegos/recta';
import { guardarSilencioJuegos, leerSilencioJuegos, sonarEfecto, type Efecto } from '../../lib/juegos/efectos';
import { Boton } from './Boton';
import { EditorNombre } from './EditorNombre';
import { useConfeti, useHueco, useJuegoAbierto, usePantallaCompleta, useSegundoToque } from './usoJuego';

/** Los huecos de imagen de este juego (docs/JUEGOS.md). */
const HUECO = (n: string) => `juegos/recta/${n}.webp`;
/** Las versiones de código usan los dibujos del catálogo de la app (`public/ilustraciones/`). */
const ILUS = (n: string) => `ilustraciones/${n}.webp`;
const MASCOTA_CODIGO: [string, string] = [ILUS('ani-zorro'), ILUS('ani-pinguino')];

const CLAVE_AJUSTES = 'aulapro_recta';
/** Lo que se tarda en poder pasar de ronda tras revelar: se ve caer el número y la regla. */
const ESPERA_REVELAR = 1600;
const ESPERA_FIN = 1500;

type Fase = 'inicio' | 'ajustes' | 'cuenta' | 'juego';
type Pose = 'quieta' | 'corriendo' | 'saltando' | 'celebrando' | 'triste';
interface Ajustes { tramo: Tramo; variante: string; rondas: RondasRecta; tiempo: TiempoRecta }

function leerAjustes(): Partial<Ajustes> {
  try {
    const a = JSON.parse(localStorage.getItem(CLAVE_AJUSTES) ?? '{}') as Record<string, unknown>;
    const tramo = esTramo(a.tramo) ? a.tramo : undefined;
    return {
      tramo, variante: tramo ? varianteParaTramo(tramo, a.variante) : undefined,
      rondas: RONDAS.find(r => r === a.rondas), tiempo: TIEMPOS.find(x => x === a.tiempo),
    };
  } catch { return {}; }
}
function guardarAjustes(a: Ajustes) {
  try { localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(a)); } catch { /* sin almacenamiento */ }
}
const semillaNueva = () => (Math.random() * 2 ** 32) >>> 0;

type Accion = AccionRecta | { tipo: 'nueva'; partida: PartidaRecta };
function reducir(p: PartidaRecta | null, a: Accion): PartidaRecta | null {
  if (a.tipo === 'nueva') return a.partida;
  return p ? reducirRecta(p, a) : p;
}

/* ── Dibujos ── */

/** La mascota de un equipo en una pose: el dibujo del dueño de esa pose, el suyo quieto con la pose de código, o el del catálogo. */
function Mascota({ equipo, pose }: { equipo: IndiceEquipo; pose: Pose }) {
  const color = equipo === 0 ? 'roja' : 'azul';
  const propia = useHueco(HUECO(`mascota-${color}-${pose}`));
  const quieta = useHueco(HUECO(`mascota-${color}-quieta`));
  const src = propia ?? quieta ?? MASCOTA_CODIGO[equipo];
  // Con el dibujo de la pose, sin movimiento de código encima (salvo el salto, que es de sitio)
  return <img className={`rn-mascota pose-${pose}${propia ? ' propia' : ''}`} src={src} alt="" draggable={false} />;
}

/** El fondo de un panel: el dibujo del dueño para su tramo y su forma, o el escenario de código. */
function Fondo({ tramo, forma }: { tramo: Tramo; forma: 'ancho' | 'alto' }) {
  const src = useHueco(HUECO(`fondo-${tramo}-${forma}`));
  if (src) return <img className="rn-fondo-img" src={src} alt="" draggable={false} />;
  if (esEso(tramo)) return <div className="rn-fondo eso" aria-hidden="true" />;
  return (
    <div className="rn-fondo prim" aria-hidden="true">
      <img className="rn-sol" src={ILUS('nat-sol')} alt="" draggable={false} />
      <span className="rn-nube n1" /><span className="rn-nube n2" />
      <span className="rn-colina c1" /><span className="rn-colina c2" />
      <img className="rn-arbol a1" src={ILUS('nat-arbol')} alt="" draggable={false} />
      <img className="rn-arbol a2" src={ILUS('nat-arbol')} alt="" draggable={false} />
      <span className="rn-rio" />
    </div>
  );
}

/** La estrella que cae en el número y la bandera que se queda: los dibujos del dueño o los de código. */
function Estrella({ className }: { className?: string }) {
  const src = useHueco(HUECO('estrella')) ?? ILUS('esp-estrella');
  return <img className={className} src={src} alt="" draggable={false} />;
}
function Bandera() {
  const src = useHueco(HUECO('bandera'));
  if (src) return <img className="rn-bandera-img" src={src} alt="" draggable={false} />;
  return <span className="rn-bandera" aria-hidden="true"><span className="rn-bandera-tela" /></span>;
}
function Trofeo() {
  const src = useHueco(HUECO('trofeo'));
  return src ? <img className="rn-trofeo-img" src={src} alt="" draggable={false} /> : <span className="rn-trofeo">🏆</span>;
}

/** Una fracción apilada, con el signo delante. */
function Fraccion({ num, den }: { num: number; den: number }) {
  return (
    <span className="rn-fr-g">
      {num < 0 && <span className="rn-signo">−</span>}
      <span className="rn-fr"><span>{Math.abs(num)}</span><span>{den}</span></span>
    </span>
  );
}

/** El número que hay que encontrar, como se enseña. */
function NumeroMuestra({ m, ingles }: { m: Muestra; ingles: boolean }) {
  const { t } = useI18n();
  const n = (x: number) => escribir(x, Number.isInteger(x) ? 0 : String(x).split('.')[1].length, ingles);
  const por = ingles ? '×' : '·', entre = ingles ? '÷' : ':';
  switch (m.tipo) {
    case 'numero': return <span>{escribir(m.n, m.decimales, ingles)}</span>;
    case 'fraccion': return <Fraccion num={m.num} den={m.den} />;
    case 'raiz': return <span className="rn-raiz">√<span className="rn-raiz-in">{m.radicando}</span></span>;
    case 'producto': return <span>{n(m.a)} {por} {m.b}</span>;
    case 'cociente': return <span>{m.a} {entre} {m.b}</span>;
    case 'cuadrado': return <span>{n(m.a)}<sup>2</sup></span>;
    case 'porcentajeDe': return <span>{t('{p} % de {n}', { p: m.p, n: m.n })}</span>;
    case 'fraccionDe': return <span className="rn-fr-g"><Fraccion num={m.num} den={m.den} />&nbsp;{t('de {n}@@recta', { n: m.n })}</span>;
    case 'enPorcentaje': return <NumeroMuestra m={m.muestra} ingles={ingles} />;
  }
}

/** El número con puntos en marcos de diez (1.º y 2.º de Primaria). */
function MarcosDeDiez({ n, equipo }: { n: number; equipo: IndiceEquipo }) {
  const marcos = n > 10 ? 2 : 1;
  return (
    <span className={`rn-marcos e${equipo}`} aria-hidden="true">
      {Array.from({ length: marcos }, (_, k) => (
        <span key={k} className="rn-marco">
          {Array.from({ length: 10 }, (_, c) => <span key={c} className={`rn-celda${k * 10 + c < n ? ' llena' : ''}`} />)}
        </span>
      ))}
    </span>
  );
}

/* ── El panel de cada equipo ── */

interface PropsPanel {
  equipo: IndiceEquipo;
  partida: PartidaRecta;
  nombre: string;
  otro: string;
  girada: boolean;
  forma: 'ancho' | 'alto';
  oculta: boolean;
  reducirMov: boolean;
  siguienteListo: boolean;
  segundos: number;
  onMover: (i: IndiceEquipo, valor: number) => void;
  onSoltar: (i: IndiceEquipo) => void;
  onFijar: (i: IndiceEquipo) => void;
  onSiguiente: () => void;
}

function PanelEquipo(p: PropsPanel) {
  const { t, lang } = useI18n();
  const ingles = lang === 'en';
  const { partida, equipo: i } = p;
  const { objetivo, fase } = partida;
  const r = objetivo.recta;
  const eq = partida.equipos[i];
  const eso = esEso(partida.tramo);
  const revelada = fase !== 'apuntando';
  const ronda = revelada ? partida.historial[partida.historial.length - 1] : null;
  const pista = useRef<HTMLDivElement>(null);
  const activo = useRef<number | null>(null);
  const pendiente = useRef<number | null>(null);
  const cuadro = useRef(0);
  const [arrastrando, setArrastrando] = useState(false);
  const puede = fase === 'apuntando' && !eq.fijado && !p.oculta;

  const valorDe = (x: number) => {
    const b = pista.current?.getBoundingClientRect();
    if (!b || !(b.width > 0)) return null;
    let f = (x - b.left) / b.width;
    // Cara a cara, el panel de arriba va girado: su izquierda está a la derecha de la pantalla
    if (p.girada) f = 1 - f;
    return valorEn(r, f);
  };
  const vaciar = () => {
    if (cuadro.current) { cancelAnimationFrame(cuadro.current); cuadro.current = 0; }
    if (pendiente.current !== null) { p.onMover(i, pendiente.current); pendiente.current = null; }
  };
  /** Un movimiento por fotograma, como mucho: dos dedos moviéndose no saturan la pantalla. */
  const mover = (x: number) => {
    const v = valorDe(x);
    if (v === null) return;
    pendiente.current = v;
    if (!cuadro.current && typeof requestAnimationFrame === 'function') cuadro.current = requestAnimationFrame(() => { cuadro.current = 0; vaciar(); });
    else if (typeof requestAnimationFrame !== 'function') vaciar();
  };
  useEffect(() => () => { if (cuadro.current) cancelAnimationFrame(cuadro.current); }, []);
  const soltar = () => {
    vaciar();
    activo.current = null;
    setArrastrando(false);
    p.onSoltar(i);
  };

  const fMarcador = eq.pos === null ? null : fraccionDe(r, eq.pos);
  const fValor = fraccionDe(r, objetivo.valor);
  const marcas = useMemo(() => marcasDe(r), [r]);
  const gano = ronda?.ganadores.includes(i) ?? false;
  const solo = gano && ronda?.ganadores.length === 1;
  const dist = ronda?.distancias[i] ?? null;
  const diana = dist !== null && dist <= DIANA;
  const pose: Pose = revelada
    ? (eq.pos === null ? 'triste' : gano ? 'celebrando' : 'triste')
    : arrastrando ? 'corriendo' : eq.pos === null ? 'quieta' : 'saltando';
  const verMarcador = eq.pos !== null && (revelada || !eq.fijado);
  // Marcas con número: todas si caben; si no, una de cada dos
  const anchoMarca = 100 / Math.max(1, marcas.length - 1);
  const conNumero = (k: number, mayor: boolean) => mayor && (marcas.length <= 21 || k % 2 === 0 || r.min < 0);
  const enPct = objetivo.muestra.tipo === 'enPorcentaje';

  let resultado: string;
  if (!ronda) resultado = '';
  else if (ronda.ganadores.length === 0) resultado = t('Nadie ha puesto su marcador');
  else if (ronda.ganadores.length === 2) resultado = t('¡Empate! Punto para los dos');
  else resultado = t('Punto para {nombre}', { nombre: solo ? p.nombre : p.otro });

  return (
    <section
      className={`rn-panel e${i}${p.girada ? ' girada' : ''}${eq.fijado && !revelada ? ' listo' : ''}${revelada ? (gano ? ' gana' : ' pierde') : ''}`}
      aria-label={p.nombre}
    >
      <div className="rn-cab">
        <span className="rn-nombre">{p.nombre}</span>
        <span className="rn-puntos" aria-label={t('{n} puntos', { n: eq.puntos })}>
          <Estrella className="rn-puntos-e" />{eq.puntos}
        </span>
      </div>

      <div className={`rn-tarjeta${p.oculta ? ' oculta' : ''}`}>
        <span className="rn-pregunta">{t(enPct ? '¿Dónde está en la recta del 0 al 100 %?' : '¿Dónde está?')}</span>
        <span className="rn-numero" aria-live="polite">{p.oculta ? '?' : <NumeroMuestra m={objetivo.muestra} ingles={ingles} />}</span>
        {objetivo.conPuntos && !p.oculta && objetivo.muestra.tipo === 'numero' && <MarcosDeDiez n={objetivo.muestra.n} equipo={i} />}
      </div>

      <div
        className={`rn-escena${puede ? ' activa' : ''}`}
        onPointerDown={e => {
          if (!puede || (e.pointerType === 'mouse' && e.button !== 0) || activo.current !== null) return;
          e.preventDefault();
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
          activo.current = e.pointerId;
          setArrastrando(true);
          mover(e.clientX);
        }}
        onPointerMove={e => { if (e.pointerId === activo.current) mover(e.clientX); }}
        onPointerUp={e => { if (e.pointerId === activo.current) soltar(); }}
        onPointerCancel={e => { if (e.pointerId === activo.current) soltar(); }}
        onLostPointerCapture={e => { if (e.pointerId === activo.current) soltar(); }}
      >
        <Fondo tramo={partida.tramo} forma={p.forma} />
        <div className="rn-recta-zona">
          <div ref={pista} className="rn-pista" role="img" aria-label={t('Recta del {a} al {b}', { a: etiquetaDeMarca(r, r.min, ingles), b: etiquetaDeMarca(r, r.max, ingles) })}>
            <span className="rn-tablon" />
            {marcas.map((m, k) => (
              <span key={k} className={`rn-marca${m.mayor ? ' mayor' : ''}`} style={{ left: `${k * anchoMarca}%` }}>
                {conNumero(k, m.mayor) && <span className="rn-etiqueta">{etiquetaDeMarca(r, m.x, ingles)}</span>}
              </span>
            ))}

            {verMarcador && fMarcador !== null && (
              <span className={`rn-marcador e${i}${arrastrando ? ' arrastra' : ''}`} style={{ left: `${fMarcador * 100}%` }}>
                {!eso && <Mascota equipo={i} pose={pose} />}
                {eso && <span className="rn-pin" />}
                <span className="rn-aguja" />
              </span>
            )}
            {eq.pos === null && fase === 'apuntando' && !p.oculta && (
              <span className="rn-salida" aria-hidden="true">{eso ? <span className="rn-pin fantasma" /> : <Mascota equipo={i} pose="quieta" />}</span>
            )}

            {revelada && (
              <>
                {eq.pos !== null && (
                  <span className={`rn-regla${diana ? ' diana' : ''}`} style={{ left: `${Math.min(fMarcador!, fValor) * 100}%`, width: `${Math.abs(fMarcador! - fValor) * 100}%` }}>
                    <span className="rn-regla-t">{distanciaEnTexto(r, eq.pos, objetivo.valor, ingles)}</span>
                  </span>
                )}
                <span className={`rn-punto${p.reducirMov ? ' quieto' : ''}`} style={{ left: `${fValor * 100}%` }}>
                  <span className="rn-punto-valor">
                    {objetivo.muestra.tipo === 'fraccion' ? <Fraccion num={objetivo.muestra.num} den={objetivo.muestra.den} /> : valorEnTexto(objetivo, ingles)}
                  </span>
                  {eso ? <span className="rn-linea-oro" /> : <Bandera />}
                  {!eso && <Estrella className="rn-cae" />}
                </span>
              </>
            )}
          </div>
        </div>
        {eq.fijado && !revelada && <span className="rn-listo" role="status">{t('¡Listo!')}</span>}
        {fase === 'apuntando' && eq.pos === null && !p.oculta && (
          <span className="rn-ayuda" aria-hidden="true">{t('Toca la recta y arrastra')}</span>
        )}
        {revelada && diana && <span className="rn-diana">{t('¡Diana!')}</span>}
      </div>

      <div className="rn-pie">
        {fase === 'apuntando' ? (
          <>
            <span className="rn-tiempo" aria-hidden="true">
              {p.segundos > 0 && !p.oculta && <span key={partida.n} className="rn-tiempo-barra" style={{ '--rn-s': `${p.segundos}s` } as CSSProperties} />}
            </span>
            <Boton className="rn-aqui" disabled={!puede || eq.pos === null} onPulsar={() => p.onFijar(i)}>
              {eq.fijado ? t('¡Listo!') : t('¡Aquí!')}
            </Boton>
          </>
        ) : (
          <>
            <span className={`rn-resultado${gano ? ' bien' : ''}`} role="status">
              {resultado}
              {dist !== null
                ? <small>{t('Distancia: {d}', { d: distanciaEnTexto(r, eq.pos!, objetivo.valor, ingles) })}</small>
                : <small>{t('Sin marcador')}</small>}
            </span>
            {fase === 'revelada' && (
              <Boton alSoltar className="rn-siguiente" disabled={!p.siguienteListo} onPulsar={p.onSiguiente}>
                {t('Siguiente')}
              </Boton>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/* ── El juego ── */

export function LaRectaNumerica({ onClose, clase }: { onClose: () => void; clase?: ClaseDelJuego | null }) {
  const { t, lang } = useI18n();
  const ingles = lang === 'en';
  const reducirMov = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const tam = useJuegoAbierto(rootRef, onClose);
  const vista: Vista = vistaPara(tam.w, tam.h);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  // La forma de cada panel: de lado a lado (cara a cara) es más ancho que alto; en dos mitades, más alto
  const forma: 'ancho' | 'alto' = vista === 'cara' || tam.w / 2 > tam.h * 0.9 ? 'ancho' : 'alto';

  /* ── Ajustes ── */
  const tramoClase = useMemo(() => tramoDeClase(clase), [clase]);
  const [ajustes, setAjustes] = useState<Ajustes>(() => {
    const g = leerAjustes();
    const tramo = tramoClase ?? g.tramo ?? 'p34';
    return {
      tramo, variante: g.tramo === tramo && g.variante ? g.variante : MEZCLA,
      rondas: g.rondas ?? 5, tiempo: g.tramo === tramo && g.tiempo !== undefined ? g.tiempo : tiempoDeTramo(tramo),
    };
  });
  const [nombres, setNombres] = useState<[string | null, string | null]>([null, null]);
  const nombreDe = (i: IndiceEquipo) => nombres[i] ?? t(i === 0 ? 'Equipo rojo' : 'Equipo azul');
  const [editando, setEditando] = useState<IndiceEquipo | null>(null);

  const [fase, setFase] = useState<Fase>('inicio');
  const [cuenta, setCuenta] = useState(3);
  const [partida, despachar] = useReducer(reducir, null);

  /* ── Sonido ── */
  const [silencio, setSilencio] = useState(leerSilencioJuegos);
  const silencioRef = useRef(silencio);
  useLayoutEffect(() => { silencioRef.current = silencio; }, [silencio]);
  const efecto = useCallback((e: Efecto) => sonarEfecto(e, silencioRef.current), []);

  const { completa, puede: puedeCompleta, alternar: alternarCompleta } = usePantallaCompleta(rootRef);
  const lienzoRef = useRef<HTMLCanvasElement>(null);
  const confeti = useConfeti(lienzoRef);

  /* ── La cuenta atrás: 3, 2, 1, ¡ya! ── */
  useEffect(() => {
    if (fase !== 'cuenta') return;
    const id = window.setTimeout(() => {
      if (cuenta > 0) { setCuenta(c => c - 1); efecto('tic'); } else setFase('juego');
    }, 800);
    return () => window.clearTimeout(id);
  }, [fase, cuenta, efecto]);

  function empezar() {
    guardarAjustes(ajustes);
    despachar({ tipo: 'nueva', partida: nuevaPartidaRecta(ajustes.tramo, ajustes.variante, ajustes.rondas, semillaNueva()) });
    setCuenta(3);
    setFase('cuenta');
    efecto('fijar');
  }

  /* ── El tiempo de cada ronda: la barra se vacía y, al acabar, se revela ── */
  const n = partida?.n ?? -1;
  const apuntando = fase === 'juego' && partida?.fase === 'apuntando';
  useEffect(() => {
    if (!apuntando || ajustes.tiempo === 0) return;
    const ms = ajustes.tiempo * 1000;
    const ids = [window.setTimeout(() => despachar({ tipo: 'tiempo' }), ms)];
    for (const s of [3, 2, 1]) if (ms > s * 1000) ids.push(window.setTimeout(() => efecto('tic'), ms - s * 1000));
    return () => ids.forEach(id => window.clearTimeout(id));
  }, [apuntando, n, ajustes.tiempo, efecto]);

  /* ── Al revelar: cae el número y suena quién gana; un momento después se puede pasar de ronda ── */
  const reveladas = partida?.historial.length ?? 0;
  const [listoTras, setListoTras] = useState(-1);
  const siguienteListo = listoTras === reveladas;
  useEffect(() => {
    if (reveladas === 0 || !partida) return;
    const ultima = partida.historial[reveladas - 1];
    efecto('caer');
    const sonido = window.setTimeout(() => efecto(ultima.ganadores.length === 2 ? 'empate' : ultima.ganadores.length === 0 ? 'nada' : 'punto'), reducirMov ? 100 : 650);
    const listo = window.setTimeout(() => setListoTras(reveladas), reducirMov ? 600 : ESPERA_REVELAR);
    return () => { window.clearTimeout(sonido); window.clearTimeout(listo); };
    // Solo al revelar una ronda nueva
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveladas]);

  /* ── El final ── */
  const ganador = partida?.fase === 'fin' ? partida.ganador : null;
  // Los botones del final valen un momento después (se apunta la ronda con la que acabó: una partida nueva empieza sin ellos)
  const finClave = ganador ? `${partida?.semilla}-${reveladas}` : null;
  const [finTras, setFinTras] = useState<string | null>(null);
  const finListo = finClave !== null && finTras === finClave;
  useEffect(() => {
    if (!ganador || !finClave) return;
    efecto('fin');
    const colors = ganador.length === 2 ? ['#ef4444', '#3b82f6', '#fde047'] : ganador[0] === 0 ? ['#ef4444', '#f87171', '#fde047', '#ffffff'] : ['#3b82f6', '#60a5fa', '#fde047', '#ffffff'];
    confeti.current?.({ particleCount: 200, spread: 110, origin: { y: 0.55 }, zIndex: 100000, disableForReducedMotion: true, colors });
    const id = window.setTimeout(() => setFinTras(finClave), ESPERA_FIN);
    return () => window.clearTimeout(id);
  }, [ganador, finClave, confeti, efecto]);

  /* ── Las acciones de los equipos ── */
  const faseRef = useRef(fase);
  useLayoutEffect(() => { faseRef.current = fase; }, [fase]);
  const onMover = useCallback((i: IndiceEquipo, valor: number) => {
    if (faseRef.current === 'juego') despachar({ tipo: 'mover', equipo: i, valor });
  }, []);
  const onSoltar = useCallback((i: IndiceEquipo) => despachar({ tipo: 'soltar', equipo: i }), []);
  const onFijar = useCallback((i: IndiceEquipo) => {
    if (faseRef.current !== 'juego') return;
    despachar({ tipo: 'fijar', equipo: i });
    efecto('fijar');
  }, [efecto]);
  const onSiguiente = useCallback(() => despachar({ tipo: 'siguiente' }), []);

  /* ── Con el teclado: rojo, A, D y S; azul, ←, → y ↓ (Intro también fija o pasa de ronda) ── */
  const partidaRef = useRef(partida);
  useLayoutEffect(() => { partidaRef.current = partida; }, [partida]);
  const siguienteRef = useRef(siguienteListo);
  useLayoutEffect(() => { siguienteRef.current = siguienteListo; }, [siguienteListo]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const p = partidaRef.current;
      if (faseRef.current !== 'juego' || !p || editando !== null || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (p.fase === 'revelada') {
        if ((k === 'Enter' || k === ' ') && siguienteRef.current && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); despachar({ tipo: 'siguiente' }); }
        return;
      }
      if (p.fase !== 'apuntando') return;
      const acc: Record<string, [IndiceEquipo, -1 | 1 | 0]> = { a: [0, -1], d: [0, 1], s: [0, 0], ArrowLeft: [1, -1], ArrowRight: [1, 1], ArrowDown: [1, 0] };
      const m = acc[k] ?? (k === 'Enter' && !(e.target instanceof HTMLButtonElement) ? [1, 0] as [IndiceEquipo, 0] : null);
      if (!m) return;
      e.preventDefault();
      const [i, dir] = m;
      if (dir === 0) { onFijar(i); return; }
      const r = p.objetivo.recta;
      const paso = e.shiftKey ? longitud(r) / 20 : r.iman ?? longitud(r) / 100;
      const base = p.equipos[i].pos ?? (dir > 0 ? r.min : r.max);
      despachar({ tipo: 'mover', equipo: i, valor: base + dir * paso });
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [editando, onFijar]);

  /* ── Salir o volver al inicio en mitad de una partida: con un segundo toque ── */
  const enPartida = (fase === 'juego' || fase === 'cuenta') && !ganador;
  const { aviso, setAviso, pedir } = useSegundoToque<'salir' | 'inicio'>(enPartida, que => {
    if (que === 'salir') onCloseRef.current();
    else setFase('inicio');
  });

  const alternarSilencio = () => {
    const si = !silencio;
    setSilencio(si);
    guardarSilencioJuegos(si);
  };

  const eso = esEso(ajustes.tramo);
  const tramoDeLaClase = tramoClase ? TRAMOS.find(x => x.id === tramoClase) : undefined;
  const portada = useHueco(HUECO('portada'));

  const barra = (
    <div className="cu-barra" role="toolbar" aria-label={t('Controles del juego')}>
      {fase !== 'inicio' && (
        <Boton alSoltar className={`cu-ico${aviso === 'inicio' ? ' armada' : ''}`} aria-label={t('Volver al inicio del juego')} title={t('Volver al inicio del juego')} onPulsar={k => pedir('inicio', k)}><Home size={22} /></Boton>
      )}
      <Boton alSoltar className="cu-ico" aria-label={t(silencio ? 'Poner el sonido' : 'Quitar el sonido')} title={t(silencio ? 'Poner el sonido' : 'Quitar el sonido')} aria-pressed={!silencio} onPulsar={alternarSilencio}>
        {silencio ? <VolumeX size={22} /> : <Volume2 size={22} />}
      </Boton>
      {puedeCompleta && (
        <Boton alSoltar className="cu-ico completa" aria-label={t(completa ? 'Salir de la pantalla completa' : 'Pantalla completa')} title={t(completa ? 'Salir de la pantalla completa' : 'Pantalla completa')} onPulsar={alternarCompleta}>
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

  const marcadorCentral = partida && (
    <div className="rn-centro">
      <span className="rn-marcador-g e0" aria-label={t('{nombre}: {n} puntos', { nombre: nombreDe(0), n: partida.equipos[0].puntos })}>
        <Estrella className="rn-puntos-e" />{partida.equipos[0].puntos}
      </span>
      <span className="rn-ronda">
        <span className="rn-ronda-t">{partida.desempate ? t('Desempate') : t('Ronda {n} de {m}', { n: Math.min(partida.n + 1, partida.rondas), m: partida.rondas })}</span>
        <span className="rn-historial" aria-hidden="true">
          {Array.from({ length: partida.rondas }, (_, k) => {
            const h = partida.historial[k];
            const cl = !h ? '' : h.ganadores.length === 2 ? ' ambos' : h.ganadores[0] === 0 ? ' e0' : h.ganadores[0] === 1 ? ' e1' : ' nadie';
            return <span key={k} className={`rn-bola${cl}${k === partida.n && partida.fase === 'apuntando' ? ' ahora' : ''}`} />;
          })}
        </span>
      </span>
      <span className="rn-marcador-g e1" aria-label={t('{nombre}: {n} puntos', { nombre: nombreDe(1), n: partida.equipos[1].puntos })}>
        <Estrella className="rn-puntos-e" />{partida.equipos[1].puntos}
      </span>
      {!ganador && barra}
    </div>
  );

  const textoGanador = ganador ? (ganador.length === 2 ? t('¡Empate!') : t('¡Victoria de {nombre}!', { nombre: nombreDe(ganador[0]) })) : '';
  const claseGanador = ganador ? (ganador.length === 2 ? 'ambos' : ganador[0] === 0 ? 'rojo' : 'azul') : '';

  return (
    <div
      ref={rootRef}
      className={`cuerda recta juego-abierto${reducirMov ? ' quieta' : ''}`} role="dialog" aria-modal="true" aria-label={t('La recta numérica')}
      data-vista={vista} data-fase={fase} data-eso={eso ? 'si' : undefined}
      onContextMenu={e => e.preventDefault()}
    >
      <canvas ref={lienzoRef} className="cu-confeti" aria-hidden="true" />
      {fase !== 'juego' && fase !== 'cuenta' && <div className="cu-barra-fija">{barra}</div>}

      {fase === 'inicio' && (
        <div className="cu-inicio rn-inicio">
          <h1 className="cu-titulo rn-titulo">{t('La recta numérica')}</h1>
          <p className="cu-sub">{t('Toca el nombre de un equipo para cambiarlo')}</p>
          {portada
            ? <img className="rn-portada" src={portada} alt="" draggable={false} />
            : (
              <div className="rn-portada-codigo" aria-hidden="true">
                <img src={MASCOTA_CODIGO[0]} alt="" draggable={false} />
                <span className="rn-mini-recta">{[0, 1, 2, 3, 4, 5].map(k => <span key={k}><b>{k}</b></span>)}</span>
                <img src={MASCOTA_CODIGO[1]} alt="" draggable={false} />
              </div>
            )}
          <div className="rn-equipos">
            {([0, 1] as const).map(i => (
              <Boton key={i} alSoltar className={`cu-equipo-nombre rn-eq e${i}`} aria-label={t('Cambiar el nombre: {nombre}', { nombre: nombreDe(i) })} onPulsar={() => setEditando(i)}>
                <span>{nombreDe(i)}</span><Pencil size={16} aria-hidden="true" />
              </Boton>
            ))}
          </div>
          <p className="rn-como">{t('Sale un número. Cada equipo lleva su marcador hasta donde cree que está y pulsa «¡Aquí!». Gana el punto quien queda más cerca.')}</p>
          <Boton alSoltar className="cu-jugar" onPulsar={() => setFase('ajustes')}>{t('¡A jugar!')}</Boton>
        </div>
      )}

      {fase === 'ajustes' && (
        <div className="cu-ajustes">
          <div className="cu-ajustes-lista">
            <div className="cu-ajustes-in">
              <h2 className="cu-h2">{t('Elige el nivel')}</h2>
              {tramoDeLaClase && clase && (
                <p className="cu-pista">{t('Propuesto por la clase {clase}: {nivel}', { clase: clase.name, nivel: t(tramoDeLaClase.nombre) })}</p>
              )}
              <div className="cu-opciones" role="radiogroup" aria-label={t('Nivel')}>
                {TRAMOS.map(x => (
                  <Boton
                    alSoltar key={x.id} role="radio" aria-checked={ajustes.tramo === x.id} className={`cu-opcion${ajustes.tramo === x.id ? ' sel' : ''}`}
                    onPulsar={() => setAjustes(a => ({ ...a, tramo: x.id, variante: varianteParaTramo(x.id, a.variante), tiempo: a.tramo === x.id ? a.tiempo : tiempoDeTramo(x.id) }))}
                  >
                    {t(x.nombre)}
                  </Boton>
                ))}
              </div>
              <h2 className="cu-h2">{t('Qué números salen')}</h2>
              <div className="cu-opciones" role="radiogroup" aria-label={t('Qué números salen')}>
                {[...VARIANTES[ajustes.tramo], { id: MEZCLA, nombre: 'Mezcla', ejemplo: '🔀' }].map(v => (
                  <Boton
                    alSoltar key={v.id} role="radio" aria-checked={ajustes.variante === v.id} className={`cu-opcion${ajustes.variante === v.id ? ' sel' : ''}`}
                    onPulsar={() => setAjustes(a => ({ ...a, variante: v.id }))}
                  >
                    <span className="cu-signo rn-ejemplo" aria-hidden="true">{ingles ? v.ejemplo.replace(/,/g, '.').replace('·', '×') : v.ejemplo}</span>{t(v.nombre)}
                  </Boton>
                ))}
              </div>
              <h2 className="cu-h2">{t('Rondas')}</h2>
              <div className="cu-opciones" role="radiogroup" aria-label={t('Rondas')}>
                {RONDAS.map(x => (
                  <Boton alSoltar key={x} role="radio" aria-checked={ajustes.rondas === x} className={`cu-opcion corta${ajustes.rondas === x ? ' sel' : ''}`} onPulsar={() => setAjustes(a => ({ ...a, rondas: x }))}>{x}</Boton>
                ))}
              </div>
              <h2 className="cu-h2">{t('Tiempo para poner el marcador')}</h2>
              <div className="cu-opciones" role="radiogroup" aria-label={t('Tiempo para poner el marcador')}>
                {TIEMPOS.map(x => (
                  <Boton alSoltar key={x} role="radio" aria-checked={ajustes.tiempo === x} className={`cu-opcion corta${ajustes.tiempo === x ? ' sel' : ''}`} onPulsar={() => setAjustes(a => ({ ...a, tiempo: x }))}>
                    {x === 0 ? t('Sin límite') : t('{n} s', { n: x })}
                  </Boton>
                ))}
              </div>
              <p className="rn-teclas">{t('Con el teclado: el equipo rojo mueve con A y D y fija con S; el azul, con ← y → y fija con ↓.')}</p>
            </div>
          </div>
          <div className="cu-ajustes-pie">
            <Boton alSoltar className="cu-secundario" onPulsar={() => setFase('inicio')}><ArrowLeft size={20} aria-hidden="true" />{t('Cambiar equipos')}</Boton>
            <Boton alSoltar className="cu-jugar" onPulsar={empezar}><Play size={22} aria-hidden="true" />{t('Empezar')}</Boton>
          </div>
        </div>
      )}

      {(fase === 'juego' || fase === 'cuenta') && partida && (
        <div className="rn-juego" data-vista={vista}>
          {([1, 0] as const).map(i => (
            <PanelEquipo
              key={i} equipo={i} partida={partida} nombre={nombreDe(i)} otro={nombreDe(i === 0 ? 1 : 0)}
              girada={vista === 'cara' && i === 1} forma={forma} oculta={fase === 'cuenta'} reducirMov={reducirMov}
              siguienteListo={siguienteListo} segundos={ajustes.tiempo}
              onMover={onMover} onSoltar={onSoltar} onFijar={onFijar} onSiguiente={onSiguiente}
            />
          ))}
          {marcadorCentral}

          {fase === 'cuenta' && (
            <div className="cu-cuenta" aria-live="assertive">
              {vista === 'cara' && <span key={`a${cuenta}`} className="cu-cuenta-n girada" aria-hidden="true">{cuenta > 0 ? cuenta : t('¡Ya!')}</span>}
              <span key={cuenta} className="cu-cuenta-n">{cuenta > 0 ? cuenta : t('¡Ya!')}</span>
            </div>
          )}

          {ganador && (
            <div className="cu-fin rn-fin" role="status">
              <div className="cu-barra-fija">{barra}</div>
              {vista === 'cara' && (
                <div className={`cu-fin-espejo ${claseGanador}`} aria-hidden="true">
                  <Trofeo />
                  <span className="cu-fin-t">{textoGanador}</span>
                </div>
              )}
              <div className={`cu-fin-caja ${claseGanador}${finListo ? '' : ' espera'}`}>
                <Trofeo />
                {!esEso(partida.tramo) && (
                  <span className="rn-fin-mascotas">
                    {(ganador.length === 2 ? [0, 1] as const : [ganador[0]]).map(i => <Mascota key={i} equipo={i} pose="celebrando" />)}
                  </span>
                )}
                <h2 className="cu-fin-t">{textoGanador}</h2>
                <p className="cu-fin-datos">
                  {([0, 1] as const).map(i => <span key={i}>{t('{nombre}: {n} puntos', { nombre: nombreDe(i), n: partida.equipos[i].puntos })}</span>)}
                </p>
                <div className="cu-fin-botones">
                  <Boton alSoltar disabled={!finListo} className="cu-jugar" onPulsar={empezar}><RotateCcw size={22} aria-hidden="true" />{t('Jugar otra vez')}</Boton>
                  <Boton alSoltar disabled={!finListo} className="cu-secundario" onPulsar={() => { setAviso(null); setFase('ajustes'); }}>{t('Cambiar el nivel')}</Boton>
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
          onListo={x => {
            const i = editando;
            setNombres(v => (i === 0 ? [nombreFinal(x), v[1]] : [v[0], nombreFinal(x)]));
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

export default LaRectaNumerica;
