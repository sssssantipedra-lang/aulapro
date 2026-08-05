import { initials } from '../../lib/utils';
import type { CSSProperties } from 'react';

interface Props {
  name: string;
  photo?: string | null;
  size?: number;
  fontSize?: number;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Avatar({ name, photo, size = 36, fontSize, className = 'av', style, onClick }: Props) {
  const fs = fontSize ?? Math.round(size * 0.36);
  const baseStyle = { width: size, height: size, fontSize: fs };
  const mergedStyle = { ...baseStyle, ...style };
  if (photo) {
    return <img src={photo} alt={name} className={className} style={{ ...mergedStyle, objectFit: 'cover' }} onClick={onClick} />;
  }
  return (
    <div className={className} style={mergedStyle} onClick={onClick} title={name}>
      {initials(name)}
    </div>
  );
}
