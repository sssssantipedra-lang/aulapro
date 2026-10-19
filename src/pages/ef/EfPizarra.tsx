/**
 * Educación Física, «Pizarra»: un circuito dibujado sobre una pista, con un
 * banco de material en imágenes que se coloca, se mueve y se gira (petición
 * del dueño, 17-10-2026). Lo que se dibuja a mano con «Dibujar material» se
 * reconoce por su forma (`analizarTrazo`) o con la IA (`reconocerPizarra`).
 * Desde que hay dos formas dibujadas, la IA las procesa sola y coloca las
 * piezas de las que está segura (la app, con una forma suelta, falla mucho:
 * decisión del dueño, 17-10-2026); lo dudoso lo confirma el docente. Las
 * piezas se duplican como en Canva: barra flotante, Ctrl+D (que repite la
 * distancia de la última copia), Alt y arrastrar, Ctrl+C y Ctrl+V, y elegir
 * varias con Mayús o con un recuadro. Ver `docs/EF.md`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Save, Trash2, Undo2, Download, Sparkles, MousePointer2, Pencil, MoveRight, Shapes, Eraser, RotateCcw, RotateCw,
  ZoomIn, ZoomOut, Copy, Check, X, CopyPlus,
} from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { useI18n } from '../../i18n';
import { downloadFile } from '../../lib/download';
import { nuevoIdEF } from '../../lib/ef';
import {
  ALTO_PIZARRA, ANCHO_PIZARRA, analizarTrazo, cabezaFlecha, cajaDeElementos, COLORES_TRAZO, copiarElementos, DESPLAZAMIENTO_COPIA,
  elementoDeTrazo, elementoNuevo, elementosEnCaja, materialDeLaPizarra, materialDePizarra, MATERIALES_PIZARRA, pizarraSvg, puntosSvg,
  siguienteEstacion, transformDeElemento, type AnalisisTrazo, type Caja,
} from '../../lib/pizarraEF';
import { blobABase64, svgAPng } from '../../lib/svgPng';
import { hasApiKey, type InlineFile } from '../../services/gemini';
import { reconocerPizarra } from '../../services/efIA';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { EfData, ElementoPizarra, MaterialPizarraId, PizarraEF, TrazoPizarra } from '../../types/ef';
import { CARPETAS } from '../../lib/carpetas';

interface Props {
  ef: EfData;
  onChangeEf: (f: (d: EfData) => EfData) => void;
  comunidad?: ComunidadId;
  /**
   * Dentro de una ventana, desde una sesión de EF (19-10-2026): sin el título de
   * la página, abierta con el circuito que se pida (`inicialId`) o en blanco, y
   * avisando al guardar (`alGuardar`) para que la sesión lo adjunte.
   */
  embebida?: boolean;
  inicialId?: string;
  alGuardar?: (id: string) => void;
}

type Herramienta = 'mover' | 'lapiz' | 'flecha' | 'material' | 'borrar';
type Punto = [number, number];

/** Una forma dibujada a mano que espera a que el docente diga qué material es. */
interface Propuesta {
  id: string;
  /** El trazo de croquis que la originó; la IA no lo tiene. */
  trazoId?: string;
  caja: Caja;
  /** Las que se ofrecen en el desplegable, de más a menos probable. */
  candidatos: MaterialPizarraId[];
  material: MaterialPizarraId;
  origen: 'forma' | 'ia';
  forma?: AnalisisTrazo['forma'];
  seguridad?: 'alta' | 'media' | 'baja';
}

const FORMAS: Record<AnalisisTrazo['forma'], string> = {
  triangulo: 'un triángulo', rectangulo: 'un rectángulo', circulo: 'un círculo', linea: 'una raya', otra: 'una forma suelta',
};

const VACIA = (): PizarraEF => ({ id: nuevoIdEF('piz'), nombre: '', elementos: [], trazos: [] });
const copia = (p: PizarraEF): PizarraEF => ({ ...p, elementos: p.elementos.map(e => ({ ...e })), trazos: p.trazos.map(t => ({ ...t, puntos: t.puntos.map(q => [...q] as Punto) })) });
const limita = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Lo que se espera tras la última forma dibujada antes de que la IA las procese: así se pueden seguir dibujando. */
export const ESPERA_IA_MS = 1200;
/** Desde cuántas formas dibujadas las procesa la IA sola. */
export const FORMAS_PARA_IA = 2;

