import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export function Brand({ small = false }) {
  return <div className={`brand ${small ? 'brand--small' : ''}`} aria-label="3กอง"><span>3</span>กอง{!small && <em>กาญจนบุรี</em>}</div>;
}
export function GameButton({ children, variant = 'primary', className = '', ...props }) {
  return <button type="button" className={`game-button game-button--${variant} ${className}`} {...props}>{children}</button>;
}
export function Avatar({ value = '🦊', size = '', className = '' }) {
  return <span className={`game-avatar ${size && `game-avatar--${size}`} ${className}`} aria-hidden="true">{value}</span>;
}
export function Badge({ children, tone = 'neutral' }) {
  return <span className={`game-badge game-badge--${tone}`}>{children}</span>;
}
export function Sheet({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus?.(); };
  }, []);
  return <dialog ref={ref} className="game-sheet" aria-label={title} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <header><h2>{title}</h2><GameButton variant="icon" aria-label="ปิด" onClick={onClose}><X size={22}/></GameButton></header>
    <div className="game-sheet__body">{children}</div>
  </dialog>;
}
