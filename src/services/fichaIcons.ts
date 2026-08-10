/**
 * Iconos decorativos para la ficha exportada, como markup SVG crudo (no
 * componentes React: `exportFicha.ts` construye una cadena HTML/DOCX, no
 * JSX). Son el mismo trazado que los iconos de Lucide que ya usa el resto
 * de la aplicación (lightbulb.mjs, pencil.mjs, star.mjs, link-2.mjs,
 * palette.mjs, table.mjs en node_modules/lucide-react) — así el estilo
 * visual de la ficha impresa es coherente con el de la propia interfaz, en
 * vez de inventar un trazo nuevo.
 */

function svg(inner: string, color: string, size: number, filled: boolean): string {
  return filled
    ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="none">${inner}</svg>`
    : `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

export function svgLightbulb(color: string, size = 20): string {
  return svg(
    '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>' +
    '<path d="M9 18h6"/><path d="M10 22h4"/>',
    color, size, false,
  );
}

export function svgPencil(color: string, size = 20): string {
  return svg(
    '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>' +
    '<path d="m15 5 4 4"/>',
    color, size, false,
  );
}

export function svgStar(color: string, size = 20): string {
  return svg(
    '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    color, size, true,
  );
}

export function svgLink(color: string, size = 20): string {
  return svg(
    '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>',
    color, size, false,
  );
}

export function svgPalette(color: string, size = 20): string {
  return svg(
    '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/>' +
    `<circle cx="13.5" cy="6.5" r=".5" fill="${color}"/><circle cx="17.5" cy="10.5" r=".5" fill="${color}"/>` +
    `<circle cx="6.5" cy="12.5" r=".5" fill="${color}"/><circle cx="8.5" cy="7.5" r=".5" fill="${color}"/>`,
    color, size, false,
  );
}

export function svgTable(color: string, size = 20): string {
  return svg(
    '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
    color, size, false,
  );
}
