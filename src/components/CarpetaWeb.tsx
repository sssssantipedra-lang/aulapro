import { useEffect, useState } from 'react';
import { FolderSync, FolderX, AlertTriangle } from 'lucide-react';
import { carpetaWeb } from '../platform/carpetaWeb';
import { useToast } from './ui/Toast';
import { useI18n } from '../i18n';

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

/** Versión web: la carpeta del ordenador en Configuración › Datos y copias. */
export function CarpetaWebPanel() {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const { estado } = useCarpeta();
  const [ocupado, setOcupado] = useState(false);
  const [elegir, setElegir] = useState(false);

  if (!carpetaWeb.soportada()) {
    return (
      <p className="carpeta-web-nota">
        {t('En este dispositivo no se puede elegir una carpeta (solo en Chrome o Edge de un ordenador). Para guardar una copia fuera, usa «Descargar mis datos».')}
      </p>
    );
  }

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

  return (
    <div className="carpeta-web">
      <div className="carpeta-web-ttl"><FolderSync size={15} color="var(--accent-d)" aria-hidden="true" />{t('Copia en una carpeta del ordenador')}</div>
      <p>{t('Elige una carpeta y AulaPro copiará ahí cada cambio. Si eliges la carpeta de OneDrive o de Google Drive de tu ordenador, tu trabajo queda también en tu nube, y otro ordenador con la misma carpeta lo abre.')}</p>

      {estado.tipo === 'activa' && (
        <div className="carpeta-web-estado">
          <strong>{t('Copiando en «{nombre}»', { nombre: estado.nombre })}</strong>
          {estado.ultima && <span>{t('Última copia: {hora}', { hora: new Date(estado.ultima).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</span>}
        </div>
      )}
      {estado.tipo === 'error' && (
        <div className="carpeta-web-estado error">{t('No se pudo copiar en «{nombre}»: {mensaje}', { nombre: estado.nombre, mensaje: estado.mensaje })}</div>
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
          <button className={estado.tipo === 'sin-carpeta' ? 'btn-accent' : 'btn-ghost'} disabled={ocupado} onClick={() => correr(() => carpetaWeb.elegir())}>
            <FolderSync size={14} />{t(estado.tipo === 'sin-carpeta' ? 'Elegir carpeta' : 'Cambiar carpeta')}
          </button>
          {estado.tipo !== 'sin-carpeta' && (
            <button className="btn-ghost" disabled={ocupado} onClick={() => carpetaWeb.desconectar()}>
              <FolderX size={14} />{t('Dejar de copiar')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
