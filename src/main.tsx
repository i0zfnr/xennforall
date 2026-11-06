import { getLanguage, subscribeLanguage, setLanguage, t } from './i18n';
import { StrictMode, Suspense, lazy, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownToLine,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  Cpu,
  EyeOff,
  FileImage,
  Files,
  Film,
  Image,
  Layers,
  LockKeyhole,
  Maximize,
  Menu,
  Merge,
  Mic,
  Moon,
  PenTool,
  Plus,
  QrCode,
  RotateCw,
  Scan,
  Scissors,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Upload,
  Video,
  Volume2,
  VolumeX,
  X,
  Zap
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './style.css';
import brandIcon from './assets/icon.png';
import { FilePreview } from './FilePreview';
const NewTools = lazy(() => import('./NewTools'));
const BatchImages = lazy(() => import('./BatchImages'));
const StatusHdTool = lazy(() => import('./StatusHdTool'));
const TikTokTool = lazy(() => import('./TikTokTool'));
const LivePhotoTool = lazy(() => import('./LivePhotoTool'));
const PassportPhotoTool = lazy(() => import('./PassportPhotoTool'));
const SignPdfTool = lazy(() => import('./SignPdfTool'));
const ScanDocTool = lazy(() => import('./ScanDocTool'));
const RedactPdfTool = lazy(() => import('./RedactPdfTool'));
const AudioExtractTool = lazy(() => import('./AudioExtractTool'));
const ExifCleanerTool = lazy(() => import('./ExifCleanerTool'));
const CinematicStudioTool = lazy(() => import('./CinematicStudioTool'));
const FaceBlurTool = lazy(() => import('./FaceBlurTool'));
const QrStudioTool = lazy(() => import('./QrStudioTool'));
const AudioRecorderTool = lazy(() => import('./AudioRecorderTool'));
const VideoToGifTool = lazy(() => import('./VideoToGifTool'));

type Tool = {
  id: string;
  name: string;
  description: string;
  category: 'PDF tools' | 'Image tools';
  icon: LucideIcon;
  color: string;
  tag?: string;
  formats: string;
};

const tools: Tool[] = [
  { id: 'merge', name: 'Merge PDF', description: 'Bring your PDFs together. One file, perfectly in order.', category: 'PDF tools', icon: Merge, color: 'coral', tag: 'POPULAR', formats: 'PDF' },
  { id: 'split', name: 'Split PDF', description: 'Keep the pages you need. Leave the rest behind.', category: 'PDF tools', icon: Scissors, color: 'orange', formats: 'PDF' },
  { id: 'background', name: 'Remove background', description: 'Make your subject the star. Clean cutouts in a click.', category: 'Image tools', icon: Scissors, color: 'violet', tag: 'POPULAR', formats: 'PNG, JPG, WebP' },
  { id: 'batch', name: 'Batch images', description: 'Compress, resize, or convert multiple images at once.', category: 'Image tools', icon: Files, color: 'blue', tag: 'NEW', formats: 'JPG, PNG, WebP' },
  { id: 'number', name: 'Add page numbers', description: 'Add numbered pages to your PDF.', category: 'PDF tools', icon: FileImage, color: 'coral', tag: 'NEW', formats: 'PDF' },
  { id: 'compress', name: 'Compress image', description: 'Smaller files. Same big impression.', category: 'Image tools', icon: ArrowDownToLine, color: 'blue', formats: 'JPG, PNG, WebP' },
  { id: 'imagepdf', name: 'Image to PDF', description: 'Turn your JPGs and PNGs into a tidy PDF.', category: 'PDF tools', icon: FileImage, color: 'amber', formats: 'JPG, PNG, WebP' },
  { id: 'convert', name: 'Convert image', description: 'A fresh format. Convert to JPG, PNG, or WebP.', category: 'Image tools', icon: Image, color: 'teal', formats: 'PNG, JPG, WebP' },
  { id: 'rotate', name: 'Rotate PDF', description: 'Give your pages a turn in the right direction.', category: 'PDF tools', icon: RotateCw, color: 'rose', formats: 'PDF' },
  { id: 'pdfimage', name: 'PDF to image', description: 'Turn PDF pages into JPG or PNG images.', category: 'PDF tools', icon: FileImage, color: 'blue', tag: 'NEW', formats: 'PDF' },
  { id: 'organize', name: 'Organize PDF', description: 'Reorder, rotate, and remove pages visually.', category: 'PDF tools', icon: Layers, color: 'rose', tag: 'NEW', formats: 'PDF' },
  { id: 'crop', name: 'Crop image', description: 'Find the perfect frame for any image.', category: 'Image tools', icon: Scissors, color: 'teal', tag: 'NEW', formats: 'PNG, JPG, WebP' },
  { id: 'resize', name: 'Resize image', description: 'The perfect fit, wherever your image is going.', category: 'Image tools', icon: Maximize, color: 'green', formats: 'JPG, PNG, WebP' },
  { id: 'status_hd', name: 'WhatsApp Status HD', description: 'Prevent blurry status videos and photos with calibrated bitrate, 9:16 framing, and 30s clips.', category: 'Image tools', icon: Smartphone, color: 'green', tag: 'HOT', formats: 'MP4, MOV, JPG, PNG' },
  { id: 'tiktok', name: 'TikTok Saver', description: 'Download TikTok videos without watermark in HD, or extract audio MP3.', category: 'Image tools', icon: Video, color: 'rose', tag: 'HOT', formats: 'Link, MP4, MP3' },
  { id: 'livephoto', name: 'Video to Live Photo', description: 'Turn any video into an iPhone Live Photo, 9:16 motion wallpaper, or crisp cover frame.', category: 'Image tools', icon: Sparkles, color: 'violet', tag: 'NEW', formats: 'MP4, MOV, WebM' },
  { id: 'passport', name: 'Passport & IC Photo', description: 'Create official passport, IC, and visa photos with custom background and printable 4×6 sheet.', category: 'Image tools', icon: Camera, color: 'amber', tag: 'HOT', formats: 'JPG, PNG, WebP' },
  { id: 'signpdf', name: 'Sign & Watermark PDF', description: 'Sign agreements with digital signatures or stamp protective anti-fraud watermarks onto IC and document copies.', category: 'PDF tools', icon: PenTool, color: 'teal', tag: 'POPULAR', formats: 'PDF' },
  { id: 'scandoc', name: 'Scan & Clean Document', description: 'Straighten angled paper photos, remove yellow shadows, and generate clean PDF scans.', category: 'Image tools', icon: Scan, color: 'violet', tag: 'NEW', formats: 'JPG, PNG, PDF' },
  { id: 'redact', name: 'PDF Redactor', description: 'Permanently blackout confidential text, IC numbers, and private data.', category: 'PDF tools', icon: EyeOff, color: 'rose', tag: 'SECURITY', formats: 'PDF' },
  { id: 'audioextract', name: 'Video to Audio & Mute', description: 'Extract lossless master audio (WAV) from video clips or remove audio to export silent video.', category: 'Image tools', icon: Volume2, color: 'violet', tag: 'NEW', formats: 'MP4, MOV, WebM' },
  { id: 'exifcleaner', name: 'EXIF & Geotag Eraser', description: 'Inspect and wipe hidden GPS coordinates, device models, and timestamps from photos.', category: 'Image tools', icon: ShieldAlert, color: 'amber', tag: 'HOT', formats: 'JPG, PNG, WebP' },
  { id: 'cinematic', name: 'Cinematic Video Studio', description: 'Record video presentations with cinematic background blur and a floating teleprompter.', category: 'Image tools', icon: Camera, color: 'violet', tag: 'HOT', formats: 'Camera, MP4' },
  { id: 'faceblur', name: 'Face & Plate Blur', description: 'Pixelate or blur human faces, vehicle plates, and confidential details on photos.', category: 'Image tools', icon: EyeOff, color: 'rose', tag: 'PRIVACY', formats: 'JPG, PNG, WebP' },
  { id: 'qrstudio', name: 'Smart QR & Barcode Studio', description: 'Generate styled QR codes for Wi-Fi, WhatsApp, links, or scan barcodes via camera.', category: 'Image tools', icon: QrCode, color: 'coral', tag: 'NEW', formats: 'PNG, SVG, Camera' },
  { id: 'audiorecorder', name: 'Voice Memo & Audio Recorder', description: 'Record clean voice memos and speech with live acoustic rumble noise filtering.', category: 'Image tools', icon: Mic, color: 'teal', tag: 'NEW', formats: 'Mic, WAV' },
  { id: 'videotogif', name: 'Video to Animated GIF', description: 'Convert video clips into animated GIFs and meme stickers with captions.', category: 'Image tools', icon: Film, color: 'orange', tag: 'POPULAR', formats: 'MP4, MOV, WebM' }
];

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = new window.Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function App() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage);
  useEffect(() => {
    document.documentElement.lang = language === 'ms' ? 'ms' : 'en';
  }, [language]);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const stored = localStorage.getItem('xenn-theme');
      if (stored === 'light' || stored === 'dark') return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('xenn-theme', theme);
    } catch {}
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }

  const [category, setCategory] = useState('All tools');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<Tool | null>(null);
  const [initialFiles, setInitialFiles] = useState<File[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Hero Drop Zone State
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroDrag, setHeroDrag] = useState(false);
  const heroInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setInfo(null);
        setMobile(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const visible = tools.filter(
    (tool) =>
      (category === 'All tools' || tool.category === category) &&
      `${tool.name} ${tool.description} ${t(tool.name)} ${t(tool.description)}`.toLowerCase().includes(query.toLowerCase())
  );

  function openToolWithFiles(tool: Tool, files: File[]) {
    setInitialFiles(files);
    setActive(tool);
    setHeroFile(null);
  }

  function handleHeroFile(f: File | undefined) {
    if (!f) return;
    setHeroFile(f);
  }

  function browse(cat: string) {
    setCategory(cat);
    setMobile(false);
    document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' });
  }

  const isHeroPdf = heroFile && (heroFile.type === 'application/pdf' || heroFile.name.toLowerCase().endsWith('.pdf'));
  const isHeroVideo = heroFile && (heroFile.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|mkv)$/i.test(heroFile.name));

  return (
    <>
      <header>
        <div className="header-inner">
          <a className="brand" href="/" aria-label="Xenn for all home">
            <img src={brandIcon} alt="" className="brand-mark-img" width={34} height={34} />
            xenn<span className="brand-light">for all<span className="brand-dot">.</span></span>
          </a>

          <nav className={mobile ? 'nav open' : 'nav'}>
            <button onClick={() => browse('All tools')}>
              {t("All tools")}
              <ChevronDown size={14} />
            </button>
            <button onClick={() => browse('PDF tools')}>{t("PDF tools")}</button>
            <button onClick={() => browse('Image tools')}>{t("Image tools")}</button>
            <button onClick={() => setInfo('How it works')}>{t("How it works")}</button>
            <button onClick={() => setInfo('About Xenn for all')}>{t("About")}</button>
          </nav>

          <div className="header-actions">
            <label className="language-switch">
              <span className="language-label">{language === 'ms' ? 'Bahasa' : 'Language'}</span>
              <select
                aria-label="Language / Bahasa"
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'en' | 'ms')}
              >
                <option value="en">English</option>
                <option value="ms">Bahasa Melayu</option>
              </select>
            </label>

            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t("Switch to light mode") : t("Switch to dark mode")}
              title={theme === 'dark' ? t("Switch to light mode") : t("Switch to dark mode")}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              className="mobile-menu"
              aria-label={t("Toggle navigation")}
              onClick={() => setMobile(!mobile)}
            >
              {mobile ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Expansive Hero Section */}
        <section className="hero">
          <div className="hero-container">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="eyebrow-pill" />
                {t("PRIVATE CLIENT-SIDE WORKSTATION")}
              </div>
              <h1>
                {t("Simple, private tools for your PDFs and images.")}
              </h1>
              <p className="hero-description">
                {t("Runs 100% in your browser. No accounts, no subscriptions, and zero file uploads to any server.")}
              </p>

              <div className="hero-cta-group">
                <button className="primary" onClick={() => browse('All tools')}>
                  {t("Explore all tools")}
                  <ArrowRight size={17} />
                </button>
                <button className="secondary-btn" onClick={() => setInfo('How it works')}>
                  {t("How it works")}
                </button>
              </div>

              {/* Concrete proof metrics */}
              <div className="hero-metrics">
                <div className="metric-pill">
                  <strong>{tools.length}</strong>
                  <span>{t("Browser-Native Tools")}</span>
                </div>
                <div className="metric-pill">
                  <strong>100 MB</strong>
                  <span>{t("100 MB File Limit")}</span>
                </div>
                <div className="metric-pill">
                  <strong>0 KB</strong>
                  <span>{t("0 KB Uploaded")}</span>
                </div>
                <div className="metric-pill">
                  <strong>AGPL-3.0</strong>
                  <span>{t("AGPL-3.0 License")}</span>
                </div>
              </div>
            </div>

            {/* Interactive Hero Workstation Card */}
            <div className="hero-workstation-card" aria-label="Interactive client-side file hub">
              <div className="workstation-top">
                <div className="sandbox-indicator">
                  <span className="pipeline-dot" />
                  <span>{t("Local sandbox active")}</span>
                </div>
                <div className="workstation-formats">
                  <span>PDF · PNG · JPG · MP4</span>
                </div>
              </div>

              <input
                ref={heroInputRef}
                type="file"
                hidden
                accept=".pdf,.png,.jpg,.jpeg,.webp,.mp4,.mov,.webm,.m4v"
                onChange={(e) => {
                  handleHeroFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />

              {heroFile ? (
                <div className="hero-file-selected">
                  <div className="selected-meta">
                    <span className="file-badge">{isHeroPdf ? 'PDF' : isHeroVideo ? 'VIDEO' : 'IMAGE'}</span>
                    <div className="file-titles">
                      <strong>{heroFile.name}</strong>
                      <small>{(heroFile.size / 1024 / 1024).toFixed(2)} MB</small>
                    </div>
                    <button className="clear-btn" onClick={() => setHeroFile(null)} aria-label={t("Clear file")}>
                      <X size={16} />
                    </button>
                  </div>

                  <p className="action-prompt">
                    {isHeroPdf
                      ? t("Choose an action for your PDF:")
                      : isHeroVideo
                      ? t("Choose an action for your video:")
                      : t("Choose an action for your image:")}
                  </p>

                  <div className="hero-actions-grid">
                    {isHeroPdf ? (
                      <>
                        <button className="highlight" onClick={() => openToolWithFiles(tools.find((x) => x.id === 'signpdf')!, [heroFile])}>
                          <PenTool size={16} /> Sign & Watermark
                        </button>
                        <button className="highlight" onClick={() => openToolWithFiles(tools.find((x) => x.id === 'redact')!, [heroFile])}>
                          <EyeOff size={16} /> Redact PDF
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'merge')!, [heroFile])}>
                          <Merge size={16} /> Merge PDF
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'split')!, [heroFile])}>
                          <Scissors size={16} /> Split PDF
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'organize')!, [heroFile])}>
                          <Layers size={16} /> Organize PDF
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'rotate')!, [heroFile])}>
                          <RotateCw size={16} /> Rotate PDF
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'pdfimage')!, [heroFile])}>
                          <FileImage size={16} /> PDF to image
                        </button>
                      </>
                    ) : isHeroVideo ? (
                      <>
                        <button className="highlight" onClick={() => openToolWithFiles(tools.find((x) => x.id === 'status_hd')!, [heroFile])}>
                          <Smartphone size={16} /> WhatsApp Status HD
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'videotogif')!, [heroFile])}>
                          <Film size={16} /> Make Animated GIF
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'livephoto')!, [heroFile])}>
                          <Sparkles size={16} /> Video to Live Photo
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'audioextract')!, [heroFile])}>
                          <Volume2 size={16} /> Extract Audio & Mute
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="highlight" onClick={() => openToolWithFiles(tools.find((x) => x.id === 'faceblur')!, [heroFile])}>
                          <EyeOff size={16} /> Blur Faces & Plates
                        </button>
                        <button className="highlight" onClick={() => openToolWithFiles(tools.find((x) => x.id === 'exifcleaner')!, [heroFile])}>
                          <ShieldAlert size={16} /> Erase GPS & EXIF
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'passport')!, [heroFile])}>
                          <Camera size={16} /> Passport & IC Photo
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'scandoc')!, [heroFile])}>
                          <Scan size={16} /> Scan Document
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'status_hd')!, [heroFile])}>
                          <Smartphone size={16} /> Status HD (9:16)
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'background')!, [heroFile])}>
                          <Scissors size={16} /> Remove background
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'compress')!, [heroFile])}>
                          <ArrowDownToLine size={16} /> Compress image
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'crop')!, [heroFile])}>
                          <Scissors size={16} /> Crop image
                        </button>
                        <button onClick={() => openToolWithFiles(tools.find((x) => x.id === 'convert')!, [heroFile])}>
                          <Image size={16} /> Convert format
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={`hero-dropzone ${heroDrag ? 'drag' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setHeroDrag(true);
                  }}
                  onDragLeave={() => setHeroDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setHeroDrag(false);
                    handleHeroFile(e.dataTransfer.files?.[0]);
                  }}
                  onClick={() => heroInputRef.current?.click()}
                >
                  <div className="dropzone-icon">
                    <Upload size={24} />
                  </div>
                  <strong>{t("Drop your file here, or browse")}</strong>
                  <span>{t("Select a PDF, image, or video to quickly launch the right tool.")}</span>
                </div>
              )}

              {/* Suite Quick-Pill Row */}
              <div className="workstation-suites">
                <div className="suite-group">
                  <span className="suite-title">
                    <Files size={13} /> {t("PDF Suite")}:
                  </span>
                  <div className="suite-chips">
                    <button onClick={() => setActive(tools.find((x) => x.id === 'signpdf')!)}>Sign</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'merge')!)}>Merge</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'split')!)}>Split</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'organize')!)}>Organize</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'rotate')!)}>Rotate</button>
                  </div>
                </div>
                <div className="suite-group">
                  <span className="suite-title">
                    <Image size={13} /> {t("Image Studio")}:
                  </span>
                  <div className="suite-chips">
                    <button onClick={() => setActive(tools.find((x) => x.id === 'passport')!)}>Passport</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'scandoc')!)}>Scan</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'tiktok')!)}>TikTok</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'status_hd')!)}>Status HD</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'livephoto')!)}>Live Photo</button>
                  </div>
                </div>
                <div className="suite-group">
                  <span className="suite-title">
                    <Sparkles size={13} /> {t("Studio & AI")}:
                  </span>
                  <div className="suite-chips">
                    <button onClick={() => setActive(tools.find((x) => x.id === 'cinematic')!)}>Cinematic</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'faceblur')!)}>Face Blur</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'qrstudio')!)}>QR Studio</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'audiorecorder')!)}>Voice Memo</button>
                    <button onClick={() => setActive(tools.find((x) => x.id === 'videotogif')!)}>GIF Maker</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Expansive Tool Directory Section */}
        <section className="tools-section" id="tools">
          <div className="section-container">
            <div className="section-top">
              <div>
                <div className="eyebrow">{t("YOUR EVERYDAY TOOLKIT")}</div>
                <h2>{t("Select a tool to begin")}</h2>
                <p>{t("A focused suite of browser-native utilities for daily file tasks.")}</p>
              </div>
              <label className="search">
                <Search size={18} />
                <input
                  ref={searchRef}
                  placeholder={t("Find a tool…")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label={t("Search tools")}
                />
                <kbd>Ctrl K</kbd>
              </label>
            </div>

            <div className="filter-row">
              <div className="filters">
                {['All tools', 'PDF tools', 'Image tools'].map((cat, i) => (
                  <button
                    className={category === cat ? 'selected' : ''}
                    onClick={() => setCategory(cat)}
                    key={cat}
                  >
                    {i === 0 ? <Layers size={15} /> : i === 1 ? <Files size={15} /> : <Image size={15} />}{' '}
                    {t(cat)}
                    <span>{i === 0 ? tools.length : tools.filter((t) => t.category === cat).length}</span>
                  </button>
                ))}
              </div>
              <span className="local-note">
                <ShieldCheck size={15} />
                {t("Your files stay on your device")}
              </span>
            </div>

            <div className="tool-grid">
              {visible.map((tool) => (
                <button
                  key={tool.id}
                  className="tool-card"
                  onClick={() => openToolWithFiles(tool, [])}
                >
                  <div className="card-top">
                    <span className={`tool-icon ${tool.color}`}>
                      <tool.icon size={22} strokeWidth={1.8} />
                    </span>
                    <div className="card-badges">
                      {tool.tag && <span className="tag">{t(tool.tag)}</span>}
                      <span className="card-format-tag">{tool.formats}</span>
                    </div>
                  </div>
                  <h3>{t(tool.name)}</h3>
                  <p>{t(tool.description)}</p>
                  <div className="card-footer">
                    <span className="card-category">
                      {tool.category === 'PDF tools' ? t('PDF TOOL') : t('IMAGE TOOL')}
                    </span>
                    <span className="card-action-link">
                      Open <ArrowRight size={14} />
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {visible.length === 0 && (
              <div className="empty">
                {t("No tools found. Try “PDF” or “image”.")}
                <button
                  onClick={() => {
                    setQuery('');
                    setCategory('All tools');
                  }}
                >
                  {t("Show all tools")}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 4-Pillar Architectural Proof Section */}
        <section className="architecture-section">
          <div className="section-container">
            <div className="architecture-header">
              <div className="eyebrow">{t("PRIVACY & ARCHITECTURE")}</div>
              <h2>{t("Why in-browser processing matters")}</h2>
              <p>
                {t("Traditional web tools send your sensitive files to cloud servers. Xenn for all processes every byte locally on your machine.")}
              </p>
            </div>

            <div className="architecture-grid">
              <div className="arch-card">
                <span className="arch-icon">
                  <ShieldCheck size={24} />
                </span>
                <h3>{t("Zero server uploads")}</h3>
                <p>
                  {t("Your files never leave your device. Processing occurs in sandboxed browser memory and is discarded when done.")}
                </p>
              </div>

              <div className="arch-card">
                <span className="arch-icon">
                  <Cpu size={24} />
                </span>
                <h3>{t("Powered by your hardware")}</h3>
                <p>
                  {t("PDF reordering, image compression, and AI background removal run locally via WebAssembly and ONNX Runtime.")}
                </p>
              </div>

              <div className="arch-card">
                <span className="arch-icon">
                  <LockKeyhole size={24} />
                </span>
                <h3>{t("No accounts or tracking")}</h3>
                <p>
                  {t("No sign-up screens, usage limits, email requests, or paywalls. Open the page and complete your task.")}
                </p>
              </div>

              <div className="arch-card">
                <span className="arch-icon">
                  <Zap size={24} />
                </span>
                <h3>{t("Offline capable")}</h3>
                <p>
                  {t("Once loaded into your browser cache, core tools operate without depending on external web services.")}
                </p>
              </div>
            </div>

            {/* Architecture Comparison Table */}
            <div className="comparison-container">
              <div className="comparison-header">
                <h3>{t("Privacy & Architecture Comparison")}</h3>
                <p>{t("How Xenn for all compares with cloud-based file tools.")}</p>
              </div>

              <div className="comparison-table-wrapper">
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>Capability</th>
                      <th>{t("Traditional Cloud Converters")}</th>
                      <th>{t("Xenn for all (Local WebAssembly)")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>{t("File Upload to Server")}</strong></td>
                      <td><span className="bad-pill">✕ {t("Yes, files sent over network")}</span></td>
                      <td><span className="good-pill">✓ {t("Zero bytes uploaded (100% in-browser)")}</span></td>
                    </tr>
                    <tr>
                      <td><strong>{t("Document Privacy")}</strong></td>
                      <td>{t("Stored on third-party cloud")}</td>
                      <td><strong>{t("Never leaves your device RAM")}</strong></td>
                    </tr>
                    <tr>
                      <td><strong>{t("Account Requirement")}</strong></td>
                      <td>{t("Often requires sign-up")}</td>
                      <td><strong>{t("Never required")}</strong></td>
                    </tr>
                    <tr>
                      <td><strong>{t("Pricing & Subscriptions")}</strong></td>
                      <td>{t("Free trial with recurring fee")}</td>
                      <td><span className="good-pill">✓ {t("100% Free and open source")}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="bottom-note">
          <p>
            {t("Open source under the AGPL-3.0 license. Inspect the code on GitHub or host it on your own infrastructure.")}
          </p>
        </section>
      </main>

      <footer>
        <div className="footer-inner">
          <a className="brand" href="/" aria-label="Xenn for all home">
            <img src={brandIcon} alt="" className="brand-mark-img footer-logo" width={26} height={26} />
            xenn<span className="brand-light">for all.</span>
          </a>
          <span>{t("Private client-side file tools.")}</span>
          <div className="footer-links">
            <button onClick={() => setInfo('Privacy')}>{t("Privacy")}</button>
            <button onClick={() => setInfo('About Xenn for all')}>{t("About")}</button>
            <a href="https://github.com/i0zfnr/xennforall" target="_blank" rel="noreferrer">
              {t("Source code")}
            </a>
          </div>
        </div>
      </footer>

      {active &&
        (active.id === 'batch' ? <Suspense fallback={<div role="status">{t('Loading your tool…')}</div>}><BatchImages close={() => setActive(null)} /></Suspense> : ['pdfimage', 'organize', 'crop', 'number'].includes(active.id) ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <NewTools
              kind={active.id as 'pdfimage' | 'organize' | 'crop' | 'number'}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'status_hd' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <StatusHdTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'tiktok' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <TikTokTool
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
              onSendToStatusHd={(file) => {
                setActive(tools.find((x) => x.id === 'status_hd')!);
                setInitialFiles([file]);
              }}
              onSendToLivePhoto={(file) => {
                setActive(tools.find((x) => x.id === 'livephoto')!);
                setInitialFiles([file]);
              }}
            />
          </Suspense>
        ) : active.id === 'livephoto' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <LivePhotoTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'passport' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <PassportPhotoTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'signpdf' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <SignPdfTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'scandoc' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <ScanDocTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'redact' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <RedactPdfTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'audioextract' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <AudioExtractTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'exifcleaner' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <ExifCleanerTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'cinematic' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <CinematicStudioTool
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
              onSendToStatusHd={(file) => {
                setActive(tools.find((x) => x.id === 'status_hd')!);
                setInitialFiles([file]);
              }}
            />
          </Suspense>
        ) : active.id === 'faceblur' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <FaceBlurTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'qrstudio' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <QrStudioTool
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'audiorecorder' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <AudioRecorderTool
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : active.id === 'videotogif' ? (
          <Suspense
            fallback={
              <div className="modal-backdrop">
                <div className="modal" role="status">
                  {t("Loading your tool…")}
                </div>
              </div>
            }
          >
            <VideoToGifTool
              initialFiles={initialFiles}
              close={() => {
                setActive(null);
                setInitialFiles([]);
              }}
            />
          </Suspense>
        ) : (
          <ToolDialog
            tool={active}
            initialFiles={initialFiles}
            close={() => {
              setActive(null);
              setInitialFiles([]);
            }}
          />
        ))}

      {info && (
        <div className="modal-backdrop" onClick={() => setInfo(null)}>
          <section
            className="modal info-modal"
            role="dialog"
            aria-modal="true"
            aria-label={info}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close" aria-label={t("Close")} onClick={() => setInfo(null)}>
              <X size={18} />
            </button>
            <span className="tool-icon green">
              <ShieldCheck size={24} />
            </span>
            <h2>{t(info)}</h2>
            {info === 'How it works' ? (
              <ol>
                <li>{t("Pick a PDF or image tool.")}</li>
                <li>{t("Choose your files and settings.")}</li>
                <li>{t("Process and download the result. No account needed.")}</li>
              </ol>
            ) : (
              <p>
                {t(
                  "Xenn for all is a free toolkit for everyday file tasks. Processing happens on your own device, with no file uploads, tracking, or accounts. Background removal downloads an AI model on first use, so an internet connection is required. Your device’s memory determines the size of files you can process."
                )}
              </p>
            )}
            <p className="muted">
              {t(
                "Built with React and TypeScript. Background removal powered by IMG.LY (AGPL-3.0). See the project README for source and license details."
              )}
            </p>
          </section>
        </div>
      )}
    </>
  );
}

function ToolDialog({
  tool,
  initialFiles = [],
  close
}: {
  tool: Tool;
  initialFiles?: File[];
  close: () => void;
}) {
  const [files, setFiles] = useState<File[]>(initialFiles);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const [value, setValue] = useState(
    tool.id === 'rotate' ? '90' : tool.id === 'resize' ? '1200' : tool.id === 'split' ? '1' : ''
  );
  const [format, setFormat] = useState('image/png');
  const [quality, setQuality] = useState(72);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    setResult(null);
    setStatus('');
  }, [value, format, quality]);

  const workspace = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    workspace.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    if (busy) workspace.current?.focus();
    else if (result) {
      workspace.current?.querySelector<HTMLButtonElement>('.workspace-action .primary')?.focus({ preventScroll: true });
    }
  }, [busy, result]);

  const input = useRef<HTMLInputElement>(null);
  const isPdf = ['merge', 'split', 'rotate'].includes(tool.id);
  const multiple = ['merge', 'imagepdf'].includes(tool.id);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function add(incoming: File[]) {
    const valid = incoming.filter((f) =>
      isPdf
        ? f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
        : ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    );
    if (valid.length !== incoming.length) {
      setError(isPdf ? 'Please choose PDF files.' : 'Please choose JPG, PNG, or WebP images.');
      return;
    }
    if (incoming.some((f) => f.size > 100 * 1024 * 1024)) {
      setError('Please use files smaller than 100 MB for reliable browser processing.');
      return;
    }
    setFiles((prev) => (multiple ? [...prev, ...valid] : valid.slice(0, 1)));
    setResult(null);
    setError('');
    setStatus('');
  }

  async function run() {
    setBusy(true);
    setError('');
    setResult(null);
    setStatus('Working on your device…');
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    try {
      let blob: Blob;
      let name: string;

      if (isPdf || tool.id === 'imagepdf') {
        const { PDFDocument, degrees } = await import('pdf-lib');
        const out = await PDFDocument.create();

        if (tool.id === 'imagepdf') {
          for (const file of files) {
            const img = await loadImage(file);
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d')!.drawImage(img, 0, 0);
            const image = await out.embedPng(canvas.toDataURL('image/png'));
            const scale = Math.min(555 / image.width, 802 / image.height, 1);
            const page = out.addPage([image.width * scale + 40, image.height * scale + 40]);
            page.drawImage(image, { x: 20, y: 20, width: image.width * scale, height: image.height * scale });
          }
        } else {
          for (const file of files) {
            const source = await PDFDocument.load(await file.arrayBuffer());
            let indices = source.getPageIndices();

            if (tool.id === 'split') {
              const pages: number[] = [];
              for (const part of value.split(',')) {
                const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
                if (!match) throw new Error('Enter pages like 1, 3-5.');
                const start = Number(match[1]);
                const end = Number(match[2] || match[1]);
                if (start < 1 || end < start || end > source.getPageCount()) {
                  throw new Error(`Choose pages between 1 and ${source.getPageCount()}.`);
                }
                for (let n = start; n <= end; n++) pages.push(n - 1);
              }
              indices = [...new Set(pages)];
            }

            for (const page of await out.copyPages(source, indices)) {
              if (tool.id === 'rotate') {
                page.setRotation(degrees((page.getRotation().angle + Number(value)) % 360));
              }
              out.addPage(page);
            }
          }
        }
        const bytes = await out.save();
        blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
        name = `xenn-${tool.id}.pdf`;
      } else if (tool.id === 'background') {
        setStatus('Loading AI model. First use may take a few minutes…');
        const { removeBackground } = await import('@imgly/background-removal');
        blob = await removeBackground(files[0], {
          device: 'cpu',
          model: 'isnet_quint8',
          progress: (key, current, total) => {
            setStatus(
              `${key.startsWith('fetch') ? 'Downloading AI model' : 'Processing image'}${
                total ? ` · ${Math.round((current / total) * 100)}%` : ''
              }`
            );
          }
        });
        name = 'xenn-no-background.png';
      } else {
        const img = await loadImage(files[0]);
        const canvas = document.createElement('canvas');
        const width = tool.id === 'resize' ? Number(value) : img.naturalWidth;
        if (!Number.isFinite(width) || width < 1 || width > 16000) {
          throw new Error('Enter a width between 1 and 16000 pixels.');
        }
        canvas.width = width;
        canvas.height = Math.max(1, Math.round((img.naturalHeight * width) / img.naturalWidth));
        const ctx = canvas.getContext('2d')!;
        const mime = tool.id === 'compress' ? 'image/jpeg' : format;
        if (mime === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('This image could not be converted.'))), mime, tool.id === 'compress' ? quality / 100 : 0.92)
        );
        name = `xenn-${tool.id}.${blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'}`;
      }

      setResult({ blob, name });
      setStatus('All done! Your file is ready.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try a different file.');
      setStatus('');
    } finally {
      setBusy(false);
    }
  }

  const currentStep = result ? 3 : busy ? 2 : 1;
  const fileSize = (size: number) =>
    size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(2)} MB`;

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={workspace}
        tabIndex={-1}
        className="tool-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tool-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            if (!busy) close();
          }
          if (e.key === 'Tab') {
            const controls = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input:not([type="hidden"]):not(:disabled),select:not(:disabled),a[href],[tabindex="0"]'
              )
            ).filter((el) => el.getClientRects().length > 0);
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === e.currentTarget)) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="workspace-topbar">
          <button className="workspace-back" disabled={busy} onClick={close}>
            <ArrowRight size={15} />
            {t("All tools")}
          </button>
          <span className="workspace-private">
            <ShieldCheck size={14} />
            {t("Private by design")}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t("Close tool")}>
            <X size={19} />
          </button>
        </div>

        <div className="workspace-heading">
          <span className={`tool-icon ${tool.color}`}>
            <tool.icon size={26} />
          </span>
          <div>
            <span className="workspace-category">
              {t(tool.category)} <span>/</span> {t("YOUR WORKSPACE")}
            </span>
            <h2 id="tool-title">{t(tool.name)}</h2>
            <p>{t(tool.description)}</p>
          </div>
        </div>

        <ol className="workspace-steps" aria-label={t("Tool progress")}>
          {[
            { name: t("Choose your files"), detail: t("Start with what you have") },
            { name: t("Process locally"), detail: t("Processed on your device") },
            { name: t("Take it with you"), detail: t("Preview and download") }
          ].map((step, index) => (
            <li
              key={step.name}
              className={currentStep === index + 1 ? 'current' : currentStep > index + 1 ? 'complete' : ''}
              aria-current={currentStep === index + 1 ? 'step' : undefined}
            >
              <span className="step-number">{currentStep > index + 1 ? <Check size={15} /> : index + 1}</span>
              <span>
                <b>{step.name}</b>
                <small>{step.detail}</small>
              </span>
              {index < 2 && <span className="step-connector" />}
            </li>
          ))}
        </ol>

        <div className="workspace-grid">
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className={`canvas-dot ${busy ? 'pulsing' : ''}`} />
                {busy ? t("IN PROGRESS") : result ? t("THE FINISHED THING") : t("A LITTLE ROOM TO CREATE")}
              </span>
              <span>
                {files.length
                  ? t(`${files.length} ${files.length === 1 ? 'file' : 'files'} selected`)
                  : t('Your preview lives here')}
              </span>
            </div>

            {files.length > 0 ? (
              <FilePreview files={files} result={result?.blob} busy={busy} toolId={tool.id} toolName={tool.name} />
            ) : (
              <button
                className={`workspace-empty ${drag ? 'drag' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  add(Array.from(e.dataTransfer.files));
                }}
                onClick={() => input.current?.click()}
              >
                <span className="empty-file-art">
                  <span className="empty-paper back-paper" />
                  <span className="empty-paper">
                    <tool.icon size={36} strokeWidth={1.4} />
                    <i />
                    <i />
                  </span>
                  <span className="empty-plus">
                    <Plus size={18} />
                  </span>
                </span>
                <strong>{t("Choose or drop a file to begin")}</strong>
                <span>
                  {t("Drop your")}{' '}
                  {isPdf ? 'PDF' : t('image')}
                  {multiple && getLanguage() === 'en' ? 's' : ''}{' '}
                  {t('here, or choose')}{' '}
                  {multiple ? t('them') : t('one')}{' '}
                  {t('from your device.')}
                </span>
                <span className="empty-upload">
                  <Upload size={16} />
                  {t('Choose')} {isPdf ? t('PDF files') : t('images')}
                </span>
                <small>
                  {isPdf ? 'PDF' : 'JPG, PNG, WebP'}
                  {t("· Up to 100 MB per file")}
                </small>
              </button>
            )}

            <div className="canvas-footer">
              <LockKeyhole size={13} />
              <span>{t("Your files stay here. On your device. Always.")}</span>
            </div>
          </div>

          <aside className="workspace-controls" aria-label={t("Files and settings")}>
            <div className="controls-section">
              <div className="controls-heading">
                <h3>{t("Your files")}</h3>
                <span>{files.length ? String(files.length).padStart(2, '0') : '01'}</span>
              </div>
              <p className="controls-description">
                {multiple ? t("Add your files in the order you want.") : t("One file. A fresh possibility.")}
              </p>
              <button
                disabled={busy}
                className={`dropzone workspace-upload ${drag ? 'drag' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  if (!busy) add(Array.from(e.dataTransfer.files));
                }}
                onClick={() => input.current?.click()}
              >
                <Upload size={17} />
                <b>
                  {files.length
                    ? multiple
                      ? t("Add more files")
                      : t("Choose a different file")
                    : `${t('Choose')} ${isPdf ? t('PDF files') : t('images')}`}
                </b>
              </button>
              <input
                ref={input}
                type="file"
                hidden
                multiple={multiple}
                accept={isPdf ? '.pdf' : '.jpg,.jpeg,.png,.webp'}
                onChange={(e) => {
                  add(Array.from(e.target.files || []));
                  e.target.value = '';
                }}
              />
              <div className="file-list">
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`}>
                    <span className="file-order">{String(i + 1).padStart(2, '0')}</span>
                    <span title={f.name}>
                      {f.name}
                      <small>{fileSize(f.size)}</small>
                    </span>
                    {multiple && i > 0 && (
                      <button
                        disabled={busy}
                        aria-label={t(`Move ${f.name} up`)}
                        onClick={() => {
                          setResult(null);
                          setStatus('');
                          setFiles((prev) => {
                            const next = [...prev];
                            [next[i - 1], next[i]] = [next[i], next[i - 1]];
                            return next;
                          });
                        }}
                      >
                        ↑
                      </button>
                    )}
                    <button
                      disabled={busy}
                      aria-label={t(`Remove ${f.name}`)}
                      onClick={() => {
                        setFiles(files.filter((_, n) => n !== i));
                        setResult(null);
                        setStatus('');
                      }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="controls-section settings-section">
              <div className="controls-heading">
                <h3>{['split', 'rotate', 'resize', 'convert'].includes(tool.id) ? t("Make it yours") : t("Good to know")}</h3>
                <span>
                  <tool.icon size={15} />
                </span>
              </div>
              {tool.id === 'split' && (
                <label className="field">
                  {t("Pages to extract")}
                  <input disabled={busy} value={value} onChange={(e) => setValue(e.target.value)} placeholder="1, 3-5" />
                  <small>{t("For example: 1, 3-5. Selected pages become one PDF.")}</small>
                </label>
              )}
              {tool.id === 'rotate' && (
                <label className="field">
                  {t("Rotate all pages")}
                  <select disabled={busy} value={value} onChange={(e) => setValue(e.target.value)}>
                    <option value="90">{t("90° clockwise")}</option>
                    <option value="180">180°</option>
                    <option value="270">{t("90° counterclockwise")}</option>
                  </select>
                </label>
              )}
              {tool.id === 'resize' && (
                <label className="field">
                  {t("Width in pixels")}
                  <input
                    disabled={busy}
                    type="number"
                    min="1"
                    max="16000"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                  <small>{t("Aspect ratio is preserved.")}</small>
                </label>
              )}
              {['convert', 'resize'].includes(tool.id) && (
                <label className="field">
                  {t("Output format")}
                  <select disabled={busy} value={format} onChange={(e) => setFormat(e.target.value)}>
                    <option value="image/png">PNG</option>
                    <option value="image/jpeg">JPG</option>
                    <option value="image/webp">WebP</option>
                  </select>
                </label>
              )}
              {tool.id === 'background' && (
                <p className="workspace-tip">
                  <Cpu size={17} />
                  <span>{t("The first run downloads the AI model. It can take a few minutes. After that, you’re ready for more.")}</span>
                </p>
              )}
              {tool.id === 'compress' && <label className="field">{t('Image quality')}: {quality}%<input type="range" min="10" max="100" value={quality} disabled={busy} onChange={(e) => setQuality(Number(e.target.value))} /><small>{t('Lower quality usually means a smaller file.')}</small></label>}
              {tool.id === 'compress' && result && <p className="workspace-tip">{t('Original')}: {fileSize(files[0].size)} · {t('Result')}: {fileSize(result.blob.size)}{result.blob.size >= files[0].size && <> · {t('The result is not smaller. Try a lower quality.')}</>}</p>}
              {tool.id === 'compress' && (
                <p className="workspace-tip">
                  <Image size={17} />
                  <span>{t("We’ll make a quality-optimized JPG. Transparent areas become white. File size depends on your original.")}</span>
                </p>
              )}
              {tool.id === 'merge' && (
                <p className="workspace-tip">
                  <Layers size={17} />
                  <span>{t("Your files become one PDF, in list order. Use the arrows to move a file up.")}</span>
                </p>
              )}
              {tool.id === 'imagepdf' && (
                <p className="workspace-tip">
                  <FileImage size={17} />
                  <span>{t("Each image becomes a page, with a little breathing room around it. Reorder files with the arrows.")}</span>
                </p>
              )}
            </div>

            <div className={`workspace-action ${result ? 'action-complete' : ''}`}>
              {error && (
                <p role="alert" className="error">
                  {t(error)}
                </p>
              )}
              {status && (
                <p role="status" className="status">
                  {busy ? <span className="spinner" /> : result ? <Check size={16} /> : null}
                  {t(status)}
                </p>
              )}
              {!status && !error && (
                <p className="action-hint">
                  {files.length ? t("A little less busywork starts here.") : t("Choose a file to get started.")}
                </p>
              )}
              {result ? (
                <button className="primary full" onClick={() => download(result.blob, result.name)}>
                  <ArrowDownToLine size={18} />
                  {t("Download result")}
                  <span>{fileSize(result.blob.size)}</span>
                </button>
              ) : (
                <button
                  className="primary full"
                  disabled={busy || files.length === 0 || (tool.id === 'merge' && files.length < 2)}
                  onClick={run}
                >
                  {busy ? (
                    t("Processing on your device…")
                  ) : tool.id === 'merge' && files.length < 2 ? (
                    t("Choose at least 2 PDFs")
                  ) : (
                    t(tool.name)
                  )}
                  {busy ? <span className="spinner" /> : <ArrowRight size={17} />}
                </button>
              )}
              <div className="dialog-privacy">
                <ShieldCheck size={13} />
                {t("No account. No uploads. No payment.")}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
