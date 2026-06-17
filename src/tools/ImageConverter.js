import React, { useState, useRef, useCallback } from 'react';
import { uuidv4, loadImage, canvasToBlob, downloadBlob, MIME_EXT } from '../utils';
import BusyOverlay from '../components/BusyOverlay';
import FormatError from '../components/FormatError';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/x-png'];

export default function ImageConverter() {
  const [files, setFiles] = useState([]);
  const [targetFormat, setTargetFormat] = useState('image/jpeg');
  const [quality, setQuality] = useState(9);
  const [maxWidth, setMaxWidth] = useState('');
  const [maxHeight, setMaxHeight] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyProgress, setBusyProgress] = useState('');
  const [dropzoneActive, setDropzoneActive] = useState(false);
  const [canvasDragOver, setCanvasDragOver] = useState(false);
  const [formatError, setFormatError] = useState(null);
  const fileInput = useRef();

  const processFiles = useCallback((fileList) => {
    const arr = [];
    let rejected = 0;
    for (const f of fileList) {
      if (ACCEPTED_TYPES.includes(f.type)) {
        arr.push({ id: uuidv4(), file: f, name: f.name, size: f.size, previewUrl: URL.createObjectURL(f) });
      } else {
        rejected++;
      }
    }
    if (arr.length) setFiles((prev) => [...prev, ...arr]);
    if (rejected > 0) setFormatError(`Only JPEG, PNG, or WebP images are accepted. ${rejected} file${rejected > 1 ? 's' : ''} skipped.`);
  }, []);

  const removeFile = (id) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const clearAll = () => { files.forEach((f) => URL.revokeObjectURL(f.previewUrl)); setFiles([]); };

  const convert = async () => {
    try {
      setBusy(true);
      const mw = maxWidth  ? parseInt(maxWidth,  10) : Infinity;
      const mh = maxHeight ? parseInt(maxHeight, 10) : Infinity;
      const ext = MIME_EXT[targetFormat] || 'jpg';
      const q = targetFormat === 'image/png' ? undefined : quality / 10;

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setBusyProgress(`Converting ${i + 1} of ${files.length}: ${f.name}…`);
        const img = await loadImage(f.previewUrl);
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > mw || h > mh) { const s = Math.min(mw / w, mh / h); w = Math.round(w * s); h = Math.round(h * s); }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (targetFormat === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        const blob = await canvasToBlob(canvas, targetFormat, q);
        downloadBlob(blob, `${f.name.replace(/\.[^.]+$/, '')}.${ext}`);
        await new Promise((r) => setTimeout(r, 80));
      }
      setBusy(false);
    } catch (err) { console.error(err); setBusy(false); }
  };

  const optBtn = (label, active, onClick) => (
    <div className={`opt-btn${active ? ' opt-btn--active' : ''}`} onClick={onClick}>{label}</div>
  );

  // ── Landing ──
  if (files.length === 0) {
    return (
      <div className="tool-page">
        <div className="landing-hero">
          <div className="landing-icon">🔄</div>
          <h2 className="landing-title">Image Converter</h2>
          <p className="landing-subtitle">Convert images between PNG, JPEG, and WebP. Resize while you're at it.<br />Everything runs in your browser.</p>
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
          <div className="image-grid">
            {files.map((f) => (
              <div key={f.id} className="image-card-wrapper">
                <div className="image-card" style={{ width: 140, height: 110 }}>
                  <div className="image-card__thumb" style={{ backgroundImage: `url('${f.previewUrl}')` }} />
                  <div className="image-card__controls">
                    <div /><button className="card-btn card-btn--delete" onClick={() => removeFile(f.id)} title="Remove">✕</button><div />
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="options" style={{ display: 'block' }}>
          <div className="options__header"><span>Convert Options</span></div>
          <div className="opt-label">Target format</div>
          <div className="opt-row">
            {optBtn('JPEG', targetFormat === 'image/jpeg', () => setTargetFormat('image/jpeg'))}
            {optBtn('PNG',  targetFormat === 'image/png',  () => setTargetFormat('image/png'))}
            {optBtn('WebP', targetFormat === 'image/webp', () => setTargetFormat('image/webp'))}
          </div>
          {targetFormat !== 'image/png' && (<>
            <div className="opt-label">Quality</div>
            <div className="quality-row">
              <span>Quality</span>
              <div className="quality-controls">
                <button className="quality-btn" onClick={() => quality > 1  && setQuality(quality - 1)}>−</button>
                <span className="quality-value">{(quality / 10).toFixed(1)}</span>
                <button className="quality-btn" onClick={() => quality < 10 && setQuality(quality + 1)}>+</button>
              </div>
            </div>
          </>)}
          <div className="opt-label">Max dimensions (optional)</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="filename-input" type="number" min="1" placeholder="Max W" value={maxWidth}  onChange={(e) => setMaxWidth(e.target.value)}  style={{ width: 80 }} />
            <span style={{ color: 'var(--text-muted)' }}>×</span>
            <input className="filename-input" type="number" min="1" placeholder="Max H" value={maxHeight} onChange={(e) => setMaxHeight(e.target.value)} style={{ width: 80 }} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Aspect ratio is preserved.</p>
        </div>
      </div>

      <div className="action-bar">
        <div className="action-bar__left">
          <button className="button" onClick={() => fileInput.current.click()}>+ Add Images</button>
          <button className="button button--danger" onClick={clearAll}>🗑 Clear All</button>
        </div>
        <div className="action-bar__right">
          <span className="pdf-meta">{files.length} image{files.length !== 1 ? 's' : ''}</span>
          <button className="button button--generate" onClick={convert}>🔄 Convert</button>
        </div>
      </div>

      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple style={{ display: 'none' }}
        onChange={(e) => { processFiles(e.target.files); e.target.value = ''; }} />
      {busy && <BusyOverlay text={busyProgress} />}
      <FormatError message={formatError} onDismiss={() => setFormatError(null)} />
    </div>
  );
}
