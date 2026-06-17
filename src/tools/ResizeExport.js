import { useState, useRef, useEffect } from 'react';
import { downloadBlob } from '../utils';
import BusyOverlay from '../components/BusyOverlay';

/* ── constants ──────────────────────────────────────────────────────────── */
const DPI = 96;
const CM  = 2.54;                       // cm per inch

const pxToCm = (px) => +(px / DPI * CM).toFixed(3);
const cmToPx = (cm) => Math.round((+cm / CM) * DPI);

const PRESETS = [
  { label: 'HD  720p',   w: 1280,  h: 720  },
  { label: 'FHD 1080p',  w: 1920,  h: 1080 },
  { label: '4K  2160p',  w: 3840,  h: 2160 },
  { label: 'A4 Print',   w: 2480,  h: 3508 },
  { label: 'A5 Print',   w: 1748,  h: 2480 },
  { label: 'Square 1:1', w: 1080,  h: 1080 },
  { label: 'Twitter/X',  w: 1500,  h: 500  },
  { label: 'Instagram',  w: 1080,  h: 1350 },
  { label: 'Thumbnail',  w: 1280,  h: 720  },
  { label: 'Favicon',    w: 64,    h: 64   },
  { label: 'Icon 512',   w: 512,   h: 512  },
  { label: 'Wallpaper',  w: 2560,  h: 1440 },
];

const FORMATS = [
  { mime: 'image/jpeg', ext: 'jpg',  label: 'JPEG' },
  { mime: 'image/png',  ext: 'png',  label: 'PNG'  },
  { mime: 'image/webp', ext: 'webp', label: 'WebP' },
];

// Validation limits
const PX_MIN  = 1;
const PX_MAX  = 16000;          // beyond this browsers/tools choke
const CM_MIN  = 0.026;          // ≈ 1px
const CM_MAX  = pxToCm(16000);
const WARN_PX_SMALL = 10;       // "this looks very tiny"
const WARN_PX_LARGE = 8000;     // "this is very large"

/* ── helpers ────────────────────────────────────────────────────────────── */
function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
  });
}

function validateDim(val, unit) {
  const n = parseFloat(val);
  if (isNaN(n) || n <= 0) return { ok: false, msg: 'Please enter a positive number.' };
  if (unit === 'px') {
    if (n < PX_MIN)  return { ok: false, msg: `Min is ${PX_MIN} px.` };
    if (n > PX_MAX)  return { ok: false, msg: `Max is ${PX_MAX} px (browser limit). Enter a smaller value.` };
    if (n < WARN_PX_SMALL) return { ok: true, warn: `${n} px is extremely small — your image may be invisible.` };
    if (n > WARN_PX_LARGE) return { ok: true, warn: `${n} px is very large — export may be slow and the file may be huge.` };
  } else {
    if (n < CM_MIN)  return { ok: false, msg: `Min is ${CM_MIN} cm.` };
    if (n > CM_MAX)  return { ok: false, msg: `Max is ${CM_MAX.toFixed(1)} cm. Enter a smaller value.` };
    const px = cmToPx(n);
    if (px < WARN_PX_SMALL) return { ok: true, warn: `${n} cm = ${px} px — extremely small.` };
    if (px > WARN_PX_LARGE) return { ok: true, warn: `${n} cm = ${px} px — very large file expected.` };
  }
  return { ok: true };
}

