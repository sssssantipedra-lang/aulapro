/**
 * Dentro de una clase de Sesiones (petición del dueño, 21-10-2026): sus
 * sesiones agrupadas por situación de aprendizaje, con selección para actuar
 * sobre varias a la vez (eliminar, archivar, asociarlas a una SdA o crear una
 * SdA con ellas). Las archivadas salen aparte y se restauran.
 */
import { useState } from 'react';
import { ArrowLeft, Archive, ArchiveRestore, ChevronDown, Lightbulb, Link2, ListChecks, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import { agruparPorSda, moverEnLista } from '../../lib/sesiones';
import type { LearningSituation } from '../../types';
import type { SesionEF } from '../../types/ef';

/** Lo que la fila necesita para subir, bajar o arrastrarse dentro de su grupo. */
export interface OrdenFila {
  sube?: () => void;
  baja?: () => void;
  arrastrando: boolean;
  encima: boolean;
  alEmpezar: (e: React.DragEvent) => void;
  alTerminar: () => void;
  alArrastrarSobre: (e: React.DragEvent) => void;
  alSoltar: (e: React.DragEvent) => void;
}

interface Props {
  nombre: string;
  color?: string;
  /** Las sesiones de esta clase, también las archivadas. */
  sesiones: SesionEF[];
  sdas: LearningSituation[];
  /** Cómo se pinta una sesión; `seleccion` si se está eligiendo. */
  fila: (s: SesionEF, seleccion?: { marcada: boolean; alternar: () => void }, orden?: OrdenFila) => React.ReactNode;
  onVolver: () => void;
  onNueva: () => void;
  onEliminar: (ids: string[]) => void;
  onArchivar: (ids: string[], archivar: boolean) => void;
  /** Fija el orden de un grupo: sus ids en el orden nuevo y si es una SdA. */
  onOrdenar: (ids: string[], enSda: boolean) => void;
  onAsociar: (ids: string[]) => void;
  onCrearSda: (ids: string[]) => void;
  onAbrirSda?: () => void;
  /** Si crear una SdA con IA está disponible en este perfil. */
  puedeCrearSda: boolean;
}

export function SesionesDeClase({
  nombre, color, sesiones, sdas, fila, onVolver, onNueva, onEliminar, onArchivar, onOrdenar, onAsociar, onCrearSda, onAbrirSda, puedeCrearSda,
}: Props) {
  const { t } = useI18n();
  const [seleccionando, setSeleccionando] = useState(false);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [arrastrada, setArrastrada] = useState<string | null>(null);
  const [encima, setEncima] = useState<string | null>(null);
  const [plegados, setPlegados] = useState<Set<string>>(new Set());

  const vivas = sesiones.filter(s => !s.archivada);
  const archivadas = sesiones.filter(s => s.archivada);
  const grupos = agruparPorSda(vivas, sdas);
  const hechas = vivas.filter(s => s.completada).length;
  // Siempre en el orden en que se ven, no en el de marcarlas
  const ordenVisible = [...grupos.flatMap(g => g.sesiones), ...(verArchivadas ? archivadas : [])];
  const elegidas = ordenVisible.filter(s => marcadas.has(s.id)).map(s => s.id);

  const alternar = (id: string) => setMarcadas(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const marcarGrupo = (ids: string[]) => setMarcadas(prev => {
    const n = new Set(prev);
    const todas = ids.every(i => n.has(i));
    ids.forEach(i => (todas ? n.delete(i) : n.add(i)));
    return n;
  });
  const salirDeSeleccion = () => { setSeleccionando(false); setMarcadas(new Set()); };
  const conSeleccion = (s: SesionEF) => (seleccionando ? { marcada: marcadas.has(s.id), alternar: () => alternar(s.id) } : undefined);

  /** Cómo se mueve la fila `id` dentro de su grupo (`ids`, en el orden en que se ve). */
  const ordenDe = (ids: string[], enSda: boolean, id: string): OrdenFila | undefined => {
    if (seleccionando || ids.length < 2) return undefined;
    const i = ids.indexOf(id);
    const mover = (destino: number) => onOrdenar(moverEnLista(ids, id, destino), enSda);
    return {
      ...(i > 0 ? { sube: () => mover(i - 1) } : {}),
      ...(i < ids.length - 1 ? { baja: () => mover(i + 1) } : {}),
      arrastrando: arrastrada === id,
      encima: !!arrastrada && arrastrada !== id && encima === id,
      alEmpezar: e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); setArrastrada(id); },
      alTerminar: () => { setArrastrada(null); setEncima(null); },
      alArrastrarSobre: e => {
        // Solo se suelta sobre otra del mismo grupo
        if (!arrastrada || !ids.includes(arrastrada)) return;
        e.preventDefault();
        if (encima !== id) setEncima(id);
      },
      alSoltar: e => {
        e.preventDefault();
        if (arrastrada && arrastrada !== id && ids.includes(arrastrada)) onOrdenar(moverEnLista(ids, arrastrada, i), enSda);
        setArrastrada(null); setEncima(null);
      },
    };
  };

  function accion(f: (ids: string[]) => void) { f(elegidas); salirDeSeleccion(); }
  const hayArchivadasElegidas = elegidas.some(id => sesiones.find(s => s.id === id)?.archivada);

  return (
    <div className="ses-clase-vista">
      <div className="ses-clase-cab">
        <button type="button" className="btn-ghost" onClick={onVolver}><ArrowLeft size={15} />{t('Sesiones')}</button>
        <h2 className="ses-clase-nombre"><span className="sda-group-dot" style={{ background: color ?? 'var(--text-3)' }} aria-hidden="true" />{nombre}</h2>
        {vivas.length > 0 && <span className="ap-sub">{t('{hechas} de {total} sesiones completadas', { hechas, total: vivas.length })}</span>}
        <span className="ses-clase-acc">
          <button type="button" className="btn-ghost" onClick={onNueva}><Plus size={15} />{t('Nueva sesión')}</button>
          <button type="button" className={`btn-ghost${seleccionando ? ' on' : ''}`} aria-pressed={seleccionando} disabled={sesiones.length === 0}
            onClick={() => (seleccionando ? salirDeSeleccion() : setSeleccionando(true))}>
            <ListChecks size={15} />{seleccionando ? t('Terminar de elegir') : t('Elegir varias')}
          </button>
        </span>
      </div>

      {seleccionando && (
        <div className="ses-barra" role="toolbar" aria-label={t('Qué hacer con las sesiones elegidas')}>
          <strong aria-live="polite">{t(elegidas.length === 1 ? '{n} elegida' : '{n} elegidas', { n: elegidas.length })}</strong>
          <button type="button" className="btn-ghost" onClick={() => setMarcadas(new Set(ordenVisible.map(s => s.id)))}>{t('Elegir todas')}</button>
          <button type="button" className="btn-ghost" disabled={elegidas.length === 0} onClick={() => accion(onAsociar)}><Link2 size={14} />{t('Asociar a una SdA')}</button>
          {puedeCrearSda && <button type="button" className="btn-ghost" disabled={elegidas.length === 0} onClick={() => accion(onCrearSda)}><Lightbulb size={14} />{t('Crear una SdA con ellas')}</button>}
          <button type="button" className="btn-ghost" disabled={elegidas.length === 0} onClick={() => accion(ids => onArchivar(ids, !hayArchivadasElegidas))}>
            {hayArchivadasElegidas ? <ArchiveRestore size={14} /> : <Archive size={14} />}{t(hayArchivadasElegidas ? 'Restaurar' : 'Archivar')}
          </button>
          <button type="button" className="btn-ghost ap-borrar" disabled={elegidas.length === 0} onClick={() => accion(onEliminar)}><Trash2 size={14} />{t('Eliminar')}</button>
        </div>
      )}

      {vivas.length === 0 && archivadas.length === 0 && <p className="ap-vacio card">{t('Esta clase todavía no tiene sesiones. Crea una o pásalas desde una situación de aprendizaje.')}</p>}

      {grupos.map(g => {
        const plegado = plegados.has(g.key);
        const ids = g.sesiones.map(s => s.id);
        const hechasG = g.sesiones.filter(s => s.completada).length;
        return (
          <section key={g.key} className="card ses-grupo">
            <div className="ses-grupo-hd">
              {seleccionando && (
                <input type="checkbox" checked={ids.every(i => marcadas.has(i))} onChange={() => marcarGrupo(ids)}
                  aria-label={t('Elegir todas las sesiones de «{grupo}»', { grupo: g.sda?.title ?? t('Sin situación de aprendizaje') })} />
              )}
              <button type="button" className="sda-group-hd" aria-expanded={!plegado}
                onClick={() => setPlegados(prev => { const n = new Set(prev); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}>
                <ChevronDown size={16} style={{ transform: plegado ? 'rotate(-90deg)' : 'none' }} aria-hidden="true" />
                <span className="sda-group-name">{g.sda ? `${g.sda.request.numero ? `${g.sda.request.numero}. ` : ''}${g.sda.title}` : t('Sin situación de aprendizaje')}</span>
                <span className="sda-count">{g.sesiones.length}</span>
                {hechasG > 0 && <span className="ap-sub" style={{ marginLeft: 'auto' }}>{t('{hechas} de {total} sesiones completadas', { hechas: hechasG, total: g.sesiones.length })}</span>}
              </button>
              {g.sda && onAbrirSda && <button type="button" className="btn-ghost ses-grupo-abrir" onClick={onAbrirSda}>{t('Ver la SdA')}</button>}
            </div>
            {!plegado && <ul className="ap-lista ef-sesiones">{g.sesiones.map(s => fila(s, conSeleccion(s), ordenDe(ids, !!g.sda, s.id)))}</ul>}
          </section>
        );
      })}

      {archivadas.length > 0 && (
        <>
          <button type="button" className="home-link" style={{ marginTop: 14 }} onClick={() => setVerArchivadas(v => !v)} aria-expanded={verArchivadas}>
            {verArchivadas ? t('Ocultar las archivadas') : t('Ver las archivadas ({n})', { n: archivadas.length })}
          </button>
          {verArchivadas && <div className="card ses-archivadas"><ul className="ap-lista ef-sesiones">{archivadas.map(s => fila(s, conSeleccion(s)))}</ul></div>}
        </>
      )}
    </div>
  );
}
