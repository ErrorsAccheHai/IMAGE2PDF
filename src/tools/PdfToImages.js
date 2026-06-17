import React, { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { downloadBlob } from '../utils';
import BusyOverlay from '../components/BusyOverlay';
import FormatError from '../components/FormatError';

async function getPdfjsLib() {
  if (window.pdfjsLib) return window.pdfjsLib;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function PdfToImages() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [busyProgress, setBusyProgress] = useState('');
  const [dropzoneActive, setDropzoneActive] = useState(false);
  const [canvasDragOver, setCanvasDragOver] = useState(false);
  const [format, setFormat] = useState('image/png');
  const [scale, setScale] = useState(2);
  const [quality, setQuality] = useState(9);
  const [formatError, setFormatError] = useState(null);
  const fileInput = useRef();

  const loadFile = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFormatError('Only PDF files are accepted here. Please drop a .pdf file.');
      return;
    }
    setPdfFile(file);
    file.arrayBuffer().then((bytes) => PDFDocument.load(bytes).then((doc) => setPageCount(doc.getPageCount())));
  };

  const convert = async () => {
    try {
      setBusy(true); setBusyProgress('Loading PDF renderer…');
      const pdfjs = await getPdfjsLib();
      const bytes = await pdfFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      const total = pdf.numPages;
      for (let i = 1; i <= total; i++) {
        setBusyProgress(`Rendering page ${i} of ${total}…`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const ext = format === 'image/jpeg' ? 'jpg' : 'png';
        const q = format === 'image/jpeg' ? quality / 10 : undefined;
        const blob = await new Promise((res) => canvas.toBlob(res, format, q));
        downloadBlob(blob, `page-${i}.${ext}`);
        await new Promise((r) => setTimeout(r, 100));
      }
      setBusy(false);
    } catch (err) { console.error(err); setBusy(false); setBusyProgress(''); }
  };

  const optBtn = (label, active, onClick) => (
    <div className={`opt-btn${active ? ' opt-btn--active' : ''}`} onClick={onClick}>{label}</div>
  );

  // ── Landing ──
  if (!pdfFile) {
    return (
      <div className="tool-page">
        <div className="landing-hero">
          <div className="landing-icon">📷</div>
          <h2 className="landing-title">PDF to Images</h2>
          <p className="landing-subtitle">Convert every page of a PDF into PNG or JPEG images.<br />Rendered entirely in your browser.</p>
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

  const dpiLabel = { 1: '~72 DPI', 1.5: '~108 DPI', 2: '~144 DPI', 3: '~216 DPI' };

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
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
            📄 <strong>{pdfFile.name}</strong> — {pageCount} page{pageCount !== 1 ? 's' : ''}
          </p>
          <div className="info-card">
            <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7 }}>
              Each page will be saved as a separate image file. Your browser may ask to allow multiple downloads.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8, lineHeight: 1.7 }}>
              Output: <strong>{pageCount}</strong> image{pageCount !== 1 ? 's' : ''} in <strong>{format === 'image/png' ? 'PNG' : 'JPEG'}</strong> at <strong>{dpiLabel[scale] || scale * 72 + ' DPI'}</strong>
            </p>
          </div>
        </div>

        <div className="options" style={{ display: 'block' }}>
          <div className="options__header"><span>Convert Options</span></div>
          <div className="opt-label">Output format</div>
          <div className="opt-row">
            {optBtn('PNG',  format === 'image/png',  () => setFormat('image/png'))}
            {optBtn('JPEG', format === 'image/jpeg', () => setFormat('image/jpeg'))}
          </div>
          <div className="opt-label">Resolution</div>
          <div className="opt-row" style={{ flexDirection: 'column', gap: 4 }}>
            {[[1,'Low (~72 DPI)'],[1.5,'Medium (~108 DPI)'],[2,'High (~144 DPI)'],[3,'Very High (~216 DPI)']].map(([v,l]) => optBtn(l, scale === v, () => setScale(v)))}
          </div>
          {format === 'image/jpeg' && (<>
            <div className="opt-label">JPEG quality</div>
            <div className="quality-row">
              <span>Quality</span>
              <div className="quality-controls">
                <button className="quality-btn" onClick={() => quality > 1  && setQuality(quality - 1)}>−</button>
                <span className="quality-value">{(quality / 10).toFixed(1)}</span>
                <button className="quality-btn" onClick={() => quality < 10 && setQuality(quality + 1)}>+</button>
              </div>
            </div>
          </>)}
        </div>
      </div>

      <div className="action-bar">
        <div className="action-bar__left">
          <button className="button" onClick={() => fileInput.current.click()}>↩ Change File</button>
        </div>
        <div className="action-bar__right">
          <button className="button button--generate" onClick={convert}>⬇ Convert to Images</button>
        </div>
      </div>

      <input ref={fileInput} type="file" accept="application/pdf" style={{ display: 'none' }}
        onChange={(e) => { loadFile(e.target.files[0]); e.target.value = ''; }} />
      {busy && <BusyOverlay text={busyProgress} />}
      <FormatError message={formatError} onDismiss={() => setFormatError(null)} />
    </div>
  );
}
