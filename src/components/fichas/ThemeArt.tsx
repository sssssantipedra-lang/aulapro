import type { FichaThemeId } from '../../lib/fichaThemes';
import clasico from '../../assets/temas/clasico.webp';
import espacio from '../../assets/temas/espacio.webp';
import selva from '../../assets/temas/selva.webp';
import detectives from '../../assets/temas/detectives.webp';
import oceano from '../../assets/temas/oceano.webp';
import superheroes from '../../assets/temas/superheroes.webp';
import deportes from '../../assets/temas/deportes.webp';
import dinosaurios from '../../assets/temas/dinosaurios.webp';
import piratas from '../../assets/temas/piratas.webp';
import magia from '../../assets/temas/magia.webp';
import cocina from '../../assets/temas/cocina.webp';

/**
 * Ilustración de cada tema para la pantalla (selector, biblioteca, Aula Live).
 * Lo impreso sigue con el emoji del tema: no pesa y sale en cualquier impresora.
 */
const THEME_ART: Record<FichaThemeId, string> = {
  clasico, espacio, selva, detectives, oceano, superheroes, deportes, dinosaurios, piratas, magia, cocina,
};

export function ThemeArt({ id, className }: { id: FichaThemeId; className?: string }) {
  return <img className={`theme-art${className ? ` ${className}` : ''}`} src={THEME_ART[id]} alt="" aria-hidden="true" draggable={false} />;
}
