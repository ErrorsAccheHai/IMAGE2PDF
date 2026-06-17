import React, { useEffect } from 'react';

/**
 * Floating toast for format errors.
 * Props: message (string|null), onDismiss ()=>void
 * Auto-dismisses after 3.5 s.
 */
export default function FormatError({ message, onDismiss }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="format-error" role="alert" onClick={onDismiss}>
      <span className="format-error__icon">⚠️</span>
      <span>{message}</span>
      <button className="format-error__close" aria-label="Dismiss">✕</button>
    </div>
  );
}
