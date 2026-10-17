/**
 * Educación Física, «Pizarra»: un circuito dibujado sobre una pista, con un
 * banco de material en imágenes que se coloca, se mueve y se gira (petición
 * del dueño, 17-10-2026). Lo que se dibuja a mano con «Dibujar material» se
 * reconoce por su forma (`analizarTrazo`) o con la IA (`reconocerPizarra`), y
 * el docente confirma cada propuesta antes de que sustituya al dibujo. Ver
 * `docs/EF.md`.
 */
import { useMemo, useRef, useState } from 'react';
import {
  Plus, Save, Trash2, Undo2, Download, Sparkles, MousePointer2, Pencil, MoveRight, Shapes, Eraser, RotateCcw, RotateCw,
  ZoomIn, ZoomOut, Copy, Check, X,
} from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { useI18n } from '../../i18n';
import { downloadFile } from '../../lib/download';
import { nuevoIdEF } from '../../lib/ef';
import {
  ALTO_PIZARRA, ANCHO_PIZARRA, analizarTrazo, cabezaFlecha, COLORES_TRAZO, elementoDeTrazo, elementoNuevo, materialDeLaPizarra,
  materialDePizarra, MATERIALES_PIZARRA, pizarraSvg, puntosSvg, siguienteEstacion, transformDeElemento, type AnalisisTrazo, type Caja,
} from '../../lib/pizarraEF';
import { hasApiKey, type InlineFile } from '../../services/gemini';
import { reconocerPizarra } from '../../services/efIA';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import type { EfData, ElementoPizarra, MaterialPizarraId, PizarraEF, TrazoPizarra } from '../../types/ef';

interface Props {
  ef: EfData;
  onChangeEf: (f: (d: EfData) => EfData) => void;
  comunidad?: ComunidadId;
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

/** Pasa un SVG a PNG con el lienzo del navegador. */
async function aPng(svg: string, ancho = 2 * ANCHO_PIZARRA): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No se pudo dibujar la imagen'));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = Math.round(ancho * ALTO_PIZARRA / ANCHO_PIZARRA);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Sin lienzo');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Sin imagen'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

const blobABase64 = (b: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve((r.result as string).split(',')[1]);
  r.onerror = reject;
  r.readAsDataURL(b);
});

