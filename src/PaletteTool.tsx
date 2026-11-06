import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Copy,
  Download,
  Eye,
  Image as ImageIcon,
  Palette,
  Pipette,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Upload,
  X
} from 'lucide-react';

interface PaletteColor {
  hex: string;
  rgb: string;
  hsl: string;
  contrastWhite: number;
  contrastBlack: number;
}

interface PaletteToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function PaletteTool({ initialFiles = [], close }: PaletteToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [colors, setColors] = useState<PaletteColor[]>([]);
  const [pickedColor, setPickedColor] = useState<PaletteColor | null>(null);
  const [copiedText, setCopiedText] = useState<string>('');

  // Eyedropper Magnifier State
  const [eyedropperActive, setEyedropperActive] = useState<boolean>(true);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverColor, setHoverColor] = useState<string>('#ffffff');

  // DOM Refs
  const dialogRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  // Initial file
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFileSelected(initialFiles[0]);
    }
  }, []);

  function handleFileSelected(f?: File) {
    if (!f) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(f);
    setFile(f);
    setImageUrl(url);
    setColors([]);
    setPickedColor(null);

    const img = new Image();
    img.onload = () => {
      imageElementRef.current = img;
      extractPalette(img);
      drawToCanvas(img);
    };
    img.src = url;
  }

  function drawToCanvas(img: HTMLImageElement) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const maxDim = 800;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, w, h);
  }

  // Calculate relative luminance for WCAG contrast
  function getLuminance(r: number, g: number, b: number): number {
    const a = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  function makeColorObject(r: number, g: number, b: number): PaletteColor {
    const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
    const lum = getLuminance(r, g, b);
    const contrastWhite = Number(((1.0 + 0.05) / (lum + 0.05)).toFixed(1));
    const contrastBlack = Number(((lum + 0.05) / (0.0 + 0.05)).toFixed(1));

    // RGB to HSL
    const r1 = r / 255;
    const g1 = g / 255;
    const b1 = b / 255;
    const max = Math.max(r1, g1, b1);
    const min = Math.min(r1, g1, b1);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r1: h = (g1 - b1) / d + (g1 < b1 ? 6 : 0); break;
        case g1: h = (b1 - r1) / d + 2; break;
        case b1: h = (r1 - g1) / d + 4; break;
      }
      h /= 6;
    }

    return {
      hex,
      rgb: `rgb(${r}, ${g}, ${b})`,
      hsl: `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`,
      contrastWhite,
      contrastBlack
    };
  }

  // Extract Dominant Palette from Image Canvas
  function extractPalette(img: HTMLImageElement) {
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 100;
    sampleCanvas.height = 100;
    const ctx = sampleCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, 100, 100);

    const imgData = ctx.getImageData(0, 0, 100, 100).data;
    const colorBuckets = new Map<string, { count: number; r: number; g: number; b: number }>();

    for (let i = 0; i < imgData.length; i += 16) {
      const r = (imgData[i] >> 4) << 4;
      const g = (imgData[i + 1] >> 4) << 4;
      const b = (imgData[i + 2] >> 4) << 4;
      const key = `${r},${g},${b}`;

      const item = colorBuckets.get(key);
      if (item) {
        item.count++;
      } else {
        colorBuckets.set(key, { count: 1, r, g, b });
      }
    }

    // Sort by prevalence
    const sorted = Array.from(colorBuckets.values()).sort((a, b) => b.count - a.count);
    const topColors: PaletteColor[] = [];
    const minDistance = 45;

    for (const item of sorted) {
      if (topColors.length >= 6) break;
      // Ensure color is distinct
      const isTooClose = topColors.some((c) => {
        const rgb = c.hex
          .slice(1)
          .match(/.{2}/g)!
          .map((x) => parseInt(x, 16));
        const dist = Math.hypot(item.r - rgb[0], item.g - rgb[1], item.b - rgb[2]);
        return dist < minDistance;
      });

      if (!isTooClose) {
        topColors.push(makeColorObject(item.r, item.g, item.b));
      }
    }

    setColors(topColors);
    if (topColors.length > 0) setPickedColor(topColors[0]);
  }

  // Mouse Eyedropper on Canvas
  function handleCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const hex = `#${[pixel[0], pixel[1], pixel[2]].map((p) => p.toString(16).padStart(2, '0')).join('')}`;
      setHoverColor(hex);
      setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const newColor = makeColorObject(pixel[0], pixel[1], pixel[2]);
    setPickedColor(newColor);
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 2000);
  }

  // Generate PNG Palette Swatch Sheet
  function downloadSwatchSheet() {
    if (colors.length === 0) return;
    const swatchCanvas = document.createElement('canvas');
    swatchCanvas.width = 1200;
    swatchCanvas.height = 360;
    const ctx = swatchCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1200, 360);

    const colWidth = 1200 / colors.length;
    colors.forEach((c, idx) => {
      const x = idx * colWidth;
      ctx.fillStyle = c.hex;
      ctx.fillRect(x, 0, colWidth, 260);

      // Label bar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x, 260, colWidth, 100);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(c.hex.toUpperCase(), x + colWidth / 2, 315);
    });

    const url = swatchCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'color-palette-swatches.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={close}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace palette-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="palette-title"
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
            {t('Private & Client-Side · In-Browser WCAG Contrast Checker')}
          </span>
          <button className="workspace-close" onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon emerald">
            <Palette size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Design tools')} <span>/</span> {t('COLOR PALETTE & EYEDROPPER')}
              </span>
              <span className="hd-pill">WCAG AA/AAA CHECKER</span>
            </div>
            <h2 id="palette-title">{t('Color Palette & Eyedropper Studio')}</h2>
            <p>
              {t('Extract dominant color schemes from photos, inspect WCAG contrast, and click any pixel to sample colors.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Pixel Loupe · Hex & HSL')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Visual Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {file ? t('CLICK ANY PIXEL TO SAMPLE COLOR') : t('PALETTE STUDIO')}
              </span>
              <span>{file ? file.name : t('Select photo')}</span>
            </div>

            {!file ? (
              <button
                className="workspace-empty"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileSelected(e.dataTransfer.files[0]);
                }}
              >
                <div className="empty-circle">
                  <Palette size={34} />
                </div>
                <h3>{t('Drop image to extract color palette')}</h3>
                <p>{t('Supports JPG, PNG, and WebP. Automatically generates 6-color palettes and WCAG scores.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Select image')}
                </span>
              </button>
            ) : (
              <div className="palette-stage-wrap">
                <div className="palette-canvas-container">
                  <canvas
                    ref={canvasRef}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseLeave={() => setCursorPos(null)}
                    onClick={handleCanvasClick}
                    className="palette-interactive-canvas"
                  />

                  {/* Floating Magnifier Circle */}
                  {cursorPos && (
                    <div
                      className="palette-hover-loupe"
                      style={{
                        left: `${cursorPos.x + 16}px`,
                        top: `${cursorPos.y + 16}px`,
                        backgroundColor: hoverColor
                      }}
                    >
                      <span className="loupe-hex">{hoverColor.toUpperCase()}</span>
                    </div>
                  )}
                </div>

                {/* Extracted Swatches Row */}
                {colors.length > 0 && (
                  <div className="palette-swatches-row">
                    {colors.map((c) => (
                      <div
                        key={c.hex}
                        className={`palette-swatch-card ${pickedColor?.hex === c.hex ? 'active' : ''}`}
                        onClick={() => setPickedColor(c)}
                      >
                        <div className="swatch-color-box" style={{ backgroundColor: c.hex }} />
                        <div className="swatch-meta">
                          <strong>{c.hex.toUpperCase()}</strong>
                          <small>
                            {c.contrastWhite >= 4.5 ? 'AA White' : c.contrastBlack >= 4.5 ? 'AA Black' : ''}
                          </small>
                        </div>
                      </div>
                    ))}
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
              accept="image/*,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                handleFileSelected(e.target.files?.[0]);
                e.target.value = '';
              }}
            />

            {pickedColor && (
              <>
                <div className="control-group">
                  <label>{t('Selected Color Specs')}</label>
                  <div className="picked-color-hero-card">
                    <div className="picked-color-chip" style={{ backgroundColor: pickedColor.hex }} />
                    <div className="picked-color-info">
                      <strong>{pickedColor.hex.toUpperCase()}</strong>
                      <span>{pickedColor.rgb}</span>
                      <span>{pickedColor.hsl}</span>
                    </div>
                  </div>
                </div>

                <div className="control-group">
                  <label>{t('WCAG Accessibility Contrast')}</label>
                  <div className="spec-card">
                    <div className="spec-row">
                      <span>{t('Against White (#fff)')}</span>
                      <strong className={pickedColor.contrastWhite >= 4.5 ? 'badge-green' : 'badge-red'}>
                        {pickedColor.contrastWhite}:1 {pickedColor.contrastWhite >= 7 ? '(AAA)' : pickedColor.contrastWhite >= 4.5 ? '(AA)' : '(Fail)'}
                      </strong>
                    </div>
                    <div className="spec-row">
                      <span>{t('Against Black (#000)')}</span>
                      <strong className={pickedColor.contrastBlack >= 4.5 ? 'badge-green' : 'badge-red'}>
                        {pickedColor.contrastBlack}:1 {pickedColor.contrastBlack >= 7 ? '(AAA)' : pickedColor.contrastBlack >= 4.5 ? '(AA)' : '(Fail)'}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="control-group">
                  <label>{t('Quick Copy')}</label>
                  <div className="btn-toggle-group">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(pickedColor.hex.toUpperCase(), 'HEX')}
                    >
                      <Copy size={14} />
                      {copiedText === 'HEX' ? t('Copied!') : 'HEX'}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(pickedColor.rgb, 'RGB')}
                    >
                      <Copy size={14} />
                      {copiedText === 'RGB' ? t('Copied!') : 'RGB'}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(pickedColor.hsl, 'HSL')}
                    >
                      <Copy size={14} />
                      {copiedText === 'HSL' ? t('Copied!') : 'HSL'}
                    </button>
                  </div>
                </div>

                <div className="control-group">
                  <button
                    className="primary-action small"
                    onClick={() => {
                      const cssVars = colors.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join('\n');
                      copyToClipboard(`:root {\n${cssVars}\n}`, 'CSS');
                    }}
                  >
                    <Copy size={15} />
                    {copiedText === 'CSS' ? t('Copied CSS Variables!') : t('Copy All CSS Variables')}
                  </button>
                </div>

                <button className="download-btn-green" onClick={downloadSwatchSheet}>
                  <Download size={17} />
                  {t('Download Swatch Sheet (PNG)')}
                </button>
              </>
            )}

            {file && (
              <button
                className="btn-change-file"
                onClick={() => fileInputRef.current?.click()}
              >
                {t('Change photo')}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
