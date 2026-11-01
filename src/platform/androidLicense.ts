/**
 * Licencia en Android: lo mismo que `electron/license.cjs` en el escritorio
 * (misma tienda de Lemon Squeezy, misma clave, mismo límite de 2 dispositivos
 * y mismos fundadores), hecho con lo que hay en Android:
 *
 *  - El registro se guarda cifrado con el Android Keystore (AulaNativePlugin,
 *    secreto «licencia»): la llave no sale del dispositivo, así que copiar los
 *    datos a otro no se lleva la licencia.
 *  - Las llamadas a la tienda van por CapacitorHttp, nativo: sin CORS.
 *
 * Mantener ENFORCED y STORE_ID iguales que en electron/license.cjs.
 */
import { limpiarLicenciaVencida, marcarLicenciaVencida } from '../lib/licenciaVencida';
import { caducidadDeFirma } from './firmaLicencia';
import { CapacitorHttp } from '@capacitor/core';
import type { LicenseBridge, LicenseError, LicenseResult, LicenseState } from '../types/electron';

/** Con `false`, todo dispositivo que abra la app queda como fundador; con `true` hace falta clave (desde la venta). */
const ENFORCED = true;
/** Número de tienda de Lemon Squeezy (aulapro.lemonsqueezy.com): una clave de otra tienda no vale. */
const STORE_ID = '487841';
const API = 'https://api.lemonsqueezy.com/v1/licenses';
const CHECK_EVERY = 7 * 24 * 60 * 60 * 1000;
/** Nombre neutro: solo la clave y esto salen hacia la tienda (docs/WEB.md, apartado 3, punto 3). */
const INSTANCE_NAME = 'AulaPro · Android';

interface Secrets {
  get: (name: string) => Promise<string>;
  set: (name: string, value: string) => Promise<boolean>;
}

export interface LicenseRecord {
  v: 1;
  kind: 'fundador' | 'licencia';
  key?: string;
  instanceId?: string;
  activatedAt: string;
  lastOkAt?: string;
  /** Versión web: licencia de la cuenta de Google, sin activación en Lemon Squeezy. */
  cuenta?: boolean;
  /** Versión web: la firma de las funciones de la licencia (`platform/firmaLicencia.ts`). */
  firma?: string;
}

export type StoreBody = {
  activated?: boolean; valid?: boolean; deactivated?: boolean; error?: string;
  license_key?: { status?: string };
  instance?: { id?: string };
  meta?: { store_id?: number | string };
  /** Versión web: la firma que añade la función de la licencia. */
  aulapro_firma?: string;
};

/** Igual que `activationError` de electron/licenseCore.cjs. */
export function activationError(body: StoreBody | null, httpStatus: number, storeId: string): LicenseError | null {
  const msg = String(body?.error ?? '').toLowerCase();
  if (body?.activated && body.meta && storeId && String(body.meta.store_id) !== String(storeId)) return 'otra-tienda';
  if (body?.activated) return null;
  if (msg.includes('activation limit')) return 'limite';
  const st = body?.license_key?.status;
  if (st === 'disabled' || st === 'expired' || msg.includes('disabled') || msg.includes('expired')) return 'desactivada';
  if (httpStatus === 404 || msg.includes('not found') || msg.includes('invalid')) return 'clave-no-valida';
  return 'error-tienda';
}

export function keyHint(key?: string): string {
  const k = String(key ?? '').trim();
  return k.length > 4 ? `••••${k.slice(-4)}` : '';
}

/** Una llamada a la tienda: `null` si no hay conexión. */
export type LicensePost = (action: string, data: Record<string, string>) => Promise<{ status: number; body: StoreBody } | null>;

async function postNativo(action: string, data: Record<string, string>) {
  try {
    const res = await CapacitorHttp.post({
      url: `${API}/${action}`,
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      data,
    });
    const body = typeof res.data === 'string' ? JSON.parse(res.data || '{}') : (res.data ?? {});
    return { status: res.status, body };
  } catch {
    return null; // sin conexión
  }
}

/**
 * También la usa la versión web (`platform/web.ts`), con su propia forma de
 * llamar a la tienda (`post`) y su nombre de dispositivo.
 */
