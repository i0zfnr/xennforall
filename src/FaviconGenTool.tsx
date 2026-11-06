import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  AppWindow,
  ArrowDownToLine,
  Check,
  Circle,
  Code,
  Copy,
  Download,
  FileCode,
  Globe,
  Image as ImageIcon,
  Layers,
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
  category: 'browser' | 'apple' | 'android';
}

const ICON_SIZES: IconSizeConfig[] = [
  { name: 'favicon-16x16.png', size: 16, label: '16x16 (Browser Tab)', category: 'browser' },
  { name: 'favicon-32x32.png', size: 32, label: '32x32 (Taskbar & High-DPI)', category: 'browser' },
  { name: 'apple-touch-icon.png', size: 180, label: '180x180 (Apple Touch Icon)', category: 'apple' },
  { name: 'android-chrome-192x192.png', size: 192, label: '192x192 (Android / PWA)', category: 'android' },
  { name: 'android-chrome-512x512.png', size: 512, label: '512x512 (Splash & Store)', category: 'android' }
];

export default function FaviconGenTool({ initialFiles = [], close }: FaviconGenToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);
  const [maskShape, setMaskShape] = useState<MaskShape>('rounded');
  const [bgColor, setBgColor] = useState<string>('transparent');
  const [padding, setPadding] = useState<number>(10); // percent
  const [appName, setAppName] = useState<string>('My Web App');
  const [appThemeColor, setAppThemeColor] = useState<string>('#3b82f6');
  const [copiedHtml, setCopiedHtml] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  // Previews rendered as data URLs
  const [preview16, setPreview16] = useState<string>('');
  const [preview32, setPreview32] = useState<string>('');
  const [preview180, setPreview180] = useState<string>('');
  const [preview192, setPreview192] = useState<string>('');

  // Refs
  const dialogRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal accessibility
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

  // Handle initial file
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

  // Generate previews when image or styling changes
  useEffect(() => {
    if (!sourceImg) return;
    renderAllPreviews();
  }, [sourceImg, maskShape, bgColor, padding]);

  // Render a specific size icon onto an off-screen canvas
  function renderIconCanvas(size: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx || !sourceImg) return canvas;

    ctx.clearRect(0, 0, size, size);

    // Clipping path for mask
    ctx.save();
    if (maskShape === 'circle') {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
    } else if (maskShape === 'rounded') {
      const radius = size * 0.22; // Apple-like squircle proportion
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

    // Fill background color if not transparent
    if (bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);
    }

    // Draw image with padding
    const p = (size * padding) / 100;
    const drawWidth = size - p * 2;
    const drawHeight = size - p * 2;

    // Aspect ratio preservation inside square canvas
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

      const c32 = renderIconCanvas(32);
      setPreview32(c32.toDataURL('image/png'));

      const c180 = renderIconCanvas(180);
      setPreview180(c180.toDataURL('image/png'));

      const c192 = renderIconCanvas(192);
      setPreview192(c192.toDataURL('image/png'));
    } catch (err) {
      console.error('Error rendering icon previews:', err);
    }
  }

  // HTML Link Tags Snippet
  const htmlSnippet = `<!-- Favicons & App Icons -->
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="${appThemeColor}">`;

  // Web Manifest JSON Snippet
  const manifestJson = JSON.stringify(
    {
      name: appName,
      short_name: appName,
      icons: [
        {
          src: '/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        }
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

  // Download Single Icon
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

  // Download complete ZIP pack
  async function downloadZipPack() {
    if (!sourceImg) return;
    setBusy(true);

    try {
      const zip = new JSZip();

      // Render each icon size to blob
      for (const config of ICON_SIZES) {
        const canvas = renderIconCanvas(config.size);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/png')
        );
        if (blob) {
          zip.file(config.name, blob);
        }
      }

      // Add web manifest
      zip.file('site.webmanifest', manifestJson);

      // Add HTML head instructions
      zip.file(
        'html-tags.html',
        `<!-- Copy and paste this into the <head> of your HTML pages -->\n${htmlSnippet}\n`
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="favicon-modal-title"
      ref={dialogRef as any}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md overflow-hidden animate-fade-in outline-none"
    >
      <div className="bg-surface border border-subtle rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-surface/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 id="favicon-modal-title" className="text-lg font-bold text-main leading-tight">
                {t('Favicon & Web App Icon Generator')}
              </h2>
              <p className="text-xs text-muted">
                {t('Generate all browser tabs, Apple Touch, and Android PWA icons with manifest')}
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="p-2 text-muted hover:text-main rounded-xl hover:bg-surface-hover transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={t('Close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Main Visual Preview Area */}
          <div className="lg:col-span-7 bg-black/20 p-5 flex flex-col gap-5 overflow-y-auto">
            {!sourceImg ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="my-auto border-2 border-dashed border-subtle hover:border-primary/60 rounded-2xl p-8 max-w-md mx-auto w-full text-center cursor-pointer transition-all hover:bg-surface/40 flex flex-col items-center justify-center gap-3"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Upload className="w-7 h-7" />
                </div>
                <h3 className="font-semibold text-main text-base">{t('Select logo or icon image')}</h3>
                <p className="text-xs text-muted leading-relaxed">
                  {t('Square PNG, SVG, or high-res JPG recommended for crisp rendering across all screen sizes.')}
                </p>
                <button
                  type="button"
                  className="btn btn-primary mt-2 min-h-[44px] px-5 text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  {t('Choose Image')}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {/* Real-world Live Browser Tab Preview */}
                <div className="bg-surface border border-subtle rounded-xl p-4 shadow-sm flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                    <AppWindow className="w-4 h-4 text-primary" />
                    <span>{t('Browser Tab Preview')}</span>
                  </div>
                  <div className="bg-surface-alt border border-subtle rounded-lg px-3 py-2 flex items-center gap-2 max-w-sm">
                    {preview16 ? (
                      <img src={preview16} alt="Tab Favicon" className="w-4 h-4 rounded-sm" />
                    ) : (
                      <div className="w-4 h-4 bg-muted/20 rounded-sm" />
                    )}
                    <span className="text-xs text-main font-medium truncate">{appName}</span>
                    <span className="text-[10px] text-muted ml-auto font-mono">16x16</span>
                  </div>
                </div>

                {/* Mobile App Icon Preview */}
                <div className="bg-surface border border-subtle rounded-xl p-4 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                    <Smartphone className="w-4 h-4 text-primary" />
                    <span>{t('Home Screen Icon Preview')}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md border border-subtle bg-checkerboard flex items-center justify-center">
                        {preview180 && (
                          <img src={preview180} alt="Apple Touch Icon" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-main">{appName}</span>
                      <span className="text-[10px] text-muted">iOS (180x180)</span>
                    </div>

                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-16 h-16 rounded-full overflow-hidden shadow-md border border-subtle bg-checkerboard flex items-center justify-center">
                        {preview192 && (
                          <img src={preview192} alt="Android Icon" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-main">{appName}</span>
                      <span className="text-[10px] text-muted">Android (192x192)</span>
                    </div>
                  </div>
                </div>

                {/* Icons Grid with Individual Download Options */}
                <div className="bg-surface border border-subtle rounded-xl p-4 shadow-sm flex flex-col gap-3">
                  <h4 className="text-xs font-semibold text-main">{t('Generated Icon Files')}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ICON_SIZES.map((cfg) => (
                      <div
                        key={cfg.name}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-subtle bg-surface-alt/50 hover:bg-surface-alt transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg border border-subtle bg-checkerboard flex items-center justify-center overflow-hidden shrink-0">
                            {preview180 && (
                              <img src={preview180} alt={cfg.name} className="w-full h-full object-contain" />
                            )}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-semibold text-main truncate">{cfg.name}</p>
                            <p className="text-[10px] text-muted">{cfg.label}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => downloadSingle(cfg)}
                          className="p-1.5 text-muted hover:text-primary rounded-lg hover:bg-surface transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                          title={`${t('Download')} ${cfg.name}`}
                          aria-label={`${t('Download')} ${cfg.name}`}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* HTML Snippet Preview */}
                <div className="bg-surface border border-subtle rounded-xl p-4 shadow-sm flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-main flex items-center gap-1.5">
                      <Code className="w-4 h-4 text-primary" />
                      {t('HTML Header Tags')}
                    </span>
                    <button
                      onClick={copyHtmlTags}
                      className="btn btn-secondary py-1 px-3 text-xs flex items-center gap-1.5 min-h-[44px]"
                    >
                      {copiedHtml ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedHtml ? t('Copied!') : t('Copy HTML')}
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono bg-black/40 text-emerald-300 p-3 rounded-lg overflow-x-auto leading-relaxed border border-subtle/50">
                    {htmlSnippet}
                  </pre>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  loadSourceImage(e.target.files[0]);
                }
              }}
            />
          </div>

          {/* Settings Sidebar */}
          <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-subtle p-5 overflow-y-auto flex flex-col gap-5 bg-surface">
            <div>
              <h3 className="text-sm font-bold text-main">{t('Icon Configuration')}</h3>
              <p className="text-xs text-muted">{t('Customize icon masking, background, and branding')}</p>
            </div>

            {/* Shape selection */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-main">{t('Corner Mask Shape')}</label>
              <div className="grid grid-cols-3 gap-2">
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
                      onClick={() => setMaskShape(item.id as MaskShape)}
                      className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-all flex flex-col items-center justify-center gap-1.5 min-h-[44px] ${
                        maskShape === item.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-subtle text-muted hover:bg-surface-hover'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Background Color & Padding */}
            <div className="flex flex-col gap-3">
              <label className="text-xs font-semibold text-main">{t('Icon Background')}</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'transparent', label: t('Transparent') },
                  { id: '#ffffff', label: t('White') },
                  { id: '#090a0f', label: t('Dark') }
                ].map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => setBgColor(bg.id)}
                    className={`py-2 text-xs font-medium rounded-lg border transition-all min-h-[44px] flex items-center justify-center ${
                      bgColor === bg.id
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-subtle text-muted hover:bg-surface-hover'
                    }`}
                  >
                    {bg.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-main">
                  {t('Inner Padding')} ({padding}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="35"
                  value={padding}
                  onChange={(e) => setPadding(Number(e.target.value))}
                  className="w-full accent-primary mt-2 cursor-pointer"
                />
              </div>
            </div>

            {/* App Manifest Meta */}
            <div className="border-t border-subtle pt-4 flex flex-col gap-3">
              <label className="text-xs font-semibold text-main">
                {t('App Name')}
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="My Web App"
                  className="input w-full mt-1.5 text-sm"
                />
              </label>

              <div>
                <label className="text-xs font-semibold text-main">{t('Theme Color')}</label>
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    type="color"
                    value={appThemeColor}
                    onChange={(e) => setAppThemeColor(e.target.value)}
                    className="w-10 h-9 rounded-lg border border-subtle cursor-pointer p-0.5 bg-transparent"
                  />
                  <span className="text-xs font-mono text-muted uppercase">{appThemeColor}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-auto pt-4 border-t border-subtle flex flex-col gap-2">
              <button
                type="button"
                onClick={downloadZipPack}
                disabled={!sourceImg || busy}
                className="btn btn-primary w-full py-3 min-h-[44px] font-semibold text-sm flex items-center justify-center gap-2"
              >
                <ArrowDownToLine className="w-4 h-4" />
                {busy ? t('Packaging ZIP…') : t('Download Favicon Pack (ZIP)')}
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary w-full py-2.5 min-h-[44px] text-xs flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {sourceImg ? t('Change Source Image') : t('Select Source Image')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
