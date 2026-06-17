import { useState, useRef, useEffect, useCallback } from 'react';
import { downloadBlob } from '../utils';
import BusyOverlay from '../components/BusyOverlay';

/* ── Background presets ─────────────────────────────────────────────────── */
const SOLID_COLORS = [
  { label: 'White',       value: '#ffffff' },
  { label: 'Black',       value: '#000000' },
  { label: 'Light Gray',  value: '#f0f0f0' },
  { label: 'Dark Gray',   value: '#333333' },
  { label: 'Red',         value: '#e53935' },
  { label: 'Pink',        value: '#ec407a' },
  { label: 'Purple',      value: '#8e24aa' },
  { label: 'Indigo',      value: '#3949ab' },
  { label: 'Blue',        value: '#1e88e5' },
  { label: 'Cyan',        value: '#00acc1' },
  { label: 'Teal',        value: '#00897b' },
  { label: 'Green',       value: '#43a047' },
  { label: 'Lime',        value: '#c0ca33' },
  { label: 'Yellow',      value: '#fdd835' },
  { label: 'Orange',      value: '#fb8c00' },
  { label: 'Brown',       value: '#6d4c41' },
];

const GRADIENTS = [
  { label: 'Sunset',      stops: ['#ff6b6b', '#feca57'] },
  { label: 'Ocean',       stops: ['#0575e6', '#021b79'] },
  { label: 'Forest',      stops: ['#11998e', '#38ef7d'] },
  { label: 'Purple Rain', stops: ['#7b2ff7', '#f107a3'] },
  { label: 'Peach',       stops: ['#ffecd2', '#fcb69f'] },
  { label: 'Midnight',    stops: ['#0f0c29', '#302b63'] },
  { label: 'Aurora',      stops: ['#00c3ff', '#ffff1c'] },
  { label: 'Candy',       stops: ['#f953c6', '#b91d73'] },
  { label: 'Lush',        stops: ['#56ab2f', '#a8e063'] },
  { label: 'Dusk',        stops: ['#2c3e50', '#fd746c'] },
  { label: 'Aqua',        stops: ['#13547a', '#80d0c7'] },
  { label: 'Fire',        stops: ['#f12711', '#f5af19'] },
];

// Natural scenes drawn on canvas
const SCENES = [
  { label: 'Clear Sky',    id: 'sky'     },
  { label: 'Sunrise',      id: 'sunrise' },
  { label: 'Night Sky',    id: 'night'   },
  { label: 'Green Meadow', id: 'meadow'  },
  { label: 'Sandy Beach',  id: 'beach'   },
  { label: 'Deep Ocean',   id: 'ocean'   },
  { label: 'Snowy Field',  id: 'snow'    },
  { label: 'Desert',       id: 'desert'  },
];