export function EfPizarra({ ef, onChangeEf, comunidad }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [piz, setPiz] = useState<PizarraEF>(VACIA);
  const [historial, setHistorial] = useState<PizarraEF[]>([]);
  const [herramienta, setHerramienta] = useState<Herramienta>('mover');
  const [color, setColor] = useState<string>(COLORES_TRAZO[0].id);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [enCurso, setEnCurso] = useState<{ tipo: 'lapiz' | 'flecha' | 'material'; puntos: Punto[] } | null>(null);
  const [croquis, setCroquis] = useState<{ id: string; puntos: Punto[] }[]>([]);
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [resumenIa, setResumenIa] = useState('');
  const [pensando, setPensando] = useState(false);
  const arrastre = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const guardada = ef.pizarras.find(p => p.id === piz.id);
  const sinGuardar = guardada
    ? JSON.stringify(guardada) !== JSON.stringify(piz)
    : piz.elementos.length > 0 || piz.trazos.length > 0;
  const elegido = piz.elementos.find(e => e.id === seleccionado);
  const material = useMemo(() => materialDeLaPizarra(piz.elementos), [piz.elementos]);

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

  const cambiarElemento = (id: string, f: (e: ElementoPizarra) => ElementoPizarra) =>
    cambiar(p => ({ ...p, elementos: p.elementos.map(e => (e.id === id ? f(e) : e)) }));

  function poner(m: MaterialPizarraId, x?: number, y?: number) {
    const n = piz.elementos.length;
    const e = elementoNuevo(
      nuevoIdEF('el'), m,
      x ?? ANCHO_PIZARRA / 2 + ((n * 47) % 240) - 120,
      y ?? ALTO_PIZARRA / 2 + ((n * 31) % 160) - 80,
      m === 'estacion' ? siguienteEstacion(piz.elementos) : undefined,
    );
    cambiar(p => ({ ...p, elementos: [...p.elementos, e] }));
    setSeleccionado(e.id);
    setHerramienta('mover');
  }

  function quitar(id: string) {
    cambiar(p => ({ ...p, elementos: p.elementos.filter(e => e.id !== id) }));
    if (seleccionado === id) setSeleccionado(null);
  }

  function duplicar(e: ElementoPizarra) {
    const nuevo = { ...e, id: nuevoIdEF('el'), x: limita(e.x + 30, 0, ANCHO_PIZARRA), y: limita(e.y + 30, 0, ALTO_PIZARRA), ...(e.material === 'estacion' ? { texto: siguienteEstacion(piz.elementos) } : {}) };
    cambiar(p => ({ ...p, elementos: [...p.elementos, nuevo] }));
    setSeleccionado(nuevo.id);
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
    if (herramienta === 'mover') { setSeleccionado(null); return; }
    if (herramienta === 'borrar') return;
    svgRef.current?.setPointerCapture(e.pointerId);
    setEnCurso({ tipo: herramienta, puntos: [punto(e)] });
  }

  function alPulsarElemento(e: React.PointerEvent, el: ElementoPizarra) {
    if (herramienta === 'borrar') { e.stopPropagation(); quitar(el.id); return; }
    if (herramienta !== 'mover') return;
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    const [x, y] = punto(e);
    setSeleccionado(el.id);
    setHistorial(h => [...h.slice(-49), piz]);
    arrastre.current = { id: el.id, dx: el.x - x, dy: el.y - y };
  }

  function alMover(e: React.PointerEvent<SVGSVGElement>) {
    const [x, y] = punto(e);
    if (arrastre.current) {
      const { id, dx, dy } = arrastre.current;
      setPiz(p => ({ ...p, elementos: p.elementos.map(el => (el.id === id ? { ...el, x: limita(Math.round(x + dx), 0, ANCHO_PIZARRA), y: limita(Math.round(y + dy), 0, ALTO_PIZARRA) } : el)) }));
      return;
    }
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
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); deshacer(); return; }
    if (!elegido) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); quitar(elegido.id); return; }
    const paso = e.shiftKey ? 30 : 10;
    const mov: Record<string, [number, number]> = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] };
    const m = mov[e.key];
    if (m) {
      e.preventDefault();
      cambiarElemento(elegido.id, x => ({ ...x, x: limita(x.x + m[0], 0, ANCHO_PIZARRA), y: limita(x.y + m[1], 0, ALTO_PIZARRA) }));
    }
  }

  /* ── Propuestas de lo dibujado ── */
  function ponerPropuesta(p: Propuesta, m = p.material) {
    const el = elementoDeTrazo(nuevoIdEF('el'), m, p.caja, m === 'estacion' ? siguienteEstacion(piz.elementos) : undefined);
    cambiar(x => ({ ...x, elementos: [...x.elementos, el] }));
    return el;
  }

  function resolver(p: Propuesta, poner_: boolean) {
    if (poner_) setSeleccionado(ponerPropuesta(p).id);
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

  async function reconocerConIa() {
    if (!croquis.length) { toast(t('Dibuja primero con «Dibujar material» y la IA lo reconocerá.')); return; }
    setPensando(true);
    try {
      const trazos: TrazoPizarra[] = croquis.map(c => ({ id: c.id, tipo: 'libre', puntos: c.puntos, color: '#1e293b' }));
      const png = await aPng(pizarraSvg({ elementos: [], trazos }), ANCHO_PIZARRA);
      const archivo: InlineFile = { name: 'croquis.png', mimeType: 'image/png', base64: await blobABase64(png) };
      const r = await reconocerPizarra(archivo, comunidad, lang, { onError: m => toast(t(m)) });
      if (!r) return;
      if (!r.objetos.length) { toast(t('La IA no ha reconocido ninguna pieza en el croquis.')); return; }
      setResumenIa(r.resumen);
      setPropuestas(r.objetos.map(o => {
        const ancho = o.ancho * ANCHO_PIZARRA;
        const alto = o.alto * ALTO_PIZARRA;
        return {
          id: nuevoIdEF('pr'), caja: { x: o.x * ANCHO_PIZARRA - ancho / 2, y: o.y * ALTO_PIZARRA - alto / 2, w: ancho, h: alto },
          candidatos: MATERIALES_PIZARRA.filter(m => m.id !== 'estacion').map(m => m.id), material: o.material, origen: 'ia', seguridad: o.seguridad,
        };
      }));
    } catch {
      toast(t('No se pudo preparar el croquis para la IA.'));
    } finally {
      setPensando(false);
    }
  }

  /* ── Guardar, abrir, bajar ── */
  function confirmarDescarte(): boolean {
    return !sinGuardar || window.confirm(t('Hay cambios sin guardar. ¿Descartarlos?'));
  }

  function abrir(p: PizarraEF | null) {
    if (!confirmarDescarte()) return;
    setPiz(p ? copia(p) : VACIA());
    setHistorial([]);
    setSeleccionado(null);
    descartarCroquis();
  }

  function guardar() {
    const nombre = piz.nombre.trim();
    if (!nombre) { toast(t('Ponle un nombre a la pizarra.')); return; }
    const p = { ...copia(piz), nombre };
    onChangeEf(d => ({ ...d, pizarras: d.pizarras.some(x => x.id === p.id) ? d.pizarras.map(x => (x.id === p.id ? p : x)) : [...d.pizarras, p] }));
    setPiz(p);
    toast(t('✅ Guardado'));
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
      await downloadFile(await aPng(pizarraSvg(piz)), `${nombre || 'pizarra'}.png`);
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
          <h1 className="pg-title">{t('Pizarra de circuitos')}</h1>
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
                  className={`ef-piz-el${el.id === seleccionado ? ' sel' : ''}`}>
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
            {enCurso && (
              <g>
                <polyline points={puntosSvg(enCurso.puntos)} fill="none" stroke={enCurso.tipo === 'material' ? '#ea580c' : color} strokeWidth={enCurso.tipo === 'material' ? 3 : 4}
                  strokeDasharray={enCurso.tipo === 'material' ? '7 6' : undefined} strokeLinecap="round" strokeLinejoin="round" />
                {enCurso.tipo === 'flecha' && <polyline points={cabezaFlecha(enCurso.puntos)} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
              </g>
            )}
          </svg>
          <p className="ap-sub">{t('«Dibujar material»: traza a mano un triángulo (cono), un círculo (aro, balón o seta), un rectángulo (colchoneta, banco, portería…) o una raya (pica). La app propone qué es y tú lo confirmas.')}</p>

          {elegido && (
            <div className="card ef-piz-sel" role="group" aria-label={t('Pieza elegida')}>
              <strong>{t(materialDePizarra(elegido.material).label)}</strong>
              {elegido.material === 'estacion' && (
                <input className="finput" style={{ width: 70 }} maxLength={3} value={elegido.texto ?? ''} aria-label={t('Número de la estación')}
                  onChange={e => cambiarElemento(elegido.id, x => ({ ...x, texto: e.target.value }))} />
              )}
              <button type="button" className="btn-ghost" onClick={() => cambiarElemento(elegido.id, x => ({ ...x, giro: (x.giro - 15 + 360) % 360 }))}><RotateCcw size={14} />{t('Girar a la izquierda')}</button>
              <button type="button" className="btn-ghost" onClick={() => cambiarElemento(elegido.id, x => ({ ...x, giro: (x.giro + 15) % 360 }))}><RotateCw size={14} />{t('Girar a la derecha')}</button>
              <button type="button" className="btn-ghost" onClick={() => cambiarElemento(elegido.id, x => ({ ...x, escala: Math.max(0.3, Math.round(x.escala * 85) / 100) }))}><ZoomOut size={14} />{t('Más pequeño')}</button>
              <button type="button" className="btn-ghost" onClick={() => cambiarElemento(elegido.id, x => ({ ...x, escala: Math.min(4, Math.round(x.escala * 118) / 100) }))}><ZoomIn size={14} />{t('Más grande')}</button>
              <button type="button" className="btn-ghost" onClick={() => duplicar(elegido)}><Copy size={14} />{t('Duplicar')}</button>
              <button type="button" className="btn-ghost ap-borrar" onClick={() => quitar(elegido.id)}><Trash2 size={14} />{t('Quitar')}</button>
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
                <button type="button" className="btn-ghost" onClick={reconocerConIa} disabled={pensando || !hasApiKey()}
                  title={hasApiKey() ? undefined : t('Configura tu clave API gratuita de Google en Configuración para usar la IA.')}>
                  {pensando ? <span className="spin" /> : <Sparkles size={14} />}{pensando ? t('Mirando el croquis…') : t('Reconocer con IA')}
                </button>
                <button type="button" className="btn-ghost" onClick={descartarCroquis}>{t('Descartar el croquis')}</button>
              </div>
              <p className="ap-aviso">{t('«Reconocer con IA» envía a Google una imagen del croquis, solo con los trazos, y AulaPro no la guarda.')}</p>
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
