import React, { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { uuidv4, downloadBlob } from '../utils';
import BusyOverlay from '../components/BusyOverlay';
import FormatError from '../components/FormatError';

export default function ReorderPdf() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pages, setPages] = useState([]);
  const [dragOverId, setDragOverId] = useState(null);
  const [canvasDragOver, setCanvasDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyProgress, setBusyProgress] = useState('');
  const [dropzoneActive, setDropzoneActive] = useState(false);
  const [fileName, setFileName] = useState('reordered');
  const [formatError, setFormatError] = useState(null);
  const fileInput = useRef();

  const loadFile = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFormatError('Only PDF files are accepted here. Please drop a .pdf file.');
      return;
    }
    setPdfFile(file);
    file.arrayBuffer().then((bytes) =>
      PDFDocument.load(bytes).then((doc) =>
        setPages(Array.from({ length: doc.getPageCount() }, (_, i) => ({ id: uuidv4(), originalIndex: i, label: `Page ${i + 1}` })))
      )
    );
  };

  const removePage = (id) => setPages((prev) => prev.filter((p) => p.id !== id));

  const handleCardDrop = (droppedId, targetId) => {
    if (droppedId === targetId) return;
    const arr = [...pages];
    const di = arr.findIndex((p) => p.id === droppedId);
    const [dropped] = arr.splice(di, 1);
    arr.splice(arr.findIndex((p) => p.id === targetId), 0, dropped);
    setPages(arr);
    setDragOverId(null);
  };

  const save = async () => {
    try {
      setBusy(true); setBusyProgress('Loading PDF…');
      const bytes = await pdfFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(bytes);
      const doc = await PDFDocument.create();
      setBusyProgress('Reordering pages…');
      const copied = await doc.copyPages(srcDoc, pages.map((p) => p.originalIndex));
      copied.forEach((p) => doc.addPage(p));
      setBusyProgress('Saving…');
      downloadBlob(new Blob([await doc.save()], { type: 'application/pdf' }), (fileName.trim() || 'reordered') + '.pdf');
      setBusy(false);
    } catch (err) { console.error(err); setBusy(false); }
  };

  // ── Landing ──
  if (!pdfFile) {
    return (
      <div className="tool-page">
        <div className="landing-hero">
          <div className="landing-icon">↕️</div>
          <h2 className="landing-title">Reorder / Delete Pages</h2>
          <p className="landing-subtitle">Drag pages to reorder them or remove pages you don't need.<br />Works entirely in your browser.</p>
          <button onClick={() => fileInput.current.click()} className="big-btn">Select PDF</button>
        </div>
        <div
          className={`dropzone${dropzoneActive ? ' dropzone--active' : ''}`}
          onDrop={(e) => { e.preventDefault(); setDropzoneActive(false); loadFile(e.dataTransfer.files[0]); }}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={(e) => { e.preventDefault(); setDropzoneActive(true); }}
          onDragLeave={() => setDropzoneActive(false)}
        >
          <span className="dropzone-icon">⬆️</span>
          <span>or drop a PDF here</span>
        </div>
        <input ref={fileInput} type="file" accept="application/pdf" style={{ display: 'none' }}
          onChange={(e) => { loadFile(e.target.files[0]); e.target.value = ''; }} />
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
          onDrop={(e) => { e.preventDefault(); setCanvasDragOver(false); if (e.dataTransfer.types.includes('Files')) loadFile(e.dataTransfer.files[0]); }}
        >
          {canvasDragOver && <div className="canvas-drop-overlay">⬆️ Drop a PDF to replace</div>}
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12 }}>
            📄 <strong>{pdfFile.name}</strong> — {pages.length} page{pages.length !== 1 ? 's' : ''} remaining
          </p>
          <div className="file-list">
            {pages.map((page, idx) => (
              <div
                key={page.id}
                className={`file-row${dragOverId === page.id ? ' card-drop-target' : ''}`}
                draggable
                onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', page.id); }}
                onDrop={(e) => { e.stopPropagation(); e.preventDefault(); handleCardDrop(e.dataTransfer.getData('text/plain'), page.id); }}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(page.id); }}
                onDragEnter={(e) => { e.preventDefault(); setDragOverId(page.id); }}
                onDragLeave={() => setDragOverId(null)}
              >
                <span className="file-row__num">{idx + 1}</span>
                <span className="file-row__icon">📄</span>
                <span className="file-row__name">{page.label}</span>
                <span className="file-row__size" style={{ color: 'var(--text-muted)', fontSize: 12 }}>(originally page {page.originalIndex + 1})</span>
                <span className="file-row__drag-hint">⠿</span>
                <button className="card-btn card-btn--delete file-row__del" onClick={() => removePage(page.id)} title="Remove page">✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="options">
          <div className="options__header"><span>Page Options</span></div>
          <div className="opt-label">Output filename</div>
          <div className="filename-row">
            <input className="filename-input" type="text" value={fileName} placeholder="reordered" onChange={(e) => setFileName(e.target.value)} />
            <span className="filename-ext">.pdf</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.5 }}>
            Drag rows to reorder. Click ✕ to delete. Drop a new PDF on the left to switch files.
          </p>
        </div>
      </div>

      <div className="action-bar">
        <div className="action-bar__left">
          <button className="button" onClick={() => fileInput.current.click()}>↩ Change File</button>
        </div>
        <div className="action-bar__right">
          <span className="pdf-meta">{pages.length} page{pages.length !== 1 ? 's' : ''}</span>
          <button className="button button--generate" onClick={save} disabled={pages.length === 0}>⬇ Save PDF</button>
        </div>
      </div>

      <input ref={fileInput} type="file" accept="application/pdf" style={{ display: 'none' }}
        onChange={(e) => { loadFile(e.target.files[0]); e.target.value = ''; }} />
      {busy && <BusyOverlay text={busyProgress} />}
      <FormatError message={formatError} onDismiss={() => setFormatError(null)} />
    </div>
  );
}
