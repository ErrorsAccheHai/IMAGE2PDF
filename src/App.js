import './App.css';
import React from 'react';
import { PageSizes, PDFDocument, degrees } from 'pdf-lib';
import EXIF from 'exif-js';
import { polyfill } from 'mobile-drag-drop';
import { scrollBehaviourDragImageTranslateOverride } from 'mobile-drag-drop/scroll-behaviour';

polyfill({
  dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
});

window.addEventListener('touchmove', function () {});

const A4 = 'A4';
const Letter = 'US Letter';
const Fit = 'Same as Image';
const Portrait = 'Portrait';
const Landscape = 'Landscape';
const None = '0';
const Small = '20';
const Big = '50';

class App extends React.Component {
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
      dropzoneActive: false,
      fileName: 'file',
      darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    };
    this.fileInput = React.createRef();
  }

  componentDidMount() {
    this.darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.darkModeListener = (e) => this.setState({ darkMode: e.matches });
    this.darkModeQuery.addEventListener('change', this.darkModeListener);
  }

  componentWillUnmount() {
    this.darkModeQuery.removeEventListener('change', this.darkModeListener);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  getPageSize = () => {
    switch (this.state.pageSize) {
      case A4:
        if (this.state.pageOrientation === Portrait) return PageSizes.A4;
        return [...PageSizes.A4].reverse();
      case Letter:
        if (this.state.pageOrientation === Portrait) return PageSizes.Letter;
        return [...PageSizes.Letter].reverse();
      default:
        return undefined;
    }
  };

  getAspectRatio = () => {
    const ps = this.getPageSize();
    if (!ps) return 1;
    return ps[0] / ps[1];
  };

  loadImage = (objUrl) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = objUrl;
    });

  canvasToBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(resolve, 'image/jpeg', quality);
      } catch (err) {
        reject(err);
      }
    });
  }

  fetchImage = async (dataURL, quality) => {
    if (!quality) {
      const res = await fetch(dataURL);
      const raw = await res.arrayBuffer();
      return { arrayBuffer: raw, mime: res.headers.get('content-type') };
    }
    const img = await this.loadImage(dataURL);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height);
    const blob = await this.canvasToBlob(canvas, quality);
    const raw = await blob.arrayBuffer();
    return { arrayBuffer: raw, mime: 'image/jpeg' };
  };

  estimateSize = () => {
    const bytes = this.state.images.reduce((acc) => acc + 200 * 1024, 0);
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // ─── Actions ────────────────────────────────────────────────────────────────

  clearSelection = () => {
    this.setState((state) => ({
      images: state.images.map((img) => ({ ...img, selected: false })),
    }));
  };

  readfiles = async (fileList) => {
    const imgArr = [];
    for (let i = 0; i < fileList.length; i++) {
      const { type } = fileList[i];
      if (!['image/png', 'image/x-png', 'image/jpeg', 'image/webp'].includes(type)) continue;
      const imgDataUrl = window.URL.createObjectURL(fileList[i]);
      imgArr.push({
        id: this.uuidv4(),
        imgDataUrl,
        file: fileList[i],
        selected: false,
        rotation: 0,
      });
    }
    this.setState((state) => ({ images: [...state.images, ...imgArr] }));
  };

  deletePage = (id) => {
    this.setState((state) => ({
      images: state.images.filter((img) => img.id !== id),
    }));
  };

  clearAll = () => {
    this.setState({ images: [] });
  };

  rotatePage = (id, direction) => {
    this.setState((state) => ({
      images: state.images.map((img) =>
        img.id === id
          ? { ...img, rotation: ((img.rotation || 0) + direction + 360) % 360 }
          : img
      ),
    }));
  };

  handleDrop = (droppedId, currentId) => {
    if (droppedId === currentId) return;
    const arr = [...this.state.images];
    const droppedIndex = arr.findIndex((img) => img.id === droppedId);
    const [droppedImage] = arr.splice(droppedIndex, 1);
    const currentIndex = arr.findIndex((img) => img.id === currentId);
    arr.splice(currentIndex, 0, droppedImage);
    this.setState({ images: arr, dragOverId: null });
  };

  createPdf = async () => {
    let mime = '';
    try {
      this.setState({ busy: true, busyProgress: 'Starting…' });
      const pdfDoc = await PDFDocument.create();
      const total = this.state.images.length;

      for (let i = 0; i < total; i++) {
        this.setState({ busyProgress: `Processing image ${i + 1} of ${total}…` });
        const imageEntry = this.state.images[i];
        let pageSize = this.getPageSize();

        const res = await this.fetchImage(
          imageEntry.imgDataUrl,
          this.state.compressImages ? this.state.imageQuality / 10 : undefined
        );
        const raw = res.arrayBuffer;
        mime = res.mime;

        let jpegOrientation = 1;
        if (mime === 'image/jpeg') {
          try {
            const jpegExif = EXIF.readFromBinaryFile(raw);
            if (jpegExif['Orientation']) jpegOrientation = jpegExif['Orientation'];
          } catch (ex) {
            console.error(ex);
          }
        }

        const img = await (mime === 'image/jpeg' ? pdfDoc.embedJpg(raw) : pdfDoc.embedPng(raw));

        if (this.state.pageSize === Fit) {
          pageSize = [img.width, img.height];
        } else {
          if (jpegOrientation === 6 || jpegOrientation === 8) {
            pageSize = [pageSize[1], pageSize[0]];
          }
        }

        const page = pdfDoc.addPage(pageSize);

        if (this.state.pageSize === Fit) {
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        } else {
          const scaleFactor = Math.min(
            (page.getWidth() - this.state.pageMargin) / img.width,
            (page.getHeight() - this.state.pageMargin) / img.height
          );
          const dim = img.scale(scaleFactor);
          page.drawImage(img, {
            x: page.getWidth() / 2 - dim.width / 2,
            y: page.getHeight() / 2 - dim.height / 2,
            width: dim.width,
            height: dim.height,
          });
        }

        // Apply EXIF rotation
        let autoRotate = 0;
        switch (jpegOrientation) {
          case 6: autoRotate = 90; break;
          case 3: autoRotate = 180; break;
          case 8: autoRotate = 270; break;
          default: break;
        }
        // Apply manual rotation on top of EXIF
        const manualRotation = imageEntry.rotation || 0;
        const totalRotation = (autoRotate + manualRotation) % 360;
        if (totalRotation !== 0) page.setRotation(degrees(totalRotation));
      }

      this.setState({ busyProgress: 'Saving PDF…' });
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = (this.state.fileName.trim() || 'file') + '.pdf';
      link.click();
      this.setState({ busy: false, busyProgress: '' });
    } catch (err) {
      console.error(err);
      this.setState({ busy: false, busyProgress: '' });
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  render() {
    const { images, pageSize, pageMargin, pageOrientation, compressImages,
      imageQuality, forceShowOption, busy, busyProgress, dragOverId,
      dropzoneActive, fileName, darkMode } = this.state;

    const theme = darkMode ? 'app-dark' : 'app-light';

    // Thumbnail card dimensions
    const previewH = 180;
    const aspectRatio = pageSize !== Fit ? this.getAspectRatio() : 0.75;
    const previewW = Math.ceil(previewH * aspectRatio);

    // ── Landing page ──────────────────────────────────────────────────────────
    const landing = (
      <div className="landing-page">
        <div className="landing-hero">
          <div className="landing-icon">📄</div>
          <h1 className="landing-title">Image to PDF</h1>
          <p className="landing-subtitle">
            Convert JPEG, PNG, or WebP images to PDF — entirely on your device.
            <br />
            No uploads. No servers. No data leaves your browser.
          </p>
          <button onClick={() => this.fileInput.current.click()} className="big-btn">
            Select Images
          </button>
        </div>

        <div
          className={`dropzone${dropzoneActive ? ' dropzone--active' : ''}`}
          onDrop={(e) => {
            e.stopPropagation();
            e.preventDefault();
            this.setState({ dropzoneActive: false });
            this.readfiles(e.dataTransfer.files);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={(e) => { e.preventDefault(); this.setState({ dropzoneActive: true }); }}
          onDragLeave={() => this.setState({ dropzoneActive: false })}
        >
          <span className="dropzone-icon">⬆️</span>
          <span>or drop images here</span>
        </div>
      </div>
    );

    // ── Image grid ────────────────────────────────────────────────────────────
    const listView = (
      <div className="image-grid">
        {images.map((img, index) => (
          <div
            key={img.id}
            className={`image-card-wrapper${dragOverId === img.id ? ' card-drop-target' : ''}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', img.id);
            }}
            onDrop={(e) => {
              e.stopPropagation();
              e.preventDefault();
              this.handleDrop(e.dataTransfer.getData('text/plain'), img.id);
            }}
            onDragOver={(e) => { e.preventDefault(); this.setState({ dragOverId: img.id }); }}
            onDragEnter={(e) => { e.preventDefault(); this.setState({ dragOverId: img.id }); }}
            onDragLeave={() => this.setState({ dragOverId: null })}
          >
            <div
              className={`image-card${img.selected ? ' image-card--selected' : ''}`}
              style={{ width: previewW + 'px', height: previewH + 'px' }}
              onClick={(e) => {
                e.stopPropagation();
                this.setState({
                  images: images.map((im) => ({ ...im, selected: im.id === img.id })),
                });
              }}
            >
              {/* Thumbnail */}
              <div
                className="image-card__thumb"
                style={{
                  backgroundImage: `url('${img.imgDataUrl}')`,
                  transform: `rotate(${img.rotation || 0}deg)`,
                }}
              />

              {/* Page number badge */}
              <div className="image-card__badge">{index + 1}</div>

              {/* Hover controls */}
              <div className="image-card__controls">
                <button
                  className="card-btn"
                  title="Rotate left"
                  onClick={(e) => { e.stopPropagation(); this.rotatePage(img.id, -90); }}
                >↺</button>
                <button
                  className="card-btn card-btn--delete"
                  title="Remove"
                  onClick={(e) => { e.stopPropagation(); this.deletePage(img.id); }}
                >✕</button>
                <button
                  className="card-btn"
                  title="Rotate right"
                  onClick={(e) => { e.stopPropagation(); this.rotatePage(img.id, 90); }}
                >↻</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );

    // ── Option toggle button (shared helper) ──────────────────────────────────
    const optBtn = (label, active, onClick) => (
      <div className={`opt-btn${active ? ' opt-btn--active' : ''}`} onClick={onClick}>
        {label}
      </div>
    );

    // ── Options panel ─────────────────────────────────────────────────────────
    const optionStyle = forceShowOption ? { display: 'block' } : {};
    const options = (
      <div className="options" style={optionStyle}>
        <div className="options__header">
          <span>PDF Options</span>
          {forceShowOption && (
            <button className="close-btn" onClick={() => this.setState({ forceShowOption: false })}>✕</button>
          )}
        </div>

        <div className="opt-label">Page orientation</div>
        <div className="opt-row">
          {optBtn('Portrait', pageOrientation === Portrait, () => this.setState({ pageOrientation: Portrait }))}
          {optBtn('Landscape', pageOrientation === Landscape, () => this.setState({ pageOrientation: Landscape }))}
        </div>

        <div className="opt-label">Page size</div>
        <div className="opt-row">
          {optBtn('A4', pageSize === A4, () => this.setState({ pageSize: A4 }))}
          {optBtn('US Letter', pageSize === Letter, () => this.setState({ pageSize: Letter }))}
          {optBtn('Fit Image', pageSize === Fit, () => this.setState({ pageSize: Fit }))}
        </div>

        {pageSize !== Fit && (
          <>
            <div className="opt-label">Page margin</div>
            <div className="opt-row">
              {optBtn('None', pageMargin === None, () => this.setState({ pageMargin: None }))}
              {optBtn('Small', pageMargin === Small, () => this.setState({ pageMargin: Small }))}
              {optBtn('Large', pageMargin === Big, () => this.setState({ pageMargin: Big }))}
            </div>
          </>
        )}

        <div className="opt-label">Compression</div>
        <div className="opt-row">
          {optBtn('Compress', compressImages, () => this.setState({ compressImages: true }))}
          {optBtn('Original', !compressImages, () => this.setState({ compressImages: false }))}
        </div>

        {compressImages && (
          <div className="quality-row">
            <span>Image quality</span>
            <div className="quality-controls">
              <button
                className="quality-btn"
                onClick={() => imageQuality > 1 && this.setState({ imageQuality: imageQuality - 1 })}
              >−</button>
              <span className="quality-value">{(imageQuality / 10).toFixed(1)}</span>
              <button
                className="quality-btn"
                onClick={() => imageQuality < 10 && this.setState({ imageQuality: imageQuality + 1 })}
              >+</button>
            </div>
          </div>
        )}

        <div className="opt-label">Output filename</div>
        <div className="filename-row">
          <input
            className="filename-input"
            type="text"
            value={fileName}
            placeholder="file"
            onChange={(e) => this.setState({ fileName: e.target.value })}
          />
          <span className="filename-ext">.pdf</span>
        </div>
      </div>
    );

    // ── Action bar ────────────────────────────────────────────────────────────
    const actions = (
      <div className="action-bar">
        <div className="action-bar__left">
          <button
            className="option-btn button"
            onClick={() => this.setState({ forceShowOption: true })}
          >
            ⚙ Options
          </button>
          <button className="button" onClick={() => this.fileInput.current.click()}>
            + Add Images
          </button>
          <button className="button button--danger" onClick={this.clearAll}>
            🗑 Clear All
          </button>
        </div>
        <div className="action-bar__right">
          <span className="pdf-meta">
            {images.length} image{images.length !== 1 ? 's' : ''} · ~{this.estimateSize()}
          </span>
          <button className="button button--generate" onClick={this.createPdf}>
            ⬇ Generate PDF
          </button>
        </div>
      </div>
    );

    // ── Header ────────────────────────────────────────────────────────────────
    const pageHeader = (
      <div className="page-header">
        <span className="page-header__title">📄 Image to PDF</span>
        <button
          className="theme-toggle"
          title="Toggle dark mode"
          onClick={() => this.setState({ darkMode: !darkMode })}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
    );

    // ── Landing screen ────────────────────────────────────────────────────────
    if (images.length < 1) {
      return (
        <div className={`app-root ${theme}`}>
          {pageHeader}
          <input
            type="file"
            ref={this.fileInput}
            onChange={() => this.readfiles(this.fileInput.current.files)}
            multiple
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
          />
          {landing}
        </div>
      );
    }

    // ── Main screen ───────────────────────────────────────────────────────────
    return (
      <div className={`app-root ${theme}`}>
        {pageHeader}
        <div className="main-layout">
          <div className="canvas-area" onClick={this.clearSelection}>
            {listView}
            <div style={{ flex: 1 }} />
          </div>
          {options}
        </div>
        {actions}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          ref={this.fileInput}
          onChange={() => this.readfiles(this.fileInput.current.files)}
          multiple
          style={{ display: 'none' }}
        />

        {/* Busy overlay */}
        {busy && (
          <div className="busy-overlay">
            <div className="busy-spinner" />
            <div className="busy-text">{busyProgress}</div>
          </div>
        )}
      </div>
    );
  }
}

export default App;
