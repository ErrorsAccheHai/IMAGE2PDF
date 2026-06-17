import React, { useState } from 'react';

/**
 * Reusable drop zone.
 * Props:
 *   onFiles(FileList|File[]) — called when files are chosen/dropped
 *   accept  — string passed to <input accept>  e.g. "image/*"
 *   label   — primary label text
 *   icon    — emoji / node shown above label
 *   multiple — boolean
 */
export default function Dropzone({ onFiles, accept, label, icon = '⬆️', multiple = true }) {
  const [active, setActive] = useState(false);
  const inputRef = React.useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    setActive(false);
    if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={`dropzone${active ? ' dropzone--active' : ''}`}
      onClick={() => inputRef.current.click()}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={(e) => { e.preventDefault(); setActive(true); }}
      onDragLeave={() => setActive(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current.click()}
    >
      <span className="dropzone-icon">{icon}</span>
      <span>{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files.length) onFiles(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}
