import { useEffect, useRef } from 'react';
import { Trash2, Undo2, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useToast } from './Toast';
import { DURACION_DESHACER_MS, textoDeBorrados, type Borrado } from '../../lib/deshacer';

interface Props {
  /** El último borrado, mientras se puede deshacer (`useAppState`). */
  pendiente: { id: number; borrados: Borrado[] } | null;
  /** Repone lo borrado; devuelve si lo ha hecho. */
  onDeshacer: () => boolean;
  /** Pasó el tiempo o se cerró el aviso: ya no se puede deshacer. */
  onOlvidar: () => void;
  /** Para las pruebas. */
  duracion?: number;
}

function escribiendo(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/**
 * El aviso que sale tras cada borrado (20-11-2026): dice qué se ha borrado y lleva el botón «Deshacer», que lo
 * devuelve tal como estaba, con todo lo que se fue con él. Dura unos diez segundos (la barra de abajo lo va
 * diciendo) y el tiempo se para mientras el ratón está encima o el foco está dentro, para que dé tiempo a
 * leerlo y a llegar al botón con el teclado. Fuera de un campo de texto, Ctrl+Z también deshace.
 */
export function AvisoDeshacer({ pendiente, onDeshacer, onOlvidar, duracion = DURACION_DESHACER_MS }: Props) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const caja = useRef<HTMLDivElement>(null);
  const reloj = useRef<{ timer: ReturnType<typeof setTimeout> | null; resto: number; desde: number }>({ timer: null, resto: duracion, desde: 0 });
  const olvidarRef = useRef(onOlvidar);
  const deshacerRef = useRef<() => void>(() => {});
  const id = pendiente?.id ?? null;

  const deshacer = () => {
    if (onDeshacer()) toast(t('Recuperado: está todo como antes'));
  };
  useEffect(() => { olvidarRef.current = onOlvidar; deshacerRef.current = deshacer; });

  const parar = () => {
    const r = reloj.current;
    if (r.timer === null) return;
    clearTimeout(r.timer);
    r.timer = null;
    r.resto = Math.max(0, r.resto - (Date.now() - r.desde));
  };
  const seguir = () => {
    const r = reloj.current;
    if (r.timer !== null) return;
    r.desde = Date.now();
    r.timer = setTimeout(() => { r.timer = null; olvidarRef.current(); }, r.resto);
  };

  // Cada borrado nuevo empieza a contar de cero
  useEffect(() => {
    if (id === null) return;
    const r = reloj.current;
    r.resto = duracion;
    r.desde = Date.now();
    // Si sale justo debajo del ratón, espera a que se aparte (la barra, por CSS, tampoco corre)
    r.timer = caja.current?.matches(':hover') ? null : setTimeout(() => { r.timer = null; olvidarRef.current(); }, duracion);
    return () => { if (r.timer !== null) clearTimeout(r.timer); r.timer = null; };
  }, [id, duracion]);

  // El aviso corto de siempre (`.toast`, «Clase eliminada») sale en el mismo sitio: mientras este está a la vista,
  // sube por encima de él (estilos/deshacer.css) en vez de taparlo
  useEffect(() => {
    if (id === null) return;
    const raiz = document.documentElement;
    raiz.classList.add('con-deshacer');
    raiz.style.setProperty('--deshacer-alto', `${caja.current?.offsetHeight ?? 60}px`);
    return () => { raiz.classList.remove('con-deshacer'); raiz.style.removeProperty('--deshacer-alto'); };
  }, [id]);

  // Ctrl+Z (⌘Z) deshace, salvo que se esté escribiendo: ahí es el deshacer del propio campo
  useEffect(() => {
    if (id === null) return;
    const tecla = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z' || escribiendo(e.target)) return;
      e.preventDefault();
      deshacerRef.current();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [id]);

  if (!pendiente) return null;

  return (
    <div
      key={pendiente.id} ref={caja}
      className="deshacer" role="status" aria-live="polite"
      onPointerEnter={e => { if (e.pointerType === 'mouse') parar(); }}
      onPointerLeave={e => { if (e.pointerType === 'mouse') seguir(); }}
      onFocus={parar}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) seguir(); }}
    >
      <Trash2 size={17} className="deshacer-ico" aria-hidden="true" />
      <span className="deshacer-txt">{textoDeBorrados(pendiente.borrados, t, locale)}</span>
      <button type="button" className="deshacer-btn" onClick={deshacer}>
        <Undo2 size={15} aria-hidden="true" />{t('Deshacer')}
      </button>
      <button type="button" className="deshacer-x" onClick={onOlvidar} aria-label={t('Cerrar')} title={t('Cerrar')}>
        <X size={16} aria-hidden="true" />
      </button>
      <span className="deshacer-barra" aria-hidden="true"><span style={{ animationDuration: `${duracion}ms` }} /></span>
    </div>
  );
}
