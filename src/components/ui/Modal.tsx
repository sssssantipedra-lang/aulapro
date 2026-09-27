import { useEffect, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../../i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  wide?: boolean;
  children: ReactNode;
  stickyHeader?: boolean;
}

export function Modal({ open, onClose, title, wide, children, stickyHeader }: Props) {
  const { t } = useI18n();
  const titleId = useId();

  // Escape cierra, como en cualquier ventana
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div
      className={`modal-overlay${open ? ' open' : ''}`}
      onClick={e => e.target === e.currentTarget && onClose()}
      aria-hidden={!open}
    >
      <div
        className={`modal${wide ? ' wide' : ''}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title !== undefined ? titleId : undefined}
      >
        {title !== undefined && (
          <div
            className="modal-hd"
            style={stickyHeader ? { position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1, paddingBottom: 14, borderBottom: '0.5px solid var(--border)', marginBottom: 14 } : undefined}
          >
            <div className="modal-title" id={titleId}>{title}</div>
            <button className="ico-btn" onClick={onClose} aria-label={t('Cerrar')} title={t('Cerrar')}><X size={17} /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
