import type { ReactNode } from 'react';

export default function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        {subtitle && <p className="muted" style={{ marginBottom: 16 }}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
