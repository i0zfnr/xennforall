import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  ArrowDownToLine,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Image as ImageIcon,
  Layers,
  ShieldCheck,
  Type,
  Upload,
  X
} from 'lucide-react';

interface WatermarkImageToolProps {
  initialFiles?: File[];
  close: () => void;
}

type WatermarkMode = 'text' | 'image';
type WatermarkPosition = 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'tiled';

export default function WatermarkImageTool({ initialFiles = [], close }: WatermarkImageToolProps) {
  const [files, setFiles] = useState<File[]>(initialFiles);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // Watermark Settings
  const [mode, setMode] = useState<WatermarkMode>('text');
  const [text, setText] = useState<string>('© Xenn for all');
  const [fontSize, setFontSize] = useState<number>(36);
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [opacity, setOpacity] = useState<number>(0.7);
  const [angle, setAngle] = useState<number>(-25);
  const [position, setPosition] = useState<WatermarkPosition>('bottom-right');
  const [tileSpacing, setTileSpacing] = useState<number>(140);

  // Logo Watermark
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoScale, setLogoScale] = useState<number>(20);

  // Processing & Export
  const [busy, setBusy] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [format, setFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [quality, setQuality] = useState<number>(0.92);

  // DOM Refs
  const dialogRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

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

  // Update preview when dependencies change
  useEffect(() => {
    if (files.length === 0) {
      setPreviewUrl('');
      return;
    }
    const cur = files[currentIndex];
    if (!cur) return;
    renderPreview(cur);
  }, [files, currentIndex, mode, text, fontSize, textColor, opacity, angle, position, tileSpacing, logoImg, logoScale, format, quality]);

  // Load logo image
  useEffect(() => {
    if (!logoFile) {
      setLogoImg(null);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(logoFile);
    img.onload = () => {
      setLogoImg(img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [logoFile]);

  function handleAddFiles(incoming: FileList | null) {
    if (!incoming) return;
    const valid = Array.from(incoming).filter((f) => f.type.startsWith('image/'));
    if (valid.length === 0) return;
    setFiles((prev) => [...prev, ...valid]);
  }

  function handleLogoSelect(f: File | undefined) {
    if (!f || !f.type.startsWith('image/')) return;
    setLogoFile(f);
    setMode('image');
  }

  // Draw watermark on canvas
  function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save();
    ctx.globalAlpha = opacity;

    if (mode === 'text' && text.trim().length > 0) {
      const scaledFontSize = Math.max(14, Math.round((fontSize * width) / 1000));
      ctx.font = `bold ${scaledFontSize}px sans-serif`;
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = Math.round(scaledFontSize / 4);
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      if (position === 'tiled') {
        const step = Math.max(80, Math.round((tileSpacing * width) / 1000));
        ctx.translate(width / 2, height / 2);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.translate(-width / 2, -height / 2);

        const diag = Math.sqrt(width * width + height * height);
        for (let x = -diag; x < width + diag; x += step * 2) {
          for (let y = -diag; y < height + diag; y += step) {
            ctx.fillText(text, x, y);
          }
        }
      } else {
        let x = width / 2;
        let y = height / 2;
        const padding = Math.max(20, Math.round(width * 0.04));

        if (position === 'top-left') {
          ctx.textAlign = 'left';
          x = padding;
          y = padding + scaledFontSize / 2;
        } else if (position === 'top-right') {
          ctx.textAlign = 'right';
          x = width - padding;
          y = padding + scaledFontSize / 2;
        } else if (position === 'bottom-left') {
          ctx.textAlign = 'left';
          x = padding;
          y = height - padding - scaledFontSize / 2;
        } else if (position === 'bottom-right') {
          ctx.textAlign = 'right';
          x = width - padding;
          y = height - padding - scaledFontSize / 2;
        }

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
    } else if (mode === 'image' && logoImg) {
      const targetWidth = (width * logoScale) / 100;
      const aspect = logoImg.width / logoImg.height;
      const targetHeight = targetWidth / aspect;
      const padding = Math.max(16, Math.round(width * 0.03));

      let x = (width - targetWidth) / 2;
      let y = (height - targetHeight) / 2;

      if (position === 'top-left') {
        x = padding;
        y = padding;
      } else if (position === 'top-right') {
        x = width - targetWidth - padding;
        y = padding;
      } else if (position === 'bottom-left') {
        x = padding;
        y = height - targetHeight - padding;
      } else if (position === 'bottom-right') {
        x = width - targetWidth - padding;
        y = height - targetHeight - padding;
      } else if (position === 'tiled') {
        const step = Math.max(120, Math.round((tileSpacing * width) / 1000));
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.translate(-width / 2, -height / 2);

        const diag = Math.sqrt(width * width + height * height);
        for (let ix = -diag; ix < width + diag; ix += step + targetWidth) {
          for (let iy = -diag; iy < height + diag; iy += step + targetHeight) {
            ctx.drawImage(logoImg, ix, iy, targetWidth, targetHeight);
          }
        }
        ctx.restore();
        ctx.restore();
        return;
      }

      ctx.save();
      ctx.translate(x + targetWidth / 2, y + targetHeight / 2);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.drawImage(logoImg, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
      ctx.restore();
    }

    ctx.restore();
  }

  // Render live preview
  async function renderPreview(file: File) {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        URL.revokeObjectURL(url);
        return;
      }
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }

      ctx.clearRect(0, 0, img.width, img.height);
      ctx.drawImage(img, 0, 0);
      drawWatermark(ctx, img.width, img.height);

      setPreviewUrl(canvas.toDataURL(format, quality));
      URL.revokeObjectURL(url);
    };

    img.src = url;
  }

  // Process file to Blob
  function processFileToBlob(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        drawWatermark(ctx, img.width, img.height);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (blob) resolve(blob);
            else reject(new Error('Canvas export failed'));
          },
          format,
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  // Download current image
  async function downloadCurrent() {
    if (files.length === 0) return;
    const cur = files[currentIndex];
    setBusy(true);
    try {
      const blob = await processFileToBlob(cur);
      const ext = format === 'image/jpeg' ? 'jpg' : 'png';
      const baseName = cur.name.substring(0, cur.name.lastIndexOf('.')) || cur.name;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${baseName}-watermarked.${ext}`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err: any) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  // Batch download ZIP
  async function downloadAllZip() {
    if (files.length === 0) return;
    setBusy(true);
    setStatusMsg(t('Processing batch watermarks…'));
    setProgress(0);

    try {
      const zip = new JSZip();
      const ext = format === 'image/jpeg' ? 'jpg' : 'png';

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setStatusMsg(`${t('Processing')} ${i + 1}/${files.length}`);
        const blob = await processFileToBlob(f);
        const baseName = f.name.substring(0, f.name.lastIndexOf('.')) || f.name;
        zip.file(`${baseName}-watermarked.${ext}`, blob);
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }

      setStatusMsg(t('Packaging ZIP archive…'));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `watermarked-photos-${Date.now()}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err: any) {
      console.error('Batch watermark error:', err);
    } finally {
      setBusy(false);
      setProgress(0);
      setStatusMsg('');
    }
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={close}>
      <section
        ref={dialogRef as any}
        tabIndex={-1}
        className="tool-workspace watermark-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="watermark-title"
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
          <span className="tool-icon coral">
            <Layers size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Image tools')} <span>/</span> {t('PHOTO WATERMARK & COPYRIGHT')}
              </span>
              <span className="hd-pill">BATCH READY</span>
            </div>
            <h2 id="watermark-title">{t('Photo Watermark & Copyright')}</h2>
            <p>
              {t('Stamp custom copyright text or logo with live preview and batch export')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Tiled Protection · Batch ZIP')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Visual Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {files.length > 0 ? `${t('WATERMARK PREVIEW')} (${currentIndex + 1}/${files.length})` : t('PHOTO CANVAS')}
              </span>
              <span>{files[currentIndex]?.name || t('Select images')}</span>
            </div>

            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {files.length === 0 ? (
              <button
                className="workspace-empty"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleAddFiles(e.dataTransfer.files);
                }}
              >
                <div className="empty-circle">
                  <Layers size={34} />
                </div>
                <h3>{t('Select images to watermark')}</h3>
                <p>{t('Supports PNG, JPG, WebP. Multiple files supported for batch watermarking.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Choose Images')}
                </span>
              </button>
            ) : (
              <div className="watermark-stage-wrap">
                <div className="watermark-preview-box">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Watermarked Preview" className="watermark-preview-img" />
                  ) : (
                    <div className="preview-loading">{t('Generating preview…')}</div>
                  )}
                </div>

                {/* Multi-file pagination strip */}
                {files.length > 1 && (
                  <div className="watermark-carousel-strip">
                    <button
                      type="button"
                      className="nav-strip-btn"
                      onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                      disabled={currentIndex === 0}
                      aria-label={t('Previous')}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="nav-strip-counter">
                      {currentIndex + 1} / {files.length}
                    </span>
                    <button
                      type="button"
                      className="nav-strip-btn"
                      onClick={() => setCurrentIndex((prev) => Math.min(files.length - 1, prev + 1))}
                      disabled={currentIndex === files.length - 1}
                      aria-label={t('Next')}
                    >
                      <ChevronRight size={16} />
                    </button>
                    <span className="nav-strip-filename truncate">{files[currentIndex]?.name}</span>
                  </div>
                )}

                {/* Action Row */}
                <div className="watermark-action-row">
                  <button
                    type="button"
                    className="download-btn-green"
                    disabled={busy || files.length === 0}
                    onClick={downloadCurrent}
                  >
                    <Download size={16} />
                    {t('Download Current Photo')}
                  </button>

                  {files.length > 1 && (
                    <button
                      type="button"
                      className="primary-action"
                      disabled={busy}
                      onClick={downloadAllZip}
                    >
                      <ArrowDownToLine size={16} />
                      {t('Download All')} ({files.length}) {t('as ZIP')}
                    </button>
                  )}
                </div>

                {busy && (
                  <div className="watermark-status-box">
                    <span>{statusMsg || t('Processing…')}</span>
                    {progress > 0 && <small>{progress}%</small>}
                  </div>
                )}
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
              multiple
              onChange={(e) => {
                handleAddFiles(e.target.files);
                e.target.value = '';
              }}
            />

            <input
              ref={logoInputRef}
              type="file"
              hidden
              accept="image/*"
              onChange={(e) => {
                handleLogoSelect(e.target.files?.[0]);
                e.target.value = '';
              }}
            />

            {/* Mode switch */}
            <div className="control-group">
              <label>{t('Watermark Type')}</label>
              <div className="btn-toggle-group">
                <button
                  type="button"
                  className={mode === 'text' ? 'active' : ''}
                  onClick={() => setMode('text')}
                >
                  <Type size={14} />
                  {t('Text Watermark')}
                </button>
                <button
                  type="button"
                  className={mode === 'image' ? 'active' : ''}
                  onClick={() => setMode('image')}
                >
                  <ImageIcon size={14} />
                  {t('Logo Watermark')}
                </button>
              </div>
            </div>

            {mode === 'text' ? (
              <>
                <div className="control-group">
                  <label>{t('Watermark Text')}</label>
                  <input
                    type="text"
                    className="tool-input-text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="© Your Brand / Name"
                  />
                </div>

                <div className="control-group">
                  <div className="slider-label-row">
                    <span>{t('Font Size')}</span>
                    <strong>{fontSize}px</strong>
                  </div>
                  <input
                    type="range"
                    min="14"
                    max="120"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                  />
                </div>

                <div className="control-group">
                  <label>{t('Color')}</label>
                  <div className="color-picker-row">
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="color-swatch-input"
                    />
                    <span className="color-hex-tag">{textColor.toUpperCase()}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="control-group">
                <label>{t('Logo Image')}</label>
                <button
                  type="button"
                  className="btn-change-file"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Upload size={14} />
                  {logoFile ? logoFile.name : t('Upload Logo (PNG/SVG)')}
                </button>

                {logoFile && (
                  <div className="slider-label-row mt-2">
                    <span>{t('Logo Scale')}</span>
                    <strong>{logoScale}%</strong>
                    <input
                      type="range"
                      min="5"
                      max="80"
                      value={logoScale}
                      onChange={(e) => setLogoScale(Number(e.target.value))}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Position */}
            <div className="control-group">
              <label>{t('Position')}</label>
              <div className="position-grid">
                {[
                  { id: 'top-left', label: t('Top Left') },
                  { id: 'center', label: t('Center') },
                  { id: 'top-right', label: t('Top Right') },
                  { id: 'bottom-left', label: t('Bottom Left') },
                  { id: 'bottom-right', label: t('Bottom Right') },
                  { id: 'tiled', label: t('Tiled Grid') }
                ].map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    className={`pos-chip ${position === pos.id ? 'active' : ''}`}
                    onClick={() => setPosition(pos.id as WatermarkPosition)}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            {position === 'tiled' && (
              <div className="control-group">
                <div className="slider-label-row">
                  <span>{t('Tile Spacing')}</span>
                  <strong>{tileSpacing}px</strong>
                </div>
                <input
                  type="range"
                  min="60"
                  max="300"
                  value={tileSpacing}
                  onChange={(e) => setTileSpacing(Number(e.target.value))}
                />
              </div>
            )}

            {/* Opacity & Rotation */}
            <div className="control-group">
              <div className="slider-label-row">
                <span>{t('Opacity')}</span>
                <strong>{Math.round(opacity * 100)}%</strong>
              </div>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
              />
            </div>

            <div className="control-group">
              <div className="slider-label-row">
                <span>{t('Rotation')}</span>
                <strong>{angle}°</strong>
              </div>
              <input
                type="range"
                min="-90"
                max="90"
                value={angle}
                onChange={(e) => setAngle(Number(e.target.value))}
              />
            </div>

            {/* Format */}
            <div className="control-group">
              <label>{t('Export Format')}</label>
              <div className="btn-toggle-group">
                <button
                  type="button"
                  className={format === 'image/jpeg' ? 'active' : ''}
                  onClick={() => setFormat('image/jpeg')}
                >
                  JPEG
                </button>
                <button
                  type="button"
                  className={format === 'image/png' ? 'active' : ''}
                  onClick={() => setFormat('image/png')}
                >
                  PNG
                </button>
              </div>
            </div>

            <button
              type="button"
              className="btn-change-file"
              onClick={() => fileInputRef.current?.click()}
            >
              + {t('Add More Photos')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
