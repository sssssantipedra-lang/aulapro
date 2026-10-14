/**
 * Edición a mano de los dibujos de una ficha con hilo conductor (ver
 * `lib/hilos.ts`): el selector del hilo, los dibujos de cada ejercicio (con su
 * cantidad, si se pueden contar) y el buscador del catálogo. Todo sale de la
 * lista cerrada de `lib/ilustraciones.ts`: nunca se dibuja ni se inventa nada.
 */
import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n';
import { ILUSTRACIONES, ilustracionPorId, urlIlustracion } from '../../lib/ilustraciones';
import { HILOS, dibujosDeHilo, esContable, hiloPorId, type Hilo } from '../../lib/hilos';
import type { DibujoEjercicio, FichaExercise } from '../../services/resources';

type T = (k: string, v?: Record<string, string | number>) => string;

/** Un dibujo del catálogo, tal como va dentro de la aplicación. */
export function Dibujo({ id, size = 40 }: { id: string; size?: number }) {
  return <img src={`${import.meta.env.BASE_URL}${urlIlustracion(id)}`} alt="" width={size} height={size} loading="lazy" style={{ objectFit: 'contain' }} />;
}

/**
 * El selector del hilo conductor. `auto` (en el formulario) ofrece «Automático»;
 * en el editor, sin él, solo los hilos y «Sin dibujos». `detectado` es el que la
 * app elegiría por el tema.
 */
export function HiloSelector({ value, onChange, auto, detectado, t }: {
  value: string;
  onChange: (id: string) => void;
  auto?: boolean;
  detectado?: Hilo;
  t: T;
}) {
  const { lang } = useI18n();
  const hilos = useMemo(() => [...HILOS].sort((a, b) => a.nombre[lang].localeCompare(b.nombre[lang], lang)), [lang]);
  const hilo = value === 'auto' ? detectado : hiloPorId(value);
  return (
    <div className="fe-hilo">
      <select className="finput" value={value} onChange={e => onChange(e.target.value)} aria-label={t('Hilo conductor')}>
        {auto && <option value="auto">{t('Automático, según el tema')}{detectado ? ` · ${detectado.nombre[lang]}` : ''}</option>}
        <option value="ninguno">{t('Sin dibujos')}</option>
        {hilos.map(h => <option key={h.id} value={h.id}>{h.nombre[lang]}</option>)}
      </select>
      {hilo && value !== 'ninguno' && (
        <div className="fe-hilo-tira" aria-hidden="true">
          {dibujosDeHilo(hilo).slice(0, 6).map(d => <Dibujo key={d.id} id={d.id} size={34} />)}
        </div>
      )}
    </div>
  );
}

