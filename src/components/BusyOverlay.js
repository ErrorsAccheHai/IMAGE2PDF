import React from 'react';

export default function BusyOverlay({ text }) {
  return (
    <div className="busy-overlay">
      <div className="busy-spinner" />
      <div className="busy-text">{text}</div>
    </div>
  );
}
