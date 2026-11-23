import { Sparkles } from 'lucide-react';
import { abrirClaveIA } from '../../lib/claveIA';

/**
 * Aviso de «esta pantalla usa la IA y falta la clave de Google». Es el mismo
 * en todas las pantallas y sigue los colores del tema (antes cada una tenía
 * el suyo, y alguno con un texto marrón fijo que no se leía en modo oscuro).
 * Desde el 11-10-2026 es una franja fina de una línea, no una caja amarilla:
 * salía repetida en varias pantallas y pesaba más que la propia pantalla.
 *
 * Desde el 20-11-2026 su botón no lleva a Configuración: abre los pasos de la clave en una ventana sobre la
 * pantalla en curso (`VentanaClaveIA`), para no perder lo que se estaba escribiendo. `onAction` ya no hace falta
 * y no se llama; se conserva en el tipo para las pantallas que aún lo pasan.
 */
export function AiKeyNotice({ message, action }: { message: string; action: string; onAction?: () => void }) {
  return (
    <div className="ai-notice" role="note">
      <Sparkles size={15} style={{ flexShrink: 0 }} aria-hidden="true" />
      <span className="ai-notice-txt">{message}</span>
      <button type="button" className="ai-notice-btn" onClick={abrirClaveIA}>
        {action}
      </button>
    </div>
  );
}
