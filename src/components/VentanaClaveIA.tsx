import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { cerrarClaveIA } from '../lib/claveIA';
import { cerrarLoAbierto } from '../lib/loAbierto';
import { useHayClaveIA, useVentanaClaveIA } from '../hooks/useClaveIA';
import { PasosClaveIA } from './PasosClaveIA';

/**
 * La clave de la IA sin salir de la pantalla (20-11-2026). «Configurar la IA» llevaba a Configuración: el docente
 * perdía de vista lo que estaba escribiendo y tenía que volver a mano. Ahora cualquier aviso de que falta la clave
 * llama a `abrirClaveIA()` (`lib/claveIA.ts`) y los tres pasos salen aquí, encima de la pantalla o de la ventana
 * en la que esté. Con la clave guardada y aceptada por Google se cierra sola; la pantalla de debajo se vuelve a
 * pintar (`useHayClaveIA`) y su botón de generar se activa con el formulario tal como estaba.
 *
 * Se monta una vez, en `App.tsx`. Va al final del documento (portal) para que quede por encima de la ventana desde
 * la que se abre y para que el botón de atrás la cierre a ella primero (`lib/loAbierto.ts`). La casilla de aceptar
 * el uso de la IA es la de siempre: la llevan los propios pasos (`PasosClaveIA`).
 */
export function VentanaClaveIA() {
  const abierta = useVentanaClaveIA();
  return abierta ? createPortal(<Ventana />, document.body) : null;
}

function Ventana() {
  const { t } = useI18n();
  const titulo = useId();
  const caja = useRef<HTMLDivElement>(null);
  const hayClave = useHayClaveIA();

  // El foco entra en la ventana y, al cerrarla, vuelve a donde estaba (el botón que la abrió)
  useEffect(() => {
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    caja.current?.focus();
    return () => { if (antes?.isConnected) antes.focus(); };
  }, []);

  // Escape cierra solo lo de más arriba (esta ventana o el recuadro de aceptar abierto sobre ella), no la ventana
  // de debajo: por eso se atiende antes que nadie y no se deja pasar
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      cerrarLoAbierto(document);
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, []);

  return (
    <div className="modal-overlay open vci-fondo" onClick={e => { if (e.target === e.currentTarget) cerrarClaveIA(); }}>
      <div className="modal vci" role="dialog" aria-modal="true" aria-labelledby={titulo} tabIndex={-1} ref={caja} onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <div className="modal-title" id={titulo}>
            <span className="ak-tit"><Sparkles size={17} color="var(--accent-d)" aria-hidden="true" />{t('Configurar la IA')}</span>
          </div>
          <button className="ico-btn" onClick={cerrarClaveIA} aria-label={t('Cerrar')} title={t('Cerrar')}><X size={17} /></button>
        </div>
        <p className="ak-intro">
          {t('La IA funciona con una clave gratuita de Google, que se guarda solo en este dispositivo. Son tres pasos y lo que tenías a medias te espera aquí debajo, tal como lo has dejado.')}
        </p>
        <PasosClaveIA onLista={cerrarClaveIA} />
        <div className="vci-pie">
          <button type="button" className="btn-ghost" onClick={cerrarClaveIA}>{t(hayClave ? 'Cerrar' : 'Ahora no')}</button>
        </div>
      </div>
    </div>
  );
}
