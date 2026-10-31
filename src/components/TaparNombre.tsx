/**
 * Tapar el nombre en una foto antes de que vaya a la IA (31-10-2026, revisión de privacidad; ver `lib/tapar.ts`).
 * Se arrastra el dedo o el ratón sobre la foto para dibujar un rectángulo negro; «Tapar la franja de arriba» lo hace
 * de un toque. Para seguir hay que tapar algo o marcar que la foto no muestra ningún nombre. Lo tapado se pinta en la
 * imagen al enviarla, en el dispositivo.
 */
import { useRef, useState } from 'react';
import { EyeOff, Undo2, X, Check } from 'lucide-react';
import { Modal } from './ui/Modal';
import { useI18n } from '../i18n';
import { estiloZona, FRANJA_SUPERIOR, zonaEntre, zonaValida, type Punto, type Zona } from '../lib/tapar';
import type { InlineFile } from '../services/gemini';

interface Props {
  foto: InlineFile | null;
  /** Lo que se propone de partida: lo que se tapó en la misma página del alumno anterior. */
  zonasIniciales?: readonly Zona[];
  /** Título de la ventana (por ejemplo, «Página 2»). */
  titulo?: string;
  onListo: (zonas: Zona[]) => void;
  onCancelar: () => void;
}


export function TaparNombre({ foto, zonasIniciales = [], titulo, onListo, onCancelar }: Props) {
  // El componente se monta de nuevo para cada foto (`key`): el estado de partida sale de las props
  const { t } = useI18n();
  const [zonas, setZonas] = useState<Zona[]>([...zonasIniciales]);
  const [sinNombre, setSinNombre] = useState(false);
  const [dibujando, setDibujando] = useState<{ desde: Punto; hasta: Punto } | null>(null);
  const lienzo = useRef<HTMLDivElement>(null);

  const punto = (e: React.PointerEvent): Punto => {
    const r = lienzo.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  function empezar(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    lienzo.current?.setPointerCapture(e.pointerId);
    const p = punto(e);
    setDibujando({ desde: p, hasta: p });
  }
  function mover(e: React.PointerEvent) {
    if (dibujando) setDibujando({ ...dibujando, hasta: punto(e) });
  }
  function terminar() {
    if (!dibujando) return;
    const z = zonaEntre(dibujando.desde, dibujando.hasta);
    setDibujando(null);
    if (zonaValida(z)) { setZonas(x => [...x, z]); setSinNombre(false); }
  }

  const enCurso = dibujando ? zonaEntre(dibujando.desde, dibujando.hasta) : null;
  const puedeSeguir = zonas.length > 0 || sinNombre;

  return (
    <Modal open={!!foto} onClose={onCancelar} wide title={titulo ?? t('Tapa el nombre antes de enviar')}>
      {foto && (
        <div className="tapar">
          <p className="ap-sub" style={{ margin: '0 0 10px' }}>
            {t('Arrastra el dedo o el ratón sobre el nombre, el número de lista o cualquier dato del alumno para taparlo. Lo tapado se pinta de negro en la foto aquí, en tu dispositivo, y la IA no lo ve.')}
          </p>
          <div className="tapar-acciones">
            <button type="button" className="btn-ghost" onClick={() => { setZonas(x => [...x, FRANJA_SUPERIOR]); setSinNombre(false); }}>
              <EyeOff size={14} />{t('Tapar la franja de arriba')}
            </button>
            <button type="button" className="btn-ghost" disabled={!zonas.length} onClick={() => setZonas(x => x.slice(0, -1))}>
              <Undo2 size={14} />{t('Deshacer')}
            </button>
          </div>
          <div
            ref={lienzo} className="tapar-lienzo" role="application" aria-label={t('Foto: arrastra para tapar una zona')}
            onPointerDown={empezar} onPointerMove={mover} onPointerUp={terminar} onPointerCancel={() => setDibujando(null)}
          >
            <img src={`data:${foto.mimeType};base64,${foto.base64}`} alt="" draggable={false} />
            {zonas.map((z, i) => (
              <span key={i} className="tapar-zona" style={estiloZona(z)}>
                <button type="button" className="tapar-quitar" aria-label={t('Quitar esta zona')}
                  onPointerDown={e => e.stopPropagation()} onClick={() => setZonas(x => x.filter((_, j) => j !== i))}>
                  <X size={12} />
                </button>
              </span>
            ))}
            {enCurso && <span className="tapar-zona dibujando" style={estiloZona(enCurso)} />}
          </div>
          <label className="tapar-sin">
            <input type="checkbox" checked={sinNombre} disabled={zonas.length > 0} onChange={e => setSinNombre(e.target.checked)} />
            {t('Esta foto no muestra el nombre ni ningún dato del alumno')}
          </label>
          <div className="ap-acciones">
            <button type="button" className="btn-accent" disabled={!puedeSeguir} onClick={() => onListo(zonas)}>
              <Check size={15} />{t('Listo')}
            </button>
            <button type="button" className="btn-ghost" onClick={onCancelar}>{t('Cancelar')}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