export function EfPizarra({ ef, onChangeEf, comunidad, embebida = false, inicialId, alGuardar }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [piz, setPiz] = useState<PizarraEF>(() => {
    const inicial = inicialId ? ef.pizarras.find(x => x.id === inicialId) : undefined;
    return inicial ? copia(inicial) : VACIA();
  });
  const [historial, setHistorial] = useState<PizarraEF[]>([]);
  const [herramienta, setHerramienta] = useState<Herramienta>('mover');
  const [color, setColor] = useState<string>(COLORES_TRAZO[0].id);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [enCurso, setEnCurso] = useState<{ tipo: 'lapiz' | 'flecha' | 'material'; puntos: Punto[] } | null>(null);
  const [marco, setMarco] = useState<{ a: Punto; b: Punto; anadir: boolean } | null>(null);
  const [moviendo, setMoviendo] = useState(false);
  const [croquis, setCroquis] = useState<{ id: string; puntos: Punto[] }[]>([]);
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [resumenIa, setResumenIa] = useState('');
  const [pensando, setPensando] = useState(false);
  const [copiasEnFila, setCopiasEnFila] = useState('4');
  /** Piezas que se mueven a la vez: dónde estaban y dónde se pulsó. */
  const arrastre = useRef<{ inicio: Punto; origen: Map<string, Punto>; historia: PizarraEF | null } | null>(null);
  /** Para repetir la distancia de la última copia, como Ctrl+D en Canva. */
  const ultimaCopia = useRef<{ origen: string; copia: string } | null>(null);
  const portapapeles = useRef<{ piezas: ElementoPizarra[]; pegadas: number }>({ piezas: [], pegadas: 0 });
  /** Para que dos copias hechas en el mismo instante no repitan identificador. */
  const contador = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const procesarIa = useRef<() => void>(() => undefined);

  const guardada = ef.pizarras.find(p => p.id === piz.id);
  const sinGuardar = guardada
    ? JSON.stringify(guardada) !== JSON.stringify(piz)
    : piz.elementos.length > 0 || piz.trazos.length > 0;
  const elegidos = piz.elementos.filter(e => seleccion.includes(e.id));
  const elegido = elegidos.length === 1 ? elegidos[0] : undefined;
  const material = useMemo(() => materialDeLaPizarra(piz.elementos), [piz.elementos]);
  const cajaElegidos = cajaDeElementos(elegidos);

  /* ── Cambios, con deshacer ── */
  function cambiar(f: (p: PizarraEF) => PizarraEF) {
    setHistorial(h => [...h.slice(-49), piz]);
    setPiz(f);
  }

  function deshacer() {
    setHistorial(h => {
      const ultimo = h[h.length - 1];
      if (ultimo) setPiz(ultimo);
      return h.slice(0, -1);
    });
  }

  const cambiarElementos = (ids: readonly string[], f: (e: ElementoPizarra) => ElementoPizarra) =>
    cambiar(p => ({ ...p, elementos: p.elementos.map(e => (ids.includes(e.id) ? f(e) : e)) }));

  function poner(m: MaterialPizarraId, x?: number, y?: number) {
    const n = piz.elementos.length;
    const e = elementoNuevo(
      nuevoIdEF('el'), m,
      x ?? ANCHO_PIZARRA / 2 + ((n * 47) % 240) - 120,
      y ?? ALTO_PIZARRA / 2 + ((n * 31) % 160) - 80,
      m === 'estacion' ? siguienteEstacion(piz.elementos) : undefined,
    );
    cambiar(p => ({ ...p, elementos: [...p.elementos, e] }));
    setSeleccion([e.id]);
    setHerramienta('mover');
  }

  function quitarElegidos() {
    if (!seleccion.length) return;
    cambiar(p => ({ ...p, elementos: p.elementos.filter(e => !seleccion.includes(e.id)) }));
    setSeleccion([]);
  }

  /* ── Duplicar, como en Canva ── */
  const idNuevo = () => nuevoIdEF('el') + (contador.current++).toString(36);

  /**
   * Duplica lo elegido. Sin distancia, la de la última copia si se acaba de
   * mover (así, Ctrl+D tras mover la copia sigue una fila), o un poco
   * abajo y a la derecha. Las copias quedan elegidas.
   */
  function duplicarElegidos(delta?: Punto) {
    if (!elegidos.length) return;
    let d: Punto = delta ?? [DESPLAZAMIENTO_COPIA, DESPLAZAMIENTO_COPIA];
    const u = ultimaCopia.current;
    if (!delta && elegidos.length === 1 && u?.copia === elegidos[0].id) {
      const o = piz.elementos.find(e => e.id === u.origen);
      if (o && Math.hypot(elegidos[0].x - o.x, elegidos[0].y - o.y) >= 4) d = [elegidos[0].x - o.x, elegidos[0].y - o.y];
    }
    const copias = copiarElementos(piz.elementos, elegidos.map(e => e.id), d[0], d[1], idNuevo);
    cambiar(p => ({ ...p, elementos: [...p.elementos, ...copias] }));
    setSeleccion(copias.map(c => c.id));
    ultimaCopia.current = elegidos.length === 1 ? { origen: elegidos[0].id, copia: copias[0].id } : null;
  }

  /** «Copias en fila»: varias de una vez, separadas lo que mide la pieza o lo que se movió la última copia. */
  function copiarEnFila() {
    if (!elegidos.length) return;
    const caja = cajaElegidos!;
    const u = ultimaCopia.current;
    const o = elegidos.length === 1 && u?.copia === elegidos[0].id ? piz.elementos.find(e => e.id === u.origen) : undefined;
    const paso: Punto = o && Math.hypot(elegidos[0].x - o.x, elegidos[0].y - o.y) >= 4
      ? [elegidos[0].x - o.x, elegidos[0].y - o.y]
      : [Math.round(caja.w + 14), 0];
    const n = Math.max(1, Math.min(20, Math.round(Number(copiasEnFila)) || 1));
    const ids = elegidos.map(e => e.id);
    const nuevas: ElementoPizarra[] = [];
    for (let k = 1; k <= n; k++) nuevas.push(...copiarElementos([...piz.elementos, ...nuevas], ids, paso[0] * k, paso[1] * k, idNuevo, false));
    cambiar(p => ({ ...p, elementos: [...p.elementos, ...nuevas] }));
    setSeleccion(nuevas.slice(-ids.length).map(e => e.id));
    ultimaCopia.current = null;
  }

  function copiarAlPortapapeles() {
    if (!elegidos.length) return;
    portapapeles.current = { piezas: elegidos.map(e => ({ ...e })), pegadas: 0 };
  }

  function pegar() {
    const { piezas } = portapapeles.current;
    if (!piezas.length) return;
    const k = ++portapapeles.current.pegadas;
    const copias = copiarElementos(piezas, piezas.map(e => e.id), DESPLAZAMIENTO_COPIA * k, DESPLAZAMIENTO_COPIA * k, idNuevo);
    cambiar(p => ({ ...p, elementos: [...p.elementos, ...copias] }));
    setSeleccion(copias.map(c => c.id));
    setHerramienta('mover');
  }

  /* ── Puntero sobre la pizarra ── */
  function punto(e: React.PointerEvent | React.DragEvent): Punto {
    const svg = svgRef.current!;
    const m = svg.getScreenCTM();
    if (!m) return [0, 0];
    const i = m.inverse();
    return [
      limita(Math.round(i.a * e.clientX + i.c * e.clientY + i.e), 0, ANCHO_PIZARRA),
      limita(Math.round(i.b * e.clientX + i.d * e.clientY + i.f), 0, ALTO_PIZARRA),
    ];
  }

  function alPulsarFondo(e: React.PointerEvent<SVGSVGElement>) {
    svgRef.current?.focus();
    if (herramienta === 'borrar') return;
    svgRef.current?.setPointerCapture(e.pointerId);
    const p = punto(e);
    if (herramienta === 'mover') {
      // Un recuadro para elegir varias piezas, como en Canva
      setMarco({ a: p, b: p, anadir: e.shiftKey || e.ctrlKey || e.metaKey });
      return;
    }
    setEnCurso({ tipo: herramienta, puntos: [p] });
  }

  function alPulsarElemento(e: React.PointerEvent, el: ElementoPizarra) {
    if (herramienta === 'borrar') { e.stopPropagation(); cambiar(p => ({ ...p, elementos: p.elementos.filter(x => x.id !== el.id) })); return; }
    if (herramienta !== 'mover') return;
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    svgRef.current?.focus();
    const p = punto(e);
    // Mayús o Ctrl: se suma o se quita de lo elegido, sin mover
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      setSeleccion(s => (s.includes(el.id) ? s.filter(x => x !== el.id) : [...s, el.id]));
      return;
    }
    let ids = seleccion.includes(el.id) ? seleccion : [el.id];
    if (e.altKey) {
      // Alt y arrastrar: se deja la original y se mueve una copia
      const copias = copiarElementos(piz.elementos, ids, 0, 0, idNuevo);
      cambiar(x => ({ ...x, elementos: [...x.elementos, ...copias] }));
      ids = copias.map(c => c.id);
      arrastre.current = { inicio: p, origen: new Map(copias.map(c => [c.id, [c.x, c.y] as Punto])), historia: null };
    } else {
      // Solo cuenta para deshacer si de verdad se mueve (ver `alMover`)
      arrastre.current = { inicio: p, origen: new Map(piz.elementos.filter(x => ids.includes(x.id)).map(x => [x.id, [x.x, x.y] as Punto])), historia: piz };
    }
    setSeleccion(ids);
    setMoviendo(true);
  }

  function alMover(e: React.PointerEvent<SVGSVGElement>) {
    const [x, y] = punto(e);
    if (arrastre.current) {
      const { inicio, origen, historia } = arrastre.current;
      const dx = x - inicio[0];
      const dy = y - inicio[1];
      if (historia && Math.hypot(dx, dy) >= 2) {
        arrastre.current.historia = null;
        setHistorial(h => [...h.slice(-49), historia]);
      }
      setPiz(p => ({
        ...p,
        elementos: p.elementos.map(el => {
          const o = origen.get(el.id);
          return o ? { ...el, x: limita(Math.round(o[0] + dx), 0, ANCHO_PIZARRA), y: limita(Math.round(o[1] + dy), 0, ALTO_PIZARRA) } : el;
        }),
      }));
      return;
    }
    if (marco) { setMarco(m => (m ? { ...m, b: [x, y] } : m)); return; }
    if (!enCurso) return;
    setEnCurso(c => {
      if (!c) return c;
      if (c.tipo === 'flecha') return { ...c, puntos: [c.puntos[0], [x, y]] };
      const ultimo = c.puntos[c.puntos.length - 1];
      return Math.hypot(ultimo[0] - x, ultimo[1] - y) < 3 ? c : { ...c, puntos: [...c.puntos, [x, y]] };
    });
  }

  function alSoltar() {
    if (arrastre.current) {
      arrastre.current = null;
      setMoviendo(false);
      return;
    }
    if (marco) {
      const caja: Caja = { x: Math.min(marco.a[0], marco.b[0]), y: Math.min(marco.a[1], marco.b[1]), w: Math.abs(marco.a[0] - marco.b[0]), h: Math.abs(marco.a[1] - marco.b[1]) };
      const dentro = caja.w < 5 && caja.h < 5 ? [] : elementosEnCaja(piz.elementos, caja);
      setSeleccion(s => (marco.anadir ? [...new Set([...s, ...dentro])] : dentro));
      setMarco(null);
      return;
    }
    const c = enCurso;
    setEnCurso(null);
    if (!c) return;
    if (c.tipo === 'material') {
      const trazoId = nuevoIdEF('cr');
      const a = analizarTrazo(c.puntos);
      if (!a) { toast(t('Dibuja la forma más grande para que pueda reconocerla.')); return; }
      setCroquis(x => [...x, { id: trazoId, puntos: c.puntos }]);
      setPropuestas(x => [...x, { id: nuevoIdEF('pr'), trazoId, caja: a.caja, candidatos: a.candidatos, material: a.candidatos[0], origen: 'forma', forma: a.forma }]);
      return;
    }
    if (c.puntos.length < 2) return;
    if (c.tipo === 'flecha' && Math.hypot(c.puntos[1][0] - c.puntos[0][0], c.puntos[1][1] - c.puntos[0][1]) < 14) return;
    const trazo: TrazoPizarra = { id: nuevoIdEF('tr'), tipo: c.tipo === 'flecha' ? 'flecha' : 'libre', puntos: c.puntos, color };
    cambiar(p => ({ ...p, trazos: [...p.trazos, trazo] }));
  }

  function alTeclear(e: React.KeyboardEvent) {
    const ctrl = e.ctrlKey || e.metaKey;
    const tecla = e.key.toLowerCase();
    if (ctrl && tecla === 'z') { e.preventDefault(); deshacer(); return; }
    if (ctrl && tecla === 'd') { e.preventDefault(); duplicarElegidos(); return; }
    if (ctrl && tecla === 'c') { copiarAlPortapapeles(); return; }
    if (ctrl && tecla === 'v') { e.preventDefault(); pegar(); return; }
    if (ctrl && tecla === 'a') { e.preventDefault(); setSeleccion(piz.elementos.map(x => x.id)); return; }
    if (e.key === 'Escape') { setSeleccion([]); return; }
    if (!elegidos.length) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); quitarElegidos(); return; }
    const paso = e.shiftKey ? 30 : 10;
    const mov: Record<string, [number, number]> = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] };
    const m = mov[e.key];
    if (m) {
      e.preventDefault();
      cambiarElementos(seleccion, x => ({ ...x, x: limita(x.x + m[0], 0, ANCHO_PIZARRA), y: limita(x.y + m[1], 0, ALTO_PIZARRA) }));
    }
  }

  /* ── Propuestas de lo dibujado ── */
  function ponerPropuesta(p: Propuesta, m = p.material) {
    const el = elementoDeTrazo(nuevoIdEF('el'), m, p.caja, m === 'estacion' ? siguienteEstacion(piz.elementos) : undefined);
    cambiar(x => ({ ...x, elementos: [...x.elementos, el] }));
    return el;
  }

  function resolver(p: Propuesta, poner_: boolean) {
    if (poner_) setSeleccion([ponerPropuesta(p).id]);
    const quedan = propuestas.filter(x => x.id !== p.id);
    setPropuestas(quedan);
    // Los dibujos que ya son una pieza o se descartaron dejan de verse; los de la IA, cuando no queda ninguna propuesta
    setCroquis(c => (p.trazoId ? c.filter(x => x.id !== p.trazoId) : quedan.length ? c : []));
  }

  function ponerTodas() {
    if (!propuestas.length) return;
    const nuevos: ElementoPizarra[] = [];
    propuestas.forEach((p, i) => nuevos.push(elementoDeTrazo(nuevoIdEF('el') + i, p.material, p.caja)));
    cambiar(x => ({ ...x, elementos: [...x.elementos, ...nuevos] }));
    setPropuestas([]);
    setCroquis([]);
    setResumenIa('');
  }

  function descartarCroquis() {
    setPropuestas([]);
    setCroquis([]);
    setResumenIa('');
  }

  /**
   * La IA mira el croquis. Las piezas de las que está segura se colocan solas
   * (se pueden deshacer); las dudosas quedan como propuesta para que el docente
   * elija. Las formas que se dibujaron mientras tanto esperan a la siguiente vez.
   */
  async function reconocerConIa(auto = false) {
    if (!croquis.length) { if (!auto) toast(t('Dibuja primero con «Dibujar material» y la IA lo reconocerá.')); return; }
    const enviados = croquis;
    setPensando(true);
    try {
      const trazos: TrazoPizarra[] = enviados.map(c => ({ id: c.id, tipo: 'libre', puntos: c.puntos, color: '#1e293b' }));
      const png = await svgAPng(pizarraSvg({ elementos: [], trazos }), ANCHO_PIZARRA, ALTO_PIZARRA);
      const archivo: InlineFile = { name: 'croquis.png', mimeType: 'image/png', base64: await blobABase64(png) };
      const r = await reconocerPizarra(archivo, comunidad, lang, { onError: m => toast(t(m)) });
      if (!r) return;
      if (!r.objetos.length) { toast(t('La IA no ha reconocido ninguna pieza en el croquis.')); return; }
      const cajaDe = (o: typeof r.objetos[number]): Caja => {
        const ancho = o.ancho * ANCHO_PIZARRA;
        const alto = o.alto * ALTO_PIZARRA;
        return { x: o.x * ANCHO_PIZARRA - ancho / 2, y: o.y * ALTO_PIZARRA - alto / 2, w: ancho, h: alto };
      };
      const seguras = r.objetos.filter(o => o.seguridad !== 'baja');
      const dudosas = r.objetos.filter(o => o.seguridad === 'baja');
      const nuevas = seguras.map(o => elementoDeTrazo(idNuevo(), o.material, cajaDe(o)));
      if (nuevas.length) {
        cambiar(p => ({ ...p, elementos: [...p.elementos, ...nuevas] }));
        setSeleccion(nuevas.map(n => n.id));
        toast(t('La IA ha colocado {n} piezas. Si algo no es lo que querías, deshaz o cámbialo.', { n: nuevas.length }));
      }
      const enviadosIds = new Set(enviados.map(c => c.id));
      setResumenIa(r.resumen);
      setPropuestas(x => [
        ...x.filter(p => !(p.trazoId && enviadosIds.has(p.trazoId))),
        ...dudosas.map(o => ({
          id: nuevoIdEF('pr'), caja: cajaDe(o), candidatos: MATERIALES_PIZARRA.filter(m => m.id !== 'estacion').map(m => m.id),
          material: o.material, origen: 'ia' as const, seguridad: o.seguridad,
        })),
      ]);
      // Sin dudas, los dibujos ya son piezas; con dudas, se dejan a la vista junto a su propuesta
      if (!dudosas.length) setCroquis(c => c.filter(x => !enviadosIds.has(x.id)));
    } catch {
      toast(t('No se pudo preparar el croquis para la IA.'));
    } finally {
      setPensando(false);
    }
  }
  // El temporizador de abajo llama siempre a la versión más reciente
  useEffect(() => { procesarIa.current = () => { if (!pensando) void reconocerConIa(true); }; });

  // Con dos formas dibujadas, las procesa la IA sola cuando se deja de dibujar
  useEffect(() => {
    if (croquis.length < FORMAS_PARA_IA || !hasApiKey()) return;
    const h = setTimeout(() => procesarIa.current(), ESPERA_IA_MS);
    return () => clearTimeout(h);
  }, [croquis.length]);

  /* ── Guardar, abrir, bajar ── */
  function confirmarDescarte(): boolean {
    return !sinGuardar || window.confirm(t('Hay cambios sin guardar. ¿Descartarlos?'));
  }

  function abrir(p: PizarraEF | null) {
    if (!confirmarDescarte()) return;
    setPiz(p ? copia(p) : VACIA());
    setHistorial([]);
    setSeleccion([]);
    descartarCroquis();
  }

  function guardar() {
    const nombre = piz.nombre.trim();
    if (!nombre) { toast(t('Ponle un nombre a la pizarra.')); return; }
    const p = { ...copia(piz), nombre };
    onChangeEf(d => ({ ...d, pizarras: d.pizarras.some(x => x.id === p.id) ? d.pizarras.map(x => (x.id === p.id ? p : x)) : [...d.pizarras, p] }));
    setPiz(p);
    toast(t('✅ Guardado'));
    alGuardar?.(p.id);
  }

  function borrar() {
    if (!guardada || !window.confirm(t('¿Borrar la pizarra «{nombre}»?', { nombre: guardada.nombre }))) return;
    onChangeEf(d => ({ ...d, pizarras: d.pizarras.filter(x => x.id !== guardada.id) }));
    setPiz(VACIA());
    setHistorial([]);
  }

  async function bajar() {
    try {
      const nombre = (piz.nombre.trim() || 'pizarra').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
      await downloadFile(await svgAPng(pizarraSvg(piz), 2 * ANCHO_PIZARRA, 2 * ALTO_PIZARRA), `${nombre || 'pizarra'}.png`, CARPETAS.ef);
    } catch {
      toast(t('No se pudo crear la imagen.'));
    }
  }

  const herramientas: { id: Herramienta; label: string; icono: React.ReactNode }[] = [
    { id: 'mover', label: 'Mover', icono: <MousePointer2 size={15} /> },
    { id: 'lapiz', label: 'Lápiz', icono: <Pencil size={15} /> },
    { id: 'flecha', label: 'Flecha', icono: <MoveRight size={15} /> },
    { id: 'material', label: 'Dibujar material', icono: <Shapes size={15} /> },
    { id: 'borrar', label: 'Borrar', icono: <Eraser size={15} /> },
  ];

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          {!embebida && <h1 className="pg-title">{t('Pizarra de circuitos')}</h1>}
          <p className="pg-sub">{t('Dibuja un circuito: coloca el material del banco, muévelo y gíralo, o dibuja a mano una forma y la app propone qué material es.')}</p>
        </div>
        <div className="ap-prog-acc">
          <button className="btn-ghost" onClick={() => abrir(null)}><Plus size={15} />{t('Nueva pizarra')}</button>
          <button className="btn-ghost" onClick={bajar}><Download size={15} />{t('Descargar imagen')}</button>
          <button className="btn-accent" onClick={guardar}><Save size={15} />{t('Guardar')}</button>
        </div>
      </div>

      <div className="ef-piz-nombre">
        <input className="finput" value={piz.nombre} onChange={e => setPiz({ ...piz, nombre: e.target.value })}
          placeholder={t('Nombre del circuito')} aria-label={t('Nombre de la pizarra')} />
        {guardada && <button className="btn-ghost ap-borrar" onClick={borrar}><Trash2 size={14} />{t('Borrar')}</button>}
        {sinGuardar && <span className="ap-sub">{t('Sin guardar')}</span>}
      </div>
      {ef.pizarras.length > 0 && (
        <div className="chip-row ap-alumnos" role="group" aria-label={t('Pizarras guardadas')}>
          {ef.pizarras.map(p => (
            <button key={p.id} type="button" className={`chip sm accent${p.id === piz.id ? ' on' : ''}`} onClick={() => abrir(p)}>{p.nombre}</button>
          ))}
        </div>
      )}

      <div className="ef-piz">
        <aside className="card ef-piz-banco" aria-label={t('Banco de material')}>
          <div className="home-card-ttl">{t('Banco de material')}</div>
          <p className="ap-sub">{t('Toca una pieza para ponerla en la pizarra, o arrástrala hasta donde quieras.')}</p>
          <div className="ef-piz-piezas">
            {MATERIALES_PIZARRA.map(m => (
              <button key={m.id} type="button" className="ef-piz-pieza" title={t(m.descripcion)} draggable
                onClick={() => poner(m.id)}
                onDragStart={e => { e.dataTransfer.setData('text/plain', m.id); e.dataTransfer.effectAllowed = 'copy'; }}>
                <svg viewBox={`0 0 ${m.ancho} ${m.alto}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: m.svg(m.id === 'estacion' ? '1' : undefined) }} />
                <span>{t(m.label)}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="ef-piz-centro">
          <div className="ef-piz-barra" role="toolbar" aria-label={t('Herramientas')}>
            {herramientas.map(h => (
              <button key={h.id} type="button" className={`chip sm accent${herramienta === h.id ? ' on' : ''}`} aria-pressed={herramienta === h.id}
                onClick={() => setHerramienta(h.id)}>{h.icono}{t(h.label)}</button>
            ))}
            <span className="ef-piz-colores" role="radiogroup" aria-label={t('Color del trazo')}>
              {COLORES_TRAZO.map(c => (
                <button key={c.id} type="button" role="radio" aria-checked={color === c.id} aria-label={t(c.label)} title={t(c.label)}
                  className={`ef-piz-color${color === c.id ? ' on' : ''}`} style={{ background: c.id }} onClick={() => setColor(c.id)} />
              ))}
            </span>
            <button type="button" className="chip sm" onClick={deshacer} disabled={!historial.length}><Undo2 size={15} />{t('Deshacer')}</button>
          </div>

          <div className="ef-piz-wrap">
          <svg ref={svgRef} className={`ef-piz-lienzo ef-piz-${herramienta}`} viewBox={`0 0 ${ANCHO_PIZARRA} ${ALTO_PIZARRA}`} tabIndex={0}
            role="img" aria-label={t('Pizarra del circuito: {n} piezas', { n: piz.elementos.length })}
            onPointerDown={alPulsarFondo} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar} onKeyDown={alTeclear}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={e => {
              e.preventDefault();
              const m = MATERIALES_PIZARRA.find(x => x.id === e.dataTransfer.getData('text/plain'));
              if (m) { const [x, y] = punto(e); poner(m.id, x, y); }
            }}>
            <rect width={ANCHO_PIZARRA} height={ALTO_PIZARRA} fill="#f8fafc" />
            <path d={`M0 ${ALTO_PIZARRA / 2} H${ANCHO_PIZARRA} M${ANCHO_PIZARRA / 2} 0 V${ALTO_PIZARRA}`} stroke="#e2e8f0" strokeWidth="2" strokeDasharray="8 8" />
            {piz.trazos.map(tr => (
              <g key={tr.id}>
                <polyline points={puntosSvg(tr.puntos)} fill="none" stroke={tr.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                {tr.tipo === 'flecha' && <polyline points={cabezaFlecha(tr.puntos)} fill="none" stroke={tr.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
                {herramienta === 'borrar' && (
                  <polyline points={puntosSvg(tr.puntos)} fill="none" stroke="transparent" strokeWidth="22" style={{ cursor: 'pointer' }}
                    onPointerDown={e => { e.stopPropagation(); cambiar(p => ({ ...p, trazos: p.trazos.filter(x => x.id !== tr.id) })); }} />
                )}
              </g>
            ))}
            {piz.elementos.map(el => {
              const m = materialDePizarra(el.material);
              return (
                <g key={el.id} transform={transformDeElemento(el, m)} onPointerDown={e => alPulsarElemento(e, el)}
                  className={`ef-piz-el${seleccion.includes(el.id) ? ' sel' : ''}`}>
                  <rect x={-6} y={-6} width={m.ancho + 12} height={m.alto + 12} rx="6" className="ef-piz-marco" />
                  <g dangerouslySetInnerHTML={{ __html: m.svg(el.texto) }} />
                </g>
              );
            })}
            {croquis.map(c => (
              <polyline key={c.id} points={puntosSvg(c.puntos)} fill="none" stroke="#ea580c" strokeWidth="3" strokeDasharray="7 6" strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {propuestas.filter(p => p.origen === 'ia').map(p => (
              <rect key={p.id} x={p.caja.x} y={p.caja.y} width={p.caja.w} height={p.caja.h} fill="none" stroke="#ea580c" strokeWidth="2" strokeDasharray="4 4" rx="6" />
            ))}
            {marco && (
              <rect x={Math.min(marco.a[0], marco.b[0])} y={Math.min(marco.a[1], marco.b[1])} width={Math.abs(marco.a[0] - marco.b[0])} height={Math.abs(marco.a[1] - marco.b[1])}
                fill="rgba(124,58,237,.08)" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="5 4" />
            )}
            {enCurso && (
              <g>
                <polyline points={puntosSvg(enCurso.puntos)} fill="none" stroke={enCurso.tipo === 'material' ? '#ea580c' : color} strokeWidth={enCurso.tipo === 'material' ? 3 : 4}
                  strokeDasharray={enCurso.tipo === 'material' ? '7 6' : undefined} strokeLinecap="round" strokeLinejoin="round" />
                {enCurso.tipo === 'flecha' && <polyline points={cabezaFlecha(enCurso.puntos)} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
              </g>
            )}
          </svg>
          {cajaElegidos && !moviendo && !marco && herramienta === 'mover' && (
            <div className="ef-piz-flota" role="toolbar" aria-label={t('Acciones de la pieza')}
              style={{
                left: `${limita((cajaElegidos.x + cajaElegidos.w / 2) / ANCHO_PIZARRA * 100, 12, 88)}%`,
                top: `${cajaElegidos.y < 70 ? (cajaElegidos.y + cajaElegidos.h + 8) / ALTO_PIZARRA * 100 : (cajaElegidos.y - 8) / ALTO_PIZARRA * 100}%`,
                transform: cajaElegidos.y < 70 ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
              }}>
              <button type="button" title={t('Duplicar (Ctrl+D)')} aria-label={t('Duplicar')} onClick={() => duplicarElegidos()}><Copy size={16} /></button>
              <button type="button" title={t('Girar a la derecha')} aria-label={t('Girar a la derecha')} onClick={() => cambiarElementos(seleccion, x => ({ ...x, giro: (x.giro + 15) % 360 }))}><RotateCw size={16} /></button>
              <button type="button" title={t('Quitar')} aria-label={t('Quitar')} onClick={quitarElegidos}><Trash2 size={16} /></button>
            </div>
          )}
          </div>
          <p className="ap-sub">{t('«Dibujar material»: traza a mano formas (un triángulo, un círculo, un rectángulo, una raya…). Con una sola, la app propone qué es y tú lo confirmas; desde dos, las procesa la IA y coloca las piezas.')}</p>
          <p className="ap-sub">{t('Para duplicar: el botón de la pieza, Ctrl+D (otra vez, repite la distancia de la última copia), Alt y arrastrar, o Ctrl+C y Ctrl+V. Mayús y clic, o un recuadro, eligen varias piezas.')}</p>

          {elegidos.length > 0 && (
            <div className="card ef-piz-sel" role="group" aria-label={t('Pieza elegida')}>
              <strong>{elegido ? t(materialDePizarra(elegido.material).label) : t('{n} piezas elegidas', { n: elegidos.length })}</strong>
              {elegido?.material === 'estacion' && (
                <input className="finput" style={{ width: 70 }} maxLength={3} value={elegido.texto ?? ''} aria-label={t('Número de la estación')}
                  onChange={e => cambiarElementos([elegido.id], x => ({ ...x, texto: e.target.value }))} />
              )}
              <button type="button" className="btn-ghost" onClick={() => cambiarElementos(seleccion, x => ({ ...x, giro: (x.giro - 15 + 360) % 360 }))}><RotateCcw size={14} />{t('Girar a la izquierda')}</button>
              <button type="button" className="btn-ghost" onClick={() => cambiarElementos(seleccion, x => ({ ...x, giro: (x.giro + 15) % 360 }))}><RotateCw size={14} />{t('Girar a la derecha')}</button>
              <button type="button" className="btn-ghost" onClick={() => cambiarElementos(seleccion, x => ({ ...x, escala: Math.max(0.3, Math.round(x.escala * 85) / 100) }))}><ZoomOut size={14} />{t('Más pequeño')}</button>
              <button type="button" className="btn-ghost" onClick={() => cambiarElementos(seleccion, x => ({ ...x, escala: Math.min(4, Math.round(x.escala * 118) / 100) }))}><ZoomIn size={14} />{t('Más grande')}</button>
              <button type="button" className="btn-ghost" onClick={() => duplicarElegidos()}><Copy size={14} />{t('Duplicar')}</button>
              <span className="ef-piz-fila">
                <input className="finput" type="number" min={1} max={20} value={copiasEnFila} aria-label={t('Número de copias')}
                  onChange={e => setCopiasEnFila(e.target.value)} />
                <button type="button" className="btn-ghost" onClick={copiarEnFila}><CopyPlus size={14} />{t('Copias en fila')}</button>
              </span>
              <button type="button" className="btn-ghost ap-borrar" onClick={quitarElegidos}><Trash2 size={14} />{t('Quitar')}</button>
            </div>
          )}

          {(propuestas.length > 0 || croquis.length > 0) && (
            <div className="card ef-piz-props" role="region" aria-label={t('Lo que la app ha reconocido')}>
              <div className="home-card-ttl">{t('Lo que ha reconocido la app')}</div>
              {resumenIa && <p className="ef-foto-visto"><strong>{t('Lo que ve la IA')}:</strong> {resumenIa}</p>}
              {propuestas.map(p => (
                <div key={p.id} className="ef-piz-prop">
                  <span>
                    {p.origen === 'forma' && p.forma ? t('Has dibujado {forma}. ¿Qué es?', { forma: t(FORMAS[p.forma]) }) : t('La IA ve una pieza.')}
                    {p.seguridad === 'baja' && <em> {t('(poco segura)')}</em>}
                  </span>
                  <select className="finput" value={p.material} aria-label={t('Qué material es')}
                    onChange={e => setPropuestas(x => x.map(y => (y.id === p.id ? { ...y, material: e.target.value as MaterialPizarraId } : y)))}>
                    {p.candidatos.map(c => <option key={c} value={c}>{t(materialDePizarra(c).label)}</option>)}
                  </select>
                  <button type="button" className="btn-accent" onClick={() => resolver(p, true)}><Check size={14} />{t('Poner')}</button>
                  <button type="button" className="btn-ghost" onClick={() => resolver(p, false)}><X size={14} />{t('Descartar')}</button>
                </div>
              ))}
              <div className="ap-acciones">
                {propuestas.length > 1 && <button type="button" className="btn-accent" onClick={ponerTodas}><Check size={14} />{t('Poner todas')}</button>}
                <button type="button" className="btn-ghost" onClick={() => void reconocerConIa()} disabled={pensando || !hasApiKey()}
                  title={hasApiKey() ? undefined : t('Configura tu clave API gratuita de Google en Configuración para usar la IA.')}>
                  {pensando ? <span className="spin" /> : <Sparkles size={14} />}{pensando ? t('Mirando el croquis…') : t('Reconocer con IA')}
                </button>
                <button type="button" className="btn-ghost" onClick={descartarCroquis}>{t('Descartar el croquis')}</button>
              </div>
              <p className="ap-aviso">{t('Desde la segunda forma, y con «Reconocer con IA», se envía a Google una imagen del croquis, solo con los trazos, y AulaPro no la guarda.')}</p>
            </div>
          )}
        </div>

        <aside className="card ef-piz-lista" aria-label={t('Material del circuito')}>
          <div className="home-card-ttl">{t('Material del circuito')}</div>
          {material.length === 0
            ? <p className="ap-sub">{t('Aún no hay material en la pizarra.')}</p>
            : (
              <ul className="ef-piz-mat">
                {material.map(m => <li key={m.material}><strong>{m.n}</strong> {t(materialDePizarra(m.material).label)}</li>)}
              </ul>
            )}
          <p className="ap-sub">{t('{n} estaciones', { n: piz.elementos.filter(e => e.material === 'estacion').length })}</p>
        </aside>
      </div>
    </section>
  );
}
