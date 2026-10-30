import { useEffect, useState } from 'react';
import { Cloud, FolderSync, FolderX, AlertTriangle, LogOut, UserCircle, WifiOff, ShieldAlert } from 'lucide-react';
import { carpetaWeb, EVENTO_PDF, NOMBRE_ONEDRIVE } from '../platform/carpetaWeb';
import { DRIVE_LLENO } from '../platform/driveFs';
import { cerrarSesion, leerCuenta, type Cuenta } from '../platform/cuentaWeb';
import { useToast } from './ui/Toast';
import { useI18n } from '../i18n';
import { compartirArchivo, downloadFile, puedeCompartirArchivos } from '../lib/download';
import { CARPETAS } from '../lib/carpetas';
import { isoDate } from '../lib/utils';
import { debeAvisar, diasDesdeCopia, leerEstadoCopia, marcarUso, posponerAviso, registrarCopia } from '../lib/avisoCopia';
import { requestSettingsPanel } from '../lib/settingsNav';
import { DondeGuardar } from './DondeGuardar';

/** El estado de la carpeta, al día. */
function useCarpeta() {
  const [, setN] = useState(0);
  useEffect(() => carpetaWeb.onCambio(() => setN(n => n + 1)), []);
  return { estado: carpetaWeb.estado(), conflictos: carpetaWeb.conflictos() };
}

const recargar = () => setTimeout(() => window.location.reload(), 900);

/**
 * Versión web: aviso flotante cuando la copia en la carpeta del ordenador se
 * ha parado, porque el navegador vuelve a pedir permiso o porque el trabajo
 * ha cambiado aquí y en otro dispositivo (ver `platform/espejo.ts`).
 */
export function CarpetaWebAviso() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { estado, conflictos } = useCarpeta();
  const [ocupado, setOcupado] = useState(false);
  const ms = carpetaWeb.nombreNube() === NOMBRE_ONEDRIVE;

  async function permitir() {
    setOcupado(true);
    const cargados = await carpetaWeb.pedirPermiso().catch(() => 0);
    setOcupado(false);
    if (cargados > 0) { toast(t('✅ Datos traídos de la carpeta. Se recarga la aplicación…')); recargar(); }
  }

  async function resolver(con: 'carpeta' | 'local') {
    setOcupado(true);
    for (const id of conflictos) await carpetaWeb.resolver(id, con);
    setOcupado(false);
    if (con === 'carpeta') { toast(t('✅ Datos traídos de la carpeta. Se recarga la aplicación…')); recargar(); }
  }

  if (conflictos.length) {
    return (
      <div className="update-banner carpeta-aviso" role="alert">
        <AlertTriangle size={18} color="var(--warn, #d97706)" style={{ flexShrink: 0 }} aria-hidden="true" />
        <span style={{ flex: 1 }}>{t('Tu trabajo ha cambiado en otro dispositivo y también en este. ¿Con cuál te quedas?')}</span>
        <div className="carpeta-aviso-btns">
          <button disabled={ocupado} onClick={() => resolver('carpeta')}>{t('Usar el de la carpeta')}</button>
          <button disabled={ocupado} onClick={() => resolver('local')}>{t('Quedarme con el de aquí')}</button>
        </div>
      </div>
    );
  }
  if (estado.tipo === 'error' && estado.mensaje === DRIVE_LLENO) {
    return (
      <div className="update-banner carpeta-aviso" role="alert">
        <AlertTriangle size={18} color="var(--warn, #d97706)" style={{ flexShrink: 0 }} aria-hidden="true" />
        <span style={{ flex: 1 }}>{t(ms ? 'Tu OneDrive está lleno y AulaPro no puede copiar ahí. Tu trabajo sigue guardado en este dispositivo. Libera espacio en OneDrive y AulaPro seguirá copiando sola.' : 'Tu Google Drive está lleno y AulaPro no puede copiar ahí. Tu trabajo sigue guardado en este dispositivo. Libera espacio en Drive y AulaPro seguirá copiando sola.')}</span>
        <a className="carpeta-aviso-enlace" href={ms ? 'https://onedrive.live.com/' : 'https://drive.google.com/drive/quota'} target="_blank" rel="noreferrer">{t(ms ? 'Ver mi espacio en OneDrive' : 'Ver mi espacio en Drive')}</a>
      </div>
    );
  }
  if (estado.tipo === 'sin-permiso') {
    return (
      <div className="update-banner carpeta-aviso" role="status">
        <FolderSync size={18} color="var(--accent-d)" style={{ flexShrink: 0 }} aria-hidden="true" />
        <span style={{ flex: 1 }}>{t('AulaPro necesita tu permiso para seguir copiando en «{nombre}».', { nombre: estado.nombre })}</span>
        <button disabled={ocupado} onClick={permitir}>{t('Permitir')}</button>
      </div>
    );
  }
  return null;
}

