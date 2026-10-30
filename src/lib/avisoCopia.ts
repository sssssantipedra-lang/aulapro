/**
 * Recordatorio de copia de seguridad (versión web, 30-10-2026, petición del dueño: «tenemos que ofrecer todas
 * las facilidades para que el usuario sepa que tiene que guardar los datos, que los puede perder, y cómo no
 * perderlos»). Quien guarda solo en el navegador (sin Drive, OneDrive ni carpeta) puede perder todo si se
 * borran los datos del navegador, si cambia de dispositivo o si este se estropea; un navegador no puede
 * escribir en el disco sin que el docente elija un sitio, así que lo único que se puede hacer es insistir.
 *
 * Se guardan en el navegador, y solo ahí, tres fechas: la de la última copia descargada, desde cuándo se usa
 * la app y hasta cuándo no avisar. Nada sale del dispositivo.
 */
const ULTIMA = 'aulapro_copia_ultima';
const DESDE = 'aulapro_copia_desde';
const HASTA = 'aulapro_copia_posponer';

const DIA = 24 * 60 * 60 * 1000;
/** Sin ninguna copia, el primer aviso sale a los 2 días de usarla (antes, sería insistir sin haber trabajado). */
export const DIAS_PRIMER_AVISO = 2;
/** Con una copia hecha, vuelve a avisar pasada una semana. */
export const DIAS_ENTRE_COPIAS = 7;
/** «Más tarde» no vuelve a avisar en 3 días. */
export const DIAS_POSPONER = 3;

export interface EstadoCopia { ultima: string | null; desde: string | null; pospuestoHasta: string | null }

const leer = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const escribir = (k: string, v: string | null) => {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sin almacenamiento */ }
};

export const leerEstadoCopia = (): EstadoCopia => ({ ultima: leer(ULTIMA), desde: leer(DESDE), pospuestoHasta: leer(HASTA) });

/** Apunta desde cuándo se usa la app en este navegador (solo la primera vez). */
export function marcarUso(ahora = Date.now()) {
  if (!leer(DESDE)) escribir(DESDE, new Date(ahora).toISOString());
}

/** Se acaba de guardar una copia (descargada o enviada por el menú de compartir). */
export function registrarCopia(ahora = Date.now()) {
  escribir(ULTIMA, new Date(ahora).toISOString());
  escribir(HASTA, null);
}

export function posponerAviso(ahora = Date.now()) {
  escribir(HASTA, new Date(ahora + DIAS_POSPONER * DIA).toISOString());
}

const ms = (iso: string | null) => { const t = iso ? Date.parse(iso) : NaN; return Number.isFinite(t) ? t : null; };

/** ¿Toca enseñar el aviso? Solo para quien no tiene una nube ni una carpeta (eso lo decide quien llama). */
export function debeAvisar(e: EstadoCopia, ahora = Date.now()): boolean {
  const hasta = ms(e.pospuestoHasta);
  if (hasta !== null && ahora < hasta) return false;
  const ultima = ms(e.ultima);
  const base = ultima ?? ms(e.desde);
  if (base === null) return false;
  return ahora - base >= (ultima !== null ? DIAS_ENTRE_COPIAS : DIAS_PRIMER_AVISO) * DIA;
}

/** Días enteros desde la última copia, o `null` si no hay ninguna. */
export function diasDesdeCopia(ultima: string | null, ahora = Date.now()): number | null {
  const t = ms(ultima);
  return t === null ? null : Math.max(0, Math.floor((ahora - t) / DIA));
}
