import React, { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { canvasToBlob, downloadBlob, formatBytes } from '../utils';
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

export default function CompressPdf() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [busyProgress, setBusyProgress] = useState('');
  const [dropzoneActive, setDropzoneActive] = useState(false);
  const [canvasDragOver, setCanvasDragOver] = useState(false);
  const [quality, setQuality] = useState(7);
  const [scale, setScale] = useState(1.5);
  const [fileName, setFileName] = useState('compressed');
  const [resultSize, setResultSize] = useState(null);
  const [formatError, setFormatError] = useState(null);
  const fileInput = useRef();

  const loadFile = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFormatError('Only PDF files are accepted here. Please drop a .pdf file.');
      return;
    }
    setPdfFile(file);
    setResultSize(null);
    file.arrayBuffer().then((bytes) => PDFDocument.load(bytes).then((doc) => setPageCount(doc.getPageCount())));
  };

  const compress = async () => {
    try {
      setBusy(true); setResultSize(null); setBusyProgress('Loading PDF renderer…');
      const pdfjs = await getPdfjsLib();
      const bytes = await pdfFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      const total = pdf.numPages;
      const newDoc = await PDFDocument.create();

      for (let i = 1; i <= total; i++) {
        setBusyProgress(`Compressing page ${i} of ${total}…`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        const blob = await canvasToBlob(canvas, 'image/jpeg', quality / 10);
        const jpegBytes = await blob.arrayBuffer();
        const jpegImg = await newDoc.embedJpg(jpegBytes);
        const newPage = newDoc.addPage([viewport.width, viewport.height]);
        newPage.drawImage(jpegImg, { x: 0, y: 0, width: viewport.width, height: viewport.height });
      }

      setBusyProgress('Saving…');
      const outBytes = await newDoc.save();
      setResultSize(outBytes.byteLength);
      downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), (fileName.trim() || 'compressed') + '.pdf');
      setBusy(false);
    } catch (err) { console.error(err); setBusy(false); }
  };

  const optBtn = (label, active, onClick) => (
    <div className={`opt-btn${active ? ' opt-btn--active' : ''}`} onClick={onClick}>{label}</div>
  );

  // ── Landing ──
  if (!pdfFile) {
    return (
      <div className="tool-page">
        <div className="landing-hero">
          <div className="landing-icon">📉</div>
          <h2 className="landing-title">Compress PDF</h2>
          <p className="landing-subtitle">Reduce PDF file size by re-rendering pages at lower quality.<br />Great for scanned PDFs. Runs in your browser.</p>
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

  const savings = resultSize != null ? pdfFile.size - resultSize : null;
  const pct = savings != null && pdfFile.size > 0 ? Math.round((savings / pdfFile.size) * 100) : null;

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
            📄 <strong>{pdfFile.name}</strong> — {pageCount} page{pageCount !== 1 ? 's' : ''} · {formatBytes(pdfFile.size)}
          </p>
          {resultSize !== null && (
            <div className="result-summary">
              <span className="result-summary__icon">{savings > 0 ? '✅' : 'ℹ️'}</span>
              {savings > 0
                ? <span>Compressed to <strong>{formatBytes(resultSize)}</strong> — saved {formatBytes(savings)} ({pct}%)</span>
                : <span>Output size: <strong>{formatBytes(resultSize)}</strong> (no reduction — try lower quality)</span>
              }
            </div>
          )}
          <div className="info-card" style={{ marginTop: 12 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7 }}>
              Re-renders each page to JPEG and rebuilds the PDF. Works best on image-heavy or scanned PDFs. Drop a new PDF on this area to switch files.
            </p>
          </div>
        </div>

        <div className="options" style={{ display: 'block' }}>
          <div className="options__header"><span>Compress Options</span></div>
          <div className="opt-label">Image quality</div>
          <div className="quality-row">
            <span>Quality</span>
            <div className="quality-controls">
              <button className="quality-btn" onClick={() => quality > 1  && setQuality(quality - 1)}>−</button>
              <span className="quality-value">{(quality / 10).toFixed(1)}</span>
              <button className="quality-btn" onClick={() => quality < 10 && setQuality(quality + 1)}>+</button>
            </div>
          </div>
          <input type="range" min="1" max="10" value={quality} onChange={(e) => setQuality(Number(e.target.value))} style={{ width: '100%', marginTop: 8 }} />
          <div className="opt-label">Resolution</div>
          <div className="opt-row" style={{ flexDirection: 'column', gap: 4 }}>
            {[[1,'Low (~72 DPI)'],[1.5,'Medium (~108 DPI)'],[2,'High (~144 DPI)']].map(([v,l]) => optBtn(l, scale === v, () => setScale(v)))}
          </div>
          <div className="opt-label" style={{ marginTop: 16 }}>Output filename</div>
          <div className="filename-row">
            <input className="filename-input" type="text" value={fileName} placeholder="compressed" onChange={(e) => setFileName(e.target.value)} />
            <span className="filename-ext">.pdf</span>
          </div>
        </div>
      </div>

      <div className="action-bar">
        <div className="action-bar__left">
          <button className="button" onClick={() => fileInput.current.click()}>↩ Change File</button>
        </div>
        <div className="action-bar__right">
          <button className="button button--generate" onClick={compress}>📉 Compress PDF</button>
        </div>
      </div>

      <input ref={fileInput} type="file" accept="application/pdf" style={{ display: 'none' }}
        onChange={(e) => { loadFile(e.target.files[0]); e.target.value = ''; }} />
      {busy && <BusyOverlay text={busyProgress} />}
      <FormatError message={formatError} onDismiss={() => setFormatError(null)} />
    </div>
  );
}
