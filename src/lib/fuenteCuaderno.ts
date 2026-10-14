import { useEffect, useState } from 'react';
import latinUrl from '../assets/fonts/outfit-latin-wght-normal.woff2?url';

/**
 * La letra del diseño «Cuaderno» (Outfit, la misma de la app, licencia OFL en
 * `assets/fonts/OFL-Outfit.txt`) para el PDF y la vista previa. El PDF se
 * imprime desde un documento suelto, sin acceso a los archivos de la app, así
 * que la letra va incrustada en el propio HTML como `data:`. Solo el subconjunto
 * latino (unos 32 KB): lleva todo el castellano y el catalán. Se carga al
 * imprimir o al ver la vista previa, no al arrancar. Si no se puede cargar, el
 * documento sale con las letras del sistema, como antes.
 */
let cache: Promise<string> | null = null;

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** El `@font-face` con la letra incrustada, o '' si no se pudo cargar. */
export function cargarFuenteCuaderno(): Promise<string> {
  if (!cache) {
    cache = (async () => {
      try {
        const res = await fetch(latinUrl);
        if (!res.ok) return '';
        const b64 = toBase64(new Uint8Array(await res.arrayBuffer()));
        return `@font-face{font-family:'Outfit';font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
      } catch {
        return '';
      }
    })();
    // Un fallo no se queda guardado: se reintenta la próxima vez
    cache.then(css => { if (!css) cache = null; });
  }
  return cache;
}

/** El CSS de la letra para una vista previa; `undefined` mientras carga o si la ficha no es «Cuaderno». */
export function useFuenteCuaderno(activa: boolean): string | undefined {
  const [css, setCss] = useState<string>();
  useEffect(() => {
    if (!activa) return;
    let vivo = true;
    cargarFuenteCuaderno().then(c => { if (vivo && c) setCss(c); });
    return () => { vivo = false; };
  }, [activa]);
  return activa ? css : undefined;
}
