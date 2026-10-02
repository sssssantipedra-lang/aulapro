import { useEffect, useState } from 'react';
import type { FichaThemeId } from './fichaThemes';

/**
 * Ilustración de cada tema para los documentos (PDF y Word). Va en JPG porque
 * Word no admite webp, y se carga solo al imprimir o al ver la vista previa:
 * no pesa en el arranque. Si no se puede cargar, el documento sale con el
 * emoji del tema, como antes.
 */
const URLS = import.meta.glob<string>('../assets/temas/doc/*.jpg', { eager: true, query: '?url', import: 'default' });

export interface ThemeArtData {
  /** Para incrustar en el HTML: `data:image/jpeg;base64,…`. */
  dataUrl: string;
  /** Para el `ImageRun` del Word. */
  bytes: Uint8Array;
}

const cache = new Map<FichaThemeId, Promise<ThemeArtData | null>>();

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function loadThemeArt(id: FichaThemeId): Promise<ThemeArtData | null> {
  let p = cache.get(id);
  if (!p) {
    const url = URLS[`../assets/temas/doc/${id}.jpg`];
    p = (async () => {
      if (!url) return null;
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const bytes = new Uint8Array(await res.arrayBuffer());
        return { dataUrl: `data:image/jpeg;base64,${toBase64(bytes)}`, bytes };
      } catch {
        return null;
      }
    })();
    // Un fallo no se queda guardado: se reintenta la próxima vez
    p.then(r => { if (!r) cache.delete(id); });
    cache.set(id, p);
  }
  return p;
}

/** La ilustración del tema para una vista previa; `undefined` mientras carga. */
export function useThemeArt(id: FichaThemeId): string | undefined {
  const [art, setArt] = useState<{ id: FichaThemeId; dataUrl?: string }>();
  useEffect(() => {
    let alive = true;
    loadThemeArt(id).then(r => { if (alive) setArt({ id, dataUrl: r?.dataUrl }); });
    return () => { alive = false; };
  }, [id]);
  return art?.id === id ? art.dataUrl : undefined;
}
