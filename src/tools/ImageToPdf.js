import React from 'react';
import { PDFDocument, PageSizes, degrees } from 'pdf-lib';
import EXIF from 'exif-js';
import { polyfill } from 'mobile-drag-drop';
import { scrollBehaviourDragImageTranslateOverride } from 'mobile-drag-drop/scroll-behaviour';
import { uuidv4, downloadBlob } from '../utils';
import BusyOverlay from '../components/BusyOverlay';
import FormatError from '../components/FormatError';

polyfill({ dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride });
window.addEventListener('touchmove', function () {});

const ACCEPTED = ['image/png', 'image/x-png', 'image/jpeg', 'image/webp'];
const A4 = 'A4', Letter = 'US Letter', Fit = 'Same as Image';
const Portrait = 'Portrait', Landscape = 'Landscape';
const None = '0', Small = '20', Big = '50';

// DPI for cm↔px conversion
const DPI = 96;
const CM_PER_INCH = 2.54;
const pxToCm = (px) => ((px / DPI) * CM_PER_INCH).toFixed(2);
const cmToPx = (cm) => Math.round((parseFloat(cm) / CM_PER_INCH) * DPI);

// Target file size presets (bytes)
const SIZE_PRESETS = [
  { label: 'Auto',   value: 0 },
  { label: '< 500 KB', value: 500 * 1024 },
  { label: '< 1 MB',  value: 1024 * 1024 },
  { label: '< 2 MB',  value: 2 * 1024 * 1024 },
  { label: '< 5 MB',  value: 5 * 1024 * 1024 },
];

