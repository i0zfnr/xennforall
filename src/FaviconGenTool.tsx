import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  AppWindow,
  ArrowDownToLine,
  ArrowRight,
  Check,
  Circle,
  Code,
  Copy,
  Download,
  Globe,
  Layers,
  ShieldCheck,
  Smartphone,
  Square,
  Upload,
  X
} from 'lucide-react';

interface FaviconGenToolProps {
  initialFiles?: File[];
  close: () => void;
}

type MaskShape = 'square' | 'rounded' | 'circle';

interface IconSizeConfig {
  name: string;
  size: number;
  label: string;
}

const ICON_SIZES: IconSizeConfig[] = [
  { name: 'favicon-16x16.png', size: 16, label: '16x16 (Browser Tab)' },
  { name: 'favicon-32x32.png', size: 32, label: '32x32 (Taskbar & High-DPI)' },
  { name: 'apple-touch-icon.png', size: 180, label: '180x180 (Apple Touch)' },
  { name: 'android-chrome-192x192.png', size: 192, label: '192x192 (Android PWA)' },
  { name: 'android-chrome-512x512.png', size: 512, label: '512x512 (Splash & Store)' }
];

export default function FaviconGenTool({ initialFiles = [], close }: FaviconGenToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);
  const [maskShape, setMaskShape] = useState<MaskShape>('rounded');
  const [bgColor, setBgColor] = useState<string>('transparent');
  const [padding, setPadding] = useState<number>(10);
  const [appName, setAppName] = useState<string>('My Web App');
  const [appThemeColor, setAppThemeColor] = useState<string>('#3b82f6');
  const [copiedHtml, setCopiedHtml] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  // Previews
  const [preview16, setPreview16] = useState<string>('');
  const [preview180, setPreview180] = useState<string>('');
  const [preview192, setPreview192] = useState<string>('');

  // Refs
  const dialogRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Accessibility lock
  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      prevActive?.focus();
    };
  }, []);

  // Initial file
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      loadSourceImage(initialFiles[0]);
    }
  }, []);

  function loadSourceImage(f: File) {
    if (!f.type.startsWith('image/')) return;
    setFile(f);
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      setSourceImg(img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  // Generate previews when image or parameters change
  useEffect(() => {
    if (!sourceImg) return;
    renderAllPreviews();
  }, [sourceImg, maskShape, bgColor, padding]);

  function renderIconCanvas(size: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx || !sourceImg) return canvas;

    ctx.clearRect(0, 0, size, size);
    ctx.save();

    if (maskShape === 'circle') {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
    } else if (maskShape === 'rounded') {
      const radius = size * 0.22;
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(size - radius, 0);
      ctx.quadraticCurveTo(size, 0, size, radius);
      ctx.lineTo(size, size - radius);
      ctx.quadraticCurveTo(size, size, size - radius, size);
      ctx.lineTo(radius, size);
      ctx.quadraticCurveTo(0, size, 0, size - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.clip();
    }

    if (bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);
    }

    const p = (size * padding) / 100;
    const drawWidth = size - p * 2;
    const drawHeight = size - p * 2;

    const imgAspect = sourceImg.width / sourceImg.height;
    let finalW = drawWidth;
    let finalH = drawHeight;
    let offsetX = p;
    let offsetY = p;

    if (imgAspect > 1) {
      finalH = drawWidth / imgAspect;
      offsetY = p + (drawHeight - finalH) / 2;
    } else {
      finalW = drawHeight * imgAspect;
      offsetX = p + (drawWidth - finalW) / 2;
    }

    ctx.drawImage(sourceImg, offsetX, offsetY, finalW, finalH);
    ctx.restore();
    return canvas;
  }

  function renderAllPreviews() {
    try {
      const c16 = renderIconCanvas(16);
      setPreview16(c16.toDataURL('image/png'));
      const c180 = renderIconCanvas(180);
      setPreview180(c180.toDataURL('image/png'));
      const c192 = renderIconCanvas(192);
      setPreview192(c192.toDataURL('image/png'));
    } catch (err) {
      console.error('Error rendering icon previews:', err);
    }
  }

  const htmlSnippet = `<!-- Favicons & App Icons -->
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="${appThemeColor}">`;

  const manifestJson = JSON.stringify(
    {
      name: appName,
      short_name: appName,
      icons: [
        { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
      ],
      theme_color: appThemeColor,
      background_color: bgColor === 'transparent' ? '#ffffff' : bgColor,
      display: 'standalone'
    },
    null,
    2
  );

  async function copyHtmlTags() {
    try {
      await navigator.clipboard.writeText(htmlSnippet);
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2200);
    } catch (e) {
      console.error(e);
    }
  }

  function downloadSingle(config: IconSizeConfig) {
    if (!sourceImg) return;
    const canvas = renderIconCanvas(config.size);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = config.name;
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  }

  async function downloadZipPack() {
    if (!sourceImg) return;
    setBusy(true);

    try {
      const zip = new JSZip();
      for (const config of ICON_SIZES) {
        const canvas = renderIconCanvas(config.size);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/png')
        );
        if (blob) zip.file(config.name, blob);
      }

      zip.file('site.webmanifest', manifestJson);
      zip.file(
        'html-tags.html',
        `<!-- Copy and paste into the <head> of your HTML pages -->\n${htmlSnippet}\n`
      );

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `favicon-pack-${Date.now()}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('ZIP generation error:', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={close}>
      <section
        ref={dialogRef as any}
        tabIndex={-1}
        className="tool-workspace favicongen-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="favicongen-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !busy) {
            e.stopPropagation();
            close();
          }
        }}
      >
        {/* Topbar */}
        <div className="workspace-topbar">
          <button className="workspace-back" disabled={busy} onClick={close}>
            <ArrowRight size={15} />
            {t('All tools')}
          </button>
          <span className="workspace-private">
            <ShieldCheck size={14} />
            {t('Private & Client-Side · 100% In-Browser')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon blue">
            <Globe size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Web tools')} <span>/</span> {t('FAVICON & PWA ICON GENERATOR')}
              </span>
              <span className="hd-pill">ZIP BUNDLE</span>
            </div>
            <h2 id="favicongen-title">{t('Favicon & Web App Icon Generator')}</h2>
            <p>
              {t('Generate all browser tabs, Apple Touch, and Android PWA icons with manifest')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Multi-Res · Instant Pack')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Visual Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {sourceImg ? t('REAL-TIME ICON PREVIEWS') : t('ICON STAGE')}
              </span>
              <span>{file ? file.name : t('Select logo or icon')}</span>
            </div>

            {!sourceImg ? (
              <button
                className="workspace-empty"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) loadSourceImage(e.dataTransfer.files[0]);
                }}
              >
                <div className="empty-circle">
                  <Globe size={34} />
                </div>
                <h3>{t('Select logo or icon image')}</h3>
                <p>{t('Square PNG, SVG, or high-res JPG recommended for crisp rendering across all screen sizes.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Choose Image')}
                </span>
              </button>
            ) : (
              <div className="favicongen-stage-wrap">
                {/* Visual browser and mobile previews */}
                <div className="favicongen-preview-row">
                  {/* Browser Tab Mock */}
                  <div className="preview-mock-card">
                    <span className="mock-card-title">
                      <AppWindow size={14} />
                      {t('Browser Tab Preview')}
                    </span>
                    <div className="mock-tab-item">
                      {preview16 ? (
                        <img src={preview16} alt="Tab Favicon" className="tab-mock-icon" />
                      ) : (
                        <div className="tab-mock-placeholder" />
                      )}
                      <span className="tab-mock-title">{appName}</span>
                      <small className="tab-mock-size">16x16</small>
                    </div>
                  </div>

                  {/* Mobile Home Screen Mock */}
                  <div className="preview-mock-card">
                    <span className="mock-card-title">
                      <Smartphone size={14} />
                      {t('Home Screen Icon Preview')}
                    </span>
                    <div className="mobile-mock-icons">
                      <div className="mobile-icon-box">
                        <div className="icon-squircle bg-checkerboard">
                          {preview180 && <img src={preview180} alt="Apple Touch" className="preview-cover-img" />}
                        </div>
                        <span className="mobile-app-label">{appName}</span>
                        <small className="mobile-app-sub">iOS (180px)</small>
                      </div>

                      <div className="mobile-icon-box">
                        <div className="icon-circle bg-checkerboard">
                          {preview192 && <img src={preview192} alt="Android Icon" className="preview-cover-img" />}
                        </div>
                        <span className="mobile-app-label">{appName}</span>
                        <small className="mobile-app-sub">Android (192px)</small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Individual Icon Downloads Grid */}
                <div className="favicongen-files-list">
                  <span className="mock-card-title">{t('Generated Icon Files')}</span>
                  <div className="favicongen-items-grid">
                    {ICON_SIZES.map((cfg) => (
                      <div key={cfg.name} className="icon-file-row">
                        <div className="icon-row-left">
                          <div className="icon-row-thumb bg-checkerboard">
                            {preview180 && <img src={preview180} alt={cfg.name} />}
                          </div>
                          <div>
                            <strong>{cfg.name}</strong>
                            <small>{cfg.label}</small>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="icon-dl-btn"
                          onClick={() => downloadSingle(cfg)}
                          title={`${t('Download')} ${cfg.name}`}
                          aria-label={`${t('Download')} ${cfg.name}`}
                        >
                          <Download size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* HTML Tags Snippet */}
                <div className="html-tags-box">
                  <div className="html-tags-header">
                    <span>
                      <Code size={14} />
                      {t('HTML Header Tags')}
                    </span>
                    <button type="button" className="copy-snippet-btn" onClick={copyHtmlTags}>
                      {copiedHtml ? <Check size={14} /> : <Copy size={14} />}
                      {copiedHtml ? t('Copied!') : t('Copy HTML')}
                    </button>
                  </div>
                  <pre className="html-tags-pre">{htmlSnippet}</pre>
                </div>
              </div>
            )}
          </div>

          {/* Controls Sidebar */}
          <div className="workspace-controls">
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="image/*"
              onChange={(e) => {
                if (e.target.files?.[0]) loadSourceImage(e.target.files[0]);
                e.target.value = '';
              }}
            />

            <div className="control-group">
              <label>{t('Corner Mask Shape')}</label>
              <div className="shape-picker-grid">
                {[
                  { id: 'rounded', label: t('Squircle'), icon: Layers },
                  { id: 'circle', label: t('Circle'), icon: Circle },
                  { id: 'square', label: t('Square'), icon: Square }
                ].map((item) => {
                  const IconComp = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`shape-chip ${maskShape === item.id ? 'active' : ''}`}
                      onClick={() => setMaskShape(item.id as MaskShape)}
                    >
                      <IconComp size={15} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="control-group">
              <label>{t('Icon Background')}</label>
              <div className="btn-toggle-group">
                {[
                  { id: 'transparent', label: t('Transparent') },
                  { id: '#ffffff', label: t('White') },
                  { id: '#090a0f', label: t('Dark') }
                ].map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    className={bgColor === bg.id ? 'active' : ''}
                    onClick={() => setBgColor(bg.id)}
                  >
                    {bg.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <div className="slider-label-row">
                <span>{t('Inner Padding')}</span>
                <strong>{padding}%</strong>
              </div>
              <input
                type="range"
                min="0"
                max="35"
                value={padding}
                onChange={(e) => setPadding(Number(e.target.value))}
              />
            </div>

            <div className="control-group">
              <label>{t('App Name')}</label>
              <input
                type="text"
                className="tool-input-text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="My Web App"
              />
            </div>

            <div className="control-group">
              <label>{t('Theme Color')}</label>
              <div className="color-picker-row">
                <input
                  type="color"
                  value={appThemeColor}
                  onChange={(e) => setAppThemeColor(e.target.value)}
                  className="color-swatch-input"
                />
                <span className="color-hex-tag">{appThemeColor.toUpperCase()}</span>
              </div>
            </div>

            <div className="favicongen-actions">
              <button
                type="button"
                className="download-btn-green"
                disabled={!sourceImg || busy}
                onClick={downloadZipPack}
              >
                <ArrowDownToLine size={16} />
                {busy ? t('Packaging ZIP…') : t('Download Favicon Pack (ZIP)')}
              </button>

              <button
                type="button"
                className="btn-change-file"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} />
                {sourceImg ? t('Change Source Image') : t('Select Source Image')}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