/* ── component ──────────────────────────────────────────────────────────── */
export default function ResizeExport() {
  /* file state */
  const [imgSrc,    setImgSrc]    = useState(null);
  const [origW,     setOrigW]     = useState(0);
  const [origH,     setOrigH]     = useState(0);
  const [fileName,  setFileName]  = useState('resized');
  const [dropActive, setDropActive] = useState(false);

  /* dimension state */
  const [unit,      setUnit]      = useState('px');    // 'px' | 'cm'
  const [lockRatio, setLockRatio] = useState(true);
  const [wVal,      setWVal]      = useState('');
  const [hVal,      setHVal]      = useState('');

  /* export state */
  const [format,    setFormat]    = useState('image/jpeg');
  const [quality,   setQuality]   = useState(92);      // 1-100
  const [busy,      setBusy]      = useState(false);

  /* validation */
  const [wErr,  setWErr]  = useState(null);   // { ok, msg, warn }
  const [hErr,  setHErr]  = useState(null);

  const fileInput = useRef();
  const canvasRef = useRef();

  /* preview canvas */
  useEffect(() => {
    if (!imgSrc || !canvasRef.current) return;
    const wPx = toPx(wVal, unit);
    const hPx = toPx(hVal, unit);
    if (!wPx || !hPx) return;
    const canvas = canvasRef.current;
    const MAX = 320;
    const scale = Math.min(MAX / wPx, MAX / hPx, 1);
    canvas.width  = Math.round(wPx * scale);
    canvas.height = Math.round(hPx * scale);
    loadImg(imgSrc).then(img => {
      const ctx = canvas.getContext('2d');
      if (format === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    });
  }, [imgSrc, wVal, hVal, unit, format]);

  /* ── helpers ── */
  function toPx(val, u) {
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0) return 0;
    return u === 'cm' ? cmToPx(n) : Math.round(n);
  }

  function toDisplay(px, u) {
    if (!px) return '';
    return u === 'cm' ? String(pxToCm(px)) : String(px);
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    loadImg(url).then(img => {
      setImgSrc(url);
      setOrigW(img.naturalWidth);
      setOrigH(img.naturalHeight);
      setWVal(toDisplay(img.naturalWidth, unit));
      setHVal(toDisplay(img.naturalHeight, unit));
      setFileName(file.name.replace(/\.[^.]+$/, '') || 'resized');
      setWErr(null); setHErr(null);
    });
  }

  /* ── dimension change handlers ── */
  function handleW(val) {
    setWVal(val);
    const v = validateDim(val, unit);
    setWErr(v);
    if (lockRatio && origW && origH && v.ok) {
      const px = toPx(val, unit);
      const newH = Math.round(px * origH / origW);
      const newHDisp = toDisplay(newH, unit);
      setHVal(newHDisp);
      setHErr(validateDim(newHDisp, unit));
    }
  }

  function handleH(val) {
    setHVal(val);
    const v = validateDim(val, unit);
    setHErr(v);
    if (lockRatio && origW && origH && v.ok) {
      const px = toPx(val, unit);
      const newW = Math.round(px * origW / origH);
      const newWDisp = toDisplay(newW, unit);
      setWVal(newWDisp);
      setWErr(validateDim(newWDisp, unit));
    }
  }

  /* ── unit switch ── */
  function switchUnit(u) {
    if (u === unit) return;
    const wPx = toPx(wVal, unit);
    const hPx = toPx(hVal, unit);
    setUnit(u);
    const nw = toDisplay(wPx, u);
    const nh = toDisplay(hPx, u);
    setWVal(nw); setHVal(nh);
    setWErr(nw ? validateDim(nw, u) : null);
    setHErr(nh ? validateDim(nh, u) : null);
  }

  /* ── preset ── */
  function applyPreset(p) {
    const nw = toDisplay(p.w, unit);
    const nh = toDisplay(p.h, unit);
    setWVal(nw); setHVal(nh);
    setLockRatio(false);   // preset overrides ratio
    setWErr(validateDim(nw, unit));
    setHErr(validateDim(nh, unit));
  }

  /* ── reset to original ── */
  function resetDims() {
    const nw = toDisplay(origW, unit);
    const nh = toDisplay(origH, unit);
    setWVal(nw); setHVal(nh);
    setLockRatio(true);
    setWErr(validateDim(nw, unit));
    setHErr(validateDim(nh, unit));
  }

  /* ── export ── */
  async function doExport() {
    const wPx = toPx(wVal, unit);
    const hPx = toPx(hVal, unit);
    const wv = validateDim(wVal, unit);
    const hv = validateDim(hVal, unit);
    setWErr(wv); setHErr(hv);
    if (!wv.ok || !hv.ok) return;

    setBusy(true);
    try {
      const img = await loadImg(imgSrc);
      const canvas = document.createElement('canvas');
      canvas.width = wPx; canvas.height = hPx;
      const ctx = canvas.getContext('2d');
      if (format === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, wPx, hPx); }
      ctx.drawImage(img, 0, 0, wPx, hPx);

      const ext = FORMATS.find(f => f.mime === format)?.ext || 'jpg';
      const q   = format === 'image/png' ? undefined : quality / 100;

      canvas.toBlob(blob => {
        downloadBlob(blob, `${fileName || 'resized'}.${ext}`);
        setBusy(false);
      }, format, q);
    } catch (e) {
      console.error(e);
      setBusy(false);
    }
  }

  const canExport = imgSrc && wErr?.ok && hErr?.ok;

  /* ── landing (no image yet) ── */
  if (!imgSrc) {
    return (
      <div className="tool-page">
        <div className="landing-hero">
          <div className="landing-icon-wrap">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none"
              stroke="url(#re-grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <defs>
                <linearGradient id="re-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#AF52DE"/>
                  <stop offset="100%" stopColor="#338AFF"/>
                </linearGradient>
              </defs>
              <path d="M15 3h6v6"/><path d="M9 21H3v-6"/>
              <path d="M21 3l-7 7"/><path d="M3 21l7-7"/>
            </svg>
          </div>
          <h2 className="landing-title">Resize &amp; Export</h2>
          <p className="landing-subtitle">
            Set exact dimensions in <strong>px</strong> or <strong>cm</strong>, pick a preset,
            and export as JPEG, PNG, or WebP.<br />
            Everything runs in your browser — no uploads.
          </p>
          <button className="big-btn" onClick={() => fileInput.current.click()}>
            Open Image
          </button>
        </div>

        <div
          className={`dropzone${dropActive ? ' dropzone--active' : ''}`}
          onDrop={e => { e.preventDefault(); setDropActive(false); loadFile(e.dataTransfer.files[0]); }}
          onDragOver={e => e.preventDefault()}
          onDragEnter={e => { e.preventDefault(); setDropActive(true); }}
          onDragLeave={() => setDropActive(false)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>or drop an image here (JPEG · PNG · WebP)</span>
        </div>

        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={e => { loadFile(e.target.files[0]); e.target.value = ''; }} />
      </div>
    );
  }

  /* ── working screen ── */
  return (
    <div className="tool-workspace">
      <div className="re-layout">

        {/* ── Left: preview ── */}
        <div className="re-preview-panel">
          <div className="re-preview-wrap">
            <canvas ref={canvasRef} className="re-canvas" />
          </div>
          <div className="re-info">
            <span className="re-info__label">Original</span>
            <span className="re-info__val">{origW} × {origH} px</span>
            <span className="re-info__sep">·</span>
            <span className="re-info__val">{pxToCm(origW)} × {pxToCm(origH)} cm</span>
          </div>
          <div className="re-actions-top">
            <button className="button" style={{ fontSize: 12 }}
              onClick={() => { setImgSrc(null); setOrigW(0); setOrigH(0); setWVal(''); setHVal(''); }}>
              ← Change image
            </button>
          </div>
        </div>

        {/* ── Right: controls ── */}
        <div className="re-controls">

          {/* Unit toggle */}
          <div className="re-section">
            <div className="re-section__title">Unit</div>
            <div className="opt-row">
              <div className={`opt-btn${unit === 'px' ? ' opt-btn--active' : ''}`} onClick={() => switchUnit('px')}>Pixels (px)</div>
              <div className={`opt-btn${unit === 'cm' ? ' opt-btn--active' : ''}`} onClick={() => switchUnit('cm')}>Centimetres (cm)</div>
            </div>
            {unit === 'cm' && (
              <p className="re-hint">Conversion uses 96 DPI. 1 cm ≈ {(DPI / CM).toFixed(1)} px.</p>
            )}
          </div>

          {/* Width / Height inputs */}
          <div className="re-section">
            <div className="re-section__title">Dimensions</div>
            <div className="re-dim-grid">
              <DimField label="Width"  unit={unit} value={wVal} onChange={handleW} err={wErr} />
              <div className="re-lock-col">
                <button
                  className={`re-lock-btn${lockRatio ? ' re-lock-btn--on' : ''}`}
                  title={lockRatio ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                  onClick={() => setLockRatio(l => !l)}
                >
                  {lockRatio ? <LockIcon /> : <UnlockIcon />}
                </button>
                {lockRatio && <span className="re-lock-label">Linked</span>}
              </div>
              <DimField label="Height" unit={unit} value={hVal} onChange={handleH} err={hErr} />
            </div>
            <button className="re-reset-btn" onClick={resetDims}>
              ↺ Reset to original
            </button>
          </div>

          {/* Presets */}
          <div className="re-section">
            <div className="re-section__title">Quick presets</div>
            <div className="re-presets">
              {PRESETS.map(p => (
                <button key={p.label} className="re-preset-btn" onClick={() => applyPreset(p)}>
                  <span className="re-preset-label">{p.label}</span>
                  <span className="re-preset-dim">{p.w}×{p.h}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Format & quality */}
          <div className="re-section">
            <div className="re-section__title">Export format</div>
            <div className="opt-row">
              {FORMATS.map(f => (
                <div key={f.mime} className={`opt-btn${format === f.mime ? ' opt-btn--active' : ''}`}
                  onClick={() => setFormat(f.mime)}>{f.label}</div>
              ))}
            </div>
            {format !== 'image/png' && (
              <div className="re-quality-row">
                <span>Quality</span>
                <div className="quality-controls">
                  <button className="quality-btn" onClick={() => setQuality(q => Math.max(1, q - 5))}>−</button>
                  <span className="quality-value">{quality}%</span>
                  <button className="quality-btn" onClick={() => setQuality(q => Math.min(100, q + 5))}>+</button>
                </div>
              </div>
            )}
          </div>

          {/* Filename */}
          <div className="re-section">
            <div className="re-section__title">Output filename</div>
            <div className="filename-row">
              <input className="filename-input" type="text" value={fileName}
                placeholder="resized" onChange={e => setFileName(e.target.value)} />
              <span className="filename-ext">.{FORMATS.find(f => f.mime === format)?.ext}</span>
            </div>
          </div>

          {/* Export button */}
          <button
            className="button button--generate re-export-btn"
            onClick={doExport}
            disabled={!canExport}
          >
            Export Image
          </button>

          {!canExport && wErr && !wErr.ok && (
            <p className="re-export-hint">Fix the errors above before exporting.</p>
          )}
        </div>
      </div>

      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={e => { loadFile(e.target.files[0]); e.target.value = ''; }} />

      {busy && <BusyOverlay text="Exporting…" />}
    </div>
  );
}

/* ── DimField sub-component ─────────────────────────────────────────────── */
function DimField({ label, unit, value, onChange, err }) {
  return (
    <div className="re-dim-field">
      <label className="re-dim-label">{label}</label>
      <div className="dim-input-wrap">
        <input
          className={`filename-input re-dim-input${err && !err.ok ? ' re-dim-input--err' : err?.warn ? ' re-dim-input--warn' : ''}`}
          type="number" min="0" step={unit === 'cm' ? '0.1' : '1'}
          placeholder={unit === 'px' ? 'e.g. 1920' : 'e.g. 21.0'}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <span className="filename-ext">{unit}</span>
      </div>
      {err && !err.ok  && <span className="re-field-err">{err.msg}</span>}
      {err &&  err.ok  && err.warn && <span className="re-field-warn">{err.warn}</span>}
    </div>
  );
}

/* ── tiny icons ── */
function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}
function UnlockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
    </svg>
  );
}
