/**
 * Licencia en Android: se compra en Google Play (decisión del dueño, 20-10-2026:
 * Windows con clave de Lemon Squeezy y Android con Google Play, cada una por su
 * lado). Sin claves ni dispositivos que contar: manda la cuenta de Google.
 *
 *  - `aulapro_vida`: compra única (oferta de lanzamiento, hasta el 15-4-2027).
 *  - `aulapro_anual`: suscripción anual, desde el 16-4-2027.
 *
 * Google Play recuerda las compras de la cuenta: la app solo pregunta qué hay
 * (`getPurchases`) y guarda una copia cifrada con el Android Keystore
 * (AulaNativePlugin, secreto «licencia») para abrir sin conexión. Una
 * suscripción que Play ya no devuelve queda `caducada` (solo revisar, sin
 * cambiar nada, como en el escritorio); los datos nunca se bloquean. En Android
 * el plugin no da la fecha de caducidad de la suscripción, así que no hay aviso
 * previo: avisa Google Play.
 */
import type { LicenseBridge, LicenseError, LicenseResult, LicenseState, PlayBridge, PlayOferta } from '../types/electron';

/** Hasta el lanzamiento (10-11-2026), todo dispositivo que abra la app queda como fundador. */
export const LAUNCH_AT = Date.parse('2026-11-10T00:00:00+01:00');

export const PRODUCTOS = { vida: 'aulapro_vida', anual: 'aulapro_anual' } as const;
export type Producto = keyof typeof PRODUCTOS;

/** Lo que usamos de una compra de Google Play (ver `@capgo/native-purchases`). */
export interface Compra {
  productIdentifier: string;
  /** `Purchase.PurchaseState` de Android como texto: «1» comprada, «2» pendiente de pago. */
  purchaseState?: string;
  revocationDate?: string;
}

/** Lo que hace falta del plugin de compras; en las pruebas se sustituye. */
export interface Facturacion {
  disponible: () => Promise<boolean>;
  compras: () => Promise<Compra[]>;
  precio: (producto: Producto) => Promise<string | null>;
  comprar: (producto: Producto) => Promise<void>;
  gestionar: () => Promise<void>;
}

interface Secrets {
  get: (name: string) => Promise<string>;
  set: (name: string, value: string) => Promise<boolean>;
}

interface Registro {
  v: 2;
  kind: 'fundador' | 'play';
  producto?: Producto;
  activatedAt: string;
  lastOkAt?: string;
  /** Play ya no devuelve la compra: se puede revisar, no modificar. */
  expired?: boolean;
}

/** Qué producto da derecho a usar la app, si alguno (la compra única gana a la suscripción). */
export function derecho(compras: Compra[]): Producto | null {
  const vale = (id: string) => compras.some(c => c.productIdentifier === id && c.purchaseState === '1' && !c.revocationDate);
  if (vale(PRODUCTOS.vida)) return 'vida';
  if (vale(PRODUCTOS.anual)) return 'anual';
  return null;
}

/** Traduce el fallo del plugin a un código que la interfaz sabe explicar. */
export function errorDeCompra(e: unknown): LicenseError {
  const msg = String((e as { message?: string })?.message ?? e).toLowerCase();
  if (msg.includes('cancel')) return 'compra-cancelada';
  if (msg.includes('pending')) return 'pendiente';
  if (msg.includes('already') || msg.includes('owned')) return 'ya-comprada';
  return 'error-tienda';
}

