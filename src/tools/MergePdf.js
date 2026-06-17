import React, { useState, useRef, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { uuidv4, downloadBlob } from '../utils';
import BusyOverlay from '../components/BusyOverlay';
import FormatError from '../components/FormatError';

const ACCEPTED = 'application/pdf';

export default function MergePdf() {
  const [files, setFiles] = useState([]);
  const [dragOverId, setDragOverId] = useState(null);
  const [canvasDragOver, setCanvasDragOver] = useState(false);
  const [dropzoneActive, setDropzoneActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyProgress, setBusyProgress] = useState('');
  const [fileName, setFileName] = useState('merged');
  const [formatError, setFormatError] = useState(null);
  const fileInput = useRef();

  const processFiles = useCallback((fileList) => {
    const arr = [];
    let rejected = 0;
    for (const f of fileList) {
      if (f.type === ACCEPTED || f.name.toLowerCase().endsWith('.pdf')) {
        arr.push({ id: uuidv4(), file: f, name: f.name, size: f.size });
      } else {
        rejected++;
      }
    }
    if (arr.length) setFiles((prev) => [...prev, ...arr]);
    if (rejected > 0) setFormatError(`Only PDF files are accepted. ${rejected} file${rejected > 1 ? 's' : ''} skipped.`);
  }, []);

  const removeFile = (id) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const clearAll = () => setFiles([]);

  const handleCardDrop = (droppedId, targetId) => {
    if (droppedId === targetId) return;
    const arr = [...files];
    const di = arr.findIndex((f) => f.id === droppedId);
    const [dropped] = arr.splice(di, 1);
    arr.splice(arr.findIndex((f) => f.id === targetId), 0, dropped);
    setFiles(arr);
    setDragOverId(null);
  };

  const merge = async () => {
    try {
      setBusy(true);
      const merged = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        setBusyProgress(`Merging file ${i + 1} of ${files.length}…`);
        const bytes = await files[i].file.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      }
      setBusyProgress('Saving PDF…');
      const pdfBytes = await merged.save();
      downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), (fileName.trim() || 'merged') + '.pdf');
      setBusy(false);
    } catch (err) { console.error(err); setBusy(false); }
  };

  const fmtSize = (b) => b < 1024 * 1024 ? (b / 1024).toFixed(0) + ' KB' : (b / (1024 * 1024)).toFixed(1) + ' MB';

  // ── Landing ──
  if (files.length === 0) {
    return (
      <div className="tool-page">
        <div className="landing-hero">
          <div className="landing-icon">🔗</div>
          <h2 className="landing-title">Merge PDFs</h2>
          <p className="landing-subtitle">Combine multiple PDF files into one. Drag to reorder before merging.<br />Everything stays in your browser.</p>
          <button onClick={() => fileInput.current.click()} className="big-btn">Select PDFs</button>
        </div>
        <div
          className={`dropzone${dropzoneActive ? ' dropzone--active' : ''}`}
          onDrop={(e) => { e.preventDefault(); setDropzoneActive(false); processFiles(e.dataTransfer.files); }}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={(e) => { e.preventDefault(); setDropzoneActive(true); }}
          onDragLeave={() => setDropzoneActive(false)}
        >
          <span className="dropzone-icon">⬆️</span>
          <span>or drop PDF files here</span>
        </div>
        <input ref={fileInput} type="file" accept="application/pdf" multiple style={{ display: 'none' }}
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
          onDrop={(e) => {
            e.preventDefault();
            setCanvasDragOver(false);
            if (e.dataTransfer.types.includes('Files')) processFiles(e.dataTransfer.files);
          }}
        >
          {canvasDragOver && <div className="canvas-drop-overlay">⬆️ Drop PDFs to add</div>}
          <div className="file-list">
            {files.map((f, idx) => (
              <div
                key={f.id}
                className={`file-row${dragOverId === f.id ? ' card-drop-target' : ''}`}
                draggable
                onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', f.id); }}
                onDrop={(e) => { e.stopPropagation(); e.preventDefault(); handleCardDrop(e.dataTransfer.getData('text/plain'), f.id); }}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(f.id); }}
                onDragEnter={(e) => { e.preventDefault(); setDragOverId(f.id); }}
                onDragLeave={() => setDragOverId(null)}
              >
                <span className="file-row__num">{idx + 1}</span>
                <span className="file-row__icon">📄</span>
                <span className="file-row__name">{f.name}</span>
                <span className="file-row__size">{fmtSize(f.size)}</span>
                <span className="file-row__drag-hint">⠿</span>
                <button className="card-btn card-btn--delete file-row__del" onClick={() => removeFile(f.id)} title="Remove">✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="options">
          <div className="options__header"><span>Merge Options</span></div>
          <div className="opt-label">Total files</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>{files.length} PDF{files.length !== 1 ? 's' : ''}</div>
          <div className="opt-label">Output filename</div>
          <div className="filename-row">
            <input className="filename-input" type="text" value={fileName} placeholder="merged" onChange={(e) => setFileName(e.target.value)} />
            <span className="filename-ext">.pdf</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.5 }}>
            Drag rows to reorder. Drop more PDFs anywhere on the list to add them.
          </p>
        </div>
      </div>

      <div className="action-bar">
        <div className="action-bar__left">
          <button className="button" onClick={() => fileInput.current.click()}>+ Add PDFs</button>
          <button className="button button--danger" onClick={clearAll}>🗑 Clear All</button>
        </div>
        <div className="action-bar__right">
          <button className="button button--generate" onClick={merge} disabled={files.length < 2}>🔗 Merge PDFs</button>
        </div>
      </div>

      <input ref={fileInput} type="file" accept="application/pdf" multiple style={{ display: 'none' }}
        onChange={(e) => { processFiles(e.target.files); e.target.value = ''; }} />
      {busy && <BusyOverlay text={busyProgress} />}
      <FormatError message={formatError} onDismiss={() => setFormatError(null)} />
    </div>
  );
}
