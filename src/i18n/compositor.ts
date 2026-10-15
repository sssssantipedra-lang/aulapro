/**
 * Textos del compositor de fichas (ver `services/compositor.ts` y `docs/FICHAS.md`): la distribución de la
 * hoja y las páginas que ocupa. Se suman a `EN` en `core.ts` y a `CA` en `ca.ts`.
 */
export const COMPOSITOR_EN: Record<string, string> = {
  'Distribución de la hoja': 'Page layout',
  'Apretada': 'Tight',
  'Compacta': 'Compact',
  'Normal@@hoja': 'Normal',
  'Holgada': 'Roomy',
  'La hoja ocupa 1 página': 'The sheet takes 1 page',
  'La hoja ocupa {n} páginas': 'The sheet takes {n} pages',
  'La app mide la hoja y reparte el aire entre los ejercicios para que ocupe las menos páginas y deje pocos huecos.':
    'The app measures the sheet and spreads the space between exercises so it takes as few pages as possible and leaves few gaps.',
};

export const COMPOSITOR_CA: Record<string, string> = {
  'Distribución de la hoja': 'Distribució del full',
  'Apretada': 'Atapeïda',
  'Compacta': 'Compacta',
  'Normal@@hoja': 'Normal',
  'Holgada': 'Folgada',
  'La hoja ocupa 1 página': 'El full ocupa 1 pàgina',
  'La hoja ocupa {n} páginas': 'El full ocupa {n} pàgines',
  'La app mide la hoja y reparte el aire entre los ejercicios para que ocupe las menos páginas y deje pocos huecos.':
    'L’app mesura el full i reparteix l’aire entre els exercicis perquè ocupi les menys pàgines possibles i deixi pocs buits.',
};
