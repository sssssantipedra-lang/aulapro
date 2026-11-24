import { useCallback, useEffect, useState } from 'react';
import { HardDrive, FolderOpen, Archive, RotateCcw, Trash2 } from 'lucide-react';
import * as store from '../services/storage';
import { useToast } from './ui/Toast';
import { useI18n } from '../i18n';
import { isAndroidApp, isWebApp } from '../lib/platform';
import { bloquearGuardado } from '../lib/guardadoBloqueado';
import { CarpetaWebPanel, CuentaWebPanel, SinConexionPanel } from './CarpetaWeb';
import { FinalDeCurso, type DatosParaCursoNuevo } from './FinalDeCurso';
import { cursoAlRestaurar } from '../lib/cursoAnterior';

interface Props {
  profileId: string | null;
  courseLabel: string;
  onClearSchoolYear: () => Promise<void>;
  /** Perfil de PT y AL: al vaciar el curso se conserva su alumnado de apoyo, y se dice. */
  apoyo?: boolean;
  /** Lo que necesita «Empezar curso nuevo» (`components/CursoNuevo.tsx`). Sin ello, solo se ofrece vaciar. */
  cursoNuevo?: DatosParaCursoNuevo;
}

/**
 * Panel de la carpeta de datos: dónde está, cuánto ocupa y copias de
 * seguridad. Debajo, en su tarjeta, el final de curso (`FinalDeCurso`).
 */
export function DataFolder({ profileId, courseLabel, onClearSchoolYear, apoyo = false, cursoNuevo }: Props) {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const [info, setInfo] = useState<store.FolderInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    if (!profileId) return;
    store.folderInfo(profileId).then(setInfo);
  }, [profileId]);

  useEffect(() => { refresh(); }, [refresh]);

  const desktop = store.isDesktop();
  /** En Android la carpeta es privada de la app: ni ruta que enseñar ni explorador que abrir. */
  const android = isAndroidApp();
  /** En la versión web, igual: los datos están dentro del navegador. */
  const web = isWebApp();

  async function makeBackup() {
    if (!profileId) return;
    setBusy(true);
    const file = await store.backup(profileId);
    setBusy(false);
    refresh();
    toast(t(file ? '✅ Copia de seguridad creada' : 'No hay datos que copiar todavía'));
  }

  async function restore(file: string) {
    if (!profileId) return;
    if (!window.confirm(t('¿Restaurar esta copia? Sustituye tu trabajo actual. Antes se guarda lo que tienes ahora en otra copia, por si quieres volver atrás.'))) return;
    setBusy(true);
    // Desde aquí, lo que hay en memoria no se vuelve a guardar: escribiría encima de la copia restaurada antes de recargar
    bloquearGuardado();
    const ok = await store.restoreBackup(profileId, file);
    // Una copia de antes de «Empezar curso nuevo» devuelve también el perfil a su curso escolar (`lib/cursoAnterior.ts`)
    const curso = ok ? cursoAlRestaurar(profileId, file) : null;
    if (curso !== null) await store.updateProfile(profileId, { course: curso }).catch(() => null);
    setBusy(false);
    toast(t(ok ? '✅ Copia restaurada. Se recarga la aplicación…' : 'No se pudo restaurar esa copia'));
    // Se recarga también si falla: con el guardado parado, seguir aquí perdería lo que se hiciera después
    setTimeout(() => window.location.reload(), ok ? 900 : 2000);
  }

  return (
    <>
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="card-hd">
        <div className="card-ttl"><HardDrive size={14} color="var(--accent-d)" />{t('Mis datos')}</div>
        {info && (
          <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>
            {store.formatBytes(info.bytes)}
          </span>
        )}
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 12 }}>
        {t(web
          ? 'Tu trabajo se guarda en este dispositivo, dentro del navegador, solo para este perfil, y no se sube a ningún servidor de AulaPro. AulaPro hace copias automáticas cada diez minutos mientras trabajas, pero están en el mismo navegador: si se borran sus datos, se pierden también. Para no perder nada, guarda tu trabajo en tu Drive u OneDrive, en una carpeta de tu ordenador o descarga copias a menudo.'
          : android
          ? 'Todo tu trabajo se guarda dentro de AulaPro en este dispositivo, solo para este perfil, y no se sube a ninguna nube. AulaPro hace una copia de seguridad automática cada diez minutos mientras trabajas.'
          : desktop
          ? 'Todo tu trabajo se guarda en una carpeta de este equipo, solo para este perfil. AulaPro hace una copia de seguridad automática cada diez minutos mientras trabajas.'
          : 'En el navegador los datos se guardan dentro del propio navegador. Para que se guarden en carpetas de tu ordenador, con copias automáticas, usa la aplicación de escritorio (AulaPro.exe).')}
      </p>

      {web && <><CuentaWebPanel /><CarpetaWebPanel /><SinConexionPanel /></>}

      {desktop && !android && !web && info && (
        <div style={{
          fontSize: 11.5, color: 'var(--text-2)', background: 'var(--surface)',
          borderRadius: 9, padding: '10px 13px', marginBottom: 14,
          fontFamily: 'ui-monospace, Menlo, monospace', wordBreak: 'break-all', lineHeight: 1.5,
        }}>
          {info.path}
        </div>
      )}

      {desktop && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          {!android && !web && (
            <button className="btn-ghost" onClick={() => profileId && store.openFolder(profileId)}>
              <FolderOpen size={14} />{t('Abrir carpeta')}
            </button>
          )}
          <button className="btn-ghost" onClick={makeBackup} disabled={busy}>
            <Archive size={14} />{t('Crear copia ahora')}
          </button>
        </div>
      )}

      {/* Copias */}
      {desktop && info && info.backups.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            {t('Copias de seguridad ({n})', { n: info.backups.length })}
          </div>
          <p className="copias-nota">{t('Se guardan las cinco más recientes y, de los días y las semanas anteriores, la primera de cada uno.')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 168, overflowY: 'auto' }}>
            {info.backups.map(b => (
              <div key={b.file} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                background: 'var(--surface)', borderRadius: 8, fontSize: 12.5,
              }}>
                <span style={{ flex: 1, color: 'var(--text-2)', minWidth: 0 }}>
                  {new Date(b.at).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>{store.formatBytes(b.size)}</span>
                </span>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11.5, padding: '4px 10px', flexShrink: 0 }}
                  onClick={() => restore(b.file)}
                  disabled={busy}
                >
                  <RotateCcw size={12} />{t('Restaurar')}
                </button>
              </div>
            ))}
          </div>
          <button
            className="btn-ghost"
            style={{ marginTop: 9, fontSize: 12, color: 'var(--text-3)' }}
            onClick={async () => {
              if (!profileId) return;
              await store.clearBackups(profileId);
              refresh();
              toast(t('Copias de seguridad borradas'));
            }}
          >
            <Trash2 size={12} />{t('Borrar todas las copias')}
          </button>
        </div>
      )}

    </div>

    {/* Final de curso, en su tarjeta: empezar curso nuevo y, aparte, vaciarlo */}
    <FinalDeCurso
      courseLabel={courseLabel} apoyo={apoyo} conCopias={desktop} cursoNuevo={cursoNuevo}
      onClearSchoolYear={async () => { await onClearSchoolYear(); refresh(); }}
      onHecho={refresh}
    />
    </>
  );
}
