/**
 * Iconos de bandera para el selector de idioma.
 *
 * Se dibujan en SVG en vez de usar el emoji 🇪🇸/🇬🇧: el emoji depende de la
 * fuente del sistema operativo y en bastantes configuraciones de Windows se
 * ve como un código de dos letras ("ES"/"GB") en vez de la bandera. El SVG
 * se ve igual en cualquier equipo, con o sin fuente de emoji instalada.
 */
import type { CSSProperties } from 'react';

interface FlagProps {
  size?: number;
  style?: CSSProperties;
}

const wrap = (size: number, style?: CSSProperties): CSSProperties => ({
  display: 'inline-block',
  width: size,
  height: size * 0.7,
  borderRadius: 3,
  overflow: 'hidden',
  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.14)',
  flexShrink: 0,
  ...style,
});

/** Bandera de España: tricolor rojo-amarillo-rojo (1:2:1). */
export function FlagES({ size = 20, style }: FlagProps) {
  return (
    <span style={wrap(size, style)}>
      <svg viewBox="0 0 60 40" width="100%" height="100%" preserveAspectRatio="none">
        <rect width="60" height="40" fill="#AA151B" />
        <rect y="10" width="60" height="20" fill="#F1BF00" />
      </svg>
    </span>
  );
}

/** Bandera del Reino Unido (Union Jack), versión simplificada. */
export function FlagGB({ size = 20, style }: FlagProps) {
  return (
    <span style={wrap(size, style)}>
      <svg viewBox="0 0 60 40" width="100%" height="100%" preserveAspectRatio="none">
        <rect width="60" height="40" fill="#00247D" />
        {/* Aspas blancas (San Andrés) */}
        <line x1="0" y1="0" x2="60" y2="40" stroke="#fff" strokeWidth="9" />
        <line x1="60" y1="0" x2="0" y2="40" stroke="#fff" strokeWidth="9" />
        {/* Aspas rojas (San Patricio), contrapeadas por cuadrante */}
        <line x1="0" y1="0" x2="30" y2="20" stroke="#CF142B" strokeWidth="3" transform="translate(1,-1.8)" />
        <line x1="30" y1="20" x2="60" y2="40" stroke="#CF142B" strokeWidth="3" transform="translate(-1,1.8)" />
        <line x1="60" y1="0" x2="30" y2="20" stroke="#CF142B" strokeWidth="3" transform="translate(-1,-1.8)" />
        <line x1="30" y1="20" x2="0" y2="40" stroke="#CF142B" strokeWidth="3" transform="translate(1,1.8)" />
        {/* Cruz de San Jorge */}
        <rect y="16" width="60" height="8" fill="#fff" />
        <rect x="25" width="10" height="40" fill="#fff" />
        <rect y="18" width="60" height="4" fill="#CF142B" />
        <rect x="27" width="6" height="40" fill="#CF142B" />
      </svg>
    </span>
  );
}

export function Flag({ lang, size, style }: { lang: 'es' | 'en' } & FlagProps) {
  return lang === 'es' ? <FlagES size={size} style={style} /> : <FlagGB size={size} style={style} />;
}