export function createAndroidLicense(secrets: Secrets, opts: {
  enforced?: boolean; storeId?: string; post?: LicensePost; instanceName?: string;
  /** Versión web: si el registro guardado lleva una firma válida (`platform/firmaLicencia.ts`). */
  verificar?: (r: LicenseRecord) => Promise<boolean>;
  /**
   * Versión web: se llama cada vez que hay una licencia válida (al abrir, al activar, al renovar la firma),
   * antes de dar paso a la app. Ahí se pide la sesión que abre el código de la app (`platform/sesionWeb.ts`).
   */
  alValer?: (r: LicenseRecord) => Promise<void>;
  /** Cada cuánto se vuelve a comprobar la clave con conexión (por defecto, una semana; la web, cada día). */
  comprobarCada?: number;
} = {}): LicenseBridge {
  const enforced = opts.enforced ?? ENFORCED;
  const storeId = opts.storeId ?? STORE_ID;
  const call = opts.post ?? postNativo;
  const instanceName = opts.instanceName ?? INSTANCE_NAME;
  const comprobarCada = opts.comprobarCada ?? CHECK_EVERY;
  let record: LicenseRecord | null = null;
  let ready: Promise<void> | null = null;

  const valida = async (r: LicenseRecord) => !opts.verificar || (await opts.verificar(r).catch(() => false));
  const avisar = async () => { if (record && opts.alValer) await opts.alValer(record).catch(() => {}); };

  const save = async (r: LicenseRecord | null) => {
    record = r;
    if (r) limpiarLicenciaVencida();
    await secrets.set('licencia', r ? JSON.stringify(r) : '').catch(() => false);
  };

  const state = (): LicenseState => ({
    required: enforced && !record,
    status: record?.kind === 'fundador' ? 'fundador' : record ? 'activa' : 'sin-licencia',
    enforced,
    keyHint: record?.kind === 'licencia' ? keyHint(record.key) : '',
    since: record?.activatedAt ?? '',
    // En Android no hay enlace de compra (normas de Google Play)
    buyUrl: '',
    ...(record?.firma ? { firmaHasta: caducidadDeFirma(record.firma) } : {}),
  });

  /** Comprobación en segundo plano: sin conexión no pasa nada. */
  async function check() {
    // Suscripción anual: si no se renueva, la clave caduca y se bloquea la cuenta. La de la cuenta no ocupa activación: se valida solo con la clave
    if (record?.kind !== 'licencia' || !record.key || (!record.instanceId && !record.cuenta)) return;
    const r = await call('validate', record.cuenta ? { license_key: record.key } : { license_key: record.key, instance_id: record.instanceId ?? '' });
    if (!r) return;
    const st = r.body.license_key?.status;
    if (r.body.valid && st !== 'disabled' && st !== 'expired') {
      // Con la firma nueva (otros 7 días) llega también una sesión nueva
      await save({ ...record, lastOkAt: new Date().toISOString(), ...(r.body.aulapro_firma ? { firma: r.body.aulapro_firma } : {}) });
      await avisar();
    } else if (r.status < 500) { marcarLicenciaVencida(); await save(null); } // terminada, devuelta o anulada
  }

  async function init() {
    try { record = JSON.parse((await secrets.get('licencia')) || 'null'); } catch { record = null; }
    // Versión web: la firma caduca a los 7 días. Una clave se renueva aquí mismo si hay conexión; la de un
    // fundador, con su cuenta (App.tsx). Si no se puede, no hay licencia hasta que se renueve, pero el registro
    // se queda guardado para volver a probar la próxima vez (no hay que escribir la clave otra vez).
    if (record && !(await valida(record))) {
      if (record.kind === 'licencia' && record.key) await check();
      if (record && !(await valida(record))) record = null;
      if (!record) return;
    }
    if (!record && !enforced) {
      await save({ v: 1, kind: 'fundador', activatedAt: new Date().toISOString() });
    } else if (record?.kind === 'licencia') {
      const last = Date.parse(record.lastOkAt ?? record.activatedAt);
      if (!Number.isFinite(last) || Date.now() - last > comprobarCada) check().catch(() => {});
    }
    await avisar();
  }
  const whenReady = () => (ready ??= init());

  return {
    async state() { await whenReady(); return state(); },

    async activate(key): Promise<LicenseResult> {
      await whenReady();
      const k = key.trim();
      if (!k) return { ok: false, error: 'clave-no-valida', state: state() };
      const r = await call('activate', { license_key: k, instance_name: instanceName });
      if (!r) return { ok: false, error: 'sin-conexion', state: state() };
      const error = activationError(r.body, r.status, storeId);
      if (error) {
        if (error === 'otra-tienda' && r.body.instance?.id) call('deactivate', { license_key: k, instance_id: r.body.instance.id });
        return { ok: false, error, state: state() };
      }
      const now = new Date().toISOString();
      await save({ v: 1, kind: 'licencia', key: k, instanceId: r.body.instance?.id, activatedAt: now, lastOkAt: now, ...(r.body.aulapro_firma ? { firma: r.body.aulapro_firma } : {}) });
      await avisar();
      return { ok: true, state: state() };
    },

    async porCuenta(key, firma): Promise<LicenseState> {
      await whenReady();
      const f = firma ? { firma } : {};
      if (key === 'fundador') {
        // Versión web: fundador por su correo (`FUNDADOR` en cuentaWeb.ts)
        await save({ v: 1, kind: 'fundador', activatedAt: record?.cuenta ? record.activatedAt : new Date().toISOString(), cuenta: true, ...f });
      } else if (key) {
        const now = new Date().toISOString();
        await save({ v: 1, kind: 'licencia', key, activatedAt: record?.cuenta ? record.activatedAt : now, lastOkAt: now, cuenta: true, ...f });
      } else if (record?.cuenta) {
        if (record.kind === 'licencia') marcarLicenciaVencida();
        await save(null);
      }
      await avisar();
      return state();
    },

    async deactivate(): Promise<LicenseResult> {
      await whenReady();
      if (record?.kind !== 'licencia' || !record.key || !record.instanceId) return { ok: false, error: 'sin-licencia', state: state() };
      const r = await call('deactivate', { license_key: record.key, instance_id: record.instanceId ?? '' });
      if (!r) return { ok: false, error: 'sin-conexion', state: state() };
      await save(null);
      return { ok: true, state: state() };
    },
  };
}
