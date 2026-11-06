import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  ArrowDownToLine,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileCheck,
  Grid,
  Image as ImageIcon,
  Layers,
  RotateCw,
  Sliders,
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
  const [logoScale, setLogoScale] = useState<number>(20); // percentage of base width

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

  // Update preview when current file or parameters change
  useEffect(() => {
    if (files.length === 0) {
      setPreviewUrl('');
      return;
    }
    const cur = files[currentIndex];
    if (!cur) return;

    renderPreview(cur);
  }, [files, currentIndex, mode, text, fontSize, textColor, opacity, angle, position, tileSpacing, logoImg, logoScale]);

  // Load logo image when logo file changes
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

  function handleAddFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const incoming = Array.from(e.target.files).filter((f) => f.type.startsWith('image/'));
    if (incoming.length === 0) return;
    setFiles((prev) => [...prev, ...incoming]);
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;
    const f = e.target.files[0];
    if (f.type.startsWith('image/')) {
      setLogoFile(f);
      setMode('image');
    }
  }

  // Draw watermark on canvas for a given image
  function drawWatermark(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) {
    ctx.save();
    ctx.globalAlpha = opacity;

    if (mode === 'text' && text.trim().length > 0) {
      // Dynamic responsive font size based on image resolution
      const scaledFontSize = Math.max(14, Math.round((fontSize * width) / 1000));
      ctx.font = `bold ${scaledFontSize}px sans-serif`;
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Subtle drop shadow for readability against high-contrast backgrounds
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

  // Render live preview for the currently selected file
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

  // Process a single file to Blob
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

  // Export current image
  async function downloadCurrent() {
    if (files.length === 0) return;
    const cur = files[currentIndex];
    setBusy(true);
    setStatusMsg(t('Generating watermarked image…'));
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

  // Batch Export all images in a ZIP
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
        setStatusMsg(`${t('Processing')} ${i + 1}/${files.length}: ${f.name}`);
        const blob = await processFileToBlob(f);
        const baseName = f.name.substring(0, f.name.lastIndexOf('.')) || f.name;
        zip.file(`${baseName}-watermarked.${ext}`, blob);
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }

      setStatusMsg(t('Packaging ZIP archive…'));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `watermarked-images-${Date.now()}.zip`;
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="watermark-modal-title"
      ref={dialogRef as any}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md overflow-hidden animate-fade-in outline-none"
    >
      <div className="bg-surface border border-subtle rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-surface/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 id="watermark-modal-title" className="text-lg font-bold text-main leading-tight">
                {t('Photo Watermark & Copyright')}
              </h2>
              <p className="text-xs text-muted">
                {t('Stamp custom copyright text or logo with live preview')}
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

        {/* Content Area */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Main Preview Area */}
          <div className="lg:col-span-7 bg-black/30 p-4 flex flex-col items-center justify-center overflow-auto relative">
            <canvas ref={canvasRef} className="hidden" />

            {files.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-subtle hover:border-primary/60 rounded-2xl p-8 max-w-md w-full text-center cursor-pointer transition-all hover:bg-surface/40 flex flex-col items-center justify-center gap-3"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Upload className="w-7 h-7" />
                </div>
                <h3 className="font-semibold text-main text-base">{t('Select images to watermark')}</h3>
                <p className="text-xs text-muted leading-relaxed">
                  {t('Supports PNG, JPG, WebP. Multiple files supported for batch watermarking.')}
                </p>
                <button
                  type="button"
                  className="btn btn-primary mt-2 min-h-[44px] px-5 text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  {t('Choose Images')}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full gap-3">
                {/* Image Preview Box */}
                <div className="relative max-h-[64vh] max-w-full flex items-center justify-center rounded-xl overflow-hidden border border-subtle bg-checkerboard shadow-inner">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Watermarked Preview"
                      className="max-h-[64vh] max-w-full object-contain"
                    />
                  ) : (
                    <div className="p-12 text-sm text-muted">{t('Generating preview…')}</div>
                  )}
                </div>

                {/* Multi-file navigation strip */}
                {files.length > 1 && (
                  <div className="flex items-center gap-3 bg-surface/90 px-4 py-2 rounded-full border border-subtle shadow-sm">
                    <button
                      onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                      disabled={currentIndex === 0}
                      className="p-1.5 rounded-lg text-main hover:bg-surface-hover disabled:opacity-30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label={t('Previous')}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-xs font-semibold text-main">
                      {currentIndex + 1} / {files.length}
                    </span>
                    <button
                      onClick={() => setCurrentIndex((prev) => Math.min(files.length - 1, prev + 1))}
                      disabled={currentIndex === files.length - 1}
                      className="p-1.5 rounded-lg text-main hover:bg-surface-hover disabled:opacity-30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label={t('Next')}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <span className="text-xs text-muted max-w-[150px] truncate">
                      {files[currentIndex]?.name}
                    </span>
                  </div>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleAddFiles}
            />
          </div>

          {/* Controls Sidebar */}
          <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-subtle p-5 overflow-y-auto flex flex-col gap-5 bg-surface">
            {/* Watermark Mode Selector */}
            <div className="flex bg-surface-alt p-1 rounded-xl border border-subtle">
              <button
                type="button"
                onClick={() => setMode('text')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all min-h-[44px] ${
                  mode === 'text'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted hover:text-main'
                }`}
              >
                <Type className="w-4 h-4" />
                {t('Text Watermark')}
              </button>
              <button
                type="button"
                onClick={() => setMode('image')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all min-h-[44px] ${
                  mode === 'image'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted hover:text-main'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                {t('Logo Watermark')}
              </button>
            </div>

            {/* Mode-specific settings */}
            {mode === 'text' ? (
              <div className="flex flex-col gap-3">
                <label className="text-xs font-semibold text-main">
                  {t('Watermark Text')}
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="© Your Name / Brand"
                    className="input w-full mt-1.5 text-sm"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-main">
                      {t('Font Size')} ({fontSize}px)
                    </label>
                    <input
                      type="range"
                      min="14"
                      max="120"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full accent-primary mt-2 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-main">
                      {t('Color')}
                    </label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-10 h-9 rounded-lg border border-subtle cursor-pointer p-0.5 bg-transparent"
                      />
                      <span className="text-xs font-mono text-muted uppercase">{textColor}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <label className="text-xs font-semibold text-main">{t('Logo Image')}</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="btn btn-secondary flex-1 min-h-[44px] text-xs flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    {logoFile ? logoFile.name : t('Upload Logo (PNG/SVG)')}
                  </button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoSelect}
                  />
                </div>
                {logoFile && (
                  <div>
                    <label className="text-xs font-semibold text-main">
                      {t('Logo Scale')} ({logoScale}%)
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="80"
                      value={logoScale}
                      onChange={(e) => setLogoScale(Number(e.target.value))}
                      className="w-full accent-primary mt-2 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Common Positioning and Angle */}
            <div className="border-t border-subtle pt-4 flex flex-col gap-3">
              <label className="text-xs font-semibold text-main">{t('Position')}</label>
              <div className="grid grid-cols-3 gap-2">
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
                    onClick={() => setPosition(pos.id as WatermarkPosition)}
                    className={`py-2 px-1 text-xs rounded-lg border transition-all text-center min-h-[44px] flex items-center justify-center ${
                      position === pos.id
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-subtle hover:bg-surface-hover text-muted'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>

              {position === 'tiled' ? (
                <div>
                  <label className="text-xs font-semibold text-main">
                    {t('Tile Spacing')} ({tileSpacing}px)
                  </label>
                  <input
                    type="range"
                    min="60"
                    max="300"
                    value={tileSpacing}
                    onChange={(e) => setTileSpacing(Number(e.target.value))}
                    className="w-full accent-primary mt-2 cursor-pointer"
                  />
                </div>
              ) : null}

              {/* Opacity & Rotation */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-main">
                    {t('Opacity')} ({Math.round(opacity * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="1"
                    step="0.05"
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="w-full accent-primary mt-2 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-main">
                    {t('Rotation')} ({angle}°)
                  </label>
                  <input
                    type="range"
                    min="-90"
                    max="90"
                    value={angle}
                    onChange={(e) => setAngle(Number(e.target.value))}
                    className="w-full accent-primary mt-2 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Export Settings */}
            <div className="border-t border-subtle pt-4 flex flex-col gap-3">
              <label className="text-xs font-semibold text-main">{t('Export Format')}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormat('image/jpeg')}
                  className={`py-2 text-xs font-semibold rounded-lg border min-h-[44px] flex items-center justify-center ${
                    format === 'image/jpeg'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-subtle text-muted hover:bg-surface-hover'
                  }`}
                >
                  JPEG (Quality {Math.round(quality * 100)}%)
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('image/png')}
                  className={`py-2 text-xs font-semibold rounded-lg border min-h-[44px] flex items-center justify-center ${
                    format === 'image/png'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-subtle text-muted hover:bg-surface-hover'
                  }`}
                >
                  PNG (Lossless)
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-auto pt-4 border-t border-subtle flex flex-col gap-2">
              {busy ? (
                <div className="flex flex-col gap-2 bg-primary/5 p-3 rounded-xl border border-primary/20">
                  <div className="flex justify-between text-xs font-semibold text-primary">
                    <span>{statusMsg || t('Processing…')}</span>
                    {progress > 0 && <span>{progress}%</span>}
                  </div>
                  {progress > 0 && (
                    <div className="w-full bg-surface-alt rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={downloadCurrent}
                    disabled={files.length === 0}
                    className="btn btn-primary w-full py-3 min-h-[44px] font-semibold text-sm flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    {t('Download Current Photo')}
                  </button>

                  {files.length > 1 && (
                    <button
                      type="button"
                      onClick={downloadAllZip}
                      className="btn btn-secondary w-full py-2.5 min-h-[44px] font-semibold text-xs flex items-center justify-center gap-2"
                    >
                      <ArrowDownToLine className="w-4 h-4" />
                      {t('Download All')} ({files.length}) {t('as ZIP')}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-ghost w-full py-2 min-h-[44px] text-xs text-muted hover:text-main"
                  >
                    + {t('Add More Photos')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
