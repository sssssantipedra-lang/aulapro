/**
 * El botón de los juegos para la clase (26-11-2026, sacado de «Tirar de la cuerda» sin cambios). Ver `usoJuego.ts`.
 */
import type { ButtonHTMLAttributes } from 'react';

/**
 * Un botón. Las teclas de los equipos responden al tocarlas (`pointerdown`): con dos dedos a la vez, cada uno el
 * suyo. Los demás (`alSoltar`) actúan con el `click` de siempre, al soltar: un dedo que empieza a desplazar una lista
 * encima de una opción no la elige. Con el teclado (Intro o espacio) llega un `click` sin puntero (`detail` 0), y ese
 * vale siempre; `onPulsar` recibe si ha sido así.
 */
export function Boton({ onPulsar, alSoltar, className, children, ...resto }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'onPointerDown'> & {
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

