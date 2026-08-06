import { useCallback, useEffect, useState } from 'react';
import { HardDrive, FolderOpen, Archive, RotateCcw, Trash2, CalendarX } from 'lucide-react';
import * as store from '../services/storage';
import { useToast } from './ui/Toast';
import { useI18n } from '../i18n';

interface Props {
  profileId: string | null;
  courseLabel: string;
  onClearSchoolYear: () => Promise<void>;
}

/**
 * Panel de la carpeta de datos: dónde está, cuánto ocupa, copias de
 * seguridad y el vaciado de fin de curso.
 */
export function DataFolder({ profileId, courseLabel, onClearSchoolYear }: Props) {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const [info, setInfo] = useState<store.FolderInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = useCallback(() => {
    if (!profileId) return;
    store.folderInfo(profileId).then(setInfo);
  }, [profileId]);

  useEffect(() => { refresh(); }, [refresh]);

  const desktop = store.isDesktop();

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
    setBusy(true);
    const ok = await store.restoreBackup(profileId, file);
    setBusy(false);
    if (ok) {
      toast(t('✅ Copia restaurada. Se recarga la aplicación…'));
      setTimeout(() => window.location.reload(), 900);
    } else {
      toast(t('No se pudo restaurar esa copia'));
    }
  }

  return (
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
        {t(desktop
          ? 'Todo tu trabajo se guarda en una carpeta de este equipo, solo para este perfil. Aula Pro hace una copia de seguridad automática cada diez minutos mientras trabajas.'
          : 'En el navegador los datos se guardan dentro del propio navegador. Para que se guarden en carpetas de tu ordenador, con copias automáticas, usa la aplicación de escritorio (AulaPro.exe).')}
      </p>

      {desktop && info && (
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
          <button className="btn-ghost" onClick={() => profileId && store.openFolder(profileId)}>
            <FolderOpen size={14} />{t('Abrir carpeta')}
          </button>
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

      {/* Fin de curso */}
      <div style={{ paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
          {t('Final de curso')} {courseLabel && `· ${courseLabel}`}
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14 }}>
          {t('Cuando termine la tercera evaluación puedes vaciar el curso: se borran clases, alumnos, notas, evaluaciones, asistencia e informes.')} <strong>{t('Se conservan tus rúbricas y dianas')}</strong>{t(', que te servirán el año que viene.')}
          {desktop && t(' Antes de borrar se guarda una copia de seguridad.')}
        </p>

        {confirmClear ? (
          <div style={{ background: 'rgba(239,68,68,0.07)', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '13px 15px' }}>
            <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 12 }}>
              {t('¿Seguro? Se borrará el trabajo de este curso. Podrás recuperarlo desde las copias de seguridad de arriba si te arrepientes.')}
            </p>
            <div style={{ display: 'flex', gap: 9 }}>
              <button
                className="btn-ghost"
                style={{ color: 'white', background: 'var(--danger)', border: 'none' }}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onClearSchoolYear();
                  setBusy(false);
                  setConfirmClear(false);
                  refresh();
                  toast(t('✅ Curso vaciado. Tus rúbricas siguen ahí.'));
                }}
              >
                {t('Sí, vaciar el curso')}
              </button>
              <button className="btn-ghost" onClick={() => setConfirmClear(false)}>{t('Cancelar')}</button>
            </div>
          </div>
        ) : (
          <button className="btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirmClear(true)}>
            <CalendarX size={14} />{t('Vaciar el curso')}
          </button>
        )}
      </div>
    </div>
  );
}
