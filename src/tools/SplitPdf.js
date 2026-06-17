import React, { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { downloadBlob } from '../utils';
import BusyOverlay from '../components/BusyOverlay';
import FormatError from '../components/FormatError';

export default function SplitPdf() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [mode, setMode] = useState('individual');
  const [rangeInput, setRangeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyProgress, setBusyProgress] = useState('');
  const [dropzoneActive, setDropzoneActive] = useState(false);
  const [canvasDragOver, setCanvasDragOver] = useState(false);
  const [formatError, setFormatError] = useState(null);
  const fileInput = useRef();

  const loadFile = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFormatError('Only PDF files are accepted here. Please drop a .pdf file.');
      return;
    }
    setPdfFile(file);
    setSelectedPages(new Set());
    file.arrayBuffer().then((bytes) => PDFDocument.load(bytes).then((doc) => setPageCount(doc.getPageCount())));
  };

  const togglePage = (n) => setSelectedPages((prev) => {
    const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s;
  });
  const selectAll = () => setSelectedPages(new Set(Array.from({ length: pageCount }, (_, i) => i)));
  const selectNone = () => setSelectedPages(new Set());

  const parseRange = (str, max) => {
    const pages = new Set();
    str.split(',').forEach((part) => {
      const [a, b] = part.trim().split('-').map((x) => parseInt(x.trim(), 10) - 1);
      if (isNaN(a)) return;
      for (let i = Math.max(0, a); i <= Math.min(isNaN(b) ? a : b, max - 1); i++) pages.add(i);
    });
    return [...pages].sort((a, b) => a - b);
  };

  const splitIndividual = async () => {
    setBusy(true);
    const bytes = await pdfFile.arrayBuffer();
    const srcDoc = await PDFDocument.load(bytes);
    for (let i = 0; i < pageCount; i++) {
      setBusyProgress(`Saving page ${i + 1} of ${pageCount}…`);
      const doc = await PDFDocument.create();
      const [page] = await doc.copyPages(srcDoc, [i]);
      doc.addPage(page);
      downloadBlob(new Blob([await doc.save()], { type: 'application/pdf' }), `page-${i + 1}.pdf`);
      await new Promise((r) => setTimeout(r, 80));
    }
    setBusy(false);
  };

  const extractSelected = async () => {
    const indices = mode === 'range' ? parseRange(rangeInput, pageCount) : [...selectedPages].sort((a, b) => a - b);
    if (!indices.length) { setFormatError('No pages selected.'); return; }
    setBusy(true); setBusyProgress('Extracting pages…');
    const bytes = await pdfFile.arrayBuffer();
    const srcDoc = await PDFDocument.load(bytes);
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(srcDoc, indices);
    pages.forEach((p) => doc.addPage(p));
    downloadBlob(new Blob([await doc.save()], { type: 'application/pdf' }), 'extracted.pdf');
    setBusy(false);
  };

  const optBtn = (label, active, onClick) => (
    <div className={`opt-btn${active ? ' opt-btn--active' : ''}`} onClick={onClick}>{label}</div>
  );

  // ── Landing ──
  if (!pdfFile) {
    return (
      <div className="tool-page">
        <div className="landing-hero">
          <div className="landing-icon">✂️</div>
          <h2 className="landing-title">Split PDF</h2>
          <p className="landing-subtitle">Split a PDF into individual pages, or extract a specific range.<br />All processing happens locally.</p>
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

  // ── Working screen — drop a new PDF to replace ──
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
            📄 <strong>{pdfFile.name}</strong> — {pageCount} page{pageCount !== 1 ? 's' : ''}
          </p>

          {mode === 'individual' && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Each page will be saved as a separate PDF file.</p>
          )}
          {mode === 'range' && (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>Enter page range (e.g. <code>1-3, 5, 8-10</code>):</p>
              <input className="filename-input" style={{ maxWidth: 320 }} type="text" value={rangeInput} placeholder="1-3, 5, 8-10" onChange={(e) => setRangeInput(e.target.value)} />
            </div>
          )}
          {mode === 'extract' && (<>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button className="button" onClick={selectAll}>Select All</button>
              <button className="button button--danger" onClick={selectNone}>Deselect All</button>
              <span style={{ color: 'var(--text-muted)', fontSize: 13, alignSelf: 'center' }}>{selectedPages.size} selected</span>
            </div>
            <div className="page-grid">
              {Array.from({ length: pageCount }, (_, i) => (
                <div key={i} className={`page-thumb${selectedPages.has(i) ? ' page-thumb--selected' : ''}`} onClick={() => togglePage(i)}>
                  <span className="page-thumb__icon">📄</span>
                  <span className="page-thumb__label">Page {i + 1}</span>
                </div>
              ))}
            </div>
          </>)}
        </div>

        <div className="options">
          <div className="options__header"><span>Split Options</span></div>
          <div className="opt-label">Mode</div>
          <div className="opt-row" style={{ flexDirection: 'column' }}>
            {optBtn('Split All Pages', mode === 'individual', () => setMode('individual'))}
            {optBtn('By Page Range',   mode === 'range',      () => setMode('range'))}
            {optBtn('Pick Pages',      mode === 'extract',    () => setMode('extract'))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.5 }}>
            {mode === 'individual' && 'Downloads each page as a separate PDF.'}
            {mode === 'range'      && 'Extracts the given page range into one PDF.'}
            {mode === 'extract'    && 'Click pages to select, then extract them into one PDF.'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.5 }}>
            Drop a different PDF on the left to switch files.
          </p>
        </div>
      </div>

      <div className="action-bar">
        <div className="action-bar__left">
          <button className="button" onClick={() => fileInput.current.click()}>↩ Change File</button>
        </div>
        <div className="action-bar__right">
          {mode === 'individual'
            ? <button className="button button--generate" onClick={splitIndividual}>✂️ Split All Pages</button>
            : <button className="button button--generate" onClick={extractSelected}>⬇ Extract Pages</button>
          }
        </div>
      </div>

      <input ref={fileInput} type="file" accept="application/pdf" style={{ display: 'none' }}
        onChange={(e) => { loadFile(e.target.files[0]); e.target.value = ''; }} />
      {busy && <BusyOverlay text={busyProgress} />}
      <FormatError message={formatError} onDismiss={() => setFormatError(null)} />
    </div>
  );
}
