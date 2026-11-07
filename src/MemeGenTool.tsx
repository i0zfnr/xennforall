import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  ShieldCheck,
  Smile,
  Type,
  Upload,
  X
} from 'lucide-react';

interface MemeGenToolProps {
  initialFiles?: File[];
  close: () => void;
}

type MemeStyle = 'classic' | 'modern';

export default function MemeGenTool({ initialFiles = [], close }: MemeGenToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);

  // Meme text
  const [topText, setTopText] = useState<string>('WHEN THE CLIENT-SIDE TOOL');
  const [bottomText, setBottomText] = useState<string>('RUNS 100% IN BROWSER MEMORY');
  const [memeStyle, setMemeStyle] = useState<MemeStyle>('classic');
  const [fontSize, setFontSize] = useState<number>(44);
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [allCaps, setAllCaps] = useState<boolean>(true);

  // Preview & Export
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [copiedImg, setCopiedImg] = useState<boolean>(false);

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

  // Draw meme on canvas
  useEffect(() => {
    if (!sourceImg) return;
    renderMeme();
  }, [sourceImg, topText, bottomText, memeStyle, fontSize, textColor, allCaps]);

  function renderMeme(): HTMLCanvasElement | null {
    const canvas = canvasRef.current;
    if (!canvas || !sourceImg) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imgW = sourceImg.width;
    const imgH = sourceImg.height;

    if (memeStyle === 'classic') {
      canvas.width = imgW;
      canvas.height = imgH;
      ctx.drawImage(sourceImg, 0, 0);

      // Scaled font size relative to image resolution
      const scaledSize = Math.max(20, Math.round((fontSize * imgW) / 800));
      ctx.font = `900 ${scaledSize}px Impact, "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = textColor;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(3, Math.round(scaledSize / 7));
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 2;

      // Draw Top Text
      if (topText.trim()) {
        const str = allCaps ? topText.toUpperCase() : topText;
        ctx.textBaseline = 'top';
        const lines = wrapText(ctx, str, imgW * 0.92);
        lines.forEach((line, idx) => {
          const y = 20 + idx * (scaledSize * 1.15);
          ctx.strokeText(line, imgW / 2, y);
          ctx.fillText(line, imgW / 2, y);
        });
      }

      // Draw Bottom Text
      if (bottomText.trim()) {
        const str = allCaps ? bottomText.toUpperCase() : bottomText;
        ctx.textBaseline = 'bottom';
        const lines = wrapText(ctx, str, imgW * 0.92);
        lines.reverse().forEach((line, idx) => {
          const y = imgH - 24 - idx * (scaledSize * 1.15);
          ctx.strokeText(line, imgW / 2, y);
          ctx.fillText(line, imgW / 2, y);
        });
      }
    } else {
      // Modern Twitter / Reddit card style with white top banner
      const bannerHeight = Math.max(100, Math.round(imgH * 0.28));
      canvas.width = imgW;
      canvas.height = imgH + bannerHeight;

      // White banner on top
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, imgW, bannerHeight);

      // Draw image below banner
      ctx.drawImage(sourceImg, 0, bannerHeight);

      // Banner text (Dark Sans)
      const scaledSize = Math.max(16, Math.round((fontSize * imgW) / 1000));
      ctx.font = `600 ${scaledSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#0f1419';

      const fullText = `${topText} ${bottomText}`.trim();
      const lines = wrapText(ctx, fullText, imgW * 0.92);
      lines.forEach((line, idx) => {
        const y = 24 + idx * (scaledSize * 1.35);
        if (y + scaledSize < bannerHeight) {
          ctx.fillText(line, imgW * 0.04, y);
        }
      });
    }

    setPreviewUrl(canvas.toDataURL('image/png'));
    return canvas;
  }

  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  function downloadMeme() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const baseName = file?.name.substring(0, file.name.lastIndexOf('.')) || 'meme';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${baseName}-meme.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  }

  async function copyMemeImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        setCopiedImg(true);
        setTimeout(() => setCopiedImg(false), 2000);
      }, 'image/png');
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={close}>
      <section
        ref={dialogRef as any}
        tabIndex={-1}
        className="tool-workspace memegen-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="memegen-title"
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
          <span className="tool-icon orange">
            <Smile size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Social media')} <span>/</span> {t('MEME STUDIO & TEXT OVERLAY')}
              </span>
              <span className="hd-pill">CLASSIC & MODERN</span>
            </div>
            <h2 id="memegen-title">{t('Meme Generator & Text Overlay Studio')}</h2>
            <p>
              {t('Create classic Impact memes or modern card-style posts with high-contrast outlines and instant image clipboard copy.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('Instant Export · Retina Quality')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Visual Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {sourceImg ? t('MEME CANVAS PREVIEW') : t('MEME WORKBENCH')}
              </span>
              <span>{file ? file.name : t('Select image')}</span>
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
                  <Smile size={34} />
                </div>
                <h3>{t('Drop image to create meme')}</h3>
                <p>{t('Supports PNG, JPG, WebP. Add bold top and bottom captions in seconds.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Choose Image')}
                </span>
              </button>
            ) : (
              <div className="memegen-stage-wrap">
                <div className="memegen-preview-box">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Meme Preview" className="memegen-preview-img" />
                  ) : (
                    <div className="preview-loading">{t('Generating meme…')}</div>
                  )}
                </div>

                <div className="memegen-action-row">
                  <button
                    type="button"
                    className="download-btn-green"
                    onClick={downloadMeme}
                  >
                    <Download size={16} />
                    {t('Download Meme PNG')}
                  </button>

                  <button
                    type="button"
                    className="primary-action"
                    onClick={copyMemeImage}
                  >
                    {copiedImg ? <Check size={16} /> : <Copy size={16} />}
                    {copiedImg ? t('Meme Copied!') : t('Copy Image')}
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
              <label>{t('Meme Style')}</label>
              <div className="btn-toggle-group">
                <button
                  type="button"
                  className={memeStyle === 'classic' ? 'active' : ''}
                  onClick={() => setMemeStyle('classic')}
                >
                  {t('Classic (Impact)')}
                </button>
                <button
                  type="button"
                  className={memeStyle === 'modern' ? 'active' : ''}
                  onClick={() => setMemeStyle('modern')}
                >
                  {t('Modern (Top Card)')}
                </button>
              </div>
            </div>

            <div className="control-group">
              <label>{t('Top Caption')}</label>
              <input
                type="text"
                className="tool-input-text"
                value={topText}
                onChange={(e) => setTopText(e.target.value)}
                placeholder="TOP CAPTION"
              />
            </div>

            <div className="control-group">
              <label>{t('Bottom Caption')}</label>
              <input
                type="text"
                className="tool-input-text"
                value={bottomText}
                onChange={(e) => setBottomText(e.target.value)}
                placeholder="BOTTOM CAPTION"
              />
            </div>

            <div className="control-group">
              <div className="slider-label-row">
                <span>{t('Caption Font Size')}</span>
                <strong>{fontSize}px</strong>
              </div>
              <input
                type="range"
                min="24"
                max="80"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
              />
            </div>

            <div className="control-group toggle-row-card">
              <div className="toggle-info">
                <span>{t('ALL CAPS')}</span>
              </div>
              <input
                type="checkbox"
                checked={allCaps}
                onChange={(e) => setAllCaps(e.target.checked)}
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