/** iPhone o iPad con Safari y sin la app en la pantalla de inicio: ahí Safari borra los datos tras siete días sin abrirla. */
function iosSinInstalar() {
  try {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const instalada = (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
    return ios && !instalada;
  } catch { return false; }
}

/**
 * Versión web: aviso de copia de seguridad para quien guarda solo en el navegador (sin Drive, OneDrive ni
 * carpeta). Sale a los 2 días de uso sin ninguna copia y, después, cada semana (`lib/avisoCopia.ts`), con la
 * copia a un clic, el camino a guardar en la nube o en una carpeta, y «Más tarde». `exportar` es la copia
 * de todos los datos (`useAppState.exportData`); `onIrADatos` lleva a Configuración › Datos y copias.
 */
export function AvisoCopiaWeb({ exportar, onIrADatos, oculto }: { exportar: () => Record<string, unknown>; onIrADatos: () => void; oculto?: boolean }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { estado } = useCarpeta();
  const [, refrescar] = useState(0);
  const [cuenta, setCuenta] = useState<Cuenta | undefined>();
  useEffect(() => { marcarUso(); refrescar(n => n + 1); leerCuenta().then(setCuenta); }, []);

  // Con una nube o una carpeta ya elegidas, eso lo cuidan sus propios avisos
  if (oculto || estado.tipo !== 'sin-carpeta') return null;
  const copia = leerEstadoCopia();
  if (!debeAvisar(copia)) return null;
  const dias = diasDesdeCopia(copia.ultima);
  const compartir = puedeCompartirArchivos();

  async function guardarCopia() {
    const blob = new Blob([JSON.stringify(exportar(), null, 2)], { type: 'application/json' });
    const nombre = `aulapro-copia-${isoDate()}.json`;
    if (compartir) {
      if (!(await compartirArchivo(blob, nombre))) return;
      toast(t('✅ Copia enviada'));
    } else {
      await downloadFile(blob, nombre, CARPETAS.copias);
      toast(t('✅ Copia de seguridad descargada'));
    }
    registrarCopia();
    refrescar(n => n + 1);
  }

  return (
    <div className="update-banner carpeta-aviso aviso-copia" role="status">
      <ShieldAlert size={18} color="var(--warn, #d97706)" style={{ flexShrink: 0 }} aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong className="aviso-copia-ttl">{t('Tu trabajo solo está en este navegador')}</strong>
        <p>{dias === null
          ? t('Todavía no has hecho ninguna copia. Si se borran los datos del navegador, cambias de dispositivo o se estropea, lo pierdes todo.')
          : t('Hace {n} días que no haces una copia. Si se borran los datos del navegador, cambias de dispositivo o se estropea, pierdes lo que hayas hecho desde entonces.', { n: dias })}</p>
        <p><strong>{t(cuenta?.proveedor === 'microsoft' ? 'Lo más seguro: guardarlo en tu OneDrive. Son dos clics y después se hace solo.' : 'Lo más seguro: guardarlo en tu Google Drive. Son dos clics y después se hace solo.')}</strong></p>
        {iosSinInstalar() && <p>{t('En iPhone y iPad, Safari puede borrarlo todo si pasas siete días sin abrir AulaPro. Evítalo añadiéndola a la pantalla de inicio (Compartir › Añadir a pantalla de inicio).')}</p>}
      </div>
      <div className="carpeta-aviso-btns">
        <button onClick={() => { requestSettingsPanel('datos'); onIrADatos(); }}>{t(cuenta?.proveedor === 'microsoft' ? 'Guardar en mi OneDrive' : 'Guardar en mi Google Drive')}</button>
        <button className="aviso-copia-sec" onClick={guardarCopia}>{t(compartir ? 'Guardar una copia' : 'Descargar una copia')}</button>
        <button className="aviso-copia-luego" onClick={() => { posponerAviso(); refrescar(n => n + 1); }}>{t('Más tarde')}</button>
      </div>
    </div>
  );
}

/** Versión web: antes del diálogo de imprimir, cómo sacar el PDF (el diálogo es del navegador). */
export function AvisoPdfWeb() {
  const { t } = useI18n();
  const { toast } = useToast();
  useEffect(() => {
    const avisar = () => toast(t('En el diálogo, elige «Guardar como PDF» como destino.'));
    window.addEventListener(EVENTO_PDF, avisar);
    return () => window.removeEventListener(EVENTO_PDF, avisar);
  }, [t, toast]);
  return null;
}

/** Versión web: con qué cuenta se ha entrado, y salir (Configuración › Datos y copias). */
export function CuentaWebPanel() {
  const { t } = useI18n();
  const [cuenta, setCuenta] = useState<Cuenta | undefined>();
  useEffect(() => { leerCuenta().then(setCuenta); }, []);
  if (!cuenta) return null;
  return (
    <div className="carpeta-web">
      <div className="carpeta-web-ttl"><UserCircle size={15} color="var(--accent-d)" aria-hidden="true" />{t('Tu cuenta')}</div>
      <p>{t('Has entrado con la cuenta de Google {email}.', { email: cuenta.email })}</p>
      <div className="carpeta-web-btns">
        <button className="btn-ghost" onClick={async () => { await cerrarSesion(); window.location.reload(); }}>
          <LogOut size={14} />{t('Salir de la cuenta')}
        </button>
      </div>
    </div>
  );
}

/** Versión web: ¿está AulaPro guardada en este dispositivo para abrirla sin internet? (service worker, `web/app/sw.js`) */
type SinConexion = 'mirando' | 'lista' | 'abre' | 'preparando' | 'no';

async function leerSinConexion(): Promise<SinConexion> {
  try {
    if (!('serviceWorker' in navigator) || !('caches' in window)) return 'no';
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return 'no';
    if (!reg.active) return 'preparando';
    for (const nombre of await caches.keys()) {
      if (!nombre.startsWith('aulapro-')) continue;
      const cache = await caches.open(nombre);
      if (await cache.match('./.todo-guardado')) return 'lista';
      // Abre sin conexión; faltan los dibujos y pictogramas (el service worker los baja después)
      if ((await cache.keys()).length > 0) return 'abre';
    }
    return 'preparando';
  } catch { return 'no'; }
}

/** Versión web: si la app abre sin internet (Configuración › Datos y copias). */
export function SinConexionPanel() {
  const { t } = useI18n();
  const [estado, setEstado] = useState<SinConexion>('mirando');
  useEffect(() => {
    let vivo = true;
    let espera: ReturnType<typeof setTimeout>;
    const mirar = async () => {
      const e = await leerSinConexion();
      if (!vivo) return;
      setEstado(e);
      if (e === 'preparando' || e === 'abre') espera = setTimeout(mirar, 2000);
    };
    mirar();
    return () => { vivo = false; clearTimeout(espera); };
  }, []);
  if (estado === 'mirando') return null;
  return (
    <div className="carpeta-web">
      <div className="carpeta-web-ttl"><WifiOff size={15} color="var(--accent-d)" aria-hidden="true" />{t('Uso sin conexión')}</div>
      <p>{t(estado === 'lista'
        ? 'Lista: AulaPro está guardada en este dispositivo y se abre sin internet. Ábrela desde la dirección aulapro.app/app/ (con la barra del final) o desde su icono en la pantalla de inicio.'
        : estado === 'abre'
        ? 'Ya abre sin internet. Se están guardando también los dibujos y pictogramas: déjala abierta con conexión hasta que ponga «Lista».'
        : estado === 'preparando'
        ? 'Descargando AulaPro en este dispositivo para usarla sin internet. Déjala abierta un momento con conexión.'
        : 'Este navegador no guarda AulaPro para usarla sin internet. Ábrela con conexión en una pestaña normal (no privada) y, en el iPhone, añádela a la pantalla de inicio desde Compartir.')}</p>
    </div>
  );
}

/** Versión web: la carpeta del ordenador en Configuración › Datos y copias. */
export function CarpetaWebPanel() {
  const { t, locale } = useI18n();
  const [cuenta, setCuenta] = useState<Cuenta | undefined>();
  useEffect(() => { leerCuenta().then(setCuenta); }, []);
  const { toast } = useToast();
  const { estado } = useCarpeta();
  const [ocupado, setOcupado] = useState(false);
  const [elegir, setElegir] = useState(false);

  const drive = carpetaWeb.usaDrive();
  const ms = carpetaWeb.nombreNube() === NOMBRE_ONEDRIVE || (!drive && cuenta?.proveedor === 'microsoft');

  function terminar(r: { elegir: boolean; cargados: number } | null) {
    if (!r) return;
    if (r.elegir) { setElegir(true); return; }
    setElegir(false);
    if (r.cargados > 0) { toast(t('✅ Datos traídos de la carpeta. Se recarga la aplicación…')); recargar(); }
    else {
      const e = carpetaWeb.estado();
      toast(t('✅ AulaPro copiará tu trabajo en «{nombre}»', { nombre: 'nombre' in e ? e.nombre : '' }));
    }
  }

  async function correr(fn: () => Promise<{ elegir: boolean; cargados: number } | null>) {
    setOcupado(true);
    try { terminar(await fn()); } catch (err) {
      toast(t('No se pudo copiar en «{nombre}»: {mensaje}', { nombre: '', mensaje: err instanceof Error ? err.message : String(err) }));
    }
    setOcupado(false);
  }

  const sola = estado.tipo === 'sin-carpeta';
  const dias = diasDesdeCopia(leerEstadoCopia().ultima);

  return (
    <div className="carpeta-web">
      {sola && (
        <div className="carpeta-web-alerta" role="status">
          <ShieldAlert size={16} aria-hidden="true" />
          <div>
            <strong>{t('Ahora tu trabajo solo está en este navegador')}</strong>
            <p>{dias === null ? t('Todavía no has descargado ninguna copia.') : dias === 0 ? t('Última copia descargada: hoy.') : dias === 1 ? t('Última copia descargada: ayer.') : t('Última copia descargada: hace {n} días.', { n: dias })}</p>
            {iosSinInstalar() && <p>{t('En iPhone y iPad, Safari puede borrarlo todo si pasas siete días sin abrir AulaPro. Evítalo añadiéndola a la pantalla de inicio (Compartir › Añadir a pantalla de inicio).')}</p>}
          </div>
        </div>
      )}
      {sola && <DondeGuardar ms={ms} carpeta={carpetaWeb.soportada()} />}
      <div className="carpeta-web-ttl"><Cloud size={15} color="var(--accent-d)" aria-hidden="true" />{t(drive ? (ms ? 'Tu trabajo, en tu OneDrive' : 'Tu trabajo, en tu Google Drive') : 'Dónde se guarda una copia')}</div>
      <p>{t(drive
        ? (ms ? 'Cada cambio se guarda solo en la carpeta «AulaPro» de tu OneDrive, y lo nuevo de tus otros dispositivos llega en unos segundos.' : 'Cada cambio se guarda solo en la carpeta «AulaPro» de tu Google Drive, y lo nuevo de tus otros dispositivos llega en unos segundos.')
        : (ms ? 'Guárdalo en tu OneDrive y lo tendrás en todos tus dispositivos.' : 'Guárdalo en tu Google Drive y lo tendrás en todos tus dispositivos. En un ordenador, también puedes elegir una carpeta.'))}</p>

      {estado.tipo === 'activa' && (
        <div className="carpeta-web-estado">
          <strong>{t('Copiando en «{nombre}»', { nombre: estado.nombre })}</strong>
          {estado.ultima && <span>{t('Última copia: {hora}', { hora: new Date(estado.ultima).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</span>}
        </div>
      )}
      {estado.tipo === 'error' && (
        <div className="carpeta-web-estado error">{t('No se pudo copiar en «{nombre}»: {mensaje}', { nombre: estado.nombre, mensaje: estado.mensaje === DRIVE_LLENO ? t(ms ? 'Tu OneDrive está lleno.' : 'Tu Google Drive está lleno.') : estado.mensaje })}</div>
      )}

      {elegir ? (
        <div className="carpeta-web-elegir">
          <strong>{t('Esta carpeta ya tiene datos de AulaPro')}</strong>
          <p>{t('Este navegador también tiene datos. ¿Con cuáles quieres quedarte?')}</p>
          <div className="carpeta-web-btns">
            <button className="btn-accent" disabled={ocupado} onClick={() => correr(() => carpetaWeb.confirmar('carpeta'))} title={t('Los perfiles que solo estén en este navegador se conservan.')}>
              {t('Usar los de la carpeta')}
            </button>
            <button className="btn-ghost" disabled={ocupado} onClick={() => correr(() => carpetaWeb.confirmar('local'))} title={t('Los de este navegador sustituyen a los de la carpeta.')}>
              {t('Usar los de este navegador')}
            </button>
            <button className="btn-ghost" disabled={ocupado} onClick={() => setElegir(false)}>{t('Cancelar')}</button>
          </div>
          <p className="carpeta-web-nota">{t('Los perfiles que solo estén en este navegador se conservan.')}</p>
        </div>
      ) : (
        <div className="carpeta-web-btns">
          {!drive && (
            <button className="btn-accent" disabled={ocupado} onClick={() => correr(() => carpetaWeb.conectarDrive())}>
              <Cloud size={14} />{t(ms ? 'Guardar en mi OneDrive' : 'Guardar en mi Google Drive')} <span className="donde-rec">{t('Recomendado')}</span>
            </button>
          )}
          {!drive && !ms && carpetaWeb.soportada() && (
            <button className="btn-ghost" disabled={ocupado} onClick={() => correr(() => carpetaWeb.elegir())}>
              <FolderSync size={14} />{t(estado.tipo === 'sin-carpeta' ? 'Elegir carpeta' : 'Cambiar carpeta')}
            </button>
          )}
          {estado.tipo !== 'sin-carpeta' && (
            <button className="btn-ghost" disabled={ocupado} onClick={() => carpetaWeb.desconectar()}>
              <FolderX size={14} />{t(drive ? (ms ? 'Dejar de guardar en OneDrive' : 'Dejar de guardar en Drive') : 'Dejar de copiar')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
