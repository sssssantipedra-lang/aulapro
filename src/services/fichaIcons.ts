/**
 * Iconos decorativos para la ficha exportada, como markup SVG crudo (no
 * componentes React: `exportFicha.ts` construye una cadena HTML/DOCX, no
 * JSX). Son el mismo trazado que los iconos de Lucide que ya usa el resto
 * de la aplicación (lightbulb.mjs, pencil.mjs, star.mjs, link-2.mjs,
 * palette.mjs, table.mjs, calculator.mjs, book-open.mjs, languages.mjs,
 * flask-conical.mjs, landmark.mjs, dumbbell.mjs, music-2.mjs, scale.mjs,
 * sparkles.mjs en node_modules/lucide-react) — así el estilo visual de la
 * ficha impresa es coherente con el de la propia interfaz, en vez de
 * inventar un trazo nuevo.
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

/* ── Motivos de cabecera por área (ver fichaMotifs.ts) ── */

export function svgCalculator(color: string, size = 20): string {
  return svg(
    '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/>' +
    '<line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/>' +
    '<path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
    color, size, false,
  );
}

export function svgBookOpen(color: string, size = 20): string {
  return svg(
    '<path d="M12 7v14"/>' +
    '<path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    color, size, false,
  );
}

export function svgLanguages(color: string, size = 20): string {
  return svg(
    '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/>' +
    '<path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
    color, size, false,
  );
}

export function svgFlask(color: string, size = 20): string {
  return svg(
    '<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/>' +
    '<path d="M6.453 15h11.094"/><path d="M8.5 2h7"/>',
    color, size, false,
  );
}

export function svgLandmark(color: string, size = 20): string {
  return svg(
    '<path d="M10 18v-7"/>' +
    '<path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z"/>' +
    '<path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>',
    color, size, false,
  );
}

export function svgDumbbell(color: string, size = 20): string {
  return svg(
    '<path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/>' +
    '<path d="m2.5 21.5 1.4-1.4"/><path d="m20.1 3.9 1.4-1.4"/>' +
    '<path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/>' +
    '<path d="m9.6 14.4 4.8-4.8"/>',
    color, size, false,
  );
}

export function svgMusic(color: string, size = 20): string {
  return svg('<circle cx="8" cy="18" r="4"/><path d="M12 18V2l7 4"/>', color, size, false);
}

export function svgScale(color: string, size = 20): string {
  return svg(
    '<path d="M12 3v18"/><path d="m19 8 3 8a5 5 0 0 1-6 0zV7"/>' +
    '<path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"/><path d="m5 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M7 21h10"/>',
    color, size, false,
  );
}

export function svgSparkles(color: string, size = 20): string {
  return svg(
    '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/>' +
    '<path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>',
    color, size, false,
  );
}
