import { type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  wide?: boolean;
  children: ReactNode;
  stickyHeader?: boolean;
}

export function Modal({ open, onClose, title, wide, children, stickyHeader }: Props) {
  return (
    <div
      className={`modal-overlay${open ? ' open' : ''}`}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className={`modal${wide ? ' wide' : ''}`} onClick={e => e.stopPropagation()}>
        {title !== undefined && (
          <div
            className="modal-hd"
            style={stickyHeader ? { position: 'sticky', top: 0, background: 'white', zIndex: 1, paddingBottom: 14, borderBottom: '0.5px solid var(--border)', marginBottom: 14 } : undefined}
          >
            <div className="modal-title">{title}</div>
            <button className="ico-btn" onClick={onClose}><X size={17} /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
