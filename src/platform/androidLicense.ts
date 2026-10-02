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
import { CapacitorHttp } from '@capacitor/core';
import type { LicenseBridge, LicenseError, LicenseResult, LicenseState } from '../types/electron';

/** Mientras sea `false`, todo dispositivo que abra la app queda como fundador. */
const ENFORCED = false;
/** Número de tienda de Lemon Squeezy (aulapro.lemonsqueezy.com): una clave de otra tienda no vale. */
const STORE_ID = '487841';
const API = 'https://api.lemonsqueezy.com/v1/licenses';
const CHECK_EVERY = 7 * 24 * 60 * 60 * 1000;
/** Nombre neutro: solo la clave y esto salen hacia la tienda (docs/WEB.md, apartado 3, punto 3). */
const INSTANCE_NAME = 'Aula Pro · Android';

interface Secrets {
  get: (name: string) => Promise<string>;
  set: (name: string, value: string) => Promise<boolean>;
}

interface LicenseRecord {
  v: 1;
  kind: 'fundador' | 'licencia';
  key?: string;
  instanceId?: string;
  activatedAt: string;
  lastOkAt?: string;
}

type StoreBody = {
  activated?: boolean; valid?: boolean; deactivated?: boolean; error?: string;
  license_key?: { status?: string };
  instance?: { id?: string };
  meta?: { store_id?: number | string };
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

export function createAndroidLicense(secrets: Secrets, opts: { enforced?: boolean; storeId?: string } = {}): LicenseBridge {
  const enforced = opts.enforced ?? ENFORCED;
  const storeId = opts.storeId ?? STORE_ID;
  let record: LicenseRecord | null = null;
  let ready: Promise<void> | null = null;

  const save = async (r: LicenseRecord | null) => {
    record = r;
    await secrets.set('licencia', r ? JSON.stringify(r) : '').catch(() => false);
  };

  async function call(action: string, data: Record<string, string>): Promise<{ status: number; body: StoreBody } | null> {
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

  const state = (): LicenseState => ({
    required: enforced && !record,
    status: record?.kind === 'fundador' ? 'fundador' : record ? 'activa' : 'sin-licencia',
    enforced,
    keyHint: record?.kind === 'licencia' ? keyHint(record.key) : '',
    since: record?.activatedAt ?? '',
    // En Android no hay enlace de compra (normas de Google Play)
    buyUrl: '',
  });

  /** Comprobación en segundo plano: sin conexión no pasa nada. */
  async function check() {
    if (record?.kind !== 'licencia' || !record.key || !record.instanceId) return;
    const r = await call('validate', { license_key: record.key, instance_id: record.instanceId });
    if (!r) return;
    const st = r.body.license_key?.status;
    if (r.body.valid && st !== 'disabled' && st !== 'expired') await save({ ...record, lastOkAt: new Date().toISOString() });
    else if (r.status < 500) await save(null); // devuelta o anulada
  }

  async function init() {
    try { record = JSON.parse((await secrets.get('licencia')) || 'null'); } catch { record = null; }
    if (!record && !enforced) {
      await save({ v: 1, kind: 'fundador', activatedAt: new Date().toISOString() });
    } else if (record?.kind === 'licencia') {
      const last = Date.parse(record.lastOkAt ?? record.activatedAt);
      if (!Number.isFinite(last) || Date.now() - last > CHECK_EVERY) check().catch(() => {});
    }
  }
  const whenReady = () => (ready ??= init());

  return {
    async state() { await whenReady(); return state(); },

    async activate(key): Promise<LicenseResult> {
      await whenReady();
      const k = key.trim();
      if (!k) return { ok: false, error: 'clave-no-valida', state: state() };
      const r = await call('activate', { license_key: k, instance_name: INSTANCE_NAME });
      if (!r) return { ok: false, error: 'sin-conexion', state: state() };
      const error = activationError(r.body, r.status, storeId);
      if (error) {
        if (error === 'otra-tienda' && r.body.instance?.id) call('deactivate', { license_key: k, instance_id: r.body.instance.id });
        return { ok: false, error, state: state() };
      }
      const now = new Date().toISOString();
      await save({ v: 1, kind: 'licencia', key: k, instanceId: r.body.instance?.id, activatedAt: now, lastOkAt: now });
      return { ok: true, state: state() };
    },

    async deactivate(): Promise<LicenseResult> {
      await whenReady();
      if (record?.kind !== 'licencia' || !record.key || !record.instanceId) return { ok: false, error: 'sin-licencia', state: state() };
      const r = await call('deactivate', { license_key: record.key, instance_id: record.instanceId });
      if (!r) return { ok: false, error: 'sin-conexion', state: state() };
      await save(null);
      return { ok: true, state: state() };
    },
  };
}