export default class ImageToPdf extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      images: [],
      pageOrientation: Portrait,
      pageSize: A4,
      pageMargin: None,
      forceShowOption: false,
      compressImages: false,
      imageQuality: 8,
      // resize feature
      resizeEnabled: false,
      resizeUnit: 'px',       // 'px' | 'cm'
      resizeWidth: '',
      resizeHeight: '',
      resizeLock: true,       // lock aspect ratio
      // target size feature
      targetSizeIdx: 0,
      busy: false,
      busyProgress: '',
      dragOverId: null,
      canvasDragOver: false,
      dropzoneActive: false,
      fileName: 'output',
      formatError: null,
      editingId: null,        // which image is open in resize editor
    };
    this.fileInput = React.createRef();
  }

  getPageSize = () => {
    switch (this.state.pageSize) {
      case A4:     return this.state.pageOrientation === Portrait ? PageSizes.A4     : [...PageSizes.A4].reverse();
      case Letter: return this.state.pageOrientation === Portrait ? PageSizes.Letter : [...PageSizes.Letter].reverse();
      default:     return undefined;
    }
  };

  getAspectRatio = () => { const ps = this.getPageSize(); return ps ? ps[0] / ps[1] : 0.75; };

  loadImageEl = (src) => new Promise((res, rej) => {
    const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src;
  });

  canvasToBlob = (canvas, quality) => new Promise((res, rej) => {
    try { canvas.toBlob(res, 'image/jpeg', quality); } catch (e) { rej(e); }
  });

  fetchImage = async (dataURL, quality) => {
    if (!quality) {
      const r = await fetch(dataURL);
      return { arrayBuffer: await r.arrayBuffer(), mime: r.headers.get('content-type') };
    }
    const img = await this.loadImageEl(dataURL);
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    const blob = await this.canvasToBlob(c, quality);
    return { arrayBuffer: await blob.arrayBuffer(), mime: 'image/jpeg' };
  };

  /** Resize a dataURL to given pixel dimensions */
  resizeDataUrl = async (dataURL, targetW, targetH, quality) => {
    const img = await this.loadImageEl(dataURL);
    const c = document.createElement('canvas');
    c.width = targetW; c.height = targetH;
    c.getContext('2d').drawImage(img, 0, 0, targetW, targetH);
    const blob = await this.canvasToBlob(c, quality || 0.92);
    const ab = await blob.arrayBuffer();
    return { arrayBuffer: ab, mime: 'image/jpeg' };
  };

  estimateSize = () => {
    const b = this.state.images.length * 200 * 1024;
    return b < 1024 * 1024 ? (b / 1024).toFixed(0) + ' KB' : (b / (1024 * 1024)).toFixed(1) + ' MB';
  };

  processFiles = (fileList) => {
    const imgArr = [];
    let rejected = 0;
    for (const f of fileList) {
      if (ACCEPTED.includes(f.type)) {
        const img = new Image();
        const url = URL.createObjectURL(f);
        img.onload = () => {
          this.setState(s => ({
            images: s.images.map(i => i.imgDataUrl === url
              ? { ...i, naturalW: img.naturalWidth, naturalH: img.naturalHeight }
              : i)
          }));
        };
        img.src = url;
        imgArr.push({ id: uuidv4(), imgDataUrl: url, file: f, selected: false, rotation: 0,
          naturalW: 0, naturalH: 0,
          // per-image resize override
          customW: null, customH: null,
        });
      } else { rejected++; }
    }
    if (imgArr.length) this.setState(s => ({ images: [...s.images, ...imgArr] }));
    if (rejected > 0) this.setState({ formatError: `Only JPEG, PNG, or WebP images are accepted. ${rejected} file${rejected > 1 ? 's' : ''} skipped.` });
  };

  deletePage = (id) => this.setState(s => ({ images: s.images.filter(i => i.id !== id) }));
  clearAll   = () => this.setState({ images: [] });
  rotatePage = (id, dir) => this.setState(s => ({
    images: s.images.map(i => i.id === id ? { ...i, rotation: ((i.rotation || 0) + dir + 360) % 360 } : i),
  }));

  handleCardDrop = (droppedId, currentId) => {
    if (droppedId === currentId) return;
    const arr = [...this.state.images];
    const di = arr.findIndex(i => i.id === droppedId);
    const [dropped] = arr.splice(di, 1);
    arr.splice(arr.findIndex(i => i.id === currentId), 0, dropped);
    this.setState({ images: arr, dragOverId: null });
  };

  /** Quality needed to approximate targetBytes given current quality */
  binarySearchQuality = async (dataURL, targetBytes, low = 0.1, high = 0.95, depth = 0) => {
    if (depth > 8) return (low + high) / 2;
    const mid = (low + high) / 2;
    const img = await this.loadImageEl(dataURL);
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    const blob = await this.canvasToBlob(c, mid);
    if (blob.size <= targetBytes) return this.binarySearchQuality(dataURL, targetBytes, mid, high, depth + 1);
    return this.binarySearchQuality(dataURL, targetBytes, low, mid, depth + 1);
  };

  createPdf = async () => {
    try {
      this.setState({ busy: true, busyProgress: 'Starting…' });
      const { images, compressImages, imageQuality, resizeEnabled, resizeUnit,
        resizeWidth, resizeHeight, targetSizeIdx } = this.state;
      const targetBytes = SIZE_PRESETS[targetSizeIdx].value;
      const total = images.length;

      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < total; i++) {
        this.setState({ busyProgress: `Processing image ${i + 1} of ${total}…` });
        const entry = images[i];

        // ── Determine output pixel dimensions ──
        let outW = entry.customW || entry.naturalW;
        let outH = entry.customH || entry.naturalH;
        if (resizeEnabled && !entry.customW) {
          const wPx = resizeUnit === 'cm' ? cmToPx(parseFloat(resizeWidth) || 0) : (parseInt(resizeWidth, 10) || 0);
          const hPx = resizeUnit === 'cm' ? cmToPx(parseFloat(resizeHeight) || 0) : (parseInt(resizeHeight, 10) || 0);
          if (wPx > 0) outW = wPx;
          if (hPx > 0) outH = hPx;
        }

        let quality;
        if (targetBytes > 0) {
          // per-image budget: total budget / images
          const perBudget = targetBytes / total;
          quality = await this.binarySearchQuality(entry.imgDataUrl, perBudget);
        } else if (compressImages) {
          quality = imageQuality / 10;
        }

        let res;
        if (outW > 0 && outH > 0 && (outW !== entry.naturalW || outH !== entry.naturalH)) {
          res = await this.resizeDataUrl(entry.imgDataUrl, outW, outH, quality);
        } else {
          res = await this.fetchImage(entry.imgDataUrl, quality);
        }

        const { arrayBuffer: raw, mime } = res;
        let jpegOrientation = 1;
        if (mime === 'image/jpeg') {
          try { const ex = EXIF.readFromBinaryFile(raw); if (ex.Orientation) jpegOrientation = ex.Orientation; } catch (_) {}
        }
        const img = await (mime === 'image/jpeg' ? pdfDoc.embedJpg(raw) : pdfDoc.embedPng(raw));

        let pageSize = this.getPageSize();
        if (this.state.pageSize === Fit) {
          pageSize = [img.width, img.height];
        } else if (jpegOrientation === 6 || jpegOrientation === 8) {
          pageSize = [pageSize[1], pageSize[0]];
        }

        const page = pdfDoc.addPage(pageSize);
        const margin = parseInt(this.state.pageMargin, 10) * 2;
        if (this.state.pageSize === Fit) {
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        } else {
          const sf = Math.min((page.getWidth() - margin) / img.width, (page.getHeight() - margin) / img.height);
          const dim = img.scale(sf);
          page.drawImage(img, { x: page.getWidth() / 2 - dim.width / 2, y: page.getHeight() / 2 - dim.height / 2, width: dim.width, height: dim.height });
        }
        let autoRot = 0;
        if (jpegOrientation === 6) autoRot = 90; else if (jpegOrientation === 3) autoRot = 180; else if (jpegOrientation === 8) autoRot = 270;
        const total360 = (autoRot + (entry.rotation || 0)) % 360;
        if (total360) page.setRotation(degrees(total360));
      }

      this.setState({ busyProgress: 'Saving PDF…' });
      const pdfBytes = await pdfDoc.save();
      downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), (this.state.fileName.trim() || 'output') + '.pdf');
      this.setState({ busy: false, busyProgress: '' });
    } catch (err) {
      console.error(err);
      this.setState({ busy: false, busyProgress: '' });
    }
  };

  /* ── Per-image resize editor ── */
  openEditor = (img) => {
    this.setState({
      editingId: img.id,
      editW: String(img.customW || img.naturalW || ''),
      editH: String(img.customH || img.naturalH || ''),
      editUnit: 'px',
      editLock: true,
    });
  };

  applyEdit = () => {
    const { editingId, editW, editH, editUnit, images } = this.state;
    const wPx = editUnit === 'cm' ? cmToPx(editW) : parseInt(editW, 10);
    const hPx = editUnit === 'cm' ? cmToPx(editH) : parseInt(editH, 10);
    this.setState({
      images: images.map(i => i.id === editingId ? { ...i, customW: wPx || null, customH: hPx || null } : i),
      editingId: null,
    });
  };

  handleEditDim = (field, val) => {
    const { editLock, editW, editH, editUnit, images, editingId } = this.state;
    const img = images.find(i => i.id === editingId);
    const ratio = img && img.naturalH ? img.naturalW / img.naturalH : 1;
    const numVal = parseFloat(val);

    if (editLock && !isNaN(numVal) && numVal > 0) {
      if (field === 'editW') {
        const newH = editUnit === 'px' ? Math.round(numVal / ratio) : (numVal / ratio).toFixed(2);
        this.setState({ editW: val, editH: String(newH) });
      } else {
        const newW = editUnit === 'px' ? Math.round(numVal * ratio) : (numVal * ratio).toFixed(2);
        this.setState({ editH: val, editW: String(newW) });
      }
    } else {
      this.setState({ [field]: val });
    }
  };

  render() {
    const { images, pageSize, pageMargin, pageOrientation, compressImages, imageQuality,
      forceShowOption, busy, busyProgress, dragOverId, canvasDragOver, dropzoneActive,
      fileName, formatError, resizeEnabled, resizeUnit, resizeWidth, resizeHeight, resizeLock,
      targetSizeIdx, editingId, editW, editH, editUnit, editLock } = this.state;

    const previewH = 180;
    const previewW = Math.ceil(previewH * (pageSize !== Fit ? this.getAspectRatio() : 0.75));
    const optBtn = (label, active, onClick) => (
      <div className={`opt-btn${active ? ' opt-btn--active' : ''}`} onClick={onClick}>{label}</div>
    );

    /* ── Image resize editor modal ── */
    const editorImg = editingId ? images.find(i => i.id === editingId) : null;
    const editor = editorImg && (
      <div className="img-editor-overlay" onClick={() => this.setState({ editingId: null })}>
        <div className="img-editor" onClick={e => e.stopPropagation()}>
          <div className="img-editor__header">
            <span className="img-editor__title">Resize Image</span>
            <button className="close-btn" onClick={() => this.setState({ editingId: null })}>✕</button>
          </div>
          <div className="img-editor__preview">
            <img src={editorImg.imgDataUrl} alt="preview"
              style={{ maxWidth: '100%', maxHeight: '160px', objectFit: 'contain', borderRadius: 8 }} />
          </div>
          <div className="img-editor__natural">
            Original: {editorImg.naturalW} × {editorImg.naturalH} px
            ({pxToCm(editorImg.naturalW)} × {pxToCm(editorImg.naturalH)} cm)
          </div>

          <div className="opt-label">Unit</div>
          <div className="opt-row">
            {['px', 'cm'].map(u => (
              <div key={u} className={`opt-btn${editUnit === u ? ' opt-btn--active' : ''}`}
                onClick={() => {
                  if (u === editUnit) return;
                  const wPx = editUnit === 'cm' ? cmToPx(editW) : parseInt(editW, 10);
                  const hPx = editUnit === 'cm' ? cmToPx(editH) : parseInt(editH, 10);
                  this.setState({
                    editUnit: u,
                    editW: u === 'cm' ? pxToCm(wPx) : String(wPx || ''),
                    editH: u === 'cm' ? pxToCm(hPx) : String(hPx || ''),
                  });
                }}>{u}</div>
            ))}
          </div>

          <div className="opt-label">Dimensions</div>
          <div className="img-editor__dims">
            <div className="img-editor__dim-field">
              <label>Width</label>
              <div className="dim-input-wrap">
                <input type="number" className="filename-input" value={editW}
                  onChange={e => this.handleEditDim('editW', e.target.value)} />
                <span className="filename-ext">{editUnit}</span>
              </div>
            </div>
            <button className="img-editor__lock" title={editLock ? 'Unlock ratio' : 'Lock ratio'}
              onClick={() => this.setState({ editLock: !editLock })}>
              {editLock ? '🔒' : '🔓'}
            </button>
            <div className="img-editor__dim-field">
              <label>Height</label>
              <div className="dim-input-wrap">
                <input type="number" className="filename-input" value={editH}
                  onChange={e => this.handleEditDim('editH', e.target.value)} />
                <span className="filename-ext">{editUnit}</span>
              </div>
            </div>
          </div>

          <div className="img-editor__quick">
            {[[800,600],[1200,900],[1920,1080],[2480,3508]].map(([w,h]) => (
              <button key={w} className="opt-btn" style={{ minWidth: 80 }}
                onClick={() => this.setState({
                  editW: String(editUnit === 'cm' ? pxToCm(w) : w),
                  editH: String(editUnit === 'cm' ? pxToCm(h) : h),
                })}>
                {w}×{h}
              </button>
            ))}
          </div>

          <div className="img-editor__footer">
            <button className="button" onClick={() => this.setState({ editingId: null })}>Cancel</button>
            <button className="button button--generate" onClick={this.applyEdit}>Apply Resize</button>
          </div>
        </div>
      </div>
    );

    const options = (
      <div className="options" style={forceShowOption ? { display: 'block' } : {}}>
        <div className="options__header">
          <span>PDF Options</span>
          {forceShowOption && <button className="close-btn" onClick={() => this.setState({ forceShowOption: false })}>✕</button>}
        </div>

        <div className="opt-label">Page orientation</div>
        <div className="opt-row">
          {optBtn('Portrait',  pageOrientation === Portrait,  () => this.setState({ pageOrientation: Portrait }))}
          {optBtn('Landscape', pageOrientation === Landscape, () => this.setState({ pageOrientation: Landscape }))}
        </div>

        <div className="opt-label">Page size</div>
        <div className="opt-row">
          {optBtn('A4',       pageSize === A4,     () => this.setState({ pageSize: A4 }))}
          {optBtn('US Letter',pageSize === Letter, () => this.setState({ pageSize: Letter }))}
          {optBtn('Fit Image',pageSize === Fit,    () => this.setState({ pageSize: Fit }))}
        </div>

        {pageSize !== Fit && (<>
          <div className="opt-label">Page margin</div>
          <div className="opt-row">
            {optBtn('None',  pageMargin === None,  () => this.setState({ pageMargin: None }))}
            {optBtn('Small', pageMargin === Small, () => this.setState({ pageMargin: Small }))}
            {optBtn('Large', pageMargin === Big,   () => this.setState({ pageMargin: Big }))}
          </div>
        </>)}

        {/* ── Global resize ── */}
        <div className="opt-label">Resize all images</div>
        <div className="opt-row">
          {optBtn('Off', !resizeEnabled, () => this.setState({ resizeEnabled: false }))}
          {optBtn('On',  resizeEnabled,  () => this.setState({ resizeEnabled: true }))}
        </div>
        {resizeEnabled && (<>
          <div className="opt-row" style={{ marginTop: 6 }}>
            {['px', 'cm'].map(u => (
              <div key={u} className={`opt-btn${resizeUnit === u ? ' opt-btn--active' : ''}`}
                onClick={() => {
                  if (u === resizeUnit) return;
                  const wPx = resizeUnit === 'cm' ? cmToPx(resizeWidth) : parseInt(resizeWidth, 10);
                  const hPx = resizeUnit === 'cm' ? cmToPx(resizeHeight) : parseInt(resizeHeight, 10);
                  this.setState({
                    resizeUnit: u,
                    resizeWidth:  u === 'cm' ? pxToCm(wPx) : String(wPx || ''),
                    resizeHeight: u === 'cm' ? pxToCm(hPx) : String(hPx || ''),
                  });
                }}>{u}</div>
            ))}
          </div>
          <div className="img-editor__dims" style={{ marginTop: 8 }}>
            <div className="img-editor__dim-field">
              <label>W</label>
              <div className="dim-input-wrap">
                <input type="number" className="filename-input" placeholder="auto"
                  value={resizeWidth} onChange={e => {
                    const val = e.target.value;
                    if (resizeLock) {
                      this.setState({ resizeWidth: val });
                    } else {
                      this.setState({ resizeWidth: val });
                    }
                  }} />
                <span className="filename-ext">{resizeUnit}</span>
              </div>
            </div>
            <button className="img-editor__lock"
              onClick={() => this.setState({ resizeLock: !resizeLock })}>
              {resizeLock ? '🔒' : '🔓'}
            </button>
            <div className="img-editor__dim-field">
              <label>H</label>
              <div className="dim-input-wrap">
                <input type="number" className="filename-input" placeholder="auto"
                  value={resizeHeight} onChange={e => this.setState({ resizeHeight: e.target.value })} />
                <span className="filename-ext">{resizeUnit}</span>
              </div>
            </div>
          </div>
        </>)}

        {/* ── Target file size ── */}
        <div className="opt-label">Target PDF size</div>
        <div className="opt-row" style={{ flexWrap: 'wrap' }}>
          {SIZE_PRESETS.map((p, idx) => (
            <div key={p.label} className={`opt-btn${targetSizeIdx === idx ? ' opt-btn--active' : ''}`}
              style={{ minWidth: 64 }}
              onClick={() => this.setState({ targetSizeIdx: idx })}>
              {p.label}
            </div>
          ))}
        </div>
        {targetSizeIdx > 0 && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
            Quality will be auto-adjusted per image to fit the target. Result may vary slightly.
          </p>
        )}

        {/* ── Compression (manual) ── */}
        {targetSizeIdx === 0 && (<>
          <div className="opt-label">Compression</div>
          <div className="opt-row">
            {optBtn('Compress', compressImages,  () => this.setState({ compressImages: true }))}
            {optBtn('Original', !compressImages, () => this.setState({ compressImages: false }))}
          </div>
          {compressImages && (
            <div className="quality-row">
              <span>Image quality</span>
              <div className="quality-controls">
                <button className="quality-btn" onClick={() => imageQuality > 1  && this.setState({ imageQuality: imageQuality - 1 })}>−</button>
                <span className="quality-value">{(imageQuality / 10).toFixed(1)}</span>
                <button className="quality-btn" onClick={() => imageQuality < 10 && this.setState({ imageQuality: imageQuality + 1 })}>+</button>
              </div>
            </div>
          )}
        </>)}

        <div className="opt-label">Output filename</div>
        <div className="filename-row">
          <input className="filename-input" type="text" value={fileName} placeholder="output"
            onChange={e => this.setState({ fileName: e.target.value })} />
          <span className="filename-ext">.pdf</span>
        </div>
      </div>
    );

    // ── Landing ──
    if (images.length === 0) {
      return (
        <div className="tool-page">
          <div className="landing-hero">
            <div className="landing-icon-wrap">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="url(#lg1)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <defs>
                  <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FF3D77"/>
                    <stop offset="100%" stopColor="#338AFF"/>
                  </linearGradient>
                </defs>
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <h2 className="landing-title">Image to PDF</h2>
            <p className="landing-subtitle">Convert JPEG, PNG, or WebP images into a PDF — entirely in your browser.<br />No uploads. No servers.</p>
            <button onClick={() => this.fileInput.current.click()} className="big-btn">Select Images</button>
          </div>
          <div
            className={`dropzone${dropzoneActive ? ' dropzone--active' : ''}`}
            onDrop={(e) => { e.preventDefault(); this.setState({ dropzoneActive: false }); this.processFiles(e.dataTransfer.files); }}
            onDragOver={e => e.preventDefault()}
            onDragEnter={e => { e.preventDefault(); this.setState({ dropzoneActive: true }); }}
            onDragLeave={() => this.setState({ dropzoneActive: false })}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span>or drop images here (JPEG / PNG / WebP)</span>
          </div>
          <input type="file" ref={this.fileInput} onChange={() => this.processFiles(this.fileInput.current.files)}
            multiple accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} />
          <FormatError message={formatError} onDismiss={() => this.setState({ formatError: null })} />
        </div>
      );
    }

    // ── Working screen ──
    return (
      <div className="tool-workspace">
        <div className="main-layout">
          <div
            className="canvas-area"
            onClick={() => this.setState({ images: images.map(i => ({ ...i, selected: false })) })}
            onDragOver={e => e.preventDefault()}
            onDragEnter={e => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) this.setState({ canvasDragOver: true }); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) this.setState({ canvasDragOver: false }); }}
            onDrop={e => { e.preventDefault(); this.setState({ canvasDragOver: false }); if (e.dataTransfer.types.includes('Files')) this.processFiles(e.dataTransfer.files); }}
          >
            {canvasDragOver && <div className="canvas-drop-overlay">Drop images to add</div>}
            <div className="image-grid">
              {images.map((img, index) => (
                <div key={img.id}
                  className={`image-card-wrapper${dragOverId === img.id ? ' card-drop-target' : ''}`}
                  draggable
                  onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', img.id); }}
                  onDrop={e => { e.stopPropagation(); e.preventDefault(); this.handleCardDrop(e.dataTransfer.getData('text/plain'), img.id); }}
                  onDragOver={e => { e.preventDefault(); this.setState({ dragOverId: img.id }); }}
                  onDragEnter={e => { e.preventDefault(); this.setState({ dragOverId: img.id }); }}
                  onDragLeave={() => this.setState({ dragOverId: null })}
                >
                  <div
                    className={`image-card${img.selected ? ' image-card--selected' : ''}`}
                    style={{ width: previewW + 'px', height: previewH + 'px' }}
                    onClick={e => { e.stopPropagation(); this.setState({ images: images.map(im => ({ ...im, selected: im.id === img.id })) }); }}
                  >
                    <div className="image-card__thumb" style={{ backgroundImage: `url('${img.imgDataUrl}')`, transform: `rotate(${img.rotation || 0}deg)` }} />
                    {(img.customW || img.customH) && (
                      <div className="image-card__resize-badge">{img.customW}×{img.customH}</div>
                    )}
                    <div className="image-card__badge">{index + 1}</div>
                    <div className="image-card__controls">
                      <button className="card-btn" title="Rotate left"  onClick={e => { e.stopPropagation(); this.rotatePage(img.id, -90); }}>↺</button>
                      <button className="card-btn" title="Resize image" onClick={e => { e.stopPropagation(); this.openEditor(img); }}>⤢</button>
                      <button className="card-btn card-btn--delete" title="Remove" onClick={e => { e.stopPropagation(); this.deletePage(img.id); }}>✕</button>
                      <button className="card-btn" title="Rotate right" onClick={e => { e.stopPropagation(); this.rotatePage(img.id, 90); }}>↻</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {options}
        </div>

        <div className="action-bar">
          <div className="action-bar__left">
            <button className="option-btn button" onClick={() => this.setState({ forceShowOption: true })}>⚙ Options</button>
            <button className="button" onClick={() => this.fileInput.current.click()}>+ Add Images</button>
            <button className="button button--danger" onClick={this.clearAll}>Clear All</button>
          </div>
          <div className="action-bar__right">
            <span className="pdf-meta">{images.length} image{images.length !== 1 ? 's' : ''} · ~{this.estimateSize()}</span>
            <button className="button button--generate" onClick={this.createPdf}>Generate PDF</button>
          </div>
        </div>

        <input type="file" accept="image/png,image/jpeg,image/webp" ref={this.fileInput}
          onChange={() => this.processFiles(this.fileInput.current.files)} multiple style={{ display: 'none' }} />
        {busy && <BusyOverlay text={busyProgress} />}
        {editor}
        <FormatError message={formatError} onDismiss={() => this.setState({ formatError: null })} />
      </div>
    );
  }
}
