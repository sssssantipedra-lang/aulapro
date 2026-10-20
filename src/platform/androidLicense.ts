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
const DAY = 24 * 60 * 60 * 1000;
const CHECK_EVERY = 7 * DAY;
/** Mismos plazos que `GRACE` y `WARN_BEFORE` de electron/licenseCore.cjs. */
const GRACE = 3 * DAY;
const WARN_BEFORE = 30 * DAY;
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
  /** Licencia anual: cuándo caduca (ISO). Vacía si es de por vida. */
  expiresAt?: string;
  /** La tienda dijo que la suscripción caducó. */
  expired?: boolean;
}

type StoreBody = {
  activated?: boolean; valid?: boolean; deactivated?: boolean; error?: string;
  license_key?: { status?: string; expires_at?: string | null };
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
  if (st === 'expired' || msg.includes('expired')) return 'caducada';
  if (st === 'disabled' || msg.includes('disabled')) return 'desactivada';
  if (httpStatus === 404 || msg.includes('not found') || msg.includes('invalid')) return 'clave-no-valida';
  return 'error-tienda';
}

/** Igual que `checkOutcome` de electron/licenseCore.cjs. */
export function checkOutcome(body: StoreBody | null, httpStatus: number):
  { kind: 'ok' | 'caducada'; expiresAt: string } | { kind: 'anulada' | 'nada' } {
  const lk = body?.license_key ?? {};
  const msg = String(body?.error ?? '').toLowerCase();
  if (body?.valid && lk.status !== 'disabled' && lk.status !== 'expired') return { kind: 'ok', expiresAt: lk.expires_at ?? '' };
  if (lk.status === 'expired' || msg.includes('expired')) return { kind: 'caducada', expiresAt: lk.expires_at ?? '' };
  return { kind: httpStatus < 500 ? 'anulada' : 'nada' };
}

/** Igual que `evaluate` de electron/licenseCore.cjs, para una licencia con clave: caducidad y comprobaciones. */
export function expiry(r: LicenseRecord, now: number): { status: 'activa' | 'caducada'; expiresAt: string; daysLeft: number | null; needsCheck: boolean } {
  const exp = Date.parse(r.expiresAt ?? '');
  const annual = Number.isFinite(exp);
  const last = Date.parse(r.lastOkAt ?? r.activatedAt);
  const age = Number.isFinite(last) ? now - last : Infinity;
  const expiresAt = annual ? r.expiresAt! : '';
  if (r.expired || (annual && now > exp + GRACE)) return { status: 'caducada', expiresAt, daysLeft: 0, needsCheck: true };
  return {
    status: 'activa', expiresAt,
    daysLeft: annual ? Math.max(0, Math.ceil((exp - now) / DAY)) : null,
    needsCheck: age > CHECK_EVERY || (annual && exp - now < WARN_BEFORE),
  };
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

  const state = (): LicenseState => {
    const lic = record?.kind === 'licencia' ? expiry(record, Date.now()) : null;
    return {
      required: enforced && !record,
      status: record?.kind === 'fundador' ? 'fundador' : lic ? lic.status : record ? 'activa' : 'sin-licencia',
      enforced,
      keyHint: record?.kind === 'licencia' ? keyHint(record.key) : '',
      since: record?.activatedAt ?? '',
      expiresAt: lic?.expiresAt ?? '',
      daysLeft: lic?.daysLeft ?? null,
      // En Android no hay enlace de compra (normas de Google Play)
      buyUrl: '',
    };
  };

  /** Comprobación en segundo plano: sin conexión no pasa nada. `false` si la tienda no respondió. */
  async function check(): Promise<boolean> {
    if (record?.kind !== 'licencia' || !record.key || !record.instanceId) return false;
    const r = await call('validate', { license_key: record.key, instance_id: record.instanceId });
    if (!r) return false;
    const o = checkOutcome(r.body, r.status);
    if (o.kind === 'ok') {
      // Renovada o de por vida: fecha al día y fuera la marca de caducada
      const renovada: LicenseRecord = { ...record, lastOkAt: new Date().toISOString(), expiresAt: o.expiresAt };
      delete renovada.expired;
      await save(renovada);
    } else if (o.kind === 'caducada') {
      // No se renovó: el registro se queda (la app sigue abriendo los datos, sin modificarlos)
      await save({ ...record, expired: true, lastOkAt: new Date().toISOString(), expiresAt: o.expiresAt || record.expiresAt || '' });
    } else if (o.kind === 'anulada') {
      await save(null); // devuelta o anulada
    } else {
      return false;
    }
    return true;
  }

  async function init() {
    try { record = JSON.parse((await secrets.get('licencia')) || 'null'); } catch { record = null; }
    if (!record && !enforced) {
      await save({ v: 1, kind: 'fundador', activatedAt: new Date().toISOString() });
    } else if (record?.kind === 'licencia') {
      if (expiry(record, Date.now()).needsCheck) check().catch(() => {});
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
      await save({ v: 1, kind: 'licencia', key: k, instanceId: r.body.instance?.id, activatedAt: now, lastOkAt: now, expiresAt: r.body.license_key?.expires_at ?? '' });
      return { ok: true, state: state() };
    },

    async recheck(): Promise<LicenseResult> {
      await whenReady();
      if (record?.kind !== 'licencia') return { ok: false, error: 'sin-licencia', state: state() };
      const answered = await check();
      return answered ? { ok: true, state: state() } : { ok: false, error: 'sin-conexion', state: state() };
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
