import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Download,
  Eye,
  EyeOff,
  Grid,
  Image as ImageIcon,
  RotateCcw,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X
} from 'lucide-react';

interface BlurRegion {
  id: string;
  x: number; // percentage
  y: number; // percentage
  width: number; // percentage
  height: number; // percentage
  type: 'pixelate' | 'blur' | 'blackout';
}

interface FaceBlurToolProps {
  initialFiles?: File[];
  close: () => void;
}

export default function FaceBlurTool({ initialFiles = [], close }: FaceBlurToolProps) {
  const [file, setFile] = useState<File | null>(initialFiles[0] || null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Regions & Effect Settings
  const [regions, setRegions] = useState<BlurRegion[]>([]);
  const [currentEffect, setCurrentEffect] = useState<'pixelate' | 'blur' | 'blackout'>('pixelate');
  const [pixelSize, setPixelSize] = useState<number>(14);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Export state
  const [busy, setBusy] = useState<boolean>(false);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // DOM Refs
  const dialogRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);

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

  // Cleanup URLs
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      if (processedUrl) URL.revokeObjectURL(processedUrl);
    };
  }, [imageUrl, processedUrl]);

  // Initial file
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFileSelected(initialFiles[0]);
    }
  }, []);

  function handleFileSelected(f?: File) {
    if (!f) return;
    setErrorMessage('');
    const valid = f.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(f.name);
    if (!valid) {
      setErrorMessage(t('Please select a valid image file (JPG, PNG, WebP).'));
      return;
    }

    if (imageUrl) URL.revokeObjectURL(imageUrl);
    if (processedUrl) URL.revokeObjectURL(processedUrl);

    const url = URL.createObjectURL(f);
    setFile(f);
    setImageUrl(url);
    setRegions([]);
    setProcessedBlob(null);
    setProcessedUrl('');

    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      sourceImageRef.current = img;
    };
    img.src = url;
  }

  // Mouse drawing for regions
  function handleMouseDown(e: React.MouseEvent) {
    if (!stageRef.current || busy || processedBlob) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setIsDrawing(true);
    setStartPoint({ x, y });
    setDragRect({ x, y, w: 0, h: 0 });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDrawing || !startPoint || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
    const currentY = ((e.clientY - rect.top) / rect.height) * 100;

    const x = Math.min(startPoint.x, currentX);
    const y = Math.min(startPoint.y, currentY);
    const w = Math.abs(currentX - startPoint.x);
    const h = Math.abs(currentY - startPoint.y);

    setDragRect({ x, y, w, h });
  }

  function handleMouseUp() {
    if (!isDrawing || !dragRect) return;
    setIsDrawing(false);

    if (dragRect.w > 1.5 && dragRect.h > 1.5) {
      const newRegion: BlurRegion = {
        id: Math.random().toString(36).substring(2, 9),
        x: dragRect.x,
        y: dragRect.y,
        width: dragRect.w,
        height: dragRect.h,
        type: currentEffect
      };
      setRegions((prev) => [...prev, newRegion]);
    }

    setStartPoint(null);
    setDragRect(null);
  }

  function removeRegion(id: string) {
    setRegions((prev) => prev.filter((r) => r.id !== id));
  }

  // Render finalized censored image onto canvas
  async function applyCensoring() {
    if (!sourceImageRef.current || !file) return;
    setBusy(true);
    setErrorMessage('');

    try {
      const img = sourceImageRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(t('Canvas processing failed.'));

      // Draw original image
      ctx.drawImage(img, 0, 0);

      const w = canvas.width;
      const h = canvas.height;

      // Apply each region
      regions.forEach((region) => {
        const rx = Math.round((region.x / 100) * w);
        const ry = Math.round((region.y / 100) * h);
        const rw = Math.round((region.width / 100) * w);
        const rh = Math.round((region.height / 100) * h);

        if (rw <= 0 || rh <= 0) return;

        if (region.type === 'blackout') {
          ctx.fillStyle = '#000000';
          ctx.fillRect(rx, ry, rw, rh);
        } else if (region.type === 'pixelate') {
          // Pixelate effect: downscale snippet and upscale back with nearest-neighbor
          const blockSize = Math.max(6, Math.round(pixelSize * (w / 800)));
          const tempCanvas = document.createElement('canvas');
          const tw = Math.max(1, Math.round(rw / blockSize));
          const th = Math.max(1, Math.round(rh / blockSize));
          tempCanvas.width = tw;
          tempCanvas.height = th;
          const tCtx = tempCanvas.getContext('2d');
          if (!tCtx) return;

          tCtx.drawImage(img, rx, ry, rw, rh, 0, 0, tw, th);

          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(tempCanvas, 0, 0, tw, th, rx, ry, rw, rh);
          ctx.restore();
        } else if (region.type === 'blur') {
          // Smooth Gaussian blur
          ctx.save();
          ctx.beginPath();
          ctx.rect(rx, ry, rw, rh);
          ctx.clip();
          ctx.filter = `blur(${Math.max(10, Math.round(pixelSize * 1.5))}px)`;
          ctx.drawImage(img, 0, 0, w, h);
          ctx.restore();
        }
      });

      const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), mime, 0.94);
      });

      const url = URL.createObjectURL(blob);
      setProcessedBlob(blob);
      setProcessedUrl(url);
    } catch (err: any) {
      setErrorMessage(err.message || t('Failed to apply censorship.'));
    } finally {
      setBusy(false);
    }
  }

  function downloadProcessedImage() {
    if (!processedBlob || !file) return;
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const a = document.createElement('a');
    a.href = processedUrl;
    a.download = `${baseName}-censored.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleReset() {
    if (processedUrl) URL.revokeObjectURL(processedUrl);
    setProcessedBlob(null);
    setProcessedUrl('');
  }

  return (
    <div className="modal-backdrop workspace-backdrop" onClick={() => !busy && close()}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="tool-workspace faceblur-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="faceblur-title"
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
            {t('Private & Client-Side · In-Browser Privacy Shield')}
          </span>
          <button className="workspace-close" disabled={busy} onClick={close} aria-label={t('Close tool')}>
            <X size={19} />
          </button>
        </div>

        {/* Heading */}
        <div className="workspace-heading">
          <span className="tool-icon rose">
            <EyeOff size={26} />
          </span>
          <div>
            <div className="workspace-heading-tags">
              <span className="workspace-category">
                {t('Image tools')} <span>/</span> {t('FACE & LICENSE PLATE BLUR')}
              </span>
              <span className="hd-pill">PRIVACY CENSOR</span>
            </div>
            <h2 id="faceblur-title">{t('Face & License Plate Blur')}</h2>
            <p>
              {t('Pixelate or blur human faces, car number plates, addresses, and sensitive badges on photos before sharing.')}
            </p>
          </div>
          <span className="workspace-free">
            <span />
            {t('100% In-Browser · Permanent')}
          </span>
        </div>

        {/* Workspace Grid */}
        <div className="workspace-grid">
          {/* Main Visual Stage */}
          <div className="workspace-canvas">
            <div className="canvas-heading">
              <span>
                <span className="canvas-dot" />
                {processedBlob
                  ? t('CENSORED RESULT')
                  : file
                  ? `${t('DRAG OVER FACES TO BLUR')} (${regions.length} ${t('regions')})`
                  : t('PHOTO PREVIEW')}
              </span>
              <span>{file ? file.name : t('Select a photo')}</span>
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
                  <ImageIcon size={34} />
                </div>
                <h3>{t('Drop photo here to blur faces or plates')}</h3>
                <p>{t('Supports JPG, PNG, and WebP. Click and drag boxes over areas you want to censor.')}</p>
                <span className="btn-fake">
                  <Upload size={16} />
                  {t('Select photo')}
                </span>
              </button>
            ) : processedBlob ? (
              <div className="faceblur-result-container">
                <img src={processedUrl} alt="Censored photo" className="faceblur-result-img" />
              </div>
            ) : (
              <div className="faceblur-stage-wrap">
                <div
                  ref={stageRef}
                  className="faceblur-interactive-stage"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                >
                  <img src={imageUrl} alt="Censor target" className="faceblur-target-img" />

                  {/* Active drawn regions */}
                  {regions.map((region) => (
                    <div
                      key={region.id}
                      className={`faceblur-region-box ${region.type}`}
                      style={{
                        left: `${region.x}%`,
                        top: `${region.y}%`,
                        width: `${region.width}%`,
                        height: `${region.height}%`
                      }}
                    >
                      <button
                        className="faceblur-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRegion(region.id);
                        }}
                        aria-label={t('Remove blur box')}
                      >
                        <X size={12} />
                      </button>
                      <span className="region-type-label">{region.type}</span>
                    </div>
                  ))}

                  {/* Current Drag Box */}
                  {dragRect && (
                    <div
                      className={`faceblur-drag-box ${currentEffect}`}
                      style={{
                        left: `${dragRect.x}%`,
                        top: `${dragRect.y}%`,
                        width: `${dragRect.w}%`,
                        height: `${dragRect.h}%`
                      }}
                    />
                  )}
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
              accept="image/*,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                handleFileSelected(e.target.files?.[0]);
                e.target.value = '';
              }}
            />

            {!processedBlob ? (
              <>
                <div className="control-group">
                  <label>{t('Censor Effect Type')}</label>
                  <div className="btn-toggle-group">
                    <button
                      type="button"
                      className={currentEffect === 'pixelate' ? 'active' : ''}
                      onClick={() => setCurrentEffect('pixelate')}
                    >
                      <Grid size={15} />
                      {t('Pixelate (Mosaic)')}
                    </button>
                    <button
                      type="button"
                      className={currentEffect === 'blur' ? 'active' : ''}
                      onClick={() => setCurrentEffect('blur')}
                    >
                      <Sparkles size={15} />
                      {t('Smooth Blur')}
                    </button>
                    <button
                      type="button"
                      className={currentEffect === 'blackout' ? 'active' : ''}
                      onClick={() => setCurrentEffect('blackout')}
                    >
                      <EyeOff size={15} />
                      {t('Blackout Box')}
                    </button>
                  </div>
                </div>

                {currentEffect !== 'blackout' && (
                  <div className="control-group">
                    <div className="slider-label-row">
                      <span>{currentEffect === 'pixelate' ? t('Mosaic Tile Size') : t('Blur Strength')}</span>
                      <span>{pixelSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="8"
                      max="32"
                      value={pixelSize}
                      onChange={(e) => setPixelSize(Number(e.target.value))}
                    />
                  </div>
                )}

                <div className="control-group">
                  <label>{t('Protected Areas')}</label>
                  <div className="spec-card">
                    <div className="spec-row">
                      <span>{t('Boxes Drawn')}</span>
                      <strong>{regions.length} {t('areas')}</strong>
                    </div>
                    <div className="spec-row">
                      <span>{t('Resolution')}</span>
                      <strong>
                        {imageSize.width > 0 ? `${imageSize.width} × ${imageSize.height} px` : '-'}
                      </strong>
                    </div>
                  </div>
                </div>

                <button
                  className="primary-action"
                  disabled={!file || regions.length === 0 || busy}
                  onClick={applyCensoring}
                >
                  {busy ? <RotateCw size={17} className="spin" /> : <EyeOff size={17} />}
                  {busy ? t('Applying privacy censorship…') : t('Apply Blur & Censor')}
                </button>
              </>
            ) : (
              <>
                <div className="control-group">
                  <div className="spec-card">
                    <div className="spec-row">
                      <span>{t('Status')}</span>
                      <strong className="badge-green">{t('Privacy Protected')}</strong>
                    </div>
                    <div className="spec-row">
                      <span>{t('Areas Censored')}</span>
                      <strong>{regions.length}</strong>
                    </div>
                  </div>
                </div>

                <button className="download-btn-green" onClick={downloadProcessedImage}>
                  <Download size={18} />
                  {t('Download Censored Photo')}
                </button>

                <button className="btn-change-file" onClick={handleReset}>
                  <RotateCcw size={16} />
                  {t('Adjust Boxes Again')}
                </button>
              </>
            )}

            {file && (
              <button
                className="btn-change-file"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('Change photo')}
              </button>
            )}

            {errorMessage && <div className="error-banner">{errorMessage}</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
