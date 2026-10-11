/**
 * El icono de cada anotación del aula, el mismo en la ventana de anotar de
 * la Distribución de aula y en la lista de «Anotar actitud».
 */
import { BookX, PackageX, ThumbsDown, ThumbsUp, Hand, Shirt, Droplets, Flame, Ban } from 'lucide-react';
import type { ClassMarkType } from '../types';

export function markIcon(type: ClassMarkType, size = 18): React.ReactNode {
  switch (type) {
    case 'homework': return <BookX size={size} />;
    case 'material': return <PackageX size={size} />;
    case 'behavior-bad': return <ThumbsDown size={size} />;
    case 'behavior-good': return <ThumbsUp size={size} />;
    case 'participation': return <Hand size={size} />;
    case 'ef-ropa': return <Shirt size={size} />;
    case 'ef-aseo': return <Droplets size={size} />;
    case 'ef-esfuerzo': return <Flame size={size} />;
    case 'ef-no-participa': return <Ban size={size} />;
  }
}
