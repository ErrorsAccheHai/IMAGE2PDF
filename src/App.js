import { useState, useEffect } from 'react';
import {
  HashRouter, Routes, Route,
  useNavigate, useLocation, Navigate,
} from 'react-router-dom';
import './App.css';
import { Icon } from './Icons';

import ImageToPdf     from './tools/ImageToPdf';
import MergePdf       from './tools/MergePdf';
import SplitPdf       from './tools/SplitPdf';
import ReorderPdf     from './tools/ReorderPdf';
import WatermarkPdf   from './tools/WatermarkPdf';
import PdfToImages    from './tools/PdfToImages';
import ImageConverter from './tools/ImageConverter';
import CompressImages from './tools/CompressImages';
import CompressPdf    from './tools/CompressPdf';
import ResizeExport   from './tools/ResizeExport';

const TOOLS = [
  { id: 'image-to-pdf',    label: 'Image to PDF',    icon: 'image',    desc: 'Convert JPG, PNG, WebP images into a PDF document',       group: 'PDF Tools',   color: '#FF3D77', component: ImageToPdf },
  { id: 'merge-pdf',       label: 'Merge PDFs',       icon: 'merge',    desc: 'Combine multiple PDFs into a single file',                 group: 'PDF Tools',   color: '#338AFF', component: MergePdf },
  { id: 'split-pdf',       label: 'Split PDF',        icon: 'split',    desc: 'Split pages or extract a range from a PDF',               group: 'PDF Tools',   color: '#AF52DE', component: SplitPdf },
  { id: 'reorder-pdf',     label: 'Reorder / Delete', icon: 'reorder',  desc: 'Drag pages to reorder or remove them from a PDF',         group: 'PDF Tools',   color: '#FF9500', component: ReorderPdf },
  { id: 'watermark-pdf',   label: 'Watermark PDF',    icon: 'watermark',desc: 'Add watermark text or page numbers to your PDF',          group: 'PDF Tools',   color: '#34C759', component: WatermarkPdf },
  { id: 'compress-pdf',    label: 'Compress PDF',     icon: 'compress', desc: 'Reduce PDF file size by recompressing pages',             group: 'PDF Tools',   color: '#FF6B35', component: CompressPdf },
  { id: 'pdf-to-images',   label: 'PDF to Images',    icon: 'camera',   desc: 'Export every PDF page as PNG or JPEG images',             group: 'PDF Tools',   color: '#5AC8FA', component: PdfToImages },
  { id: 'image-convert',   label: 'Image Converter',  icon: 'convert',      desc: 'Convert between PNG, JPEG, WebP + resize images',        group: 'Image Tools', color: '#FF2D55', component: ImageConverter },
  { id: 'compress-images', label: 'Compress Images',  icon: 'shrink',       desc: 'Shrink image file sizes with adjustable quality',        group: 'Image Tools', color: '#FFCC00', component: CompressImages },
  { id: 'resize-export',   label: 'Resize & Export',  icon: 'resizeExport', desc: 'Set exact px or cm dimensions and export as JPEG/PNG/WebP', group: 'Image Tools', color: '#AF52DE', component: ResizeExport },
];

/* ─── Top Info Bar ────────────────────────────────────────────────────── */
function TopInfoBar() {
  return (
    <div className="top-info-bar">
      <span><Icon name="lock" size={12} /> 100% Private — files never leave your browser</span>
      <span className="top-info-bar__sep">·</span>
      <span><Icon name="zap" size={12} /> No signup required</span>
      <span className="top-info-bar__sep">·</span>
      <span><Icon name="globe" size={12} /> Works offline</span>
    </div>
  );
}