function drawScene(ctx, id, w, h) {
  const g = (c1, c2, y1 = 0, y2 = h) => {
    const gr = ctx.createLinearGradient(0, y1, 0, y2);
    gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    return gr;
  };
  ctx.clearRect(0, 0, w, h);
  switch (id) {
    case 'sky':
      ctx.fillStyle = g('#87ceeb', '#e0f7fa'); ctx.fillRect(0, 0, w, h);
      // clouds
      drawCloud(ctx, w * 0.2, h * 0.2, w * 0.15);
      drawCloud(ctx, w * 0.65, h * 0.12, w * 0.12);
      break;
    case 'sunrise':
      ctx.fillStyle = g('#ff7043', '#ffcc02', 0, h * 0.6); ctx.fillRect(0, 0, w, h * 0.6);
      ctx.fillStyle = g('#ffcc02', '#ffe082', h * 0.6, h); ctx.fillRect(0, h * 0.6, w, h * 0.4);
      // sun
      ctx.beginPath(); ctx.arc(w * 0.5, h * 0.55, w * 0.07, 0, Math.PI * 2);
      ctx.fillStyle = '#fff176'; ctx.fill();
      break;
    case 'night':
      ctx.fillStyle = g('#0d1b2a', '#1b2a4a'); ctx.fillRect(0, 0, w, h);
      // stars
      for (let i = 0; i < 60; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h * 0.75, Math.random() * 1.5 + 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + Math.random() * 0.6) + ')';
        ctx.fill();
      }
      // moon
      ctx.beginPath(); ctx.arc(w * 0.8, h * 0.15, w * 0.055, 0, Math.PI * 2);
      ctx.fillStyle = '#fff9c4'; ctx.fill();
      break;
    case 'meadow':
      ctx.fillStyle = g('#87ceeb', '#b3e5fc', 0, h * 0.45); ctx.fillRect(0, 0, w, h * 0.45);
      ctx.fillStyle = g('#66bb6a', '#2e7d32', h * 0.45, h); ctx.fillRect(0, h * 0.45, w, h * 0.55);
      break;
    case 'beach':
      ctx.fillStyle = g('#81d4fa', '#b3e5fc', 0, h * 0.4); ctx.fillRect(0, 0, w, h * 0.4);
      ctx.fillStyle = g('#0288d1', '#29b6f6', h * 0.4, h * 0.6); ctx.fillRect(0, h * 0.4, w, h * 0.2);
      ctx.fillStyle = g('#ffe082', '#ffcc02', h * 0.6, h); ctx.fillRect(0, h * 0.6, w, h * 0.4);
      break;
    case 'ocean':
      ctx.fillStyle = g('#006994', '#001f3f'); ctx.fillRect(0, 0, w, h);
      // wave hint
      ctx.strokeStyle = 'rgba(100,200,255,0.25)'; ctx.lineWidth = h * 0.02;
      for (let y = h * 0.2; y < h; y += h * 0.18) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) ctx.lineTo(x, y + Math.sin(x / (w * 0.08)) * h * 0.02);
        ctx.stroke();
      }
      break;
    case 'snow':
      ctx.fillStyle = g('#e3f2fd', '#ffffff'); ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = g('#bbdefb', '#e1f5fe', h * 0.55, h); ctx.fillRect(0, h * 0.55, w, h * 0.45);
      // snowflakes
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h * 0.5, Math.random() * 2 + 1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
      }
      break;
    case 'desert':
      ctx.fillStyle = g('#87ceeb', '#ffcc80', 0, h * 0.5); ctx.fillRect(0, 0, w, h * 0.5);
      ctx.fillStyle = g('#ffb74d', '#e65100', h * 0.5, h); ctx.fillRect(0, h * 0.5, w, h * 0.5);
      // dune wave
      ctx.beginPath(); ctx.moveTo(0, h * 0.52);
      for (let x = 0; x <= w; x += 4) ctx.lineTo(x, h * 0.5 + Math.sin(x / (w * 0.15)) * h * 0.04);
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
      ctx.fillStyle = '#ef6c00'; ctx.fill();
      break;
    default: break;
  }
}

function drawCloud(ctx, cx, cy, r) {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  [[0, 0, r], [-r * 0.6, r * 0.2, r * 0.7], [r * 0.6, r * 0.2, r * 0.7],
   [-r * 0.3, r * 0.4, r * 0.6], [r * 0.3, r * 0.4, r * 0.6]].forEach(([dx, dy, rr]) => {
    ctx.beginPath(); ctx.arc(cx + dx, cy + dy, rr, 0, Math.PI * 2); ctx.fill();
  });
}

/* ── Blend modes for combining foreground + background ── */
const BLEND_MODES = [
  { label: 'Normal',    value: 'source-over' },
  { label: 'Multiply',  value: 'multiply'    },
  { label: 'Screen',    value: 'screen'      },
  { label: 'Overlay',   value: 'overlay'     },
  { label: 'Soft Light',value: 'soft-light'  },
];

const FORMATS = [
  { mime: 'image/png',  ext: 'png',  label: 'PNG'  },
  { mime: 'image/jpeg', ext: 'jpg',  label: 'JPEG' },
  { mime: 'image/webp', ext: 'webp', label: 'WebP' },
];

