/**
 * El teclado de los nombres de los equipos de los juegos (sacado de «Tirar de la cuerda» el 26-11-2026, sin cambios):
 * con el teclado del juego (Ñ, tildes y Ç; QWERTY si caben teclas de 44 px y, si no, en orden alfabético) o con el de
 * verdad. Escape e Intro lo cierran a él, no al juego.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Delete, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { MAX_NOMBRE, escribirNombre } from '../../lib/juegos/cuerda';
import { Boton } from './Boton';

/** El teclado de los nombres: QWERTY si cabe con teclas de 44 px; si no, en orden alfabético. */
const QWERTY = ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNMÇ', 'ÁÉÍÓÚÜÀÈÒ'];
const ABC = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZÁÉÍÓÚÜÀÈÒÇ';

export function EditorNombre({ inicial, color, titulo, ancho, onListo }: {
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

