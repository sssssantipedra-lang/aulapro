/**
 * Tamaño de las letras de la app (petición del dueño, 18-10-2026): «estándar»
 * o «grande». Es una preferencia del dispositivo, no del perfil.
 *
 * Todo el CSS de la app va en píxeles, así que no hay una sola medida que
 * cambiar. Se agranda con lo que ofrece cada sitio: en Android, el zoom de
 * texto del WebView (solo las letras, `AulaNative.setTextZoom`); en Windows y
 * Mac, el zoom de la página de Electron (`webFrame.setZoomFactor`, en
 * `electron/preload.cjs`), que mide bien las alturas de pantalla; y sin
 * ninguno de los dos (el navegador, las pruebas), `zoom` de CSS.
 */
export type TamanoLetra = 'estandar' | 'grande';

export const FACTOR_TAMANO: Record<TamanoLetra, number> = { estandar: 1, grande: 1.25 };

const CLAVE = 'aulapro_tamano_letra';

export function getTamanoLetra(): TamanoLetra {
  try { return localStorage.getItem(CLAVE) === 'grande' ? 'grande' : 'estandar'; } catch { return 'estandar'; }
}

/** Lo guarda y lo pone. */
export function aplicarTamanoLetra(tamano: TamanoLetra) {
  try { localStorage.setItem(CLAVE, tamano); } catch { /* sin almacenamiento */ }
  ponerFactor(FACTOR_TAMANO[tamano]);
}

/** Al abrir la app: el estándar es como sale de fábrica, así que solo se toca si se eligió «grande». */
export function restaurarTamanoLetra() {
  if (getTamanoLetra() !== 'estandar') ponerFactor(FACTOR_TAMANO[getTamanoLetra()]);
}

function ponerFactor(factor: number) {
  const puente = window.electronAPI?.app?.setTextScale;
  if (puente) {
    // Un fallo del puente nativo no debe romper la pantalla de ajustes
    try { void Promise.resolve(puente(factor)).catch(() => {}); } catch { /* se queda como estaba */ }
    return;
  }
  document.documentElement.style.zoom = factor === 1 ? '' : String(factor);
}