export function createAndroidPlay(secrets: Secrets, billing: Facturacion, opts: { enforced?: boolean; now?: () => number } = {}): LicenseBridge & { play: PlayBridge } {
  const now = opts.now ?? Date.now;
  // Se mira cada vez: una app abierta desde antes del lanzamiento pasa a pedir licencia sola
  const enforcedNow = () => opts.enforced ?? now() >= LAUNCH_AT;
  let record: Registro | null = null;
  let ready: Promise<void> | null = null;

  const save = async (r: Registro | null) => {
    record = r;
    await secrets.set('licencia', r ? JSON.stringify(r) : '').catch(() => false);
  };

  const state = (): LicenseState => ({
    required: enforcedNow() && !record,
    status: record?.kind === 'fundador' ? 'fundador'
      : record?.kind === 'play' ? (record.expired ? 'caducada' : 'activa')
      : 'sin-licencia',
    enforced: enforcedNow(),
    keyHint: '',
    since: record?.activatedAt ?? '',
    expiresAt: '',
    daysLeft: null,
    // Las compras se hacen dentro de la app, con Google Play: no hay enlace de pago
    buyUrl: '',
  });

  /**
   * Pregunta a Google Play qué ha comprado esta cuenta. `false` si no respondió
   * (sin conexión o servicio no disponible): entonces no se cambia nada.
   */
  async function refresh(): Promise<boolean> {
    let compras: Compra[];
    try { compras = await billing.compras(); } catch { return false; }
    const p = derecho(compras);
    const now = new Date().toISOString();
    if (p) {
      await save({ v: 2, kind: 'play', producto: p, activatedAt: record?.kind === 'play' ? record.activatedAt : now, lastOkAt: now });
    } else if (record?.kind === 'play') {
      // Suscripción sin renovar, o compra reembolsada: se puede revisar todo, no modificar
      await save({ ...record, expired: true, lastOkAt: now });
    }
    return true;
  }

  async function init() {
    try { record = JSON.parse((await secrets.get('licencia')) || 'null'); } catch { record = null; }
    // Registro de la versión con claves de Lemon Squeezy (Android ya no las usa): se descarta
    if (record && record.v !== 2) record = null;
    if (!record && !enforcedNow()) await save({ v: 2, kind: 'fundador', activatedAt: new Date().toISOString() });
    else if (record?.kind === 'play' || (!record && enforcedNow())) await refresh().catch(() => false);
  }
  const whenReady = () => (ready ??= init());

  const sinClaves = async (): Promise<LicenseResult> => {
    await whenReady();
    return { ok: false, error: 'sin-licencia', state: state() };
  };

  async function recheck(): Promise<LicenseResult> {
    await whenReady();
    const answered = await refresh();
    return answered ? { ok: true, state: state() } : { ok: false, error: 'sin-conexion', state: state() };
  }

  const play: PlayBridge = {
    async ofertas(): Promise<PlayOferta[]> {
      const out: PlayOferta[] = [];
      // Uno detrás de otro: el plugin no admite consultas a la vez
      for (const id of ['vida', 'anual'] as const) {
        try {
          const precio = await billing.precio(id);
          if (precio) out.push({ id, precio });
        } catch { /* ese producto no está disponible */ }
      }
      return out;
    },

    async comprar(id): Promise<LicenseResult> {
      await whenReady();
      if (!(await billing.disponible().catch(() => false))) return { ok: false, error: 'no-disponible', state: state() };
      try { await billing.comprar(id); } catch (e) {
        const error = errorDeCompra(e);
        // Ya la tenía de antes (otro dispositivo, reinstalación): se recupera
        if (error === 'ya-comprada' && await refresh() && state().status === 'activa') return { ok: true, state: state() };
        return { ok: false, error, state: state() };
      }
      const answered = await refresh();
      return answered && state().status === 'activa' ? { ok: true, state: state() } : { ok: false, error: 'pendiente', state: state() };
    },

    async restaurar(): Promise<LicenseResult> {
      await whenReady();
      const answered = await refresh();
      if (!answered) return { ok: false, error: 'sin-conexion', state: state() };
      return state().status === 'activa' ? { ok: true, state: state() } : { ok: false, error: 'sin-compra', state: state() };
    },

    gestionar: () => billing.gestionar(),
  };

  return {
    async state() { await whenReady(); return state(); },
    // Sin claves de licencia en Android
    activate: sinClaves,
    deactivate: sinClaves,
    recheck,
    play,
  };
}
