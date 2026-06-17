import React, { useState, useRef } from 'react';
import { PDFDocument, StandardFonts, degrees, rgb, grayscale } from 'pdf-lib';
import { downloadBlob } from '../utils';
import BusyOverlay from '../components/BusyOverlay';
import FormatError from '../components/FormatError';

export default function WatermarkPdf() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [busyProgress, setBusyProgress] = useState('');
  const [dropzoneActive, setDropzoneActive] = useState(false);
  const [canvasDragOver, setCanvasDragOver] = useState(false);
  const [fileName, setFileName] = useState('watermarked');
  const [formatError, setFormatError] = useState(null);

  const [mode, setMode] = useState('watermark');
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [opacity, setOpacity] = useState(20);
  const [rotation, setRotation] = useState(45);
  const [fontSize, setFontSize] = useState(48);
  const [pageNumPos, setPageNumPos] = useState('bottom-center');
  const [pageNumFormat, setPageNumFormat] = useState('Page {n} of {total}');

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

  const process = async () => {
    try {
      setBusy(true); setBusyProgress('Loading PDF…');
      const bytes = await pdfFile.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const total = doc.getPageCount();
      const alpha = opacity / 100;

      for (let i = 0; i < total; i++) {
        setBusyProgress(`Processing page ${i + 1} of ${total}…`);
        const page = doc.getPage(i);
        const { width, height } = page.getSize();

        if (mode === 'watermark') {
          const text = watermarkText || 'WATERMARK';
          const tw = font.widthOfTextAtSize(text, fontSize);
          const th = font.heightAtSize(fontSize);
          page.drawText(text, {
            x: width / 2 - tw / 2, y: height / 2 - th / 2,
            size: fontSize, font,
            color: grayscale(0.5), opacity: alpha, rotate: degrees(rotation),
          });
        } else {
          const text = pageNumFormat.replace('{n}', String(i + 1)).replace('{total}', String(total));
          const tw = font.widthOfTextAtSize(text, 12);
          const margin = 24;
          let x, y;
          switch (pageNumPos) {
            case 'bottom-left':  x = margin;              y = margin; break;
            case 'bottom-right': x = width - tw - margin; y = margin; break;
            case 'top-left':     x = margin;              y = height - margin - 12; break;
            case 'top-right':    x = width - tw - margin; y = height - margin - 12; break;
            default:             x = width / 2 - tw / 2;  y = margin; break;
          }
          page.drawText(text, { x, y, size: 12, font, color: rgb(0.2, 0.2, 0.2), opacity: 0.8 });
        }
      }
      setBusyProgress('Saving…');
      downloadBlob(new Blob([await doc.save()], { type: 'application/pdf' }), (fileName.trim() || 'output') + '.pdf');
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
          <div className="landing-icon">🔖</div>
          <h2 className="landing-title">Watermark / Page Numbers</h2>
          <p className="landing-subtitle">Add a text watermark or page numbers to every page of a PDF.<br />Everything runs in your browser.</p>
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
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
            📄 <strong>{pdfFile.name}</strong> — {pageCount} page{pageCount !== 1 ? 's' : ''}
          </p>
          <div className="preview-card">
            <div className="preview-card__demo">
              {mode === 'watermark'
                ? <div className="watermark-demo" style={{ transform: `rotate(${rotation}deg)`, opacity: opacity / 100, fontSize: Math.max(12, Math.min(fontSize, 32)) + 'px' }}>{watermarkText || 'WATERMARK'}</div>
                : <div className="pagenumber-demo"><span>{pageNumFormat.replace('{n}', '1').replace('{total}', String(pageCount))}</span></div>
              }
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 8 }}>Preview (approximate)</p>
          </div>
        </div>

        <div className="options" style={{ display: 'block' }}>
          <div className="options__header"><span>Options</span></div>
          <div className="opt-label">Type</div>
          <div className="opt-row">
            {optBtn('Watermark',    mode === 'watermark',    () => setMode('watermark'))}
            {optBtn('Page Numbers', mode === 'pagenumbers',  () => setMode('pagenumbers'))}
          </div>

          {mode === 'watermark' && (<>
            <div className="opt-label">Watermark text</div>
            <input className="filename-input" type="text" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} placeholder="CONFIDENTIAL" />
            <div className="opt-label">Font size</div>
            <div className="quality-row">
              <span>{fontSize}px</span>
              <div className="quality-controls">
                <button className="quality-btn" onClick={() => fontSize > 12  && setFontSize(fontSize - 4)}>−</button>
                <span className="quality-value">{fontSize}</span>
                <button className="quality-btn" onClick={() => fontSize < 120 && setFontSize(fontSize + 4)}>+</button>
              </div>
            </div>
            <div className="opt-label">Opacity ({opacity}%)</div>
            <input type="range" min="5" max="80" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} style={{ width: '100%' }} />
            <div className="opt-label">Rotation ({rotation}°)</div>
            <input type="range" min="-90" max="90" value={rotation} onChange={(e) => setRotation(Number(e.target.value))} style={{ width: '100%' }} />
          </>)}

          {mode === 'pagenumbers' && (<>
            <div className="opt-label">Format</div>
            <input className="filename-input" type="text" value={pageNumFormat} onChange={(e) => setPageNumFormat(e.target.value)} placeholder="Page {n} of {total}" />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Use {'{n}'} for page and {'{total}'} for total.</p>
            <div className="opt-label">Position</div>
            <div className="opt-row" style={{ flexDirection: 'column', gap: 4 }}>
              {[['bottom-center','Bottom Center'],['bottom-left','Bottom Left'],['bottom-right','Bottom Right'],['top-left','Top Left'],['top-right','Top Right']]
                .map(([v, l]) => optBtn(l, pageNumPos === v, () => setPageNumPos(v)))}
            </div>
          </>)}

          <div className="opt-label" style={{ marginTop: 20 }}>Output filename</div>
          <div className="filename-row">
            <input className="filename-input" type="text" value={fileName} placeholder="output" onChange={(e) => setFileName(e.target.value)} />
            <span className="filename-ext">.pdf</span>
          </div>
        </div>
      </div>

      <div className="action-bar">
        <div className="action-bar__left">
          <button className="button" onClick={() => fileInput.current.click()}>↩ Change File</button>
        </div>
        <div className="action-bar__right">
          <button className="button button--generate" onClick={process}>
            {mode === 'watermark' ? '🔖 Add Watermark' : '🔢 Add Page Numbers'}
          </button>
        </div>
      </div>

      <input ref={fileInput} type="file" accept="application/pdf" style={{ display: 'none' }}
        onChange={(e) => { loadFile(e.target.files[0]); e.target.value = ''; }} />
      {busy && <BusyOverlay text={busyProgress} />}
      <FormatError message={formatError} onDismiss={() => setFormatError(null)} />
    </div>
  );
}