/* ─── Liquid Glass Navbar ─────────────────────────────────────────────── */
function Navbar({ darkMode, setDarkMode }) {
  const [scrolled, setScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const navigate  = useNavigate();
  const location  = useLocation();
  const activePath = location.pathname;

  useEffect(() => {
    const el = document.getElementById('scroll-root');
    if (!el) return;
    const h = () => setScrolled(el.scrollTop > 40);
    el.addEventListener('scroll', h);
    return () => el.removeEventListener('scroll', h);
  }, []);

  // close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location]);

  const go = (path) => {
    navigate(path);
    document.getElementById('scroll-root')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {/* Overlay behind mobile menu */}
      {menuOpen && <div className="nav-overlay" onClick={() => setMenuOpen(false)} />}

      <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
        <div className="navbar__inner">
          <button className="navbar__logo" onClick={() => go('/')}>
            <Icon name="tool" size={20} color="url(#logo-grad)" />
            <span className="navbar__logo-text">PDF Tools</span>
          </button>

          <div className="navbar__links">
            <button className={`navbar__link ${activePath === '/' ? 'navbar__link--active' : ''}`} onClick={() => go('/')}>
              Home
            </button>
            {TOOLS.slice(0, 5).map(t => (
              <button key={t.id}
                className={`navbar__link ${activePath === `/${t.id}` ? 'navbar__link--active' : ''}`}
                onClick={() => go(`/${t.id}`)}>
                <Icon name={t.icon} size={13} />
                {t.label}
              </button>
            ))}
          </div>

          <div className="navbar__actions">
            <button className="navbar__theme-btn" onClick={() => setDarkMode(d => !d)} title="Toggle theme">
              <Icon name={darkMode ? 'sun' : 'moon'} size={17} />
            </button>
            <button className="navbar__hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
              <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div className={`nav-drawer ${menuOpen ? 'nav-drawer--open' : ''}`}>
        <div className="nav-drawer__header">
          <span className="nav-drawer__title">Menu</span>
          <button className="nav-drawer__close" onClick={() => setMenuOpen(false)}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <button className="nav-drawer__link" onClick={() => go('/')}>
          <Icon name="home" size={17} /> Home
        </button>
        <div className="nav-drawer__section">PDF Tools</div>
        {TOOLS.map(t => (
          <button key={t.id} className={`nav-drawer__link ${activePath === `/${t.id}` ? 'nav-drawer__link--active' : ''}`}
            onClick={() => go(`/${t.id}`)}>
            <span className="nav-drawer__icon" style={{ background: t.color + '22', color: t.color }}>
              <Icon name={t.icon} size={15} color={t.color} />
            </span>
            {t.label}
          </button>
        ))}
      </div>

      {/* SVG gradient def (reused across icons) */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF3D77" />
            <stop offset="100%" stopColor="#338AFF" />
          </linearGradient>
        </defs>
      </svg>
    </>
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
        <div className="hero__badge">
          <Icon name="star" size={12} color="#338AFF" /> 100% Free &amp; Private
        </div>
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
            <Icon name="image" size={17} color="white" /> Start Converting
          </button>
          <button className="hero__cta hero__cta--secondary" onClick={() =>
            document.getElementById('explore-section')?.scrollIntoView({ behavior: 'smooth' })}>
            Explore All Tools <Icon name="arrowDown" size={15} />
          </button>
        </div>
        <div className="hero__feature-card">
          <div className="hero__feature-grid">
            {['JPG → PDF', 'PNG → PDF', 'WebP → PDF', 'Multi-page', 'Custom size', 'No signup'].map(f => (
              <span key={f} className="hero__feature-pill">
                <Icon name="check" size={11} color="#34C759" /> {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="hero__visual">
        <div className="hero__mockup">
          <div className="hero__mockup-header"><span /><span /><span /></div>
          <div className="hero__mockup-body">
            <div className="hero__mockup-dropzone">
              <div className="hero__mockup-icon">
                <Icon name="upload" size={36} color="#338AFF" />
              </div>
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
        <div className="explore__badge"><Icon name="tool" size={12} color="#338AFF" /> All Tools</div>
        <h2 className="explore__title">Explore Our Toolkit</h2>
        <p className="explore__subtitle">Everything runs locally in your browser — fast, private, and free.</p>
      </div>
      {groups.map(group => (
        <div key={group} className="explore__group">
          <h3 className="explore__group-title">{group}</h3>
          <div className="explore__grid">
            {TOOLS.filter(t => t.group === group).map(tool => (
              <button key={tool.id} className="explore__card"
                onClick={() => navigate(`/${tool.id}`)} style={{ '--card-accent': tool.color }}>
                <div className="explore__card-icon-wrap" style={{ background: tool.color + '18' }}>
                  <Icon name={tool.icon} size={22} color={tool.color} />
                </div>
                <div className="explore__card-body">
                  <span className="explore__card-label">{tool.label}</span>
                  <span className="explore__card-desc">{tool.desc}</span>
                </div>
                <Icon name="arrowRight" size={16} color="var(--text-muted)" className="explore__card-arrow" />
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
          <div className="footer__brand-logo">
            <Icon name="tool" size={24} color="url(#logo-grad)" />
            <span className="footer__brand-name">PDF Tools</span>
          </div>
          <p className="footer__brand-desc">Free, private, browser-based file tools.<br />No data ever leaves your device.</p>
          <div className="footer__badges">
            <span><Icon name="lock" size={11} /> No uploads</span>
            <span><Icon name="shield" size={11} /> No tracking</span>
            <span><Icon name="github" size={11} /> Open source</span>
          </div>
        </div>

        <div className="footer__col">
          <h4 className="footer__col-title">Tools</h4>
          <ul className="footer__links">
            {TOOLS.map(t => (
              <li key={t.id}><span className="footer__link-text"><Icon name={t.icon} size={13} color={t.color} /> {t.label}</span></li>
            ))}
          </ul>
        </div>

        <div className="footer__col">
          <h4 className="footer__col-title">Connect</h4>
          <ul className="footer__links">
            <li><a className="footer__link" href="https://github.com/ErrorsAccheHai/IMAGE2PDF" target="_blank" rel="noopener noreferrer"><Icon name="github" size={13} /> View on GitHub</a></li>
            <li><a className="footer__link" href="mailto:contact@pdftools.dev"><Icon name="mail" size={13} /> Contact Developer</a></li>
            <li><a className="footer__link" href="https://github.com/ErrorsAccheHai/IMAGE2PDF/issues/new" target="_blank" rel="noopener noreferrer"><Icon name="lightbulb" size={13} /> Suggest a Feature</a></li>
            <li><a className="footer__link" href="https://github.com/ErrorsAccheHai/IMAGE2PDF/issues/new" target="_blank" rel="noopener noreferrer"><Icon name="bug" size={13} /> Report a Bug</a></li>
          </ul>
        </div>

        <div className="footer__col">
          <h4 className="footer__col-title">Other Platforms</h4>
          <ul className="footer__links">
            <li><a className="footer__link" href="https://github.com/ErrorsAccheHai/IMAGE2PDF" target="_blank" rel="noopener noreferrer"><Icon name="github" size={13} /> GitHub</a></li>
            <li><a className="footer__link" href="https://npmjs.com" target="_blank" rel="noopener noreferrer"><Icon name="package" size={13} /> NPM Package</a></li>
            <li><a className="footer__link" href="https://twitter.com" target="_blank" rel="noopener noreferrer"><Icon name="twitter" size={13} /> Twitter / X</a></li>
            <li><a className="footer__link" href="https://linkedin.com" target="_blank" rel="noopener noreferrer"><Icon name="linkedin" size={13} /> LinkedIn</a></li>
          </ul>
        </div>
      </div>
      <div className="footer__bottom">
        <span>© {new Date().getFullYear()} PDF Tools — Made with care for privacy</span>
        <span>Open source · No cookies · No analytics</span>
      </div>
    </footer>
  );
}

/* ─── Tool View ───────────────────────────────────────────────────────── */
function ToolView({ tool }) {
  const navigate = useNavigate();
  const ToolComponent = tool.component;
  return (
    <div className="tool-view">
      <div className="tool-view__bar">
        <button className="tool-view__back" onClick={() => navigate('/')}>
          <Icon name="arrowLeft" size={15} /> Back
        </button>
        <span className="tool-view__breadcrumb">
          <Icon name="tool" size={14} color="var(--text-muted)" />
          PDF Tools
          <span className="tool-view__sep">/</span>
          <Icon name={tool.icon} size={14} color={tool.color} />
          {tool.label}
        </span>
      </div>
      <div className="tool-view__content"><ToolComponent /></div>
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
      <TopInfoBar />
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
          <Route key={tool.id} path={`/${tool.id}`} element={
            <div id="scroll-root" className="scroll-root">
              <ToolView tool={tool} />
            </div>
          } />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return <HashRouter><AppInner /></HashRouter>;
}
