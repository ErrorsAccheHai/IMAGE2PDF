import { useState, useEffect } from 'react';
import {
  HashRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from 'react-router-dom';
import './App.css';

import ImageToPdf     from './tools/ImageToPdf';
import MergePdf       from './tools/MergePdf';
import SplitPdf       from './tools/SplitPdf';
import ReorderPdf     from './tools/ReorderPdf';
import WatermarkPdf   from './tools/WatermarkPdf';
import PdfToImages    from './tools/PdfToImages';
import ImageConverter from './tools/ImageConverter';
import CompressImages from './tools/CompressImages';
import CompressPdf    from './tools/CompressPdf';

const TOOLS = [
  {
    id: 'image-to-pdf',
    label: 'Image to PDF',
    icon: '🖼️',
    desc: 'Convert JPG, PNG, WebP images into a PDF document',
    group: 'PDF Tools',
    color: '#FF3D77',
    component: ImageToPdf,
  },
  {
    id: 'merge-pdf',
    label: 'Merge PDFs',
    icon: '🔗',
    desc: 'Combine multiple PDFs into a single file',
    group: 'PDF Tools',
    color: '#338AFF',
    component: MergePdf,
  },
  {
    id: 'split-pdf',
    label: 'Split PDF',
    icon: '✂️',
    desc: 'Split pages or extract a range from a PDF',
    group: 'PDF Tools',
    color: '#AF52DE',
    component: SplitPdf,
  },
  {
    id: 'reorder-pdf',
    label: 'Reorder / Delete',
    icon: '↕️',
    desc: 'Drag pages to reorder or remove them from a PDF',
    group: 'PDF Tools',
    color: '#FF9500',
    component: ReorderPdf,
  },
  {
    id: 'watermark-pdf',
    label: 'Watermark PDF',
    icon: '🔖',
    desc: 'Add watermark text or page numbers to your PDF',
    group: 'PDF Tools',
    color: '#34C759',
    component: WatermarkPdf,
  },
  {
    id: 'compress-pdf',
    label: 'Compress PDF',
    icon: '📉',
    desc: 'Reduce PDF file size by recompressing pages',
    group: 'PDF Tools',
    color: '#FF6B35',
    component: CompressPdf,
  },
  {
    id: 'pdf-to-images',
    label: 'PDF to Images',
    icon: '📷',
    desc: 'Export every PDF page as PNG or JPEG images',
    group: 'PDF Tools',
    color: '#5AC8FA',
    component: PdfToImages,
  },
  {
    id: 'image-convert',
    label: 'Image Converter',
    icon: '🔄',
    desc: 'Convert between PNG, JPEG, WebP + resize images',
    group: 'Image Tools',
    color: '#FF2D55',
    component: ImageConverter,
  },
  {
    id: 'compress-images',
    label: 'Compress Images',
    icon: '🗜️',
    desc: 'Shrink image file sizes with adjustable quality',
    group: 'Image Tools',
    color: '#FFCC00',
    component: CompressImages,
  },
];

/* ─── Liquid Glass Navbar ─────────────────────────────────────────────── */
function Navbar({ darkMode, setDarkMode }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const activePath = location.pathname; // e.g. "/" or "/image-to-pdf"

  useEffect(() => {
    const el = document.getElementById('scroll-root');
    if (!el) return;
    const handler = () => setScrolled(el.scrollTop > 40);
    el.addEventListener('scroll', handler);
    return () => el.removeEventListener('scroll', handler);
  }, []);

  const go = (path) => {
    navigate(path);
    setMenuOpen(false);
    document.getElementById('scroll-root')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''} ${darkMode ? 'dark' : ''}`}>
      <div className="navbar__inner">
        {/* Logo */}
        <button className="navbar__logo" onClick={() => go('/')}>
          <span className="navbar__logo-icon">🛠️</span>
          <span className="navbar__logo-text">PDF Tools</span>
        </button>

        {/* Desktop links */}
        <div className="navbar__links">
          <button
            className={`navbar__link ${activePath === '/' ? 'navbar__link--active' : ''}`}
            onClick={() => go('/')}
          >
            Home
          </button>
          {TOOLS.slice(0, 5).map(t => (
            <button
              key={t.id}
              className={`navbar__link ${activePath === `/${t.id}` ? 'navbar__link--active' : ''}`}
              onClick={() => go(`/${t.id}`)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="navbar__actions">
          <button className="navbar__theme-btn" onClick={() => setDarkMode(d => !d)} title="Toggle theme">
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button className="navbar__hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            <span /><span /><span />
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="navbar__mobile-menu">
          <button className="navbar__mobile-link" onClick={() => go('/')}>🏠 Home</button>
          {TOOLS.map(t => (
            <button key={t.id} className="navbar__mobile-link" onClick={() => go(`/${t.id}`)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}

/* ─── Hero Section ────────────────────────────────────────────────────── */
function HeroSection({ darkMode }) {
  const navigate = useNavigate();
  return (
    <section className={`hero ${darkMode ? 'dark' : ''}`}>
      <div className="hero__bg-orb hero__bg-orb--1" />
      <div className="hero__bg-orb hero__bg-orb--2" />
      <div className="hero__bg-orb hero__bg-orb--3" />

      <div className="hero__content">
        <div className="hero__badge">✨ 100% Free &amp; Private</div>
        <h1 className="hero__title">
          Turn Images into
          <span className="hero__title-gradient"> Perfect PDFs</span>
        </h1>
        <p className="hero__subtitle">
          Drag, drop, convert — everything runs in your browser.<br />
          No uploads, no servers, your files never leave your device.
        </p>
        <div className="hero__actions">
          <button className="hero__cta hero__cta--primary" onClick={() => navigate('/image-to-pdf')}>
            🖼️ Start Converting
          </button>
          <button className="hero__cta hero__cta--secondary" onClick={() => {
            document.getElementById('explore-section')?.scrollIntoView({ behavior: 'smooth' });
          }}>
            Explore All Tools ↓
          </button>
        </div>

        {/* Feature mini-card */}
        <div className="hero__feature-card">
          <div className="hero__feature-grid">
            {['JPG → PDF', 'PNG → PDF', 'WebP → PDF', 'Multi-page', 'Custom size', 'No signup'].map(f => (
              <span key={f} className="hero__feature-pill">✓ {f}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="hero__visual">
        <div className="hero__mockup">
          <div className="hero__mockup-header">
            <span /><span /><span />
          </div>
          <div className="hero__mockup-body">
            <div className="hero__mockup-dropzone">
              <div className="hero__mockup-icon">🖼️</div>
              <div className="hero__mockup-text">Drop images here</div>
              <div className="hero__mockup-sub">JPG, PNG, WebP supported</div>
              <div className="hero__mockup-btn">Choose Files</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Explore Section ─────────────────────────────────────────────────── */
function ExploreSection({ darkMode }) {
  const navigate = useNavigate();
  const groups = [...new Set(TOOLS.map(t => t.group))];

  return (
    <section id="explore-section" className={`explore ${darkMode ? 'dark' : ''}`}>
      <div className="explore__header">
        <div className="explore__badge">🚀 All Tools</div>
        <h2 className="explore__title">Explore Our Toolkit</h2>
        <p className="explore__subtitle">
          Everything runs locally in your browser — fast, private, and free.
        </p>
      </div>

      {groups.map(group => (
        <div key={group} className="explore__group">
          <h3 className="explore__group-title">{group}</h3>
          <div className="explore__grid">
            {TOOLS.filter(t => t.group === group).map(tool => (
              <button
                key={tool.id}
                className="explore__card"
                onClick={() => navigate(`/${tool.id}`)}
                style={{ '--card-accent': tool.color }}
              >
                <div className="explore__card-icon-wrap">
                  <span className="explore__card-icon">{tool.icon}</span>
                </div>
                <div className="explore__card-body">
                  <span className="explore__card-label">{tool.label}</span>
                  <span className="explore__card-desc">{tool.desc}</span>
                </div>
                <span className="explore__card-arrow">→</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/* ─── Footer ──────────────────────────────────────────────────────────── */
function Footer({ darkMode }) {
  return (
    <footer className={`footer ${darkMode ? 'dark' : ''}`}>
      <div className="footer__inner">
        <div className="footer__brand">
          <span className="footer__brand-icon">🛠️</span>
          <span className="footer__brand-name">PDF Tools</span>
          <p className="footer__brand-desc">
            Free, private, browser-based file tools.<br />
            No data ever leaves your device.
          </p>
          <div className="footer__badges">
            <span>🔒 No uploads</span>
            <span>🚫 No tracking</span>
            <span>✅ Open source</span>
          </div>
        </div>

        <div className="footer__col">
          <h4 className="footer__col-title">Tools</h4>
          <ul className="footer__links">
            {TOOLS.map(t => (
              <li key={t.id}>
                <span className="footer__link-text">{t.icon} {t.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer__col">
          <h4 className="footer__col-title">Connect</h4>
          <ul className="footer__links">
            <li>
              <a
                className="footer__link"
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                🐙 View on GitHub
              </a>
            </li>
            <li>
              <a
                className="footer__link"
                href="mailto:contact@pdftools.dev"
              >
                📧 Contact Developer
              </a>
            </li>
            <li>
              <a
                className="footer__link"
                href="https://github.com/issues/new"
                target="_blank"
                rel="noopener noreferrer"
              >
                💡 Suggest a Feature
              </a>
            </li>
            <li>
              <a
                className="footer__link"
                href="https://github.com/issues/new"
                target="_blank"
                rel="noopener noreferrer"
              >
                🐛 Report a Bug
              </a>
            </li>
          </ul>
        </div>

        <div className="footer__col">
          <h4 className="footer__col-title">Other Platforms</h4>
          <ul className="footer__links">
            <li>
              <a className="footer__link" href="https://github.com" target="_blank" rel="noopener noreferrer">
                🐙 GitHub
              </a>
            </li>
            <li>
              <a className="footer__link" href="https://npmjs.com" target="_blank" rel="noopener noreferrer">
                📦 NPM Package
              </a>
            </li>
            <li>
              <a className="footer__link" href="https://twitter.com" target="_blank" rel="noopener noreferrer">
                🐦 Twitter / X
              </a>
            </li>
            <li>
              <a className="footer__link" href="https://linkedin.com" target="_blank" rel="noopener noreferrer">
                💼 LinkedIn
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer__bottom">
        <span>© {new Date().getFullYear()} PDF Tools — Made with ❤️ for privacy</span>
        <span>Open source · No cookies · No analytics</span>
      </div>
    </footer>
  );
}

/* ─── Tool View (with back nav) ───────────────────────────────────────── */
function ToolView({ tool }) {
  const navigate = useNavigate();
  const ToolComponent = tool.component;
  return (
    <div className="tool-view">
      <div className="tool-view__bar">
        <button className="tool-view__back" onClick={() => navigate('/')}>← Back</button>
        <span className="tool-view__breadcrumb">
          🛠️ PDF Tools <span className="tool-view__sep">/</span> {tool.icon} {tool.label}
        </span>
      </div>
      <div className="tool-view__content">
        <ToolComponent />
      </div>
    </div>
  );
}

/* ─── Top Info Bar ────────────────────────────────────────────────────── */
function TopInfoBar({ darkMode }) {
  return (
    <div className={`top-info-bar ${darkMode ? 'dark' : ''}`}>
      <span>🔒 100% Private — files never leave your browser</span>
      <span className="top-info-bar__sep">·</span>
      <span>⚡ No signup required</span>
      <span className="top-info-bar__sep">·</span>
      <span>🌐 Works offline</span>
    </div>
  );
}

/* ─── App Root ────────────────────────────────────────────────────────── */
function AppInner() {
  const [darkMode, setDarkMode] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  return (
    <div className={`app-root ${darkMode ? 'app-dark' : 'app-light'}`}>
      <TopInfoBar darkMode={darkMode} />
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <Routes>
        <Route path="/" element={
          <div id="scroll-root" className="scroll-root">
            <HeroSection darkMode={darkMode} />
            <ExploreSection darkMode={darkMode} />
            <Footer darkMode={darkMode} />
          </div>
        } />
        {TOOLS.map(tool => (
          <Route
            key={tool.id}
            path={`/${tool.id}`}
            element={
              <div id="scroll-root" className="scroll-root">
                <ToolView tool={tool} />
              </div>
            }
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppInner />
    </HashRouter>
  );
}
