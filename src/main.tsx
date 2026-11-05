import { getLanguage, subscribeLanguage, setLanguage, t } from './i18n';
import { StrictMode, Suspense, lazy, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronDown,
  Cpu,
  FileImage,
  Files,
  Image,
  Layers,
  LockKeyhole,
  Maximize,
  Menu,
  Merge,
  Moon,
  Plus,
  RotateCw,
  Scissors,
  Search,
  ShieldCheck,
  Sun,
  Upload,
  X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './style.css';
import { FilePreview } from './FilePreview';
const NewTools = lazy(() => import('./NewTools'));

type Tool = {
  id: string;
  name: string;
  description: string;
  category: 'PDF tools' | 'Image tools';
  icon: LucideIcon;
  color: string;
  tag?: string;
};

const tools: Tool[] = [
  { id: 'merge', name: 'Merge PDF', description: 'Bring your PDFs together. One file, perfectly in order.', category: 'PDF tools', icon: Merge, color: 'coral', tag: 'POPULAR' },
  { id: 'split', name: 'Split PDF', description: 'Keep the pages you need. Leave the rest behind.', category: 'PDF tools', icon: Scissors, color: 'orange' },
  { id: 'background', name: 'Remove background', description: 'Make your subject the star. Clean cutouts in a click.', category: 'Image tools', icon: Scissors, color: 'violet', tag: 'POPULAR' },
  { id: 'compress', name: 'Compress image', description: 'Smaller files. Same big impression.', category: 'Image tools', icon: ArrowDownToLine, color: 'blue' },
  { id: 'imagepdf', name: 'Image to PDF', description: 'Turn your JPGs and PNGs into a tidy PDF.', category: 'PDF tools', icon: FileImage, color: 'amber' },
  { id: 'convert', name: 'Convert image', description: 'A fresh format. Convert to JPG, PNG, or WebP.', category: 'Image tools', icon: Image, color: 'teal' },
  { id: 'rotate', name: 'Rotate PDF', description: 'Give your pages a turn in the right direction.', category: 'PDF tools', icon: RotateCw, color: 'rose' },
  { id: 'pdfimage', name: 'PDF to image', description: 'Turn PDF pages into JPG or PNG images.', category: 'PDF tools', icon: FileImage, color: 'blue', tag: 'NEW' },
  { id: 'organize', name: 'Organize PDF', description: 'Reorder, rotate, and remove pages visually.', category: 'PDF tools', icon: Layers, color: 'rose', tag: 'NEW' },
  { id: 'crop', name: 'Crop image', description: 'Find the perfect frame for any image.', category: 'Image tools', icon: Scissors, color: 'teal', tag: 'NEW' },
  { id: 'resize', name: 'Resize image', description: 'The perfect fit, wherever your image is going.', category: 'Image tools', icon: Maximize, color: 'green' }
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
  const [info, setInfo] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

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

  function browse(cat: string) {
    setCategory(cat);
    setMobile(false);
    document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <>
      <header>
        <a className="brand" href="/" aria-label="Xenn for all home">
          <span className="brand-mark">
            <Plus size={22} strokeWidth={3} />
          </span>
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
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <button
            className="mobile-menu"
            aria-label={t("Toggle navigation")}
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-pill" />
              {t("YOUR CLIENT-SIDE WORKSTATION")}
            </div>
            <h1>
              {t("Simple, private tools for your PDFs and images.")}
            </h1>
            <p>
              {t("Runs 100% in your browser. No accounts, no subscriptions, and zero file uploads to any server.")}
            </p>
            <div className="hero-cta-group">
              <button className="primary" onClick={() => browse('All tools')}>
                {t("Explore 11 tools")}
                <ArrowRight size={17} />
              </button>
            </div>
            <div className="hero-promises">
              <span>
                <Check size={14} />
                {t("Client-side execution")}
              </span>
              <span>
                <Check size={14} />
                {t("Zero server uploads")}
              </span>
              <span>
                <Check size={14} />
                {t("Free and open source")}
              </span>
            </div>
          </div>

          <div className="hero-architecture-card" aria-label="Client-side architecture overview">
            <div className="pipeline-header">
              <span className="pipeline-status">
                <span className="pipeline-dot" />
                {t("Local sandbox active")}
              </span>
              <span className="pipeline-engine">WebAssembly & Canvas</span>
            </div>

            <div className="pipeline-steps">
              <div className="pipeline-step">
                <span className="step-tag">01</span>
                <div className="step-info">
                  <strong>{t("Input document")}</strong>
                  <small>PDF, JPG, PNG, WebP</small>
                </div>
              </div>

              <div className="pipeline-arrow">↓</div>

              <div className="pipeline-step active-step">
                <span className="step-tag">02</span>
                <div className="step-info">
                  <strong>{t("WebAssembly & Canvas engine")}</strong>
                  <small>pdf-lib · PDF.js · ONNX Runtime</small>
                </div>
              </div>

              <div className="pipeline-arrow">↓</div>

              <div className="pipeline-step">
                <span className="step-tag">03</span>
                <div className="step-info">
                  <strong>{t("Local export")}</strong>
                  <small>{t("Zero server uploads")}</small>
                </div>
              </div>
            </div>

            <div className="pipeline-shortcuts">
              <span className="shortcuts-label">{t("Quick start:")}</span>
              <div className="shortcuts-row">
                <button onClick={() => setActive(tools[0])}>Merge PDF</button>
                <button onClick={() => setActive(tools[2])}>Remove background</button>
                <button onClick={() => setActive(tools[3])}>Compress image</button>
                <button onClick={() => setActive(tools[9])}>Crop image</button>
              </div>
            </div>
          </div>
        </section>

        <section className="tools-section" id="tools">
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
              <button key={tool.id} className="tool-card" onClick={() => setActive(tool)}>
                <div className="card-top">
                  <span className={`tool-icon ${tool.color}`}>
                    <tool.icon size={24} strokeWidth={1.8} />
                  </span>
                  {tool.tag && (
                    <span className="tag">{t(tool.tag)}</span>
                  )}
                  <ArrowRight className="card-arrow" size={17} />
                </div>
                <h3>{t(tool.name)}</h3>
                <p>{t(tool.description)}</p>
                <span className="card-category">
                  {tool.category === 'PDF tools' ? t('PDF TOOL') : t('IMAGE TOOL')}
                </span>
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
        </section>

        <section className="values">
          <div className="value-intro">
            <h2>{t("Why in-browser processing matters")}</h2>
            <p>
              {t("Traditional web tools send your sensitive files to cloud servers. Xenn for all processes every byte locally on your machine.")}
            </p>
          </div>
          <div className="value-item">
            <span className="value-icon">
              <ShieldCheck size={22} />
            </span>
            <h3>{t("Zero server uploads")}</h3>
            <p>
              {t("Your files never leave your device. Processing occurs in sandboxed browser memory and is discarded when done.")}
            </p>
          </div>
          <div className="value-item">
            <span className="value-icon">
              <Cpu size={22} />
            </span>
            <h3>{t("Powered by your hardware")}</h3>
            <p>
              {t("PDF reordering, image compression, and AI background removal run locally via WebAssembly and ONNX Runtime.")}
            </p>
          </div>
          <div className="value-item">
            <span className="value-icon">
              <LockKeyhole size={22} />
            </span>
            <h3>{t("No accounts or tracking")}</h3>
            <p>
              {t("No sign-up screens, usage limits, email requests, or paywalls. Open the page and complete your task.")}
            </p>
          </div>
        </section>

        <section className="bottom-note">
          <p>
            {t("Open source under the AGPL-3.0 license. Inspect the code on GitHub or host it on your own infrastructure.")}
          </p>
        </section>
      </main>

      <footer>
        <a className="brand" href="/" aria-label="Xenn for all home">
          <span className="brand-mark">
            <Plus size={18} strokeWidth={3} />
          </span>
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
      </footer>

      {active &&
        (['pdfimage', 'organize', 'crop'].includes(active.id) ? (
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
              kind={active.id as 'pdfimage' | 'organize' | 'crop'}
              close={() => setActive(null)}
            />
          </Suspense>
        ) : (
          <ToolDialog tool={active} close={() => setActive(null)} />
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

function ToolDialog({ tool, close }: { tool: Tool; close: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const [value, setValue] = useState(
    tool.id === 'rotate' ? '90' : tool.id === 'resize' ? '1200' : tool.id === 'split' ? '1' : ''
  );
  const [format, setFormat] = useState('image/png');
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    setResult(null);
    setStatus('');
  }, [value, format]);

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
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('This image could not be converted.'))), mime, tool.id === 'compress' ? 0.72 : 0.92)
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
