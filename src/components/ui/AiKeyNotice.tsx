import { Sparkles } from 'lucide-react';

/**
 * Aviso de «esta pantalla usa la IA y falta la clave de Google». Es el mismo
 * en todas las pantallas y sigue los colores del tema (antes cada una tenía
 * el suyo, y alguno con un texto marrón fijo que no se leía en modo oscuro).
 */
export function AiKeyNotice({ message, action, onAction }: { message: string; action: string; onAction: () => void }) {
  return (
    <div className="notice" role="note">
      <Sparkles size={17} style={{ flexShrink: 0 }} aria-hidden="true" />
      <span style={{ flex: 1, lineHeight: 1.5 }}>{message}</span>
      <button className="btn-accent" style={{ fontSize: 12.5, padding: '7px 14px', flexShrink: 0 }} onClick={onAction}>
        {action}
      </button>
    </div>
  );
}
