// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const memoria = new Map<string, unknown>();
vi.mock('./webFs', () => ({
  idbKv: {
    get: async (k: string) => memoria.get(k),
    set: async (k: string, v: unknown) => { memoria.set(k, v); },
    del: async (k: string) => { memoria.delete(k); },
  },
}));
const entrarConTokenMicrosoft = vi.fn(async (t: string) => (t === 'ID' ? { proveedor: 'microsoft', id: 't.o', email: 'profe@outlook.com', nombre: 'Profe', desde: '' } : null));
vi.mock('./cuentaWeb', () => ({ MICROSOFT_CLIENT_ID: 'cliente-ms', entrarConTokenMicrosoft }));

const tokens = (extra = {}) => ({ access_token: 'ACCESO', expires_in: 3600, refresh_token: 'R1', id_token: 'ID', ...extra });
const b64url = (b: ArrayBuffer) => Buffer.from(b).toString('base64url');

describe('entrar con Microsoft y guardar en OneDrive (versión web)', () => {
  let asignar: ReturnType<typeof vi.fn>;
  let fetchFalso: ReturnType<typeof vi.fn>;
  const poner = (href: string) => {
    const u = new URL(href);
    vi.stubGlobal('location', { href, origin: u.origin, pathname: u.pathname, assign: asignar });
  };
  beforeEach(() => {
    memoria.clear(); sessionStorage.clear(); entrarConTokenMicrosoft.mockClear();
    asignar = vi.fn();
    fetchFalso = vi.fn(async () => new Response(JSON.stringify(tokens()), { status: 200 }));
    vi.stubGlobal('fetch', fetchFalso);
    poner('https://aulapro.app/app/');
    vi.resetModules();
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('entrar: va a la página de Microsoft con PKCE y solo con la identidad', async () => {
    const m = await import('./microsoft');
    void m.entrarConMicrosoft();
    await vi.waitFor(() => expect(asignar).toHaveBeenCalled());
    const u = new URL(asignar.mock.calls[0][0]);
    expect(u.origin + u.pathname).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    expect(u.searchParams.get('client_id')).toBe('cliente-ms');
    expect(u.searchParams.get('redirect_uri')).toBe('https://aulapro.app/app/');
    expect(u.searchParams.get('scope')).toBe('openid email profile offline_access');
    expect(u.searchParams.get('prompt')).toBe('select_account');
    const guardado = JSON.parse(sessionStorage.getItem('aulapro_ms_vuelta')!);
    expect(guardado.state).toBe(u.searchParams.get('state'));
    expect(guardado.modo).toBe('entrar');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('code_challenge')).toBe(b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(guardado.verifier))));
    expect(guardado.verifier.length).toBeGreaterThanOrEqual(43);
  });

  it('el permiso de OneDrive pide además los archivos de la aplicación y no vuelve a preguntar la cuenta', async () => {
    const m = await import('./microsoft');
    void m.pedirPermisoOneDrive('profe@outlook.com');
    await vi.waitFor(() => expect(asignar).toHaveBeenCalled());
    const u = new URL(asignar.mock.calls[0][0]);
    expect(u.searchParams.get('scope')).toContain('Files.ReadWrite.AppFolder');
    expect(u.searchParams.get('login_hint')).toBe('profe@outlook.com');
    expect(u.searchParams.get('prompt')).toBeNull();
    expect(JSON.parse(sessionStorage.getItem('aulapro_ms_vuelta')!).modo).toBe('onedrive');
  });

  it('al volver de entrar: cambia el código (con el verificador), guarda la cuenta y el permiso de identidad', async () => {
    sessionStorage.setItem('aulapro_ms_vuelta', JSON.stringify({ state: 'S1', modo: 'entrar', verifier: 'v'.repeat(50) }));
    poner('https://aulapro.app/app/?code=CODIGO&state=S1&session_state=x');
    const m = await import('./microsoft');
    expect(m.hayVueltaEntradaMicrosoft()).toBe(true);
    expect(m.hayVueltaOneDrive()).toBe(false);
    const r = await m.terminarVueltaEntradaMicrosoft();
    expect(r.cuenta.email).toBe('profe@outlook.com');
    const cuerpo = JSON.parse(fetchFalso.mock.calls[0][1].body);
    expect(cuerpo).toMatchObject({ code: 'CODIGO', redirect_uri: 'https://aulapro.app/app/', code_verifier: 'v'.repeat(50), archivos: false });
    expect(memoria.get('microsoft')).toEqual({ email: 'profe@outlook.com', refresh: 'R1', archivos: false });
    expect(sessionStorage.getItem('aulapro_ms_vuelta')).toBeNull();
  });

  it('una vuelta con otro «state» no cuenta', async () => {
    sessionStorage.setItem('aulapro_ms_vuelta', JSON.stringify({ state: 'S1', modo: 'entrar', verifier: 'v'.repeat(50) }));
    poner('https://aulapro.app/app/?code=C&state=OTRO');
    const m = await import('./microsoft');
    expect(m.hayVueltaEntradaMicrosoft()).toBe(false);
  });

  it('si el centro no deja dar el permiso de OneDrive, sale como falta de permiso y no se guarda nada', async () => {
    sessionStorage.setItem('aulapro_ms_vuelta', JSON.stringify({ state: 'S2', modo: 'onedrive', verifier: 'v'.repeat(50) }));
    poner('https://aulapro.app/app/?error=access_denied&error_description=AADSTS90094&state=S2');
    const m = await import('./microsoft');
    await expect(m.terminarVueltaOneDrive('profe@outlook.com')).rejects.toMatchObject({ name: 'NotAllowedError' });
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(await m.leerPermisoOneDrive()).toBeUndefined();
  });

  it('con el permiso de OneDrive dado, el acceso se recuerda y se renueva una sola vez para varios a la vez', async () => {
    memoria.set('microsoft', { email: 'profe@outlook.com', refresh: 'R1', archivos: true });
    fetchFalso.mockImplementation(async () => new Response(JSON.stringify(tokens({ refresh_token: 'R2' })), { status: 200 }));
    const m = await import('./microsoft');
    const [a, id] = await Promise.all([m.tokenOneDrive(), m.tokenDeIdentidadMicrosoft()]);
    expect(a).toBe('ACCESO');
    expect(id).toBe('ID');
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchFalso.mock.calls[0][1].body)).toEqual({ refresh_token: 'R1', archivos: true });
    // El permiso duradero nuevo se guarda para que no caduque por falta de uso
    expect(memoria.get('microsoft')).toMatchObject({ refresh: 'R2', archivos: true });
    // Y al recargar la página, el acceso no se vuelve a pedir
    vi.resetModules();
    expect(await (await import('./microsoft')).tokenOneDrive()).toBe('ACCESO');
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('sin el permiso de OneDrive, el acceso a archivos no existe, pero la identidad se renueva con el de siempre', async () => {
    memoria.set('microsoft', { email: 'profe@outlook.com', refresh: 'R1', archivos: false });
    const m = await import('./microsoft');
    await expect(m.tokenOneDrive()).rejects.toMatchObject({ name: 'NotAllowedError' });
    expect(await m.tokenDeIdentidadMicrosoft()).toBe('ID');
    expect(JSON.parse(fetchFalso.mock.calls[0][1].body).archivos).toBe(false);
  });

  it('dejar de guardar en OneDrive conserva la identidad', async () => {
    memoria.set('microsoft', { email: 'profe@outlook.com', refresh: 'R1', archivos: true });
    const m = await import('./microsoft');
    await m.quitarPermisoOneDrive();
    expect(memoria.get('microsoft')).toEqual({ email: 'profe@outlook.com', refresh: 'R1', archivos: false });
    expect(await m.leerPermisoOneDrive()).toBeUndefined();
  });

  it('un permiso caducado en el servidor no rompe la búsqueda de la compra: sin identidad', async () => {
    memoria.set('microsoft', { email: 'profe@outlook.com', refresh: 'MUERTO', archivos: false });
    fetchFalso.mockImplementation(async () => new Response(JSON.stringify({ error: 'caducado' }), { status: 401 }));
    const m = await import('./microsoft');
    expect(await m.tokenDeIdentidadMicrosoft()).toBe('');
  });
});