/** El buscador de dibujos: primero los del hilo y, debajo, todo el catálogo. */
export function DibujoPicker({ open, hilo, onPick, onClose }: { open: boolean; hilo?: Hilo; onPick: (id: string) => void; onClose: () => void }) {
  const { t, lang } = useI18n();
  const [texto, setTexto] = useState('');
  const q = texto.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const todos = useMemo(() => ILUSTRACIONES.filter(i => i.fuente === 'img'), []);
  const coincide = (i: (typeof todos)[number]) =>
    !q || i.descripcion[lang].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q) || i.temas.some(x => x.includes(q));
  const delHilo = hilo ? dibujosDeHilo(hilo).filter(coincide) : [];
  const enHilo = new Set(delHilo.map(i => i.id));
  const resto = todos.filter(i => !enHilo.has(i.id) && coincide(i));
  const elegir = (id: string) => { onPick(id); setTexto(''); onClose(); };
  const celda = (i: (typeof todos)[number]) => (
    <button key={i.id} type="button" className="ag-op" onClick={() => elegir(i.id)} title={i.descripcion[lang]}>
      <Dibujo id={i.id} size={56} />
      <span>{i.descripcion[lang].split(':')[0]}</span>
    </button>
  );
  return (
    <Modal open={open} onClose={onClose} wide title={t('Elige un dibujo')}>
      <div className="ag-buscar">
        <Search size={15} aria-hidden="true" />
        <input className="finput" value={texto} onChange={e => setTexto(e.target.value)} placeholder={t('Buscar: vaca, pizza, reloj…')} aria-label={t('Buscar un dibujo')} />
      </div>
      {delHilo.length === 0 && resto.length === 0 && <p className="ap-vacio" style={{ margin: '12px 0' }}>{t('No hay ningún dibujo con ese nombre. Prueba con otra palabra.')}</p>}
      {hilo && delHilo.length > 0 && (
        <>
          <div className="fe-lbl" style={{ margin: '12px 0 6px' }}>{t('Del hilo «{hilo}»', { hilo: hilo.nombre[lang] })}</div>
          <div className="ag-grid">{delHilo.map(celda)}</div>
        </>
      )}
      {resto.length > 0 && (
        <>
          <div className="fe-lbl" style={{ margin: '12px 0 6px' }}>{t('Todos los dibujos')}</div>
          <div className="ag-grid">{resto.slice(0, 80).map(celda)}</div>
        </>
      )}
    </Modal>
  );
}

/** Los dibujos de un ejercicio: cada uno con su cantidad (si se puede contar) y un botón para quitarlo. */
export function DibujosEditor({ ex, hiloId, onChange, t }: { ex: FichaExercise; hiloId?: string; onChange: (p: Partial<FichaExercise>) => void; t: T }) {
  const [abierto, setAbierto] = useState(false);
  const dibujos = ex.dibujos ?? [];
  const set = (i: number, p: Partial<DibujoEjercicio>) => onChange({ dibujos: dibujos.map((d, j) => (j === i ? { ...d, ...p } : d)) });
  const quitar = (i: number) => onChange({ dibujos: dibujos.filter((_, j) => j !== i).length ? dibujos.filter((_, j) => j !== i) : undefined });
  const poner = (id: string) => { if (!dibujos.some(d => d.ilustracion === id)) onChange({ dibujos: [...dibujos, { ilustracion: id, cantidad: 1 }] }); };
  return (
    <div className="fe-vis fe-vis-ex">
      <div className="fe-vis-row">
        <span className="fe-lbl">{t('Dibujos del ejercicio')}</span>
        {dibujos.map((d, i) => (
          <span key={d.ilustracion} className="fe-vis-img">
            <span title={ilustracionPorId(d.ilustracion)?.descripcion.es}><Dibujo id={d.ilustracion} size={36} /></span>
            {esContable(d.ilustracion)
              ? (
                <input
                  className="finput" type="number" min={1} max={10} value={d.cantidad ?? 1} aria-label={t('Cuántas veces se dibuja el dibujo {n}', { n: i + 1 })}
                  onChange={e => set(i, { cantidad: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
                />
              )
              : <em className="fe-hint" title={t('Este dibujo no se repite: solo sale una vez.')}>×1</em>}
            <button type="button" className="ico-btn sm" title={t('Quitar el dibujo {n}', { n: i + 1 })} aria-label={t('Quitar el dibujo {n}', { n: i + 1 })} onClick={() => quitar(i)}><Trash2 size={14} /></button>
          </span>
        ))}
        {dibujos.length < 3 && (
          <button type="button" className="btn-ghost sm" onClick={() => setAbierto(true)}><Plus size={14} />{t('Añadir un dibujo')}</button>
        )}
      </div>
      {dibujos.length > 0 && <span className="fe-hint">{t('Nómbralos en el enunciado («Cuenta las vacas»): la ficha dibuja la cantidad exacta.')}</span>}
      {abierto && <DibujoPicker open hilo={hiloPorId(hiloId)} onPick={poner} onClose={() => setAbierto(false)} />}
    </div>
  );
}
