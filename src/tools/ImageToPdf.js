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
      busy: false,
      busyProgress: '',
      dragOverId: null,
      canvasDragOver: false,
      dropzoneActive: false,
      fileName: 'output',
      formatError: null,
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

  estimateSize = () => {
    const b = this.state.images.length * 200 * 1024;
    return b < 1024 * 1024 ? (b / 1024).toFixed(0) + ' KB' : (b / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Validate + ingest files; return count of rejected files
  processFiles = (fileList) => {
    const imgArr = [];
    let rejected = 0;
    for (const f of fileList) {
      if (ACCEPTED.includes(f.type)) {
        imgArr.push({ id: uuidv4(), imgDataUrl: URL.createObjectURL(f), file: f, selected: false, rotation: 0 });
      } else {
        rejected++;
      }
    }
    if (imgArr.length) this.setState((s) => ({ images: [...s.images, ...imgArr] }));
    if (rejected > 0) {
      this.setState({ formatError: `Only JPEG, PNG, or WebP images are accepted. ${rejected} file${rejected > 1 ? 's' : ''} skipped.` });
    }
  };

  deletePage = (id) => this.setState((s) => ({ images: s.images.filter((i) => i.id !== id) }));
  clearAll = () => this.setState({ images: [] });
  rotatePage = (id, dir) => this.setState((s) => ({
    images: s.images.map((i) => i.id === id ? { ...i, rotation: ((i.rotation || 0) + dir + 360) % 360 } : i),
  }));

  handleCardDrop = (droppedId, currentId) => {
    if (droppedId === currentId) return;
    const arr = [...this.state.images];
    const di = arr.findIndex((i) => i.id === droppedId);
    const [dropped] = arr.splice(di, 1);
    arr.splice(arr.findIndex((i) => i.id === currentId), 0, dropped);
    this.setState({ images: arr, dragOverId: null });
  };

  createPdf = async () => {
    try {
      this.setState({ busy: true, busyProgress: 'Starting…' });
      const pdfDoc = await PDFDocument.create();
      const total = this.state.images.length;
      for (let i = 0; i < total; i++) {
        this.setState({ busyProgress: `Processing image ${i + 1} of ${total}…` });
        const entry = this.state.images[i];
        let pageSize = this.getPageSize();
        const res = await this.fetchImage(entry.imgDataUrl, this.state.compressImages ? this.state.imageQuality / 10 : undefined);
        const { arrayBuffer: raw, mime } = res;
        let jpegOrientation = 1;
        if (mime === 'image/jpeg') {
          try { const ex = EXIF.readFromBinaryFile(raw); if (ex.Orientation) jpegOrientation = ex.Orientation; } catch (_) {}
        }
        const img = await (mime === 'image/jpeg' ? pdfDoc.embedJpg(raw) : pdfDoc.embedPng(raw));
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

  render() {
    const { images, pageSize, pageMargin, pageOrientation, compressImages, imageQuality,
      forceShowOption, busy, busyProgress, dragOverId, canvasDragOver, dropzoneActive,
      fileName, formatError } = this.state;

    const previewH = 180;
    const previewW = Math.ceil(previewH * (pageSize !== Fit ? this.getAspectRatio() : 0.75));
    const optBtn = (label, active, onClick) => (
      <div className={`opt-btn${active ? ' opt-btn--active' : ''}`} onClick={onClick}>{label}</div>
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
        <div className="opt-label">Output filename</div>
        <div className="filename-row">
          <input className="filename-input" type="text" value={fileName} placeholder="output"
            onChange={(e) => this.setState({ fileName: e.target.value })} />
          <span className="filename-ext">.pdf</span>
        </div>
      </div>
    );

    // ── Landing ──
    if (images.length === 0) {
      return (
        <div className="tool-page">
          <div className="landing-hero">
            <div className="landing-icon">🖼️</div>
            <h2 className="landing-title">Image to PDF</h2>
            <p className="landing-subtitle">Convert JPEG, PNG, or WebP images into a PDF — entirely in your browser.<br />No uploads. No servers.</p>
            <button onClick={() => this.fileInput.current.click()} className="big-btn">Select Images</button>
          </div>
          <div
            className={`dropzone${dropzoneActive ? ' dropzone--active' : ''}`}
            onDrop={(e) => { e.preventDefault(); this.setState({ dropzoneActive: false }); this.processFiles(e.dataTransfer.files); }}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={(e) => { e.preventDefault(); this.setState({ dropzoneActive: true }); }}
            onDragLeave={() => this.setState({ dropzoneActive: false })}
          >
            <span className="dropzone-icon">⬆️</span>
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
          {/* Canvas area — also accepts drops for adding more images */}
          <div
            className="canvas-area"
            onClick={() => this.setState({ images: images.map((i) => ({ ...i, selected: false })) })}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={(e) => {
              e.preventDefault();
              // Only show overlay when dragging external files (not card reorder)
              if (e.dataTransfer.types.includes('Files')) this.setState({ canvasDragOver: true });
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) this.setState({ canvasDragOver: false });
            }}
            onDrop={(e) => {
              e.preventDefault();
              this.setState({ canvasDragOver: false });
              // If it has Files (not a card reorder), add them
              if (e.dataTransfer.types.includes('Files')) {
                this.processFiles(e.dataTransfer.files);
              }
            }}
          >
            {canvasDragOver && (
              <div className="canvas-drop-overlay">⬆️ Drop images to add</div>
            )}
            <div className="image-grid">
              {images.map((img, index) => (
                <div
                  key={img.id}
                  className={`image-card-wrapper${dragOverId === img.id ? ' card-drop-target' : ''}`}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', img.id); }}
                  onDrop={(e) => { e.stopPropagation(); e.preventDefault(); this.handleCardDrop(e.dataTransfer.getData('text/plain'), img.id); }}
                  onDragOver={(e) => { e.preventDefault(); this.setState({ dragOverId: img.id }); }}
                  onDragEnter={(e) => { e.preventDefault(); this.setState({ dragOverId: img.id }); }}
                  onDragLeave={() => this.setState({ dragOverId: null })}
                >
                  <div
                    className={`image-card${img.selected ? ' image-card--selected' : ''}`}
                    style={{ width: previewW + 'px', height: previewH + 'px' }}
                    onClick={(e) => { e.stopPropagation(); this.setState({ images: images.map((im) => ({ ...im, selected: im.id === img.id })) }); }}
                  >
                    <div className="image-card__thumb" style={{ backgroundImage: `url('${img.imgDataUrl}')`, transform: `rotate(${img.rotation || 0}deg)` }} />
                    <div className="image-card__badge">{index + 1}</div>
                    <div className="image-card__controls">
                      <button className="card-btn" title="Rotate left"  onClick={(e) => { e.stopPropagation(); this.rotatePage(img.id, -90); }}>↺</button>
                      <button className="card-btn card-btn--delete" title="Remove" onClick={(e) => { e.stopPropagation(); this.deletePage(img.id); }}>✕</button>
                      <button className="card-btn" title="Rotate right" onClick={(e) => { e.stopPropagation(); this.rotatePage(img.id,  90); }}>↻</button>
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
            <button className="button button--danger" onClick={this.clearAll}>🗑 Clear All</button>
          </div>
          <div className="action-bar__right">
            <span className="pdf-meta">{images.length} image{images.length !== 1 ? 's' : ''} · ~{this.estimateSize()}</span>
            <button className="button button--generate" onClick={this.createPdf}>⬇ Generate PDF</button>
          </div>
        </div>

        <input type="file" accept="image/png,image/jpeg,image/webp" ref={this.fileInput}
          onChange={() => this.processFiles(this.fileInput.current.files)} multiple style={{ display: 'none' }} />
        {busy && <BusyOverlay text={busyProgress} />}
        <FormatError message={formatError} onDismiss={() => this.setState({ formatError: null })} />
      </div>
    );
  }
}
