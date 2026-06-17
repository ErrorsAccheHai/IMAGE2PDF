import React, { useState, useRef, useCallback } from 'react';
import { uuidv4, loadImage, canvasToBlob, downloadBlob, MIME_EXT, formatBytes } from '../utils';
import BusyOverlay from '../components/BusyOverlay';
import FormatError from '../components/FormatError';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/x-png'];

export default function CompressImages() {
  const [files, setFiles] = useState([]);
  const [quality, setQuality] = useState(7);
  const [busy, setBusy] = useState(false);
  const [busyProgress, setBusyProgress] = useState('');
  const [dropzoneActive, setDropzoneActive] = useState(false);
  const [canvasDragOver, setCanvasDragOver] = useState(false);
  const [results, setResults] = useState([]);
  const [formatError, setFormatError] = useState(null);
  const fileInput = useRef();

  const processFiles = useCallback((fileList) => {
    const arr = [];
    let rejected = 0;
    for (const f of fileList) {
      if (ACCEPTED_TYPES.includes(f.type)) {
        arr.push({ id: uuidv4(), file: f, name: f.name, size: f.size, type: f.type === 'image/x-png' ? 'image/png' : f.type, previewUrl: URL.createObjectURL(f) });
      } else {
        rejected++;
      }
    }
    if (arr.length) { setFiles((prev) => [...prev, ...arr]); setResults([]); }
    if (rejected > 0) setFormatError(`Only JPEG, PNG, or WebP images are accepted. ${rejected} file${rejected > 1 ? 's' : ''} skipped.`);
  }, []);

  const removeFile = (id) => { setFiles((prev) => prev.filter((f) => f.id !== id)); setResults([]); };
  const clearAll = () => { files.forEach((f) => URL.revokeObjectURL(f.previewUrl)); setFiles([]); setResults([]); };

  const compress = async () => {
    try {
      setBusy(true); setResults([]);
      const q = quality / 10;
      const newResults = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setBusyProgress(`Compressing ${i + 1} of ${files.length}: ${f.name}…`);
        const img = await loadImage(f.previewUrl);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (f.type === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        ctx.drawImage(img, 0, 0);
        const outputType = f.type === 'image/png' ? 'image/webp' : f.type;
        const blob = await canvasToBlob(canvas, outputType, q);
        newResults.push({ name: f.name, originalSize: f.size, newSize: blob.size, outputType });
        const ext = MIME_EXT[outputType] || 'jpg';
        downloadBlob(blob, `${f.name.replace(/\.[^.]+$/, '')}-compressed.${ext}`);
        await new Promise((r) => setTimeout(r, 80));
      }
      setResults(newResults); setBusy(false);
    } catch (err) { console.error(err); setBusy(false); }
  };

  const totalSaved = results.reduce((a, r) => a + (r.originalSize - r.newSize), 0);
  const totalOrig  = results.reduce((a, r) => a + r.originalSize, 0);
  const pctSaved   = totalOrig > 0 ? Math.round((totalSaved / totalOrig) * 100) : 0;

  // ── Landing ──
  if (files.length === 0) {
    return (
      <div className="tool-page">
        <div className="landing-hero">
          <div className="landing-icon">🗜️</div>
          <h2 className="landing-title">Compress Images</h2>
          <p className="landing-subtitle">Reduce image file sizes without visible quality loss.<br />PNG, JPEG, and WebP — all in your browser.</p>
          <button onClick={() => fileInput.current.click()} className="big-btn">Select Images</button>
        </div>
        <div
          className={`dropzone${dropzoneActive ? ' dropzone--active' : ''}`}
          onDrop={(e) => { e.preventDefault(); setDropzoneActive(false); processFiles(e.dataTransfer.files); }}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={(e) => { e.preventDefault(); setDropzoneActive(true); }}
          onDragLeave={() => setDropzoneActive(false)}
        >
          <span className="dropzone-icon">⬆️</span>
          <span>or drop images here (JPEG / PNG / WebP)</span>
        </div>
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple style={{ display: 'none' }}
          onChange={(e) => { processFiles(e.target.files); e.target.value = ''; }} />
        <FormatError message={formatError} onDismiss={() => setFormatError(null)} />
      </div>
    );
  }

  // ── Working screen ──
  return (
    <div className="tool-workspace">
      <div className="main-layout">
        <div
          className="canvas-area"
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) setCanvasDragOver(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setCanvasDragOver(false); }}
          onDrop={(e) => { e.preventDefault(); setCanvasDragOver(false); if (e.dataTransfer.types.includes('Files')) processFiles(e.dataTransfer.files); }}
        >
          {canvasDragOver && <div className="canvas-drop-overlay">⬆️ Drop images to add</div>}
          {results.length > 0 && (
            <div className="result-summary">
              <span className="result-summary__icon">✅</span>
              <span>Saved <strong>{formatBytes(totalSaved)}</strong> ({pctSaved}% smaller)</span>
            </div>
          )}
          <div className="file-list" style={{ marginTop: 8 }}>
            {files.map((f, idx) => {
              const r = results[idx];
              return (
                <div key={f.id} className="file-row">
                  <span className="file-row__num">{idx + 1}</span>
                  <div className="file-row__thumb" style={{ backgroundImage: `url('${f.previewUrl}')` }} />
                  <span className="file-row__name">{f.name}</span>
                  <span className="file-row__size">{formatBytes(f.size)}</span>
                  {r && <span className="compress-badge">→ {formatBytes(r.newSize)} <span className="compress-badge__pct">({Math.round((1 - r.newSize / f.size) * 100)}% saved)</span></span>}
                  <button className="card-btn card-btn--delete file-row__del" onClick={() => removeFile(f.id)} title="Remove">✕</button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="options" style={{ display: 'block' }}>
          <div className="options__header"><span>Compress Options</span></div>
          <div className="opt-label">Quality</div>
          <div className="quality-row">
            <span>Quality</span>
            <div className="quality-controls">
              <button className="quality-btn" onClick={() => quality > 1  && setQuality(quality - 1)}>−</button>
              <span className="quality-value">{(quality / 10).toFixed(1)}</span>
              <button className="quality-btn" onClick={() => quality < 10 && setQuality(quality + 1)}>+</button>
            </div>
          </div>
          <input type="range" min="1" max="10" value={quality} onChange={(e) => setQuality(Number(e.target.value))} style={{ width: '100%', marginTop: 8 }} />
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
            Lower quality = smaller file. 0.7 is a good balance.<br />PNG inputs are converted to WebP for best compression.
          </p>
        </div>
      </div>

      <div className="action-bar">
        <div className="action-bar__left">
          <button className="button" onClick={() => fileInput.current.click()}>+ Add Images</button>
          <button className="button button--danger" onClick={clearAll}>🗑 Clear All</button>
        </div>
        <div className="action-bar__right">
          <span className="pdf-meta">{files.length} image{files.length !== 1 ? 's' : ''}</span>
          <button className="button button--generate" onClick={compress}>🗜️ Compress</button>
        </div>
      </div>

      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple style={{ display: 'none' }}
        onChange={(e) => { processFiles(e.target.files); e.target.value = ''; }} />
      {busy && <BusyOverlay text={busyProgress} />}
      <FormatError message={formatError} onDismiss={() => setFormatError(null)} />
    </div>
  );
}
