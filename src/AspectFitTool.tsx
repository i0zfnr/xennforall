import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Download,
  Image as ImageIcon,
  Maximize2,
  Palette,
  ShieldCheck,
  Smartphone,
  Square,
  Upload,
  X
} from 'lucide-react';

interface AspectFitToolProps {
  initialFiles?: File[];
  close: () => void;
}

type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9' | '3:4';
type BgMode = 'blur' | 'color' | 'gradient';

interface AspectOption {
  id: AspectRatio;
  label: string;
  w: number;
  h: number;
  sub: string;
}

const RATIO_OPTIONS: AspectOption[] = [
  { id: '1:1', label: '1:1', w: 1, h: 1, sub: 'Square' },
  { id: '4:5', label: '4:5', w: 4, h: 5, sub: 'Instagram' },
  { id: '9:16', label: '9:16', w: 9, h: 16, sub: 'Story / TikTok' },
  { id: '16:9', label: '16:9', w: 16, h: 9, sub: 'YouTube / X' },
  { id: '3:4', label: '3:4', w: 3, h: 4, sub: 'Portrait' }
];

export default function AspectFitTool({ initialFiles = [], close }: AspectFitToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);

  // Fit settings
  const [ratio, setRatio] = useState<AspectRatio>('1:1');
  const [bgMode, setBgMode] = useState<BgMode>('blur');
  const [blurAmount, setBlurAmount] = useState<number>(24);
  const [bgColor, setBgColor] = useState<string>('#000000');
  const [imageScale, setImageScale] = useState<number>(85); // percent size inside canvas
  const [borderRadius, setBorderRadius] = useState<number>(12); // px
  const [shadow, setShadow] = useState<boolean>(true);

  // Preview & Export
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [format, setFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg');

  // DOM Refs
  const dialogRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  // Render on change
  useEffect(() => {
    if (!sourceImg) return;
    renderCanvas();
  }, [sourceImg, ratio, bgMode, blurAmount, bgColor, imageScale, borderRadius, shadow, format]);

  function renderCanvas(): HTMLCanvasElement | null {
    const canvas = canvasRef.current;
    if (!canvas || !sourceImg) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const opt = RATIO_OPTIONS.find((r) => r.id === ratio) || RATIO_OPTIONS[0];

    // Canvas target resolution (high res 1080p minimum base)
    const baseDimension = 1080;
    let targetW = baseDimension;
    let targetH = Math.round((baseDimension * opt.h) / opt.w);

    if (opt.h > opt.w) {
      targetH = 1350;
      targetW = Math.round((targetH * opt.w) / opt.h);
      if (opt.id === '9:16') {
        targetH = 1920;
        targetW = 1080;
      }
    } else if (opt.w > opt.h) {
      targetW = 1920;
      targetH = 1080;
    }

    canvas.width = targetW;
    canvas.height = targetH;
    ctx.clearRect(0, 0, targetW, targetH);

    // 1. Draw Background
    if (bgMode === 'blur') {
      ctx.save();
      // Draw zoomed blurred image to fill target
      const scaleCover = Math.max(targetW / sourceImg.width, targetH / sourceImg.height);
      const coverW = sourceImg.width * scaleCover;
      const coverH = sourceImg.height * scaleCover;
      const coverX = (targetW - coverW) / 2;
      const coverY = (targetH - coverH) / 2;

      ctx.filter = `blur(${blurAmount}px) brightness(0.7)`;
      ctx.drawImage(sourceImg, coverX, coverY, coverW, coverH);
      ctx.restore();
    } else if (bgMode === 'color') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, targetW, targetH);
    } else if (bgMode === 'gradient') {
      const g = ctx.createLinearGradient(0, 0, targetW, targetH);
      g.addColorStop(0, '#1e1e2f');
      g.addColorStop(1, '#0f0f17');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, targetW, targetH);
    }

    // 2. Calculate Main Subject Fit (Contain)
    const maxW = targetW * (imageScale / 100);
    const maxH = targetH * (imageScale / 100);
    const imgAspect = sourceImg.width / sourceImg.height;

    let drawW = maxW;
    let drawH = drawW / imgAspect;

    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH * imgAspect;
    }

    const drawX = (targetW - drawW) / 2;
    const drawY = (targetH - drawH) / 2;

    // 3. Draw Shadow & Rounded Corners
    ctx.save();
    if (shadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 16;
    }

    ctx.beginPath();
    ctx.roundRect(drawX, drawY, drawW, drawH, borderRadius);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.restore();

    // Clip image to rounded rect
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(drawX, drawY, drawW, drawH, borderRadius);
    ctx.clip();
    ctx.drawImage(sourceImg, drawX, drawY, drawW, drawH);
    ctx.restore();

    setPreviewUrl(canvas.toDataURL(format, 0.95));
    return canvas;
  }

  function downloadFittedImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const ext = format === 'image/jpeg' ? 'jpg' : 'png';
      const baseName = file?.name.substring(0, file.name.lastIndexOf('.')) || 'fitted-photo';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${baseName}-${ratio.replace(':', 'x')}.${ext}`;
      link.click();
      URL.revokeObjectURL(link.href);
    }, format, 0.95);
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={close}>
      <section
        ref={dialogRef as any}
        tabIndex={-1}
        className="tool-workspace aspectfit-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aspectfit-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            close();
          }
        }}
      >
        {/* Topbar */}
        <div className="workspace-topbar">
          <button className="workspace-back" onClick={close}>
            <ArrowRight size={15} />
            {t('All tools')}
          </button>
          <span className="workspace-private">
            <ShieldCheck size={14} />
            {t('Private & Client-Side · 100% In-Browser')}
          </span>
          <button className="workspace-close" onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon coral">
            <Maximize2 size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Social media')} <span>/</span> {t('ASPECT RATIO FIT & BLUR FILL')}
              </span>
              <span className="hd-pill">NO CROP</span>
            </div>
            <h2 id="aspectfit-title">{t('Aspect Ratio Fit & Blur Background')}</h2>
            <p>
              {t('Fit any photo into Instagram, TikTok, Reels, or YouTube aspect ratios without cropping, using blurred frosted borders or solid backdrops.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Zero Crop · High Resolution')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {sourceImg ? `${t('RATIO PREVIEW')} (${ratio})` : t('PHOTO STAGE')}
              </span>
              <span>{file ? file.name : t('Select photo')}</span>
            </div>

            <canvas ref={canvasRef} style={{ display: 'none' }} />

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
                  <Maximize2 size={34} />
                </div>
                <h3>{t('Drop photo to fit social aspect ratio')}</h3>
                <p>{t('Supports PNG, JPG, WebP. Fits seamlessly into 1:1, 4:5, 9:16, or 16:9.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Choose Image')}
                </span>
              </button>
            ) : (
              <div className="aspectfit-stage-wrap">
                <div className="aspectfit-preview-box">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Fitted Preview" className="aspectfit-preview-img" />
                  ) : (
                    <div className="preview-loading">{t('Rendering preview…')}</div>
                  )}
                </div>

                <div className="aspectfit-action-row">
                  <button
                    type="button"
                    className="download-btn-green"
                    onClick={downloadFittedImage}
                  >
                    <Download size={16} />
                    {t('Download Fitted Image')} ({ratio})
                  </button>
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
              <label>{t('Target Aspect Ratio')}</label>
              <div className="aspect-ratio-grid">
                {RATIO_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`aspect-chip ${ratio === opt.id ? 'active' : ''}`}
                    onClick={() => setRatio(opt.id)}
                  >
                    <strong>{opt.label}</strong>
                    <small>{opt.sub}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <label>{t('Background Mode')}</label>
              <div className="btn-toggle-group">
                <button
                  type="button"
                  className={bgMode === 'blur' ? 'active' : ''}
                  onClick={() => setBgMode('blur')}
                >
                  {t('Blur Image')}
                </button>
                <button
                  type="button"
                  className={bgMode === 'color' ? 'active' : ''}
                  onClick={() => setBgMode('color')}
                >
                  {t('Solid Color')}
                </button>
                <button
                  type="button"
                  className={bgMode === 'gradient' ? 'active' : ''}
                  onClick={() => setBgMode('gradient')}
                >
                  {t('Dark Gradient')}
                </button>
              </div>
            </div>

            {bgMode === 'blur' && (
              <div className="control-group">
                <div className="slider-label-row">
                  <span>{t('Backdrop Blur')}</span>
                  <strong>{blurAmount}px</strong>
                </div>
                <input
                  type="range"
                  min="8"
                  max="50"
                  value={blurAmount}
                  onChange={(e) => setBlurAmount(Number(e.target.value))}
                />
              </div>
            )}

            {bgMode === 'color' && (
              <div className="control-group">
                <label>{t('Matte Color')}</label>
                <div className="color-picker-row">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="color-swatch-input"
                  />
                  <span className="color-hex-tag">{bgColor.toUpperCase()}</span>
                </div>
              </div>
            )}

            <div className="control-group">
              <div className="slider-label-row">
                <span>{t('Image Scale')}</span>
                <strong>{imageScale}%</strong>
              </div>
              <input
                type="range"
                min="50"
                max="100"
                value={imageScale}
                onChange={(e) => setImageScale(Number(e.target.value))}
              />
            </div>

            <div className="control-group">
              <div className="slider-label-row">
                <span>{t('Corner Radius')}</span>
                <strong>{borderRadius}px</strong>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                value={borderRadius}
                onChange={(e) => setBorderRadius(Number(e.target.value))}
              />
            </div>

            <div className="control-group toggle-row-card">
              <div className="toggle-info">
                <span>{t('Drop Shadow')}</span>
              </div>
              <input
                type="checkbox"
                checked={shadow}
                onChange={(e) => setShadow(e.target.checked)}
                className="custom-toggle-input"
              />
            </div>

            <button
              type="button"
              className="btn-change-file"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} />
              {sourceImg ? t('Change Photo') : t('Select Photo')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