/* ── Component ──────────────────────────────────────────────────────────── */
export default function BgChanger() {
  const [imgSrc,     setImgSrc]     = useState(null);
  const [fileName,   setFileName]   = useState('bg-changed');
  const [dropActive, setDropActive] = useState(false);

  // background type: 'solid' | 'gradient' | 'scene' | 'custom'
  const [bgType,     setBgType]     = useState('solid');
  const [solidColor, setSolidColor] = useState('#ffffff');
  const [customColor,setCustomColor]= useState('#ffffff');
  const [gradientIdx,setGradientIdx]= useState(0);
  const [gradAngle,  setGradAngle]  = useState(135);
  const [sceneId,    setSceneId]    = useState('sky');
  const [blendMode,  setBlendMode]  = useState('source-over');
  const [opacity,    setOpacity]    = useState(100); // fg opacity 0-100
  const [format,     setFormat]     = useState('image/png');
  const [quality,    setQuality]    = useState(92);
  const [busy,       setBusy]       = useState(false);

  const fileInput  = useRef();
  const previewRef = useRef();

  /* ── redraw preview whenever anything changes ── */
  const redraw = useCallback(() => {
    const canvas = previewRef.current;
    if (!canvas || !imgSrc) return;

    function drawBg(ctx, w, h) {
      if (bgType === 'solid') {
        ctx.fillStyle = solidColor; ctx.fillRect(0, 0, w, h);
      } else if (bgType === 'custom') {
        ctx.fillStyle = customColor; ctx.fillRect(0, 0, w, h);
      } else if (bgType === 'gradient') {
        const g = GRADIENTS[gradientIdx];
        const rad = (gradAngle * Math.PI) / 180;
        const gr = ctx.createLinearGradient(0, 0, w * Math.cos(rad), h * Math.sin(rad));
        gr.addColorStop(0, g.stops[0]); gr.addColorStop(1, g.stops[1]);
        ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
      } else if (bgType === 'scene') {
        drawScene(ctx, sceneId, w, h);
      }
    }

    const MAX = 300;
    loadImg(imgSrc).then(img => {
      const ar = img.naturalWidth / img.naturalHeight;
      const pw = ar >= 1 ? MAX : Math.round(MAX * ar);
      const ph = ar >= 1 ? Math.round(MAX / ar) : MAX;
      canvas.width  = pw;
      canvas.height = ph;
      const ctx = canvas.getContext('2d');
      drawBg(ctx, pw, ph);
      ctx.globalAlpha = opacity / 100;
      ctx.globalCompositeOperation = blendMode;
      ctx.drawImage(img, 0, 0, pw, ph);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    });
  }, [imgSrc, bgType, solidColor, customColor, gradientIdx, gradAngle, sceneId, blendMode, opacity]);

  useEffect(() => { redraw(); }, [redraw]);

  function drawBackground(ctx, w, h) {
    if (bgType === 'solid') {
      ctx.fillStyle = solidColor; ctx.fillRect(0, 0, w, h);
    } else if (bgType === 'custom') {
      ctx.fillStyle = customColor; ctx.fillRect(0, 0, w, h);
    } else if (bgType === 'gradient') {
      const g = GRADIENTS[gradientIdx];
      const rad = (gradAngle * Math.PI) / 180;
      const x2 = w * Math.cos(rad), y2 = h * Math.sin(rad);
      const gr = ctx.createLinearGradient(0, 0, x2, y2);
      gr.addColorStop(0, g.stops[0]); gr.addColorStop(1, g.stops[1]);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    } else if (bgType === 'scene') {
      drawScene(ctx, sceneId, w, h);
    }
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    setFileName(file.name.replace(/\.[^.]+$/, '') + '-bg');
  }

  async function doExport() {
    setBusy(true);
    try {
      const img = await loadImg(imgSrc);
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      drawBackground(ctx, canvas.width, canvas.height);
      ctx.globalAlpha = opacity / 100;
      ctx.globalCompositeOperation = blendMode;
      ctx.drawImage(img, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      const ext = FORMATS.find(f => f.mime === format)?.ext || 'png';
      const q   = format === 'image/png' ? undefined : quality / 100;
      canvas.toBlob(blob => {
        downloadBlob(blob, `${fileName || 'bg-changed'}.${ext}`);
        setBusy(false);
      }, format, q);
    } catch (e) { console.error(e); setBusy(false); }
  }

  /* ── landing ── */
  if (!imgSrc) {
    return (
      <div className="tool-page">
        <div className="landing-hero">
          <div className="landing-icon-wrap">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none"
              stroke="url(#bg-grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <defs>
                <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#11998e"/>
                  <stop offset="100%" stopColor="#38ef7d"/>
                </linearGradient>
              </defs>
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <h2 className="landing-title">Background Changer</h2>
          <p className="landing-subtitle">
            Replace or layer a new background behind your image.<br />
            Choose a solid colour, gradient, or natural scene.<br />
            Runs entirely in your browser — no uploads.
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

        {/* Left: preview */}
        <div className="re-preview-panel">
          <div className="re-preview-wrap">
            <canvas ref={previewRef} className="re-canvas bg-canvas" />
          </div>
          <p className="re-hint" style={{ textAlign: 'center' }}>
            Live preview (scaled). Export uses full resolution.
          </p>
          <button className="button" style={{ fontSize: 12 }}
            onClick={() => setImgSrc(null)}>
            ← Change image
          </button>
        </div>

        {/* Right: controls */}
        <div className="re-controls">

          {/* Background type */}
          <div className="re-section">
            <div className="re-section__title">Background type</div>
            <div className="opt-row" style={{ flexWrap: 'wrap' }}>
              {[['solid','Solid Color'],['gradient','Gradient'],['scene','Natural Scene'],['custom','Custom Color']].map(([v,l]) => (
                <div key={v} className={`opt-btn${bgType === v ? ' opt-btn--active' : ''}`}
                  style={{ minWidth: 100 }} onClick={() => setBgType(v)}>{l}</div>
              ))}
            </div>
          </div>

          {/* Solid colors */}
          {bgType === 'solid' && (
            <div className="re-section">
              <div className="re-section__title">Choose color</div>
              <div className="bg-color-grid">
                {SOLID_COLORS.map(c => (
                  <button key={c.value}
                    className={`bg-swatch${solidColor === c.value ? ' bg-swatch--active' : ''}`}
                    style={{ background: c.value }}
                    title={c.label}
                    onClick={() => setSolidColor(c.value)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Custom color picker */}
          {bgType === 'custom' && (
            <div className="re-section">
              <div className="re-section__title">Pick any color</div>
              <div className="bg-custom-row">
                <input type="color" className="bg-color-picker"
                  value={customColor} onChange={e => setCustomColor(e.target.value)} />
                <span className="bg-hex-label">{customColor.toUpperCase()}</span>
                <input className="filename-input" type="text" maxLength={7}
                  value={customColor}
                  onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setCustomColor(e.target.value); }}
                  style={{ width: 100 }}
                />
              </div>
            </div>
          )}

          {/* Gradients */}
          {bgType === 'gradient' && (
            <div className="re-section">
              <div className="re-section__title">Choose gradient</div>
              <div className="bg-gradient-grid">
                {GRADIENTS.map((g, i) => (
                  <button key={g.label}
                    className={`bg-gradient-swatch${gradientIdx === i ? ' bg-swatch--active' : ''}`}
                    style={{ background: `linear-gradient(${gradAngle}deg, ${g.stops[0]}, ${g.stops[1]})` }}
                    title={g.label}
                    onClick={() => setGradientIdx(i)}
                  >
                    <span className="bg-swatch-label">{g.label}</span>
                  </button>
                ))}
              </div>
              <div className="re-quality-row" style={{ marginTop: 12 }}>
                <span>Angle</span>
                <div className="quality-controls">
                  <button className="quality-btn" onClick={() => setGradAngle(a => (a - 15 + 360) % 360)}>−</button>
                  <span className="quality-value">{gradAngle}°</span>
                  <button className="quality-btn" onClick={() => setGradAngle(a => (a + 15) % 360)}>+</button>
                </div>
              </div>
            </div>
          )}

          {/* Natural scenes */}
          {bgType === 'scene' && (
            <div className="re-section">
              <div className="re-section__title">Choose scene</div>
              <div className="bg-scene-grid">
                {SCENES.map(s => (
                  <SceneThumb key={s.id} scene={s} active={sceneId === s.id}
                    onClick={() => setSceneId(s.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Blend & Opacity */}
          <div className="re-section">
            <div className="re-section__title">Foreground blend</div>
            <div className="opt-row" style={{ flexWrap: 'wrap' }}>
              {BLEND_MODES.map(b => (
                <div key={b.value} className={`opt-btn${blendMode === b.value ? ' opt-btn--active' : ''}`}
                  style={{ minWidth: 80 }} onClick={() => setBlendMode(b.value)}>{b.label}</div>
              ))}
            </div>
            <div className="re-quality-row" style={{ marginTop: 10 }}>
              <span>Image opacity</span>
              <div className="quality-controls">
                <button className="quality-btn" onClick={() => setOpacity(o => Math.max(10, o - 10))}>−</button>
                <span className="quality-value">{opacity}%</span>
                <button className="quality-btn" onClick={() => setOpacity(o => Math.min(100, o + 10))}>+</button>
              </div>
            </div>
          </div>

          {/* Format */}
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
                placeholder="bg-changed" onChange={e => setFileName(e.target.value)} />
              <span className="filename-ext">.{FORMATS.find(f => f.mime === format)?.ext}</span>
            </div>
          </div>

          <button className="button button--generate re-export-btn" onClick={doExport}>
            Export Image
          </button>
        </div>
      </div>

      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={e => { loadFile(e.target.files[0]); e.target.value = ''; }} />
      {busy && <BusyOverlay text="Exporting…" />}
    </div>
  );
}

/* ── SceneThumb: mini canvas preview of a scene ── */
function SceneThumb({ scene, active, onClick }) {
  const ref = useRef();
  useEffect(() => {
    const c = ref.current; if (!c) return;
    c.width = 80; c.height = 54;
    drawScene(c.getContext('2d'), scene.id, 80, 54);
  }, [scene.id]);
  return (
    <button className={`bg-scene-btn${active ? ' bg-swatch--active' : ''}`} onClick={onClick}>
      <canvas ref={ref} className="bg-scene-canvas" />
      <span className="bg-scene-label">{scene.label}</span>
    </button>
  );
}

function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
  });
}
