import { useEffect, useId } from 'react';
import { Eye, X } from 'lucide-react';
import { useI18n } from '../i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** HTML autocontenido, el mismo que se imprimiría como PDF. */
  html: string;
}

/**
 * «Visor» del documento: pinta el mismo HTML que se convertiría en PDF, en un
 * marco de página, sin descargar ni guardar nada. Un iframe con `srcDoc` lo
 * hace funcionar igual en escritorio, web y Android. `sandbox` vacío deja el
 * HTML estático (nada de scripts), que es justo lo que son estos documentos.
 */
export function DocPreview({ open, onClose, title, html }: Props) {
  const { t } = useI18n();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div
      className={`modal-overlay${open ? ' open' : ''}`}
      style={{ zIndex: 300, padding: 0, background: 'rgba(15,23,42,0.66)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
      aria-hidden={!open}
    >
      <div
        style={{
          position: 'absolute', inset: 12, display: 'flex', flexDirection: 'column',
          background: 'var(--surface)', borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            borderBottom: '0.5px solid var(--border)', background: 'var(--card)', flexShrink: 0,
          }}
        >
          <Eye size={17} color="var(--accent-d)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              id={titleId}
              style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {title}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{t('Vista previa · así se imprime')}</div>
          </div>
          <button className="ico-btn" onClick={onClose} aria-label={t('Cerrar')} title={t('Cerrar')}>
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            flex: 1, overflow: 'auto', background: '#475569', padding: 18,
            display: 'flex', justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '100%', maxWidth: 820, height: 'max(600px, 100%)',
              background: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.25)', borderRadius: 3,
            }}
          >
            <iframe
              title={title}
              srcDoc={html}
              sandbox=""
              style={{ width: '100%', height: '100%', border: 0, background: '#fff', display: 'block' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
